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

export interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  role: ImageRole;
  influence: number;
  locked: boolean;
}

/** Serialized reference sent to the API (base64 data URL) */
export interface ReferenceImagePayload {
  role: ImageRole;
  influence: number;
  dataUrl: string;
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

export interface LayoutVariant {
  id: string;
  layoutId: LayoutId;
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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  referenceIds?: string[];
  generationId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  /** Original user prompt (for history search) */
  prompt?: string;
  messages: ChatMessage[];
  variants: LayoutVariant[];
  createdAt: number;
  starred?: boolean;
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
