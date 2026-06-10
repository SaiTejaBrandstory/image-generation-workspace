import { getFrameStyleConfig } from "@/lib/storyboard/frame-styles";
import {
  buildStoryboardInputReferencePromptLabel,
  pickStoryboardFrameReferenceUrls,
} from "@/lib/storyboard/storyboard-input-references";
import type {
  StoryboardFrameStyle,
  StoryboardInputReference,
} from "@/types/storyboard";

export function buildStoryboardFrameReferenceImages(options: {
  sceneNumber: number;
  frameStyle?: StoryboardFrameStyle;
  inputRefs: Array<{
    kind: StoryboardInputReference["kind"];
    url: string;
    label?: string;
  }>;
  generatedFrameUrls: string[];
  maxRefs: number;
}): Array<{ url: string; label: string }> {
  const { slots } = pickStoryboardFrameReferenceUrls({
    inputRefs: options.inputRefs,
    generatedFrameUrls: options.generatedFrameUrls,
    maxRefs: options.maxRefs,
  });

  const styleHint = getFrameStyleConfig(options.frameStyle ?? "sketch")
    .referenceHint;
  const images: Array<{ url: string; label: string }> = [];
  let generatedIndex = 0;

  for (const slot of slots) {
    if (slot.type === "input") {
      images.push({
        url: slot.url,
        label: buildStoryboardInputReferencePromptLabel(slot.kind, slot.label),
      });
      continue;
    }

    const label =
      generatedIndex === 0
        ? `SCENE 1 ANCHOR — locked character design. Match these exact faces, costumes, props, and ${styleHint}:`
        : "PREVIOUS SHOT — continue from this frame; keep the same characters and visual style:";
    images.push({ url: slot.url, label });
    generatedIndex += 1;
  }

  return images;
}
