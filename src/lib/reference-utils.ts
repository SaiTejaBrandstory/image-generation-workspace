import { ensureReferenceMinDimensions } from "@/lib/reference-image-dimensions";
import type { ReferenceImage, ReferenceImagePayload } from "@/types";

export interface SerializeReferencesOptions {
  /** Upscale refs below provider minimum (video: 240×240) */
  minDimension?: number;
}

export async function blobUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function serializeReferences(
  references: ReferenceImage[],
  options?: SerializeReferencesOptions
): Promise<ReferenceImagePayload[]> {
  const payloads: ReferenceImagePayload[] = [];
  for (const ref of references) {
    try {
      let dataUrl = await blobUrlToDataUrl(ref.url);
      if (options?.minDimension != null && options.minDimension > 0) {
        const normalized = await ensureReferenceMinDimensions(
          dataUrl,
          options.minDimension
        );
        dataUrl = normalized.dataUrl;
      }
      payloads.push({
        role: ref.role,
        influence: ref.influence,
        dataUrl,
        usageMode: ref.usageMode ?? "inspire",
      });
    } catch {
      // skip unreadable refs
    }
  }
  return payloads;
}

/** Run async tasks with a concurrency limit */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
