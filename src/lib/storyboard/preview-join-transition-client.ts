import { extractApiErrorMessage } from "@/lib/api-response";

const previewBlobCache = new Map<string, string>();

const PREVIEW_CACHE_VERSION = "v31-fade-gray-fast";

function cacheKey(
  fromStoragePath: string,
  toStoragePath: string,
  transition: string
): string {
  return `${PREVIEW_CACHE_VERSION}::${fromStoragePath}::${toStoragePath}::${transition}`;
}

export function clearJoinTransitionPreviewCache(): void {
  for (const url of previewBlobCache.values()) {
    URL.revokeObjectURL(url);
  }
  previewBlobCache.clear();
}

export async function fetchJoinTransitionPreview(params: {
  fromStoragePath: string;
  toStoragePath: string;
  transition: string;
  signal?: AbortSignal;
}): Promise<string> {
  const key = cacheKey(
    params.fromStoragePath,
    params.toStoragePath,
    params.transition
  );
  const cached = previewBlobCache.get(key);
  if (cached) return cached;

  const res = await fetch("/api/storyboard/preview-join-transition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromStoragePath: params.fromStoragePath,
      toStoragePath: params.toStoragePath,
      transition: params.transition,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    let message = "Could not render transition preview.";
    try {
      const data = (await res.json()) as { error?: string };
      message = extractApiErrorMessage(data, message);
    } catch {
      const text = await res.text().catch(() => "");
      if (text.trim()) message = text.trim().slice(0, 200);
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  previewBlobCache.set(key, url);
  return url;
}
