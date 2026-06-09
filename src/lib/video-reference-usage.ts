import { MAX_REFERENCES_VIDEO } from "@/lib/reference-limits";
import {
  getVideoModelConfig,
  videoModelRejectsMixedReferenceModes,
} from "@/lib/openrouter-video-models";
import type { ReferenceImagePayload, ReferenceUsageMode } from "@/types";

const MAX_VIDEO_REFERENCES = MAX_REFERENCES_VIDEO;

export function buildVideoReferencePayloads(
  refs: ReferenceImagePayload[],
  modelId: string,
  maxReferences = MAX_VIDEO_REFERENCES
): {
  frameImages: Array<{
    type: "image_url";
    image_url: { url: string };
    frame_type: "first_frame" | "last_frame";
  }>;
  inputReferences: Array<{
    type: "image_url";
    image_url: { url: string };
  }>;
  usedCount: number;
  skippedCount: number;
} {
  const config = getVideoModelConfig(modelId);
  const batch = refs
    .filter((r) => r.dataUrl)
    .slice(0, maxReferences);

  const frameImages: Array<{
    type: "image_url";
    image_url: { url: string };
    frame_type: "first_frame" | "last_frame";
  }> = [];
  const inputReferences: Array<{
    type: "image_url";
    image_url: { url: string };
  }> = [];

  if (batch.length === 0) {
    return { frameImages, inputReferences, usedCount: 0, skippedCount: 0 };
  }

  const usageMode = batch[0]?.usageMode ?? "inspire";
  const supportsFirst = config.supportedFrameImages.includes("first_frame");
  const supportsLast = config.supportedFrameImages.includes("last_frame");
  const supportsRefs = config.supportsInputReferences;

  const pushFrame = (
    url: string,
    frameType: "first_frame" | "last_frame"
  ) => {
    frameImages.push({
      type: "image_url",
      image_url: { url },
      frame_type: frameType,
    });
  };

  const pushStyleRef = (url: string) => {
    inputReferences.push({
      type: "image_url",
      image_url: { url },
    });
  };

  if (usageMode === "preserve") {
    if (supportsFirst && batch[0]?.dataUrl) {
      pushFrame(batch[0].dataUrl, "first_frame");
    }
    if (supportsLast && batch[1]?.dataUrl) {
      pushFrame(batch[1].dataUrl, "last_frame");
    }
    if (supportsRefs) {
      for (let i = 2; i < batch.length; i++) {
        if (batch[i]?.dataUrl) pushStyleRef(batch[i].dataUrl);
      }
    }
  } else {
    if (supportsRefs) {
      for (const ref of batch) {
        if (ref.dataUrl) pushStyleRef(ref.dataUrl);
      }
    } else if (supportsFirst) {
      if (batch[0]?.dataUrl) pushFrame(batch[0].dataUrl, "first_frame");
      if (supportsLast && batch[1]?.dataUrl) {
        pushFrame(batch[1].dataUrl, "last_frame");
      }
    }
  }

  if (
    videoModelRejectsMixedReferenceModes(modelId) &&
    frameImages.length > 0 &&
    inputReferences.length > 0
  ) {
    if (usageMode === "preserve") {
      inputReferences.length = 0;
    } else {
      frameImages.length = 0;
    }
  }

  const usedCount = frameImages.length + inputReferences.length;
  const skippedCount = Math.max(0, batch.length - usedCount);

  return { frameImages, inputReferences, usedCount, skippedCount };
}

/** User-facing summary of how attached images map to the video API */
export function describeVideoReferenceUsage(
  count: number,
  usageMode: ReferenceUsageMode,
  modelId: string
): string {
  const n = Math.min(count, MAX_VIDEO_REFERENCES);
  if (n === 0) return "";

  const config = getVideoModelConfig(modelId);
  const supportsLast = config.supportedFrameImages.includes("last_frame");
  const supportsRefs = config.supportsInputReferences;

  if (usageMode === "preserve") {
    if (n === 1) return "Keyframe mode: image 1 is the opening clip (not consistency)";
    if (supportsLast) {
      return "Keyframe mode: opening & closing clips — switch to Consistency for avatar/location";
    }
    return "Keyframe mode: opening clip only";
  }

  if (supportsRefs) {
    return n === 1
      ? "Consistency ref — character, location, or look"
      : `All ${n} refs for consistency (avatar, location, style)`;
  }

  if (n === 1) return "This model cannot use consistency refs — only opening frame";
  return "Switch to Wan, Seedance, or Grok for consistency references";
}

export function videoReferenceSlotLabel(
  index: number,
  count: number,
  usageMode: ReferenceUsageMode,
  modelId: string
): string | null {
  if (count <= 1) return null;

  const config = getVideoModelConfig(modelId);
  const supportsLast = config.supportedFrameImages.includes("last_frame");
  const supportsRefs = config.supportsInputReferences;

  if (usageMode === "preserve") {
    if (index === 0) return "Open";
    if (index === 1 && supportsLast) return "Close";
    return null;
  }

  if (supportsRefs) return `Ref ${index + 1}`;
  if (index === 0) return "Open";
  if (index === 1 && supportsLast) return "Close";
  return null;
}
