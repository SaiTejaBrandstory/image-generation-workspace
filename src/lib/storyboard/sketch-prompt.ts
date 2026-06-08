import { NO_SPEC_TEXT_IN_IMAGE } from "@/lib/color-for-prompt";
import { buildContinuityPromptBlock } from "@/lib/storyboard/continuity";
import {
  getFrameStyleConfig,
  normalizeFrameStyle,
} from "@/lib/storyboard/frame-styles";
import type {
  StoryboardContinuity,
  StoryboardFrameStyle,
  StoryboardGenre,
} from "@/types/storyboard";

/** Strip labels that models often render as visible text in the image. */
function sanitizeShotText(text: string): string {
  return text
    .replace(/\bscene\s*#?\s*\d+\b/gi, "")
    .replace(/\bshot\s*#?\s*\d+\b/gi, "")
    .replace(/\bframe\s*#?\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const STORYBOARD_NO_TEXT = [
  "CRITICAL: The image must contain ZERO visible text of any kind.",
  "No scene numbers, shot labels, captions, titles, watermarks, logos, or typography.",
  "No words like Scene 1, Shot 2, Frame 3, or any written labels anywhere in the drawing.",
  NO_SPEC_TEXT_IN_IMAGE,
].join(" ");

export interface StoryboardSketchSceneInput {
  sceneNumber: number;
  visualDescription: string;
  cameraDirection: string;
  characterActions?: string;
  environment?: string;
  imagePrompt?: string;
  genre?: StoryboardGenre;
  frameStyle?: StoryboardFrameStyle;
  visualStyle?: string;
  continuity?: StoryboardContinuity | null;
  hasReferenceFrame?: boolean;
  referenceFrameUrl?: string;
}

const UNIVERSAL_NEGATIVE_CONSTRAINTS = [
  "Exactly ONE storyboard panel — a single frame, one shot, one moment in time.",
  "Do NOT create multiple panels, split screens, grids, collages, or comic strips.",
  "Do NOT add text, labels, captions, titles, logos, watermarks, or typography.",
  "Do NOT add UI elements, timelines, arrows, step markers, infographics, or diagrams.",
  "Do NOT show feature callouts, journey flows, or marketing layout graphics.",
  "Do NOT leave empty white margins, borders, letterboxing, or unused canvas around the image.",
].join(" ");

const SKETCH_NEGATIVE_EXTRA =
  "Do NOT create photorealistic renders, 3D product shots, or advertising composites.";

export function buildStoryboardSketchPrompt(
  scene: StoryboardSketchSceneInput
): string {
  const frameStyle = normalizeFrameStyle(scene.frameStyle);
  const styleConfig = getFrameStyleConfig(frameStyle);

  const shotParts = [
    scene.imagePrompt?.trim(),
    scene.visualDescription?.trim(),
    scene.characterActions?.trim()
      ? `Action: ${sanitizeShotText(scene.characterActions)}`
      : "",
    scene.environment?.trim()
      ? `Setting: ${sanitizeShotText(scene.environment)}`
      : "",
    scene.cameraDirection?.trim()
      ? `Camera: ${sanitizeShotText(scene.cameraDirection)}`
      : "",
  ]
    .map((part) => sanitizeShotText(part ?? ""))
    .filter(Boolean);

  const shotDescription =
    shotParts.join(". ") ||
    `A single storyboard moment for a ${scene.genre ?? "commercial"} production.`;

  const moodHint = scene.visualStyle?.trim()
    ? `Mood reference only (do not add text): ${scene.visualStyle.trim()}.`
    : "";

  const continuityBlock = buildContinuityPromptBlock(scene.continuity);
  const referenceNote = scene.hasReferenceFrame
    ? `Match the attached reference frame exactly for character appearance, costume, props, and ${styleConfig.referenceHint}. Only change camera angle, composition, and action for this new shot.`
    : scene.sceneNumber > 1
      ? "Keep characters and visual style consistent with earlier frames in this same storyboard sequence."
      : `This is the establishing frame — define the character designs and ${styleConfig.label.toLowerCase()} look that all following frames will match.`;

  const negativeConstraints =
    frameStyle === "sketch"
      ? `${UNIVERSAL_NEGATIVE_CONSTRAINTS} ${SKETCH_NEGATIVE_EXTRA}`
      : UNIVERSAL_NEGATIVE_CONSTRAINTS;

  return [
    styleConfig.promptBlock,
    negativeConstraints,
    STORYBOARD_NO_TEXT,
    continuityBlock,
    referenceNote,
    `Draw this shot only (scene index ${scene.sceneNumber} for production reference — do not write this number in the image): ${shotDescription}.`,
    moodHint,
    "Full-bleed 16:9 widescreen storyboard frame — the image must fill the entire canvas edge-to-edge with no white borders or empty space. Pure visual content only.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Storyboard sketch frames always use Gemini 3 Pro Image. */
export const STORYBOARD_IMAGE_MODEL = "google/gemini-3-pro-image-preview";

export function resolveStoryboardImageModel(): string {
  return STORYBOARD_IMAGE_MODEL;
}
