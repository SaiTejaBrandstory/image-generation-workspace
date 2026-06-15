import {
  XFADE_TRANSITIONS,
  getXfadeTransitionMeta,
  resolveSceneTransitionMeta,
  type XfadeTransitionMeta,
} from "@/lib/storyboard/xfade-transitions";
import type { SceneTransition } from "@/types/storyboard";

export interface SceneTransitionMeta {
  id: SceneTransition;
  label: string;
  description: string;
}

export const SCENE_TRANSITION_META: SceneTransitionMeta[] = XFADE_TRANSITIONS.map(
  (item) => ({
    id: item.id as SceneTransition,
    label: item.label,
    description: item.description,
  })
);

export function getSceneTransitionMeta(
  transition: SceneTransition | string | undefined
): SceneTransitionMeta {
  const resolved = resolveSceneTransitionMeta(transition);
  return {
    id: (transition ?? "fade") as SceneTransition,
    label: resolved.label,
    description: resolved.description,
  };
}

export { getXfadeTransitionMeta, resolveSceneTransitionMeta, type XfadeTransitionMeta };
