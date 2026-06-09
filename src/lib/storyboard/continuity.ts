import { getFrameStyleConfig } from "@/lib/storyboard/frame-styles";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

export function buildDefaultContinuity(
  settings: StoryboardProjectSettings
): StoryboardContinuity {
  return {
    characters:
      "Use the same character designs in every frame — identical face, hair, age, body type, clothing, and proportions. Do not redesign or recast characters between scenes.",
    locations: settings.sceneEnvironment?.trim()
      ? `Primary setting for the full storyboard: ${settings.sceneEnvironment.trim()}. Keep this environment visually consistent across every frame.`
      : "Keep recurring locations visually consistent — same architecture, layout, lighting direction, and spatial geography when scenes share a setting.",
    props:
      "Keep hero products, vehicles, and key props identical in shape, size, branding silhouette, and design across all frames.",
    sketchStyle: `${getFrameStyleConfig(settings.frameStyle).continuityHint} Genre: ${settings.genre.replace("-", " ")}.`,
  };
}

export function buildContinuityPromptBlock(
  continuity: StoryboardContinuity | null | undefined
): string {
  if (!continuity) return "";

  const parts = [
    continuity.characters?.trim() &&
      `CHARACTER CONTINUITY (mandatory): ${continuity.characters.trim()}`,
    continuity.locations?.trim() &&
      `LOCATION CONTINUITY (mandatory): ${continuity.locations.trim()}`,
    continuity.props?.trim() &&
      `PROP CONTINUITY (mandatory): ${continuity.props.trim()}`,
    continuity.sketchStyle?.trim() &&
      `STYLE CONTINUITY (mandatory): ${continuity.sketchStyle.trim()}`,
  ].filter(Boolean);

  if (!parts.length) return "";

  return [
    "VISUAL CONTINUITY BIBLE — highest priority, apply before anything else:",
    ...parts,
    "Characters must be instantly recognizable as the same people in every frame — same face structure, hair, skin tone, outfit, and body proportions.",
    "This frame must look like it belongs to the same storyboard sequence as all other frames.",
  ].join(" ");
}

function sceneHasFrame(scene: StoryboardScene): boolean {
  return Boolean(scene.frameImageUrl?.trim() || scene.frameStoragePath?.trim());
}

function isUsableReferenceScene(
  scene: StoryboardScene,
  currentSceneId: string
): boolean {
  return (
    scene.id !== currentSceneId &&
    scene.frameStatus === "complete" &&
    sceneHasFrame(scene)
  );
}

/** Scene 01 anchor frame — same character look and sketch style for the whole board. */
export function getAnchorScene(
  scenes: StoryboardScene[],
  currentSceneId: string
): StoryboardScene | undefined {
  return scenes.find(
    (s) =>
      s.sceneNumber === 1 && isUsableReferenceScene(s, currentSceneId)
  );
}

/**
 * Reference frames for scene 2+: Scene 1 anchor (character lock) + immediate
 * previous shot when available (reduces style drift on longer boards).
 */
export function getStoryboardReferenceScenes(
  scenes: StoryboardScene[],
  currentSceneId: string
): StoryboardScene[] {
  const current = scenes.find((s) => s.id === currentSceneId);
  if (!current || current.sceneNumber <= 1) return [];

  const refs: StoryboardScene[] = [];
  const anchor = getAnchorScene(scenes, currentSceneId);
  if (anchor) refs.push(anchor);

  if (current.sceneNumber > 2) {
    const previous = scenes.find(
      (s) =>
        s.sceneNumber === current.sceneNumber - 1 &&
        isUsableReferenceScene(s, currentSceneId)
    );
    if (previous && !refs.some((r) => r.id === previous.id)) {
      refs.push(previous);
    }
  }

  return refs;
}

/** @deprecated Prefer getStoryboardReferenceScenes + server-side URL resolution. */
export function getAnchorFrameUrl(
  scenes: StoryboardScene[],
  currentSceneId: string
): string | undefined {
  return getAnchorScene(scenes, currentSceneId)?.frameImageUrl;
}
