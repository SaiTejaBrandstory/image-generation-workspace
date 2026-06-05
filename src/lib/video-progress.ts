/** Rough wait time from clip length + OpenRouter poll cadence (~12s) */
export function estimateVideoGenerationMs(
  durationSec: number,
  options?: { multiFrameRefs?: boolean }
): number {
  const seconds = Math.max(4, durationSec);
  const base = Math.max(90_000, seconds * 14_000 + 55_000);
  // Full storyboard video sends up to 4 frame refs — often much longer than a single clip
  return options?.multiFrameRefs ? Math.max(base, 720_000) : base;
}

/**
 * Smooth estimated progress while a single blocking /api/generate/video runs.
 * Not tied to OpenRouter job % — only elapsed time vs expected duration.
 */
export function startEstimatedVideoProgress(
  estimateMs: number,
  onProgress: (percent: number) => void
): () => void {
  const started = Date.now();

  const tick = () => {
    const elapsed = Date.now() - started;
    const ratio = Math.min(1, elapsed / estimateMs);
    // 8% after submit → up to 92% until the HTTP request completes
    const percent = Math.round(8 + ratio * 84);
    onProgress(Math.min(92, percent));
  };

  tick();
  const id = setInterval(tick, 1500);
  return () => clearInterval(id);
}
