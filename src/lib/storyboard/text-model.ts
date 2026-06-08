/** Default text model for storyboard LLM calls (breakdown, environment infer). */
export const STORYBOARD_TEXT_MODEL_DEFAULT = "google/gemini-2.5-flash";

const STORYBOARD_TEXT_MODEL_FALLBACKS = [
  "google/gemini-2.5-flash",
  "google/gemini-flash-1.5",
  "openai/gpt-4o-mini",
] as const;

export function getStoryboardTextModels(): string[] {
  const preferred = process.env.OPENROUTER_TEXT_MODEL?.trim();
  const models = preferred
    ? [preferred, ...STORYBOARD_TEXT_MODEL_FALLBACKS.filter((m) => m !== preferred)]
    : [...STORYBOARD_TEXT_MODEL_FALLBACKS];
  return [...new Set(models)];
}
