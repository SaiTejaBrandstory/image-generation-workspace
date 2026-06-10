import { NextRequest, NextResponse } from "next/server";
import {
  formatOpenRouterErrorForUser,
  isRealPersonVideoRejection,
  isVideoContentFilteredError,
} from "@/lib/openrouter-errors";
import { generateVideoWithOpenRouter } from "@/lib/openrouter-video";
import {
  clampVideoSettingsToModel,
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_RESOLUTION,
  fetchVideoModelsFromOpenRouter,
  isValidVideoModel,
  setVideoModelsCatalog,
  isStoryboardHumanFrameFallbackModel,
  supportsFrameImages,
} from "@/lib/openrouter-video-models";
import { buildStoryboardFullVideoPrompt } from "@/lib/storyboard/storyboard-video-prompt";
import { buildStoryboardAmbientBed } from "@/lib/storyboard/storyboard-ambient-bed";
import { buildStoryboardVoiceoverTrack } from "@/lib/storyboard/storyboard-voiceover";
import {
  applySmoothEndingToMp4,
  extractLastFrameFromMp4,
  mixStoryboardFinalAudio,
  probeMp4DurationFloat,
} from "@/lib/storyboard/stitch-videos";
import { scaleScenesToVideoDuration } from "@/lib/storyboard/voiceover-timing";
import {
  buildStoryboardSegmentReferences,
  describeStoryboardSegmentReferences,
  getStoryboardFullVideoMaxPollMs,
  resolveStoryboardVideoAspectRatio,
  resolveStoryboardVideoModelChain,
} from "@/lib/storyboard/storyboard-video";
import type { StoryboardVideoBatchContext } from "@/lib/storyboard/storyboard-video-prompt";
import { updateStoryboardOutputs } from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";
import {
  uploadGenerationImage,
  uploadGenerationVideoBuffer,
} from "@/lib/supabase/storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

/** 5 min per segment (Next.js max). Set STORYBOARD_VIDEO_MAX_POLL_MS=270000 on Vercel Hobby. */
export const maxDuration = 300;

interface GenerateStoryboardVideoBody {
  projectId?: string;
  storageConversationId?: string;
  scenes: StoryboardScene[];
  script: string;
  settings: StoryboardProjectSettings;
  continuity?: StoryboardContinuity | null;
  /** Override duration for this segment (batch sum or project total). */
  videoDurationSec?: number;
  batch?: StoryboardVideoBatchContext;
  /** Last frame of the previous segment — locks visual continuity at the stitch point. */
  bridgeFrameUrl?: string;
  videoPrimaryModel?: string;
  videoFallbackModel?: string | null;
  videoAspectRatio?: string;
  /** Frame image aspect — must match video output when model supports it. */
  frameAspectRatio?: string;
}

function buildStoryboardModelChain(body: GenerateStoryboardVideoBody): string[] {
  const primary = body.videoPrimaryModel?.trim();
  if (
    primary &&
    isValidVideoModel(primary) &&
    supportsFrameImages(primary)
  ) {
    const chain = [primary];
    const fallback = body.videoFallbackModel?.trim();
    if (
      fallback &&
      fallback !== primary &&
      isValidVideoModel(fallback) &&
      isStoryboardHumanFrameFallbackModel(fallback)
    ) {
      chain.push(fallback);
    }
    return chain;
  }
  return resolveStoryboardVideoModelChain({
    primaryModel: body.videoPrimaryModel,
    fallbackModel: body.videoFallbackModel,
  });
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

    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "Video generation is not configured." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as GenerateStoryboardVideoBody;
    const scenes = (body.scenes ?? [])
      .slice()
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    if (!scenes.length) {
      return NextResponse.json({ error: "No scenes provided." }, { status: 400 });
    }

    const missing = scenes.find(
      (s) => !s.frameImageUrl?.trim() && !s.frameStoragePath?.trim()
    );
    if (missing) {
      return NextResponse.json(
        { error: `Scene ${missing.sceneNumber} has no frame image.` },
        { status: 400 }
      );
    }

    const requestedDuration =
      body.videoDurationSec != null
        ? body.videoDurationSec
        : scenes.reduce((acc, scene) => acc + scene.durationSec, 0);

    const storageFolder =
      body.storageConversationId?.trim() ||
      body.projectId?.trim() ||
      "storyboard-draft";
    const refOptions = {
      userId: user.id,
      storageConversationId: storageFolder,
    };
    const segmentRefOptions = {
      ...refOptions,
      bridgeFrameUrl: body.bridgeFrameUrl?.trim(),
    };

    const primaryPick = body.videoPrimaryModel?.trim();
    if (primaryPick && !isValidVideoModel(primaryPick)) {
      try {
        const models = await fetchVideoModelsFromOpenRouter(
          process.env.OPENROUTER_API_KEY
        );
        setVideoModelsCatalog(models);
      } catch {
        /* static catalog */
      }
    }

    const aspectOptions = {
      frameAspectRatio: body.frameAspectRatio?.trim(),
      videoAspectRatio: body.videoAspectRatio?.trim() || DEFAULT_VIDEO_ASPECT,
    };
    console.info(
      "[storyboard/generate-video] aspect",
      aspectOptions.videoAspectRatio,
      "frames",
      aspectOptions.frameAspectRatio ?? "—"
    );
    const modelChain = buildStoryboardModelChain(body);
    /** Ambient/music from Veo on every segment; unified TTS narration is added at stitch for multi-segment jobs. */
    const segmentGenerateAudio = true;
    let videoModel = modelChain[0]!;
    let videoSettings = clampVideoSettingsToModel(videoModel, {
      duration: requestedDuration,
      resolution: DEFAULT_VIDEO_RESOLUTION,
      aspectRatio: resolveStoryboardVideoAspectRatio(videoModel, aspectOptions),
      generateAudio: segmentGenerateAudio,
    });
    let result: Awaited<ReturnType<typeof generateVideoWithOpenRouter>> | null =
      null;
    let lastError: Error | null = null;

    const runGeneration = async (
      model: string,
      reducedRefs: boolean
    ): Promise<Awaited<ReturnType<typeof generateVideoWithOpenRouter>>> => {
      const settings = clampVideoSettingsToModel(model, {
        duration: requestedDuration,
        resolution: DEFAULT_VIDEO_RESOLUTION,
        aspectRatio: resolveStoryboardVideoAspectRatio(model, aspectOptions),
        generateAudio: segmentGenerateAudio,
      });
      const batchContext = body.batch
        ? {
            ...body.batch,
            hasBridgeFrame: Boolean(body.bridgeFrameUrl?.trim()),
          }
        : undefined;
      const segmentRefOpts = {
        ...segmentRefOptions,
        reduced: reducedRefs,
      };
      const prompt = buildStoryboardFullVideoPrompt({
        scenes,
        script: body.script ?? "",
        settings: body.settings,
        continuity: body.continuity ?? null,
        videoDurationSec: settings.duration,
        batch: batchContext,
        referenceGuide: describeStoryboardSegmentReferences(scenes, {
          bridgeFrameUrl: body.bridgeFrameUrl,
          modelId: model,
        }),
      });
      const references = await buildStoryboardSegmentReferences(scenes, {
        ...segmentRefOpts,
        modelId: model,
      });

      videoModel = model;
      videoSettings = settings;

      return generateVideoWithOpenRouter({
        model,
        prompt,
        duration: settings.duration,
        resolution: settings.resolution,
        aspectRatio: settings.aspectRatio,
        generateAudio: segmentGenerateAudio,
        references,
        maxPollMs: getStoryboardFullVideoMaxPollMs(),
      });
    };

    modelLoop: for (let i = 0; i < modelChain.length; i++) {
      const model = modelChain[i]!;
      const nextModel = modelChain[i + 1];

      try {
        result = await runGeneration(model, false);
        if (i > 0) {
          console.info(
            `[storyboard/generate-video] Used fallback model ${model}`
          );
        }
        break modelLoop;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        if (nextModel && isRealPersonVideoRejection(error.message)) {
          console.warn(
            `[storyboard/generate-video] ${model} rejected human frames, trying ${nextModel}`
          );
          continue modelLoop;
        }

        if (isVideoContentFilteredError(error.message)) {
          console.warn(
            `[storyboard/generate-video] ${model} safety block, one retry with first/last frames only`
          );
          try {
            result = await runGeneration(model, true);
            console.info(
              `[storyboard/generate-video] Succeeded with first/last frames only (${model})`
            );
            break modelLoop;
          } catch (retryErr) {
            lastError =
              retryErr instanceof Error ? retryErr : new Error(String(retryErr));
            throw lastError;
          }
        }

        throw error;
      }
    }

    if (!result) {
      throw lastError ?? new Error("Video generation failed");
    }

    const projectId = body.projectId?.trim() || crypto.randomUUID();
    const segmentKey = body.batch
      ? `seg-${body.batch.index + 1}of${body.batch.total}`
      : "full";
    const isSingleGeneration = !body.batch || body.batch.total === 1;
    let outputBuffer = result.videoBuffer;

    if (isSingleGeneration) {
      try {
        const videoDur =
          (await probeMp4DurationFloat(outputBuffer)) ?? videoSettings.duration;
        const timedScenes = scaleScenesToVideoDuration(scenes, videoDur);
        const [voiceover, ambientBed] = await Promise.all([
          scenes.some((s) => s.voiceover?.trim())
            ? buildStoryboardVoiceoverTrack(timedScenes, {
                targetDurationSec: videoDur,
              })
            : Promise.resolve(null),
          buildStoryboardAmbientBed(videoDur, body.settings.genre),
        ]);
        if (voiceover || ambientBed) {
          outputBuffer = await mixStoryboardFinalAudio(outputBuffer, {
            narrationBuffer: voiceover?.buffer,
            ambientBedBuffer: ambientBed,
          });
          console.info(
            "[storyboard/generate-video] Mixed final audio onto single-segment video",
            voiceover ? "narration" : "",
            "music bed"
          );
        }
      } catch (audioErr) {
        console.error(
          "[storyboard/generate-video] Final audio mix failed — using model audio only",
          audioErr instanceof Error ? audioErr.message : audioErr
        );
      }
    }

    if (isSingleGeneration) {
      try {
        outputBuffer = await applySmoothEndingToMp4(outputBuffer);
      } catch (fadeErr) {
        console.warn(
          "[storyboard/generate-video] End fade skipped",
          fadeErr instanceof Error ? fadeErr.message : fadeErr
        );
      }
    }

    const uploaded = await uploadGenerationVideoBuffer({
      userId: user.id,
      conversationId: storageFolder,
      variantId: `video-${projectId}-${segmentKey}`,
      buffer: outputBuffer,
      mime: result.mime,
    });

    const conversationId = storageFolder;
    if (UUID_RE.test(conversationId) && isSingleGeneration) {
      try {
        await updateStoryboardOutputs(supabase, user.id, conversationId, {
          singleVideoStoragePath: uploaded.storagePath,
          singleVideoDurationSec: videoSettings.duration,
        });
      } catch (persistErr) {
        console.error(
          "[storyboard/generate-video] DB persist failed",
          persistErr instanceof Error ? persistErr.message : persistErr
        );
      }
    }

    let bridgeFrameUrl: string | undefined;
    if (
      body.batch &&
      body.batch.index < body.batch.total - 1
    ) {
      const frameBuffer = await extractLastFrameFromMp4(result.videoBuffer);
      const bridgeUpload = await uploadGenerationImage({
        userId: user.id,
        conversationId: storageFolder,
        variantId: `bridge-${projectId}-after-seg${body.batch.index + 1}`,
        imageSource: `data:image/jpeg;base64,${frameBuffer.toString("base64")}`,
      });
      bridgeFrameUrl = bridgeUpload.signedUrl;
    }

    return NextResponse.json({
      videoUrl: uploaded.signedUrl,
      storagePath: uploaded.storagePath,
      durationSec: videoSettings.duration,
      model: videoModel,
      jobId: result.jobId,
      sceneCount: scenes.length,
      bridgeFrameUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatOpenRouterErrorForUser(err.message)
        : "Video generation failed";
    console.error(
      "[storyboard/generate-video]",
      message,
      err instanceof Error && err.cause ? err.cause : ""
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
