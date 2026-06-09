const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";

/**
 * Storyboard narrator voices (verified on OpenRouter).
 * Male: Brian (warm commercial), Guy (classic narrator), Davis, Christopher, Rex (Grok).
 * Female: Harper, Ava, Jenny, Aria, Eve (Grok).
 */
export const STORYBOARD_TTS_VOICES = {
  male: {
    brian: "en-US-BrianMultilingualNeural",
    guy: "en-US-GuyNeural",
    davis: "en-US-DavisNeural",
    christopher: "en-US-ChristopherNeural",
    rex: "Rex",
  },
  female: {
    harper: "en-US-Harper:MAI-Voice-2",
    ava: "en-US-AvaNeural",
    jenny: "en-US-JennyNeural",
  },
} as const;

/** TTS models verified on OpenRouter (slug + default voice). */
const TTS_MODEL_CHAIN: { model: string; voice: string }[] = [
  {
    model: "microsoft/mai-voice-2",
    voice: STORYBOARD_TTS_VOICES.male.brian,
  },
  {
    model: "x-ai/grok-voice-tts-1.0",
    voice: STORYBOARD_TTS_VOICES.male.rex,
  },
];

export const STORYBOARD_TTS_MODEL = TTS_MODEL_CHAIN[0]!.model;
export const STORYBOARD_TTS_VOICE = TTS_MODEL_CHAIN[0]!.voice;

export async function generateSpeechWithOpenRouter(options: {
  input: string;
  voice?: string;
  model?: string;
}): Promise<Buffer> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Speech generation is not configured.");
  }

  const text = options.input.trim();
  if (!text) {
    throw new Error("No text provided for speech synthesis.");
  }

  const chain = options.model
    ? [{ model: options.model, voice: options.voice ?? STORYBOARD_TTS_VOICE }]
    : TTS_MODEL_CHAIN;

  let lastError = "Speech synthesis failed";

  for (const pick of chain) {
    const res = await fetch(OPENROUTER_SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: pick.model,
        input: text,
        voice: options.voice && options.model ? options.voice : pick.voice,
        response_format: "mp3",
      }),
    });

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 0) return buffer;
      lastError = `Empty audio from ${pick.model}`;
      continue;
    }

    const detail = (await res.text()).slice(0, 300);
    lastError = `Speech synthesis failed (${res.status}, ${pick.model}): ${detail}`;
    console.warn("[openrouter-tts]", lastError);
  }

  throw new Error(lastError);
}
