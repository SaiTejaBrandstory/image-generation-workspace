import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatSupabaseSetupError } from "@/lib/supabase/setup-errors";
import {
  listConversations,
  searchConversations,
} from "@/lib/supabase/conversations-db";
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

interface IncomingMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  referenceIds?: string[];
}

interface CreateConversationBody {
  title?: string;
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const conversations = q
      ? await searchConversations(supabase, user.id, q)
      : await listConversations(supabase, user.id);

    return NextResponse.json({ conversations });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Failed to load history";
    const message = formatSupabaseSetupError(raw);
    console.error("[conversations GET]", raw);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

    const body = (await request.json()) as CreateConversationBody;

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const title =
      body.title?.trim() ||
      (body.prompt.length > 40
        ? `${body.prompt.slice(0, 40)}…`
        : body.prompt);

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
        prompt: body.prompt,
        style: body.style,
        platform: body.platform,
        aspect_ratio: body.aspectRatio,
        image_model: body.imageModel,
        media_type: body.mediaType ?? "image",
        video_model: body.videoModel ?? null,
        params: body.params,
        selected_layouts: body.selectedLayouts,
      })
      .select("id")
      .single();

    if (convError || !conversation) {
      throw new Error(convError?.message ?? "Failed to create conversation");
    }

    const conversationId = conversation.id as string;

    if (body.userMessage) {
      const { error: msgError } = await supabase.from("chat_messages").insert({
        id: body.userMessage.id,
        conversation_id: conversationId,
        user_id: user.id,
        role: body.userMessage.role,
        content: body.userMessage.content,
        reference_ids: body.userMessage.referenceIds ?? null,
        position: 0,
        created_at: new Date(body.userMessage.timestamp).toISOString(),
      });
      if (msgError) console.error("[conversations POST] message insert:", msgError.message);
    }

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
        generation_round: 0,
        media_type: v.mediaType ?? body.mediaType ?? "image",
        video_meta: v.videoMeta ?? null,
      }));

      const { error: variantsError } = await supabase
        .from("layout_variants")
        .insert(rows);

      if (variantsError) {
        await supabase.from("conversations").delete().eq("id", conversationId);
        throw new Error(variantsError.message);
      }
    }

    return NextResponse.json({ conversationId });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to create conversation";
    const message = formatSupabaseSetupError(raw);
    console.error("[conversations POST]", raw);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
