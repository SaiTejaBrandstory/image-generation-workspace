import { NO_SPEC_TEXT_IN_IMAGE } from "@/lib/color-for-prompt";
import { buildContinuityPromptBlock } from "@/lib/storyboard/continuity";
import {
  getFrameStyleConfig,
  normalizeFrameStyle,
} from "@/lib/storyboard/frame-styles";
import type { AspectRatio } from "@/types";
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
  referenceFrameUrls?: string[];
  referenceImages?: Array<{ url: string; label: string }>;
  /** User-defined names/roles for uploaded reference images. */
  inputReferencePromptBlock?: string;
  aspectRatio?: AspectRatio;
}

function storyboardAspectCanvasLabel(aspectRatio: AspectRatio): string {
  switch (aspectRatio) {
    case "16:9":
      return "16:9 widescreen";
    case "9:16":
      return "9:16 vertical";
    case "1:1":
      return "1:1 square";
    case "4:3":
      return "4:3";
    case "3:4":
      return "3:4 portrait";
    case "21:9":
      return "21:9 ultrawide";
    default:
      return aspectRatio;
  }
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
    ? [
        "CRITICAL — VISUAL CONSISTENCY:",
        "The attached reference image(s) are the ground truth for this storyboard.",
        "User-uploaded character, product, and environment references must be reproduced faithfully in every frame.",
        "Copy the EXACT same character faces, skin tone, hair, age, body type, clothing, accessories, products, and setting details from the references.",
        `Preserve the same ${styleConfig.referenceHint} across every frame.`,
        "Do NOT redesign, recast, or age-shift any character. Only change camera angle, framing, pose, and action for this new shot.",
      ].join(" ")
    : scene.sceneNumber > 1
      ? "Keep characters and visual style consistent with earlier frames in this same storyboard sequence — identical faces, costumes, and props."
      : [
          "CHARACTER LOCK — ESTABLISHING FRAME:",
          `Define the canonical character designs and ${styleConfig.label.toLowerCase()} look for this entire storyboard.`,
          "Every following frame must match these exact faces, costumes, props, and art style.",
        ].join(" ");

  const negativeConstraints =
    frameStyle === "sketch"
      ? `${UNIVERSAL_NEGATIVE_CONSTRAINTS} ${SKETCH_NEGATIVE_EXTRA}`
      : UNIVERSAL_NEGATIVE_CONSTRAINTS;

  return [
    continuityBlock,
    scene.inputReferencePromptBlock,
    referenceNote,
    styleConfig.promptBlock,
    negativeConstraints,
    STORYBOARD_NO_TEXT,
    `Draw this shot only (scene index ${scene.sceneNumber} for production reference — do not write this number in the image): ${shotDescription}.`,
    moodHint,
    `Full-bleed ${storyboardAspectCanvasLabel(scene.aspectRatio ?? "16:9")} storyboard frame — the image must fill the entire canvas edge-to-edge with no white borders or empty space. Pure visual content only.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export {
  resolveStoryboardImageModel,
  STORYBOARD_IMAGE_MODEL,
} from "@/lib/storyboard/storyboard-image";
