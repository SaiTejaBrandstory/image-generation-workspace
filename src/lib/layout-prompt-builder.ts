import { LAYOUT_MAP } from "@/lib/layout-systems";
import type {
  AspectRatio,
  DesignTokens,
  GenerationParams,
  LayoutId,
  PlatformPreset,
  ReferenceImagePayload,
  StyleEngine,
} from "@/types";

const ASPECT_MAP: Record<AspectRatio, string> = {
  auto: "1:1",
  "1:1": "1:1",
  "4:5": "4:5",
  "16:9": "16:9",
  "9:16": "9:16",
  "3:4": "3:4",
  "4:3": "4:3",
};

const STYLE_HINTS: Record<StyleEngine, string> = {
  luxury: "luxury cinematic lighting, premium materials, refined minimalism",
  tech: "futuristic tech aesthetic, clean UI, subtle glow, innovation",
  fashion: "high-fashion editorial, elegant poses, runway quality",
  cyberpunk: "neon cyberpunk, high contrast, dystopian futurism",
  minimal: "ultra-minimal, generous whitespace, restrained palette",
  brutalist: "bold brutalist typography, raw geometry, high contrast",
  editorial: "magazine editorial, sophisticated typography, art direction",
  futuristic: "futuristic visionary, sleek forms, atmospheric depth",
  "product-ad": "commercial product advertising, sharp focus, hero product",
  "apple-inspired": "Apple-style minimal product hero, soft gradients, precision",
  "nike-inspired": "Nike energy, dynamic motion, bold athletic power",
  "porsche-inspired": "Porsche luxury automotive, precision engineering, dark elegance",
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

export function buildLayoutImagePrompt(options: {
  userPrompt: string;
  layoutId: LayoutId;
  style: StyleEngine;
  platform: PlatformPreset;
  params: GenerationParams;
  designTokens?: DesignTokens;
  references?: ReferenceImagePayload[];
}): string {
  const layout = LAYOUT_MAP[options.layoutId];
  const { userPrompt, style, platform, params, designTokens, references } =
    options;

  const refNote =
    references && references.length > 0
      ? `IMPORTANT — Use the ${Math.min(references.length, 4)} reference image(s) attached to this request for visual direction (mood, composition, subject, colors). Match them closely in the output.`
      : "";

  const brandNote = designTokens
    ? [
        designTokens.typography.primary &&
          `Typography feel: ${designTokens.typography.primary}`,
        designTokens.colors.accent &&
          `Accent color: ${designTokens.colors.accent}`,
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
    `Style direction: ${STYLE_HINTS[style]}.`,
    `Platform: ${PLATFORM_HINTS[platform]}.`,
    `Visual parameters — creativity ${params.creativity}%, typography strength ${params.typographyStrength}%, density ${params.visualDensity}%, motion energy ${params.motionEnergy}%, depth ${params.depthIntensity}%, contrast ${params.contrast}%, UI presence ${params.uiPresence}%.`,
    brandNote,
    refNote,
    "Output a single polished, production-ready marketing image. No text watermarks. No collage of multiple separate images.",
  ]
    .filter(Boolean)
    .join(" ");
}
