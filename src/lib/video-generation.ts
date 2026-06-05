import { markLayoutVariantError } from "@/lib/conversations-api";
import {
  formatOpenRouterErrorForUser,
  isRetryableOpenRouterError,
  retryDelayMs,
  sleepMs,
} from "@/lib/openrouter-errors";
import {
  apiErrorMessageFromResponse,
  parseApiJsonResponse,
} from "@/lib/parse-api-response";
import { maxReferencesForMedia } from "@/lib/reference-limits";
import { MIN_VIDEO_REFERENCE_DIMENSION } from "@/lib/reference-image-dimensions";
import { runWithConcurrency, serializeReferences } from "@/lib/reference-utils";
import { videoUrlToPreserveReference } from "@/lib/video-frame-reference";
import type {
  LayoutVariant,
  ReferenceImage,
  ReferenceImagePayload,
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
  referencePayloads?: ReferenceImagePayload[];
  conversationId: string;
  variant: LayoutVariant;
}): Promise<LayoutVariant> {
  const promptText = options.prompt.trim();
  if (!promptText) {
    throw new Error("Enter a prompt to generate video.");
  }

  const refPayloads = options.referencePayloads?.length
    ? options.referencePayloads
    : await serializeReferences(
        options.references.slice(0, maxReferencesForMedia("video")),
        { minDimension: MIN_VIDEO_REFERENCE_DIMENSION }
      );

  const maxAttempts = 3;
  let lastError = "Video generation failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch("/api/generate/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPrompt: promptText,
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

    const { data, raw, parseError } = await parseApiJsonResponse<{
      error?: string;
      videoUrl?: string;
      videoMeta?: VideoMeta;
    }>(res);

    if (res.ok && data) {
      return {
        ...options.variant,
        status: "complete",
        videoUrl: data.videoUrl as string,
        videoMeta: data.videoMeta ?? options.variant.videoMeta,
        errorMessage: undefined,
      };
    }

    lastError = data?.error
      ? formatOpenRouterErrorForUser(data.error)
      : apiErrorMessageFromResponse(
          res,
          raw,
          parseError,
          `Video generation failed (${res.status})`
        );
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

async function persistVideoVariantError(
  conversationId: string,
  variantId: string,
  message: string
): Promise<void> {
  try {
    await markLayoutVariantError(conversationId, variantId, message);
  } catch {
    /* keep local error state if sync fails */
  }
}

export async function generateVideoVariantVariations(options: {
  parent: LayoutVariant;
  pendingVariations: LayoutVariant[];
  conversationId: string;
  videoModel: string;
  duration: number;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
  generateAudio: boolean;
  onProgress?: (variations: LayoutVariant[]) => void;
}): Promise<LayoutVariant[]> {
  if (!options.parent.videoUrl) {
    throw new Error("Parent video is required to create variations.");
  }

  const parentMeta = options.parent.videoMeta ?? {};
  const parentFrame = await videoUrlToPreserveReference(options.parent.videoUrl);
  const referencePayloads = parentFrame ? [parentFrame] : undefined;
  const variations: LayoutVariant[] = options.pendingVariations.map((v) => ({
    ...v,
    status: "generating" as const,
  }));

  options.onProgress?.([...variations]);

  await runWithConcurrency(
    variations,
    1,
    async (variant, index) => {
      const meta = variant.videoMeta ?? parentMeta;
      const promptText = variant.userPrompt?.trim() ?? "";
      try {
        const updated = await generateVideoVariant({
          prompt: promptText,
          videoModel: meta.model ?? options.videoModel,
          duration: meta.duration ?? options.duration,
          resolution: meta.resolution ?? options.resolution,
          aspectRatio: meta.aspectRatio ?? options.aspectRatio,
          generateAudio: meta.generateAudio ?? options.generateAudio,
          references: [],
          referencePayloads,
          conversationId: options.conversationId,
          variant,
        });
        variations[index] = updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Video variation failed";
        await persistVideoVariantError(
          options.conversationId,
          variant.id,
          message
        );
        variations[index] = {
          ...variant,
          status: "error",
          errorMessage: message,
        };
      }
      options.onProgress?.([...variations]);
    }
  );

  return variations;
}
