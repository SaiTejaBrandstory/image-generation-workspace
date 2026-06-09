import { resolveSceneFrameHttpUrl } from "@/lib/storyboard/storyboard-video";
import type { StoryboardScene } from "@/types/storyboard";

export interface StoryboardFrameReferenceInput {
  frameImageUrl?: string;
  frameStoragePath?: string;
}

/** Resolve reference frame URLs to HTTPS sources OpenRouter can fetch. */
export async function resolveStoryboardFrameReferences(
  refs: StoryboardFrameReferenceInput[],
  options: { userId: string; storageConversationId?: string }
): Promise<string[]> {
  const resolved: string[] = [];

  for (const ref of refs) {
    if (!ref.frameImageUrl?.trim() && !ref.frameStoragePath?.trim()) continue;

    try {
      const url = await resolveSceneFrameHttpUrl(
        {
          id: "storyboard-ref",
          sceneNumber: 1,
          durationSec: 0,
          voiceover: "",
          visualDescription: "",
          cameraDirection: "",
          cameraAngle: "",
          cameraMovement: "",
          characterActions: "",
          environment: "",
          emotion: "neutral",
          transition: "cut",
          imagePrompt: "",
          frameStatus: "complete",
          frameImageUrl: ref.frameImageUrl,
          frameStoragePath: ref.frameStoragePath,
        } satisfies StoryboardScene,
        options
      );
      if (url.trim()) resolved.push(url.trim());
    } catch {
      const fallback = ref.frameImageUrl?.trim();
      if (fallback) resolved.push(fallback);
    }
  }

  return resolved;
}
