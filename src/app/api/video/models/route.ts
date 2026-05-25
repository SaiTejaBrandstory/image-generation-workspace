import { NextResponse } from "next/server";
import {
  fetchVideoModelsFromOpenRouter,
  OPENROUTER_VIDEO_MODELS,
} from "@/lib/openrouter-video-models";

export const revalidate = 3600;

export async function GET() {
  try {
    const models = await fetchVideoModelsFromOpenRouter(
      process.env.OPENROUTER_API_KEY
    );
    return NextResponse.json({ models, source: "openrouter" });
  } catch (err) {
    console.error("[video/models]", err);
    return NextResponse.json({
      models: OPENROUTER_VIDEO_MODELS,
      source: "fallback",
      warning:
        err instanceof Error ? err.message : "Using cached video model catalog",
    });
  }
}
