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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to save storyboard");
  return { conversationId: data.conversationId as string };
}

export async function fetchStoryboard(
  conversationId: string
): Promise<LoadedStoryboard> {
  const res = await fetch(`/api/storyboard/${conversationId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load storyboard");
  return data as LoadedStoryboard;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update storyboard");
}
