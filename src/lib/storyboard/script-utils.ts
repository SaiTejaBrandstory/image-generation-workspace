import {
  extractNarrativeSentences,
  stripBriefMeta,
} from "@/lib/storyboard/brief-meta";
import {
  STORYBOARD_DEFAULT_SCENE_COUNT,
  STORYBOARD_FRAME_COUNTS,
  STORYBOARD_SEC_PER_SCENE,
} from "@/lib/storyboard/constants";
import type {
  StoryboardFrameCount,
  StoryboardProjectSettings,
} from "@/types/storyboard";

export function scenesForDuration(durationSec: number): number {
  return Math.max(
    3,
    Math.min(12, Math.round(durationSec / STORYBOARD_SEC_PER_SCENE))
  );
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function estimateSceneCount(text: string, durationSec: number): number {
  const fromDuration = scenesForDuration(durationSec);
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    return Math.max(fromDuration, Math.min(12, paragraphs.length));
  }
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 8);
  const fromSentences = Math.max(1, Math.min(12, Math.ceil(sentences.length / 2)));
  return Math.max(fromDuration, fromSentences);
}

/** Target keyframe count when duration is unset or for display defaults. */
export function defaultSceneCount(durationSec?: number): number {
  if (!durationSec) return STORYBOARD_DEFAULT_SCENE_COUNT;
  return scenesForDuration(durationSec);
}

export function normalizeFrameCount(
  value: number | undefined
): StoryboardFrameCount {
  if (value !== undefined && isStoryboardFrameCount(value)) return value;
  if (value !== undefined) {
    return STORYBOARD_FRAME_COUNTS.reduce((closest, count) =>
      Math.abs(count - value) < Math.abs(closest - value) ? count : closest
    );
  }
  return 6;
}

/** User-selected frame count from project settings. */
export function getTargetSceneCount(settings: StoryboardProjectSettings): number {
  return normalizeFrameCount(settings.frameCount);
}

export function isStoryboardFrameCount(
  value: number
): value is StoryboardFrameCount {
  return (STORYBOARD_FRAME_COUNTS as readonly number[]).includes(value);
}

export function detectScriptLanguage(text: string): string {
  if (!text.trim()) return "—";
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/[\u4E00-\u9FFF]/.test(text)) return "Chinese";
  if (/[\u3040-\u30FF]/.test(text)) return "Japanese";
  if (/[\uAC00-\uD7AF]/.test(text)) return "Korean";

  const words = Math.max(1, countWords(text));
  const frenchHits = (text.match(/[àâäéèêëïîôùûüç]/gi) ?? []).length;
  const spanishHits = (text.match(/[áíóúñ¿¡]/gi) ?? []).length;
  if (frenchHits >= 3 || frenchHits / words > 0.12) return "French";
  if (spanishHits >= 3 || spanishHits / words > 0.12) return "Spanish";

  return "English";
}

export function splitScriptIntoBeats(script: string, targetScenes: number): string[] {
  const narrative = stripBriefMeta(script);
  const paragraphs = narrative
    .split(/\n\s*\n/)
    .map((p) => stripBriefMeta(p.trim()))
    .filter(Boolean);
  if (paragraphs.length >= targetScenes) {
    return paragraphs.slice(0, targetScenes);
  }
  const sentences = extractNarrativeSentences(narrative);
  if (sentences.length === 0) {
    const fallback = narrative.trim() || stripBriefMeta(script).trim();
    return fallback ? [fallback] : ["Opening scene"];
  }
  const perBeat = Math.max(1, Math.ceil(sentences.length / targetScenes));
  const beats: string[] = [];
  for (let i = 0; i < sentences.length; i += perBeat) {
    beats.push(sentences.slice(i, i + perBeat).join(" "));
    if (beats.length >= targetScenes) break;
  }
  if (beats.length < targetScenes) {
    const words = script.trim().split(/\s+/).filter(Boolean);
    if (words.length >= targetScenes) {
      const perChunk = Math.max(1, Math.ceil(words.length / targetScenes));
      const chunked: string[] = [];
      for (let i = 0; i < targetScenes; i++) {
        const chunk = words
          .slice(i * perChunk, i * perChunk + perChunk)
          .join(" ");
        if (chunk) chunked.push(chunk);
      }
      if (chunked.length >= targetScenes) return chunked.slice(0, targetScenes);
    }

    const labels = [
      "Opening hook",
      "Subject in action",
      "Detail close-up",
      "Energy build",
      "Story peak",
      "Resolution",
      "Closing hero shot",
      "Final brand moment",
    ];
    const storySnippet = stripBriefMeta(script).slice(0, 120);
    while (beats.length < targetScenes) {
      const i = beats.length;
      const label = labels[i % labels.length];
      beats.push(storySnippet ? `${label}: ${storySnippet}` : label);
    }
  }

  return beats.slice(0, targetScenes);
}
