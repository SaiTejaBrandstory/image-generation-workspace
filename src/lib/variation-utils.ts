import { augmentPrompt } from "@/lib/design-md-parser";
import { LAYOUT_MAP } from "@/lib/layout-systems";
import { maxPromptCharsForMedia } from "@/lib/prompt-limits";
import type {
  LayoutVariant,
  ReferenceImagePayload,
  StyleEngine,
  VideoMeta,
} from "@/types";
import { blobUrlToDataUrl } from "@/lib/reference-utils";

export const MIN_VARIATIONS = 1;
export const MAX_VARIATIONS = 10;
export const DEFAULT_VARIATION_BATCH = 3;

/** @deprecated Use MAX_VARIATIONS */
export const VARIATION_COUNT = DEFAULT_VARIATION_BATCH;

const VARIATION_ANGLES = [
  "Shift color palette and lighting mood while keeping the same message and layout structure.",
  "Adjust composition emphasis and negative space; explore a fresh focal hierarchy.",
  "Try alternate typography weight, texture, and graphic accents while staying on-brand.",
  "Introduce a bolder contrast ratio and sharper graphic hierarchy.",
  "Soften the palette with more whitespace and a calmer editorial feel.",
  "Push a more cinematic crop and dramatic lighting direction.",
  "Explore a minimalist, icon-led composition with fewer elements.",
  "Add subtle pattern, grain, or tactile background texture.",
  "Rebalance headline scale versus supporting copy for a new rhythm.",
  "Try a lifestyle-forward scene with warmer ambient light and depth.",
];

const VIDEO_VARIATION_ANGLES = [
  "Subtle color grade and lighting shift — same story and pacing.",
  "Slight camera emphasis change — same scene and subject.",
  "Gentler pacing tweak — same core action.",
  "A touch more contrast — same composition.",
  "Softer light and calmer motion — same scene.",
  "Slightly more cinematic crop — same subject.",
  "Cleaner motion paths — same story beat.",
  "Light texture or grain — same setting.",
  "Minor subject vs. background balance — same intent.",
  "Warmer ambient light — same scene.",
];

export function clampVariationBatch(count: number): number {
  return Math.min(MAX_VARIATIONS, Math.max(MIN_VARIATIONS, Math.round(count)));
}

export function isRootVariant(variant: LayoutVariant): boolean {
  return (
    variant.variantKind !== "variation" && !variant.parentVariantId
  );
}

export function getChildVariations(
  variants: LayoutVariant[],
  parentId: string
): LayoutVariant[] {
  return variants
    .filter((v) => v.parentVariantId === parentId)
    .sort((a, b) => (a.variationIndex ?? 0) - (b.variationIndex ?? 0));
}

export function countCompleteVariations(
  variants: LayoutVariant[],
  parentId: string
): number {
  return getChildVariations(variants, parentId).filter(
    (v) => v.status === "complete"
  ).length;
}

export function getNextVariationStartIndex(
  children: LayoutVariant[]
): number {
  if (children.length === 0) return 0;
  return (
    Math.max(...children.map((c) => c.variationIndex ?? 0)) + 1
  );
}

export function remainingVariationSlots(children: LayoutVariant[]): number {
  return Math.max(0, MAX_VARIATIONS - children.length);
}

export function variationSortIndex(
  parentSortIndex: number,
  variationIndex: number
): number {
  return parentSortIndex * 100 + variationIndex + 1;
}

export function buildVariationVideoUserPrompt(
  basePrompt: string,
  variationIndex: number
): string {
  const angle =
    VIDEO_VARIATION_ANGLES[variationIndex % VIDEO_VARIATION_ANGLES.length] ??
    VIDEO_VARIATION_ANGLES[0];
  const suffix = `\n\nVar ${variationIndex + 1}: ${angle} Match the reference frame from the original video — same subject, scene, and story; only subtle visual changes.`;
  const maxChars = maxPromptCharsForMedia("video");
  const maxBase = Math.max(0, maxChars - suffix.length);
  const trimmedBase = basePrompt.trim().slice(0, maxBase);
  return `${trimmedBase}${suffix}`;
}

export function buildVariationUserPrompt(
  basePrompt: string,
  layoutId: LayoutVariant["layoutId"],
  variationIndex: number
): string {
  const layoutName = LAYOUT_MAP[layoutId]?.name ?? "layout";
  const angle =
    VARIATION_ANGLES[variationIndex % VARIATION_ANGLES.length] ??
    VARIATION_ANGLES[0];
  return `${basePrompt.trim()}\n\nVariation ${variationIndex + 1}: ${angle} Keep the same campaign intent and "${layoutName}" structure. The attached source image is the reference — produce a distinct alternate take, not a copy.`;
}

export function buildPendingVariations(
  parent: LayoutVariant,
  _style: StyleEngine,
  count: number,
  startIndex = 0
): LayoutVariant[] {
  const layout = LAYOUT_MAP[parent.layoutId];
  const basePrompt =
    parent.userPrompt?.trim() || parent.prompt.trim() || "Creative variation";
  const parentSort = parent.sortIndex ?? 0;
  const batch = clampVariationBatch(count);

  return Array.from({ length: batch }, (_, offset) => {
    const variationIndex = startIndex + offset;
    const userPrompt = buildVariationUserPrompt(
      basePrompt,
      parent.layoutId,
      variationIndex
    );
    const augmented = augmentPrompt(userPrompt);
    return {
      id: crypto.randomUUID(),
      layoutId: parent.layoutId,
      parentVariantId: parent.id,
      variantKind: "variation" as const,
      variationIndex,
      userPrompt,
      prompt: augmented,
      rationale: `Variation ${variationIndex + 1} — alternate take on ${layout?.name ?? parent.layoutId}.`,
      visualPsychology: parent.visualPsychology,
      bestUse: parent.bestUse,
      suggestedPlatform: parent.suggestedPlatform,
      principles: parent.principles,
      influenceBreakdown: parent.influenceBreakdown,
      status: "pending" as const,
      generationRound: parent.generationRound,
      createdAt: Date.now(),
      sortIndex: variationSortIndex(parentSort, variationIndex),
    };
  });
}

export function buildPendingVideoVariations(
  parent: LayoutVariant,
  count: number,
  startIndex = 0
): LayoutVariant[] {
  const basePrompt =
    parent.userPrompt?.trim() || parent.prompt.trim() || "Creative video variation";
  const parentSort = parent.sortIndex ?? 0;
  const videoMeta: VideoMeta = parent.videoMeta ?? {};
  const batch = clampVariationBatch(count);

  return Array.from({ length: batch }, (_, offset) => {
    const variationIndex = startIndex + offset;
    const userPrompt = buildVariationVideoUserPrompt(basePrompt, variationIndex);
    return {
      id: crypto.randomUUID(),
      layoutId: parent.layoutId,
      mediaType: "video" as const,
      parentVariantId: parent.id,
      variantKind: "variation" as const,
      variationIndex,
      userPrompt,
      prompt: userPrompt,
      rationale: `Variation ${variationIndex + 1} — subtle alternate using the original video as reference.`,
      visualPsychology: parent.visualPsychology,
      bestUse: parent.bestUse,
      suggestedPlatform: parent.suggestedPlatform,
      principles: parent.principles,
      influenceBreakdown: parent.influenceBreakdown,
      videoMeta,
      status: "pending" as const,
      generationRound: parent.generationRound,
      createdAt: Date.now(),
      sortIndex: variationSortIndex(parentSort, variationIndex),
    };
  });
}

export async function sourceImageToPreserveReference(
  imageUrl: string
): Promise<ReferenceImagePayload> {
  const dataUrl = await blobUrlToDataUrl(imageUrl);
  return {
    role: "product",
    influence: 100,
    dataUrl,
    usageMode: "preserve",
  };
}
