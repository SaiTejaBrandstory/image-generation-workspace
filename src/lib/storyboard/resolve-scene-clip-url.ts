import { readJsonResponse } from "@/lib/api-response";
import { useStoryboardStore } from "@/store/storyboard-store";
import type { StoryboardScene } from "@/types/storyboard";

const clipUrlCache = new Map<string, string>();
const signInFlight = new Map<string, Promise<string | undefined>>();

function isVideoStoragePath(path: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(path);
}

function isPlayableClipUrl(url: string): boolean {
  if (url.startsWith("blob:")) return true;
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return true;
  if (/\/object\/sign\//i.test(url) && /\.(mp4|webm|mov)/i.test(url)) {
    return true;
  }
  return false;
}

export function sceneHasAnimatedClip(scene: StoryboardScene): boolean {
  if (scene.sceneVideoStatus !== "complete") return false;
  const storagePath = scene.sceneVideoStoragePath?.trim();
  if (storagePath && isVideoStoragePath(storagePath)) return true;
  const direct = scene.sceneVideoUrl?.trim();
  return Boolean(direct && isPlayableClipUrl(direct));
}

/** Synchronous lookup — cached signed URL for storage path only. */
export function peekSceneClipUrl(scene: StoryboardScene): string | undefined {
  const storagePath = scene.sceneVideoStoragePath?.trim();
  if (storagePath && isVideoStoragePath(storagePath)) {
    return clipUrlCache.get(storagePath);
  }

  const direct = scene.sceneVideoUrl?.trim();
  if (direct && isPlayableClipUrl(direct)) return direct;

  return undefined;
}

function writeSceneClipUrlToStore(sceneId: string, url: string): void {
  useStoryboardStore.setState((s) => {
    const current = s.scenes.find((scene) => scene.id === sceneId);
    if (current?.sceneVideoUrl === url) return {};
    return {
      scenes: s.scenes.map((scene) =>
        scene.id === sceneId ? { ...scene, sceneVideoUrl: url } : scene
      ),
    };
  });
}

async function signSceneClipStoragePath(
  storagePath: string
): Promise<string | undefined> {
  const cached = clipUrlCache.get(storagePath);
  if (cached) return cached;

  const inflight = signInFlight.get(storagePath);
  if (inflight) return inflight;

  const promise = (async () => {
    const res = await fetch("/api/storyboard/sign-clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath }),
    });
    const data = await readJsonResponse<{ signedUrl?: string; error?: string }>(
      res
    );
    if (!res.ok || !data.signedUrl) return undefined;

    clipUrlCache.set(storagePath, data.signedUrl);
    return data.signedUrl;
  })().finally(() => {
    signInFlight.delete(storagePath);
  });

  signInFlight.set(storagePath, promise);
  return promise;
}

/** Resolve a playable clip URL — sign storage path first, then fall back to memory URL. */
export async function resolveSceneClipUrl(
  scene: StoryboardScene
): Promise<string | undefined> {
  if (scene.sceneVideoStatus !== "complete") return undefined;

  const storagePath = scene.sceneVideoStoragePath?.trim();
  if (storagePath && isVideoStoragePath(storagePath)) {
    return signSceneClipStoragePath(storagePath);
  }

  const direct = scene.sceneVideoUrl?.trim();
  if (direct && isPlayableClipUrl(direct)) return direct;

  return undefined;
}

export async function resolveJoinClipUrls(
  fromScene: StoryboardScene,
  toScene: StoryboardScene
): Promise<{ fromVideo?: string; toVideo?: string }> {
  const [fromVideo, toVideo] = await Promise.all([
    resolveSceneClipUrl(fromScene),
    resolveSceneClipUrl(toScene),
  ]);
  return { fromVideo, toVideo };
}

/** Warm the clip URL cache for scenes missing a playable URL. */
export async function prefetchSceneClipUrls(
  scenes: StoryboardScene[]
): Promise<void> {
  const targets = scenes.filter(
    (scene) => sceneHasAnimatedClip(scene) && !peekSceneClipUrl(scene)
  );
  if (!targets.length) return;

  const resolved = await Promise.all(
    targets.map(async (scene) => ({
      id: scene.id,
      url: await resolveSceneClipUrl(scene),
    }))
  );

  for (const { id, url } of resolved) {
    if (url) writeSceneClipUrlToStore(id, url);
  }
}

export { writeSceneClipUrlToStore };
