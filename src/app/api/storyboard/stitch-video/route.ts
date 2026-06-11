import { NextRequest, NextResponse } from "next/server";
import {
  concatMp4Buffers,
  concatMp4BuffersFastWithAudio,
  formatStitchVideoErrorForUser,
  probeMp4DurationSec,
} from "@/lib/storyboard/stitch-videos";
import { runWithConcurrency } from "@/lib/reference-utils";
import type { StoryboardGenre } from "@/types/storyboard";
import { updateStoryboardOutputs } from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";
import {
  getSignedMediaUrl,
  uploadGenerationVideoBuffer,
  videoSourceToBuffer,
} from "@/lib/supabase/storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Join clips with FFmpeg; full storyboard keeps native model audio (no TTS). */
export const maxDuration = 300;
export const runtime = "nodejs";

interface StitchVideoBody {
  projectId: string;
  storageConversationId?: string;
  clipUrls: string[];
  clipStoragePaths?: (string | null | undefined)[];
  totalDurationSec?: number;
  genre?: StoryboardGenre;
  /** full = storyboard video segments; scene-stitch = scene animation clips */
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

    const storageFolder =
      body.storageConversationId?.trim() || body.projectId?.trim() || "storyboard-draft";

    const clipIndexes = body.clipUrls.map((_, index) => index);
    const buffers = await runWithConcurrency(clipIndexes, 4, async (i) => {
      const storagePath = body.clipStoragePaths?.[i]?.trim();
      let source = body.clipUrls[i]!;
      if (storagePath) {
        const signed = await getSignedMediaUrl(storagePath);
        if (signed) source = signed;
      }
      const { buffer } = await videoSourceToBuffer(source);
      return buffer;
    });

    const preserveAudio =
      body.outputKind === "full" || body.outputKind === "scene-stitch";

    console.info(
      `[storyboard/stitch-video] Stitching ${buffers.length} clips (${body.outputKind ?? "stitched"}, audio=${preserveAudio})`
    );

    let stitched: Buffer;
    if (buffers.length === 1) {
      stitched = buffers[0]!;
    } else if (preserveAudio) {
      stitched = await concatMp4BuffersFastWithAudio(buffers);
    } else {
      stitched = await concatMp4Buffers(buffers);
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
      voiceoverApplied: preserveAudio,
      musicApplied: preserveAudio,
    });
  } catch (err) {
    const raw =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Could not stitch clips. Please try again.";
    const message = formatStitchVideoErrorForUser(raw);
    console.error(
      "[storyboard/stitch-video]",
      message,
      err instanceof Error && err.stack ? err.stack : err
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
