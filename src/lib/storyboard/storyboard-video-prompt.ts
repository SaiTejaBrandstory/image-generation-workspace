import { getFrameStyleLabel } from "@/lib/storyboard/frame-styles";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

export interface StoryboardVideoBatchContext {
  index: number;
  total: number;
  totalScenes?: number;
  hasBridgeFrame?: boolean;
  previousScene?: Pick<
    StoryboardScene,
    "sceneNumber" | "visualDescription" | "voiceover" | "transition"
  >;
}

export function buildStoryboardFullVideoPrompt(options: {
  scenes: StoryboardScene[];
  script: string;
  settings: StoryboardProjectSettings;
  continuity: StoryboardContinuity | null;
  videoDurationSec: number;
  batch?: StoryboardVideoBatchContext;
}): string {
  const { scenes, script, settings, continuity, videoDurationSec, batch } =
    options;

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

  const isMultiSegment = Boolean(batch && batch.total > 1);
  const firstScene = scenes[0];
  const lastScene = scenes[scenes.length - 1];
  const globalSceneCount = batch?.totalScenes ?? scenes.length;

  const batchLead =
    batch && batch.total > 1
      ? batch.index === 0
        ? `This is segment 1 of ${batch.total} in a ${globalSceneCount}-shot storyboard film. Generate ONE continuous ${videoDurationSec}-second clip covering shots ${firstScene?.sceneNumber}–${lastScene?.sceneNumber} — more footage will be crossfaded after. End smoothly on the closing reference frame; hold composition stable in the final half-second for a seamless edit.`
        : batch.index === batch.total - 1
          ? `This is the FINAL segment (${batch.index + 1} of ${batch.total}) of a ${globalSceneCount}-shot film. Shots ${firstScene?.sceneNumber}–${lastScene?.sceneNumber} must continue IMMEDIATELY from the previous segment with zero jump-cut feel.`
          : `This is segment ${batch.index + 1} of ${batch.total} in a ${globalSceneCount}-shot film. Shots ${firstScene?.sceneNumber}–${lastScene?.sceneNumber} continue directly from the previous segment.`
      : `Generate ONE continuous ${videoDurationSec}-second video that plays through ALL ${scenes.length} storyboard shots in order.`;

  const bridgeLead =
    batch?.hasBridgeFrame && batch.index > 0
      ? [
          "CONTINUITY LOCK — highest priority:",
          "The first attached reference is the EXACT last frame of the previous video segment.",
          "Open at t=0 matching that bridge frame precisely — same characters, wardrobe, lighting, camera angle, and motion carry-over.",
          batch.previousScene
            ? `Previous shot ${batch.previousScene.sceneNumber} ended with: ${batch.previousScene.visualDescription?.trim() || batch.previousScene.voiceover?.trim() || "the prior beat"}. Transition style: ${batch.previousScene.transition || "cut"}.`
            : "",
          "This must feel like one uninterrupted camera move and edit — not a new scene or new take.",
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  const audioLead = isMultiSegment
    ? "AUDIO: Include cinematic ambient music and sound design. Do NOT include spoken dialogue or narration — a single narrator voice is added in post-production."
    : "AUDIO: Include ambient music plus one consistent narrator voice. Match the voiceover text in the shot list.";

  return [
    batchLead,
    bridgeLead,
    audioLead,
    `Genre: ${settings.genre}.`,
    script.trim() ? `Script: ${script.trim().slice(0, 800)}` : "",
    continuity?.characters?.trim()
      ? `Characters (consistent throughout): ${continuity.characters.trim()}`
      : "",
    continuity?.locations?.trim()
      ? `Locations: ${continuity.locations.trim()}`
      : "",
    "SHOT LIST — every frame must appear in sequence with smooth transitions:",
    shotList,
    batch?.hasBridgeFrame
      ? "The bridge reference is the opening frame. The next storyboard reference is the target opening composition. The closing reference is the final shot."
      : "The attached opening reference image is shot 1. The closing reference is the final shot.",
    "Additional references guide middle beats. Animate through every listed shot in one uninterrupted edit with smooth motivated transitions — match cuts, gentle dissolves, or continuous camera movement only.",
    `Match storyboard ${getFrameStyleLabel(settings.frameStyle).toLowerCase()} character design and cinematic pacing. No on-screen text or graphics.`,
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
    `Genre: ${settings.genre}.`,
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
      ? `Animate from the opening storyboard frame toward the closing frame. Match ${getFrameStyleLabel(settings.frameStyle).toLowerCase()} style and character design.`
      : `Animate from the opening storyboard frame for this scene beat. Match ${getFrameStyleLabel(settings.frameStyle).toLowerCase()} style.`,
    "Cinematic motion, natural pacing, no on-screen text or graphics.",
  ];

  return parts.filter(Boolean).join(" ");
}
