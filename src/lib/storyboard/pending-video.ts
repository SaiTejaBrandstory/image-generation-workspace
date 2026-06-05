export type PendingVideoKind = "single" | "stitched";

export interface PendingVideoJob {
  conversationId: string;
  kind: PendingVideoKind;
  startedAt: number;
}

const KEY = "brandwise-storyboard-pending-video";

/** How long we keep checking the DB for a video started in another tab/view. */
export const PENDING_VIDEO_MAX_MS = 20 * 60 * 1000;

export function markPendingVideo(
  conversationId: string,
  kind: PendingVideoKind
): void {
  if (typeof window === "undefined" || !conversationId) return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ conversationId, kind, startedAt: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function clearPendingVideo(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getPendingVideo(): PendingVideoJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as PendingVideoJob;
    if (!job.conversationId || !job.startedAt) return null;
    if (Date.now() - job.startedAt > PENDING_VIDEO_MAX_MS) {
      clearPendingVideo();
      return null;
    }
    return job;
  } catch {
    return null;
  }
}

export function isPendingVideoForConversation(
  conversationId: string | null,
  kind?: PendingVideoKind
): boolean {
  if (!conversationId) return false;
  const job = getPendingVideo();
  if (!job || job.conversationId !== conversationId) return false;
  if (kind && job.kind !== kind) return false;
  return true;
}
