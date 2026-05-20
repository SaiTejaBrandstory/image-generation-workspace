/** How the model accepts output modalities on OpenRouter */
export type ModalityMode = "image-text" | "image-only";

export type ImageModelGroup =
  | "Google"
  | "xAI"
  | "OpenAI"
  | "ByteDance"
  | "Flux"
  | "Recraft"
  | "Riverflow";

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
}

/** Curated popular image models from OpenRouter (?output_modalities=image) */
export const OPENROUTER_IMAGE_MODELS: ImageModelConfig[] = [
  // —— Google Gemini (Nano Banana) ——
  {
    id: "google/gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    group: "Google",
    description: "Default · fast · refs + aspect ratio",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    group: "Google",
    description: "Latest flash · refs + aspect ratio",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image",
    group: "Google",
    description: "Pro · best text in image · refs OK",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },

  // —— xAI Grok ——
  {
    id: "x-ai/grok-imagine-image-quality",
    label: "Grok Imagine Image",
    group: "xAI",
    description: "Photoreal · multilingual text · refs OK",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
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
  },
  {
    id: "openai/gpt-5-image",
    label: "GPT-5 Image",
    group: "OpenAI",
    description: "Full GPT-5 image · refs OK",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },
  {
    id: "openai/gpt-5.4-image-2",
    label: "GPT-5.4 Image 2",
    group: "OpenAI",
    description: "Latest OpenAI · reasoning + image",
    modalityMode: "image-text",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },

  // —— ByteDance ——
  {
    id: "bytedance-seed/seedream-4.5",
    label: "Seedream 4.5",
    group: "ByteDance",
    description: "ByteDance · portraits & edits · refs OK",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },

  // —— Black Forest Labs Flux ——
  {
    id: "black-forest-labs/flux.2-pro",
    label: "Flux 2 Pro",
    group: "Flux",
    description: "Photoreal flagship · refs OK",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },
  {
    id: "black-forest-labs/flux.2-flex",
    label: "Flux 2 Flex",
    group: "Flux",
    description: "Flexible quality/speed · refs OK",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },
  {
    id: "black-forest-labs/flux.2-max",
    label: "Flux 2 Max",
    group: "Flux",
    description: "Highest Flux quality · refs OK",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    label: "Flux 2 Klein 4B",
    group: "Flux",
    description: "Fast lightweight Flux · refs OK",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: true,
  },

  // —— Recraft ——
  {
    id: "recraft/recraft-v3",
    label: "Recraft V3",
    group: "Recraft",
    description: "Design & illustration · img2img",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
  {
    id: "recraft/recraft-v4",
    label: "Recraft V4",
    group: "Recraft",
    description: "Strong text in image · img2img",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
  {
    id: "recraft/recraft-v4.1",
    label: "Recraft V4.1",
    group: "Recraft",
    description: "Latest aesthetic Recraft · img2img",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
  {
    id: "recraft/recraft-v4-pro",
    label: "Recraft V4 Pro",
    group: "Recraft",
    description: "2K production Recraft · img2img",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
  {
    id: "recraft/recraft-v4.1-pro",
    label: "Recraft V4.1 Pro",
    group: "Recraft",
    description: "2K V4.1 · highest Recraft fidelity",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },

  // —— Sourceful Riverflow (subset — not the whole list) ——
  {
    id: "sourceful/riverflow-v2-fast-preview",
    label: "Riverflow Fast",
    group: "Riverflow",
    description: "Fast commercial · img2img",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
  {
    id: "sourceful/riverflow-v2-standard-preview",
    label: "Riverflow Standard",
    group: "Riverflow",
    description: "Balanced · img2img",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
  {
    id: "sourceful/riverflow-v2-max-preview",
    label: "Riverflow Max",
    group: "Riverflow",
    description: "Highest Riverflow quality",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
  {
    id: "sourceful/riverflow-v2-pro",
    label: "Riverflow Pro",
    group: "Riverflow",
    description: "Pro tier · text rendering",
    modalityMode: "image-only",
    supportsVisionInput: true,
    supportsAspectConfig: false,
  },
];

/** Legacy / renamed OpenRouter slugs → current IDs */
export const MODEL_ALIASES: Record<string, string> = {
  "sourceful/riverflow-v2-fast": "sourceful/riverflow-v2-fast-preview",
};

export const IMAGE_MODEL_GROUPS: ImageModelGroup[] = [
  "Google",
  "xAI",
  "OpenAI",
  "ByteDance",
  "Flux",
  "Recraft",
  "Riverflow",
];

export type OpenRouterImageModelId =
  (typeof OPENROUTER_IMAGE_MODELS)[number]["id"];

export const DEFAULT_IMAGE_MODEL: OpenRouterImageModelId =
  "google/gemini-2.5-flash-image";

const MODEL_MAP = new Map(
  OPENROUTER_IMAGE_MODELS.map((m) => [m.id, m])
);

export function resolveModelId(modelId: string): string {
  return MODEL_ALIASES[modelId] ?? modelId;
}

export function getModelConfig(modelId: string): ImageModelConfig {
  const resolved = resolveModelId(modelId);
  return (
    MODEL_MAP.get(resolved) ??
    MODEL_MAP.get(DEFAULT_IMAGE_MODEL)!
  );
}

export function getModalities(modelId: string): ("image" | "text")[] {
  const config = getModelConfig(modelId);
  return config.modalityMode === "image-only"
    ? ["image"]
    : ["image", "text"];
}

export function isValidImageModel(id: string): boolean {
  return MODEL_MAP.has(resolveModelId(id));
}

export function modelsByGroup(): Map<ImageModelGroup, ImageModelConfig[]> {
  const map = new Map<ImageModelGroup, ImageModelConfig[]>();
  for (const group of IMAGE_MODEL_GROUPS) {
    map.set(
      group,
      OPENROUTER_IMAGE_MODELS.filter((m) => m.group === group)
    );
  }
  return map;
}
