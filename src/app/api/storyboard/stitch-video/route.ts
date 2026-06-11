import { NextRequest, NextResponse } from "next/server";
import { buildStoryboardAmbientBed } from "@/lib/storyboard/storyboard-ambient-bed";
import {
  buildStoryboardVoiceoverTrack,
  buildStoryboardVoiceoverTrackCombined,
} from "@/lib/storyboard/storyboard-voiceover";
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
  uploadGenerationAudioBuffer,
  uploadGenerationVideoBuffer,
  videoSourceToBuffer,
} from "@/lib/supabase/storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Full storyboard uses join → tts → mix (3 requests) to fit Hobby 60s. */
export const maxDuration = 300;
export const runtime = "nodejs";

type StitchPhase = "join" | "tts" | "mix" | "audio";

interface StitchVideoBody {
  projectId: string;
  storageConversationId?: string;
  clipUrls?: string[];
  clipStoragePaths?: (string | null | undefined)[];
  totalDurationSec?: number;
  scenes?: StoryboardScene[];
  genre?: StoryboardGenre;
  outputKind?: "full" | "stitched" | "scene-stitch";
  stitchPhase?: StitchPhase;
  partialStoragePath?: string;
  partialDurationSec?: number;
  narrationStoragePath?: string;
  ambientStoragePath?: string;
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

async function loadBufferFromStorage(storagePath: string): Promise<Buffer> {
  const signed = await getSignedMediaUrl(storagePath);
  if (!signed) {
    throw new Error("Could not load media from storage.");
  }
  const { buffer } = await videoSourceToBuffer(signed);
  return buffer;
}

function resolveVideoDurationSec(
  body: StitchVideoBody,
  probed: number | null
): number {
  const plannedSceneDur =
    body.scenes?.reduce((sum, scene) => sum + scene.durationSec, 0) ?? 0;
  return (
    probed ??
    body.partialDurationSec ??
    body.totalDurationSec ??
    plannedSceneDur ??
    0
  );
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

    // —— Phase 2b: generate narrator + music tracks (full storyboard) ——
    if (body.outputKind === "full" && body.stitchPhase === "tts") {
      const videoDur = resolveVideoDurationSec(body, null);
      const timedScenes =
        body.scenes?.length && videoDur > 0
          ? scaleScenesToVideoDuration(body.scenes, videoDur)
          : body.scenes ?? [];

      const useCombinedTts = process.env.VERCEL === "1";
      const [voiceover, ambientBed] = await Promise.all([
        timedScenes.some((s) => s.voiceover?.trim())
          ? useCombinedTts
            ? buildStoryboardVoiceoverTrackCombined(timedScenes, {
                targetDurationSec: videoDur,
              })
            : buildStoryboardVoiceoverTrack(timedScenes, {
                targetDurationSec: videoDur,
              })
          : Promise.resolve(null),
        videoDur > 0 ? buildStoryboardAmbientBed(videoDur, body.genre) : Promise.resolve(null),
      ]);

      let narrationStoragePath: string | undefined;
      let ambientStoragePath: string | undefined;

      if (voiceover?.buffer.length) {
        const uploaded = await uploadGenerationAudioBuffer({
          userId: user.id,
          conversationId: storageFolder,
          variantId: `narration-${body.projectId}`,
          buffer: voiceover.buffer,
        });
        narrationStoragePath = uploaded.storagePath;
      }

      if (ambientBed?.length) {
        const uploaded = await uploadGenerationAudioBuffer({
          userId: user.id,
          conversationId: storageFolder,
          variantId: `ambient-${body.projectId}`,
          buffer: ambientBed,
        });
        ambientStoragePath = uploaded.storagePath;
      }

      if (!narrationStoragePath && !ambientStoragePath) {
        return NextResponse.json(
          { error: "Could not generate narrator or music tracks." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        stitchPhase: "tts",
        narrationStoragePath,
        ambientStoragePath,
        durationSec: videoDur > 0 ? Math.round(videoDur) : null,
      });
    }

    // —— Phase 3: mix joined video + pre-built audio tracks ——
    if (body.outputKind === "full" && body.stitchPhase === "mix") {
      const partialPath = body.partialStoragePath?.trim();
      if (!partialPath) {
        return NextResponse.json(
          { error: "partialStoragePath is required for mix phase." },
          { status: 400 }
        );
      }

      const joinedBuffer = await loadBufferFromStorage(partialPath);
      const probed = await probeMp4DurationFloat(joinedBuffer);
      const videoDur = resolveVideoDurationSec(body, probed);

      const [narrationBuffer, ambientBedBuffer] = await Promise.all([
        body.narrationStoragePath?.trim()
          ? loadBufferFromStorage(body.narrationStoragePath.trim())
          : Promise.resolve(undefined),
        body.ambientStoragePath?.trim()
          ? loadBufferFromStorage(body.ambientStoragePath.trim())
          : Promise.resolve(undefined),
      ]);

      const stitched = await mixStoryboardFinalAudio(joinedBuffer, {
        narrationBuffer,
        ambientBedBuffer,
      });

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
        voiceoverApplied: Boolean(narrationBuffer?.length),
        musicApplied: Boolean(ambientBedBuffer?.length),
        stitchPhase: "mix",
      });
    }

    // —— Legacy single-shot audio phase (local dev) ——
    if (body.outputKind === "full" && body.stitchPhase === "audio") {
      const partialPath = body.partialStoragePath?.trim();
      if (!partialPath) {
        return NextResponse.json(
          { error: "partialStoragePath is required for audio phase." },
          { status: 400 }
        );
      }

      const joinedBuffer = await loadBufferFromStorage(partialPath);
      const videoDur = resolveVideoDurationSec(
        body,
        await probeMp4DurationFloat(joinedBuffer)
      );
      const timedScenes =
        body.scenes?.length && videoDur > 0
          ? scaleScenesToVideoDuration(body.scenes, videoDur)
          : body.scenes ?? [];

      const [voiceover, ambientBed] = await Promise.all([
        timedScenes.some((s) => s.voiceover?.trim())
          ? buildStoryboardVoiceoverTrackCombined(timedScenes, {
              targetDurationSec: videoDur,
            })
          : Promise.resolve(null),
        videoDur > 0 ? buildStoryboardAmbientBed(videoDur, body.genre) : Promise.resolve(null),
      ]);

      const stitched = await mixStoryboardFinalAudio(joinedBuffer, {
        narrationBuffer: voiceover?.buffer,
        ambientBedBuffer: ambientBed ?? undefined,
      });

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
        voiceoverApplied: Boolean(voiceover),
        musicApplied: Boolean(ambientBed),
        stitchPhase: "audio",
      });
    }

    // —— Phase 1 (join) or single-shot scene stitch ——
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

    const durationSec =
      (await probeMp4DurationSec(stitched)) ?? body.totalDurationSec ?? null;

    const uploaded = await uploadGenerationVideoBuffer({
      userId: user.id,
      conversationId: storageFolder,
      variantId:
        body.outputKind === "scene-stitch"
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
