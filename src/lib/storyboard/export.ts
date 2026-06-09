import { jsPDF } from "jspdf";
import { getFrameStyleLabel } from "@/lib/storyboard/frame-styles";
import type { StoryboardProjectSettings, StoryboardScene } from "@/types/storyboard";

const MARGIN = 14;
const ACCENT: [number, number, number] = [234, 88, 12];
const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const LINE: [number, number, number] = [228, 228, 231];
const PANEL: [number, number, number] = [250, 250, 250];

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imageFormat(dataUrl: string): "JPEG" | "PNG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function sharedEnvironment(scenes: StoryboardScene[]): string | null {
  const values = scenes
    .map((s) => s.environment.trim())
    .filter(Boolean);
  if (!values.length) return null;
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 3.8
): number {
  if (!value.trim()) return y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(value.trim(), maxWidth) as string[];
  doc.text(lines, x, y + 3.5);

  return y + 3.5 + lines.length * lineHeight + 2.5;
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`Storyboard · ${pageNum} / ${totalPages}`, w / 2, h - 6, {
    align: "center",
  });
}

function drawCoverPage(
  doc: jsPDF,
  script: string,
  settings: StoryboardProjectSettings,
  scenes: StoryboardScene[],
  totalDuration: number,
  sharedEnv: string | null
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  let y = MARGIN + 4;

  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y, 28, 1.2, "F");
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text("Storyboard", MARGIN, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    `${scenes.length} scenes  ·  ${totalDuration}s total  ·  ${titleCase(settings.genre)}`,
    MARGIN,
    y
  );
  y += 8;

  const meta = [
    getFrameStyleLabel(settings.frameStyle),
    `${settings.durationSec}s`,
    `${settings.frameCount} frames`,
  ];
  let metaX = MARGIN;
  for (const item of meta) {
    const pillW = doc.getTextWidth(item) + 8;
    doc.setFillColor(...PANEL);
    doc.setDrawColor(...LINE);
    doc.roundedRect(metaX, y - 4, pillW, 7, 1.5, 1.5, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(item, metaX + 4, y);
    metaX += pillW + 3;
  }
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Creative brief", MARGIN, y);
  y += 5;

  const scriptText = script.trim() || "(No script provided)";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const scriptLines = doc.splitTextToSize(scriptText, contentW - 8) as string[];
  const scriptH = scriptLines.length * 4.2 + 10;

  doc.setFillColor(...PANEL);
  doc.setDrawColor(...LINE);
  doc.roundedRect(MARGIN, y, contentW, scriptH, 2, 2, "FD");
  doc.setTextColor(...INK);
  doc.text(scriptLines, MARGIN + 4, y + 7);
  y += scriptH + 10;

  if (sharedEnv) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Scene environment", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const envLines = doc.splitTextToSize(sharedEnv, contentW) as string[];
    doc.text(envLines, MARGIN, y);
    y += envLines.length * 4 + 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Scene index", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const scene of scenes) {
    const line = `${scene.sceneNumber}.  ${truncate(scene.visualDescription || scene.voiceover, 72)}  (${scene.durationSec}s · ${titleCase(scene.cameraDirection)})`;
    doc.setTextColor(...MUTED);
    doc.text(line, MARGIN + 2, y);
    y += 5;
    if (y > pageH - 20) break;
  }

  const stamp = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Exported ${stamp}`, MARGIN, pageH - 8);
}

function drawSceneCard(
  doc: jsPDF,
  scene: StoryboardScene,
  frameImage: string | null,
  box: { x: number; y: number; w: number; h: number },
  showEnvironment: boolean
) {
  const { x, y, w, h } = box;
  const pad = 4;
  const headerH = 10;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...LINE);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  doc.setFillColor(...INK);
  doc.roundedRect(x, y, w, headerH, 2, 2, "F");
  doc.rect(x, y + headerH - 2, w, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Scene ${scene.sceneNumber}`, x + pad, y + 6.5);

  const badges = [
    `${scene.durationSec}s`,
    titleCase(scene.emotion),
    titleCase(scene.transition),
  ];
  let badgeX = x + w - pad;
  doc.setFontSize(7.5);
  for (let i = badges.length - 1; i >= 0; i--) {
    const badge = badges[i]!;
    const bw = doc.getTextWidth(badge) + 6;
    badgeX -= bw;
    doc.setFillColor(60, 60, 60);
    doc.roundedRect(badgeX, y + 2.5, bw, 5.5, 1, 1, "F");
    doc.setTextColor(240, 240, 240);
    doc.text(badge, badgeX + 3, y + 6.2);
    badgeX -= 2;
  }

  const innerY = y + headerH + pad;
  const innerH = h - headerH - pad * 2;
  const imgW = Math.min(98, w * 0.38);
  const imgH = Math.min(innerH, imgW * (9 / 16));
  const imgX = x + pad;
  const imgY = innerY + (innerH - imgH) / 2;

  doc.setFillColor(...PANEL);
  doc.setDrawColor(...LINE);
  doc.roundedRect(imgX, imgY, imgW, imgH, 1.5, 1.5, "FD");

  if (frameImage) {
    const aspect = 16 / 9;
    let drawW = imgW - 2;
    let drawH = drawW / aspect;
    if (drawH > imgH - 2) {
      drawH = imgH - 2;
      drawW = drawH * aspect;
    }
    const drawX = imgX + (imgW - drawW) / 2;
    const drawY = imgY + (imgH - drawH) / 2;
    doc.addImage(
      frameImage,
      imageFormat(frameImage),
      drawX,
      drawY,
      drawW,
      drawH
    );
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("No frame", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
  }

  const textX = imgX + imgW + 6;
  const textW = x + w - pad - textX;
  let textY = innerY + 1;

  const cameraLine = [
    scene.cameraDirection,
    scene.cameraMovement,
    scene.cameraAngle,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join("  ·  ");

  textY = drawLabelValue(doc, "Voiceover", scene.voiceover, textX, textY, textW);
  textY = drawLabelValue(
    doc,
    "Visual",
    scene.visualDescription,
    textX,
    textY,
    textW
  );
  textY = drawLabelValue(doc, "Camera", cameraLine, textX, textY, textW);
  textY = drawLabelValue(
    doc,
    "Action",
    scene.characterActions,
    textX,
    textY,
    textW
  );

  if (showEnvironment && scene.environment.trim()) {
    drawLabelValue(
      doc,
      "Environment",
      truncate(scene.environment, 280),
      textX,
      textY,
      textW
    );
  }
}

function drawScenesPage(
  doc: jsPDF,
  scenes: StoryboardScene[],
  frameImages: (string | null)[],
  startIndex: number,
  sharedEnv: string | null
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const gap = 6;
  const cardsPerPage = 2;
  const cardH = (pageH - MARGIN * 2 - gap * (cardsPerPage - 1)) / cardsPerPage;

  for (let slot = 0; slot < cardsPerPage; slot++) {
    const sceneIndex = startIndex + slot;
    if (sceneIndex >= scenes.length) break;

    const scene = scenes[sceneIndex]!;
    const cardY = MARGIN + slot * (cardH + gap);

    drawSceneCard(
      doc,
      scene,
      frameImages[sceneIndex] ?? null,
      { x: MARGIN, y: cardY, w: contentW, h: cardH },
      !sharedEnv
    );
  }
}

/** PDF storyboard — cover page + large frame cards (2 scenes per page). */
export async function exportStoryboardPdf(
  script: string,
  settings: StoryboardProjectSettings,
  scenes: StoryboardScene[]
): Promise<void> {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const totalDuration = ordered.reduce((sum, s) => sum + s.durationSec, 0);
  const sharedEnv = sharedEnvironment(ordered);

  const frameImages: (string | null)[] = [];
  for (const scene of ordered) {
    let dataUrl: string | null = null;
    if (scene.frameImageUrl?.trim()) {
      const blob = await fetchImageBlob(scene.frameImageUrl);
      if (blob) dataUrl = await blobToDataUrl(blob);
    }
    frameImages.push(dataUrl);
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const cardsPerPage = 2;
  const scenePages = Math.max(1, Math.ceil(ordered.length / cardsPerPage));
  const totalPages = 1 + scenePages;

  drawCoverPage(doc, script, settings, ordered, totalDuration, sharedEnv);
  drawPageFooter(doc, 1, totalPages);

  for (let page = 0; page < scenePages; page++) {
    doc.addPage();
    drawScenesPage(doc, ordered, frameImages, page * cardsPerPage, sharedEnv);
    drawPageFooter(doc, page + 2, totalPages);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`storyboard-${stamp}.pdf`);
}
