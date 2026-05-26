import { NextRequest, NextResponse } from "next/server";
import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import {
  maxPromptCharsForMedia,
  promptOverLimitMessage,
} from "@/lib/prompt-limits";
import { validateVideoReferencePayloads } from "@/lib/reference-image-formats";
import { generateVideoWithOpenRouter } from "@/lib/openrouter-video";
import { createClient } from "@/lib/supabase/server";
import type { ReferenceImagePayload, VideoMeta } from "@/types";

export const maxDuration = 300;

interface GenerateVideoBody {
  userPrompt: string;
  model: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  references?: ReferenceImagePayload[];
  conversationId?: string;
  variantId?: string;
  variantMeta?: {
    rationale?: string;
    visualPsychology?: string;
    bestUse?: string;
    suggestedPlatform?: string;
    principles?: string[];
    videoMeta?: VideoMeta;
  };
}

export async function POST(request: NextRequest) {
  let body: GenerateVideoBody | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to generate videos." },
        { status: 401 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "Video generation is temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    body = (await request.json()) as GenerateVideoBody;

    if (!body.userPrompt?.trim()) {
      return NextResponse.json(
        { error: "userPrompt is required" },
        { status: 400 }
      );
    }

    if (body.userPrompt.length > maxPromptCharsForMedia("video")) {
      return NextResponse.json(
        {
          error: promptOverLimitMessage(
            body.userPrompt.length,
            "video"
          ),
        },
        { status: 400 }
      );
    }

    if (!body.model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    try {
      validateVideoReferencePayloads(body.references);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid reference image format";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const result = await generateVideoWithOpenRouter({
      model: body.model,
      prompt: body.userPrompt,
      duration: body.duration,
      resolution: body.resolution,
      aspectRatio: body.aspectRatio,
      generateAudio: body.generateAudio,
      references: body.references,
    });

    let videoUrl: string | null = null;

    if (body.conversationId && body.variantId) {
      const { persistVariantVideo } = await import(
        "@/lib/supabase/conversations-db"
      );

      await supabase
        .from("layout_variants")
        .update({ status: "generating", updated_at: new Date().toISOString() })
        .eq("id", body.variantId)
        .eq("conversation_id", body.conversationId)
        .eq("user_id", user.id);

      const persisted = await persistVariantVideo(
        supabase,
        user.id,
        body.conversationId,
        body.variantId,
        { buffer: result.videoBuffer, mime: result.mime },
        {
          status: "complete",
          userPrompt: body.userPrompt,
          rationale: body.variantMeta?.rationale,
          visualPsychology: body.variantMeta?.visualPsychology,
          bestUse: body.variantMeta?.bestUse,
          suggestedPlatform: body.variantMeta?.suggestedPlatform,
          principles: body.variantMeta?.principles,
          videoMeta: body.variantMeta?.videoMeta,
          errorMessage: null,
        }
      );

      videoUrl = persisted.signedUrl;

      // Save the assistant message server-side so it persists even if the
      // browser was refreshed or the tab was closed during generation.
      try {
        const { data: lastMsg } = await supabase
          .from("chat_messages")
          .select("position")
          .eq("conversation_id", body.conversationId)
          .eq("user_id", user.id)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase.from("chat_messages").insert({
          id: crypto.randomUUID(),
          conversation_id: body.conversationId,
          user_id: user.id,
          role: "assistant",
          content: "Your video is ready. Open the card to preview or download.",
          reference_ids: null,
          position: (lastMsg?.position ?? -1) + 1,
          created_at: new Date().toISOString(),
        });
      } catch {
        /* non-fatal — message can be re-written client-side if needed */
      }

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", body.conversationId)
        .eq("user_id", user.id);
    } else {
      return NextResponse.json(
        {
          error:
            "conversationId and variantId are required to save generated video.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      videoUrl: videoUrl!,
      jobId: result.jobId,
      videoMeta: body.variantMeta?.videoMeta,
    });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Video generation failed";
    const message = formatOpenRouterErrorForUser(raw);
    console.error("[generate/video]", message);

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
        /* ignore */
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
