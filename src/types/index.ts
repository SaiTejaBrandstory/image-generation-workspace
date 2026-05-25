export type LayoutId =
  | "single-hero"
  | "split-screen"
  | "z-pattern"
  | "f-pattern"
  | "central-focus"
  | "grid-modular"
  | "diagonal-dynamic"
  | "editorial-magazine"
  | "typography-dominant"
  | "floating-elements"
  | "framed-content"
  | "full-bleed"
  | "layered-depth"
  | "mobile-native"
  | "carousel-sequential"
  | "asymmetrical"
  | "radial"
  | "timeline"
  | "ui-showcase"
  | "collage-scrapbook";

export type ImageRole =
  | "style"
  | "composition"
  | "typography"
  | "product"
  | "ui"
  | "brand";

export type AspectRatio =
  | "auto"
  | "1:1"
  | "4:5"
  | "16:9"
  | "9:16"
  | "3:4"
  | "4:3";

export type PlatformPreset =
  | "instagram-post"
  | "instagram-portrait"
  | "story"
  | "facebook-ad"
  | "linkedin"
  | "youtube-thumbnail"
  | "pinterest"
  | "tiktok";

export type MediaType = "image" | "video";

/** Per-model values from OpenRouter (e.g. 16:9, 21:9, 4K) */
export type VideoAspectRatio = string;

export type VideoResolution = string;

export interface VideoMeta {
  duration?: number;
  resolution?: VideoResolution;
  aspectRatio?: VideoAspectRatio;
  generateAudio?: boolean;
  model?: string;
}

export type StyleEngine =
  | "luxury"
  | "tech"
  | "fashion"
  | "cyberpunk"
  | "minimal"
  | "brutalist"
  | "editorial"
  | "futuristic"
  | "product-ad"
  | "apple-inspired"
  | "nike-inspired"
  | "porsche-inspired";

export interface LayoutSystem {
  id: LayoutId;
  name: string;
  description: string;
  bestUse: string;
  principles: string[];
  gradient: string;
}

/** How uploaded images are used in generation */
export type ReferenceUsageMode = "inspire" | "preserve";

export interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  role: ImageRole;
  influence: number;
  locked: boolean;
  /** inspire = visual direction; preserve = exact asset in output */
  usageMode: ReferenceUsageMode;
}

/** Serialized reference sent to the API (base64 data URL) */
export interface ReferenceImagePayload {
  role: ImageRole;
  influence: number;
  dataUrl: string;
  usageMode: ReferenceUsageMode;
}

export interface GenerationParams {
  creativity: number;
  typographyStrength: number;
  visualDensity: number;
  motionEnergy: number;
  depthIntensity: number;
  contrast: number;
  uiPresence: number;
}

/** Placeholder layout id for video-only rows */
export const VIDEO_LAYOUT_ID = "single-hero" as LayoutId;

export interface LayoutVariant {
  id: string;
  layoutId: LayoutId;
  mediaType?: MediaType;
  videoUrl?: string;
  videoMeta?: VideoMeta;
  /** Raw creative brief from the user (composer or edit panel) */
  userPrompt?: string;
  /** Full augmented prompt stored for reference */
  prompt: string;
  imageUrl?: string;
  rationale: string;
  visualPsychology: string;
  bestUse: string;
  suggestedPlatform: string;
  principles: string[];
  influenceBreakdown?: Record<string, number>;
  status: "pending" | "generating" | "complete" | "error";
  errorMessage?: string;
  /** Batch index within a conversation (0 = first generate) */
  generationRound?: number;
  /** When this batch was started (ms epoch) */
  createdAt?: number;
  sortIndex?: number;
  /** Parent layout variant when this row is a variation */
  parentVariantId?: string;
  variantKind?: "layout" | "variation";
  /** 0–9 index under a parent (up to 10 variations) */
  variationIndex?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  referenceIds?: string[];
  generationId?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: number;
  updatedAt: number;
  conversationCount?: number;
}

export interface Conversation {
  id: string;
  title: string;
  /** Original user prompt (for history search) */
  prompt?: string;
  mediaType?: MediaType;
  messages: ChatMessage[];
  variants: LayoutVariant[];
  createdAt: number;
  updatedAt?: number;
  starred?: boolean;
  projectId?: string | null;
}

export interface DesignTokens {
  typography: {
    primary?: string;
    secondary?: string;
    scale?: string;
  };
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
  };
  composition: {
    preferredLayouts?: string[];
    negativeSpace?: string;
    alignment?: string;
  };
  motion: {
    style?: string;
    intensity?: string;
  };
  personality: string[];
}

export interface Brand {
  id: string;
  name: string;
  industry?: string;
  designTokens?: DesignTokens;
  designMdRaw?: string;
}

export interface GenerationState {
  isGenerating: boolean;
  progress: number;
}
