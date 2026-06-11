import { resolveStoryboardFrameReferences } from "@/lib/storyboard/resolve-frame-references";
import {
  sanitizeStoryboardInputReferenceIgnore,
  sanitizeStoryboardInputReferenceLabel,
  sortStoryboardInputReferences,
} from "@/lib/storyboard/storyboard-input-references";
import type { StoryboardInputReference } from "@/types/storyboard";

export async function resolveStoryboardInputReferences(
  refs: StoryboardInputReference[],
  options: { userId: string; storageConversationId?: string }
): Promise<
  Array<{
    kind: StoryboardInputReference["kind"];
    url: string;
    label?: string;
    ignoreInReference?: string;
  }>
> {
  const sorted = sortStoryboardInputReferences(refs);
  if (!sorted.length) return [];

  const resolved: Array<{
    kind: StoryboardInputReference["kind"];
    url: string;
    label?: string;
    ignoreInReference?: string;
  }> = [];

  for (const ref of sorted) {
    const [url] = await resolveStoryboardFrameReferences(
      [
        {
          frameImageUrl: ref.imageUrl ?? ref.previewUrl,
          frameStoragePath: ref.storagePath,
        },
      ],
      options
    );
    if (url?.trim()) {
      const caption = sanitizeStoryboardInputReferenceLabel(ref.label ?? "");
      const ignore = sanitizeStoryboardInputReferenceIgnore(
        ref.ignoreInReference ?? ""
      );
      resolved.push({
        kind: ref.kind,
        url: url.trim(),
        ...(caption ? { label: caption } : {}),
        ...(ignore ? { ignoreInReference: ignore } : {}),
      });
    }
  }

  return resolved;
}
