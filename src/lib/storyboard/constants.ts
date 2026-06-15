import { XFADE_TRANSITIONS } from "@/lib/storyboard/xfade-transitions";
import type {
  SceneEmotion,
  SceneTransition,
  StoryboardGenre,
} from "@/types/storyboard";

export const STORYBOARD_GENRES: {
  id: StoryboardGenre;
  label: string;
  description: string;
}[] = [
  { id: "commercial", label: "Commercial", description: "Polished ads with bold product focus" },
  { id: "cinematic", label: "Cinematic", description: "Film-grade lighting and dramatic framing" },
  { id: "documentary", label: "Documentary", description: "Authentic, observational storytelling" },
  { id: "product-ad", label: "Product Ad", description: "Hero product shots and clean compositions" },
  { id: "explainer", label: "Explainer Video", description: "Clear visuals that support narration" },
  { id: "corporate", label: "Corporate Film", description: "Professional, trustworthy brand tone" },
  { id: "social-ad", label: "Social Media Ad", description: "Fast-paced, scroll-stopping hooks" },
  { id: "real-estate", label: "Real Estate", description: "Spacious interiors and lifestyle context" },
  { id: "fashion", label: "Fashion", description: "Editorial styling and movement" },
  { id: "sports", label: "Sports", description: "Dynamic action and energy" },
  { id: "technology", label: "Technology", description: "Sleek UI, innovation, futuristic mood" },
  { id: "healthcare", label: "Healthcare", description: "Warm, reassuring, human-centered" },
  { id: "education", label: "Education", description: "Friendly, clear instructional visuals" },
];

/** ~5 seconds per scene → 6 keyframes for a 30s spot */
export const STORYBOARD_SEC_PER_SCENE = 5;
export const STORYBOARD_DEFAULT_SCENE_COUNT = 6;

export const STORYBOARD_FRAME_COUNTS = [4, 6, 8, 10, 12, 15, 18, 21] as const;

export const DURATION_PRESETS = [
  { label: "15 Seconds", sec: 15 },
  { label: "30 Seconds", sec: 30 },
  { label: "45 Seconds", sec: 45 },
  { label: "60 Seconds", sec: 60 },
  { label: "90 Seconds", sec: 90 },
  { label: "120 Seconds", sec: 120 },
] as const;

export const SHOT_TYPES = [
  "Wide Shot",
  "Close Up",
  "Medium Shot",
  "Extreme Close Up",
  "Over-the-Shoulder",
  "POV Shot",
  "Establishing Shot",
  "Insert Shot",
] as const;

/** @deprecated Use SHOT_TYPES — kept for existing scene data */
export const CAMERA_DIRECTIONS = [
  ...SHOT_TYPES,
  "Tracking Shot",
  "Drone Shot",
  "Low Angle",
  "High Angle",
  "Dolly In",
] as const;

export const CAMERA_ANGLES = [
  "Eye Level",
  "Low Angle",
  "High Angle",
  "Bird's Eye",
  "Worm's Eye",
  "Dutch Angle",
  "Overhead",
] as const;

export const CAMERA_MOVEMENTS = [
  "Static",
  "Pan Left",
  "Pan Right",
  "Tilt Up",
  "Tilt Down",
  "Dolly In",
  "Dolly Out",
  "Tracking",
  "Crane",
  "Handheld",
  "Drone",
  "Zoom In",
  "Zoom Out",
] as const;

export const SCENE_EMOTIONS: { id: SceneEmotion; label: string }[] = [
  { id: "neutral", label: "Neutral" },
  { id: "joy", label: "Joy" },
  { id: "tension", label: "Tension" },
  { id: "sadness", label: "Sadness" },
  { id: "excitement", label: "Excitement" },
  { id: "calm", label: "Calm" },
  { id: "urgency", label: "Urgency" },
  { id: "hope", label: "Hope" },
];

export const SCENE_TRANSITIONS: { id: SceneTransition; label: string }[] =
  XFADE_TRANSITIONS.map((item) => ({
    id: item.id as SceneTransition,
    label: item.label,
  }));

export const GENRE_STYLE_HINTS: Record<StoryboardGenre, string> = {
  commercial: "high-contrast commercial lighting, premium product staging",
  cinematic: "anamorphic film look, shallow depth of field, dramatic contrast",
  documentary: "natural light, handheld realism, authentic environments",
  "product-ad": "clean studio lighting, minimal background, product hero framing",
  explainer: "bright friendly palette, clear focal hierarchy, instructional clarity",
  corporate: "balanced corporate palette, confident professional tone",
  "social-ad": "vertical-friendly framing, punchy color, fast visual hooks",
  "real-estate": "wide architectural shots, warm lifestyle staging",
  fashion: "editorial fashion lighting, textured backgrounds, model movement",
  sports: "dynamic motion blur accents, energetic color grading",
  technology: "cool tones, sleek surfaces, futuristic UI accents",
  healthcare: "soft warm light, empathetic human moments",
  education: "approachable colors, clear visual metaphors, readable composition",
};

export const WIZARD_STEPS = [
  { step: 1 as const, label: "Script" },
  { step: 2 as const, label: "Settings" },
  { step: 3 as const, label: "Scenes" },
  { step: 4 as const, label: "Storyboard" },
];
