import { NextResponse } from "next/server";
import {
  buildGenerateScriptSystemPrompt,
  buildGenerateScriptUserPrompt,
  buildRandomScriptBrief,
} from "@/lib/storyboard/generate-script-prompt";
import { storyboardChatCompletion } from "@/lib/storyboard/openrouter-text";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 45;

export async function POST() {
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
        { error: "AI is not configured." },
        { status: 503 }
      );
    }

    const brief = buildRandomScriptBrief();
    const script = await storyboardChatCompletion({
      messages: [
        { role: "system", content: buildGenerateScriptSystemPrompt() },
        { role: "user", content: buildGenerateScriptUserPrompt(brief) },
      ],
    });

    return NextResponse.json({ script });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
