import { estimateStoryboardImageBatchCost } from "@/lib/image-model-pricing";
import {
  clampImageAspectRatioToModel,
  getAspectRatiosForModel,
  getImageModelsCatalog,
  getModelConfig,
  isAspectRatioSupported,
  isValidImageModel,
  sortImageModelsByCost,
  STORYBOARD_EXCLUDED_IMAGE_MODEL_IDS,
  type ImageModelConfig,
  type ImageModelGroup,
} from "@/lib/openrouter-models";
import type { AspectRatio } from "@/types";

/** Default storyboard frame model (anchor-frame continuity on scene 2+). */
export const STORYBOARD_IMAGE_MODEL = "google/gemini-3-pro-image-preview";

export const STORYBOARD_DEFAULT_IMAGE_ASPECT: AspectRatio = "16:9";

const STORYBOARD_INFER_ASPECT_CANDIDATES: AspectRatio[] = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "3:2",
  "2:3",
  "21:9",
];

/** Pick the closest standard aspect ratio from pixel dimensions. */
export function nearestStoryboardAspectRatio(
  width: number,
  height: number
): AspectRatio {
  if (!width || !height) return STORYBOARD_DEFAULT_IMAGE_ASPECT;
  const ratio = width / height;
  let best: AspectRatio = STORYBOARD_DEFAULT_IMAGE_ASPECT;
  let bestDiff = Infinity;
  for (const label of STORYBOARD_INFER_ASPECT_CANDIDATES) {
    const [w, h] = label.split(":").map(Number);
    if (!w || !h) continue;
    const diff = Math.abs(Math.log(ratio / (w / h)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  return best;
}

/** Read aspect ratio from a loaded frame image URL (client only). */
export function inferAspectRatioFromImageUrl(
  url: string
): Promise<AspectRatio | null> {
  if (typeof window === "undefined" || !url.trim()) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(
        nearestStoryboardAspectRatio(img.naturalWidth, img.naturalHeight)
      );
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** CSS `aspect-ratio` value for storyboard frame layout (e.g. `9 / 16`). */
export function storyboardAspectRatioCss(aspectRatio: AspectRatio): string {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return "16 / 9";
  return `${w} / ${h}`;
}

const STORYBOARD_ASPECT_ORDER: AspectRatio[] = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "3:2",
  "2:3",
  "21:9",
  "1:4",
  "4:1",
  "1:8",
  "8:1",
];

/** Supported aspect ratios for a model (excludes auto), storyboard-friendly order. */
export function storyboardAspectRatiosForModel(modelId: string): AspectRatio[] {
  const supported = new Set(getAspectRatiosForModel(modelId));
  return STORYBOARD_ASPECT_ORDER.filter(
    (ratio) => ratio !== "auto" && supported.has(ratio)
  );
}

export function clampStoryboardImageAspectRatio(
  modelId: string,
  aspectRatio: AspectRatio
): AspectRatio {
  const ratios = storyboardAspectRatiosForModel(modelId);
  const clamped = clampImageAspectRatioToModel(modelId, aspectRatio);
  if (ratios.includes(clamped)) return clamped;
  return ratios[0] ?? STORYBOARD_DEFAULT_IMAGE_ASPECT;
}

/** Frame aspect for video: persisted settings → store → infer from first frame. */
export function resolveStoryboardFrameAspectRatio(options: {
  settingsAspect?: AspectRatio;
  storeAspect?: AspectRatio;
  inferredFromFrames?: AspectRatio | null;
}): AspectRatio {
  if (options.inferredFromFrames) return options.inferredFromFrames;
  if (options.settingsAspect) return options.settingsAspect;
  if (options.storeAspect) return options.storeAspect;
  return STORYBOARD_DEFAULT_IMAGE_ASPECT;
}

export function isStoryboardImageAspectSupported(
  modelId: string,
  aspectRatio: AspectRatio
): boolean {
  return isAspectRatioSupported(modelId, aspectRatio);
}

/** Multimodal families that accept anchor-frame refs for storyboard continuity. */
const STORYBOARD_REFERENCE_FRAME_GROUPS = new Set<ImageModelGroup>([
  "Google",
  "xAI",
  "OpenAI",
]);

/**
 * Image models that can attach scene-1 anchor frames for multi-shot continuity.
 * Excludes text-to-image-only families (Flux, Recraft, Riverflow, Seedream).
 */
export function storyboardReferenceFrameImageModels(
  models: ImageModelConfig[]
): ImageModelConfig[] {
  return models.filter(
    (m) =>
      !STORYBOARD_EXCLUDED_IMAGE_MODEL_IDS.has(m.id) &&
      STORYBOARD_REFERENCE_FRAME_GROUPS.has(m.group) &&
      m.supportsVisionInput &&
      m.maxReferenceImages > 0 &&
      isAspectRatioSupported(m.id, "16:9")
  );
}

export function isStoryboardReferenceFrameImageModel(modelId: string): boolean {
  if (!isValidImageModel(modelId)) return false;
  const config = getModelConfig(modelId);
  return storyboardReferenceFrameImageModels([config]).length === 1;
}

export function resolveStoryboardImageModel(requested?: string): string {
  const trimmed = requested?.trim();
  if (trimmed && isStoryboardReferenceFrameImageModel(trimmed)) {
    return trimmed;
  }
  return process.env.STORYBOARD_IMAGE_MODEL?.trim() || STORYBOARD_IMAGE_MODEL;
}

export function sortStoryboardImageModels(
  models: ImageModelConfig[]
): ImageModelConfig[] {
  return sortImageModelsByCost(models);
}

export function estimateStoryboardImageJobCost(
  frameCount: number,
  modelId: string
): number | null {
  const model = getModelConfig(modelId);
  return estimateStoryboardImageBatchCost(frameCount, model.costPerImageUsd);
}

export function getStoryboardImageModels(): ImageModelConfig[] {
  return sortStoryboardImageModels(
    storyboardReferenceFrameImageModels(getImageModelsCatalog())
  );
}

/** @deprecated Use storyboardReferenceFrameImageModels */
export function storyboardCapableImageModels(
  models: ImageModelConfig[]
): ImageModelConfig[] {
  return storyboardReferenceFrameImageModels(models);
}
