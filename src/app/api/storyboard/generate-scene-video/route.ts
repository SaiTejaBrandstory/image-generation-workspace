import { NextRequest, NextResponse } from "next/server";
import {
  formatOpenRouterErrorForUser,
  isRealPersonVideoRejection,
  isVideoContentFilteredError,
} from "@/lib/openrouter-errors";
import { generateVideoWithOpenRouter } from "@/lib/openrouter-video";
import {
  clampVideoSettingsToModel,
  DEFAULT_VIDEO_RESOLUTION,
  fetchVideoModelsFromOpenRouter,
  isStoryboardHumanFrameFallbackModel,
  isValidVideoModel,
  setVideoModelsCatalog,
  supportsFrameImages,
} from "@/lib/openrouter-video-models";
import { buildStoryboardClipPrompt } from "@/lib/storyboard/storyboard-video-prompt";
import {
  isClosingBookend,
  isOpeningBookend,
} from "@/lib/storyboard/bookend-scenes";
import {
  applyCinematicFadesToMp4,
  padVideoWithBlackLeader,
  probeMp4DurationFloat,
  probeMp4DurationSec,
  STORYBOARD_BLACK_LEADER_SEC,
  STORYBOARD_BLACK_TRAILER_SEC,
} from "@/lib/storyboard/stitch-videos";
import {
  buildStoryboardClipReferences,
  getStoryboardFullVideoMaxPollMs,
  pickStoryboardClipDuration,
  resolveSceneFrameHttpUrl,
  resolveStoryboardVideoAspectRatio,
  resolveStoryboardVideoModelChain,
} from "@/lib/storyboard/storyboard-video";
import { updateStoryboardSceneVideo } from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";
import { uploadGenerationVideoBuffer } from "@/lib/supabase/storage";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const maxDuration = 300;

interface GenerateSceneVideoBody {
  sceneId: string;
  scene: StoryboardScene;
  script: string;
  settings: StoryboardProjectSettings;
  continuity?: StoryboardContinuity | null;
  totalScenes: number;
  /** True when this is the first story scene — clip should open with a fade from black. */
  isFirstStoryScene?: boolean;
  /** True when this is the last story scene — clip should end with a hero hold then fade to black. */
  isLastStoryScene?: boolean;
  /** True when a closing bookend follows — last story scene should not fade to black. */
  hasClosingBookend?: boolean;
  /** True when an opening bookend precedes — first story scene should not fade from black. */
  hasOpeningBookend?: boolean;
  storageConversationId?: string;
  projectId?: string;
  videoPrimaryModel?: string;
  videoFallbackModel?: string | null;
  videoAspectRatio?: string;
  frameAspectRatio?: string;
}

function buildSceneVideoModelChain(body: GenerateSceneVideoBody): string[] {
  const primary = body.videoPrimaryModel?.trim();
  if (primary && isValidVideoModel(primary) && supportsFrameImages(primary)) {
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

    const body = (await request.json()) as GenerateSceneVideoBody;
    const scene = body.scene;
    if (!scene?.id || !body.sceneId?.trim()) {
      return NextResponse.json({ error: "scene is required." }, { status: 400 });
    }
    if (!scene.frameImageUrl?.trim() && !scene.frameStoragePath?.trim()) {
      return NextResponse.json(
        { error: `Scene ${scene.sceneNumber} has no frame image.` },
        { status: 400 }
      );
    }

    const storageFolder =
      body.storageConversationId?.trim() ||
      body.projectId?.trim() ||
      "storyboard-draft";

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
      videoAspectRatio: body.videoAspectRatio?.trim(),
    };
    const modelChain = buildSceneVideoModelChain(body);
    const refOptions = {
      userId: user.id,
      storageConversationId: storageFolder,
    };

    const frameUrl = await resolveSceneFrameHttpUrl(scene, refOptions);
    const references = await buildStoryboardClipReferences(frameUrl);
    const totalScenes = Math.max(1, body.totalScenes ?? 1);
    const sceneIndex = Math.max(0, scene.sceneNumber - 1);

    let videoModel = modelChain[0]!;
    let videoSettings = clampVideoSettingsToModel(modelChain[0]!, {
      duration: pickStoryboardClipDuration(
        scene.durationSec,
        modelChain[0]!,
        scene.voiceover,
        scene.sceneRole
      ),
      resolution: DEFAULT_VIDEO_RESOLUTION,
      aspectRatio: resolveStoryboardVideoAspectRatio(modelChain[0]!, aspectOptions),
      generateAudio: true,
    });

    let result: Awaited<ReturnType<typeof generateVideoWithOpenRouter>> | null =
      null;
    let lastError: Error | null = null;

    modelLoop: for (let i = 0; i < modelChain.length; i++) {
      const model = modelChain[i]!;
      const nextModel = modelChain[i + 1];
      videoModel = model;
      videoSettings = clampVideoSettingsToModel(model, {
        duration: pickStoryboardClipDuration(
          scene.durationSec,
          model,
          scene.voiceover,
          scene.sceneRole
        ),
        resolution: DEFAULT_VIDEO_RESOLUTION,
        aspectRatio: resolveStoryboardVideoAspectRatio(model, aspectOptions),
        generateAudio: true,
      });

      const prompt = buildStoryboardClipPrompt({
        scene,
        script: body.script ?? "",
        settings: body.settings,
        continuity: body.continuity ?? null,
        sceneIndex,
        totalScenes,
        hasEndFrame: false,
        videoDurationSec: videoSettings.duration,
        isFirstStoryScene: body.isFirstStoryScene ?? false,
        isLastStoryScene: body.isLastStoryScene ?? false,
        hasClosingBookend: body.hasClosingBookend ?? false,
        hasOpeningBookend: body.hasOpeningBookend ?? false,
      });

      if (videoSettings.duration !== scene.durationSec) {
        console.info(
          `[storyboard/generate-scene-video] Scene ${scene.sceneNumber}: storyboard slot ${scene.durationSec}s → model clip ${videoSettings.duration}s`
        );
      }

      try {
        result = await generateVideoWithOpenRouter({
          model,
          prompt,
          duration: videoSettings.duration,
          resolution: videoSettings.resolution,
          aspectRatio: videoSettings.aspectRatio,
          generateAudio: true,
          references,
          maxPollMs: getStoryboardFullVideoMaxPollMs(),
        });
        if (i > 0) {
          console.info(
            `[storyboard/generate-scene-video] Used fallback model ${model} for scene ${scene.sceneNumber}`
          );
        }
        break modelLoop;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        if (nextModel && isRealPersonVideoRejection(error.message)) {
          console.warn(
            `[storyboard/generate-scene-video] ${model} rejected human frames, trying ${nextModel}`
          );
          continue modelLoop;
        }

        if (isVideoContentFilteredError(error.message)) {
          throw error;
        }

        throw error;
      }
    }

    if (!result) {
      throw lastError ?? new Error("Scene video generation failed");
    }

    let outputBuffer = result.videoBuffer;

    const wantCinematicFade = body.settings?.enableCinematicFade !== false;
    if (wantCinematicFade && isOpeningBookend(scene)) {
      try {
        outputBuffer = await applyCinematicFadesToMp4(outputBuffer, {
          fadeIn: true,
          fadeOut: false,
        });
        outputBuffer = await padVideoWithBlackLeader(
          outputBuffer,
          STORYBOARD_BLACK_LEADER_SEC,
          0
        );
      } catch (fadeErr) {
        console.warn(
          "[storyboard/generate-scene-video] Opening bookend fade skipped",
          fadeErr instanceof Error ? fadeErr.message : fadeErr
        );
      }
    } else if (wantCinematicFade && isClosingBookend(scene)) {
      try {
        outputBuffer = await applyCinematicFadesToMp4(outputBuffer, {
          fadeIn: false,
          fadeOut: true,
        });
        outputBuffer = await padVideoWithBlackLeader(
          outputBuffer,
          0,
          STORYBOARD_BLACK_TRAILER_SEC
        );
      } catch (fadeErr) {
        console.warn(
          "[storyboard/generate-scene-video] Closing bookend fade skipped",
          fadeErr instanceof Error ? fadeErr.message : fadeErr
        );
      }
    }

    const [probedDuration, probedDurationSec] = await Promise.all([
      probeMp4DurationFloat(outputBuffer),
      probeMp4DurationSec(outputBuffer),
    ]);
    const actualDurationSec = probedDurationSec ?? videoSettings.duration;
    if (
      probedDuration != null &&
      probedDuration > videoSettings.duration + 0.35
    ) {
      console.info(
        `[storyboard/generate-scene-video] Scene ${scene.sceneNumber}: keeping full clip (${probedDuration.toFixed(2)}s, requested ${videoSettings.duration}s) to preserve narration`
      );
    }

    const projectId = body.projectId?.trim() || crypto.randomUUID();
    const uploaded = await uploadGenerationVideoBuffer({
      userId: user.id,
      conversationId: storageFolder,
      variantId: `scene-video-${projectId}-${scene.sceneNumber}`,
      buffer: outputBuffer,
      mime: result.mime,
    });

    if (UUID_RE.test(storageFolder)) {
      try {
        await updateStoryboardSceneVideo(supabase, user.id, storageFolder, scene.id, {
          sceneVideoStoragePath: uploaded.storagePath,
          sceneVideoDurationSec: actualDurationSec,
          sceneVideoStatus: "complete",
          sceneVideoError: null,
          sceneVideoModel: videoModel,
        });
      } catch (persistErr) {
        console.error(
          "[storyboard/generate-scene-video] DB persist failed",
          persistErr instanceof Error ? persistErr.message : persistErr
        );
      }
    }

    return NextResponse.json({
      videoUrl: uploaded.signedUrl,
      storagePath: uploaded.storagePath,
      durationSec: actualDurationSec,
      model: videoModel,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatOpenRouterErrorForUser(err.message)
        : "Scene video generation failed";
    console.error("[storyboard/generate-scene-video]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
