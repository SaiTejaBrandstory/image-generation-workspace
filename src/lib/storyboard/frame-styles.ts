import type { StoryboardFrameStyle } from "@/types/storyboard";

export const STORYBOARD_FRAME_STYLES: {
  id: StoryboardFrameStyle;
  label: string;
  description: string;
  promptBlock: string;
  continuityHint: string;
  breakdownHint: string;
  referenceHint: string;
}[] = [
  {
    id: "sketch",
    label: "Pencil sketch",
    description: "Hand-drawn storyboard sketch — default production look",
    promptBlock: [
      "Traditional hand-drawn film storyboard sketch.",
      "Pencil or charcoal drawing that fills the entire panel edge-to-edge.",
      "Loose graphite lines, light shading, simple shapes, production storyboard aesthetic.",
      "Black and white or light grey sketch only — not a finished illustration.",
    ].join(" "),
    continuityHint:
      "Maintain one consistent pencil storyboard style — same line weight, shading density, and sketch detail level.",
    breakdownHint: "ONE single pencil storyboard sketch shot",
    referenceHint: "pencil sketch technique",
  },
  {
    id: "cinematic",
    label: "Cinematic still",
    description: "Film-like frame with dramatic lighting and depth",
    promptBlock: [
      "Cinematic film still storyboard frame.",
      "Dramatic lighting, shallow depth of field, widescreen composition.",
      "Muted color grading, professional camera framing, live-action movie aesthetic.",
      "Production storyboard frame — not a poster or marketing composite.",
    ].join(" "),
    continuityHint:
      "Maintain consistent cinematic color grade, lens character, and lighting style across every frame.",
    breakdownHint: "ONE single cinematic film-still storyboard frame",
    referenceHint: "cinematic look and color grade",
  },
  {
    id: "illustrated",
    label: "Illustrated",
    description: "Color illustration with painterly storyboard feel",
    promptBlock: [
      "Color illustrated storyboard frame.",
      "Painterly digital illustration with clear shapes and readable silhouettes.",
      "Soft shading, production storyboard clarity, not hyper-realistic.",
      "Vibrant but controlled palette suited to advertising or animation pre-vis.",
    ].join(" "),
    continuityHint:
      "Maintain the same illustration technique, line quality, and color palette across all frames.",
    breakdownHint: "ONE single color illustrated storyboard frame",
    referenceHint: "illustration style and palette",
  },
  {
    id: "photorealistic",
    label: "Photorealistic",
    description: "Realistic pre-visualization frame",
    promptBlock: [
      "Photorealistic storyboard frame.",
      "Looks like a high-quality film still or commercial pre-vis frame.",
      "Realistic materials, natural lighting, believable human proportions.",
      "Single captured moment — not a collage or graphic layout.",
    ].join(" "),
    continuityHint:
      "Maintain consistent photorealistic rendering, lighting direction, and camera realism across frames.",
    breakdownHint: "ONE single photorealistic storyboard frame",
    referenceHint: "photorealistic rendering style",
  },
  {
    id: "anime",
    label: "Anime",
    description: "Anime / manga-inspired storyboard frames",
    promptBlock: [
      "Anime-style storyboard frame.",
      "Clean linework, expressive poses, cel-shaded or soft-anime coloring.",
      "Japanese animation pre-visualization aesthetic.",
      "Dynamic composition with readable character silhouettes.",
    ].join(" "),
    continuityHint:
      "Maintain the same anime art style, line weight, and shading approach in every frame.",
    breakdownHint: "ONE single anime-style storyboard frame",
    referenceHint: "anime art style",
  },
  {
    id: "comic",
    label: "Comic book",
    description: "Bold inked comic panel storyboard",
    promptBlock: [
      "Comic book panel storyboard frame.",
      "Bold ink outlines, strong contrast, graphic novel aesthetic.",
      "Single panel composition with clear action read.",
      "Stylized shading — not photorealistic.",
    ].join(" "),
    continuityHint:
      "Maintain consistent comic inking style, contrast, and panel aesthetic across frames.",
    breakdownHint: "ONE single comic-book panel storyboard frame",
    referenceHint: "comic inking style",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    description: "Soft painted washes with storyboard clarity",
    promptBlock: [
      "Watercolor storyboard frame.",
      "Soft translucent washes, paper texture, loose brush edges.",
      "Readable silhouettes with gentle color bleeding and light pigment layering.",
      "Artistic pre-vis look — not a tight digital illustration.",
    ].join(" "),
    continuityHint:
      "Maintain the same watercolor technique, paper tone, and wash density across all frames.",
    breakdownHint: "ONE single watercolor-painted storyboard frame",
    referenceHint: "watercolor painting technique",
  },
  {
    id: "cgi",
    label: "3D CGI",
    description: "CG pre-vis with depth, lighting, and materials",
    promptBlock: [
      "3D CGI storyboard frame.",
      "Computer-generated pre-visualization with believable lighting and depth.",
      "Clean geometry, realistic materials, cinematic camera framing.",
      "Production VFX pre-vis aesthetic — not a UI render or product turntable.",
    ].join(" "),
    continuityHint:
      "Maintain consistent 3D rendering quality, lighting rig, and material style in every frame.",
    breakdownHint: "ONE single 3D CGI storyboard frame",
    referenceHint: "3D CGI rendering style",
  },
  {
    id: "noir",
    label: "Film noir",
    description: "High-contrast black and white with dramatic shadows",
    promptBlock: [
      "Film noir storyboard frame.",
      "High-contrast black and white, deep shadows, venetian-blind lighting.",
      "Moody crime-drama or classic Hollywood noir composition.",
      "Strong silhouettes and dramatic chiaroscuro — not color photography.",
    ].join(" "),
    continuityHint:
      "Maintain consistent noir contrast, shadow patterns, and monochrome tonal range across frames.",
    breakdownHint: "ONE single film-noir black-and-white storyboard frame",
    referenceHint: "film noir lighting and contrast",
  },
  {
    id: "minimalist",
    label: "Minimalist",
    description: "Clean flat shapes and limited palette",
    promptBlock: [
      "Minimalist storyboard frame.",
      "Simple flat shapes, limited color palette, generous negative space.",
      "Clear graphic composition with strong readability.",
      "Modern brand or explainer pre-vis — not cluttered or photorealistic.",
    ].join(" "),
    continuityHint:
      "Maintain the same minimalist shape language, flat color palette, and composition style across frames.",
    breakdownHint: "ONE single minimalist flat-design storyboard frame",
    referenceHint: "minimalist flat design style",
  },
  {
    id: "vintage",
    label: "Vintage film",
    description: "Retro grain, faded tones, analog film look",
    promptBlock: [
      "Vintage film storyboard frame.",
      "Analog film aesthetic with subtle grain, faded color, and soft halation.",
      "1970s–1990s commercial or documentary photography feel.",
      "Nostalgic cinematic mood — not modern digital sharpness.",
    ].join(" "),
    continuityHint:
      "Maintain consistent vintage film grain, faded color grade, and retro lens character across frames.",
    breakdownHint: "ONE single vintage film-look storyboard frame",
    referenceHint: "vintage film grain and color grade",
  },
  {
    id: "pixel-art",
    label: "Pixel art",
    description: "Retro game-inspired pixel storyboard frames",
    promptBlock: [
      "Pixel art storyboard frame.",
      "Retro 16-bit or 32-bit game aesthetic with crisp pixel clusters.",
      "Limited palette, readable character sprites, side-scroller or RPG mood.",
      "Stylized game pre-vis — not high-resolution illustration.",
    ].join(" "),
    continuityHint:
      "Maintain the same pixel density, palette, and sprite style in every frame.",
    breakdownHint: "ONE single pixel-art storyboard frame",
    referenceHint: "pixel art style and palette",
  },
];

const FRAME_STYLE_MAP = Object.fromEntries(
  STORYBOARD_FRAME_STYLES.map((s) => [s.id, s])
) as Record<StoryboardFrameStyle, (typeof STORYBOARD_FRAME_STYLES)[number]>;

export function normalizeFrameStyle(
  value: string | undefined
): StoryboardFrameStyle {
  if (value && value in FRAME_STYLE_MAP) {
    return value as StoryboardFrameStyle;
  }
  return "sketch";
}

export function getFrameStyleConfig(style: StoryboardFrameStyle) {
  return FRAME_STYLE_MAP[style] ?? FRAME_STYLE_MAP.sketch;
}

export function getFrameStylePromptBlock(style: StoryboardFrameStyle): string {
  return getFrameStyleConfig(style).promptBlock;
}

export function getFrameStyleLabel(style: StoryboardFrameStyle): string {
  return getFrameStyleConfig(style).label;
}
