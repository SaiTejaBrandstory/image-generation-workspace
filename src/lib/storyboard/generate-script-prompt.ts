import { DURATION_PRESETS, STORYBOARD_GENRES } from "@/lib/storyboard/constants";

const SCRIPT_CONCEPTS = [
  "a luxury electric vehicle driving through a neon city at night",
  "a plant-based meal kit brand celebrating a family dinner",
  "a fintech app that helps freelancers get paid faster",
  "a sustainable fashion line shot in a desert at golden hour",
  "a fitness wearable motivating an early-morning runner",
  "a travel booking app reuniting old friends abroad",
  "a craft brewery opening its first taproom",
  "a skincare serum with a science-meets-nature story",
  "a children's educational toy that sparks curiosity",
  "a smart home security system protecting a young family",
  "a nonprofit clean-water initiative in a rural village",
  "a premium headphones brand in a subway commute montage",
  "a wedding venue showcasing an outdoor ceremony",
  "a productivity tool for remote design teams",
  "a pet adoption campaign with an emotional rescue story",
  "a luxury hotel welcoming guests at sunrise",
  "a sports drink fueling an underdog basketball team",
  "a vintage camera brand rediscovering analog photography",
  "a climate-tech startup planting urban forests",
  "a gourmet chocolate gift for the holidays",
] as const;

const SCRIPT_MOODS = [
  "cinematic and emotional",
  "fast-paced and energetic",
  "warm and documentary-style",
  "sleek and futuristic",
  "playful and colorful",
  "minimal and premium",
  "gritty and authentic",
  "hopeful and uplifting",
] as const;

const SCRIPT_HOOKS = [
  "Open with a surprising visual hook in the first three seconds.",
  "Start on a close-up detail before revealing the wider scene.",
  "Begin with a quiet moment that builds into high energy.",
  "Open mid-action, then rewind to show how we got here.",
  "Start with a question the audience can feel immediately.",
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export interface RandomScriptBrief {
  genre: string;
  durationSec: number;
  concept: string;
  mood: string;
  hook: string;
  seed: string;
}

export function buildRandomScriptBrief(): RandomScriptBrief {
  const genre = pickRandom(STORYBOARD_GENRES);
  const duration = pickRandom(DURATION_PRESETS);
  return {
    genre: genre.label,
    durationSec: duration.sec,
    concept: pickRandom(SCRIPT_CONCEPTS),
    mood: pickRandom(SCRIPT_MOODS),
    hook: pickRandom(SCRIPT_HOOKS),
    seed: crypto.randomUUID(),
  };
}

export function buildGenerateScriptSystemPrompt(): string {
  return [
    "You are a creative director writing a short video brief for step 1 of a storyboard tool.",
    "Return ONLY the brief text — no titles, labels, markdown, scene numbers, or meta commentary.",
    "Write 2–4 sentences in plain prose, like a creative direction note.",
    "Describe the overall idea, setting, story arc, and ending mood in broad strokes.",
    "Do NOT write scene breakdowns, shot lists, camera directions, timestamps, or voiceover dialogue.",
    "Do NOT label scenes (Scene 1, Shot 2, etc.) — those are generated in later steps.",
    "Do NOT mention runtime or duration (no '30-second', '45s', etc.) — duration is set separately in project settings.",
    "Match this format and length:",
    '"Running shoe commercial. Athlete sprints through rainy city streets at night. Close-ups on shoes hitting wet pavement. Ends on a rooftop at sunrise, energetic and cinematic."',
    "Make it specific, filmable, and distinct every time.",
  ].join(" ");
}

export function buildGenerateScriptUserPrompt(brief: RandomScriptBrief): string {
  return [
    `Write a brand-new ${brief.genre.toLowerCase()} video brief (do not mention seconds or runtime).`,
    `Core concept: ${brief.concept}.`,
    `Mood: ${brief.mood}.`,
    `Opening idea: ${brief.hook}`,
    `Creative seed (for uniqueness): ${brief.seed}`,
    "Output only the brief paragraph — not scenes, not voiceover script.",
  ].join("\n");
}
