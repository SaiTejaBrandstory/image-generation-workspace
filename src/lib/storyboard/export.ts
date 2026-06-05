import type { StoryboardProjectSettings, StoryboardScene } from "@/types/storyboard";

export function exportScenesCsv(
  script: string,
  settings: StoryboardProjectSettings,
  scenes: StoryboardScene[]
): void {
  const headers = [
    "Scene",
    "Duration (s)",
    "Shot Type",
    "Camera Angle",
    "Camera Movement",
    "Voiceover",
    "Visual Description",
    "Character Actions",
    "Environment",
    "Emotion",
    "Transition",
    "Image Prompt",
  ];
  const rows = scenes.map((s) =>
    [
      s.sceneNumber,
      s.durationSec,
      s.cameraDirection,
      s.cameraAngle ?? "",
      s.cameraMovement ?? "",
      s.voiceover,
      s.visualDescription,
      s.characterActions,
      s.environment,
      s.emotion,
      s.transition,
      s.imagePrompt,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `storyboard-scenes-${Date.now()}.csv`
  );
}

export function exportProjectJson(
  script: string,
  settings: StoryboardProjectSettings,
  scenes: StoryboardScene[]
): void {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    script,
    settings,
    scenes,
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `storyboard-project-${Date.now()}.json`
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
