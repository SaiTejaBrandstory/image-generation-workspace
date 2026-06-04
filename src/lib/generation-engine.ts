import { LAYOUT_SYSTEMS } from "@/lib/layout-systems";
import { augmentPrompt, recommendLayouts } from "@/lib/design-md-parser";
import {
  formatOpenRouterErrorForUser,
  isRetryableOpenRouterError,
  retryDelayMs,
  sleepMs,
} from "@/lib/openrouter-errors";
import {
  apiErrorMessageFromResponse,
  parseApiJsonResponse,
} from "@/lib/parse-api-response";
import { maxReferencesForMedia } from "@/lib/reference-limits";
import { runWithConcurrency, serializeReferences } from "@/lib/reference-utils";
import { sourceImageToPreserveReference } from "@/lib/variation-utils";
import type {
  AspectRatio,
  DesignElement,
  DesignTokens,
  GenerationParams,
  LayoutId,
  LayoutVariant,
  PlatformPreset,
  PromptColorPalette,
  ReferenceImage,
  ReferenceImagePayload,
  StyleEngine,
} from "@/types";

const CONCURRENCY_DEFAULT = 4;
const CONCURRENCY_WITH_REFS = 2;

function buildRationale(
  layoutName: string,
  prompt: string,
  style: StyleEngine
): string {
  return `The ${layoutName} system aligns with your prompt's intent — "${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}" — optimized through the ${style} style engine with strong visual hierarchy and conversion-oriented placement.`;
}

function buildPsychology(layoutName: string): string {
  const map: Record<string, string> = {
    "Single Hero": "Creates immediate focal dominance — viewers fixate within 0.3s on the primary subject.",
    "Split Screen": "Triggers comparative cognition — ideal for before/after decision moments.",
    "Z Pattern": "Guides eye flow top-left → bottom-right, maximizing CTA discovery.",
    "F Pattern": "Supports information scanning for copy-heavy, trust-building content.",
    "Central Focus": "Radiates symmetry and premium balance — high emotional trust.",
    "Grid Modular": "Signals structure and scalability — reduces cognitive load.",
    "Diagonal Dynamic": "Injects kinetic energy — increases perceived motion and urgency.",
    "Editorial Magazine": "Elevates perceived value through whitespace and refined typography rhythm.",
    "Typography Dominant": "Type-as-hero creates bold brand recall with minimal distraction.",
    "Floating Elements": "Suggests innovation and depth — common in tech/AI positioning.",
    "Framed Content": "Contained focus increases perceived craftsmanship.",
    "Full Bleed": "Maximizes immersion — strongest emotional impact at scale.",
    "Layered Depth": "Parallax-like depth increases cinematic quality and memorability.",
    "Mobile Native": "Feels platform-authentic — higher engagement on social feeds.",
    "Carousel Sequential": "Narrative progression sustains attention across story beats.",
    "Asymmetrical": "Creative tension signals modernity and brand confidence.",
    "Radial": "Orbital energy draws attention to center — ideal for product ecosystems.",
    "Timeline": "Step-based clarity supports educational and journey messaging.",
    "UI Showcase": "Interface prominence drives product comprehension fast.",
    "Collage Scrapbook": "Mixed-media authenticity resonates with youth and culture brands.",
  };
  return map[layoutName] ?? "Balanced visual hierarchy with strong negative space discipline.";
}

function suggestPlatform(prompt: string): string {
  if (/tiktok|reel|story/i.test(prompt)) return "TikTok / Stories";
  if (/linkedin|b2b/i.test(prompt)) return "LinkedIn";
  if (/youtube|thumbnail/i.test(prompt)) return "YouTube";
  if (/pinterest/i.test(prompt)) return "Pinterest";
  if (/instagram|ig/i.test(prompt)) return "Instagram";
  return "Multi-platform";
}

function buildInfluenceBreakdown(refs: ReferenceImage[]): Record<string, number> | undefined {
  if (refs.length === 0) return undefined;
  const breakdown: Record<string, number> = {};
  refs.slice(0, 4).forEach((ref, i) => {
    const label =
      ref.usageMode === "preserve"
        ? `Preserve ${i + 1}`
        : `Inspire ${i + 1}`;
    breakdown[label] = Math.round(100 / Math.min(refs.length, 4));
  });
  return breakdown;
}

async function generateOneImageWithRetry(
  options: Parameters<typeof generateOneImage>[0],
  maxAttempts = 4
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await generateOneImage(options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (
        isRetryableOpenRouterError(undefined, lastError.message) &&
        attempt < maxAttempts - 1
      ) {
        await sleepMs(retryDelayMs(attempt));
        continue;
      }
      throw new Error(formatOpenRouterErrorForUser(lastError.message));
    }
  }
  throw new Error(
    formatOpenRouterErrorForUser(lastError?.message ?? "Generation failed")
  );
}

async function generateOneImage(options: {
  userPrompt: string;
  layoutId: LayoutId;
  style: StyleEngine;
  platform: PlatformPreset;
  designElement?: DesignElement;
  promptColors?: Partial<PromptColorPalette>;
  aspectRatio: AspectRatio;
  params: GenerationParams;
  imageModel: string;
  designTokens?: DesignTokens;
  references: ReferenceImage[];
  referenceOverrides?: ReferenceImagePayload[];
  conversationId?: string;
  variant?: LayoutVariant;
}): Promise<string> {
  const maxRefs = maxReferencesForMedia("image");
  const refsForRequest = options.references.slice(0, maxRefs);
  const serializedRefs =
    options.referenceOverrides ??
    (await serializeReferences(refsForRequest));

  const res = await fetch("/api/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPrompt: options.userPrompt,
      layoutId: options.layoutId,
      style: options.style,
      platform: options.platform,
      designElement: options.designElement ?? "none",
      promptColors: options.promptColors,
      aspectRatio: options.aspectRatio,
      params: options.params,
      designTokens: options.designTokens,
      references: serializedRefs,
      model: options.imageModel,
      conversationId: options.conversationId,
      variantId: options.variant?.id,
      variantMeta: options.variant
        ? {
            prompt: options.variant.prompt,
            rationale: options.variant.rationale,
            visualPsychology: options.variant.visualPsychology,
            bestUse: options.variant.bestUse,
            suggestedPlatform: options.variant.suggestedPlatform,
            principles: options.variant.principles,
            influenceBreakdown: options.variant.influenceBreakdown,
          }
        : undefined,
    }),
  });

  const { data, raw, parseError } = await parseApiJsonResponse<{
    error?: string;
    imageUrl?: string;
  }>(res);

  if (!res.ok || !data?.imageUrl) {
    throw new Error(
      data?.error
        ? formatOpenRouterErrorForUser(data.error)
        : apiErrorMessageFromResponse(
            res,
            raw,
            parseError,
            `Generation failed (${res.status})`
          )
    );
  }

  return data.imageUrl;
}

function newVariantId(): string {
  return crypto.randomUUID();
}

export function buildPendingVariants(options: {
  prompt: string;
  layoutIds: LayoutId[];
  style: StyleEngine;
  references: ReferenceImage[];
  designTokens?: DesignTokens;
}): LayoutVariant[] {
  const { prompt, layoutIds, style, references, designTokens } = options;
  const augmented = augmentPrompt(prompt, designTokens);
  const layouts =
    layoutIds.length > 0
      ? LAYOUT_SYSTEMS.filter((l) => layoutIds.includes(l.id))
      : LAYOUT_SYSTEMS;

  return layouts.map((layout) => ({
    id: newVariantId(),
    layoutId: layout.id,
    userPrompt: prompt,
    prompt: augmented,
    rationale: buildRationale(layout.name, prompt, style),
    visualPsychology: buildPsychology(layout.name),
    bestUse: layout.bestUse,
    suggestedPlatform: suggestPlatform(prompt),
    principles: layout.principles,
    influenceBreakdown: buildInfluenceBreakdown(references),
    status: "pending" as const,
  }));
}

/** Build N free-style pending variants (no layout system applied). */
export function buildFreeStyleVariants(options: {
  prompt: string;
  count: number;
  references: ReferenceImage[];
}): LayoutVariant[] {
  const { prompt, count, references } = options;
  return Array.from({ length: count }, (_, i) => ({
    id: newVariantId(),
    layoutId: "free" as const,
    userPrompt: prompt,
    prompt,
    rationale: `Free-style generation - your prompt was sent directly to the model.`,
    visualPsychology: "Direct generation without layout constraints.",
    bestUse: "Any use case",
    suggestedPlatform: suggestPlatform(prompt),
    principles: [],
    influenceBreakdown: buildInfluenceBreakdown(references),
    sortIndex: i,
    status: "pending" as const,
  }));
}

export async function generateLayoutVariants(options: {
  prompt: string;
  layoutIds: LayoutId[];
  style: StyleEngine;
  platform: PlatformPreset;
  designElement?: DesignElement;
  promptColors?: Partial<PromptColorPalette>;
  aspectRatio: AspectRatio;
  params: GenerationParams;
  references: ReferenceImage[];
  imageModel: string;
  designTokens?: DesignTokens;
  conversationId?: string;
  pendingVariants?: LayoutVariant[];
  onProgress?: (progress: number, variants: LayoutVariant[]) => void;
}): Promise<LayoutVariant[]> {
  const {
    prompt,
    layoutIds,
    style,
    platform,
    designElement = "none",
    promptColors,
    aspectRatio,
    params,
    references,
    imageModel,
    designTokens,
    conversationId,
    onProgress,
  } = options;

  const variants: LayoutVariant[] =
    options.pendingVariants ??
    buildPendingVariants({
      prompt,
      layoutIds,
      style,
      references,
      designTokens,
    });

  onProgress?.(0, [...variants]);

  let completed = 0;
  let started = 0;
  const total = variants.length;
  const concurrency =
    references.length > 0 ? CONCURRENCY_WITH_REFS : CONCURRENCY_DEFAULT;

  /**
   * Progress formula: each slot contributes 100/total points.
   * - When a variant starts generating it earns 30% of its slot.
   * - When it finishes (complete or error) it earns the remaining 70%.
   * This means the bar immediately moves as the first batch starts,
   * rather than staying at 0% until the first image finishes.
   */
  function calcProgress(): number {
    if (total === 0) return 0;
    return Math.min(
      ((started * 0.3 + completed * 0.7) / total) * 100,
      99 // never reach 100% until explicitly set at the end
    );
  }

  await runWithConcurrency(
    variants,
    concurrency,
    async (variant, index) => {
      variants[index] = {
        ...variants[index],
        status: "generating",
        errorMessage: undefined,
      };
      started++;
      onProgress?.(calcProgress(), [...variants]);

      try {
        const imageUrl = await generateOneImageWithRetry({
          userPrompt: prompt,
          layoutId: variant.layoutId,
          style,
          platform,
          designElement,
          promptColors,
          aspectRatio,
          params,
          imageModel,
          designTokens,
          references,
          conversationId,
          variant: variants[index],
        });

        variants[index] = {
          ...variants[index],
          status: "complete",
          imageUrl,
          errorMessage: undefined,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        const layout = LAYOUT_MAP_FALLBACK(variant.layoutId);
        variants[index] = {
          ...variants[index],
          status: "error",
          errorMessage: message,
          imageUrl: layout ? `gradient:${layout.gradient}` : undefined,
        };
      }

      completed++;
      onProgress?.(calcProgress(), [...variants]);
    }
  );

  return variants;
}

function LAYOUT_MAP_FALLBACK(id: LayoutId) {
  return LAYOUT_SYSTEMS.find((l) => l.id === id);
}

export async function generateSingleVariant(options: {
  prompt: string;
  layoutId: LayoutId;
  style: StyleEngine;
  platform: PlatformPreset;
  designElement?: DesignElement;
  promptColors?: Partial<PromptColorPalette>;
  aspectRatio: AspectRatio;
  params: GenerationParams;
  references: ReferenceImage[];
  referenceOverrides?: ReferenceImagePayload[];
  imageModel: string;
  designTokens?: DesignTokens;
  existing: LayoutVariant;
  conversationId?: string;
}): Promise<LayoutVariant> {
  const layoutName =
    LAYOUT_SYSTEMS.find((l) => l.id === options.layoutId)?.name ?? "layout";
  const isVariation =
    options.existing.variantKind === "variation" ||
    Boolean(options.existing.parentVariantId);

  const imageUrl = await generateOneImageWithRetry({
    userPrompt: options.prompt,
    layoutId: options.layoutId,
    style: options.style,
    platform: options.platform,
    designElement: options.designElement ?? "none",
    promptColors: options.promptColors,
    aspectRatio: options.aspectRatio,
    params: options.params,
    imageModel: options.imageModel,
    designTokens: options.designTokens,
    references: options.references,
    referenceOverrides: options.referenceOverrides,
    conversationId: options.conversationId,
    variant: options.existing,
  });

  const augmented = augmentPrompt(
    options.prompt,
    options.designTokens
  );

  const variationLabel =
    isVariation && options.existing.variationIndex != null
      ? `Variation ${options.existing.variationIndex + 1}`
      : null;

  return {
    ...options.existing,
    id: options.existing.id,
    userPrompt: options.prompt,
    prompt: augmented,
    imageUrl,
    status: "complete",
    rationale: variationLabel
      ? `${variationLabel} regenerated with ${options.style} style — only this alternate was updated.`
      : `Regenerated with ${options.style} style — same ${layoutName} system, updated visual execution.`,
  };
}

export async function generateVariantVariations(options: {
  parent: LayoutVariant;
  pendingVariations: LayoutVariant[];
  style: StyleEngine;
  platform: PlatformPreset;
  designElement?: DesignElement;
  promptColors?: Partial<PromptColorPalette>;
  aspectRatio: AspectRatio;
  params: GenerationParams;
  imageModel: string;
  designTokens?: DesignTokens;
  conversationId: string;
  onProgress?: (variations: LayoutVariant[]) => void;
}): Promise<LayoutVariant[]> {
  if (!options.parent.imageUrl) {
    throw new Error("Parent image is required to create variations.");
  }

  const sourceRef = await sourceImageToPreserveReference(
    options.parent.imageUrl
  );
  const variations: LayoutVariant[] = options.pendingVariations.map((v) => ({
    ...v,
    status: "generating" as const,
  }));

  options.onProgress?.([...variations]);

  await runWithConcurrency(
    variations,
    2,
    async (variant, index) => {
      const promptText = variant.userPrompt?.trim() ?? "";
      try {
        const imageUrl = await generateOneImageWithRetry({
          userPrompt: promptText,
          layoutId: variant.layoutId,
          style: options.style,
          platform: options.platform,
          designElement: options.designElement ?? "none",
          promptColors: options.promptColors,
          aspectRatio: options.aspectRatio,
          params: options.params,
          imageModel: options.imageModel,
          designTokens: options.designTokens,
          references: [],
          referenceOverrides: [sourceRef],
          conversationId: options.conversationId,
          variant,
        });

        variations[index] = {
          ...variant,
          imageUrl,
          status: "complete",
        };
      } catch (err) {
        variations[index] = {
          ...variant,
          status: "error",
          errorMessage:
            err instanceof Error ? err.message : "Variation failed",
        };
      }
      options.onProgress?.([...variations]);
    }
  );

  return variations;
}

export { recommendLayouts };
