import { getModelReferenceConfig } from "@/lib/openrouter-models";
import type { MediaType } from "@/types";

// ── Flat fallback constants (used for video + unknown models) ─────────────────

export const MAX_REFERENCES_IMAGE = 4;
export const MAX_REFERENCES_VIDEO = 4;

/** 900 KB per file — conservative fallback */
export const MAX_REFERENCE_FILE_BYTES = 900_000;
/** 2.8 MB combined — conservative fallback */
export const MAX_REFERENCES_TOTAL_BYTES = 2_800_000;

// ── Model-aware helpers ───────────────────────────────────────────────────────

function getModelRefConfig(imageModelId?: string) {
  if (!imageModelId) return null;
  return getModelReferenceConfig(imageModelId);
}

/**
 * Max reference images.
 * - Video: flat cap.
 * - Image: model-specific (0 for non-vision models).
 */
export function maxReferencesForMedia(
  mediaType: MediaType,
  imageModelId?: string
): number {
  if (mediaType === "video") return MAX_REFERENCES_VIDEO;
  return getModelRefConfig(imageModelId)?.maxImages ?? MAX_REFERENCES_IMAGE;
}

export function maxReferenceFileBytesForMedia(
  mediaType: MediaType,
  imageModelId?: string
): number {
  if (mediaType === "video") return MAX_REFERENCE_FILE_BYTES;
  const cfg = getModelRefConfig(imageModelId);
  if (!cfg) return MAX_REFERENCE_FILE_BYTES;
  return cfg.maxFileSizeBytes === 0 ? MAX_REFERENCE_FILE_BYTES : cfg.maxFileSizeBytes;
}

export function maxReferenceTotalBytesForMedia(
  mediaType: MediaType,
  imageModelId?: string
): number {
  if (mediaType === "video") return MAX_REFERENCES_TOTAL_BYTES;
  const cfg = getModelRefConfig(imageModelId);
  if (!cfg || cfg.maxTotalBytes === 0) return MAX_REFERENCES_TOTAL_BYTES;
  return cfg.maxTotalBytes;
}

// ── Slot / budget helpers ─────────────────────────────────────────────────────

export function remainingReferenceSlots(
  currentCount: number,
  mediaType: MediaType,
  imageModelId?: string
): number {
  return Math.max(
    0,
    maxReferencesForMedia(mediaType, imageModelId) - currentCount
  );
}

export function formatReferenceCountLabel(
  current: number,
  mediaType: MediaType,
  imageModelId?: string
): string {
  const max = maxReferencesForMedia(mediaType, imageModelId);
  return `${Math.min(current, max)} / ${max}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function totalReferenceBytes(refs: { sizeBytes?: number }[]): number {
  return refs.reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0);
}

export function planReferenceFileAdds(
  files: File[],
  currentCount: number,
  currentTotalBytes: number,
  mediaType: MediaType,
  imageModelId?: string
): { toAdd: File[]; rejections: string[] } {
  const maxCount = maxReferencesForMedia(mediaType, imageModelId);
  const maxFileBytes = maxReferenceFileBytesForMedia(mediaType, imageModelId);
  const maxTotalBytes = maxReferenceTotalBytesForMedia(mediaType, imageModelId);

  let count = currentCount;
  let total = currentTotalBytes;
  const toAdd: File[] = [];
  const rejections: string[] = [];
  let countLimitWarned = false;

  for (const file of files) {
    if (count >= maxCount) {
      if (!countLimitWarned) {
        rejections.push(
          `Maximum ${maxCount} reference image${maxCount === 1 ? "" : "s"} — remove one to add more.`
        );
        countLimitWarned = true;
      }
      continue;
    }
    if (file.size > maxFileBytes) {
      rejections.push(
        `"${file.name}" is too large (${formatBytes(file.size)}). Max ${formatBytes(maxFileBytes)} per image.`
      );
      continue;
    }
    if (total + file.size > maxTotalBytes) {
      rejections.push(
        `"${file.name}" exceeds the total upload budget (${formatBytes(maxTotalBytes)} for all references combined).`
      );
      continue;
    }
    toAdd.push(file);
    count += 1;
    total += file.size;
  }

  return { toAdd, rejections };
}

export function formatReferenceLimitHint(
  mediaType: MediaType,
  imageModelId?: string
): string {
  const max = maxReferencesForMedia(mediaType, imageModelId);
  const fileBytes = maxReferenceFileBytesForMedia(mediaType, imageModelId);
  const totalBytes = maxReferenceTotalBytesForMedia(mediaType, imageModelId);
  return `Up to ${max} image${max === 1 ? "" : "s"} · ${formatBytes(fileBytes)} each · ${formatBytes(totalBytes)} total`;
}
