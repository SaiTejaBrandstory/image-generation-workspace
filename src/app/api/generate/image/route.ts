import { NextRequest, NextResponse } from "next/server";
import { generateImageWithOpenRouter } from "@/lib/openrouter-image";
import { createClient } from "@/lib/supabase/server";
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
  conversationId?: string;
  variantId?: string;
  variantMeta?: {
    rationale?: string;
    visualPsychology?: string;
    bestUse?: string;
    suggestedPlatform?: string;
    principles?: string[];
    influenceBreakdown?: Record<string, number>;
    prompt?: string;
  };
}

export async function POST(request: NextRequest) {
  let body: GenerateImageBody | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to generate images." },
        { status: 401 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "Image generation is temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    body = (await request.json()) as GenerateImageBody;

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

    let imageUrl = result.imageUrl;

    if (body.conversationId && body.variantId) {
      const { persistVariantImage } = await import(
        "@/lib/supabase/conversations-db"
      );

      await supabase
        .from("layout_variants")
        .update({ status: "generating", updated_at: new Date().toISOString() })
        .eq("id", body.variantId)
        .eq("conversation_id", body.conversationId)
        .eq("user_id", user.id);

      const persisted = await persistVariantImage(
        supabase,
        user.id,
        body.conversationId,
        body.variantId,
        result.imageUrl,
        {
          status: "complete",
          userPrompt: body.userPrompt,
          prompt: body.variantMeta?.prompt,
          rationale: body.variantMeta?.rationale,
          visualPsychology: body.variantMeta?.visualPsychology,
          bestUse: body.variantMeta?.bestUse,
          suggestedPlatform: body.variantMeta?.suggestedPlatform,
          principles: body.variantMeta?.principles,
          influenceBreakdown: body.variantMeta?.influenceBreakdown,
          errorMessage: null,
        }
      );

      imageUrl = persisted.signedUrl;

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", body.conversationId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ ...result, imageUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    console.error("[generate/image]", message);

    if (body?.conversationId && body?.variantId) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("layout_variants")
            .update({
              status: "error",
              error_message: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", body.variantId)
            .eq("conversation_id", body.conversationId)
            .eq("user_id", user.id);
        }
      } catch {
        /* ignore secondary failure */
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
