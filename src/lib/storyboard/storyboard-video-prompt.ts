import {
  bookendShotPromptLine,
  isBookendScene,
  isClosingBookend,
  isOpeningBookend,
} from "@/lib/storyboard/bookend-scenes";
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
      const bookendLine = bookendShotPromptLine(scene, scene.durationSec);
      if (bookendLine) {
        timelineCursor += scene.durationSec;
        return bookendLine;
      }

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
        voiceoverEnabled && scene.voiceover?.trim()
          ? `VO: ${scene.voiceover.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join(". ");
      return beat;
    })
    .join("\n");

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

  const voiceoverEnabled = settings.enableVoiceover !== false;

  // Story scenes (non-bookend) — used to determine first/last for cinematic open/close.
  const storyScenes = orderedScenes.filter((s) => !isBookendScene(s));
  const firstStoryScene = storyScenes[0];
  const lastStoryScene = storyScenes[storyScenes.length - 1];

  const audioLead = voiceoverEnabled
    ? "AUDIO — ENGLISH ONLY: Include soft cinematic background music and one consistent English narrator. Speak every voiceover (VO) line in the shot list verbatim at a calm, natural pace — complete each line before its scene ends. Never use non-English speech."
    : "AUDIO: Soft cinematic background music throughout. NO spoken narration or dialogue in any shot — music and ambient sound only.";

  // Always inject open/close cinematic directives on the first and last story shots
  // regardless of whether bookend scenes exist. This replaces the old bookend-scene approach.
  const hasBookends = orderedScenes.some((scene) => isBookendScene(scene));
  const cinematicLead = hasBookends
    ? // Legacy: explicit bookend scenes still in storyboard — use their own prompt lines
      [
        isOpeningBookend(orderedScenes[0]!)
          ? "OPEN: Opening intro shot — motivated camera, full brightness. Editorial fade-in is post only."
          : "",
        isClosingBookend(orderedScenes[orderedScenes.length - 1]!)
          ? "CLOSE: Closing outro shot — script-appropriate resolution, distinct from the final scene. Editorial fade-out is post only."
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : // New default: directives live on the first and last story shots themselves
      [
        firstStoryScene
          ? `OPEN: Shot ${firstStoryScene.sceneNumber} opens this commercial — fade up from black into the action. Slow, motivated camera push toward the subject. Cinematic, no abrupt start.`
          : "",
        lastStoryScene
          ? `CLOSE: Shot ${lastStoryScene.sceneNumber} ends this commercial — character settles into a confident, composed hero pose. Product naturally visible. Slow fade to black in the final second. No abrupt cut.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

  return [
    batchLead,
    bridgeLead,
    cinematicLead,
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
  /** True when this is the first story scene — clip should open with a fade from black. */
  isFirstStoryScene?: boolean;
  /** True when this is the last story scene — clip should close with a hero hold then fade to black. */
  isLastStoryScene?: boolean;
  /** True when a closing bookend follows — last story scene should NOT fade to black. */
  hasClosingBookend?: boolean;
  /** True when an opening bookend precedes — first story scene should NOT fade from black. */
  hasOpeningBookend?: boolean;
}): string {
  const {
    scene,
    script,
    settings,
    continuity,
    totalScenes,
    hasEndFrame,
    videoDurationSec,
    isFirstStoryScene = false,
    isLastStoryScene = false,
    hasClosingBookend = false,
    hasOpeningBookend = false,
  } = options;

  const isBookend = isBookendScene(scene);
  const voiceoverEnabled = settings.enableVoiceover !== false;
  const voiceoverLine =
    voiceoverEnabled && !isBookend && scene.voiceover?.trim()
      ? fitVoiceoverToSceneDuration(
          scene.voiceover,
          videoDurationSec,
          VIDEO_NARRATOR_WORDS_PER_SEC
        )
      : "";

  // Backward-compat: explicit bookend scenes (legacy storyboards) still get their own prompt.
  const bookendLine = bookendShotPromptLine(scene, videoDurationSec);

  // BEGIN directive — opening feel on the first story scene
  const beginDirective = isBookend
    ? "" // handled by bookendLine
    : isFirstStoryScene && hasOpeningBookend
      ? `BEGIN: Continue directly from the opening establishing shot — the story action begins here. Motivated camera push into the main beat. Clean cut-in, no fade from black (the opening bookend already handled the intro).`
      : isFirstStoryScene
        ? `BEGIN: Open the clip by fading up smoothly from black. The scene is already in progress — the character is mid-arrival or mid-setup. Slow, motivated camera push toward the subject. No abrupt cut, no title card, no logo. This is the first shot of the commercial.`
        : "";

  // ENDING directive — mid-scene cuts are clean; last scene fades to black
  const endingDirective = isBookend
    ? "" // handled by bookendLine
    : isLastStoryScene && hasClosingBookend
      ? `ENDING: Deliver the story climax — confident hero beat, product visible, emotional peak. End on live motion settling into a stable composition. Clean editorial cut — NO fade to black (the closing epilogue handles the outro).`
      : isLastStoryScene
        ? `ENDING: In the final second the character settles into a confident, composed pose — hero/product clearly visible. Slow, controlled fade to black. No abrupt cut. This is the final frame of the commercial.`
        : `ENDING: Settle the action into a brief stable composition in the final half-second — clean editorial cut point. No fade to black, no black frame, no title card.`;

  const parts = [
    bookendLine ||
      `Storyboard clip — scene ${scene.sceneNumber} of ${totalScenes}. This clip is ONE shot inside a longer continuous film: keep one consistent cinematic color grade, lighting style, and lens feel so it cuts cleanly with the scenes before and after.`,
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
    isBookend
      ? `Animate THIS bookend frame with motivated cinematic camera motion (${scene.cameraMovement?.trim() || "slow drift or push"}). Match ${getFrameStyleLabel(settings.frameStyle).toLowerCase()} style.`
      : hasEndFrame
        ? `Animate from the opening storyboard frame toward the closing frame. Match ${getFrameStyleLabel(settings.frameStyle).toLowerCase()} style and character design.`
        : `Animate from the opening storyboard frame for this scene beat. Match ${getFrameStyleLabel(settings.frameStyle).toLowerCase()} style.`,
    isBookend || !voiceoverEnabled
      ? "AUDIO: Soft cinematic background music only — no spoken narration or dialogue."
      : voiceoverLine
        ? `AUDIO — ENGLISH ONLY: Include soft cinematic background music and one English narrator. Speak this exact English line verbatim at a calm, natural pace — complete every word before the clip ends (do not translate, do not paraphrase, do not use any other language): "${voiceoverLine}"`
        : "AUDIO: Include soft cinematic background music only. No spoken dialogue.",
    "LANGUAGE: All narration must be English (en-US). Never use Hindi, Spanish, or any non-English speech.",
    beginDirective,
    endingDirective,
    "Cinematic motion, natural pacing, no on-screen text or graphics.",
  ];

  return parts.filter(Boolean).join(" ");
}
