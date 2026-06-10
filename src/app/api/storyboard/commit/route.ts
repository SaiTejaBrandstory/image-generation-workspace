import { NextRequest, NextResponse } from "next/server";
import { persistStoryboard } from "@/lib/supabase/storyboard-db";
import { createClient } from "@/lib/supabase/server";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

interface CommitBody {
  conversationId?: string | null;
  script: string;
  settings: StoryboardProjectSettings;
  continuity?: StoryboardContinuity | null;
  scenes: StoryboardScene[];
  singleVideoStoragePath?: string | null;
  stitchedVideoStoragePath?: string | null;
  sceneStitchedVideoStoragePath?: string | null;
  singleVideoDurationSec?: number | null;
  stitchedVideoDurationSec?: number | null;
  sceneStitchedVideoDurationSec?: number | null;
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

    const body = (await request.json()) as CommitBody;
    if (!body.script?.trim()) {
      return NextResponse.json({ error: "script is required." }, { status: 400 });
    }
    if (!body.scenes?.length) {
      return NextResponse.json({ error: "scenes are required." }, { status: 400 });
    }

    const result = await persistStoryboard(supabase, user.id, {
      conversationId: body.conversationId,
      script: body.script,
      settings: body.settings,
      continuity: body.continuity ?? null,
      scenes: body.scenes,
      singleVideoStoragePath: body.singleVideoStoragePath,
      stitchedVideoStoragePath: body.stitchedVideoStoragePath,
      sceneStitchedVideoStoragePath: body.sceneStitchedVideoStoragePath,
      singleVideoDurationSec: body.singleVideoDurationSec,
      stitchedVideoDurationSec: body.stitchedVideoDurationSec,
      sceneStitchedVideoDurationSec: body.sceneStitchedVideoDurationSec,
    });

    return NextResponse.json({ conversationId: result.conversationId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save storyboard";
    console.error("[storyboard/commit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
