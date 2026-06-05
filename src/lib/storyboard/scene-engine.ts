import { CAMERA_ANGLES, CAMERA_MOVEMENTS, SHOT_TYPES } from "@/lib/storyboard/constants";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import {
  getTargetSceneCount,
  splitScriptIntoBeats,
} from "@/lib/storyboard/script-utils";
import type {
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

export function distributeDurations(totalSec: number, count: number): number[] {
  const base = Math.max(2, Math.floor(totalSec / count));
  const durations = Array.from({ length: count }, () => base);
  let remainder = totalSec - base * count;
  let i = 0;
  while (remainder > 0) {
    durations[i % count] += 1;
    remainder -= 1;
    i += 1;
  }
  return durations;
}

function buildImagePrompt(
  beat: string,
  settings: StoryboardProjectSettings,
  sceneNumber: number,
  camera: string
): string {
  return [
    `Single storyboard sketch panel for scene ${sceneNumber}.`,
    `Shot: ${beat}`,
    `Camera: ${camera}.`,
    `Setting tone: ${settings.mood || "neutral"} ${settings.genre.replace("-", " ")} production.`,
    "One simple hand-drawn pencil sketch of this single moment — not a collage or ad layout.",
  ].join(" ");
}

export function generateScenesFromScript(
  script: string,
  settings: StoryboardProjectSettings,
  targetScenes?: number
): StoryboardScene[] {
  const count = targetScenes ?? getTargetSceneCount(settings);
  const beats = splitScriptIntoBeats(script, count);
  const durations = distributeDurations(settings.durationSec, beats.length);

  return beats.map((beat, index) => {
    const shotType = SHOT_TYPES[index % SHOT_TYPES.length];
    const sceneNumber = index + 1;
    const camera = normalizeSceneFields({
      cameraDirection: shotType,
      cameraAngle: CAMERA_ANGLES[index % CAMERA_ANGLES.length],
      cameraMovement: CAMERA_MOVEMENTS[index % CAMERA_MOVEMENTS.length],
    });
    return {
      id: crypto.randomUUID(),
      sceneNumber,
      durationSec: durations[index] ?? 3,
      voiceover: beat,
      visualDescription: beat.replace(/^[^:]+:\s*/, "").trim() || beat.slice(0, 120),
      ...camera,
      characterActions: "Subject performs key action described in voiceover",
      environment: settings.genre === "real-estate"
        ? "Modern interior / architectural setting"
        : "Context-appropriate environment matching script tone",
      emotion: index === 0 ? "calm" : index === beats.length - 1 ? "hope" : "excitement",
      transition: index === 0 ? "fade" : "cut",
      imagePrompt: buildImagePrompt(beat, settings, sceneNumber, shotType),
      frameStatus: "pending" as const,
    };
  });
}

export function createEmptyScene(sceneNumber: number): StoryboardScene {
  return {
    id: crypto.randomUUID(),
    sceneNumber,
    durationSec: 3,
    voiceover: "",
    visualDescription: "",
    cameraDirection: SHOT_TYPES[0],
    cameraAngle: CAMERA_ANGLES[0],
    cameraMovement: CAMERA_MOVEMENTS[0],
    characterActions: "",
    environment: "",
    emotion: "neutral",
    transition: "cut",
    imagePrompt: "",
    frameStatus: "pending",
  };
}

export function renumberScenes(scenes: StoryboardScene[]): StoryboardScene[] {
  return scenes.map((scene, index) => ({
    ...scene,
    sceneNumber: index + 1,
  }));
}
