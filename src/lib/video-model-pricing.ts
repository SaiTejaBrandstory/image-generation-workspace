/** Storyboard video defaults — matches generate-video route. */
export const STORYBOARD_PRICING_RESOLUTION = "720p" as const;
export const STORYBOARD_PRICING_WITH_AUDIO = true;

const RESOLUTION_PIXELS: Record<string, { width: number; height: number }> = {
  "480p": { width: 854, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

export interface VideoModelPricing {
  costPerSecondUsd: number | null;
  /** Short price string, e.g. "$0.10/s" */
  label: string;
  /** Human-readable basis, e.g. "720p · image-to-video · with audio" */
  detail: string;
  skuKey: string | null;
  isEstimate: boolean;
}

function formatUsdPerSecond(usd: number, estimate = false): string {
  const prefix = estimate ? "~" : "";
  if (usd < 0.01) return `${prefix}$${usd.toFixed(4)}/s`;
  if (usd < 1) return `${prefix}$${usd.toFixed(2)}/s`;
  return `${prefix}$${usd.toFixed(2)}/s`;
}

function tokensPerSecondAtResolution(
  resolution: string,
  fps = 24
): number | null {
  const px = RESOLUTION_PIXELS[resolution] ?? RESOLUTION_PIXELS["720p"];
  return (px.width * px.height * fps) / 1024;
}

function readDollarSku(
  skus: Record<string, string>,
  key: string,
  detail: string
): VideoModelPricing | null {
  const raw = skus[key];
  if (!raw) return null;
  const usd = Number.parseFloat(raw);
  if (!Number.isFinite(usd)) return null;
  return {
    costPerSecondUsd: usd,
    label: formatUsdPerSecond(usd),
    detail,
    skuKey: key,
    isEstimate: false,
  };
}

function readCentSku(
  skus: Record<string, string>,
  key: string,
  detail: string
): VideoModelPricing | null {
  const raw = skus[key];
  if (!raw) return null;
  const cents = Number.parseFloat(raw);
  if (!Number.isFinite(cents)) return null;
  const usd = cents / 100;
  return {
    costPerSecondUsd: usd,
    label: formatUsdPerSecond(usd),
    detail,
    skuKey: key,
    isEstimate: false,
  };
}

function readTokenSku(
  skus: Record<string, string>,
  key: string,
  resolution: string,
  withAudio: boolean
): VideoModelPricing | null {
  const raw = skus[key];
  if (!raw) return null;
  const rate = Number.parseFloat(raw);
  if (!Number.isFinite(rate)) return null;
  const tps = tokensPerSecondAtResolution(resolution);
  if (tps == null) return null;
  const usd = tps * rate;
  const audioLabel = withAudio ? "with audio" : "no audio";
  return {
    costPerSecondUsd: usd,
    label: formatUsdPerSecond(usd, true),
    detail: `${resolution} · token-based · ${audioLabel}`,
    skuKey: key,
    isEstimate: true,
  };
}

/**
 * Parse OpenRouter `pricing_skus` for storyboard video generation:
 * frame refs (image-to-video), 720p, audio on when the model supports it.
 */
export function parseStoryboardVideoPricing(
  skus: Record<string, string> | undefined,
  options?: {
    resolution?: string;
    withAudio?: boolean;
  }
): VideoModelPricing {
  const resolution = options?.resolution ?? STORYBOARD_PRICING_RESOLUTION;
  const withAudio = options?.withAudio ?? STORYBOARD_PRICING_WITH_AUDIO;

  if (!skus || Object.keys(skus).length === 0) {
    return {
      costPerSecondUsd: null,
      label: "—",
      detail: "Pricing unavailable",
      skuKey: null,
      isEstimate: false,
    };
  }

  // With audio on (storyboard default), prefer audio SKUs before img2vid — Kling
  // lists img2vid at the no-audio rate ($0.112) while with-audio is $0.168/s.
  const candidates: Array<() => VideoModelPricing | null> = withAudio
    ? [
        () =>
          readDollarSku(
            skus,
            `duration_seconds_with_audio_${resolution}`,
            `${resolution} · with audio`
          ),
        () =>
          readDollarSku(
            skus,
            "duration_seconds_with_audio_720p",
            "720p · with audio"
          ),
        () =>
          readDollarSku(skus, "duration_seconds_with_audio", "with audio"),
        () =>
          readDollarSku(
            skus,
            `image_to_video_duration_seconds_${resolution}`,
            `${resolution} · image-to-video`
          ),
        () =>
          readDollarSku(
            skus,
            "image_to_video_duration_seconds_720p",
            "720p · image-to-video"
          ),
        () =>
          readCentSku(
            skus,
            `cents_per_video_output_second_${resolution}`,
            `${resolution} · per output second`
          ),
        () =>
          readCentSku(
            skus,
            "cents_per_video_output_second_720p",
            "720p · per output second"
          ),
        () => readTokenSku(skus, "video_tokens", resolution, true),
        () =>
          readDollarSku(
            skus,
            `duration_seconds_${resolution}`,
            `${resolution} · per second`
          ),
        () => readDollarSku(skus, "duration_seconds", "per second"),
        () =>
          readDollarSku(
            skus,
            `text_to_video_duration_seconds_${resolution}`,
            `${resolution} · text-to-video`
          ),
        () =>
          readDollarSku(
            skus,
            "text_to_video_duration_seconds_720p",
            "720p · text-to-video"
          ),
      ]
    : [
        () =>
          readDollarSku(
            skus,
            `image_to_video_duration_seconds_${resolution}`,
            `${resolution} · image-to-video`
          ),
        () =>
          readDollarSku(
            skus,
            "image_to_video_duration_seconds_720p",
            "720p · image-to-video"
          ),
        () =>
          readDollarSku(
            skus,
            `duration_seconds_without_audio_${resolution}`,
            `${resolution} · no audio`
          ),
        () =>
          readDollarSku(
            skus,
            "duration_seconds_without_audio_720p",
            "720p · no audio"
          ),
        () =>
          readCentSku(
            skus,
            `cents_per_video_output_second_${resolution}`,
            `${resolution} · per output second`
          ),
        () =>
          readCentSku(
            skus,
            "cents_per_video_output_second_720p",
            "720p · per output second"
          ),
        () =>
          readTokenSku(skus, "video_tokens_without_audio", resolution, false),
        () =>
          readDollarSku(
            skus,
            `duration_seconds_${resolution}`,
            `${resolution} · per second`
          ),
        () => readDollarSku(skus, "duration_seconds", "per second"),
      ];

  for (const tryParse of candidates) {
    const parsed = tryParse();
    if (parsed) return parsed;
  }

  return {
    costPerSecondUsd: null,
    label: "See OpenRouter",
    detail: "No matching SKU for storyboard settings",
    skuKey: null,
    isEstimate: false,
  };
}

/** @deprecated Use parseStoryboardVideoPricing */
export function parseVideoModelPricing(
  skus: Record<string, string> | undefined
): { costPerSecondUsd: number | null; label: string } {
  const p = parseStoryboardVideoPricing(skus);
  return { costPerSecondUsd: p.costPerSecondUsd, label: p.label };
}

export function formatStoryboardJobCost(usd: number | null): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  if (usd < 0.01) return `~$${usd.toFixed(3)}`;
  if (usd < 1) return `~$${usd.toFixed(2)}`;
  return `~$${usd.toFixed(2)}`;
}

export function isLowCostVideoModel(
  costPerSecondUsd: number | null,
  allCosts: number[]
): boolean {
  if (costPerSecondUsd == null || !allCosts.length) return false;
  const sorted = [...allCosts].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length / 4)] ?? sorted[0]!;
  return costPerSecondUsd <= threshold * 1.05;
}
