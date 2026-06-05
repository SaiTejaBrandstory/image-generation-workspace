export type StoryboardWizardStep = 1 | 2 | 3 | 4;

export type StoryboardGenre =
  | "commercial"
  | "cinematic"
  | "documentary"
  | "product-ad"
  | "explainer"
  | "corporate"
  | "social-ad"
  | "real-estate"
  | "fashion"
  | "sports"
  | "technology"
  | "healthcare"
  | "education";

export type StoryboardPlatform =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "tv"
  | "website";

export type StoryboardViewMode = "grid" | "filmstrip" | "presentation" | "timeline";

export type SceneTransition =
  | "cut"
  | "fade"
  | "dissolve"
  | "wipe"
  | "match-cut"
  | "jump-cut";

export type SceneEmotion =
  | "neutral"
  | "joy"
  | "tension"
  | "sadness"
  | "excitement"
  | "calm"
  | "urgency"
  | "hope";

export type FrameStatus = "pending" | "generating" | "complete" | "error";

export type StoryboardFrameCount = 4 | 6;

export interface StoryboardProjectSettings {
  genre: StoryboardGenre;
  durationSec: number;
  /** Number of storyboard keyframes to generate (4 or 6). */
  frameCount: StoryboardFrameCount;
  targetAudience: string;
  visualStyle: string;
  mood: string;
  brandTone: string;
  platform: StoryboardPlatform;
}

/** Locked visual bible — same characters, locations, and sketch style in every frame. */
export interface StoryboardContinuity {
  characters: string;
  locations: string;
  props: string;
  sketchStyle: string;
}

export interface StoryboardScene {
  id: string;
  sceneNumber: number;
  durationSec: number;
  voiceover: string;
  visualDescription: string;
  /** Shot type — wide, close-up, medium, etc. */
  cameraDirection: string;
  cameraAngle: string;
  cameraMovement: string;
  characterActions: string;
  environment: string;
  emotion: SceneEmotion;
  transition: SceneTransition;
  imagePrompt: string;
  frameImageUrl?: string;
  frameStoragePath?: string;
  frameStatus: FrameStatus;
  frameError?: string;
}

export interface StoryboardDraft {
  id: string;
  script: string;
  settings: StoryboardProjectSettings;
  continuity: StoryboardContinuity | null;
  scenes: StoryboardScene[];
  step: StoryboardWizardStep;
  updatedAt: number;
}
