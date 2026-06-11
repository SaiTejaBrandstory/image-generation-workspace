import { distributeDurations } from "@/lib/storyboard/scene-engine";
import type { StoryboardScene } from "@/types/storyboard";

/** Conservative narrator pace (~132 wpm) so TTS fits each scene slot without speeding up. */
export const NARRATOR_WORDS_PER_SEC = 2.2;

/** Slower pace for native video-model narration (~105 wpm) — models read deliberately. */
export const VIDEO_NARRATOR_WORDS_PER_SEC = 1.75;

export function maxWordsForDuration(
  durationSec: number,
  wordsPerSec = NARRATOR_WORDS_PER_SEC
): number {
  return Math.max(3, Math.floor(durationSec * wordsPerSec));
}

/** Minimum clip length so a voiceover line can finish at natural video-model pace. */
export function minDurationSecForVoiceover(
  text: string,
  wordsPerSec = VIDEO_NARRATOR_WORDS_PER_SEC
): number {
  const words = countWords(text);
  if (words <= 0) return 0;
  return Math.ceil(words / wordsPerSec);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Trim voiceover to a word budget for the scene duration.
 * Prefers full sentences; never returns empty when input had text.
 */
export function fitVoiceoverToSceneDuration(
  text: string,
  durationSec: number,
  wordsPerSec = NARRATOR_WORDS_PER_SEC
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const maxWords = maxWordsForDuration(durationSec, wordsPerSec);
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;

  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [trimmed];
  const kept: string[] = [];
  let used = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean);
    if (!sentenceWords.length) continue;
    if (used + sentenceWords.length <= maxWords) {
      kept.push(sentence.trim());
      used += sentenceWords.length;
    } else if (!kept.length) {
      return sentenceWords.slice(0, maxWords).join(" ");
    } else {
      break;
    }
  }

  if (kept.length) return kept.join(" ").trim();
  return words.slice(0, maxWords).join(" ");
}

/** Per-scene duration + word budget for LLM breakdown prompts. */
export function sceneVoiceoverBudgets(
  sceneCount: number,
  totalDurationSec: number
): { sceneNumber: number; durationSec: number; maxWords: number }[] {
  const durations = distributeDurations(totalDurationSec, sceneCount);
  return durations.map((durationSec, index) => ({
    sceneNumber: index + 1,
    durationSec,
    maxWords: maxWordsForDuration(durationSec),
  }));
}

export function formatVoiceoverBudgetPrompt(
  sceneCount: number,
  totalDurationSec: number
): string {
  const budgets = sceneVoiceoverBudgets(sceneCount, totalDurationSec);
  return budgets
    .map(
      (b) =>
        `Scene ${b.sceneNumber}: ${b.durationSec}s slot — voiceover max ${b.maxWords} words (~${NARRATOR_WORDS_PER_SEC} words/sec at natural pace)`
    )
    .join("\n");
}

/** Lock scene durations to the project timeline and trim voiceover to each slot. */
export function normalizeScenesToTimeline(
  scenes: StoryboardScene[],
  totalDurationSec: number
): StoryboardScene[] {
  if (!scenes.length) return scenes;

  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const durations = distributeDurations(totalDurationSec, ordered.length);

  return ordered.map((scene, index) => {
    const durationSec = durations[index] ?? scene.durationSec;
    const voiceover = fitVoiceoverToSceneDuration(
      scene.voiceover,
      durationSec
    );
    return {
      ...scene,
      sceneNumber: index + 1,
      durationSec,
      voiceover,
      visualDescription:
        scene.visualDescription?.trim() || voiceover || scene.visualDescription,
    };
  });
}

/** Scale scene slots when actual video length differs from planned storyboard total. */
export function scaleScenesToVideoDuration(
  scenes: StoryboardScene[],
  videoDurationSec: number
): StoryboardScene[] {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const planned = ordered.reduce((sum, s) => sum + s.durationSec, 0);
  if (planned <= 0 || Math.abs(planned - videoDurationSec) < 0.25) {
    return normalizeScenesToTimeline(ordered, videoDurationSec);
  }

  const ratio = videoDurationSec / planned;
  const scaled = ordered.map((scene) => {
    const durationSec = Math.max(1.5, scene.durationSec * ratio);
    const voiceover = fitVoiceoverToSceneDuration(scene.voiceover, durationSec);
    return { ...scene, durationSec, voiceover };
  });

  const scaledTotal = scaled.reduce((sum, s) => sum + s.durationSec, 0);
  if (Math.abs(scaledTotal - videoDurationSec) > 0.5) {
    return normalizeScenesToTimeline(scaled, videoDurationSec);
  }
  return scaled.map((scene, index) => ({
    ...scene,
    sceneNumber: index + 1,
  }));
}
