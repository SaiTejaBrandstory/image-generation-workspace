import { parseStoryboardImagePricing } from "@/lib/image-model-pricing";
import type { AspectRatio } from "@/types";

/** How the model accepts output modalities on OpenRouter */
export type ModalityMode = "image-text" | "image-only";

export type ImageModelGroup =
  | "Google"
  | "xAI"
  | "OpenAI"
  | "Microsoft"
  | "ByteDance"
  | "Flux"
  | "Recraft"
  | "Riverflow";

/** Image models hidden from the app catalog (storyboard + workspace). */
export const STORYBOARD_EXCLUDED_IMAGE_MODEL_IDS = new Set([
  "openrouter/auto",
  "microsoft/mai-image-2.5",
]);

export interface ImageModelConfig {
  id: string;
  label: string;
  group: ImageModelGroup;
  description: string;
  /** OpenRouter modalities param */
  modalityMode: ModalityMode;
  /** Can include reference images in the API request */
  supportsVisionInput: boolean;
  /** Supports image_config.aspect_ratio */
  supportsAspectConfig: boolean;
  /**
   * Aspect ratios this model accepts.
   * "auto" is always included and means the model decides.
   * For models where supportsAspectConfig=false the ratio is used
   * as a prompt hint only — not sent to the API.
   */
  supportedAspectRatios: AspectRatio[];
  /** Maximum prompt length in characters the model reliably handles */
  maxPromptChars: number;
  /**
   * Max reference images accepted (0 = no image input supported).
   * Mirrors supportsVisionInput but gives an exact count.
   */
  maxReferenceImages: number;
  /** Max bytes per individual reference file (0 = no image input) */
  maxReferenceFileSizeBytes: number;
  costPerImageUsd: number | null;
  /** Short price string, e.g. "$0.04/img" */
  costLabel: string;
  pricingDetail: string;
  isPricingEstimate: boolean;
}

/**
 * Aspect ratios accepted by OpenRouter `image_config.aspect_ratio`.
 * @see https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 */
export const OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS: AspectRatio[] = [
  "auto",
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
];

/** Extra ratios for google/gemini-3.1-flash-image-preview only */
export const GEMINI_31_EXTENDED_ASPECT_RATIOS: AspectRatio[] = [
  "1:4",
  "4:1",
  "1:8",
  "8:1",
];

/** Shown in UI for models that apply aspect via prompt hint only (no image_config) */
export const PROMPT_HINT_IMAGE_ASPECT_RATIOS: AspectRatio[] = [
  "auto",
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
];

/** Endpoint pricing snapshots for curated models (live fetch merges these). */
const STATIC_IMAGE_ENDPOINT_PRICING: Record<string, Record<string, string>> = {
  "google/gemini-2.5-flash-image": {
    image_output: "0.00003",
    completion: "0.0000025",
  },
  "google/gemini-3.1-flash-image-preview": {
    completion: "0.000003",
    prompt: "0.0000005",
    image_output: "0.00006",
  },
  "google/gemini-3-pro-image-preview": {
    image_output: "0.00012",
    completion: "0.000012",
  },
  "openai/gpt-5-image-mini": {
    image_output: "0.000008",
    completion: "0.000002",
  },
  "openai/gpt-5-image": {
    image_output: "0.00004",
    completion: "0.00001",
  },
  "openai/gpt-5.4-image-2": {
    image_output: "0.00003",
    completion: "0.000015",
  },
  "x-ai/grok-imagine-image-quality": {
    image: "0.01",
    prompt: "0",
    completion: "0",
  },
  "black-forest-labs/flux.2-pro": {
    image_output: "0.00000732421875",
    completion: "0",
  },
  "black-forest-labs/flux.2-klein-4b": {
    image_output: "0.0000013427734375",
    completion: "0",
  },
};

/** Curated models — always priced from /endpoints (list API omits image_output). */
const CURATED_IMAGE_PRICING_MODEL_IDS = new Set(
  Object.keys(STATIC_IMAGE_ENDPOINT_PRICING)
);

type ImageModelPricingInput = Omit<
  ImageModelConfig,
  "costPerImageUsd" | "costLabel" | "pricingDetail" | "isPricingEstimate"
>;

function mergeImageEndpointPricing(
  modelId: string,
  pricing?: Record<string, string>
): Record<string, string> | undefined {
  const staticPricing = STATIC_IMAGE_ENDPOINT_PRICING[modelId];
  if (!pricing && !staticPricing) return undefined;
  if (!staticPricing) return pricing;
  if (!pricing) return staticPricing;
  // List API often lacks image_output / image_token; merge curated snapshot.
  return {
    ...pricing,
    ...(staticPricing.image_output
      ? { image_output: staticPricing.image_output }
      : {}),
    ...(staticPricing.image_token
      ? { image_token: staticPricing.image_token }
      : {}),
    ...(staticPricing.image && !pricing.image ? { image: staticPricing.image } : {}),
  };
}

function attachImageModelPricing(
  model: ImageModelPricingInput,
  pricing?: Record<string, string>
): ImageModelConfig {
  const merged = mergeImageEndpointPricing(model.id, pricing);
  const parsed = parseStoryboardImagePricing(merged);
  return {
    ...model,
    costPerImageUsd: parsed.costPerImageUsd,
    costLabel: parsed.label,
    pricingDetail: parsed.detail,
    isPricingEstimate: parsed.isEstimate,
  };
}

/** Curated popular image models from OpenRouter (?output_modalities=image) */
const OPENROUTER_IMAGE_MODELS_BASE = [
  // —— Google Gemini (Nano Banana) ——
  {
    id: "google/gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    group: "Google",
    description: "Default · fast · refs + aspect ratio",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    group: "Google",
    description: "Latest flash · refs + aspect ratio",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [
      ...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS,
      ...GEMINI_31_EXTENDED_ASPECT_RATIOS,
    ],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image",
    group: "Google",
    description: "Pro · best text in image · refs OK",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },

  // —— xAI Grok ——
  {
    id: "x-ai/grok-imagine-image-quality",
    label: "Grok Imagine Image",
    group: "xAI",
    description: "Photoreal · multilingual text · refs OK",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 4_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 2_000_000,
  },

  // —— OpenAI ——
  {
    id: "openai/gpt-5-image-mini",
    label: "GPT-5 Image Mini",
    group: "OpenAI",
    description: "Fast OpenAI image · refs OK",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "openai/gpt-5-image",
    label: "GPT-5 Image",
    group: "OpenAI",
    description: "Full GPT-5 image · refs OK",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "openai/gpt-5.4-image-2",
    label: "GPT-5.4 Image 2",
    group: "OpenAI",
    description: "Latest OpenAI · reasoning + image",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },

  // —— ByteDance ——
  {
    id: "bytedance-seed/seedream-4.5",
    label: "Seedream 4.5",
    group: "ByteDance",
    description: "ByteDance · text-to-image · high quality",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },

  // —— Black Forest Labs Flux ——
  {
    id: "black-forest-labs/flux.2-pro",
    label: "Flux 2 Pro",
    group: "Flux",
    description: "Photoreal flagship · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "black-forest-labs/flux.2-flex",
    label: "Flux 2 Flex",
    group: "Flux",
    description: "Flexible quality/speed · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "black-forest-labs/flux.2-max",
    label: "Flux 2 Max",
    group: "Flux",
    description: "Highest Flux quality · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    label: "Flux 2 Klein 4B",
    group: "Flux",
    description: "Fast lightweight Flux · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
    supportedAspectRatios: [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 32_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },

  // —— Recraft ——
  {
    id: "recraft/recraft-v3",
    label: "Recraft V3",
    group: "Recraft",
    description: "Design & illustration · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4",
    label: "Recraft V4",
    group: "Recraft",
    description: "Strong text in image · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4.1",
    label: "Recraft V4.1",
    group: "Recraft",
    description: "Latest aesthetic Recraft · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4-pro",
    label: "Recraft V4 Pro",
    group: "Recraft",
    description: "2K production Recraft · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4.1-pro",
    label: "Recraft V4.1 Pro",
    group: "Recraft",
    description: "2K V4.1 · highest Recraft fidelity · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },

  // —— Sourceful Riverflow ——
  {
    id: "sourceful/riverflow-v2-fast-preview",
    label: "Riverflow Fast",
    group: "Riverflow",
    description: "Fast commercial · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "sourceful/riverflow-v2-standard-preview",
    label: "Riverflow Standard",
    group: "Riverflow",
    description: "Balanced · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "sourceful/riverflow-v2-max-preview",
    label: "Riverflow Max",
    group: "Riverflow",
    description: "Highest Riverflow quality · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "sourceful/riverflow-v2-pro",
    label: "Riverflow Pro",
    group: "Riverflow",
    description: "Pro tier · text rendering · text-to-image",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "sourceful/riverflow-v2-fast",
    label: "Riverflow Fast",
    group: "Riverflow",
    description: "Fast commercial · image + text",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "sourceful/riverflow-v2.5-pro:free",
    label: "Riverflow 2.5 Pro (free)",
    group: "Riverflow",
    description: "Riverflow 2.5 pro · free tier",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "sourceful/riverflow-v2.5-fast:free",
    label: "Riverflow 2.5 Fast (free)",
    group: "Riverflow",
    description: "Riverflow 2.5 fast · free tier",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },

  // —— Recraft (additional OpenRouter SKUs) ——
  {
    id: "recraft/recraft-v4-vector",
    label: "Recraft V4 Vector",
    group: "Recraft",
    description: "Vector output · image + text",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4-pro-vector",
    label: "Recraft V4 Pro Vector",
    group: "Recraft",
    description: "Pro vector · image + text",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4.1-vector",
    label: "Recraft V4.1 Vector",
    group: "Recraft",
    description: "V4.1 vector · image + text",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4.1-pro-vector",
    label: "Recraft V4.1 Pro Vector",
    group: "Recraft",
    description: "V4.1 pro vector · image + text",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4.1-utility",
    label: "Recraft V4.1 Utility",
    group: "Recraft",
    description: "Utility tier · image + text",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
  {
    id: "recraft/recraft-v4.1-utility-pro",
    label: "Recraft V4.1 Utility Pro",
    group: "Recraft",
    description: "Utility pro · image + text",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
    supportedAspectRatios: [...PROMPT_HINT_IMAGE_ASPECT_RATIOS],
    maxPromptChars: 2_000,
    maxReferenceImages: 4,
    maxReferenceFileSizeBytes: 4_000_000,
  },
];

export const OPENROUTER_IMAGE_MODELS: ImageModelConfig[] =
  OPENROUTER_IMAGE_MODELS_BASE.map((model) =>
    attachImageModelPricing(model as ImageModelPricingInput)
  );

/** Legacy / renamed OpenRouter slugs → current IDs */
export const MODEL_ALIASES: Record<string, string> = {
  "sourceful/riverflow-v2-fast": "sourceful/riverflow-v2-fast-preview",
};

export const IMAGE_MODEL_GROUPS: ImageModelGroup[] = [
  "Google",
  "xAI",
  "OpenAI",
  "Microsoft",
  "ByteDance",
  "Flux",
  "Recraft",
  "Riverflow",
];

export type OpenRouterImageModelId = string;

export const DEFAULT_IMAGE_MODEL: OpenRouterImageModelId =
  "google/gemini-2.5-flash-image";

// ── Static enrichment index (keyed by model id) ─────────────────────────────
// Used to attach aspect-ratio + modality data to live API results.
const STATIC_ENRICHMENT = new Map(
  OPENROUTER_IMAGE_MODELS.map((m) => [m.id, m])
);

// ── Mutable live catalog (seeded from static list) ───────────────────────────
let _catalog: ImageModelConfig[] = [...OPENROUTER_IMAGE_MODELS];

export function getImageModelsCatalog(): ImageModelConfig[] {
  return _catalog;
}

export function setImageModelsCatalog(models: ImageModelConfig[]): void {
  if (models.length === 0) return;
  _catalog = models;
}

// ── Helpers for normalising live API rows ────────────────────────────────────

/** Raw row returned by OpenRouter GET /api/v1/models */
export interface OpenRouterImageModelApiRow {
  id: string;
  name: string;
  description?: string;
  pricing?: Record<string, string>;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

interface OpenRouterImageEndpointRow {
  pricing?: Record<string, string>;
}

function inferGroup(id: string): ImageModelGroup {
  if (id.startsWith("google/")) return "Google";
  if (id.startsWith("x-ai/")) return "xAI";
  if (id.startsWith("openai/")) return "OpenAI";
  if (id.startsWith("microsoft/")) return "Microsoft";
  if (id.startsWith("bytedance-seed/") || id.startsWith("bytedance/"))
    return "ByteDance";
  if (id.startsWith("black-forest-labs/")) return "Flux";
  if (id.startsWith("recraft/")) return "Recraft";
  if (id.startsWith("sourceful/")) return "Riverflow";
  return "Flux";
}

function overlayImageModelArchitecture(
  model: ImageModelPricingInput,
  row: OpenRouterImageModelApiRow
): ImageModelPricingInput {
  const inputMods = row.architecture?.input_modalities ?? [];
  const outputMods = row.architecture?.output_modalities ?? [];
  const supportsVisionInput =
    inputMods.includes("image") || inputMods.includes("file");

  // Respect curated image-only models — OpenRouter may list text output in architecture
  // but no endpoint accepts modalities: ["image", "text"] together.
  const modalityMode: ModalityMode =
    model.modalityMode === "image-only"
      ? "image-only"
      : outputMods.includes("text")
        ? "image-text"
        : "image-only";

  return {
    ...model,
    modalityMode,
    supportsVisionInput,
    maxReferenceImages: supportsVisionInput
      ? model.maxReferenceImages > 0
        ? model.maxReferenceImages
        : 4
      : 0,
    maxReferenceFileSizeBytes: supportsVisionInput
      ? Math.max(model.maxReferenceFileSizeBytes, 4_000_000)
      : 0,
    maxPromptChars: supportsVisionInput
      ? Math.max(model.maxPromptChars, 32_000)
      : model.maxPromptChars,
  };
}

/** All image-generation models usable in storyboard (live catalog or static fallback). */
export function storyboardSelectableImageModels(
  models: ImageModelConfig[]
): ImageModelConfig[] {
  return models.filter((m) => !STORYBOARD_EXCLUDED_IMAGE_MODEL_IDS.has(m.id));
}

function defaultAspectRatiosForGroup(
  group: ImageModelGroup,
  modelId: string
): AspectRatio[] {
  if (group === "Google" && modelId.includes("gemini-3.1-flash")) {
    return [
      ...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS,
      ...GEMINI_31_EXTENDED_ASPECT_RATIOS,
    ];
  }
  if (["Google", "OpenAI", "Flux", "xAI"].includes(group)) {
    return [...OPENROUTER_STANDARD_IMAGE_ASPECT_RATIOS];
  }
  return [...PROMPT_HINT_IMAGE_ASPECT_RATIOS];
}

function labelFromName(name: string, id: string): string {
  const stripped = name.replace(/^[^:]+:\s*/, "").trim();
  return stripped || id.split("/").pop() || id;
}

/**
 * Convert a raw OpenRouter API row into our `ImageModelConfig`.
 * Known models get the full static enrichment (aspect ratios, etc.).
 * Unknown models get sensible defaults inferred from their id prefix.
 */
export function normalizeOpenRouterImageModel(
  row: OpenRouterImageModelApiRow
): ImageModelConfig {
  // Resolve any known alias so old slugs map to the canonical id.
  const resolved = MODEL_ALIASES[row.id] ?? row.id;
  const known = STATIC_ENRICHMENT.get(resolved);
  // Return enriched static config (with correct id = resolved) for known models.
  if (known) {
    return attachImageModelPricing(
      overlayImageModelArchitecture({ ...known, id: resolved }, row),
      row.pricing ?? STATIC_IMAGE_ENDPOINT_PRICING[resolved]
    );
  }

  const group = inferGroup(row.id);
  const supportsAspectConfig = ["Google", "OpenAI", "Flux", "xAI", "Microsoft"].includes(
    group
  );

  return attachImageModelPricing(
    overlayImageModelArchitecture(
      {
        id: row.id,
        label: labelFromName(row.name, row.id),
        group,
        description: (row.description ?? "").slice(0, 120),
        modalityMode: "image-only",
        supportsVisionInput: false,
        supportsAspectConfig,
        supportedAspectRatios: defaultAspectRatiosForGroup(group, row.id),
        maxPromptChars: 2_000,
        maxReferenceImages: 0,
        maxReferenceFileSizeBytes: 0,
      },
      row
    ),
    row.pricing
  );
}

export function sortImageModelsByCost(
  models: ImageModelConfig[]
): ImageModelConfig[] {
  return [...models].sort((a, b) => {
    const ac = a.costPerImageUsd ?? Number.POSITIVE_INFINITY;
    const bc = b.costPerImageUsd ?? Number.POSITIVE_INFINITY;
    if (ac !== bc) return ac - bc;
    return a.label.localeCompare(b.label);
  });
}

function pickCheapestEndpointPricing(
  endpoints: OpenRouterImageEndpointRow[]
): Record<string, string> | undefined {
  let best: { pricing: Record<string, string>; cost: number } | undefined;

  for (const endpoint of endpoints) {
    if (!endpoint.pricing) continue;
    const parsed = parseStoryboardImagePricing(endpoint.pricing);
    if (parsed.costPerImageUsd == null) continue;
    if (
      !best ||
      parsed.costPerImageUsd < best.cost
    ) {
      best = { pricing: endpoint.pricing, cost: parsed.costPerImageUsd };
    }
  }

  return best?.pricing;
}

async function fetchImageEndpointPricing(
  modelId: string,
  headers: Record<string, string>
): Promise<Record<string, string> | undefined> {
  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/models/${encodeURIComponent(modelId)}/endpoints`,
      { headers, next: { revalidate: 3600 } }
    );
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      data?: { endpoints?: OpenRouterImageEndpointRow[] };
    };
    return pickCheapestEndpointPricing(json.data?.endpoints ?? []);
  } catch {
    return undefined;
  }
}

async function enrichImageModelsPricing(
  models: ImageModelConfig[],
  headers: Record<string, string>
): Promise<ImageModelConfig[]> {
  const needsEndpoint = models.filter(
    (m) =>
      CURATED_IMAGE_PRICING_MODEL_IDS.has(m.id) || m.costPerImageUsd == null
  );
  if (!needsEndpoint.length) return models;

  const pricingById = new Map<string, Record<string, string>>();
  const batchSize = 8;
  for (let i = 0; i < needsEndpoint.length; i += batchSize) {
    const batch = needsEndpoint.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (model) => ({
        id: model.id,
        pricing: await fetchImageEndpointPricing(model.id, headers),
      }))
    );
    for (const result of results) {
      if (result.pricing) pricingById.set(result.id, result.pricing);
    }
  }

  return models.map((model) => {
    const endpointPricing = pricingById.get(model.id);
    if (endpointPricing) {
      return attachImageModelPricing(model, endpointPricing);
    }
    if (CURATED_IMAGE_PRICING_MODEL_IDS.has(model.id)) {
      return attachImageModelPricing(
        model,
        STATIC_IMAGE_ENDPOINT_PRICING[model.id]
      );
    }
    return model;
  });
}

// ── Public helpers ────────────────────────────────────────────────────────────

export function resolveModelId(modelId: string): string {
  return MODEL_ALIASES[modelId] ?? modelId;
}

export function getModelConfig(modelId: string): ImageModelConfig {
  const resolved = resolveModelId(modelId);
  return (
    _catalog.find((m) => m.id === resolved) ??
    STATIC_ENRICHMENT.get(DEFAULT_IMAGE_MODEL)!
  );
}

export function getModalities(modelId: string): ("image" | "text")[] {
  const config = getModelConfig(modelId);
  return config.modalityMode === "image-only"
    ? ["image"]
    : ["image", "text"];
}

export function isValidImageModel(id: string): boolean {
  const resolved = resolveModelId(id);
  return _catalog.some((m) => m.id === resolved);
}

/**
 * Returns the aspect ratios supported by a given model.
 * Falls back to the default model if the id is unknown.
 */
export function getAspectRatiosForModel(modelId: string): AspectRatio[] {
  return getModelConfig(modelId).supportedAspectRatios;
}

/**
 * Returns true if the given aspect ratio is supported by the model.
 * "auto" is always valid.
 */
export function isAspectRatioSupported(
  modelId: string,
  aspectRatio: AspectRatio
): boolean {
  if (aspectRatio === "auto") return true;
  return getAspectRatiosForModel(modelId).includes(aspectRatio);
}

/** Clamp user selection to ratios this model supports (falls back to auto or first). */
export function clampImageAspectRatioToModel(
  modelId: string,
  aspectRatio: AspectRatio
): AspectRatio {
  if (isAspectRatioSupported(modelId, aspectRatio)) return aspectRatio;
  const supported = getAspectRatiosForModel(modelId);
  if (supported.includes("auto")) return "auto";
  return supported[0] ?? "auto";
}

/** Returns true if the model can accept reference images as input. */
export function modelSupportsVisionInput(modelId: string): boolean {
  return getModelConfig(modelId).supportsVisionInput;
}

/** Max prompt characters for an image model. */
export function getModelPromptLimit(modelId: string): number {
  return getModelConfig(modelId).maxPromptChars;
}

export interface ModelReferenceConfig {
  maxImages: number;
  maxFileSizeBytes: number;
  /** Derived: maxImages × maxFileSizeBytes */
  maxTotalBytes: number;
}

/** Reference image limits for an image model. */
export function getModelReferenceConfig(modelId: string): ModelReferenceConfig {
  const cfg = getModelConfig(modelId);
  return {
    maxImages: cfg.maxReferenceImages,
    maxFileSizeBytes: cfg.maxReferenceFileSizeBytes,
    maxTotalBytes: cfg.maxReferenceImages * cfg.maxReferenceFileSizeBytes,
  };
}

export function modelsByGroup(): Map<ImageModelGroup, ImageModelConfig[]> {
  const map = new Map<ImageModelGroup, ImageModelConfig[]>();
  for (const group of IMAGE_MODEL_GROUPS) {
    map.set(
      group,
      _catalog.filter((m) => m.group === group)
    );
  }
  return map;
}

// ── Live fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch image-capable models from OpenRouter.
 * Returns our static list if the API call fails.
 */
export async function fetchImageModelsFromOpenRouter(
  apiKey?: string
): Promise<ImageModelConfig[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

  // OpenRouter official endpoint for all image-generation-capable models.
  // Docs: https://openrouter.ai/docs/api-reference/models/get-models
  const res = await fetch(
    "https://openrouter.ai/api/v1/models?output_modalities=image",
    { headers, next: { revalidate: 3600 } }
  );

  if (!res.ok) {
    throw new Error(`OpenRouter models API returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: OpenRouterImageModelApiRow[] };
  // Trust the server-side filter — don't strip models based on their
  // architecture field (some models may not populate it).
  const rows = json.data ?? [];

  if (rows.length === 0) {
    throw new Error("OpenRouter returned 0 image models");
  }

  // Deduplicate by resolved id (alias rows and canonical rows can both appear).
  const seen = new Set<string>();
  const models = rows
    .map(normalizeOpenRouterImageModel)
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

  const enriched = await enrichImageModelsPricing(models, headers);
  return enriched.filter((m) => !STORYBOARD_EXCLUDED_IMAGE_MODEL_IDS.has(m.id));
}
