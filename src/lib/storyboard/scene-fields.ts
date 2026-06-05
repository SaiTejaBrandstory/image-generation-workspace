import type { StoryboardScene } from "@/types/storyboard";

function inferCameraAngle(cameraDirection: string): string {
  const d = cameraDirection.toLowerCase();
  if (d.includes("low angle")) return "Low Angle";
  if (d.includes("high angle")) return "High Angle";
  if (d.includes("overhead") || d.includes("bird")) return "Bird's Eye";
  if (d.includes("worm")) return "Worm's Eye";
  if (d.includes("dutch")) return "Dutch Angle";
  return "Eye Level";
}

function inferCameraMovement(cameraDirection: string): string {
  const d = cameraDirection.toLowerCase();
  if (d.includes("tracking")) return "Tracking";
  if (d.includes("dolly in")) return "Dolly In";
  if (d.includes("dolly out")) return "Dolly Out";
  if (d.includes("drone")) return "Drone";
  if (d.includes("crane")) return "Crane";
  if (d.includes("handheld")) return "Handheld";
  if (d.includes("zoom")) return "Zoom In";
  return "Static";
}

export function normalizeSceneFields(
  scene: Partial<StoryboardScene> & Pick<StoryboardScene, "cameraDirection">
): Pick<StoryboardScene, "cameraAngle" | "cameraMovement" | "cameraDirection"> {
  const cameraDirection = scene.cameraDirection || "Wide Shot";
  return {
    cameraDirection,
    cameraAngle:
      scene.cameraAngle?.trim() || inferCameraAngle(cameraDirection),
    cameraMovement:
      scene.cameraMovement?.trim() || inferCameraMovement(cameraDirection),
  };
}
