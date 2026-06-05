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
 * Smooth estimated progress while a blocking video API runs.
 * Not tied to OpenRouter job % — monotonic elapsed-time estimate only.
 */
export function startEstimatedVideoProgress(
  estimateMs: number,
  onProgress: (percent: number) => void,
  getCurrentPercent?: () => number
): () => void {
  const started = Date.now();
  let last = getCurrentPercent?.() ?? 0;

  const tick = () => {
    const elapsed = Date.now() - started;
    let target: number;
    if (elapsed < estimateMs) {
      // 8% → 70% over the expected window
      target = 8 + (elapsed / estimateMs) * 62;
    } else {
      // Slow crawl 70% → 95% so the bar never looks "stuck" on long jobs
      const overtimeMin = (elapsed - estimateMs) / 60_000;
      target = 70 + Math.min(25, overtimeMin * 4);
    }
    last = Math.round(Math.max(last, Math.min(95, target)));
    onProgress(last);
  };

  tick();
  const id = setInterval(tick, 2000);
  return () => clearInterval(id);
}
