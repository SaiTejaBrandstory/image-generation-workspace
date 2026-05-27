import { NextResponse } from "next/server";
import {
  fetchImageModelsFromOpenRouter,
  OPENROUTER_IMAGE_MODELS,
} from "@/lib/openrouter-models";

export const revalidate = 3600;

export async function GET() {
  try {
    const models = await fetchImageModelsFromOpenRouter(
      process.env.OPENROUTER_API_KEY
    );
    console.log(`[image/models] live — ${models.length} models`);
    return NextResponse.json({ models, source: "openrouter", count: models.length });
  } catch (err) {
    const warning =
      err instanceof Error ? err.message : "Using cached image model catalog";
    console.warn(`[image/models] fallback — ${warning}`);
    return NextResponse.json({
      models: OPENROUTER_IMAGE_MODELS,
      source: "fallback",
      count: OPENROUTER_IMAGE_MODELS.length,
      warning,
    });
  }
}
