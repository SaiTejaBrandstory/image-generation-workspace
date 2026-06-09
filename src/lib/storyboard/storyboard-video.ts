import { MAX_REFERENCES_VIDEO } from "@/lib/reference-limits";
import {
  clampVideoSettingsToModel,
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_RESOLUTION,
  getVideoModelConfig,
  isStoryboardHumanFrameFallbackModel,
} from "@/lib/openrouter-video-models";
import {
  getSignedImageUrl,
  imageSourceToBuffer,
  uploadGenerationImage,
} from "@/lib/supabase/storage";
import type { ReferenceImagePayload } from "@/types";
import type { StoryboardScene } from "@/types/storyboard";

/** Max frame references per video API call — also used as batch size for long storyboards. */
export const STORYBOARD_VIDEO_BATCH_SIZE = MAX_REFERENCES_VIDEO;

/** Default storyboard video model (accepts human frame refs). */
export const STORYBOARD_VIDEO_MODEL = "google/veo-3.1-lite";

/** Fallback when a non-Veo primary rejects human-looking frames. */
export const STORYBOARD_VIDEO_HUMAN_FALLBACK_MODEL = "google/veo-3.1-lite";

/** Preferred display order for storyboard video aspect ratios. */
const STORYBOARD_VIDEO_ASPECT_ORDER = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "21:9",
  "9:21",
] as const;

/** CSS `aspect-ratio` value for storyboard video layout (e.g. `9 / 16`). */
export function storyboardVideoAspectRatioCss(aspectRatio: string): string {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return "16 / 9";
  return `${w} / ${h}`;
}

/** Aspect ratios a video model accepts (storyboard-friendly order). */
export function storyboardVideoAspectRatiosForModel(modelId: string): string[] {
  const supported = getVideoModelConfig(modelId).supportedAspectRatios;
  const supportedSet = new Set(supported);
  const ordered: string[] = STORYBOARD_VIDEO_ASPECT_ORDER.filter((ratio) =>
    supportedSet.has(ratio)
  );
  for (const ratio of supported) {
    if (!ordered.includes(ratio)) ordered.push(ratio);
  }
  return ordered;
}

export function clampStoryboardVideoAspectRatio(
  modelId: string,
  aspectRatio: string
): string {
  const ratios = storyboardVideoAspectRatiosForModel(modelId);
  const clamped = clampVideoSettingsToModel(modelId, {
    duration: 8,
    resolution: DEFAULT_VIDEO_RESOLUTION,
    aspectRatio,
    generateAudio: true,
  }).aspectRatio;
  if (ratios.includes(clamped)) return clamped;
  return ratios[0] ?? DEFAULT_VIDEO_ASPECT;
}

/** User-selected video aspect, clamped to model; falls back to frame aspect. */
export function resolveStoryboardVideoAspectRatio(
  modelId: string,
  options: { frameAspectRatio?: string; videoAspectRatio?: string }
): string {
  const user = options.videoAspectRatio?.trim();
  const frame = options.frameAspectRatio?.trim();

  if (user) {
    return clampStoryboardVideoAspectRatio(modelId, user);
  }

  if (frame) {
    return clampStoryboardVideoAspectRatio(modelId, frame);
  }

  return clampStoryboardVideoAspectRatio(modelId, DEFAULT_VIDEO_ASPECT);
}

/** No second model when primary is already a Veo human-frame model. */
export function defaultStoryboardVideoFallbackModel(
  primaryModel = STORYBOARD_VIDEO_MODEL
): string | null {
  if (isStoryboardHumanFrameFallbackModel(primaryModel)) return null;
  return STORYBOARD_VIDEO_HUMAN_FALLBACK_MODEL;
}

/** Next.js route maxDuration cap (seconds) — platform max is 300. */
export const STORYBOARD_VIDEO_ROUTE_MAX_DURATION_SEC = 300;

/**
 * Poll window for OpenRouter video jobs (ms).
 * Default `0` = poll until the route maxDuration kills the request (no artificial 4.5 min cap).
 * Set `STORYBOARD_VIDEO_MAX_POLL_MS=270000` on Vercel Hobby (300s routes).
 */
export function getStoryboardFullVideoMaxPollMs(): number {
  const raw = process.env.STORYBOARD_VIDEO_MAX_POLL_MS?.trim();
  if (!raw) return 0;
  if (raw === "0" || raw.toLowerCase() === "unlimited") return 0;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return 0;
}

/** Resolve storyboard video model (server-only env override). */
export function getStoryboardVideoModel(): string {
  return process.env.STORYBOARD_VIDEO_MODEL?.trim() || STORYBOARD_VIDEO_MODEL;
}

/**
 * Two models max when chosen in UI. Env STORYBOARD_VIDEO_MODEL overrides everything.
 */
export function resolveStoryboardVideoModelChain(options?: {
  primaryModel?: string;
  fallbackModel?: string | null;
}): string[] {
  const envOverride = process.env.STORYBOARD_VIDEO_MODEL?.trim();
  if (envOverride) return [envOverride];

  const primary =
    options?.primaryModel?.trim() || STORYBOARD_VIDEO_MODEL;
  const chain = [primary];

  let fallback =
    options?.fallbackModel?.trim() ||
    process.env.STORYBOARD_VIDEO_FALLBACK_MODEL?.trim() ||
    STORYBOARD_VIDEO_HUMAN_FALLBACK_MODEL;

  if (!isStoryboardHumanFrameFallbackModel(fallback)) {
    fallback = STORYBOARD_VIDEO_HUMAN_FALLBACK_MODEL;
  }

  if (fallback && fallback !== primary) {
    chain.push(fallback);
  }
  return chain;
}

/** @deprecated Use resolveStoryboardVideoModelChain */
export function getStoryboardVideoModelChain(): string[] {
  return resolveStoryboardVideoModelChain();
}

export async function imageUrlToDataUrl(url: string): Promise<string> {
  const { buffer, mime } = await imageSourceToBuffer(url);
  const base64 = buffer.toString("base64");
  return `data:${mime};base64,${base64}`;
}

/** Prefer HTTPS URLs for OpenRouter — avoids multi‑MB JSON bodies from base64 frames. */
export async function resolveVideoReferenceSource(url: string): Promise<string> {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return imageUrlToDataUrl(trimmed);
}

/** Resolve a scene frame to an HTTPS URL OpenRouter can fetch (never inline base64 when avoidable). */
export async function resolveSceneFrameHttpUrl(
  scene: StoryboardScene,
  options?: { userId?: string; storageConversationId?: string }
): Promise<string> {
  if (scene.frameStoragePath?.trim()) {
    const signed = await getSignedImageUrl(scene.frameStoragePath.trim());
    if (signed) return signed;
  }

  const url = scene.frameImageUrl?.trim();
  if (!url) {
    throw new Error(`Scene ${scene.sceneNumber} has no frame image.`);
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (
    url.startsWith("data:") &&
    options?.userId &&
    options.storageConversationId
  ) {
    const uploaded = await uploadGenerationImage({
      userId: options.userId,
      conversationId: options.storageConversationId,
      variantId: `video-ref-${scene.id}`,
      imageSource: url,
    });
    return uploaded.signedUrl;
  }

  return resolveVideoReferenceSource(url);
}

export function pickStoryboardVideoDuration(
  requestedSec: number,
  modelId = STORYBOARD_VIDEO_MODEL
): number {
  const clamped = clampVideoSettingsToModel(modelId, {
    duration: requestedSec,
    resolution: DEFAULT_VIDEO_RESOLUTION,
    aspectRatio: DEFAULT_VIDEO_ASPECT,
    generateAudio: true,
  });
  return clamped.duration;
}

function pickStoryboardSceneReferences(
  scenes: StoryboardScene[],
  maxSceneRefs: number
): StoryboardScene[] {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  if (!ordered.length || maxSceneRefs <= 0) return [];

  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const middle = ordered.slice(1, -1);

  const extra: StoryboardScene[] = [];
  if (middle.length === 1) {
    extra.push(middle[0]!);
  } else if (middle.length >= 2) {
    extra.push(middle[0]!, middle[middle.length - 1]!);
  }

  const candidateScenes =
    ordered.length === 1 ? [first] : [first, last, ...extra].slice(0, maxSceneRefs);
  const picked: StoryboardScene[] = [];
  const seen = new Set<string>();
  for (const scene of candidateScenes) {
    if (seen.has(scene.id)) continue;
    seen.add(scene.id);
    picked.push(scene);
  }
  return picked;
}

/**
 * Pack storyboard frames into video API refs (max 4).
 * When `bridgeFrameUrl` is set (segment 2+), it is the opening frame lock from the prior clip.
 */
export async function buildStoryboardSegmentReferences(
  scenes: StoryboardScene[],
  options?: {
    userId?: string;
    storageConversationId?: string;
    bridgeFrameUrl?: string;
    reduced?: boolean;
  }
): Promise<ReferenceImagePayload[]> {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  if (!ordered.length) return [];

  const refs: ReferenceImagePayload[] = [];
  const bridge = options?.bridgeFrameUrl?.trim();
  if (bridge) {
    refs.push({
      role: "product",
      influence: 100,
      dataUrl: await resolveVideoReferenceSource(bridge),
      usageMode: "preserve",
    });
  }

  const maxSceneRefs = Math.max(
    0,
    MAX_REFERENCES_VIDEO - refs.length
  );
  const sceneSlots = options?.reduced
    ? pickStoryboardSceneReferences(ordered, Math.min(2, maxSceneRefs))
    : pickStoryboardSceneReferences(ordered, maxSceneRefs);

  for (const scene of sceneSlots) {
    refs.push({
      role: "product",
      influence: 100,
      dataUrl: await resolveSceneFrameHttpUrl(scene, options),
      usageMode: "preserve",
    });
  }

  return refs;
}

/**
 * Pack all storyboard frames into video API refs (max 4):
 * opening shot, closing shot, plus two evenly-spaced middle frames.
 */
export async function buildStoryboardAllFrameReferences(
  scenes: StoryboardScene[],
  options?: { userId?: string; storageConversationId?: string }
): Promise<ReferenceImagePayload[]> {
  return buildStoryboardSegmentReferences(scenes, options);
}

/** Opening + closing frame only — fewer refs when moderation blocks middle frames. */
export async function buildStoryboardFirstLastReferences(
  scenes: StoryboardScene[],
  options?: {
    userId?: string;
    storageConversationId?: string;
    bridgeFrameUrl?: string;
  }
): Promise<ReferenceImagePayload[]> {
  return buildStoryboardSegmentReferences(scenes, {
    ...options,
    reduced: true,
  });
}

export async function buildStoryboardClipReferences(
  firstFrameUrl: string,
  lastFrameUrl?: string
): Promise<ReferenceImagePayload[]> {
  const refs: ReferenceImagePayload[] = [
    {
      role: "product",
      influence: 100,
      dataUrl: await resolveVideoReferenceSource(firstFrameUrl),
      usageMode: "preserve",
    },
  ];

  if (lastFrameUrl?.trim()) {
    refs.push({
      role: "product",
      influence: 100,
      dataUrl: await resolveVideoReferenceSource(lastFrameUrl),
      usageMode: "preserve",
    });
  }

  return refs;
}

export function pickStoryboardClipDuration(
  sceneDurationSec: number,
  modelId = STORYBOARD_VIDEO_MODEL
): number {
  return pickStoryboardVideoDuration(sceneDurationSec, modelId);
}

/**
 * Pack scenes into video API calls (max 4 frame refs per call).
 * One continuous clip per batch — NOT one video per frame.
 * Examples: 4 scenes → [4]; 6 → [3,3]; 8 → [4,4]; 10 → [4,3,3].
 */
export function chunkStoryboardScenesForVideo(
  scenes: StoryboardScene[]
): StoryboardScene[][] {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const n = ordered.length;
  if (n === 0) return [];
  if (n <= STORYBOARD_VIDEO_BATCH_SIZE) return [ordered];

  const batchCount = Math.ceil(n / STORYBOARD_VIDEO_BATCH_SIZE);
  const baseSize = Math.floor(n / batchCount);
  const remainder = n % batchCount;

  const batches: StoryboardScene[][] = [];
  let offset = 0;
  for (let i = 0; i < batchCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    batches.push(ordered.slice(offset, offset + size));
    offset += size;
  }
  return batches;
}

/** @deprecated Use chunkStoryboardScenesForVideo */
export function chunkStoryboardScenes(
  scenes: StoryboardScene[],
  batchSize = STORYBOARD_VIDEO_BATCH_SIZE
): StoryboardScene[][] {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const batches: StoryboardScene[][] = [];
  for (let i = 0; i < ordered.length; i += batchSize) {
    batches.push(ordered.slice(i, i + batchSize));
  }
  return batches;
}

export function needsStoryboardVideoBatching(scenes: StoryboardScene[]): boolean {
  return chunkStoryboardScenesForVideo(scenes).length > 1;
}

/** Sum scene durations for a batch, clamped to model max (15s for Seedance). */
export function pickStoryboardBatchDuration(
  scenes: StoryboardScene[],
  modelId = STORYBOARD_VIDEO_MODEL
): number {
  const sum = scenes.reduce((acc, scene) => acc + scene.durationSec, 0);
  return pickStoryboardVideoDuration(sum, modelId);
}

/** Total output seconds after per-clip duration clamping for a model. */
export function estimateStoryboardVideoOutputDuration(
  scenes: StoryboardScene[],
  modelId: string
): number {
  const batches = chunkStoryboardScenesForVideo(scenes);
  return batches.reduce(
    (sum, batch) => sum + pickStoryboardBatchDuration(batch, modelId),
    0
  );
}

/** Estimated OpenRouter cost for all clips at a single model (primary path). */
export function estimateStoryboardVideoJobCost(
  scenes: StoryboardScene[],
  modelId: string
): number | null {
  const model = getVideoModelConfig(modelId);
  if (model.costPerSecondUsd == null) return null;

  const batches = chunkStoryboardScenesForVideo(scenes);
  let total = 0;
  for (const batch of batches) {
    const seconds = pickStoryboardBatchDuration(batch, modelId);
    total += seconds * model.costPerSecondUsd;
  }
  return total;
}
