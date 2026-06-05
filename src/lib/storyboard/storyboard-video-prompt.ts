import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

export function buildStoryboardFullVideoPrompt(options: {
  scenes: StoryboardScene[];
  script: string;
  settings: StoryboardProjectSettings;
  continuity: StoryboardContinuity | null;
  videoDurationSec: number;
}): string {
  const { scenes, script, settings, continuity, videoDurationSec } = options;

  const shotList = scenes
    .map((scene) => {
      const beat = [
        `Shot ${scene.sceneNumber} (~${scene.durationSec}s)`,
        scene.visualDescription?.trim() || scene.voiceover?.trim(),
        scene.cameraDirection?.trim()
          ? `Camera: ${scene.cameraDirection.trim()}`
          : "",
        scene.cameraMovement?.trim()
          ? `Movement: ${scene.cameraMovement.trim()}`
          : "",
        scene.characterActions?.trim()
          ? `Action: ${scene.characterActions.trim()}`
          : "",
        scene.voiceover?.trim() ? `VO: ${scene.voiceover.trim()}` : "",
      ]
        .filter(Boolean)
        .join(". ");
      return beat;
    })
    .join("\n");

  return [
    `Generate ONE continuous ${videoDurationSec}-second video that plays through ALL ${scenes.length} storyboard shots in order.`,
    `Genre: ${settings.genre}. Mood: ${settings.mood}. Style: ${settings.visualStyle}. Platform: ${settings.platform}.`,
    script.trim() ? `Script: ${script.trim().slice(0, 800)}` : "",
    continuity?.characters?.trim()
      ? `Characters (consistent throughout): ${continuity.characters.trim()}`
      : "",
    continuity?.locations?.trim()
      ? `Locations: ${continuity.locations.trim()}`
      : "",
    "SHOT LIST — every frame must appear in sequence with smooth transitions:",
    shotList,
    "The attached opening reference image is shot 1. The closing reference is the final shot.",
    "Additional references guide middle beats. Animate through every listed shot in one uninterrupted edit.",
    "Match storyboard pencil-sketch character design and cinematic pacing. No on-screen text or graphics.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStoryboardClipPrompt(options: {
  scene: StoryboardScene;
  script: string;
  settings: StoryboardProjectSettings;
  continuity: StoryboardContinuity | null;
  sceneIndex: number;
  totalScenes: number;
  hasEndFrame: boolean;
}): string {
  const { scene, script, settings, continuity, sceneIndex, totalScenes, hasEndFrame } =
    options;

  const parts = [
    `Storyboard clip — scene ${scene.sceneNumber} of ${totalScenes}.`,
    `Genre: ${settings.genre}. Mood: ${settings.mood}. Style: ${settings.visualStyle}.`,
    script.trim() ? `Script context: ${script.trim().slice(0, 400)}` : "",
    scene.voiceover?.trim() ? `Voiceover: ${scene.voiceover.trim()}` : "",
    scene.visualDescription?.trim()
      ? `Visual: ${scene.visualDescription.trim()}`
      : "",
    scene.characterActions?.trim()
      ? `Action: ${scene.characterActions.trim()}`
      : "",
    scene.cameraDirection?.trim()
      ? `Shot: ${scene.cameraDirection.trim()}`
      : "",
    scene.cameraMovement?.trim()
      ? `Camera movement: ${scene.cameraMovement.trim()}`
      : "",
    continuity?.characters?.trim()
      ? `Characters: ${continuity.characters.trim()}`
      : "",
    hasEndFrame
      ? "Animate from the opening storyboard frame toward the closing frame. Match pencil sketch style and character design."
      : "Animate from the opening storyboard frame for this scene beat. Match pencil sketch style.",
    "Cinematic motion, natural pacing, no on-screen text or graphics.",
  ];

  return parts.filter(Boolean).join(" ");
}
