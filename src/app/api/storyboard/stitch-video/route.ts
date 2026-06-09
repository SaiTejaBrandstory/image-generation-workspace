import { NextRequest, NextResponse } from "next/server";
import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import { buildStoryboardVoiceoverTrack } from "@/lib/storyboard/storyboard-voiceover";
import {
  concatMp4Buffers,
  concatMp4BuffersWithCrossfade,
  mixNarrationOntoVideo,
  probeMp4DurationFloat,
  probeMp4DurationSec,
} from "@/lib/storyboard/stitch-videos";
import type { StoryboardScene } from "@/types/storyboard";
import { updateStoryboardOutputs } from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";
import {
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
  totalDurationSec?: number;
  /** All storyboard scenes — used to synthesize one narrator track after stitching. */
  scenes?: StoryboardScene[];
  /** Distinguish full storyboard video vs per-frame stitched output in storage. */
  outputKind?: "full" | "stitched";
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
    for (const url of body.clipUrls) {
      const { buffer } = await videoSourceToBuffer(url);
      buffers.push(buffer);
    }

    const useCrossfade = body.outputKind === "full" && buffers.length > 1;
    let stitched = useCrossfade
      ? await concatMp4BuffersWithCrossfade(buffers)
      : await concatMp4Buffers(buffers);

    const stitchedDuration = await probeMp4DurationFloat(stitched);

    let voiceoverApplied = false;
    if (body.outputKind === "full" && body.scenes?.length) {
      try {
        const voiceover = await buildStoryboardVoiceoverTrack(body.scenes, {
          targetDurationSec: stitchedDuration ?? body.totalDurationSec,
        });
        if (voiceover) {
          stitched = await mixNarrationOntoVideo(stitched, voiceover);
          voiceoverApplied = true;
          console.info(
            "[storyboard/stitch-video] Mixed unified TTS narration with segment audio"
          );
        } else {
          console.warn(
            "[storyboard/stitch-video] No voiceover text on scenes — video keeps ambient audio only"
          );
        }
      } catch (voErr) {
        console.error(
          "[storyboard/stitch-video] Voiceover mix failed — returning stitch without narration",
          voErr instanceof Error ? voErr.message : voErr
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
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatOpenRouterErrorForUser(err.message)
        : "Video stitching failed";
    console.error("[storyboard/stitch-video]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
