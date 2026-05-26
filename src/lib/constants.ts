import type { AspectRatio, MediaType, PlatformPreset, StyleEngine } from "@/types";

export const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
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

export const STYLE_ENGINES: { value: StyleEngine; label: string }[] = [
  { value: "luxury", label: "Luxury" },
  { value: "tech", label: "Tech" },
  { value: "fashion", label: "Fashion" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "minimal", label: "Minimal" },
  { value: "brutalist", label: "Brutalist" },
  { value: "editorial", label: "Editorial" },
  { value: "futuristic", label: "Futuristic" },
  { value: "product-ad", label: "Product Ad" },
  { value: "apple-inspired", label: "Apple Inspired" },
  { value: "nike-inspired", label: "Nike Inspired" },
  { value: "porsche-inspired", label: "Porsche Inspired" },
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
