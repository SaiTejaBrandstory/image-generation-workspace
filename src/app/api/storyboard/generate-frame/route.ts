import { NextRequest, NextResponse } from "next/server";
import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import { generateStoryboardSketchFrame } from "@/lib/storyboard/generate-sketch-frame";
import { createClient } from "@/lib/supabase/server";
import {
  isPersistableImageUrl,
  uploadGenerationImage,
} from "@/lib/supabase/storage";
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
  referenceFrameUrl?: string;
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

    const result = await generateStoryboardSketchFrame({
      sceneNumber: body.sceneNumber ?? 1,
      imagePrompt: body.imagePrompt,
      visualDescription: body.visualDescription ?? body.imagePrompt,
      cameraDirection: body.cameraDirection ?? "Wide Shot",
      characterActions: body.characterActions,
      environment: body.environment,
      genre: body.genre,
      frameStyle: body.frameStyle,
      visualStyle: body.visualStyle,
      continuity: body.continuity,
      referenceFrameUrl: body.referenceFrameUrl,
    });

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
