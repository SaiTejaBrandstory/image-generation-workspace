import { NextRequest, NextResponse } from "next/server";
import {
  loadStoryboardByConversationId,
  updateStoryboardOutputs,
} from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const storyboard = await loadStoryboardByConversationId(
      supabase,
      user.id,
      id
    );
    if (!storyboard) {
      return NextResponse.json({ error: "Storyboard not found." }, { status: 404 });
    }

    return NextResponse.json(storyboard);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load storyboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface PatchBody {
  singleVideoStoragePath?: string | null;
  stitchedVideoStoragePath?: string | null;
  singleVideoDurationSec?: number | null;
  stitchedVideoDurationSec?: number | null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = (await request.json()) as PatchBody;
    await updateStoryboardOutputs(supabase, user.id, id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update storyboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
