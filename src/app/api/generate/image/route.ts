import { NextRequest, NextResponse } from "next/server";
import { generateImageWithOpenRouter } from "@/lib/openrouter-image";
import type {
  AspectRatio,
  DesignTokens,
  GenerationParams,
  LayoutId,
  PlatformPreset,
  ReferenceImagePayload,
  StyleEngine,
} from "@/types";

export const maxDuration = 120;

interface GenerateImageBody {
  userPrompt: string;
  layoutId: LayoutId;
  style: StyleEngine;
  platform: PlatformPreset;
  aspectRatio: AspectRatio;
  params: GenerationParams;
  designTokens?: DesignTokens;
  references?: ReferenceImagePayload[];
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "OPENROUTER_API_KEY is not configured. Add it to your .env file and restart the dev server.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as GenerateImageBody;

    if (!body.userPrompt?.trim()) {
      return NextResponse.json(
        { error: "userPrompt is required" },
        { status: 400 }
      );
    }

    if (!body.layoutId) {
      return NextResponse.json(
        { error: "layoutId is required" },
        { status: 400 }
      );
    }

    const result = await generateImageWithOpenRouter({
      userPrompt: body.userPrompt,
      layoutId: body.layoutId,
      style: body.style ?? "luxury",
      platform: body.platform ?? "instagram-post",
      aspectRatio: body.aspectRatio ?? "auto",
      params: body.params,
      designTokens: body.designTokens,
      references: body.references,
      model: body.model,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    console.error("[generate/image]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
