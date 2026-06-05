import {
  clampVideoSettingsToModel,
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/openrouter-video-models";
import { imageSourceToBuffer } from "@/lib/supabase/storage";
import type { ReferenceImagePayload } from "@/types";
import type { StoryboardScene } from "@/types/storyboard";

/** Supports first/last frame + refs, up to 15s, 16:9. */
export const STORYBOARD_VIDEO_MODEL = "bytedance/seedance-2.0";

/** Per-clip generation — shorter jobs, fits 300s route limit. */
export const STORYBOARD_CLIP_MAX_POLL_MS = 270_000;

/** Full storyboard video (4 frame refs + long prompt) — Seedance often needs 6–15 min. */
export const STORYBOARD_FULL_VIDEO_MAX_POLL_MS = 900_000;

/**
 * Poll window for full storyboard video. Env override:
 * - `STORYBOARD_VIDEO_MAX_POLL_MS=900000` — 15 minutes (default)
 * - `STORYBOARD_VIDEO_MAX_POLL_MS=unlimited` or `0` — no poll cap (route maxDuration still applies)
 */
export function getStoryboardFullVideoMaxPollMs(): number {
  const raw = process.env.STORYBOARD_VIDEO_MAX_POLL_MS?.trim();
  if (!raw) return STORYBOARD_FULL_VIDEO_MAX_POLL_MS;
  if (raw === "0" || raw.toLowerCase() === "unlimited") return 0;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return STORYBOARD_FULL_VIDEO_MAX_POLL_MS;
}

export async function imageUrlToDataUrl(url: string): Promise<string> {
  const { buffer, mime } = await imageSourceToBuffer(url);
  const base64 = buffer.toString("base64");
  return `data:${mime};base64,${base64}`;
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

/**
 * Pack all storyboard frames into video API refs (max 4):
 * opening shot, closing shot, plus two evenly-spaced middle frames.
 */
export async function buildStoryboardAllFrameReferences(
  scenes: StoryboardScene[]
): Promise<ReferenceImagePayload[]> {
  const ordered = [...scenes]
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((s) => s.frameImageUrl?.trim())
    .filter((url): url is string => Boolean(url));

  if (!ordered.length) return [];

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const middle = ordered.slice(1, -1);

  const extra: string[] = [];
  if (middle.length === 1) {
    extra.push(middle[0]);
  } else if (middle.length >= 2) {
    extra.push(middle[0], middle[middle.length - 1]);
  }

  const urls = [first, last, ...extra].slice(0, 4);
  const refs: ReferenceImagePayload[] = [];

  for (const url of urls) {
    refs.push({
      role: "product",
      influence: 100,
      dataUrl: await imageUrlToDataUrl(url),
      usageMode: "preserve",
    });
  }

  return refs;
}

export async function buildStoryboardClipReferences(
  firstFrameUrl: string,
  lastFrameUrl?: string
): Promise<ReferenceImagePayload[]> {
  const refs: ReferenceImagePayload[] = [
    {
      role: "product",
      influence: 100,
      dataUrl: await imageUrlToDataUrl(firstFrameUrl),
      usageMode: "preserve",
    },
  ];

  if (lastFrameUrl?.trim()) {
    refs.push({
      role: "product",
      influence: 100,
      dataUrl: await imageUrlToDataUrl(lastFrameUrl),
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
