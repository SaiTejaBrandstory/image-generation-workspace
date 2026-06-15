import {
  extractApiErrorMessage,
  readJsonResponse,
} from "@/lib/api-response";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";
import type { LoadedStoryboard } from "@/lib/supabase/storyboard-db";

export async function commitStoryboard(
  payload: {
    conversationId?: string | null;
    script: string;
    settings: StoryboardProjectSettings;
    continuity: StoryboardContinuity | null;
    scenes: StoryboardScene[];
    singleVideoStoragePath?: string | null;
    stitchedVideoStoragePath?: string | null;
    sceneStitchedVideoStoragePath?: string | null;
    singleVideoDurationSec?: number | null;
    stitchedVideoDurationSec?: number | null;
    sceneStitchedVideoDurationSec?: number | null;
  }
): Promise<{ conversationId: string }> {
  const res = await fetch("/api/storyboard/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJsonResponse<{ conversationId?: string; error?: string }>(
    res
  );
  if (!res.ok) {
    throw new Error(extractApiErrorMessage(data, "Failed to save storyboard"));
  }
  return { conversationId: data.conversationId as string };
}

export async function fetchStoryboard(
  conversationId: string
): Promise<LoadedStoryboard> {
  const res = await fetch(`/api/storyboard/${conversationId}`);
  const data = await readJsonResponse<LoadedStoryboard & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(extractApiErrorMessage(data, "Failed to load storyboard"));
  }
  return data as LoadedStoryboard;
}

export async function recoverStoryboard(conversationId: string): Promise<{
  recovered: boolean;
  source: string;
  sceneCount: number;
  storyboard: LoadedStoryboard | null;
}> {
  const res = await fetch(`/api/storyboard/${conversationId}/recover`, {
    method: "POST",
  });
  const data = await readJsonResponse<{
    recovered: boolean;
    source: string;
    sceneCount: number;
    storyboard: LoadedStoryboard | null;
    error?: string;
  }>(res);
  if (!res.ok) {
    throw new Error(extractApiErrorMessage(data, "Storyboard recovery failed"));
  }
  return data as {
    recovered: boolean;
    source: string;
    sceneCount: number;
    storyboard: LoadedStoryboard | null;
  };
}

export async function patchStoryboardOutputs(
  conversationId: string,
  patch: {
    singleVideoStoragePath?: string | null;
    stitchedVideoStoragePath?: string | null;
    sceneStitchedVideoStoragePath?: string | null;
    singleVideoDurationSec?: number | null;
    stitchedVideoDurationSec?: number | null;
    sceneStitchedVideoDurationSec?: number | null;
  }
): Promise<void> {
  const res = await fetch(`/api/storyboard/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(extractApiErrorMessage(data, "Failed to update storyboard"));
  }
}
