import { stripBriefMeta } from "@/lib/storyboard/brief-meta";
import { getFrameStyleConfig } from "@/lib/storyboard/frame-styles";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import {
  renumberScenes,
  STORYBOARD_CLOSING_BOOKEND_SCENE_NUMBER,
  STORYBOARD_OPENING_BOOKEND_SCENE_NUMBER,
} from "@/lib/storyboard/scene-engine";
import type {
  StoryboardProjectSettings,
  StoryboardScene,
  StoryboardSceneRole,
} from "@/types/storyboard";

/** Extra cinematic open/close at start/end (not counted in frameCount). */
export const STORYBOARD_BOOKEND_DURATION_SEC = 2;

export function isBookendScene(scene: StoryboardScene): boolean {
  return (
    scene.sceneRole === "bookend-open" ||
    scene.sceneRole === "bookend-close" ||
    scene.sceneNumber === STORYBOARD_OPENING_BOOKEND_SCENE_NUMBER ||
    scene.sceneNumber === STORYBOARD_CLOSING_BOOKEND_SCENE_NUMBER
  );
}

export function isOpeningBookend(scene: StoryboardScene): boolean {
  return (
    scene.sceneRole === "bookend-open" ||
    scene.sceneNumber === STORYBOARD_OPENING_BOOKEND_SCENE_NUMBER
  );
}

export function isClosingBookend(scene: StoryboardScene): boolean {
  return (
    scene.sceneRole === "bookend-close" ||
    scene.sceneNumber === STORYBOARD_CLOSING_BOOKEND_SCENE_NUMBER
  );
}

export function stripBookendScenes(scenes: StoryboardScene[]): StoryboardScene[] {
  return scenes.filter((scene) => !isBookendScene(scene));
}

export function getStoryScenes(scenes: StoryboardScene[]): StoryboardScene[] {
  return stripBookendScenes(scenes).sort(
    (a, b) => a.sceneNumber - b.sceneNumber
  );
}

export function getFirstStoryScene(
  scenes: StoryboardScene[]
): StoryboardScene | undefined {
  return getStoryScenes(scenes)[0];
}

export function getLastStoryScene(
  scenes: StoryboardScene[]
): StoryboardScene | undefined {
  const story = getStoryScenes(scenes);
  return story[story.length - 1];
}

export function formatStoryboardSceneLabel(
  scene: StoryboardScene,
  allScenes?: StoryboardScene[]
): string {
  if (isOpeningBookend(scene)) return "Opening";
  if (isClosingBookend(scene)) return "Closing";
  if (allScenes) {
    const storyScenes = getStoryScenes(allScenes);
    const storyIndex = storyScenes.findIndex((s) => s.id === scene.id);
    if (storyIndex >= 0) {
      return `Scene ${String(storyIndex + 1).padStart(2, "0")}`;
    }
  }
  return `Scene ${String(scene.sceneNumber).padStart(2, "0")}`;
}

export type BookendSceneFields = Pick<
  StoryboardScene,
  | "visualDescription"
  | "imagePrompt"
  | "cameraDirection"
  | "cameraAngle"
  | "cameraMovement"
  | "characterActions"
  | "environment"
  | "emotion"
  | "transition"
>;

function scriptExcerpt(script: string, max = 280): string {
  return stripBriefMeta(script)
    .replace(/[*#_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Parse LLM-authored opening/closing shot from breakdown JSON. */
export function parseBookendSceneFields(
  raw: unknown
): Partial<BookendSceneFields> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const item = raw as Record<string, unknown>;
  const visualDescription = String(item.visualDescription ?? "").trim();
  const imagePrompt = String(item.imagePrompt ?? visualDescription).trim();
  if (!visualDescription && !imagePrompt) return undefined;

  const camera = normalizeSceneFields({
    cameraDirection: String(item.cameraDirection ?? item.shotType ?? "Wide Shot"),
    cameraAngle: String(item.cameraAngle ?? "Eye Level"),
    cameraMovement: String(item.cameraMovement ?? ""),
  });

  return {
    visualDescription: visualDescription || imagePrompt,
    imagePrompt: imagePrompt || visualDescription,
    ...camera,
    characterActions: String(
      item.characterActions ??
        (item.cameraMovement ? "" : "Subtle motivated motion only")
    ),
    environment: String(item.environment ?? ""),
    emotion: (item.emotion as StoryboardScene["emotion"]) ?? "calm",
    transition: (item.transition as StoryboardScene["transition"]) ?? "fade",
  };
}

/**
 * Programmatic fallback when the LLM did not author bookend fields.
 * Soft guidance only — framing is chosen to feel continuous with the adjacent scene.
 */
function deriveBookendFromAdjacentScene(
  role: StoryboardSceneRole,
  adjacent: StoryboardScene,
  settings: StoryboardProjectSettings,
  script: string
): StoryboardScene {
  const styleHint = getFrameStyleConfig(settings.frameStyle).breakdownHint;
  const isOpening = role === "bookend-open";
  const excerpt = scriptExcerpt(script, 200);

  const environment =
    adjacent.environment?.trim() ||
    settings.sceneEnvironment?.trim() ||
    adjacent.visualDescription?.trim().slice(0, 100) ||
    "the story location";

  const sceneBeat =
    adjacent.visualDescription?.trim().slice(0, 160) || environment;

  const openingVisualDescription = [
    "Opening cinematic intro — smooth lead-in before Scene 1.",
    excerpt ? `Story: ${excerpt}.` : "",
    `Same story world as Scene 1 (${environment}).`,
    "Choose a natural intro composition — character, product, or environment as the script demands.",
  ]
    .filter(Boolean)
    .join(" ");

  const openingImagePrompt = [
    "OPENING FRAME — cinematic intro before Scene 1.",
    excerpt ? `Script: ${excerpt}.` : "",
    `Same world as Scene 1: ${environment}. Scene 1 context: ${sceneBeat}.`,
    "Compose a DISTINCT intro shot that flows into Scene 1 — same characters, wardrobe, and world, different framing than Scene 1.",
    "Pick what fits the script: long shot with character approaching, environmental establishing, product tease, arrival beat, etc.",
    "Full brightness — normal exposure. NO black frame, NO dark vignette, NO fade effect in the image.",
    `${styleHint}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const closingVisualDescription = [
    "Closing cinematic outro — smooth lead-out after the final scene.",
    excerpt ? `Story: ${excerpt}.` : "",
    `Same story world as the final scene (${environment}).`,
    "Choose a natural outro composition — NOT a duplicate of the final scene.",
  ]
    .filter(Boolean)
    .join(" ");

  const closingImagePrompt = [
    "CLOSING FRAME — cinematic outro after the final story beat.",
    excerpt ? `Script: ${excerpt}.` : "",
    `Same world as the final scene: ${environment}. Final beat context: ${sceneBeat}.`,
    "Compose a DISTINCT outro shot — same characters/products/world, different framing than the final scene.",
    "Pick what fits the script: wider pullback with character, product hero, environmental exhale, departure beat, etc.",
    "The final scene already delivered the climax — this shot resolves and breathes out.",
    "Full brightness — normal exposure. NO black frame, NO dark vignette, NO fade effect in the image.",
    `${styleHint}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const base = {
    id: crypto.randomUUID(),
    sceneRole: role,
    sceneNumber: 0,
    durationSec: STORYBOARD_BOOKEND_DURATION_SEC,
    voiceover: "",
    transition: "fade" as const,
    frameStatus: "pending" as const,
    frameImageUrl: undefined,
    frameStoragePath: undefined,
    frameError: undefined,
    sceneVideoUrl: undefined,
    sceneVideoStoragePath: undefined,
    sceneVideoStatus: undefined,
    sceneVideoError: undefined,
    sceneVideoModel: undefined,
  };

  if (isOpening) {
    return {
      ...adjacent,
      ...base,
      cameraDirection: adjacent.cameraDirection || "Wide Shot",
      cameraAngle: adjacent.cameraAngle ?? "Eye Level",
      cameraMovement: adjacent.cameraMovement || "Slow Push In",
      characterActions:
        adjacent.characterActions?.trim() ||
        "Intro beat — character or story world before the main action",
      environment,
      emotion: (adjacent.emotion ?? "calm") as StoryboardScene["emotion"],
      visualDescription: openingVisualDescription,
      imagePrompt: openingImagePrompt,
    };
  }

  return {
    ...adjacent,
    ...base,
    cameraDirection: adjacent.cameraDirection || "Wide Shot",
    cameraAngle: adjacent.cameraAngle ?? "Eye Level",
    cameraMovement: "Slow Pull Back",
    characterActions:
      "Outro beat — story resolved, continuous with the final scene",
    environment,
    emotion: "calm" as const,
    visualDescription: closingVisualDescription,
    imagePrompt: closingImagePrompt,
  };
}

/**
 * Fallback used only when no adjacent story scene exists yet.
 * Prefers deriveBookendFromAdjacentScene when the adjacent scene is available.
 */
function createScriptFallbackBookend(
  role: StoryboardSceneRole,
  settings: StoryboardProjectSettings,
  script: string
): StoryboardScene {
  const styleHint = getFrameStyleConfig(settings.frameStyle).breakdownHint;
  const excerpt = scriptExcerpt(script, 200);
  const environment = settings.sceneEnvironment?.trim() || "Environment from script";
  const isOpening = role === "bookend-open";

  return {
    id: crypto.randomUUID(),
    sceneRole: role,
    sceneNumber: 0,
    durationSec: STORYBOARD_BOOKEND_DURATION_SEC,
    voiceover: "",
    visualDescription: isOpening
      ? `Opening intro — ${excerpt}. Cinematic lead-in before the story begins.`
      : `Closing outro — ${excerpt}. Cinematic lead-out after the story ends.`,
    cameraDirection: "Wide Shot",
    cameraAngle: "Eye Level",
    cameraMovement: isOpening ? "Slow Push In" : "Slow Pull Back",
    characterActions: isOpening
      ? "Intro beat before the main story action"
      : "Outro beat after the story resolves",
    environment,
    emotion: "calm",
    transition: "fade",
    imagePrompt: [
      isOpening
        ? "Opening cinematic intro — script-appropriate lead-in, continuous with Scene 1. Full brightness, no vignette."
        : "Closing cinematic outro — script-appropriate resolution, distinct from the final scene. Full brightness, no vignette.",
      excerpt,
      `${styleHint}.`,
    ]
      .filter(Boolean)
      .join(" "),
    frameStatus: "pending",
  };
}

function mergeBookendFields(
  base: StoryboardScene,
  llmFields?: Partial<BookendSceneFields> | null
): StoryboardScene {
  if (!llmFields) return base;

  const camera = normalizeSceneFields({
    cameraDirection: llmFields.cameraDirection ?? base.cameraDirection,
    cameraAngle: llmFields.cameraAngle ?? base.cameraAngle,
    cameraMovement: llmFields.cameraMovement ?? base.cameraMovement,
  });

  return {
    ...base,
    ...camera,
    visualDescription:
      llmFields.visualDescription?.trim() || base.visualDescription,
    imagePrompt: llmFields.imagePrompt?.trim() || base.imagePrompt,
    characterActions:
      llmFields.characterActions?.trim() || base.characterActions,
    environment: llmFields.environment?.trim() || base.environment,
    emotion: llmFields.emotion ?? base.emotion,
    transition: llmFields.transition ?? base.transition,
  };
}

function buildBookendScene(
  role: StoryboardSceneRole,
  settings: StoryboardProjectSettings,
  script: string,
  llmFields?: Partial<BookendSceneFields> | null,
  adjacentStory?: StoryboardScene
): StoryboardScene {
  const base = adjacentStory
    ? deriveBookendFromAdjacentScene(role, adjacentStory, settings, script)
    : createScriptFallbackBookend(role, settings, script);

  return mergeBookendFields(base, llmFields);
}

export interface InjectBookendScenesOptions {
  script?: string;
  openingBookend?: Partial<BookendSceneFields> | null;
  closingBookend?: Partial<BookendSceneFields> | null;
}

/** Add opening + closing bookend shots (extra, beyond frameCount). */
export function injectBookendScenes(
  scenes: StoryboardScene[],
  settings: StoryboardProjectSettings,
  options?: InjectBookendScenesOptions
): StoryboardScene[] {
  const story = stripBookendScenes(scenes);
  if (!story.length) return scenes;

  const script = options?.script ?? "";
  const opening = buildBookendScene(
    "bookend-open",
    settings,
    script,
    options?.openingBookend,
    story[0]
  );
  const closing = buildBookendScene(
    "bookend-close",
    settings,
    script,
    options?.closingBookend,
    story[story.length - 1]
  );

  return renumberScenes([opening, ...story, closing]);
}

/** Backfill bookends for storyboards saved before this feature. */
export function ensureBookendScenes(
  scenes: StoryboardScene[],
  settings: StoryboardProjectSettings,
  script?: string
): StoryboardScene[] {
  const hasOpen = scenes.some((s) => s.sceneRole === "bookend-open");
  const hasClose = scenes.some((s) => s.sceneRole === "bookend-close");
  if (!stripBookendScenes(scenes).length) return scenes;
  if (hasOpen && hasClose) return renumberScenes(scenes);
  return injectBookendScenes(scenes, settings, { script });
}

export function bookendShotPromptLine(
  scene: StoryboardScene,
  durationSec: number
): string {
  const visual = scene.visualDescription?.trim() || scene.imagePrompt?.trim();
  const cameraLabel = [
    scene.cameraDirection?.trim(),
    scene.cameraAngle?.trim(),
    scene.cameraMovement?.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  if (isOpeningBookend(scene)) {
    return [
      `OPENING INTRO (${durationSec}s) — cinematic lead-in before Scene 1.`,
      visual,
      "Animate this frame with motivated, natural camera motion that flows into the story.",
      cameraLabel ? `Camera: ${cameraLabel}.` : "",
      "Full brightness throughout — do NOT animate fade from black or dark vignette; editorial fades are added in post.",
      "Ambient cinematic score only — NO spoken narration or dialogue.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (isClosingBookend(scene)) {
    return [
      `CLOSING OUTRO (${durationSec}s) — cinematic lead-out after the final scene.`,
      visual,
      "Animate this frame with motivated, natural camera motion — story resolved, continuous with the final beat.",
      cameraLabel ? `Camera: ${cameraLabel}.` : "",
      "NOT a repeat of the final scene. Full brightness throughout — do NOT animate fade to black; editorial fades are added in post.",
      "Ambient cinematic score only — NO spoken narration or dialogue.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "";
}
