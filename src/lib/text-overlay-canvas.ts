import type { TextOverlayState } from "@/lib/text-overlay-types";

export function buildCanvasFont(
  text: TextOverlayState,
  fontPx: number
): string {
  return `${text.fontStyle} ${text.fontWeight} ${fontPx}px ${text.fontFamily}`;
}

export async function ensureTextFontLoaded(
  text: TextOverlayState,
  fontPx: number
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const font = buildCanvasFont(text, fontPx);
  try {
    await document.fonts.load(font);
    await document.fonts.ready;
  } catch {
    /* fall back to system fonts */
  }
}

/**
 * Renders text at full image pixel dimensions (not screen preview size).
 * Uses integer pixel positions and a hard shadow + crisp fill for sharp exports.
 */
export function drawTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  text: TextOverlayState
) {
  const content = text.content.trim();
  if (!content) return;

  const fontPx = Math.max(8, Math.round(text.fontSize));
  const anchorX = Math.round((text.x / 100) * imgWidth);
  const baseY = Math.round((text.y / 100) * imgHeight);
  const lineHeight = Math.round(fontPx * 1.2);
  const shadowOffset = Math.max(1, Math.round(fontPx * 0.05));

  ctx.save();
  ctx.font = buildCanvasFont(text, fontPx);
  ctx.textAlign = text.textAlign;
  ctx.textBaseline = "top";

  const lines = content.split("\n");

  lines.forEach((line, i) => {
    const lineY = baseY + i * lineHeight;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(line, anchorX + shadowOffset, lineY + shadowOffset);
    ctx.fillStyle = text.color;
    ctx.fillText(line, anchorX, lineY);
  });
  ctx.restore();
}
