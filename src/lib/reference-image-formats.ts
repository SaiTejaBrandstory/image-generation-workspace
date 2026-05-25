import type { MediaType } from "@/types";

/** OpenRouter video frame/reference APIs (provider error: JPEG or PNG only) */
const VIDEO_MIMES = new Set(["image/jpeg", "image/jpg", "image/png"]);

/** OpenRouter chat image inputs */
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const VIDEO_EXT = /\.(jpe?g|png)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

export const REFERENCE_ACCEPT_VIDEO =
  "image/jpeg,image/png,.jpg,.jpeg,.png";
export const REFERENCE_ACCEPT_IMAGE =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function referenceImageAcceptAttr(mediaType: MediaType): string {
  return mediaType === "video" ? REFERENCE_ACCEPT_VIDEO : REFERENCE_ACCEPT_IMAGE;
}

export function referenceFormatHint(mediaType: MediaType): string {
  return mediaType === "video"
    ? "JPEG or PNG · min 240×240 per side"
    : "JPEG, PNG, or WebP";
}

function mimeFromFile(file: File): string {
  const t = file.type?.toLowerCase().trim();
  if (t) return t;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

export function isSupportedReferenceImageFile(
  file: File,
  mediaType: MediaType
): boolean {
  const mime = mimeFromFile(file);
  if (mediaType === "video") {
    if (VIDEO_MIMES.has(mime)) return true;
    return VIDEO_EXT.test(file.name);
  }
  if (IMAGE_MIMES.has(mime)) return true;
  return IMAGE_EXT.test(file.name);
}

export function partitionReferenceImageFiles(
  files: File[],
  mediaType: MediaType
): { accepted: File[]; rejected: File[] } {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (isSupportedReferenceImageFile(file, mediaType)) {
      accepted.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { accepted, rejected };
}

export function formatReferenceRejectionMessage(
  rejected: File[],
  mediaType: MediaType
): string {
  const hint = referenceFormatHint(mediaType);
  if (rejected.length === 1) {
    return `"${rejected[0].name}" is not supported. Use ${hint}.`;
  }
  const names = rejected
    .slice(0, 3)
    .map((f) => f.name)
    .join(", ");
  const more =
    rejected.length > 3 ? ` and ${rejected.length - 3} more` : "";
  return `${rejected.length} files skipped (${names}${more}). Use ${hint}.`;
}

/** Validate serialized data URLs before video API (JPEG/PNG only). */
export function validateVideoReferencePayloads(
  references: { dataUrl?: string }[] | undefined
): void {
  for (const ref of references ?? []) {
    if (ref.dataUrl) assertVideoReferenceDataUrl(ref.dataUrl);
  }
}

export function assertVideoReferenceDataUrl(dataUrl: string): void {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  const mime = match?.[1]?.toLowerCase() ?? "";
  if (!VIDEO_MIMES.has(mime)) {
    throw new Error(
      "Unsupported image format. Reference images for video must be JPEG or PNG."
    );
  }
}
