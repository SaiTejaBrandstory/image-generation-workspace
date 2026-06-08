import { stripBriefMeta } from "@/lib/storyboard/brief-meta";
import {
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  SHOT_TYPES,
} from "@/lib/storyboard/constants";
import { getFrameStyleConfig } from "@/lib/storyboard/frame-styles";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import { distributeDurations } from "@/lib/storyboard/scene-engine";
import type {
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

/** Distinct story beats when a short brief must expand to more keyframes. */
const NARRATIVE_BEAT_LABELS = [
  "Opening hook — establish setting and grab attention",
  "Rising action — introduce subject or product in motion",
  "Detail moment — close focus on hero element",
  "Energy build — dynamic action or environment shift",
  "Emotional peak — climax of the story beat",
  "Resolution — payoff, reveal, or brand moment",
  "Closing frame — memorable final image",
  "Epilogue — subtle outro or logo-ready hero shot",
] as const;

function buildUniqueBeat(
  script: string,
  sceneIndex: number,
  totalScenes: number
): string {
  const label =
    NARRATIVE_BEAT_LABELS[sceneIndex % NARRATIVE_BEAT_LABELS.length];
  const snippet = stripBriefMeta(script).slice(0, 140);
  return snippet
    ? `${label}. ${snippet}`
    : `${label} for scene ${sceneIndex + 1} of ${totalScenes}`;
}

function buildVisualDescription(beat: string, sceneNumber: number): string {
  return stripBriefMeta(beat).trim() || `Moment ${sceneNumber}`;
}

function createSceneFromBeat(
  beat: string,
  sceneNumber: number,
  durationSec: number,
  settings: StoryboardProjectSettings
): StoryboardScene {
  const index = sceneNumber - 1;
  const shotType = SHOT_TYPES[index % SHOT_TYPES.length];
  const camera = normalizeSceneFields({
    cameraDirection: shotType,
    cameraAngle: CAMERA_ANGLES[index % CAMERA_ANGLES.length],
    cameraMovement: CAMERA_MOVEMENTS[index % CAMERA_MOVEMENTS.length],
  });
  const visual = buildVisualDescription(beat, sceneNumber);

  return {
    id: crypto.randomUUID(),
    sceneNumber,
    durationSec,
    voiceover: beat,
    visualDescription: visual,
    ...camera,
    characterActions: `Distinct action for scene ${sceneNumber} — advance the story, do not repeat prior shots`,
    environment:
      settings.sceneEnvironment?.trim() ||
      "Context-appropriate environment matching script tone",
    emotion: index === 0 ? "calm" : "excitement",
    transition: index === 0 ? "fade" : "cut",
    imagePrompt: [
      `Storyboard frame for scene ${sceneNumber}.`,
      `Shot: ${visual}`,
      `Camera: ${shotType}.`,
      `Genre: ${settings.genre.replace("-", " ")}.`,
      `${getFrameStyleConfig(settings.frameStyle).breakdownHint} — different composition from other scenes.`,
    ].join(" "),
    frameStatus: "pending",
  };
}

export function padScenesToTarget(
  scenes: StoryboardScene[],
  script: string,
  settings: StoryboardProjectSettings,
  targetScenes: number
): StoryboardScene[] {
  if (scenes.length >= targetScenes) {
    return scenes.slice(0, targetScenes).map((s, i) => ({
      ...s,
      sceneNumber: i + 1,
    }));
  }

  const durations = distributeDurations(settings.durationSec, targetScenes);
  const result = [...scenes];

  while (result.length < targetScenes) {
    const index = result.length;
    const beat = buildUniqueBeat(script, index, targetScenes);
    result.push(
      createSceneFromBeat(beat, index + 1, durations[index] ?? 5, settings)
    );
  }

  return result.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
}

/** Replace duplicate voiceover/visual rows so each keyframe tells a different beat. */
export function dedupeSceneContent(
  scenes: StoryboardScene[],
  script: string,
  settings: StoryboardProjectSettings
): StoryboardScene[] {
  const seen = new Set<string>();

  return scenes.map((scene, index) => {
    const key = scene.voiceover.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      return scene;
    }

    const beat = buildUniqueBeat(script, index, scenes.length);
    return {
      ...scene,
      voiceover: beat,
      visualDescription: buildVisualDescription(beat, index + 1),
      characterActions: `Unique action for scene ${index + 1}`,
      imagePrompt: [
        scene.imagePrompt.split(".")[0] || "Storyboard frame",
        `Distinct scene ${index + 1} — ${buildVisualDescription(beat, index + 1)}`,
        "Different camera and action from previous scenes.",
      ].join(". "),
      frameImageUrl: undefined,
      frameStatus: "pending" as const,
    };
  });
}
