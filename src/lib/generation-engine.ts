import { LAYOUT_SYSTEMS } from "@/lib/layout-systems";
import { augmentPrompt, recommendLayouts } from "@/lib/design-md-parser";
import { runWithConcurrency, serializeReferences } from "@/lib/reference-utils";
import type {
  AspectRatio,
  DesignTokens,
  GenerationParams,
  LayoutId,
  LayoutVariant,
  PlatformPreset,
  ReferenceImage,
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
  refs.slice(0, 4).forEach((_, i) => {
    breakdown[`Reference ${i + 1}`] = Math.round(100 / Math.min(refs.length, 4));
  });
  return breakdown;
}

async function generateOneImageWithRetry(
  options: Parameters<typeof generateOneImage>[0],
  retries = 1
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await generateOneImage(options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error("Generation failed");
}

async function generateOneImage(options: {
  userPrompt: string;
  layoutId: LayoutId;
  style: StyleEngine;
  platform: PlatformPreset;
  aspectRatio: AspectRatio;
  params: GenerationParams;
  imageModel: string;
  designTokens?: DesignTokens;
  references: ReferenceImage[];
  conversationId?: string;
  variant?: LayoutVariant;
}): Promise<string> {
  const serializedRefs = await serializeReferences(options.references);

  const res = await fetch("/api/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPrompt: options.userPrompt,
      layoutId: options.layoutId,
      style: options.style,
      platform: options.platform,
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

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Generation failed (${res.status})`);
  }

  return data.imageUrl as string;
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

export async function generateLayoutVariants(options: {
  prompt: string;
  layoutIds: LayoutId[];
  style: StyleEngine;
  platform: PlatformPreset;
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
  const concurrency =
    references.length > 0 ? CONCURRENCY_WITH_REFS : CONCURRENCY_DEFAULT;

  await runWithConcurrency(
    variants,
    concurrency,
    async (variant, index) => {
      variants[index] = {
        ...variants[index],
        status: "generating",
        errorMessage: undefined,
      };
      onProgress?.((completed / variants.length) * 100, [...variants]);

      try {
        const imageUrl = await generateOneImageWithRetry({
          userPrompt: prompt,
          layoutId: variant.layoutId,
          style,
          platform,
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
      onProgress?.((completed / variants.length) * 100, [...variants]);
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
  aspectRatio: AspectRatio;
  params: GenerationParams;
  references: ReferenceImage[];
  imageModel: string;
  designTokens?: DesignTokens;
  existing: LayoutVariant;
  conversationId?: string;
}): Promise<LayoutVariant> {
  const imageUrl = await generateOneImageWithRetry({
    userPrompt: options.prompt,
    layoutId: options.layoutId,
    style: options.style,
    platform: options.platform,
    aspectRatio: options.aspectRatio,
    params: options.params,
    imageModel: options.imageModel,
    designTokens: options.designTokens,
    references: options.references,
    conversationId: options.conversationId,
    variant: options.existing,
  });

  const augmented = augmentPrompt(
    options.prompt,
    options.designTokens
  );

  return {
    ...options.existing,
    id: options.existing.id,
    userPrompt: options.prompt,
    prompt: augmented,
    imageUrl,
    status: "complete",
    rationale: `Regenerated with ${options.style} style — same ${LAYOUT_SYSTEMS.find((l) => l.id === options.layoutId)?.name ?? "layout"} system, updated visual execution.`,
  };
}

export { recommendLayouts };
