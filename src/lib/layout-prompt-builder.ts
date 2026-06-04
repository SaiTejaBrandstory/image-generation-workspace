import { colorForImagePrompt, NO_SPEC_TEXT_IN_IMAGE } from "@/lib/color-for-prompt";
import { LAYOUT_MAP } from "@/lib/layout-systems";
import type {
  AspectRatio,
  DesignElement,
  DesignTokens,
  GenerationParams,
  LayoutId,
  PlatformPreset,
  PromptColorPalette,
  ReferenceImagePayload,
  StyleEngine,
} from "@/types";

const ASPECT_MAP: Record<AspectRatio, string> = {
  auto: "1:1",
  "1:1": "1:1",
  "4:5": "4:5",
  "5:4": "5:4",
  "16:9": "16:9",
  "9:16": "9:16",
  "3:4": "3:4",
  "4:3": "4:3",
  "2:3": "2:3",
  "3:2": "3:2",
  "21:9": "21:9",
  "1:4": "1:4",
  "4:1": "4:1",
  "1:8": "1:8",
  "8:1": "8:1",
};

export const STYLE_HINTS: Record<StyleEngine, string> = {
  none: "",
  cinematic:
    "Cinematic style: film-grade lighting, dramatic depth, moody color grading, widescreen composition",
  "creative-studio":
    "Creative studio style: art-directed sets, playful props, polished campaign photography",
  "luxury-editorial":
    "Luxury editorial style: high-end fashion lighting, refined typography zones, premium materials",
  "minimal-modern":
    "Minimal modern style: clean lines, generous whitespace, restrained palette, product clarity",
  "futuristic-tech":
    "Futuristic tech style: sleek interfaces, subtle glow, innovation cues, precision geometry",
  "ugc-social-native":
    "UGC social native style: authentic handheld feel, natural light, relatable creator energy",
  "bold-commercial":
    "Bold commercial style: high contrast, punchy color, clear hero focus, conversion-ready CTA zones",
  "experimental-artistic":
    "Experimental artistic style: unconventional composition, mixed media, gallery-worthy expression",
};

const LEGACY_STYLE_MAP: Record<string, StyleEngine> = {
  luxury: "luxury-editorial",
  tech: "futuristic-tech",
  fashion: "luxury-editorial",
  cyberpunk: "experimental-artistic",
  minimal: "minimal-modern",
  brutalist: "bold-commercial",
  editorial: "luxury-editorial",
  futuristic: "futuristic-tech",
  "product-ad": "bold-commercial",
  "apple-inspired": "minimal-modern",
  "nike-inspired": "bold-commercial",
  "porsche-inspired": "luxury-editorial",
};

const STYLE_ENGINE_VALUES = new Set<string>(Object.keys(STYLE_HINTS));

/** Maps stored conversation values (including legacy engines) to current presets. */
export function normalizeStyleEngine(style: string | undefined | null): StyleEngine {
  if (!style) return "none";
  if (STYLE_ENGINE_VALUES.has(style)) return style as StyleEngine;
  return LEGACY_STYLE_MAP[style] ?? "none";
}

export const DESIGN_ELEMENT_HINTS: Record<DesignElement, string> = {
  none: "",
  geometric:
    "Geometric design: bold shapes, grids, symmetry, structured composition, clean angles",
  isometric:
    "Isometric design: 3D isometric perspective, dimensional illustration, technical clarity",
  minimal:
    "Minimal design: generous whitespace, restrained palette, essential elements only",
  "editorial-magazine":
    "Editorial magazine design: sophisticated typography hierarchy, art-directed layouts, print-quality polish",
  glassmorphism:
    "Glassmorphism: frosted glass panels, blur, transparency, soft depth, layered UI surfaces",
  brutalist:
    "Brutalist design: raw concrete textures, heavy typography, stark geometry, high contrast",
  "collage-scrapbook":
    "Collage scrapbook design: mixed media layers, torn edges, eclectic textures, handmade feel",
  "cyberpunk-futuristic":
    "Cyberpunk futuristic design: neon accents, dystopian atmosphere, high-tech grit, cinematic glow",
  "organic-fluid":
    "Organic fluid design: flowing curves, natural forms, soft gradients, biomorphic shapes",
  "typography-centric":
    "Typography-centric design: type as hero, expressive letterforms, strong hierarchy, minimal imagery",
};

const PLATFORM_HINTS: Record<PlatformPreset, string> = {
  "instagram-post": "Instagram square feed post",
  "instagram-portrait": "Instagram portrait 4:5 feed",
  story: "vertical story format, mobile-first",
  "facebook-ad": "Facebook ad creative, clear CTA zone",
  linkedin: "professional LinkedIn B2B creative",
  "youtube-thumbnail": "YouTube thumbnail, bold readable hierarchy",
  pinterest: "Pinterest vertical pin, inspirational mood",
  tiktok: "TikTok native vertical, energetic UGC feel",
};

export function mapAspectRatio(ratio: AspectRatio): string {
  return ASPECT_MAP[ratio] ?? "1:1";
}

function designElementPromptLine(designElement: DesignElement): string {
  const hint = DESIGN_ELEMENT_HINTS[designElement];
  if (!hint) return "";
  return `Design element direction: ${hint}.`;
}

function stylePromptLine(style: StyleEngine): string {
  const hint = STYLE_HINTS[style];
  if (!hint) return "";
  return `Style direction: ${hint}.`;
}

function buildColorPromptLine(
  colors?: Partial<PromptColorPalette> | null
): string {
  if (!colors) return "";
  const parts: string[] = [];
  if (colors.primary?.trim()) {
    parts.push(`primary ${colors.primary.trim()}`);
  }
  if (colors.secondary?.trim()) {
    parts.push(`secondary ${colors.secondary.trim()}`);
  }
  if (parts.length === 0) return "";
  return `Color palette direction: use ${parts.join(", ")} as the brand color system.`;
}

export function buildLayoutImagePrompt(options: {
  userPrompt: string;
  layoutId: LayoutId;
  style: StyleEngine;
  platform: PlatformPreset;
  designElement?: DesignElement;
  promptColors?: Partial<PromptColorPalette> | null;
  params: GenerationParams;
  designTokens?: DesignTokens;
  references?: ReferenceImagePayload[];
}): string {
  const style = normalizeStyleEngine(options.style);
  const designElement = options.designElement ?? "none";
  const styleLine = stylePromptLine(style);
  const designLine = designElementPromptLine(designElement);
  const colorLine = buildColorPromptLine(options.promptColors);

  // Free-style: pass the prompt straight through with only minimal quality hints
  if (options.layoutId === "free") {
    const { userPrompt, references } = options;
    const inspireRefs = references?.filter((r) => r.usageMode !== "preserve") ?? [];
    const preserveRefs = references?.filter((r) => r.usageMode === "preserve") ?? [];
    const refNotes: string[] = [];
    if (inspireRefs.length > 0) refNotes.push(`INSPIRE (${inspireRefs.length} image(s)): Use for visual direction only — mood, palette, and styling.`);
    if (preserveRefs.length > 0) refNotes.push(`PRESERVE (${preserveRefs.length} image(s)): The attached asset(s) must appear in the output with their exact subject, colors, and fine details.`);
    return [userPrompt, styleLine, designLine, colorLine, ...refNotes, "Output a single polished, production-ready image. No text watermarks."].filter(Boolean).join(" ");
  }

  const layout = LAYOUT_MAP[options.layoutId];
  const { userPrompt, platform, params, designTokens, references } = options;

  const inspireRefs =
    references?.filter((r) => r.usageMode !== "preserve") ?? [];
  const preserveRefs =
    references?.filter((r) => r.usageMode === "preserve") ?? [];

  const refNotes: string[] = [];
  if (inspireRefs.length > 0) {
    refNotes.push(
      `INSPIRE (${inspireRefs.length} image(s)): Use attached reference(s) for visual direction only — mood, palette, composition, and styling. You may reinterpret content to fit the "${layout?.name}" layout.`
    );
  }
  if (preserveRefs.length > 0) {
    refNotes.push(
      `PRESERVE (${preserveRefs.length} image(s)): The attached asset(s) labeled preserve must appear in the output with the EXACT same subject, product, people, logos, colors, and fine details. Do not redraw, replace, stylize away, or reinterpret the asset. Only adapt surrounding layout, background, typography zones, and framing per the layout system.`
    );
  }
  const refNote = refNotes.length > 0 ? refNotes.join(" ") : "";

  const accentDesc = colorForImagePrompt(designTokens?.colors.accent);
  const primaryDesc = colorForImagePrompt(designTokens?.colors.primary);

  const brandNote = designTokens
    ? [
        designTokens.typography.primary &&
          `Typography feel (style only, do not write font names as visible text): ${designTokens.typography.primary}`,
        accentDesc && `Accent lighting and highlights: ${accentDesc}`,
        primaryDesc && `Dominant palette tone: ${primaryDesc}`,
        designTokens.composition.negativeSpace &&
          `Composition: ${designTokens.composition.negativeSpace}`,
        designTokens.personality.length &&
          `Brand personality: ${designTokens.personality.join(", ")}`,
      ]
        .filter(Boolean)
        .join(". ")
    : "";

  return [
    `Create a professional advertising visual using the "${layout?.name}" layout system.`,
    `Layout rules: ${layout?.description}. Design principles: ${layout?.principles.join(", ")}.`,
    `Creative brief: ${userPrompt}`,
    styleLine,
    designLine,
    colorLine,
    `Platform: ${PLATFORM_HINTS[platform]}.`,
    `Visual parameters — creativity ${params.creativity}%, typography strength ${params.typographyStrength}%, density ${params.visualDensity}%, motion energy ${params.motionEnergy}%, depth ${params.depthIntensity}%, contrast ${params.contrast}%, UI presence ${params.uiPresence}%.`,
    brandNote,
    refNote,
    "Output a single polished, production-ready marketing image. No text watermarks. No collage of multiple separate images.",
    NO_SPEC_TEXT_IN_IMAGE,
  ]
    .filter(Boolean)
    .join(" ");
}
