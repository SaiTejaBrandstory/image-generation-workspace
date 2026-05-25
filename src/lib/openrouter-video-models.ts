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
}

const RESOLUTION_ORDER = ["480p", "720p", "1080p", "1K", "2K", "4K"];

function sortResolutions(res: string[]): string[] {
  return [...res].sort(
    (a, b) =>
      (RESOLUTION_ORDER.indexOf(a) === -1 ? 99 : RESOLUTION_ORDER.indexOf(a)) -
      (RESOLUTION_ORDER.indexOf(b) === -1 ? 99 : RESOLUTION_ORDER.indexOf(b))
  );
}

function sortDurations(dur: number[]): number[] {
  return [...dur].sort((a, b) => a - b);
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
  };
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
  const duration = config.supportedDurations.includes(settings.duration)
    ? settings.duration
    : config.supportedDurations.includes(DEFAULT_VIDEO_DURATION)
      ? DEFAULT_VIDEO_DURATION
      : config.supportedDurations[0];

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
