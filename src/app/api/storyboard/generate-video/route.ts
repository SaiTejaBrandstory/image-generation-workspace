import { NextRequest, NextResponse } from "next/server";
import {
  formatOpenRouterErrorForUser,
  isRealPersonVideoRejection,
} from "@/lib/openrouter-errors";
import { generateVideoWithOpenRouter } from "@/lib/openrouter-video";
import {
  clampVideoSettingsToModel,
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/openrouter-video-models";
import { buildStoryboardFullVideoPrompt } from "@/lib/storyboard/storyboard-video-prompt";
import {
  buildStoryboardAllFrameReferences,
  getStoryboardFullVideoMaxPollMs,
  getStoryboardVideoModelChain,
} from "@/lib/storyboard/storyboard-video";
import type { StoryboardVideoBatchContext } from "@/lib/storyboard/storyboard-video-prompt";
import { updateStoryboardOutputs } from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";
import { uploadGenerationVideoBuffer } from "@/lib/supabase/storage";

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
    const references = await buildStoryboardAllFrameReferences(scenes, {
      userId: user.id,
      storageConversationId: storageFolder,
    });

    const modelChain = getStoryboardVideoModelChain();
    let videoModel = modelChain[0]!;
    let videoSettings = clampVideoSettingsToModel(videoModel, {
      duration: requestedDuration,
      resolution: DEFAULT_VIDEO_RESOLUTION,
      aspectRatio: DEFAULT_VIDEO_ASPECT,
      generateAudio: true,
    });
    let result: Awaited<ReturnType<typeof generateVideoWithOpenRouter>> | null =
      null;
    let lastError: Error | null = null;

    for (let i = 0; i < modelChain.length; i++) {
      videoModel = modelChain[i]!;
      videoSettings = clampVideoSettingsToModel(videoModel, {
        duration: requestedDuration,
        resolution: DEFAULT_VIDEO_RESOLUTION,
        aspectRatio: DEFAULT_VIDEO_ASPECT,
        generateAudio: true,
      });

      const prompt = buildStoryboardFullVideoPrompt({
        scenes,
        script: body.script ?? "",
        settings: body.settings,
        continuity: body.continuity ?? null,
        videoDurationSec: videoSettings.duration,
        batch: body.batch,
      });

      try {
        result = await generateVideoWithOpenRouter({
          model: videoModel,
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
            `[storyboard/generate-video] Used fallback model ${videoModel}`
          );
        }
        break;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        const nextModel = modelChain[i + 1];
        if (nextModel && isRealPersonVideoRejection(error.message)) {
          console.warn(
            `[storyboard/generate-video] ${videoModel} rejected human frames, trying ${nextModel}`
          );
          continue;
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
    const uploaded = await uploadGenerationVideoBuffer({
      userId: user.id,
      conversationId: storageFolder,
      variantId: `video-${projectId}-${segmentKey}`,
      buffer: result.videoBuffer,
      mime: result.mime,
    });

    const conversationId = storageFolder;
    const isSingleGeneration = !body.batch || body.batch.total === 1;
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

    return NextResponse.json({
      videoUrl: uploaded.signedUrl,
      storagePath: uploaded.storagePath,
      durationSec: videoSettings.duration,
      model: videoModel,
      jobId: result.jobId,
      sceneCount: scenes.length,
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
