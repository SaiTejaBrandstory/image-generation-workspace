import {
  formatOpenRouterErrorForUser,
  isRetryableOpenRouterError,
  retryDelayMs,
  sleepMs,
} from "@/lib/openrouter-errors";
import { validateVideoReferencePayloads } from "@/lib/reference-image-formats";
import { getVideoModelConfig } from "@/lib/openrouter-video-models";
import { buildVideoReferencePayloads } from "@/lib/video-reference-usage";
import type { ReferenceImagePayload } from "@/types";

const OPENROUTER_VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const POLL_INTERVAL_MS = 12_000;
/** Keep below Next.js route maxDuration (300s) to allow submit + download + persist */
const MAX_POLL_MS = 4 * 60 * 1000;

export type VideoJobStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

interface VideoSubmitResponse {
  id: string;
  polling_url: string;
  status: VideoJobStatus;
}

interface VideoPollResponse {
  id: string;
  status: VideoJobStatus;
  unsigned_urls?: string[];
  error?: string | { message?: string };
}

export interface GenerateVideoOptions {
  model: string;
  prompt: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  references?: ReferenceImagePayload[];
  onStatus?: (status: VideoJobStatus) => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatVideoError(
  error: string | { message?: string } | undefined,
  fallback: string
): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.message ?? fallback;
}


export async function generateVideoWithOpenRouter(
  options: GenerateVideoOptions
): Promise<{ videoBuffer: Buffer; mime: string; jobId: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Video generation is temporarily unavailable. Please try again later."
    );
  }

  const config = getVideoModelConfig(options.model);
  const supportsFrames = config.supportedFrameImages.length > 0;
  const supportsRefs = config.supportsInputReferences;
  let refsSkipped = 0;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "Image Generation Workspace",
  };

  const body: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt.trim(),
  };

  if (options.duration != null) body.duration = options.duration;
  if (options.resolution) body.resolution = options.resolution;
  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  if (config.generateAudio === true && options.generateAudio != null) {
    body.generate_audio = options.generateAudio;
  } else if (config.generateAudio === true) {
    body.generate_audio = true;
  } else if (config.generateAudio === false) {
    body.generate_audio = false;
  }

  if (options.references?.length) {
    validateVideoReferencePayloads(options.references);
    const { frameImages, inputReferences, skippedCount } =
      buildVideoReferencePayloads(options.references, options.model);
    refsSkipped = skippedCount;
    if (frameImages.length && supportsFrames) {
      body.frame_images = frameImages;
    }
    if (inputReferences.length && supportsRefs) {
      body.input_references = inputReferences;
    }
    if (
      refsSkipped > 0 &&
      frameImages.length + inputReferences.length === 0
    ) {
      throw new Error(
        "None of the attached images could be used with this video model. Try Style ref mode on Wan/Seedance, or use a single image for the opening frame."
      );
    }
  }

  let jobId: string | undefined;
  let pollingUrl: string | undefined;

  for (let attempt = 0; attempt < 4; attempt++) {
    const submitRes = await fetch(OPENROUTER_VIDEOS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const submitJson = (await submitRes.json()) as VideoSubmitResponse & {
      error?: { message?: string };
    };

    if (!submitRes.ok) {
      const raw =
        submitJson.error?.message ??
        (typeof submitJson === "object" && "message" in submitJson
          ? String((submitJson as { message?: string }).message)
          : "Failed to start video generation");
      if (
        isRetryableOpenRouterError(submitRes.status, raw) &&
        attempt < 3
      ) {
        await sleepMs(retryDelayMs(attempt));
        continue;
      }
      throw new Error(formatOpenRouterErrorForUser(raw));
    }

    jobId = submitJson.id;
    pollingUrl =
      submitJson.polling_url ?? `${OPENROUTER_VIDEOS_URL}/${jobId}`;
    options.onStatus?.(submitJson.status ?? "pending");
    break;
  }

  if (!jobId || !pollingUrl) {
    throw new Error(formatOpenRouterErrorForUser("Failed to start video generation"));
  }

  const started = Date.now();
  while (Date.now() - started < MAX_POLL_MS) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(pollingUrl, { headers });
    const status = (await pollRes.json()) as VideoPollResponse & {
      error?: { message?: string };
    };

    if (!pollRes.ok) {
      const raw = formatVideoError(status.error, "Video status check failed");
      if (isRetryableOpenRouterError(pollRes.status, raw)) {
        await sleepMs(retryDelayMs(0));
        continue;
      }
      throw new Error(formatOpenRouterErrorForUser(raw));
    }

    options.onStatus?.(status.status);

    if (status.status === "completed") {
      const contentUrl = status.unsigned_urls?.[0];
      if (!contentUrl) {
        throw new Error("Video completed but no download URL was returned.");
      }

      const videoRes = await fetch(contentUrl, { headers });
      if (!videoRes.ok) {
        throw new Error("Failed to download generated video.");
      }

      const mime =
        videoRes.headers.get("content-type")?.split(";")[0] ?? "video/mp4";
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
      return { videoBuffer, mime, jobId };
    }

    if (
      status.status === "failed" ||
      status.status === "cancelled" ||
      status.status === "expired"
    ) {
      const raw = formatVideoError(
        status.error,
        `Video generation ${status.status}`
      );
      throw new Error(formatOpenRouterErrorForUser(raw));
    }
  }

  throw new Error(
    formatOpenRouterErrorForUser(
      "Video generation timed out. Try again in a few minutes."
    )
  );
}
