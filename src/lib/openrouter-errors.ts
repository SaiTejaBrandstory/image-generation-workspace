/** Transient OpenRouter / provider errors worth retrying */
export function isRetryableOpenRouterError(
  status?: number,
  message?: string
): boolean {
  if (status === 429 || status === 502 || status === 503 || status === 529) {
    return true;
  }
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("high load") ||
    m.includes("overloaded") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("temporarily unavailable") ||
    m.includes("try again later") ||
    m.includes("service unavailable") ||
    m.includes("capacity") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("network")
  );
}

import {
  isReferenceResolutionError,
  MIN_VIDEO_REFERENCE_DIMENSION,
} from "@/lib/reference-image-dimensions";

/** Seedance blocks photorealistic / real-person-looking reference frames. */
export function isRealPersonVideoRejection(message: string): boolean {
  const text = normalizeProviderErrorText(message);
  return /SensitiveContent|PrivacyInformation|real person|may contain real/i.test(
    text
  );
}

/** Job finished but provider returned no video (safety / moderation). Raw API text only. */
export function isVideoContentFilteredError(message: string): boolean {
  const text = normalizeProviderErrorText(message).toLowerCase();
  return (
    text.includes("no output") ||
    text.includes("content may have been filtered") ||
    text.includes("safety system") ||
    /blocked by (the )?safety/i.test(text) ||
    text.includes("policy violation")
  );
}

/** Pull provider message out of `HTTP 400: {"error":{...}}` style strings. */
function normalizeProviderErrorText(raw: string): string {
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) return raw;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    const inner = parsed.error;
    if (inner?.message) {
      return [inner.code, inner.message].filter(Boolean).join(": ");
    }
    if (parsed.message) return parsed.message;
  } catch {
    /* keep original */
  }
  return raw;
}

export function formatOpenRouterErrorForUser(raw: string): string {
  const trimmed = normalizeProviderErrorText(raw.trim());
  const withoutOpId = trimmed.replace(
    /\s*Operation ID:\s*[a-f0-9-]+\.?/gi,
    ""
  ).trim();

  if (isReferenceResolutionError(withoutOpId)) {
    const dimMatch = withoutOpId.match(/got\s+(\d+)\s*[x×]\s*(\d+)/i);
    if (dimMatch) {
      return (
        `Reference image is too small (${dimMatch[1]}×${dimMatch[2]}). ` +
        `Video models require at least ${MIN_VIDEO_REFERENCE_DIMENSION}×${MIN_VIDEO_REFERENCE_DIMENSION}px per side. ` +
        `Upload a larger image or retry — we upscale small refs automatically now.`
      );
    }
    return (
      `Reference image resolution is too small. Use at least ` +
      `${MIN_VIDEO_REFERENCE_DIMENSION}×${MIN_VIDEO_REFERENCE_DIMENSION}px on each side.`
    );
  }

  if (isRealPersonVideoRejection(withoutOpId)) {
    return (
      "This storyboard frame looks like a real person, which Seedance cannot use. " +
      "If Veo fallback also failed, try a more illustrated frame style or set " +
      "STORYBOARD_VIDEO_FALLBACK_MODEL=google/veo-3.1-fast in .env."
    );
  }

  if (isVideoContentFilteredError(withoutOpId)) {
    return (
      "The video provider blocked this segment — the prompt or frames may have triggered " +
      "a safety block. Regenerate frames for these scenes with a more illustrated style, " +
      "shorten voiceover/action text, or try google/veo-3.1-fast as your primary model."
    );
  }

  if (/fetch failed|econnreset|socket hang up/i.test(withoutOpId)) {
    return (
      "Network error while contacting the video API. This often happens when " +
      "reference images are too large — we retried automatically. Please try again."
    );
  }

  if (isRetryableOpenRouterError(undefined, withoutOpId)) {
    return (
      "OpenRouter is busy right now (high load). Wait a minute and try again, " +
      "or switch to a different model. We already retried automatically."
    );
  }

  return withoutOpId || "Generation failed. Please try again.";
}

export async function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff: 2s, 4s, 8s … capped */
export function retryDelayMs(attempt: number, baseMs = 2000): number {
  return Math.min(baseMs * 2 ** attempt, 30_000);
}

export async function withOpenRouterRetries<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; label?: string }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 4;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const retryable = isRetryableOpenRouterError(
        (error as Error & { status?: number }).status,
        error.message
      );

      if (!retryable || attempt >= maxAttempts - 1) {
        throw new Error(formatOpenRouterErrorForUser(error.message));
      }

      await sleepMs(retryDelayMs(attempt));
    }
  }

  throw new Error(
    formatOpenRouterErrorForUser(
      lastError?.message ?? `${options?.label ?? "Request"} failed`
    )
  );
}
