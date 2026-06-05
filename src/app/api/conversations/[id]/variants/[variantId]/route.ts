import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatSupabaseSetupError } from "@/lib/supabase/setup-errors";

interface RouteParams {
  params: Promise<{ id: string; variantId: string }>;
}

interface PatchBody {
  status: "error";
  errorMessage: string;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: conversationId, variantId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = (await request.json()) as PatchBody;
    if (body.status !== "error" || !body.errorMessage?.trim()) {
      return NextResponse.json(
        { error: "status and errorMessage are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("layout_variants")
      .update({
        status: "error",
        error_message: body.errorMessage.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", variantId)
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to update variant";
    const message = formatSupabaseSetupError(raw);
    console.error("[conversations/[id]/variants/[variantId] PATCH]", raw);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
