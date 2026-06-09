import {
  isLowCostVideoModel,
  parseStoryboardVideoPricing,
} from "@/lib/video-model-pricing";

/**
 * Video model catalog aligned with OpenRouter GET /api/v1/videos/models
 * https://openrouter.ai/docs/features/multimodal/video-generation
 */

export type VideoModelGroup =
  | "Google"
  | "xAI"
  | "Kling"
  | "Alibaba"
  | "ByteDance"
  | "OpenAI"
  | "MiniMax";

export type VideoFrameType = "first_frame" | "last_frame";

/** OpenRouter-supported resolution labels (per model) */
export type VideoResolution = string;

/** OpenRouter-supported aspect ratio labels (per model) */
export type VideoAspectRatio = string;

export interface OpenRouterVideoModelApiRow {
  id: string;
  name: string;
  description?: string;
  supported_resolutions?: string[];
  supported_aspect_ratios?: string[];
  supported_durations?: number[];
  supported_frame_images?: VideoFrameType[] | null;
  generate_audio?: boolean | null;
  pricing_skus?: Record<string, string>;
}

export interface VideoModelConfig {
  id: string;
  label: string;
  group: VideoModelGroup;
  description: string;
  supportedResolutions: string[];
  supportedAspectRatios: string[];
  supportedDurations: number[];
  supportedFrameImages: VideoFrameType[];
  /** Reference images for style/content (input_references) */
  supportsInputReferences: boolean;
  /** null = provider default; false = no audio; true = toggle shown */
  generateAudio: boolean | null;
  pricingSkus?: Record<string, string>;
  /** USD per second for storyboard settings (720p, frame refs, audio on). */
  costPerSecondUsd: number | null;
  costLabel: string;
  pricingDetail: string;
  isPricingEstimate: boolean;
}

const RESOLUTION_ORDER = ["480p", "720p", "1080p", "1K", "2K", "4K"];

function sortResolutions(res: string[]): string[] {
  return [...res].sort(
    (a, b) =>
      (RESOLUTION_ORDER.indexOf(a) === -1 ? 99 : RESOLUTION_ORDER.indexOf(a)) -
      (RESOLUTION_ORDER.indexOf(b) === -1 ? 99 : RESOLUTION_ORDER.indexOf(b))
  );
}

export function sortDurations(dur: number[]): number[] {
  return [...dur].sort((a, b) => a - b);
}

/** Pick closest allowed duration, capped at the model maximum (e.g. 28s → 15s on Seedance). */
export function pickNearestSupportedDuration(
  requestedSec: number,
  modelId: string
): number {
  const supported = sortDurations(
    getVideoModelConfig(modelId).supportedDurations
  );
  if (!supported.length) {
    return Math.max(1, Math.round(requestedSec));
  }

  const min = supported[0]!;
  const max = supported[supported.length - 1]!;
  const target = Math.min(Math.max(requestedSec, min), max);

  let floor = min;
  for (const d of supported) {
    if (d <= target) floor = d;
    else break;
  }
  if (floor >= target) return floor;

  for (const d of supported) {
    if (d >= target) return d;
  }
  return max;
}

/** Longest clip duration the model allows (seconds). */
export function getVideoModelMaxDurationSec(modelId: string): number | null {
  const supported = sortDurations(
    getVideoModelConfig(modelId).supportedDurations
  );
  return supported.length ? supported[supported.length - 1]! : null;
}

/** Model display name with max clip length, e.g. "Seedance 2.0 Fast · max 15s". */
export function formatStoryboardVideoModelLabel(
  modelId: string,
  options?: { perClip?: boolean }
): string {
  const label = getVideoModelConfig(modelId).label;
  const max = getVideoModelMaxDurationSec(modelId);
  if (max == null) return label;
  const unit = options?.perClip ? `${max}s/clip` : `${max}s`;
  return `${label} · max ${unit}`;
}

function inferGroup(id: string): VideoModelGroup {
  if (id.startsWith("google/")) return "Google";
  if (id.startsWith("x-ai/")) return "xAI";
  if (id.startsWith("kwaivgi/")) return "Kling";
  if (id.startsWith("alibaba/")) return "Alibaba";
  if (id.startsWith("bytedance/")) return "ByteDance";
  if (id.startsWith("openai/")) return "OpenAI";
  if (id.startsWith("minimax/")) return "MiniMax";
  return "Google";
}

function inferInputReferences(id: string, description?: string): boolean {
  const d = (description ?? "").toLowerCase();
  if (d.includes("reference")) return true;
  return (
    id.includes("wan-") ||
    id.includes("seedance") ||
    id.includes("grok-imagine")
  );
}

function labelFromApiName(name: string, id: string): string {
  const stripped = name.replace(/^[^:]+:\s*/, "").trim();
  return stripped || id.split("/").pop() || id;
}

export function normalizeOpenRouterVideoModel(
  row: OpenRouterVideoModelApiRow
): VideoModelConfig {
  const frames = row.supported_frame_images ?? [];
  const pricing = parseStoryboardVideoPricing(row.pricing_skus);
  return {
    id: row.id,
    label: labelFromApiName(row.name, row.id),
    group: inferGroup(row.id),
    description: row.description?.slice(0, 120) ?? "",
    supportedResolutions: sortResolutions(row.supported_resolutions ?? ["720p"]),
    supportedAspectRatios: row.supported_aspect_ratios ?? ["16:9"],
    supportedDurations: sortDurations(row.supported_durations ?? [5]),
    supportedFrameImages: frames,
    supportsInputReferences: inferInputReferences(row.id, row.description),
    generateAudio: row.generate_audio ?? null,
    pricingSkus: row.pricing_skus,
    costPerSecondUsd: pricing.costPerSecondUsd,
    costLabel: pricing.label,
    pricingDetail: pricing.detail,
    isPricingEstimate: pricing.isEstimate,
  };
}

/** Storyboard defaults — shown as quick picks in the video model dialog. */
export const STORYBOARD_RECOMMENDED_VIDEO_MODELS = [
  "google/veo-3.1-lite",
  "google/veo-3.1-fast",
  "bytedance/seedance-2.0-fast",
  "alibaba/wan-2.7",
] as const;

/** Models that accept storyboard frames via OpenRouter `frame_images` (image-to-video). */
export function storyboardCapableVideoModels(
  models: VideoModelConfig[]
): VideoModelConfig[] {
  return models.filter((m) => m.supportedFrameImages.includes("first_frame"));
}

/**
 * Google Veo models that accept photorealistic human frame refs when Seedance
 * rejects (SensitiveContent / real-person). Do not use Seedance/Kling/Wan here.
 */
export const STORYBOARD_HUMAN_FRAME_FALLBACK_MODEL_IDS = [
  "google/veo-3.1-lite",
  "google/veo-3.1-fast",
  "google/veo-3.1",
] as const;

export function isStoryboardHumanFrameFallbackModel(modelId: string): boolean {
  return (
    STORYBOARD_HUMAN_FRAME_FALLBACK_MODEL_IDS as readonly string[]
  ).includes(modelId);
}

export function storyboardHumanFrameFallbackModels(
  models: VideoModelConfig[]
): VideoModelConfig[] {
  const allowed = new Set<string>(STORYBOARD_HUMAN_FRAME_FALLBACK_MODEL_IDS);
  return sortVideoModelsByCost(
    models.filter(
      (m) =>
        allowed.has(m.id) && m.supportedFrameImages.includes("first_frame")
    )
  );
}

/** Pick a valid human-frame fallback, or null if primary is the only Veo left. */
export function pickStoryboardHumanFrameFallback(
  primaryId: string,
  models: VideoModelConfig[],
  preferred?: string | null
): string | null {
  const options = storyboardHumanFrameFallbackModels(models).filter(
    (m) => m.id !== primaryId
  );
  if (!options.length) return null;

  if (
    preferred &&
    preferred !== primaryId &&
    options.some((m) => m.id === preferred)
  ) {
    return preferred;
  }

  const defaultId = "google/veo-3.1-lite";
  return options.find((m) => m.id === defaultId)?.id ?? options[0]!.id;
}

export function sortVideoModelsByCost(
  models: VideoModelConfig[]
): VideoModelConfig[] {
  return [...models].sort((a, b) => {
    const ac = a.costPerSecondUsd ?? Number.POSITIVE_INFINITY;
    const bc = b.costPerSecondUsd ?? Number.POSITIVE_INFINITY;
    if (ac !== bc) return ac - bc;
    return a.label.localeCompare(b.label);
  });
}

export function videoModelShowsLowCostBadge(
  model: VideoModelConfig,
  models: VideoModelConfig[]
): boolean {
  const costs = models
    .map((m) => m.costPerSecondUsd)
    .filter((c): c is number => c != null);
  return isLowCostVideoModel(model.costPerSecondUsd, costs);
}

/** Static snapshot from OpenRouter videos/models (fallback if API unavailable) */
export const OPENROUTER_VIDEO_MODELS: VideoModelConfig[] = [
  normalizeOpenRouterVideoModel({
    id: "google/veo-3.1",
    name: "Google: Veo 3.1",
    description: "Flagship Veo · 720p/1080p/4K · native audio",
    supported_resolutions: ["720p", "1080p", "4K"],
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_durations: [4, 6, 8],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      duration_seconds_with_audio: "0.40",
      duration_seconds_without_audio: "0.20",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "google/veo-3.1-fast",
    name: "Google: Veo 3.1 Fast",
    description: "Faster Veo · 720p/1080p/4K",
    supported_resolutions: ["720p", "1080p", "4K"],
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_durations: [4, 6, 8],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      duration_seconds_with_audio_720p: "0.10",
      duration_seconds_without_audio_720p: "0.08",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "google/veo-3.1-lite",
    name: "Google: Veo 3.1 Lite",
    description: "Cost-effective Veo · 720p/1080p",
    supported_resolutions: ["720p", "1080p"],
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_durations: [4, 6, 8],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      duration_seconds_with_audio_720p: "0.05",
      duration_seconds_without_audio_720p: "0.03",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "openai/sora-2-pro",
    name: "OpenAI: Sora 2 Pro",
    description: "Production Sora · 4–20s · text-to-video",
    supported_resolutions: ["720p", "1080p"],
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_durations: [4, 8, 12, 16, 20],
    supported_frame_images: null,
    generate_audio: true,
    pricing_skus: { duration_seconds_720p: "0.30" },
  }),
  normalizeOpenRouterVideoModel({
    id: "x-ai/grok-imagine-video",
    name: "xAI: Grok Imagine Video",
    description: "Fast · 1–15s · 480p/720p · 7 aspect ratios",
    supported_resolutions: ["480p", "720p"],
    supported_aspect_ratios: [
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4",
      "3:2",
      "2:3",
    ],
    supported_durations: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ],
    supported_frame_images: ["first_frame"],
    generate_audio: null,
    pricing_skus: {
      cents_per_video_output_second_720p: "7",
      cents_per_video_output_second_480p: "5",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "alibaba/wan-2.7",
    name: "Alibaba: Wan 2.7",
    description: "Text/image/reference · 2–10s",
    supported_resolutions: ["720p", "1080p"],
    supported_aspect_ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    supported_durations: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: { duration_seconds: "0.1" },
  }),
  normalizeOpenRouterVideoModel({
    id: "alibaba/wan-2.6",
    name: "Alibaba: Wan 2.6",
    description: "Advanced Wan · 5s or 10s",
    supported_resolutions: ["720p", "1080p"],
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_durations: [5, 10],
    supported_frame_images: ["first_frame"],
    generate_audio: true,
    pricing_skus: {
      image_to_video_duration_seconds_720p: "0.10",
      text_to_video_duration_seconds_720p: "0.08",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "bytedance/seedance-2.0",
    name: "ByteDance: Seedance 2.0",
    description: "Character consistency · 4–15s",
    supported_resolutions: ["480p", "720p", "1080p"],
    supported_aspect_ratios: [
      "1:1",
      "3:4",
      "9:16",
      "4:3",
      "16:9",
      "21:9",
      "9:21",
    ],
    supported_durations: [
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      video_tokens: "0.000007",
      video_tokens_without_audio: "0.000007",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "bytedance/seedance-2.0-fast",
    name: "ByteDance: Seedance 2.0 Fast",
    description: "Faster Seedance · 480p/720p",
    supported_resolutions: ["480p", "720p"],
    supported_aspect_ratios: [
      "1:1",
      "3:4",
      "9:16",
      "4:3",
      "16:9",
      "21:9",
      "9:21",
    ],
    supported_durations: [
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      video_tokens: "0.0000056",
      video_tokens_without_audio: "0.0000056",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "bytedance/seedance-1-5-pro",
    name: "ByteDance: Seedance 1.5 Pro",
    description: "Audio-visual · 4–12s",
    supported_resolutions: ["480p", "720p", "1080p"],
    supported_aspect_ratios: [
      "1:1",
      "3:4",
      "9:16",
      "9:21",
      "4:3",
      "16:9",
      "21:9",
    ],
    supported_durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      video_tokens: "0.0000024",
      video_tokens_without_audio: "0.0000012",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "kwaivgi/kling-v3.0-pro",
    name: "Kling: Video v3.0 Pro",
    description: "Premium Kling · 3–15s · first/last frame",
    supported_resolutions: ["720p"],
    supported_aspect_ratios: ["16:9", "9:16", "1:1"],
    supported_durations: [
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      duration_seconds_with_audio: "0.168",
      image_to_video_duration_seconds_720p: "0.112",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "kwaivgi/kling-v3.0-std",
    name: "Kling: Video v3.0 Standard",
    description: "Standard Kling · 3–15s",
    supported_resolutions: ["720p"],
    supported_aspect_ratios: ["16:9", "9:16", "1:1"],
    supported_durations: [
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: {
      duration_seconds_with_audio: "0.126",
      image_to_video_duration_seconds_720p: "0.084",
    },
  }),
  normalizeOpenRouterVideoModel({
    id: "kwaivgi/kling-video-o1",
    name: "Kling: Video O1",
    description: "Kling O1 · 5s or 10s",
    supported_resolutions: ["720p"],
    supported_aspect_ratios: ["16:9", "9:16", "1:1"],
    supported_durations: [5, 10],
    supported_frame_images: ["first_frame", "last_frame"],
    generate_audio: true,
    pricing_skus: { duration_seconds: "0.1120" },
  }),
  normalizeOpenRouterVideoModel({
    id: "minimax/hailuo-2.3",
    name: "MiniMax: Hailuo 2.3",
    description: "1080p · 16:9 only · 6s or 10s",
    supported_resolutions: ["1080p"],
    supported_aspect_ratios: ["16:9"],
    supported_durations: [6, 10],
    supported_frame_images: ["first_frame"],
    generate_audio: false,
    pricing_skus: { duration_seconds: "0.0817" },
  }),
];

export const VIDEO_MODEL_GROUPS: VideoModelGroup[] = [
  "Google",
  "OpenAI",
  "xAI",
  "Alibaba",
  "ByteDance",
  "Kling",
  "MiniMax",
];

/** Default for reference-to-video (avatar, location, style consistency) */
export const DEFAULT_VIDEO_MODEL = "alibaba/wan-2.7";

/** Models that send references as input_references (not opening/closing keyframes) */
export const VIDEO_CONSISTENCY_MODEL_IDS = [
  "alibaba/wan-2.7",
  "alibaba/wan-2.6",
  "bytedance/seedance-2.0",
  "bytedance/seedance-2.0-fast",
  "bytedance/seedance-1-5-pro",
  "x-ai/grok-imagine-video",
] as const;

export function videoModelSupportsConsistencyRefs(modelId: string): boolean {
  return getVideoModelConfig(modelId).supportsInputReferences;
}
export const DEFAULT_VIDEO_DURATION = 8;
export const DEFAULT_VIDEO_RESOLUTION = "720p";
export const DEFAULT_VIDEO_ASPECT = "16:9";

let catalogMap = new Map(
  OPENROUTER_VIDEO_MODELS.map((m) => [m.id, m] as const)
);

export function setVideoModelsCatalog(models: VideoModelConfig[]): void {
  catalogMap = new Map(models.map((m) => [m.id, m]));
}

export function getVideoModelsCatalog(): VideoModelConfig[] {
  return Array.from(catalogMap.values());
}

export function getVideoModelConfig(modelId: string): VideoModelConfig {
  return (
    catalogMap.get(modelId) ??
    catalogMap.get(DEFAULT_VIDEO_MODEL) ??
    OPENROUTER_VIDEO_MODELS[0]
  );
}

export function isValidVideoModel(id: string): boolean {
  return catalogMap.has(id);
}

export function videoModelsByGroup(): Map<VideoModelGroup, VideoModelConfig[]> {
  const map = new Map<VideoModelGroup, VideoModelConfig[]>();
  for (const group of VIDEO_MODEL_GROUPS) {
    map.set(
      group,
      getVideoModelsCatalog().filter((m) => m.group === group)
    );
  }
  return map;
}

/** Clamp user settings to what the selected model allows */
export function clampVideoSettingsToModel(
  modelId: string,
  settings: {
    duration: number;
    resolution: string;
    aspectRatio: string;
    generateAudio: boolean;
  }
): {
  duration: number;
  resolution: string;
  aspectRatio: string;
  generateAudio: boolean;
} {
  const config = getVideoModelConfig(modelId);
  const duration = pickNearestSupportedDuration(settings.duration, modelId);

  const resolution = config.supportedResolutions.includes(settings.resolution)
    ? settings.resolution
    : config.supportedResolutions.includes(DEFAULT_VIDEO_RESOLUTION)
      ? DEFAULT_VIDEO_RESOLUTION
      : config.supportedResolutions[0];

  const aspectRatio = config.supportedAspectRatios.includes(
    settings.aspectRatio
  )
    ? settings.aspectRatio
    : config.supportedAspectRatios.includes(DEFAULT_VIDEO_ASPECT)
      ? DEFAULT_VIDEO_ASPECT
      : config.supportedAspectRatios[0];

  const generateAudio =
    config.generateAudio === false
      ? false
      : config.generateAudio === true
        ? settings.generateAudio
        : settings.generateAudio;

  return { duration, resolution, aspectRatio, generateAudio };
}

export function supportsFrameImages(modelId: string): boolean {
  return getVideoModelConfig(modelId).supportedFrameImages.includes(
    "first_frame"
  );
}

export function supportsInputReferences(modelId: string): boolean {
  return getVideoModelConfig(modelId).supportsInputReferences;
}

export function videoModelAcceptsReferences(modelId: string): boolean {
  const config = getVideoModelConfig(modelId);
  return (
    config.supportedFrameImages.length > 0 || config.supportsInputReferences
  );
}

export async function fetchVideoModelsFromOpenRouter(
  apiKey?: string
): Promise<VideoModelConfig[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const res = await fetch("https://openrouter.ai/api/v1/videos/models", {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`OpenRouter video models API returned ${res.status}`);
  }

  const json = (await res.json()) as { data?: OpenRouterVideoModelApiRow[] };
  const rows = json.data ?? [];
  if (rows.length === 0) {
    return OPENROUTER_VIDEO_MODELS;
  }

  return rows.map(normalizeOpenRouterVideoModel);
}
