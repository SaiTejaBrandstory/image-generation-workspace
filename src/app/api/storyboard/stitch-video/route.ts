import { NextRequest, NextResponse } from "next/server";
import { buildStoryboardAmbientBed } from "@/lib/storyboard/storyboard-ambient-bed";
import { buildStoryboardVoiceoverTrack } from "@/lib/storyboard/storyboard-voiceover";
import { scaleScenesToVideoDuration } from "@/lib/storyboard/voiceover-timing";
import {
  concatMp4Buffers,
  concatMp4BuffersFastWithAudio,
  concatMp4BuffersForFullStoryboard,
  formatStitchVideoErrorForUser,
  mixStoryboardFinalAudio,
  probeMp4DurationFloat,
  probeMp4DurationSec,
} from "@/lib/storyboard/stitch-videos";
import { runWithConcurrency } from "@/lib/reference-utils";
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

/** FFmpeg + upload; Hobby plan caps at 60s — full storyboard uses two-phase stitch. */
export const maxDuration = 300;
export const runtime = "nodejs";

type StitchPhase = "join" | "audio";

interface StitchVideoBody {
  projectId: string;
  storageConversationId?: string;
  clipUrls?: string[];
  clipStoragePaths?: (string | null | undefined)[];
  totalDurationSec?: number;
  scenes?: StoryboardScene[];
  genre?: StoryboardGenre;
  outputKind?: "full" | "stitched" | "scene-stitch";
  /** Full storyboard: join segments first, then audio in a second request (fits Hobby 60s). */
  stitchPhase?: StitchPhase;
  /** From join phase — video without narration/music yet. */
  partialStoragePath?: string;
  partialDurationSec?: number;
}

async function downloadClipBuffers(body: StitchVideoBody): Promise<Buffer[]> {
  const clipUrls = body.clipUrls ?? [];
  const clipIndexes = clipUrls.map((_, index) => index);
  return runWithConcurrency(clipIndexes, 4, async (i) => {
    const storagePath = body.clipStoragePaths?.[i]?.trim();
    let source = clipUrls[i]!;
    if (storagePath) {
      const signed = await getSignedMediaUrl(storagePath);
      if (signed) source = signed;
    }
    const { buffer } = await videoSourceToBuffer(source);
    return buffer;
  });
}

async function mixFullStoryboardAudio(
  stitched: Buffer,
  body: StitchVideoBody,
  videoDur: number
): Promise<{
  buffer: Buffer;
  voiceoverApplied: boolean;
  musicApplied: boolean;
}> {
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
    videoDur > 0 ? buildStoryboardAmbientBed(videoDur, body.genre) : Promise.resolve(null),
  ]);

  if (!voiceover && !ambientBed) {
    return { buffer: stitched, voiceoverApplied: false, musicApplied: false };
  }

  const mixed = await mixStoryboardFinalAudio(stitched, {
    narrationBuffer: voiceover?.buffer,
    ambientBedBuffer: ambientBed ?? undefined,
  });

  return {
    buffer: mixed,
    voiceoverApplied: Boolean(voiceover),
    musicApplied: Boolean(ambientBed),
  };
}

async function persistStitchOutput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  storageFolder: string,
  body: StitchVideoBody,
  uploaded: { storagePath: string },
  durationSec: number | null
): Promise<void> {
  if (!UUID_RE.test(storageFolder)) return;

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

  await updateStoryboardOutputs(supabase, userId, storageFolder, outputsPatch);
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

    const storageFolder =
      body.storageConversationId?.trim() || body.projectId?.trim() || "storyboard-draft";

    // —— Phase 2: add narration + music to joined video (full storyboard only) ——
    if (body.outputKind === "full" && body.stitchPhase === "audio") {
      const partialPath = body.partialStoragePath?.trim();
      if (!partialPath) {
        return NextResponse.json(
          { error: "partialStoragePath is required for audio phase." },
          { status: 400 }
        );
      }

      const signed = await getSignedMediaUrl(partialPath);
      if (!signed) {
        return NextResponse.json(
          { error: "Could not load stitched video for audio mix." },
          { status: 400 }
        );
      }

      const { buffer: joinedBuffer } = await videoSourceToBuffer(signed);
      const probed = await probeMp4DurationFloat(joinedBuffer);
      const plannedSceneDur =
        body.scenes?.reduce((sum, scene) => sum + scene.durationSec, 0) ?? 0;
      const videoDur =
        probed ??
        body.partialDurationSec ??
        body.totalDurationSec ??
        plannedSceneDur;

      const { buffer: stitched, voiceoverApplied, musicApplied } =
        await mixFullStoryboardAudio(joinedBuffer, body, videoDur);

      const durationSec =
        (await probeMp4DurationSec(stitched)) ?? Math.round(videoDur);

      const uploaded = await uploadGenerationVideoBuffer({
        userId: user.id,
        conversationId: storageFolder,
        variantId: `full-${body.projectId}`,
        buffer: stitched,
        mime: "video/mp4",
      });

      try {
        await persistStitchOutput(
          supabase,
          user.id,
          storageFolder,
          body,
          uploaded,
          durationSec
        );
      } catch (persistErr) {
        console.error(
          "[storyboard/stitch-video] DB persist failed",
          persistErr instanceof Error ? persistErr.message : persistErr
        );
      }

      return NextResponse.json({
        videoUrl: uploaded.signedUrl,
        storagePath: uploaded.storagePath,
        durationSec,
        voiceoverApplied,
        musicApplied,
        stitchPhase: "audio",
      });
    }

    // —— Phase 1 (join) or single-shot stitch ——
    if (!body.clipUrls?.length) {
      return NextResponse.json({ error: "clipUrls are required." }, { status: 400 });
    }

    const buffers = await downloadClipBuffers(body);

    console.info(
      `[storyboard/stitch-video] Stitching ${buffers.length} clips (${body.outputKind ?? "stitched"}${body.stitchPhase ? `:${body.stitchPhase}` : ""})`
    );

    let stitched: Buffer;
    if (body.outputKind === "scene-stitch" && buffers.length > 1) {
      stitched = await concatMp4BuffersFastWithAudio(buffers);
    } else if (body.outputKind === "full" && buffers.length > 1) {
      stitched = await concatMp4BuffersForFullStoryboard(buffers);
    } else if (buffers.length > 1) {
      stitched = await concatMp4Buffers(buffers);
    } else {
      stitched = buffers[0]!;
    }

    const stitchedDuration = await probeMp4DurationFloat(stitched);
    let voiceoverApplied = false;
    let musicApplied = false;

    // Full storyboard join phase — upload silent join; audio is a separate request.
    if (body.outputKind === "full" && body.stitchPhase === "join") {
      const durationSec =
        (await probeMp4DurationSec(stitched)) ??
        body.totalDurationSec ??
        null;

      const uploaded = await uploadGenerationVideoBuffer({
        userId: user.id,
        conversationId: storageFolder,
        variantId: `partial-stitch-${body.projectId}`,
        buffer: stitched,
        mime: "video/mp4",
      });

      return NextResponse.json({
        storagePath: uploaded.storagePath,
        durationSec,
        stitchPhase: "join",
        clipCount: body.clipUrls.length,
      });
    }

    // Single-shot full stitch (local / long timeout) or legacy
    if (body.outputKind === "full") {
      try {
        const plannedSceneDur =
          body.scenes?.reduce((sum, scene) => sum + scene.durationSec, 0) ?? 0;
        const videoDur =
          stitchedDuration ?? body.totalDurationSec ?? plannedSceneDur;
        const mixed = await mixFullStoryboardAudio(stitched, body, videoDur);
        stitched = mixed.buffer;
        voiceoverApplied = mixed.voiceoverApplied;
        musicApplied = mixed.musicApplied;
        if (voiceoverApplied || musicApplied) {
          console.info(
            "[storyboard/stitch-video] Mixed final audio",
            voiceoverApplied ? "narration" : "",
            musicApplied ? "music bed" : ""
          );
        }
      } catch (audioErr) {
        console.error(
          "[storyboard/stitch-video] Final audio mix failed — returning stitch without music/voice",
          audioErr instanceof Error ? audioErr.message : audioErr
        );
      }
    }

    const durationSec =
      (await probeMp4DurationSec(stitched)) ?? body.totalDurationSec ?? null;

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

    try {
      await persistStitchOutput(
        supabase,
        user.id,
        storageFolder,
        body,
        uploaded,
        durationSec
      );
    } catch (persistErr) {
      console.error(
        "[storyboard/stitch-video] DB persist failed",
        persistErr instanceof Error ? persistErr.message : persistErr
      );
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
