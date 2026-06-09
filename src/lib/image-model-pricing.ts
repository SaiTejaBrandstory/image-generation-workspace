/** Storyboard frames use OpenRouter image_config image_size 1K at 16:9. */
export const STORYBOARD_IMAGE_OUTPUT_TOKENS_1K = 1290;

/** ~1376×768 output for 16:9 at the 1K tier. */
export const STORYBOARD_IMAGE_OUTPUT_MEGAPIXELS = (1376 * 768) / 1_000_000;

/** Flux-style models bill image_output per token at ~4096 tokens per megapixel. */
const FLUX_TOKENS_PER_MEGAPIXEL = 4096;

export interface ImageModelPricing {
  costPerImageUsd: number | null;
  /** Short label, e.g. "$0.04/img" */
  label: string;
  detail: string;
  isEstimate: boolean;
}

function formatUsdPerImage(usd: number, estimate = false): string {
  const prefix = estimate ? "~" : "";
  if (usd < 0.01) return `${prefix}$${usd.toFixed(3)}/img`;
  if (usd < 1) return `${prefix}$${usd.toFixed(2)}/img`;
  return `${prefix}$${usd.toFixed(2)}/img`;
}

function parsePricingNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isZeroPricingField(value: string | undefined): boolean {
  if (!value) return true;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n === 0;
}

/** Flux bills image_output per token at megapixel scale; prompt/completion are zero. */
function isFluxStyleImageOutput(pricing: Record<string, string>): boolean {
  return (
    isZeroPricingField(pricing.prompt) &&
    isZeroPricingField(pricing.completion) &&
    pricing.image_token == null
  );
}

/**
 * Parse OpenRouter endpoint `pricing` for a single storyboard frame (1K · 16:9).
 */
export function parseStoryboardImagePricing(
  pricing: Record<string, string> | undefined
): ImageModelPricing {
  if (!pricing || Object.keys(pricing).length === 0) {
    return {
      costPerImageUsd: null,
      label: "—",
      detail: "Pricing unavailable",
      isEstimate: false,
    };
  }

  const request = parsePricingNumber(pricing.request);
  if (request != null) {
    return {
      costPerImageUsd: request,
      label: formatUsdPerImage(request),
      detail: "per request",
      isEstimate: false,
    };
  }

  const imageOutput = parsePricingNumber(pricing.image_output);
  const imageToken = parsePricingNumber(pricing.image_token);
  const outputRate = imageToken ?? imageOutput;
  if (outputRate != null) {
    const fluxStyle = isFluxStyleImageOutput(pricing);
    const usd = fluxStyle
      ? outputRate *
        STORYBOARD_IMAGE_OUTPUT_MEGAPIXELS *
        FLUX_TOKENS_PER_MEGAPIXEL
      : outputRate * STORYBOARD_IMAGE_OUTPUT_TOKENS_1K;
    return {
      costPerImageUsd: usd,
      label: formatUsdPerImage(usd, fluxStyle),
      detail: fluxStyle
        ? `1K 16:9 · ${STORYBOARD_IMAGE_OUTPUT_MEGAPIXELS.toFixed(2)} MP`
        : `1K frame · ${STORYBOARD_IMAGE_OUTPUT_TOKENS_1K} image tokens`,
      isEstimate: fluxStyle,
    };
  }

  const completion = parsePricingNumber(pricing.completion);
  if (completion != null) {
    const usd = completion * STORYBOARD_IMAGE_OUTPUT_TOKENS_1K;
    return {
      costPerImageUsd: usd,
      label: formatUsdPerImage(usd, true),
      detail: `estimated · ${STORYBOARD_IMAGE_OUTPUT_TOKENS_1K} output tokens`,
      isEstimate: true,
    };
  }

  const image = parsePricingNumber(pricing.image);
  if (image != null && parsePricingNumber(pricing.prompt) == null) {
    return {
      costPerImageUsd: image,
      label: formatUsdPerImage(image),
      detail: "per image",
      isEstimate: false,
    };
  }

  return {
    costPerImageUsd: null,
    label: "See OpenRouter",
    detail: "No matching price for storyboard frame",
    isEstimate: false,
  };
}

export function estimateStoryboardImageBatchCost(
  frameCount: number,
  costPerImageUsd: number | null
): number | null {
  if (costPerImageUsd == null || !Number.isFinite(costPerImageUsd)) return null;
  if (frameCount <= 0) return null;
  return frameCount * costPerImageUsd;
}
