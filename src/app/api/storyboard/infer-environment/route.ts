import { NextRequest, NextResponse } from "next/server";
import { storyboardChatCompletion } from "@/lib/storyboard/openrouter-text";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as { script?: string };
    const script = body.script?.trim();
    if (!script) {
      return NextResponse.json({ error: "Script is required." }, { status: 400 });
    }

    const sceneEnvironment = await storyboardChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are a storyboard production designer. Given a video script or creative brief, write ONE concise paragraph (2–4 sentences) describing the global scene environment for the entire storyboard — location, time of day, weather, lighting, and spatial context. This same environment applies to every frame. Return ONLY the paragraph, no labels or JSON.",
        },
        {
          role: "user",
          content: `Describe the global scene environment for this storyboard:\n\n${script}`,
        },
      ],
    });

    return NextResponse.json({ sceneEnvironment });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to infer scene environment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
