import { createAdminClient } from "@/lib/supabase/admin";
import { generationStoragePath } from "@/lib/supabase/storage";
import {
  loadStoryboardByConversationId,
  persistStoryboard,
  type LoadedStoryboard,
} from "@/lib/supabase/storyboard-db";
import {
  createEmptyScene,
  distributeDurations,
  generateScenesFromScript,
} from "@/lib/storyboard/scene-engine";
import type { StoryboardScene } from "@/types/storyboard";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "generations";

const UUID_FILE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp)$/i;

const SCENE_VIDEO_FILE_RE =
  /^scene-video-([0-9a-f-]+)-(\d+)\.(mp4|webm)$/i;

interface ListedAsset {
  name: string;
  storagePath: string;
  createdAt: string | null;
}

export interface StoryboardRecoveryResult {
  recovered: boolean;
  source: "snapshot" | "storage" | "none";
  sceneCount: number;
  storyboard: LoadedStoryboard | null;
}

async function listConversationAssets(
  userId: string,
  conversationId: string
): Promise<ListedAsset[]> {
  const admin = createAdminClient();
  const prefix = `${userId}/${conversationId}`;
  const { data: files, error } = await admin.storage.from(BUCKET).list(prefix);
  if (error || !files?.length) return [];

  return files
    .filter((file) => file.name && !file.name.endsWith("/"))
    .map((file) => ({
      name: file.name,
      storagePath: `${prefix}/${file.name}`,
      createdAt: (file.created_at as string | undefined) ?? null,
    }));
}

function sortByCreatedAt(assets: ListedAsset[]): ListedAsset[] {
  return [...assets].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.name.localeCompare(b.name);
  });
}

function parseSceneVideos(assets: ListedAsset[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const asset of assets) {
    const match = asset.name.match(SCENE_VIDEO_FILE_RE);
    if (!match) continue;
    map.set(Number(match[2]), asset.storagePath);
  }
  return map;
}

function parseFrameImages(assets: ListedAsset[]): ListedAsset[] {
  return sortByCreatedAt(
    assets.filter((asset) => UUID_FILE_RE.test(asset.name))
  );
}

type SceneSnapshot = StoryboardScene;

function scenesFromSettingsSnapshot(
  settings: Record<string, unknown> | null | undefined
): SceneSnapshot[] | null {
  const raw = settings?.scenesSnapshot;
  if (!Array.isArray(raw) || !raw.length) return null;
  return raw as SceneSnapshot[];
}

function overlayStorageOnScenes(
  scenes: StoryboardScene[],
  sceneVideos: Map<number, string>,
  frameImages: ListedAsset[]
): StoryboardScene[] {
  return scenes.map((scene, index) => {
    const videoPath = sceneVideos.get(scene.sceneNumber);
    const framePath =
      scene.frameStoragePath ??
      frameImages[index]?.storagePath ??
      frameImages.find((f) => f.name.startsWith(`${scene.id}.`))?.storagePath;

    return {
      ...scene,
      frameStoragePath: framePath ?? scene.frameStoragePath,
      frameStatus: framePath ? ("complete" as const) : scene.frameStatus,
      sceneVideoStoragePath: videoPath ?? scene.sceneVideoStoragePath,
      sceneVideoStatus: videoPath
        ? ("complete" as const)
        : scene.sceneVideoStatus,
      sceneVideoUrl: undefined,
      frameImageUrl: undefined,
    };
  });
}

function buildScenesFromScriptAndAssets(
  script: string,
  settings: LoadedStoryboard["settings"],
  sceneVideos: Map<number, string>,
  frameImages: ListedAsset[]
): StoryboardScene[] {
  const sceneCount = Math.max(
    settings.frameCount,
    sceneVideos.size,
    frameImages.length,
    1
  );

  let scenes: StoryboardScene[];
  if (script.trim()) {
    scenes = generateScenesFromScript(script, settings, sceneCount);
  } else {
    const durations = distributeDurations(settings.durationSec, sceneCount);
    scenes = Array.from({ length: sceneCount }, (_, index) => ({
      ...createEmptyScene(index + 1),
      durationSec: durations[index] ?? 3,
      voiceover: `Scene ${index + 1}`,
      visualDescription: `Recovered scene ${index + 1}`,
    }));
  }

  return overlayStorageOnScenes(scenes, sceneVideos, frameImages);
}

/**
 * Rebuild storyboard scenes when the DB rows were wiped but script/settings/storage remain.
 */
export async function attemptStoryboardRecovery(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<StoryboardRecoveryResult> {
  const existing = await loadStoryboardByConversationId(
    supabase,
    userId,
    conversationId
  );
  if (!existing) {
    return { recovered: false, source: "none", sceneCount: 0, storyboard: null };
  }
  if (existing.scenes.length) {
    return {
      recovered: false,
      source: "none",
      sceneCount: existing.scenes.length,
      storyboard: existing,
    };
  }

  const settingsRecord = existing.settings as unknown as Record<string, unknown>;
  const snapshot = scenesFromSettingsSnapshot(settingsRecord);
  const assets = await listConversationAssets(userId, conversationId);
  const sceneVideos = parseSceneVideos(assets);
  const frameImages = parseFrameImages(assets);

  const hasSnapshot = Boolean(snapshot?.length);
  const hasStorage = sceneVideos.size > 0 || frameImages.length > 0;
  const hasScript = Boolean(existing.script.trim());

  if (!hasSnapshot && !hasStorage && !hasScript) {
    return {
      recovered: false,
      source: "none",
      sceneCount: 0,
      storyboard: existing,
    };
  }

  let scenes: StoryboardScene[];
  let source: StoryboardRecoveryResult["source"];

  if (hasSnapshot) {
    scenes = overlayStorageOnScenes(snapshot!, sceneVideos, frameImages);
    source = "snapshot";
  } else {
    scenes = buildScenesFromScriptAndAssets(
      existing.script,
      existing.settings,
      sceneVideos,
      frameImages
    );
    source = "storage";
  }

  if (!scenes.length) {
    return { recovered: false, source: "none", sceneCount: 0, storyboard: existing };
  }

  await persistStoryboard(supabase, userId, {
    conversationId,
    script: existing.script,
    settings: existing.settings,
    continuity: existing.continuity,
    scenes,
    singleVideoStoragePath: existing.singleVideoStoragePath,
    sceneStitchedVideoStoragePath: existing.sceneStitchedVideoStoragePath,
    singleVideoDurationSec: existing.storyboardVideoDurationSec,
    sceneStitchedVideoDurationSec: existing.sceneStitchedVideoDurationSec,
  });

  const storyboard = await loadStoryboardByConversationId(
    supabase,
    userId,
    conversationId
  );

  return {
    recovered: true,
    source,
    sceneCount: scenes.length,
    storyboard,
  };
}

/** Build storage path for a scene video (for tests / diagnostics). */
export function sceneVideoStoragePathFor(
  userId: string,
  conversationId: string,
  projectId: string,
  sceneNumber: number
): string {
  return generationStoragePath(
    userId,
    conversationId,
    `scene-video-${projectId}-${sceneNumber}`,
    "mp4"
  );
}
