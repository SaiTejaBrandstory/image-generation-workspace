import type {
  AspectRatio,
  DesignElement,
  MediaType,
  PlatformPreset,
  StyleEngine,
} from "@/types";

/** Full list — used only as a fallback. UI uses getAspectRatiosForModel() instead. */
export const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "auto", label: "Auto — model default" },
  { value: "1:1", label: "1:1 — Square post" },
  { value: "4:5", label: "4:5 — Instagram post" },
  { value: "5:4", label: "5:4 — Landscape post" },
  { value: "16:9", label: "16:9 — YouTube / landscape" },
  { value: "9:16", label: "9:16 — Reel / Story / TikTok" },
  { value: "3:4", label: "3:4 — Portrait feed" },
  { value: "4:3", label: "4:3 — Classic photo" },
  { value: "2:3", label: "2:3 — Pinterest pin" },
  { value: "3:2", label: "3:2 — Photo landscape" },
  { value: "21:9", label: "21:9 — Ultrawide banner" },
  { value: "1:4", label: "1:4 — Tall banner" },
  { value: "4:1", label: "4:1 — Wide banner" },
  { value: "1:8", label: "1:8 — Vertical strip" },
  { value: "8:1", label: "8:1 — Panorama strip" },
];

export const PLATFORM_PRESETS: { value: PlatformPreset; label: string }[] = [
  { value: "instagram-post", label: "Instagram Post" },
  { value: "instagram-portrait", label: "Instagram Portrait" },
  { value: "story", label: "Story" },
  { value: "facebook-ad", label: "Facebook Ad" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube-thumbnail", label: "YouTube Thumbnail" },
  { value: "pinterest", label: "Pinterest" },
  { value: "tiktok", label: "TikTok" },
];

export const DESIGN_ELEMENTS: { value: DesignElement; label: string }[] = [
  { value: "none", label: "None" },
  { value: "geometric", label: "Geometric Design" },
  { value: "isometric", label: "Isometric Design" },
  { value: "minimal", label: "Minimal Design" },
  { value: "editorial-magazine", label: "Editorial / Magazine Design" },
  { value: "glassmorphism", label: "Glassmorphism Design" },
  { value: "brutalist", label: "Brutalist Design" },
  { value: "collage-scrapbook", label: "Collage / Scrapbook Design" },
  { value: "cyberpunk-futuristic", label: "Cyberpunk / Futuristic Design" },
  { value: "organic-fluid", label: "Organic / Fluid Design" },
  { value: "typography-centric", label: "Typography-Centric Design" },
];

export const STYLE_ENGINES: { value: StyleEngine; label: string }[] = [
  { value: "none", label: "None" },
  { value: "cinematic", label: "Cinematic Style" },
  { value: "creative-studio", label: "Creative Studio Style" },
  { value: "luxury-editorial", label: "Luxury Editorial Style" },
  { value: "minimal-modern", label: "Minimal Modern Style" },
  { value: "futuristic-tech", label: "Futuristic Tech Style" },
  { value: "ugc-social-native", label: "UGC / Social Native Style" },
  { value: "bold-commercial", label: "Bold Commercial Style" },
  { value: "experimental-artistic", label: "Experimental Artistic Style" },
];

export const IMAGE_ROLES = [
  { value: "style" as const, label: "Style Reference" },
  { value: "composition" as const, label: "Composition" },
  { value: "typography" as const, label: "Typography" },
  { value: "product" as const, label: "Product" },
  { value: "ui" as const, label: "UI Reference" },
  { value: "brand" as const, label: "Brand Identity" },
];

export const DEFAULT_PARAMS = {
  creativity: 65,
  typographyStrength: 50,
  visualDensity: 45,
  motionEnergy: 40,
  depthIntensity: 55,
  contrast: 60,
  uiPresence: 35,
};

export const SAMPLE_CONVERSATIONS = [
  { id: "1", title: "Porsche luxury watch ad", starred: true },
  { id: "2", title: "Nike performance campaign", starred: false },
  { id: "3", title: "SaaS dashboard launch", starred: false },
  { id: "4", title: "Editorial fashion drop", starred: true },
];

export const SAMPLE_DESIGN_MD = `# Typography
Primary Font: Maxima Nouva
Secondary Font: Satoshi

# Colors
Primary: #0B0B0B
Accent: #7C3AED

# Composition
Use asymmetrical layouts with strong negative space.

# Motion
Soft spring animations.

# Brand Personality
Luxury futuristic minimalism.`;

export const CHAT_EMPTY_STATE: Record<
  MediaType,
  { title: string; description: string; suggestions: string[] }
> = {
  image: {
    title: "What are we creating today?",
    description:
      "Describe your creative vision, attach reference images, and generate 20 professional layout systems in a single pass.",
    suggestions: [
      "Porsche-inspired luxury watch ad",
      "Nike energy sports campaign",
      "SaaS dashboard product launch",
    ],
  },
  video: {
    title: "What video are we making?",
    description:
      "Describe the scene and motion, add consistency references for avatar or location, and generate a short clip.",
    suggestions: [
      "Creator walks through neon Tokyo at night, cinematic mood, shallow depth of field",
      "Luxury watch hero on marble, slow orbit, soft studio lighting",
      "Athlete sprinting on a beach at golden hour, energetic camera tracking",
    ],
  },
};
