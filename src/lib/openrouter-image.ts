import { buildLayoutImagePrompt, mapAspectRatio } from "@/lib/layout-prompt-builder";
import {
  getModalities,
  getModelConfig,
} from "@/lib/openrouter-models";
import type {
  AspectRatio,
  DesignTokens,
  GenerationParams,
  LayoutId,
  PlatformPreset,
  ReferenceImagePayload,
  StyleEngine,
} from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

interface OpenRouterImageResult {
  imageUrl: string;
  model: string;
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key?.trim()) {
    throw new Error(
      "Image generation is not configured on the server."
    );
  }
  return key.trim();
}

function resolveModel(requested?: string): string {
  if (requested?.trim()) return requested.trim();
  return (
    process.env.OPENROUTER_IMAGE_MODEL?.trim() ||
    "google/gemini-2.5-flash-image"
  );
}

function extractImageUrl(data: unknown): string | null {
  const choices = (data as { choices?: Array<{ message?: Record<string, unknown> }> })
    ?.choices;
  const message = choices?.[0]?.message;
  if (!message) return null;

  const images = message.images as
    | Array<{ image_url?: { url?: string }; imageUrl?: { url?: string } }>
    | undefined;

  if (images?.length) {
    const url =
      images[0].image_url?.url ?? images[0].imageUrl?.url ?? null;
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

function buildMessageContent(
  textPrompt: string,
  references: ReferenceImagePayload[] | undefined,
  supportsVisionInput: boolean
): MessageContent {
  if (!references?.length || !supportsVisionInput) {
    return textPrompt;
  }

  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: textPrompt }];

  for (const ref of references.slice(0, 4)) {
    if (ref.dataUrl) {
      parts.push({
        type: "image_url",
        image_url: { url: ref.dataUrl },
      });
    }
  }

  return parts;
}

export async function generateImageWithOpenRouter(options: {
  userPrompt: string;
  layoutId: LayoutId;
  style: StyleEngine;
  platform: PlatformPreset;
  aspectRatio: AspectRatio;
  params: GenerationParams;
  model?: string;
  designTokens?: DesignTokens;
  references?: ReferenceImagePayload[];
}): Promise<OpenRouterImageResult> {
  const apiKey = getApiKey();
  const model = resolveModel(options.model);
  const config = getModelConfig(model);
  const aspect = mapAspectRatio(options.aspectRatio);

  const textPrompt = buildLayoutImagePrompt({
    userPrompt: options.userPrompt,
    layoutId: options.layoutId,
    style: options.style,
    platform: options.platform,
    params: options.params,
    designTokens: options.designTokens,
    references: options.references,
  });

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: buildMessageContent(
          textPrompt,
          options.references,
          config.supportsVisionInput
        ),
      },
    ],
    modalities: getModalities(model),
  };

  if (config.supportsAspectConfig) {
    body.image_config = {
      aspect_ratio: aspect,
      image_size: "1K",
    };
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Brandwise Layout Workspace",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const err =
      (data as { error?: { message?: string } })?.error?.message ??
      JSON.stringify(data);
    throw new Error(`Image generation failed (${response.status}): ${err}`);
  }

  const imageUrl = extractImageUrl(data);
  if (!imageUrl) {
    throw new Error("No image was returned. Please try again.");
  }

  return { imageUrl, model };
}
