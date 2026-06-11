import { NextRequest, NextResponse } from "next/server";
import { attemptStoryboardRecovery } from "@/lib/storyboard/storyboard-recovery";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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

    const result = await attemptStoryboardRecovery(supabase, user.id, id);

    return NextResponse.json({
      recovered: result.recovered,
      source: result.source,
      sceneCount: result.sceneCount,
      storyboard: result.storyboard,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Storyboard recovery failed";
    console.error("[storyboard/recover]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
