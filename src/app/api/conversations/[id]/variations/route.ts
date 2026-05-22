import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatSupabaseSetupError } from "@/lib/supabase/setup-errors";
import type { LayoutVariant } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface VariationsBody {
  parentVariantId: string;
  variants: Array<{
    id: string;
    layoutId: string;
    parentVariantId: string;
    variationIndex: number;
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
    generationRound: number;
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

    const body = (await request.json()) as VariationsBody;

    if (!body.parentVariantId?.trim()) {
      return NextResponse.json(
        { error: "parentVariantId is required" },
        { status: 400 }
      );
    }

    if (!body.variants?.length) {
      return NextResponse.json(
        { error: "variants are required" },
        { status: 400 }
      );
    }

    const { data: parent, error: parentError } = await supabase
      .from("layout_variants")
      .select("id, generation_round, sort_index")
      .eq("id", body.parentVariantId)
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (parentError || !parent) {
      return NextResponse.json({ error: "Parent layout not found" }, { status: 404 });
    }

    const rows = body.variants.map((v) => ({
      id: v.id,
      conversation_id: conversationId,
      user_id: user.id,
      layout_id: v.layoutId,
      parent_variant_id: body.parentVariantId,
      variant_kind: "variation",
      variation_index: v.variationIndex,
      user_prompt: v.userPrompt,
      prompt: v.prompt,
      rationale: v.rationale,
      visual_psychology: v.visualPsychology,
      best_use: v.bestUse,
      suggested_platform: v.suggestedPlatform,
      principles: v.principles,
      influence_breakdown: v.influenceBreakdown ?? null,
      status: v.status,
      sort_index: v.sortIndex,
      generation_round: parent.generation_round ?? v.generationRound,
    }));

    const { error: insertError } = await supabase
      .from("layout_variants")
      .insert(rows);

    if (insertError) throw new Error(insertError.message);

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, variantIds: rows.map((r) => r.id) });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to save variations";
    const message = formatSupabaseSetupError(raw);
    console.error("[conversations/[id]/variations POST]", raw);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
