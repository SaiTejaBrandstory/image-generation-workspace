import { NextRequest, NextResponse } from "next/server";
import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import { generateVideoWithOpenRouter } from "@/lib/openrouter-video";
import {
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/openrouter-video-models";
import { buildStoryboardClipPrompt } from "@/lib/storyboard/storyboard-video-prompt";
import {
  buildStoryboardClipReferences,
  pickStoryboardClipDuration,
  STORYBOARD_CLIP_MAX_POLL_MS,
  STORYBOARD_VIDEO_MODEL,
} from "@/lib/storyboard/storyboard-video";
import { createClient } from "@/lib/supabase/server";
import { uploadGenerationVideoBuffer } from "@/lib/supabase/storage";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

export const maxDuration = 300;

interface GenerateVideoClipBody {
  projectId: string;
  storageConversationId?: string;
  clipId: string;
  scene: StoryboardScene;
  nextScene?: StoryboardScene | null;
  script: string;
  settings: StoryboardProjectSettings;
  continuity?: StoryboardContinuity | null;
  sceneIndex: number;
  totalScenes: number;
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

    const body = (await request.json()) as GenerateVideoClipBody;
    const scene = body.scene;

    if (!body.projectId?.trim() || !body.clipId?.trim() || !scene?.id) {
      return NextResponse.json(
        { error: "projectId, clipId, and scene are required." },
        { status: 400 }
      );
    }
    if (!scene.frameImageUrl?.trim()) {
      return NextResponse.json(
        { error: `Scene ${scene.sceneNumber} has no frame image.` },
        { status: 400 }
      );
    }

    const lastFrameUrl = body.nextScene?.frameImageUrl?.trim();
    const hasEndFrame = Boolean(lastFrameUrl);
    const duration = pickStoryboardClipDuration(scene.durationSec);

    const prompt = buildStoryboardClipPrompt({
      scene,
      script: body.script ?? "",
      settings: body.settings,
      continuity: body.continuity ?? null,
      sceneIndex: body.sceneIndex,
      totalScenes: body.totalScenes,
      hasEndFrame,
    });

    const references = await buildStoryboardClipReferences(
      scene.frameImageUrl,
      lastFrameUrl
    );

    const result = await generateVideoWithOpenRouter({
      model: STORYBOARD_VIDEO_MODEL,
      prompt,
      duration,
      resolution: DEFAULT_VIDEO_RESOLUTION,
      aspectRatio: DEFAULT_VIDEO_ASPECT,
      generateAudio: true,
      references,
      maxPollMs: STORYBOARD_CLIP_MAX_POLL_MS,
    });

    const storageFolder =
      body.storageConversationId?.trim() || body.projectId?.trim() || "storyboard-draft";
    const uploaded = await uploadGenerationVideoBuffer({
      userId: user.id,
      conversationId: storageFolder,
      variantId: `clip-${body.projectId}-${body.clipId}`,
      buffer: result.videoBuffer,
      mime: result.mime,
    });

    return NextResponse.json({
      videoUrl: uploaded.signedUrl,
      storagePath: uploaded.storagePath,
      durationSec: duration,
      sceneNumber: scene.sceneNumber,
      model: STORYBOARD_VIDEO_MODEL,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatOpenRouterErrorForUser(err.message)
        : "Video clip generation failed";
    console.error("[storyboard/generate-video-clip]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
