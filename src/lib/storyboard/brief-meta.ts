import type { StoryboardScene } from "@/types/storyboard";

/** Leading duration + format labels users often put in step-1 briefs. */
const BRIEF_META_PREFIX =
  /^(?:a\s+)?\d+[\s-]*(?:second|sec|s)\s+(?:[\w'-]+\s+){0,8}?(?:ad|ads|commercial|explainer|spot|video|film|story|campaign|promo|trailer)\b(?:\s+for\s+(?:a|an|the)\s+[\w\s'-]+)?[.,\s]*/i;

const BRIEF_META_SENTENCE =
  /^(?:a\s+)?\d+[\s-]*(?:second|sec|s)\b.*(?:ad|commercial|explainer|spot|video|film|campaign)\b/i;

const OPENING_BOILERPLATE = /^we\s+open\s+with\s+/i;

/** Remove duration/format preamble from a creative brief or scene field. */
export function stripBriefMeta(text: string): string {
  let t = text.trim();
  if (!t) return t;

  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(BRIEF_META_PREFIX, "").trim();
  }

  return t;
}

export function isBriefMetaSentence(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return BRIEF_META_SENTENCE.test(t);
}

/** Drop meta-only sentences; keep narrative beats from a brief. */
export function extractNarrativeSentences(script: string): string[] {
  return script
    .split(/(?<=[.!?])\s+/)
    .map((s) => stripBriefMeta(s.trim()))
    .filter((s) => s.length > 0 && !isBriefMetaSentence(s));
}

export function stripOpeningBoilerplate(text: string): string {
  return text.replace(OPENING_BOILERPLATE, "").trim();
}

function cleanSceneText(text: string, sceneNumber: number): string {
  let t = stripBriefMeta(text);
  if (sceneNumber > 1) {
    t = stripOpeningBoilerplate(t);
  }
  return t.trim();
}

/** Remove brief meta copied into per-scene voiceover / visual fields. */
export function sanitizeSceneContent(
  scene: StoryboardScene,
  sceneNumber = scene.sceneNumber
): StoryboardScene {
  const voiceover = cleanSceneText(scene.voiceover, sceneNumber);
  const visualDescription = cleanSceneText(scene.visualDescription, sceneNumber);
  const imagePrompt = stripBriefMeta(scene.imagePrompt);
  const characterActions = stripBriefMeta(scene.characterActions);

  return {
    ...scene,
    voiceover: voiceover || scene.voiceover.trim(),
    visualDescription: visualDescription || scene.visualDescription.trim(),
    imagePrompt: imagePrompt || scene.imagePrompt.trim(),
    characterActions: characterActions || scene.characterActions.trim(),
  };
}

export function sanitizeScenes(scenes: StoryboardScene[]): StoryboardScene[] {
  return scenes.map((scene) => sanitizeSceneContent(scene, scene.sceneNumber));
}
