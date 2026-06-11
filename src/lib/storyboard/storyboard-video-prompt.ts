import { getFrameStyleLabel } from "@/lib/storyboard/frame-styles";
import {
  fitVoiceoverToSceneDuration,
  VIDEO_NARRATOR_WORDS_PER_SEC,
} from "@/lib/storyboard/voiceover-timing";
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
  referenceGuide?: string;
}): string {
  const { scenes, script, settings, continuity, videoDurationSec, batch, referenceGuide } =
    options;

  const orderedScenes = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const totalSceneDur = orderedScenes.reduce((sum, s) => sum + s.durationSec, 0);
  let timelineCursor = 0;

  const shotList = orderedScenes
    .map((scene) => {
      const share =
        totalSceneDur > 0
          ? Math.round((scene.durationSec / totalSceneDur) * 100)
          : Math.round(100 / orderedScenes.length);
      const startPct = Math.round((timelineCursor / Math.max(totalSceneDur, 1)) * 100);
      timelineCursor += scene.durationSec;
      const endPct = Math.min(
        100,
        Math.round((timelineCursor / Math.max(totalSceneDur, 1)) * 100)
      );
      const beat = [
        `Shot ${scene.sceneNumber} — MUST play at ${startPct}–${endPct}% of this clip (~${scene.durationSec}s, ${share}% of segment)`,
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
          firstScene
            ? `Within the first second, transition from the bridge into Shot ${firstScene.sceneNumber} (next reference) — do not replay or end on the bridge look.`
            : "",
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
    "SHOT LIST — strict chronological order; never reorder or save a shot for the end:",
    shotList,
    `VIDEO KEYFRAMES: ${referenceGuide ?? "first_frame = segment opening shot, last_frame = segment final shot."}`,
    `The last_frame is Shot ${lastScene?.sceneNumber} — the final frame of this clip MUST match that storyboard image. Never end on Shot ${firstScene?.sceneNumber} or any earlier shot.`,
    "Animate every shot in the shot list in ascending scene number between the opening and closing keyframes.",
    "Smooth motivated transitions only — match cuts, gentle dissolves, or continuous camera movement.",
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
  /** Actual clip length sent to the video API (seconds). */
  videoDurationSec: number;
}): string {
  const {
    scene,
    script,
    settings,
    continuity,
    totalScenes,
    hasEndFrame,
    videoDurationSec,
  } = options;

  const voiceoverLine = fitVoiceoverToSceneDuration(
    scene.voiceover,
    videoDurationSec,
    VIDEO_NARRATOR_WORDS_PER_SEC
  );

  const parts = [
    `Storyboard clip — scene ${scene.sceneNumber} of ${totalScenes}.`,
    `TIMELINE: This clip must be exactly ${videoDurationSec} seconds of continuous storyboard footage — fill the full duration; stay on the scene through the last frame.`,
    `Genre: ${settings.genre}.`,
    script.trim() ? `Script context: ${script.trim().slice(0, 400)}` : "",
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
    voiceoverLine
      ? `AUDIO — ENGLISH ONLY: Include soft cinematic background music and one English narrator. Speak this exact English line verbatim at a calm, natural pace — complete every word before the clip ends (do not translate, do not paraphrase, do not use any other language): "${voiceoverLine}"`
      : "AUDIO: Include soft cinematic background music only. No spoken dialogue.",
    "LANGUAGE: All narration must be English (en-US). Never use Hindi, Spanish, or any non-English speech.",
    "ENDING: End on live storyboard motion — no fade to black, no black frames, no blank screen, no title card, no logo hold at the end.",
    "Cinematic motion, natural pacing, no on-screen text or graphics.",
  ];

  return parts.filter(Boolean).join(" ");
}
