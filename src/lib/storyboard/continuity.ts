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
    "VISUAL CONTINUITY BIBLE — apply to this frame:",
    ...parts,
    "This frame must look like it belongs to the same storyboard sequence as all other frames.",
  ].join(" ");
}

/** Scene 01 anchor frame — same character look and sketch style for the whole board. */
export function getAnchorFrameUrl(
  scenes: StoryboardScene[],
  currentSceneId: string
): string | undefined {
  const anchor = scenes.find(
    (s) =>
      s.sceneNumber === 1 &&
      s.id !== currentSceneId &&
      s.frameStatus === "complete" &&
      s.frameImageUrl &&
      !s.frameImageUrl.startsWith("data:")
  );
  return anchor?.frameImageUrl;
}
