import {
  formatReferenceLimitHint,
  formatBytes,
  maxReferenceFileBytesForMedia,
  maxReferenceTotalBytesForMedia,
  MAX_REFERENCES_IMAGE,
  planReferenceFileAdds,
} from "@/lib/reference-limits";
import {
  formatReferenceRejectionMessage,
  isSupportedReferenceImageFile,
  partitionReferenceImageFiles,
  REFERENCE_ACCEPT_IMAGE,
  referenceFormatHint,
} from "@/lib/reference-image-formats";
import {
  ensureFileMinDimensions,
  MIN_VIDEO_REFERENCE_DIMENSION,
} from "@/lib/reference-image-dimensions";
import type { StoryboardInputReference } from "@/types/storyboard";

/** Minimum width and height for storyboard reference uploads. */
export const STORYBOARD_INPUT_REFERENCE_MIN_DIMENSION =
  MIN_VIDEO_REFERENCE_DIMENSION;

export const STORYBOARD_INPUT_REFERENCE_ACCEPT = REFERENCE_ACCEPT_IMAGE;

export function storyboardInputReferenceLimitHint(): string {
  return `${referenceFormatHint("image")} · small images upscale automatically · ${formatReferenceLimitHint("image")}`;
}

export {
  maxReferenceFileBytesForMedia,
  maxReferenceTotalBytesForMedia,
  planReferenceFileAdds,
};

export const STORYBOARD_INPUT_REFERENCE_KINDS = [
  "character",
  "product",
  "environment",
] as const;

export const STORYBOARD_MAX_INPUT_REFERENCES = MAX_REFERENCES_IMAGE;
export const STORYBOARD_INPUT_REFERENCE_LABEL_MAX = 80;

export function sanitizeStoryboardInputReferenceLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, STORYBOARD_INPUT_REFERENCE_LABEL_MAX);
}

export function storyboardInputReferenceLabelPlaceholder(
  kind: StoryboardInputReference["kind"]
): string {
  switch (kind) {
    case "character":
      return "Label — e.g. Ravi, mother, hero";
    case "product":
      return "Label — e.g. Tea box, brand logo";
    case "environment":
      return "Label — e.g. Family kitchen, storefront";
  }
}

const KIND_LABELS: Record<StoryboardInputReference["kind"], string> = {
  character: "Character",
  product: "Product",
  environment: "Environment / scene",
};

export function storyboardInputReferenceKindLabel(
  kind: StoryboardInputReference["kind"]
): string {
  return KIND_LABELS[kind];
}

export function storyboardInputReferencesForKind(
  refs: StoryboardInputReference[],
  kind: StoryboardInputReference["kind"]
): StoryboardInputReference[] {
  return refs.filter((ref) => ref.kind === kind);
}

export function storyboardInputReferenceSlotsLeft(
  refs: StoryboardInputReference[]
): number {
  return Math.max(0, STORYBOARD_MAX_INPUT_REFERENCES - refs.length);
}

/** Stable order: character → product → environment (insertion order within kind). */
export function sortStoryboardInputReferences(
  refs: StoryboardInputReference[]
): StoryboardInputReference[] {
  const order: StoryboardInputReference["kind"][] = [
    "character",
    "product",
    "environment",
  ];
  return [...refs].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)
  );
}

export interface ResolvedStoryboardInputReference {
  kind: StoryboardInputReference["kind"];
  url: string;
  label?: string;
}

export type StoryboardFrameReferenceSlot =
  | {
      type: "input";
      url: string;
      kind: StoryboardInputReference["kind"];
      label?: string;
    }
  | { type: "generated"; url: string };

/** Text label sent beside each reference image in the vision model request. */
export function buildStoryboardInputReferencePromptLabel(
  kind: StoryboardInputReference["kind"],
  userLabel?: string
): string {
  const kindLabel = storyboardInputReferenceKindLabel(kind).toUpperCase();
  const caption = sanitizeStoryboardInputReferenceLabel(userLabel ?? "");
  if (caption) {
    return (
      `USER ${kindLabel} — "${caption}" — this attached image is that subject. ` +
      `Match it exactly in the storyboard frame whenever "${caption}" or this role appears in the script.`
    );
  }
  return (
    `USER ${kindLabel} — match this reference exactly in the storyboard frame ` +
    `(faces, product shape, or environment as labeled):`
  );
}

/** Summary block for scene breakdown + sketch prompts when labels are set. */
export function buildInputReferencesPromptBlock(
  refs: StoryboardInputReference[]
): string {
  const labeled = sortStoryboardInputReferences(refs).filter((ref) =>
    sanitizeStoryboardInputReferenceLabel(ref.label ?? "")
  );
  if (!labeled.length) return "";

  const lines = labeled.map((ref) => {
    const caption = sanitizeStoryboardInputReferenceLabel(ref.label!);
    return `${storyboardInputReferenceKindLabel(ref.kind)} "${caption}"`;
  });

  return [
    "UPLOADED REFERENCE IMAGES (user-provided — tie each name/role to the matching attached image in every scene):",
    lines.join("; ") + ".",
    "Use these exact labels in continuity character/prop descriptions and in scene actions when those subjects appear.",
  ].join(" ");
}

/**
 * Budget reference slots: user uploads first, then generated anchor/previous frames.
 */
export function pickStoryboardFrameReferenceUrls(options: {
  inputRefs: ResolvedStoryboardInputReference[];
  generatedFrameUrls: string[];
  maxRefs: number;
}): { slots: StoryboardFrameReferenceSlot[] } {
  const slots: StoryboardFrameReferenceSlot[] = [];

  for (const ref of options.inputRefs) {
    if (slots.length >= options.maxRefs) break;
    slots.push({
      type: "input",
      url: ref.url,
      kind: ref.kind,
      label: ref.label,
    });
  }

  for (const url of options.generatedFrameUrls) {
    if (slots.length >= options.maxRefs) break;
    slots.push({ type: "generated", url });
  }

  return { slots };
}

export async function validateStoryboardInputReferenceFiles(
  files: File[],
  currentRefs: StoryboardInputReference[]
): Promise<{ accepted: File[]; errors: string[] }> {
  const errors: string[] = [];
  if (!files.length) return { accepted: [], errors };

  const { accepted: formatOk, rejected } = partitionReferenceImageFiles(
    files,
    "image"
  );
  if (rejected.length) {
    errors.push(formatReferenceRejectionMessage(rejected, "image"));
  }

  const totalBytes = currentRefs.reduce((sum, ref) => sum + ref.sizeBytes, 0);
  const { toAdd, rejections } = planReferenceFileAdds(
    formatOk,
    currentRefs.length,
    totalBytes,
    "image"
  );
  errors.push(...rejections);

  const maxFileBytes = maxReferenceFileBytesForMedia("image");
  const accepted: File[] = [];
  for (const file of toAdd) {
    try {
      const { file: normalized } = await ensureFileMinDimensions(
        file,
        STORYBOARD_INPUT_REFERENCE_MIN_DIMENSION
      );
      if (normalized.size > maxFileBytes) {
        errors.push(
          `"${file.name}" is too large after resize (${formatBytes(normalized.size)}). Max ${formatBytes(maxFileBytes)} per file.`
        );
        continue;
      }
      accepted.push(normalized);
    } catch {
      errors.push(`"${file.name}" could not be read — use a valid JPEG, PNG, or WebP file.`);
    }
  }

  return { accepted, errors };
}

/** Server-side checks (no dimension probe). */
export function validateStoryboardInputReferenceUpload(file: File): string | null {
  if (!isSupportedReferenceImageFile(file, "image")) {
    return `Unsupported format. Use ${referenceFormatHint("image")}.`;
  }

  const maxFileBytes = maxReferenceFileBytesForMedia("image");
  if (file.size > maxFileBytes) {
    return `Image is too large (${formatBytes(file.size)}). Max ${formatBytes(maxFileBytes)} per file.`;
  }

  if (file.size < 512) {
    return "Image file is too small or empty.";
  }

  return null;
}

export function inputReferencesForDraft(
  refs: StoryboardInputReference[]
): StoryboardInputReference[] {
  return refs.map((ref) => ({
    ...ref,
    previewUrl: ref.previewUrl.startsWith("blob:")
      ? ""
      : ref.previewUrl.startsWith("data:")
        ? ""
        : ref.previewUrl,
    imageUrl:
      ref.imageUrl?.startsWith("data:") || ref.imageUrl?.startsWith("blob:")
        ? undefined
        : ref.imageUrl,
  }));
}
