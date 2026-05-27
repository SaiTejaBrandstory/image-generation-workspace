import { getModelPromptLimit } from "@/lib/openrouter-models";
import type { MediaType } from "@/types";

/** Flat limit for video (unchanged — video models don't expose a prompt-chars field) */
export const MAX_PROMPT_CHARS_VIDEO = 1_500;

/** Fallback for image if no model id is provided */
export const MAX_PROMPT_CHARS_IMAGE = 4_000;

// ── Model-aware helpers ───────────────────────────────────────────────────────

/**
 * Returns the prompt character limit.
 * - For video: always uses the flat video cap.
 * - For image: uses the model's own `maxPromptChars` if an imageModelId is
 *   supplied, otherwise falls back to MAX_PROMPT_CHARS_IMAGE.
 */
export function maxPromptCharsForMedia(
  mediaType: MediaType,
  imageModelId?: string
): number {
  if (mediaType === "video") return MAX_PROMPT_CHARS_VIDEO;
  if (imageModelId) {
    return getModelPromptLimit(imageModelId);
  }
  return MAX_PROMPT_CHARS_IMAGE;
}

export function clampPromptText(
  text: string,
  mediaType: MediaType,
  imageModelId?: string
): string {
  const max = maxPromptCharsForMedia(mediaType, imageModelId);
  return text.length <= max ? text : text.slice(0, max);
}

export function promptWithinLimit(
  text: string,
  mediaType: MediaType,
  imageModelId?: string
): boolean {
  return (
    text.trim().length > 0 &&
    text.length <= maxPromptCharsForMedia(mediaType, imageModelId)
  );
}

export function formatPromptCountLabel(
  length: number,
  mediaType: MediaType,
  imageModelId?: string
): string {
  const max = maxPromptCharsForMedia(mediaType, imageModelId);
  return `${Math.min(length, max)} / ${max.toLocaleString()}`;
}

export function formatPromptLimitHint(
  mediaType: MediaType,
  imageModelId?: string
): string {
  const max = maxPromptCharsForMedia(mediaType, imageModelId);
  return `Prompt up to ${max.toLocaleString()} characters`;
}

export function promptOverLimitMessage(
  length: number,
  mediaType: MediaType,
  imageModelId?: string
): string {
  const max = maxPromptCharsForMedia(mediaType, imageModelId);
  return `Prompt is too long (${length.toLocaleString()} / ${max.toLocaleString()} characters). Shorten it to continue.`;
}
