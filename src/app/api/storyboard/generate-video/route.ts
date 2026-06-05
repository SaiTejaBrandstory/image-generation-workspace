import { NextRequest, NextResponse } from "next/server";
import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import { generateVideoWithOpenRouter } from "@/lib/openrouter-video";
import {
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/openrouter-video-models";
import { buildStoryboardFullVideoPrompt } from "@/lib/storyboard/storyboard-video-prompt";
import {
  buildStoryboardAllFrameReferences,
  pickStoryboardVideoDuration,
  getStoryboardFullVideoMaxPollMs,
  STORYBOARD_VIDEO_MODEL,
} from "@/lib/storyboard/storyboard-video";
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

/** Vercel Hobby cap is 300s — poll window must finish within this. */
export const maxDuration = 300;

interface GenerateStoryboardVideoBody {
  projectId?: string;
  storageConversationId?: string;
  scenes: StoryboardScene[];
  script: string;
  settings: StoryboardProjectSettings;
  continuity?: StoryboardContinuity | null;
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

    const missing = scenes.find((s) => !s.frameImageUrl?.trim());
    if (missing) {
      return NextResponse.json(
        { error: `Scene ${missing.sceneNumber} has no frame image.` },
        { status: 400 }
      );
    }

    const duration = pickStoryboardVideoDuration(body.settings?.durationSec ?? 30);

    const prompt = buildStoryboardFullVideoPrompt({
      scenes,
      script: body.script ?? "",
      settings: body.settings,
      continuity: body.continuity ?? null,
      videoDurationSec: duration,
    });

    const references = await buildStoryboardAllFrameReferences(scenes);

    const result = await generateVideoWithOpenRouter({
      model: STORYBOARD_VIDEO_MODEL,
      prompt,
      duration,
      resolution: DEFAULT_VIDEO_RESOLUTION,
      aspectRatio: DEFAULT_VIDEO_ASPECT,
      generateAudio: true,
      references,
      maxPollMs: getStoryboardFullVideoMaxPollMs(),
    });

    const variantId = body.projectId?.trim() || crypto.randomUUID();
    const storageFolder =
      body.storageConversationId?.trim() || variantId || "storyboard-draft";
    const uploaded = await uploadGenerationVideoBuffer({
      userId: user.id,
      conversationId: storageFolder,
      variantId: `video-${variantId}`,
      buffer: result.videoBuffer,
      mime: result.mime,
    });

    const conversationId = storageFolder;
    if (UUID_RE.test(conversationId)) {
      try {
        await updateStoryboardOutputs(supabase, user.id, conversationId, {
          singleVideoStoragePath: uploaded.storagePath,
          singleVideoDurationSec: duration,
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
      durationSec: duration,
      model: STORYBOARD_VIDEO_MODEL,
      jobId: result.jobId,
      sceneCount: scenes.length,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatOpenRouterErrorForUser(err.message)
        : "Video generation failed";
    console.error("[storyboard/generate-video]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
