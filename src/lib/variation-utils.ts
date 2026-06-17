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

const VARIATION_DESIGN_DIRECTIONS = [
  "Recompose with a split layout: hero on one side, copy and CTA on the other — same message, new structure.",
  "Use a stacked vertical rhythm: headline, hero, supporting copy, and CTA in a fresh top-to-bottom flow.",
  "Explore an asymmetric grid: offset focal point, dynamic diagonal flow, and varied element sizes.",
  "Try a card-based modular layout: distinct content zones with new spacing and separation.",
  "Lead with oversized typography: headline as the primary visual, imagery secondary.",
  "Lead with dominant photography or illustration: type integrated as overlay bands or side captions.",
  "Use a magazine editorial layout: columns, pull-quote zones, and varied type scale.",
  "Explore an icon- and badge-led composition: graphic symbols carry structure with minimal photo.",
  "Use bold horizontal bands: contrasting background strips for each content block.",
  "Try a centered hero with radial supporting elements: symmetrical but with a new graphic arrangement.",
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
  const direction =
    VARIATION_DESIGN_DIRECTIONS[
      variationIndex % VARIATION_DESIGN_DIRECTIONS.length
    ] ?? VARIATION_DESIGN_DIRECTIONS[0];

  return `${basePrompt.trim()}

VARIATION ${variationIndex + 1} — alternate design (not a recolor):
- Keep the same campaign message, audience, and "${layoutName}" layout system.
- The attached reference is for intent and brand mood only — do NOT copy its exact composition, colors, or pixel layout.
- Create a genuinely different design execution: ${direction}
- Change composition, hierarchy, spacing, and graphic structure. A color-shift or filter tweak alone is not acceptable.`;
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
      rationale: `Variation ${variationIndex + 1} — alternate design for ${layout?.name ?? parent.layoutId}.`,
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

export async function sourceImageToVariationReference(
  imageUrl: string
): Promise<ReferenceImagePayload> {
  const dataUrl = await blobUrlToDataUrl(imageUrl);
  return {
    role: "composition",
    influence: 72,
    dataUrl,
    usageMode: "inspire",
  };
}

/** @deprecated Use sourceImageToVariationReference for layout variations. */
export async function sourceImageToPreserveReference(
  imageUrl: string
): Promise<ReferenceImagePayload> {
  return sourceImageToVariationReference(imageUrl);
}
