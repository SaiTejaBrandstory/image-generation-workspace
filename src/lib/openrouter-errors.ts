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
    m.includes("capacity")
  );
}

import {
  isReferenceResolutionError,
  MIN_VIDEO_REFERENCE_DIMENSION,
} from "@/lib/reference-image-dimensions";

export function formatOpenRouterErrorForUser(raw: string): string {
  const trimmed = raw.trim();
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
