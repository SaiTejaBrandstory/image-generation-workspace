import type { MediaType } from "@/types";

/** Max reference images per generation request */
export const MAX_REFERENCES_IMAGE = 4;
export const MAX_REFERENCES_VIDEO = 4;

/** Per file (raw bytes); base64 in JSON adds ~33% */
export const MAX_REFERENCE_FILE_BYTES = 900_000;

/** Combined size of all attached references (avoids Request Entity Too Large) */
export const MAX_REFERENCES_TOTAL_BYTES = 2_800_000;

export function maxReferencesForMedia(mediaType: MediaType): number {
  return mediaType === "video" ? MAX_REFERENCES_VIDEO : MAX_REFERENCES_IMAGE;
}

export function remainingReferenceSlots(
  currentCount: number,
  mediaType: MediaType
): number {
  return Math.max(0, maxReferencesForMedia(mediaType) - currentCount);
}

export function formatReferenceCountLabel(
  current: number,
  mediaType: MediaType
): string {
  const max = maxReferencesForMedia(mediaType);
  return `${Math.min(current, max)} / ${max}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function totalReferenceBytes(
  refs: { sizeBytes?: number }[]
): number {
  return refs.reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0);
}

export function planReferenceFileAdds(
  files: File[],
  currentCount: number,
  currentTotalBytes: number,
  mediaType: MediaType
): { toAdd: File[]; rejections: string[] } {
  const max = maxReferencesForMedia(mediaType);
  let count = currentCount;
  let total = currentTotalBytes;
  const toAdd: File[] = [];
  const rejections: string[] = [];
  let countLimitWarned = false;

  for (const file of files) {
    if (count >= max) {
      if (!countLimitWarned) {
        rejections.push(
          `Maximum ${max} reference images — remove one to add more.`
        );
        countLimitWarned = true;
      }
      continue;
    }
    if (file.size > MAX_REFERENCE_FILE_BYTES) {
      rejections.push(
        `"${file.name}" is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_REFERENCE_FILE_BYTES)} per image.`
      );
      continue;
    }
    if (total + file.size > MAX_REFERENCES_TOTAL_BYTES) {
      rejections.push(
        `"${file.name}" exceeds the total upload budget (${formatBytes(MAX_REFERENCES_TOTAL_BYTES)} for all references combined).`
      );
      continue;
    }
    toAdd.push(file);
    count += 1;
    total += file.size;
  }

  return { toAdd, rejections };
}

export function formatReferenceLimitHint(mediaType: MediaType): string {
  const max = maxReferencesForMedia(mediaType);
  return `Up to ${max} images · ${formatBytes(MAX_REFERENCE_FILE_BYTES)} each · ${formatBytes(MAX_REFERENCES_TOTAL_BYTES)} total`;
}
