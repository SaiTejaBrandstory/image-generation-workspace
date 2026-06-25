import { jsPDF } from "jspdf";
import { formatStoryboardSceneLabel } from "@/lib/storyboard/bookend-scenes";
import { getDataUrlDimensions } from "@/lib/reference-image-dimensions";
import { getFrameStyleLabel } from "@/lib/storyboard/frame-styles";
import { nearestStoryboardAspectRatio } from "@/lib/storyboard/storyboard-image";
import type { AspectRatio } from "@/types";
import type { StoryboardProjectSettings, StoryboardScene } from "@/types/storyboard";

/** Warm paper + cinematic stage — distinct from prior header/sidebar layouts. */
const PAPER: [number, number, number] = [252, 250, 247];
const STAGE: [number, number, number] = [14, 14, 16];
const INK: [number, number, number] = [28, 25, 23];
const SUBTLE: [number, number, number] = [120, 113, 108];
const RULE: [number, number, number] = [232, 228, 223];
const STRIP: [number, number, number] = [245, 243, 240];
const BRAND: [number, number, number] = [234, 88, 12];
const WHITE: [number, number, number] = [255, 255, 255];

const SIDE = 14;
const FOOTER = 7;

interface FrameExportAsset {
  dataUrl: string | null;
  aspectRatio: number;
  aspectLabel: AspectRatio;
}

interface PageBox {
  w: number;
  h: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function pdfSafe(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00B7/g, "-")
    .replace(/[^\t\n\r\x20-\x7E]/g, "");
}

function titleCase(value: string): string {
  return pdfSafe(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function truncate(text: string, max: number): string {
  const t = pdfSafe(text).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 3)}...`;
}

function aspectToNumber(ratio?: AspectRatio | null): number {
  if (!ratio || ratio === "auto") return 16 / 9;
  const [w, h] = ratio.split(":").map(Number);
  return w && h ? w / h : 16 / 9;
}

function settingsAspect(settings: StoryboardProjectSettings): AspectRatio {
  if (settings.imageAspectRatio && settings.imageAspectRatio !== "auto") {
    return settings.imageAspectRatio;
  }
  return "16:9";
}

function fitInBox(maxW: number, maxH: number, aspect: number) {
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

function pageBox(doc: jsPDF): PageBox {
  return {
    w: doc.internal.pageSize.getWidth(),
    h: doc.internal.pageSize.getHeight(),
  };
}

function fillPage(doc: jsPDF, color: [number, number, number]) {
  const { w, h } = pageBox(doc);
  doc.setFillColor(...color);
  doc.rect(0, 0, w, h, "F");
}

async function loadFrame(
  url: string,
  fallbackAspect: number,
  fallbackLabel: AspectRatio
): Promise<FrameExportAsset> {
  const empty: FrameExportAsset = {
    dataUrl: null,
    aspectRatio: fallbackAspect,
    aspectLabel: fallbackLabel,
  };
  const blob = await fetchImageBlob(url);
  if (!blob) return empty;

  const dataUrl = await blobToDataUrl(blob);
  try {
    const { width, height } = await getDataUrlDimensions(dataUrl);
    if (width > 0 && height > 0) {
      return {
        dataUrl,
        aspectRatio: width / height,
        aspectLabel: nearestStoryboardAspectRatio(width, height),
      };
    }
  } catch {
    /* fall through */
  }
  return { ...empty, dataUrl };
}

function sharedEnvironment(scenes: StoryboardScene[]): string | null {
  const values = scenes.map((s) => s.environment.trim()).filter(Boolean);
  if (!values.length) return null;
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}

// ── Drawing primitives ──────────────────────────────────────────────────────

function drawRule(doc: jsPDF, y: number, inset = SIDE) {
  const { w } = pageBox(doc);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.25);
  doc.line(inset, y, w - inset, y);
}

function drawFooter(doc: jsPDF, page: number, total: number, label: string) {
  const { w, h } = pageBox(doc);
  const y = h - 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...SUBTLE);
  doc.text(pdfSafe(label), SIDE, y);
  doc.text(`${page} / ${total}`, w - SIDE, y, { align: "right" });
}

function drawStatCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  caption: string
) {
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(pdfSafe(value), x + w / 2, y + h * 0.42, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  doc.text(pdfSafe(caption).toUpperCase(), x + w / 2, y + h * 0.72, {
    align: "center",
  });
}

function drawStripCell(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  maxLines: number
): void {
  const safe = pdfSafe(value).trim();
  if (!safe) return;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...BRAND);
  doc.text(pdfSafe(label).toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  const lines = (doc.splitTextToSize(safe, w - 2) as string[]).slice(
    0,
    maxLines
  );
  doc.text(lines, x, y + 3.5);
}

// ── Cover — centered production summary ─────────────────────────────────────

function drawCover(
  doc: jsPDF,
  script: string,
  settings: StoryboardProjectSettings,
  scenes: StoryboardScene[],
  totalDuration: number,
  sharedEnv: string | null,
  aspectLabel: AspectRatio
) {
  const { w, h } = pageBox(doc);
  const contentW = w - SIDE * 2;
  fillPage(doc, PAPER);

  let y = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND);
  doc.text("PRODUCTION DECK", w / 2, y, { align: "center" });

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...INK);
  doc.text("Storyboard", w / 2, y, { align: "center" });

  y += 5;
  doc.setFillColor(...BRAND);
  doc.rect(w / 2 - 18, y, 36, 0.7, "F");

  y += 14;
  const cardW = (contentW - 18) / 4;
  const cardH = 22;
  const cards = [
    { value: String(scenes.length), caption: "Scenes" },
    { value: `${totalDuration}s`, caption: "Runtime" },
    { value: titleCase(settings.genre), caption: "Genre" },
    { value: aspectLabel, caption: "Frame ratio" },
  ];
  cards.forEach((card, i) => {
    drawStatCard(doc, SIDE + i * (cardW + 6), y, cardW, cardH, card.value, card.caption);
  });

  y += cardH + 14;
  drawRule(doc, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE);
  doc.text("CREATIVE BRIEF", SIDE, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const brief = pdfSafe(script.trim() || "No script provided.");
  const briefLines = doc.splitTextToSize(brief, contentW) as string[];
  doc.text(briefLines.slice(0, 6), SIDE, y);
  y += Math.min(briefLines.length, 6) * 4.2 + 10;

  if (sharedEnv) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SUBTLE);
    doc.text("ENVIRONMENT", SIDE, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const envLines = doc.splitTextToSize(pdfSafe(sharedEnv), contentW) as string[];
    doc.text(envLines.slice(0, 2), SIDE, y);
    y += envLines.length * 4 + 10;
  }

  drawRule(doc, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE);
  doc.text("SCENE LIST", SIDE, y);
  y += 6;

  const colW = (contentW - 10) / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  scenes.forEach((scene, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = SIDE + col * (colW + 10);
    const cy = y + row * 5;
    if (cy > h - FOOTER - 10) return;

    const label = formatStoryboardSceneLabel(scene, scenes);
    doc.setTextColor(...INK);
    doc.text(
      pdfSafe(
        `${label}  ·  ${scene.durationSec}s  ·  ${truncate(scene.visualDescription || scene.voiceover, 42)}`
      ),
      cx,
      cy
    );
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  doc.text(
    pdfSafe(
      `${getFrameStyleLabel(settings.frameStyle)}  ·  Exported ${new Date().toLocaleDateString()}`
    ),
    w / 2,
    h - FOOTER - 2,
    { align: "center" }
  );
}

// ── Scene page — cinematic stage + production strip ─────────────────────────

function drawScenePage(
  doc: jsPDF,
  scene: StoryboardScene,
  allScenes: StoryboardScene[],
  frame: FrameExportAsset,
  showEnvironment: boolean
) {
  const { w, h } = pageBox(doc);
  fillPage(doc, PAPER);

  const label = formatStoryboardSceneLabel(scene, allScenes);
  const cameraLine = [
    scene.cameraDirection,
    scene.cameraMovement,
    scene.cameraAngle,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" · ");

  const stripH = showEnvironment && scene.environment.trim() ? 52 : 44;
  const topBarH = 11;
  const stageTop = topBarH + 4;
  const stageH = h - stageTop - stripH - FOOTER - 2;

  // Top bar
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, w, topBarH, "F");
  drawRule(doc, topBarH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(pdfSafe(label), SIDE, 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUBTLE);
  const meta = pdfSafe(
    [
      `${scene.durationSec}s`,
      titleCase(scene.emotion),
      titleCase(scene.transition),
      frame.aspectLabel,
    ].join("  ·  ")
  );
  doc.text(meta, w - SIDE, 7.5, { align: "right" });

  // Cinematic stage (letterbox background — image has no border/shadow)
  doc.setFillColor(...STAGE);
  doc.rect(0, stageTop, w, stageH, "F");

  const stagePad = 6;
  const fitted = fitInBox(
    w - stagePad * 2,
    stageH - stagePad * 2,
    frame.aspectRatio
  );
  const imgX = (w - fitted.w) / 2;
  const imgY = stageTop + (stageH - fitted.h) / 2;

  if (frame.dataUrl) {
    doc.addImage(
      frame.dataUrl,
      imageFormat(frame.dataUrl),
      imgX,
      imgY,
      fitted.w,
      fitted.h,
      undefined,
      "SLOW"
    );
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 105);
    doc.text("Frame not generated", w / 2, stageTop + stageH / 2, {
      align: "center",
    });
  }

  // Production info strip
  const stripY = stageTop + stageH;
  doc.setFillColor(...STRIP);
  doc.rect(0, stripY, w, stripH + FOOTER, "F");
  drawRule(doc, stripY);

  const pad = SIDE;
  const gap = 8;
  const col4 = (w - pad * 2 - gap * 3) / 4;
  const row1Y = stripY + 7;
  const row2Y = stripY + 28;

  drawStripCell(doc, "Voiceover", scene.voiceover, pad, row1Y, col4, 3);
  drawStripCell(
    doc,
    "Visual",
    scene.visualDescription,
    pad + col4 + gap,
    row1Y,
    col4,
    3
  );
  drawStripCell(doc, "Camera", cameraLine, pad + (col4 + gap) * 2, row1Y, col4, 3);
  drawStripCell(
    doc,
    "Action",
    scene.characterActions,
    pad + (col4 + gap) * 3,
    row1Y,
    col4,
    3
  );

  if (showEnvironment && scene.environment.trim()) {
    drawStripCell(
      doc,
      "Environment",
      truncate(scene.environment, 180),
      pad,
      row2Y,
      w - pad * 2,
      2
    );
  }
}

// ── Export ──────────────────────────────────────────────────────────────────

/** Storyboard PDF — cover summary + one scene per page (cinematic stage layout). */
export async function exportStoryboardPdf(
  script: string,
  settings: StoryboardProjectSettings,
  scenes: StoryboardScene[]
): Promise<void> {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const totalDuration = ordered.reduce((sum, s) => sum + s.durationSec, 0);
  const sharedEnv = sharedEnvironment(ordered);
  const fallbackAspect = aspectToNumber(settings.imageAspectRatio);
  const fallbackLabel = settingsAspect(settings);

  const frames: FrameExportAsset[] = [];
  for (const scene of ordered) {
    if (scene.frameImageUrl?.trim()) {
      frames.push(await loadFrame(scene.frameImageUrl, fallbackAspect, fallbackLabel));
    } else {
      frames.push({
        dataUrl: null,
        aspectRatio: fallbackAspect,
        aspectLabel: fallbackLabel,
      });
    }
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const totalPages = 1 + ordered.length;

  drawCover(
    doc,
    script,
    settings,
    ordered,
    totalDuration,
    sharedEnv,
    fallbackLabel
  );
  drawFooter(doc, 1, totalPages, "Cover");

  for (let i = 0; i < ordered.length; i++) {
    doc.addPage();
    drawScenePage(
      doc,
      ordered[i]!,
      ordered,
      frames[i] ?? {
        dataUrl: null,
        aspectRatio: fallbackAspect,
        aspectLabel: fallbackLabel,
      },
      !sharedEnv
    );
    drawFooter(
      doc,
      i + 2,
      totalPages,
      formatStoryboardSceneLabel(ordered[i]!, ordered)
    );
  }

  doc.save(`storyboard-${new Date().toISOString().slice(0, 10)}.pdf`);
}
