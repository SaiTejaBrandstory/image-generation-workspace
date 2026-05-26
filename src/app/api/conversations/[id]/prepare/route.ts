import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatSupabaseSetupError } from "@/lib/supabase/setup-errors";
import type {
  AspectRatio,
  GenerationParams,
  LayoutId,
  LayoutVariant,
  MediaType,
  PlatformPreset,
  StyleEngine,
  VideoMeta,
} from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface IncomingMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  referenceIds?: string[];
}

interface PrepareBody {
  prompt: string;
  style: StyleEngine;
  platform: PlatformPreset;
  aspectRatio: AspectRatio;
  imageModel: string;
  mediaType?: MediaType;
  videoModel?: string;
  params: GenerationParams;
  selectedLayouts: LayoutId[];
  userMessage?: IncomingMessage;
  variants: Array<{
    id: string;
    layoutId: LayoutId;
    mediaType?: MediaType;
    videoMeta?: VideoMeta;
    userPrompt?: string;
    prompt: string;
    rationale: string;
    visualPsychology: string;
    bestUse: string;
    suggestedPlatform: string;
    principles: string[];
    influenceBreakdown?: Record<string, number>;
    status: LayoutVariant["status"];
    sortIndex: number;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = (await request.json()) as PrepareBody;

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        prompt: body.prompt,
        style: body.style,
        platform: body.platform,
        aspect_ratio: body.aspectRatio,
        image_model: body.imageModel,
        media_type: body.mediaType ?? "image",
        video_model: body.videoModel ?? null,
        params: body.params,
        selected_layouts: body.selectedLayouts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (updateError) throw new Error(updateError.message);

    const { data: maxRoundRow } = await supabase
      .from("layout_variants")
      .select("generation_round")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("generation_round", { ascending: false })
      .limit(1)
      .maybeSingle();

    const generationRound = (maxRoundRow?.generation_round ?? -1) + 1;
    const roundCreatedAt = new Date().toISOString();

    if (body.variants?.length) {
      const rows = body.variants.map((v) => ({
        id: v.id,
        conversation_id: conversationId,
        user_id: user.id,
        layout_id: v.layoutId,
        user_prompt: v.userPrompt ?? body.prompt,
        prompt: v.prompt,
        rationale: v.rationale,
        visual_psychology: v.visualPsychology,
        best_use: v.bestUse,
        suggested_platform: v.suggestedPlatform,
        principles: v.principles,
        influence_breakdown: v.influenceBreakdown ?? null,
        status: v.status,
        sort_index: v.sortIndex,
        generation_round: generationRound,
        created_at: roundCreatedAt,
        media_type: v.mediaType ?? body.mediaType ?? "image",
        video_meta: v.videoMeta ?? null,
      }));

      const { error: variantsError } = await supabase
        .from("layout_variants")
        .insert(rows);

      if (variantsError) throw new Error(variantsError.message);
    }

    if (body.userMessage) {
      // Find current max position so we append, not overwrite
      const { data: lastMsg } = await supabase
        .from("chat_messages")
        .select("position")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPosition = (lastMsg?.position ?? -1) + 1;

      const { error: msgError } = await supabase.from("chat_messages").upsert({
        id: body.userMessage.id,
        conversation_id: conversationId,
        user_id: user.id,
        role: body.userMessage.role,
        content: body.userMessage.content,
        reference_ids: body.userMessage.referenceIds ?? null,
        position: nextPosition,
        created_at: new Date(body.userMessage.timestamp).toISOString(),
      });
      if (msgError) console.error("[prepare POST] message upsert:", msgError.message);
    }

    return NextResponse.json({
      conversationId,
      generationRound,
      roundCreatedAt,
    });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to prepare conversation";
    const message = formatSupabaseSetupError(raw);
    console.error("[conversations/[id]/prepare POST]", raw);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
