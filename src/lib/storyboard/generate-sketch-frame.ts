import {
  clampImageAspectRatioToModel,
  getModalities,
  getModelConfig,
} from "@/lib/openrouter-models";
import { mapAspectRatio } from "@/lib/layout-prompt-builder";
import {
  formatOpenRouterErrorForUser,
  isRetryableOpenRouterError,
  retryDelayMs,
  sleepMs,
} from "@/lib/openrouter-errors";
import { getFrameStyleConfig } from "@/lib/storyboard/frame-styles";
import {
  buildStoryboardSketchPrompt,
  resolveStoryboardImageModel,
  type StoryboardSketchSceneInput,
} from "@/lib/storyboard/sketch-prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key?.trim()) {
    throw new Error("Image generation is not configured on the server.");
  }
  return key.trim();
}

function extractImageUrl(data: unknown): string | null {
  const choices = (
    data as { choices?: Array<{ message?: Record<string, unknown> }> }
  )?.choices;
  const message = choices?.[0]?.message;
  if (!message) return null;

  const images = message.images as
    | Array<{ image_url?: { url?: string }; imageUrl?: { url?: string } }>
    | undefined;

  if (images?.length) {
    const url = images[0].image_url?.url ?? images[0].imageUrl?.url ?? null;
    if (url) return url;
  }

  const content = message.content;
  if (typeof content === "string" && content.startsWith("data:image")) {
    return content;
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      const p = part as { type?: string; image_url?: { url?: string } };
      if (p.type === "image_url" && p.image_url?.url) {
        return p.image_url.url;
      }
    }
  }

  return null;
}

export async function generateStoryboardSketchFrame(
  scene: StoryboardSketchSceneInput
): Promise<{ imageUrl: string; model: string }> {
  const apiKey = getApiKey();
  const model = resolveStoryboardImageModel();
  const config = getModelConfig(model);
  const aspectRatio = clampImageAspectRatioToModel(model, "16:9");

  const referenceUrl = scene.referenceFrameUrl?.trim();
  const useReference =
    Boolean(referenceUrl) && config.supportsVisionInput && scene.sceneNumber > 1;
  const styleConfig = getFrameStyleConfig(scene.frameStyle ?? "sketch");

  let textPrompt = buildStoryboardSketchPrompt({
    ...scene,
    hasReferenceFrame: useReference,
  });
  if (!config.supportsAspectConfig) {
    textPrompt = `${textPrompt}\n\nCompose as a single ${mapAspectRatio(aspectRatio)} storyboard panel.`;
  }

  const messageContent = useReference
    ? [
        { type: "text", text: textPrompt },
        {
          type: "text",
          text: `REFERENCE FRAME — preserve the same character faces, bodies, clothing, props, and ${styleConfig.referenceHint}. Draw a new shot of the same production:`,
        },
        { type: "image_url", image_url: { url: referenceUrl } },
      ]
    : textPrompt;

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: messageContent }],
    modalities: getModalities(model),
  };

  if (config.supportsAspectConfig) {
    body.image_config = {
      aspect_ratio: mapAspectRatio(aspectRatio),
      image_size: "1K",
    };
  }

  const maxAttempts = 4;
  let lastMessage = "Storyboard frame generation failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Brandwise Storyboard",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const err =
        (data as { error?: { message?: string } })?.error?.message ??
        JSON.stringify(data);
      lastMessage = err;
      if (
        isRetryableOpenRouterError(response.status, err) &&
        attempt < maxAttempts - 1
      ) {
        await sleepMs(retryDelayMs(attempt));
        continue;
      }
      throw new Error(formatOpenRouterErrorForUser(err));
    }

    const imageUrl = extractImageUrl(data);
    if (!imageUrl) {
      lastMessage = "No image was returned";
      if (attempt < maxAttempts - 1) {
        await sleepMs(retryDelayMs(attempt));
        continue;
      }
      throw new Error("No storyboard frame was returned. Please try again.");
    }

    return { imageUrl, model };
  }

  throw new Error(formatOpenRouterErrorForUser(lastMessage));
}
