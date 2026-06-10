import { NextRequest, NextResponse } from "next/server";
import { buildStoryboardAmbientBed } from "@/lib/storyboard/storyboard-ambient-bed";
import { buildStoryboardVoiceoverTrack } from "@/lib/storyboard/storyboard-voiceover";
import { scaleScenesToVideoDuration } from "@/lib/storyboard/voiceover-timing";
import {
  applySmoothEndingToMp4,
  concatMp4Buffers,
  concatMp4BuffersWithCrossfade,
  formatStitchVideoErrorForUser,
  mixStoryboardFinalAudio,
  probeMp4DurationFloat,
  probeMp4DurationSec,
} from "@/lib/storyboard/stitch-videos";
import type { StoryboardGenre, StoryboardScene } from "@/types/storyboard";
import { updateStoryboardOutputs } from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";
import {
  getSignedMediaUrl,
  uploadGenerationVideoBuffer,
  videoSourceToBuffer,
} from "@/lib/supabase/storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const maxDuration = 120;

interface StitchVideoBody {
  projectId: string;
  storageConversationId?: string;
  clipUrls: string[];
  /** Prefer storage paths — fresh signed URLs avoid expired clip links. */
  clipStoragePaths?: (string | null | undefined)[];
  totalDurationSec?: number;
  /** All storyboard scenes — used to synthesize one narrator track after stitching. */
  scenes?: StoryboardScene[];
  genre?: StoryboardGenre;
  /** full = multi-segment storyboard video; scene-stitch = scene animation clips; stitched = legacy */
  outputKind?: "full" | "stitched" | "scene-stitch";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = (await request.json()) as StitchVideoBody;
    if (!body.projectId?.trim()) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }
    if (!body.clipUrls?.length) {
      return NextResponse.json({ error: "clipUrls are required." }, { status: 400 });
    }

    const buffers: Buffer[] = [];
    for (let i = 0; i < body.clipUrls.length; i++) {
      const storagePath = body.clipStoragePaths?.[i]?.trim();
      let source = body.clipUrls[i]!;
      if (storagePath) {
        const signed = await getSignedMediaUrl(storagePath);
        if (signed) source = signed;
      }
      const { buffer } = await videoSourceToBuffer(source);
      buffers.push(buffer);
    }

    const useCrossfade =
      (body.outputKind === "full" || body.outputKind === "scene-stitch") &&
      buffers.length > 1;
    let stitched = useCrossfade
      ? await concatMp4BuffersWithCrossfade(
          buffers,
          undefined,
          body.outputKind === "scene-stitch"
            ? { preserveClipAudio: true }
            : {}
        )
      : await concatMp4Buffers(buffers);

    const stitchedDuration = await probeMp4DurationFloat(stitched);

    let voiceoverApplied = false;
    let musicApplied = false;
    if (body.outputKind === "full") {
      try {
        const plannedSceneDur = body.scenes?.reduce(
          (sum, scene) => sum + scene.durationSec,
          0
        ) ?? 0;
        const videoDur =
          stitchedDuration ?? body.totalDurationSec ?? plannedSceneDur;
        const timedScenes =
          body.scenes?.length && videoDur > 0
            ? scaleScenesToVideoDuration(body.scenes, videoDur)
            : body.scenes ?? [];

        const [voiceover, ambientBed] = await Promise.all([
          timedScenes.some((s) => s.voiceover?.trim())
            ? buildStoryboardVoiceoverTrack(timedScenes, {
                targetDurationSec: videoDur,
              })
            : Promise.resolve(null),
          videoDur > 0
            ? buildStoryboardAmbientBed(videoDur, body.genre)
            : Promise.resolve(null),
        ]);

        if (voiceover || ambientBed) {
          stitched = await mixStoryboardFinalAudio(stitched, {
            narrationBuffer: voiceover?.buffer,
            ambientBedBuffer: ambientBed ?? undefined,
          });
          voiceoverApplied = Boolean(voiceover);
          musicApplied = Boolean(ambientBed);
          console.info(
            "[storyboard/stitch-video] Mixed final audio",
            voiceover ? "narration" : "",
            ambientBed ? "music bed" : ""
          );
        }
      } catch (audioErr) {
        console.error(
          "[storyboard/stitch-video] Final audio mix failed — returning stitch without music/voice",
          audioErr instanceof Error ? audioErr.message : audioErr
        );
      }
    }

    if (body.outputKind === "full") {
      try {
        stitched = await applySmoothEndingToMp4(stitched);
      } catch (fadeErr) {
        console.warn(
          "[storyboard/stitch-video] End fade skipped",
          fadeErr instanceof Error ? fadeErr.message : fadeErr
        );
      }
    }

    const probedDurationSec = await probeMp4DurationSec(stitched);
    const durationSec =
      probedDurationSec ?? body.totalDurationSec ?? null;

    const storageFolder =
      body.storageConversationId?.trim() || body.projectId?.trim() || "storyboard-draft";
    const uploaded = await uploadGenerationVideoBuffer({
      userId: user.id,
      conversationId: storageFolder,
      variantId:
        body.outputKind === "full"
          ? `full-${body.projectId}`
          : body.outputKind === "scene-stitch"
            ? `scene-stitch-${body.projectId}`
            : `stitched-${body.projectId}`,
      buffer: stitched,
      mime: "video/mp4",
    });

    if (UUID_RE.test(storageFolder)) {
      try {
        const outputsPatch =
          body.outputKind === "full"
            ? {
                singleVideoStoragePath: uploaded.storagePath,
                singleVideoDurationSec: durationSec,
              }
            : body.outputKind === "scene-stitch"
              ? {
                  sceneStitchedVideoStoragePath: uploaded.storagePath,
                  sceneStitchedVideoDurationSec: durationSec,
                }
              : {
                  stitchedVideoStoragePath: uploaded.storagePath,
                  stitchedVideoDurationSec: durationSec,
                };
        await updateStoryboardOutputs(supabase, user.id, storageFolder, outputsPatch);
      } catch (persistErr) {
        console.error(
          "[storyboard/stitch-video] DB persist failed",
          persistErr instanceof Error ? persistErr.message : persistErr
        );
      }
    }

    return NextResponse.json({
      videoUrl: uploaded.signedUrl,
      storagePath: uploaded.storagePath,
      durationSec,
      clipCount: body.clipUrls.length,
      voiceoverApplied,
      musicApplied,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatStitchVideoErrorForUser(err.message)
        : "Could not stitch clips. Please try again.";
    console.error("[storyboard/stitch-video]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
