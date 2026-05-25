import {
  formatOpenRouterErrorForUser,
  isRetryableOpenRouterError,
  retryDelayMs,
  sleepMs,
} from "@/lib/openrouter-errors";
import { MIN_VIDEO_REFERENCE_DIMENSION } from "@/lib/reference-image-dimensions";
import { serializeReferences } from "@/lib/reference-utils";
import type {
  LayoutVariant,
  ReferenceImage,
  VideoAspectRatio,
  VideoMeta,
  VideoResolution,
} from "@/types";
import { VIDEO_LAYOUT_ID } from "@/types";

export function buildPendingVideoVariant(options: {
  prompt: string;
  videoMeta: VideoMeta;
}): LayoutVariant {
  const id = crypto.randomUUID();
  return {
    id,
    layoutId: VIDEO_LAYOUT_ID,
    mediaType: "video",
    userPrompt: options.prompt.trim(),
    prompt: options.prompt.trim(),
    rationale: "AI-generated video from your prompt.",
    visualPsychology: "Motion and pacing tuned for the selected aspect ratio.",
    bestUse: "Social, ads, and product demos",
    suggestedPlatform: "Video",
    principles: ["Motion", "Composition", "Lighting"],
    status: "pending",
    videoMeta: options.videoMeta,
  };
}

export async function generateVideoVariant(options: {
  prompt: string;
  videoModel: string;
  duration: number;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
  generateAudio: boolean;
  references: ReferenceImage[];
  conversationId: string;
  variant: LayoutVariant;
}): Promise<LayoutVariant> {
  const refPayloads = await serializeReferences(options.references, {
    minDimension: MIN_VIDEO_REFERENCE_DIMENSION,
  });

  const maxAttempts = 3;
  let lastError = "Video generation failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch("/api/generate/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPrompt: options.prompt,
        model: options.videoModel,
        duration: options.duration,
        resolution: options.resolution,
        aspectRatio: options.aspectRatio,
        generateAudio: options.generateAudio,
        references: refPayloads,
        conversationId: options.conversationId,
        variantId: options.variant.id,
        variantMeta: {
          rationale: options.variant.rationale,
          visualPsychology: options.variant.visualPsychology,
          bestUse: options.variant.bestUse,
          suggestedPlatform: options.variant.suggestedPlatform,
          principles: options.variant.principles,
          videoMeta: {
            duration: options.duration,
            resolution: options.resolution,
            aspectRatio: options.aspectRatio,
            generateAudio: options.generateAudio,
            model: options.videoModel,
          },
        },
      }),
    });

    const data = await res.json();
    if (res.ok) {
      return {
        ...options.variant,
        status: "complete",
        videoUrl: data.videoUrl as string,
        videoMeta: data.videoMeta ?? options.variant.videoMeta,
        errorMessage: undefined,
      };
    }

    lastError = (data.error as string) ?? lastError;
    if (
      isRetryableOpenRouterError(res.status, lastError) &&
      attempt < maxAttempts - 1
    ) {
      await sleepMs(retryDelayMs(attempt));
      continue;
    }
    throw new Error(formatOpenRouterErrorForUser(lastError));
  }

  throw new Error(formatOpenRouterErrorForUser(lastError));
}
