import { NextRequest, NextResponse } from "next/server";
import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import { generateStoryboardSketchFrame } from "@/lib/storyboard/generate-sketch-frame";
import { resolveStoryboardFrameReferences } from "@/lib/storyboard/resolve-frame-references";
import { createClient } from "@/lib/supabase/server";
import {
  isPersistableImageUrl,
  uploadGenerationImage,
} from "@/lib/supabase/storage";
import type { AspectRatio } from "@/types";
import type {
  StoryboardContinuity,
  StoryboardFrameStyle,
  StoryboardGenre,
} from "@/types/storyboard";

export const maxDuration = 120;

interface GenerateFrameBody {
  sceneId: string;
  storageConversationId?: string;
  sceneNumber?: number;
  imagePrompt: string;
  visualDescription?: string;
  cameraDirection?: string;
  characterActions?: string;
  environment?: string;
  genre?: StoryboardGenre;
  frameStyle?: StoryboardFrameStyle;
  visualStyle?: string;
  continuity?: StoryboardContinuity | null;
  referenceFrames?: Array<{
    frameImageUrl?: string;
    frameStoragePath?: string;
  }>;
  /** @deprecated Use referenceFrames */
  referenceFrameUrl?: string;
  /** @deprecated Use referenceFrames */
  referenceFrameStoragePath?: string;
  imageModel?: string;
  aspectRatio?: AspectRatio;
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
        { error: "Image generation is not configured." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as GenerateFrameBody;
    if (!body.sceneId?.trim()) {
      return NextResponse.json({ error: "sceneId is required." }, { status: 400 });
    }
    if (!body.imagePrompt?.trim() && !body.visualDescription?.trim()) {
      return NextResponse.json(
        { error: "imagePrompt or visualDescription is required." },
        { status: 400 }
      );
    }

    const sceneNumber = body.sceneNumber ?? 1;
    const referenceInputs =
      body.referenceFrames?.length
        ? body.referenceFrames
        : body.referenceFrameUrl?.trim() ||
            body.referenceFrameStoragePath?.trim()
          ? [
              {
                frameImageUrl: body.referenceFrameUrl,
                frameStoragePath: body.referenceFrameStoragePath,
              },
            ]
          : [];

    const referenceFrameUrls =
      sceneNumber > 1 && referenceInputs.length
        ? await resolveStoryboardFrameReferences(referenceInputs, {
            userId: user.id,
            storageConversationId: body.storageConversationId?.trim(),
          })
        : [];

    const result = await generateStoryboardSketchFrame(
      {
        sceneNumber,
        imagePrompt: body.imagePrompt,
        visualDescription: body.visualDescription ?? body.imagePrompt,
        cameraDirection: body.cameraDirection ?? "Wide Shot",
        characterActions: body.characterActions,
        environment: body.environment,
        genre: body.genre,
        frameStyle: body.frameStyle,
        visualStyle: body.visualStyle,
        continuity: body.continuity,
        referenceFrameUrls,
        aspectRatio: body.aspectRatio,
      },
      { model: body.imageModel, aspectRatio: body.aspectRatio }
    );

    let imageUrl = result.imageUrl;
    let storagePath: string | undefined;

    if (isPersistableImageUrl(imageUrl)) {
      try {
        const uploaded = await uploadGenerationImage({
          userId: user.id,
          conversationId: body.storageConversationId?.trim() || "storyboard-draft",
          variantId: body.sceneId,
          imageSource: imageUrl,
        });
        imageUrl = uploaded.signedUrl;
        storagePath = uploaded.storagePath;
      } catch {
        /* fall back to direct URL if storage unavailable */
      }
    }

    return NextResponse.json({ imageUrl, storagePath, model: result.model });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatOpenRouterErrorForUser(err.message)
        : "Frame generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
