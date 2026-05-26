import type { MediaType } from "@/types";

/** Safe max for video models (keeps request payloads reasonable) */
export const MAX_PROMPT_CHARS_VIDEO = 1500;

/** Image / layout generation prompts */
export const MAX_PROMPT_CHARS_IMAGE = 4000;

export function maxPromptCharsForMedia(mediaType: MediaType): number {
  return mediaType === "video" ? MAX_PROMPT_CHARS_VIDEO : MAX_PROMPT_CHARS_IMAGE;
}

export function clampPromptText(
  text: string,
  mediaType: MediaType
): string {
  const max = maxPromptCharsForMedia(mediaType);
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function promptWithinLimit(
  text: string,
  mediaType: MediaType
): boolean {
  return text.trim().length > 0 && text.length <= maxPromptCharsForMedia(mediaType);
}

export function formatPromptCountLabel(
  length: number,
  mediaType: MediaType
): string {
  const max = maxPromptCharsForMedia(mediaType);
  return `${Math.min(length, max)} / ${max}`;
}

export function formatPromptLimitHint(mediaType: MediaType): string {
  const max = maxPromptCharsForMedia(mediaType);
  return `Prompt up to ${max.toLocaleString()} characters`;
}

export function promptOverLimitMessage(
  length: number,
  mediaType: MediaType
): string {
  const max = maxPromptCharsForMedia(mediaType);
  return `Prompt is too long (${length.toLocaleString()} / ${max.toLocaleString()} characters). Shorten it to continue.`;
}
