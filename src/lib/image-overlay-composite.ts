import type { LogoState } from "@/components/workspace/logo-overlay";
import {
  drawTextOnCanvas,
  ensureTextFontLoaded,
  type TextOverlayState,
} from "@/components/workspace/text-overlay";

async function fetchAsObjectUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawLogoOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  logo: LogoState,
  logoImg: HTMLImageElement
) {
  const logoW = (logo.size / 100) * img.naturalWidth;
  const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
  const logoX = (logo.x / 100) * img.naturalWidth;
  const logoY = (logo.y / 100) * img.naturalHeight;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const upscale = Math.max(
    logoW / Math.max(1, logoImg.naturalWidth),
    logoH / Math.max(1, logoImg.naturalHeight)
  );
  const drawScale = upscale > 1 ? 1 / upscale : 1;
  const drawW = Math.max(1, Math.round(logoW * drawScale));
  const drawH = Math.max(1, Math.round(logoH * drawScale));
  const drawX = Math.round(logoX);
  const drawY = Math.round(logoY);
  ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
}

export interface ImageOverlayOptions {
  logo?: LogoState;
  text?: TextOverlayState;
}

/**
 * Composite optional logo and/or text onto imageSrc and return a PNG blob.
 */
export async function compositeOverlaysOnImage(
  imageSrc: string,
  overlays: ImageOverlayOptions
): Promise<Blob> {
  const imgObjectUrl = await fetchAsObjectUrl(imageSrc);
  const img = await loadImage(imgObjectUrl);

  let logoImg: HTMLImageElement | null = null;
  let logoObjectUrl: string | null = null;
  if (overlays.logo) {
    logoObjectUrl = await fetchAsObjectUrl(overlays.logo.dataUrl);
    logoImg = await loadImage(logoObjectUrl);
  }

  if (overlays.text) {
    await ensureTextFontLoaded(
      overlays.text,
      Math.max(8, Math.round(overlays.text.fontSize))
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, 0, 0);

  if (overlays.text) {
    drawTextOnCanvas(ctx, img.naturalWidth, img.naturalHeight, overlays.text);
  }

  if (overlays.logo && logoImg) {
    drawLogoOnCanvas(ctx, img, overlays.logo, logoImg);
  }

  if (!imageSrc.startsWith("data:")) URL.revokeObjectURL(imgObjectUrl);
  if (logoObjectUrl && !overlays.logo?.dataUrl.startsWith("data:")) {
    URL.revokeObjectURL(logoObjectUrl);
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/png"
    )
  );
}

export async function compositeLogoOnImage(
  imageSrc: string,
  logo: LogoState
): Promise<Blob> {
  return compositeOverlaysOnImage(imageSrc, { logo });
}
