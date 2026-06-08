import type { StoryboardScene } from "@/types/storyboard";

export function applyGlobalSceneEnvironment(
  scenes: StoryboardScene[],
  sceneEnvironment: string | undefined
): StoryboardScene[] {
  const env = sceneEnvironment?.trim();
  if (!env) return scenes;
  return scenes.map((scene) => ({ ...scene, environment: env }));
}
