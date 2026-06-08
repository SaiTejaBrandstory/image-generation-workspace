import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StoryboardProjectSettings, StoryboardScene } from "@/types/storyboard";

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

/** PDF storyboard: script + table with embedded frame images (same layout as HTML export). */
export async function exportStoryboardPdf(
  script: string,
  settings: StoryboardProjectSettings,
  scenes: StoryboardScene[]
): Promise<void> {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const totalDuration = ordered.reduce((sum, s) => sum + s.durationSec, 0);

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
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Storyboard", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `${ordered.length} scenes · ${totalDuration}s · ${settings.genre}`,
    margin,
    y
  );
  y += 8;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Script", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const scriptText = script.trim() || "(no script)";
  const scriptLines = doc.splitTextToSize(scriptText, contentW) as string[];
  const scriptBlockH = scriptLines.length * 3.6 + 4;

  if (y + scriptBlockH > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(246, 246, 246);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(margin, y - 3, contentW, scriptBlockH, 2, 2, "FD");
  doc.text(scriptLines, margin + 3, y + 2);
  y += scriptBlockH + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Scenes", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    margin: { left: margin, right: margin },
    head: [
      [
        "#",
        "Frame",
        "Dur.",
        "Voiceover",
        "Visual",
        "Shot",
        "Actions",
        "Environment",
        "Emotion",
        "Transition",
      ],
    ],
    body: ordered.map((scene) => [
      String(scene.sceneNumber),
      "",
      `${scene.durationSec}s`,
      scene.voiceover,
      scene.visualDescription,
      scene.cameraDirection,
      scene.characterActions,
      scene.environment,
      scene.emotion,
      scene.transition,
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [20, 20, 20],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 44 },
      2: { cellWidth: 11 },
      3: { cellWidth: 32 },
      4: { cellWidth: 32 },
      5: { cellWidth: 18 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
      8: { cellWidth: 16 },
      9: { cellWidth: 16 },
    },
    bodyStyles: { minCellHeight: 36 },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const img = frameImages[data.row.index];
      if (!img) {
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        doc.text("No frame", data.cell.x + 2, data.cell.y + 8);
        doc.setTextColor(0, 0, 0);
        return;
      }
      const pad = 1.5;
      const maxW = data.cell.width - pad * 2;
      const maxH = data.cell.height - pad * 2;
      const aspect = 16 / 9;
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      doc.addImage(
        img,
        imageFormat(img),
        data.cell.x + pad,
        data.cell.y + pad,
        w,
        h
      );
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`storyboard-${stamp}.pdf`);
}
