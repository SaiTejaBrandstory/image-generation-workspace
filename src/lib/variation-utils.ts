import { augmentPrompt } from "@/lib/design-md-parser";
import { LAYOUT_MAP, LAYOUT_SYSTEMS } from "@/lib/layout-systems";
import { maxPromptCharsForMedia } from "@/lib/prompt-limits";
import {
  getAspectRatiosForModel,
  isAspectRatioSupported,
} from "@/lib/openrouter-models";
import {
  inferAspectRatioFromImageUrl,
  nearestStoryboardAspectRatio,
} from "@/lib/storyboard/storyboard-image";
import { getDataUrlDimensions } from "@/lib/reference-image-dimensions";
import type {
  AspectRatio,
  GenerationParams,
  LayoutId,
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

const VARIATION_LAYOUT_POOL = LAYOUT_SYSTEMS.map((layout) => layout.id).filter(
  (id): id is LayoutId => id !== "free"
);

const VARIATION_DESIGN_DIRECTIONS = [
  "Split the canvas — product or hero on one side, headline and CTA on the other.",
  "Stack everything vertically: headline, hero, body copy, then CTA.",
  "Asymmetric grid with an off-center focal point and diagonal visual flow.",
  "Card-based modules — separate zones for headline, image, proof points, and CTA.",
  "Typography-first: oversized headline dominates; imagery supports in a smaller zone.",
  "Image-first: full or large hero visual with type in a band, corner tag, or sidebar.",
  "Editorial magazine spread: columns, pull-quote block, and varied type scale.",
  "Icon- and badge-led structure with compact copy and strong graphic markers.",
  "Horizontal content bands — each message block sits in its own contrasting strip.",
  "Centered hero with supporting elements arranged in a radial or orbital pattern.",
];

const VARIATION_SCENE_DIRECTIONS = [
  "Studio gradient backdrop with clean spotlight and minimal props.",
  "Cinematic real-world lifestyle setting tied to the product use moment.",
  "Abstract 3D environment with geometric forms and depth layers.",
  "Editorial set design with textured background and art-directed surfaces.",
  "Motion-led energy scene using streaks, particles, or directional light trails.",
  "Minimal premium scene with strong negative space and subtle shadow play.",
  "UI/infographic hybrid backdrop with modular information panels.",
  "Organic nature-inspired environment (water, mist, stone, botanical, or air cues).",
  "High-contrast graphic poster world with bold blocks and shape cutouts.",
  "Night-mode neon or glow treatment with controlled highlights.",
];

const VARIATION_TYPE_DIRECTIONS = [
  "Headline in a single dominant zone; body copy compact and secondary.",
  "Vertical type rhythm with clear top-mid-bottom hierarchy.",
  "Two-column typography structure with deliberate asymmetry.",
  "Large quote/claim lockup plus a compact proof-point block.",
  "Short headline + icon-supported benefit bullets + focused CTA.",
  "Top banner headline with a separated lower conversion panel.",
  "Side-rail typography with generous spacing and sparse copy.",
  "Bold condensed headline with minimal supporting microcopy.",
  "Editorial serif/sans contrast with clear reading flow.",
  "CTA isolated in its own dedicated block, separate from body copy.",
];

/** Pick a different layout system than the parent so variations are structurally distinct. */
export function getVariationLayoutId(
  parentLayoutId: LayoutId,
  variationIndex: number
): LayoutId {
  if (parentLayoutId === "free") return "free";
  const pool = VARIATION_LAYOUT_POOL.filter((id) => id !== parentLayoutId);
  if (!pool.length) return parentLayoutId;
  return pool[variationIndex % pool.length]!;
}

/** Push models toward bolder layout exploration while keeping product identity. */
export function getVariationGenerationParams(
  params: GenerationParams
): GenerationParams {
  return {
    ...params,
    creativity: Math.max(params.creativity ?? 50, 90),
    visualDensity: Math.min(100, (params.visualDensity ?? 50) + 10),
    contrast: Math.min(100, (params.contrast ?? 50) + 8),
    typographyStrength: Math.min(
      100,
      (params.typographyStrength ?? 50) + 14
    ),
  };
}

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

function nearestSupportedAspectRatio(
  imageModel: string,
  target: AspectRatio
): AspectRatio {
  if (target !== "auto" && isAspectRatioSupported(imageModel, target)) {
    return target;
  }

  const supported = getAspectRatiosForModel(imageModel).filter(
    (ratio) => ratio !== "auto"
  );
  if (!supported.length) return "1:1";

  if (target === "auto") return supported[0]!;

  const [tw, th] = target.split(":").map(Number);
  if (!tw || !th) return supported[0]!;

  const targetLog = Math.log(tw / th);
  let best: AspectRatio = supported[0]!;
  let bestDiff = Infinity;
  for (const label of supported) {
    const [w, h] = label.split(":").map(Number);
    if (!w || !h) continue;
    const diff = Math.abs(targetLog - Math.log(w / h));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  return best;
}

function clampLockedVariationAspectRatio(
  imageModel: string,
  aspectRatio: AspectRatio
): AspectRatio {
  return nearestSupportedAspectRatio(imageModel, aspectRatio);
}

async function inferParentAspectRatio(
  parentImageUrl: string
): Promise<AspectRatio | null> {
  try {
    const dataUrl = await blobUrlToDataUrl(parentImageUrl);
    const { width, height } = await getDataUrlDimensions(dataUrl);
    if (width > 0 && height > 0) {
      return nearestStoryboardAspectRatio(width, height);
    }
  } catch {
    /* fall through */
  }
  return inferAspectRatioFromImageUrl(parentImageUrl);
}

/** Lock variations to the parent canvas — never use "auto" (models default to random sizes). */
export async function resolveVariationAspectRatio(options: {
  parentImageUrl: string;
  imageModel: string;
  conversationAspectRatio?: AspectRatio | null;
  workspaceAspectRatio?: AspectRatio;
}): Promise<AspectRatio> {
  const { parentImageUrl, imageModel, conversationAspectRatio, workspaceAspectRatio } =
    options;

  const inferred = await inferParentAspectRatio(parentImageUrl);
  if (inferred) {
    return clampLockedVariationAspectRatio(imageModel, inferred);
  }

  if (conversationAspectRatio && conversationAspectRatio !== "auto") {
    return clampLockedVariationAspectRatio(imageModel, conversationAspectRatio);
  }

  if (workspaceAspectRatio && workspaceAspectRatio !== "auto") {
    return clampLockedVariationAspectRatio(imageModel, workspaceAspectRatio);
  }

  return clampLockedVariationAspectRatio(imageModel, "1:1");
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
  targetLayoutId: LayoutVariant["layoutId"],
  parentLayoutId: LayoutVariant["layoutId"],
  variationIndex: number,
  lockedAspectRatio?: AspectRatio
): string {
  const targetLayoutName = LAYOUT_MAP[targetLayoutId]?.name ?? "layout";
  const parentLayoutName = LAYOUT_MAP[parentLayoutId]?.name ?? "layout";
  const direction =
    VARIATION_DESIGN_DIRECTIONS[
      variationIndex % VARIATION_DESIGN_DIRECTIONS.length
    ] ?? VARIATION_DESIGN_DIRECTIONS[0];
  const sceneDirection =
    VARIATION_SCENE_DIRECTIONS[
      variationIndex % VARIATION_SCENE_DIRECTIONS.length
    ] ?? VARIATION_SCENE_DIRECTIONS[0];
  const typeDirection =
    VARIATION_TYPE_DIRECTIONS[
      variationIndex % VARIATION_TYPE_DIRECTIONS.length
    ] ?? VARIATION_TYPE_DIRECTIONS[0];
  const aspectLine =
    lockedAspectRatio && lockedAspectRatio !== "auto"
      ? `\n- REQUIRED canvas: ${lockedAspectRatio} aspect ratio — identical dimensions to the parent. Do not output any other aspect ratio.`
      : "";
  const layoutLine =
    targetLayoutId === parentLayoutId
      ? `- Re-execute the "${targetLayoutName}" system with a radically different composition than the parent.`
      : `- Parent used "${parentLayoutName}". You MUST build with the "${targetLayoutName}" layout system — a visibly different structure.`;

  return `CAMPAIGN BRIEF — keep message, product, and brand intent:
${basePrompt.trim()}

VARIATION ${variationIndex + 1} — new design, same product:
${layoutLine}
- Attached reference = product/logo identity ONLY. Reuse the exact same product packaging, bottle, and brand logo. Do NOT copy the parent's layout, background, text positions, lighting, smoke, gradients, or decorative effects.
- FORBIDDEN: cloning the parent's composition, grid, or visual structure. The result must look like a different designer's take on the same brief.
- Mandatory new layout: ${direction}
- Mandatory new scene/background direction: ${sceneDirection}
- Mandatory typography treatment: ${typeDirection}
- Logo safe zones: keep all text/typography, badges, CTAs, and dense visual elements away from all four corners. Leave clean corner space for logo placement.
- Full-bleed output only: fill the entire canvas edge-to-edge. No white border, frame, margin, padding, inset card, or picture-in-picture layout.
- Change hero placement, type hierarchy, graphic shapes, spacing, and background treatment.${aspectLine}`;
}

export function buildPendingVariations(
  parent: LayoutVariant,
  _style: StyleEngine,
  count: number,
  startIndex = 0,
  lockedAspectRatio?: AspectRatio
): LayoutVariant[] {
  const layout = LAYOUT_MAP[parent.layoutId];
  const basePrompt =
    parent.userPrompt?.trim() || parent.prompt.trim() || "Creative variation";
  const parentSort = parent.sortIndex ?? 0;
  const batch = clampVariationBatch(count);

  return Array.from({ length: batch }, (_, offset) => {
    const variationIndex = startIndex + offset;
    const targetLayoutId = getVariationLayoutId(parent.layoutId, variationIndex);
    const userPrompt = buildVariationUserPrompt(
      basePrompt,
      targetLayoutId,
      parent.layoutId,
      variationIndex,
      lockedAspectRatio
    );
    const augmented = augmentPrompt(userPrompt);
    const targetLayout = LAYOUT_MAP[targetLayoutId];
    return {
      id: crypto.randomUUID(),
      layoutId: targetLayoutId,
      parentVariantId: parent.id,
      variantKind: "variation" as const,
      variationIndex,
      userPrompt,
      prompt: augmented,
      rationale: `Variation ${variationIndex + 1} — ${targetLayout?.name ?? targetLayoutId} layout (original: ${layout?.name ?? parent.layoutId}).`,
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
    role: "product",
    influence: 32,
    dataUrl,
    usageMode: "inspire",
    referenceContext: "variation-parent",
  };
}

/** @deprecated Use sourceImageToVariationReference for layout variations. */
export async function sourceImageToPreserveReference(
  imageUrl: string
): Promise<ReferenceImagePayload> {
  return sourceImageToVariationReference(imageUrl);
}
