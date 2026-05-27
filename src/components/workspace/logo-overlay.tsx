"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface LogoState {
  dataUrl: string;
  /** Original uploaded logo dimensions in pixels (used for quality-safe sizing). */
  sourceWidth?: number;
  sourceHeight?: number;
  /** top-left corner as % of container width/height */
  x: number;
  y: number;
  /** logo width as % of container width */
  size: number;
}

// Preset positions: { x, y } as percentage of container.
// x = left edge, y = top edge. size (default 20%) is factored in.
export type CornerPreset = "tl" | "tr" | "bl" | "br" | "center";

export function getPresetPosition(
  preset: CornerPreset,
  size: number
): { x: number; y: number } {
  const pad = 3;
  switch (preset) {
    case "tl":
      return { x: pad, y: pad };
    case "tr":
      return { x: 100 - size - pad, y: pad };
    case "bl":
      return { x: pad, y: 100 - size - pad };
    case "br":
      return { x: 100 - size - pad, y: 100 - size - pad };
    case "center":
      return { x: 50 - size / 2, y: 50 - size / 2 };
  }
}

interface LogoOverlayProps {
  logo: LogoState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Prefer the actual rendered image element for bounds (fixes letterboxing). */
  boundsRef?: React.RefObject<HTMLElement | null>;
  onChange: (patch: Partial<LogoState>) => void;
}

export function LogoOverlay({
  logo,
  containerRef,
  boundsRef,
  onChange,
}: LogoOverlayProps) {
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: logo.x, oy: logo.y };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [logo.x, logo.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const boundsEl = boundsRef?.current ?? containerRef.current;
      if (!boundsEl) return;
      const rect = boundsEl.getBoundingClientRect();
      const logoRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const logoWidthPct = (logoRect.width / rect.width) * 100;
      const logoHeightPct = (logoRect.height / rect.height) * 100;
      const dx = ((e.clientX - dragOrigin.current.mx) / rect.width) * 100;
      const dy = ((e.clientY - dragOrigin.current.my) / rect.height) * 100;
      onChange({
        x: Math.max(0, Math.min(100 - logoWidthPct, dragOrigin.current.ox + dx)),
        y: Math.max(0, Math.min(100 - logoHeightPct, dragOrigin.current.oy + dy)),
      });
    },
    [boundsRef, containerRef, onChange]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="absolute cursor-move select-none touch-none"
      style={{ left: `${logo.x}%`, top: `${logo.y}%`, width: `${logo.size}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* drag-handle ring */}
      <div className="absolute inset-0 rounded-sm ring-2 ring-white/50 ring-offset-1 ring-offset-black/30 pointer-events-none" />
      <img
        src={logo.dataUrl}
        alt="Logo overlay"
        className="w-full h-auto pointer-events-none block"
        draggable={false}
      />
    </div>
  );
}

// ── Canvas compositing utility ──────────────────────────────────────────────

/**
 * Fetch any URL (including signed Supabase URLs which block cross-origin canvas
 * reads) as a blob and convert it to a local object URL so canvas can draw it.
 */
async function fetchAsObjectUrl(src: string): Promise<string> {
  // data: URLs are already local — no fetch needed
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

/**
 * Composite logo on top of imageSrc and return a PNG Blob.
 * Fetches the image via fetch() first to bypass canvas CORS restrictions on
 * signed Supabase storage URLs.
 */
export async function compositeLogoOnImage(
  imageSrc: string,
  logo: LogoState
): Promise<Blob> {
  // Fetch both resources as local object URLs to avoid canvas taint
  const [imgObjectUrl, logoObjectUrl] = await Promise.all([
    fetchAsObjectUrl(imageSrc),
    fetchAsObjectUrl(logo.dataUrl),
  ]);

  const [img, logoImg] = await Promise.all([
    loadImage(imgObjectUrl),
    loadImage(logoObjectUrl),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, 0, 0);

  const logoW = (logo.size / 100) * img.naturalWidth;
  const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
  const logoX = (logo.x / 100) * img.naturalWidth;
  const logoY = (logo.y / 100) * img.naturalHeight;

  // Use high-quality interpolation to avoid jagged logo edges.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Avoid upscaling low-res logos on export (upscale causes blurry text/edges).
  // If requested draw size exceeds source pixels, cap to native logo resolution.
  const upscale = Math.max(
    logoW / Math.max(1, logoImg.naturalWidth),
    logoH / Math.max(1, logoImg.naturalHeight)
  );
  const drawScale = upscale > 1 ? 1 / upscale : 1;
  // Snap destination rect to whole pixels to avoid subpixel softening.
  const drawW = Math.max(1, Math.round(logoW * drawScale));
  const drawH = Math.max(1, Math.round(logoH * drawScale));
  const drawX = Math.round(logoX);
  const drawY = Math.round(logoY);
  ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);

  // Revoke object URLs only after canvas has finished drawing
  if (!imageSrc.startsWith("data:")) URL.revokeObjectURL(imgObjectUrl);
  if (!logo.dataUrl.startsWith("data:")) URL.revokeObjectURL(logoObjectUrl);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/png"
    )
  );
}

// ── Corner-preset button row ─────────────────────────────────────────────────

interface CornerPresetButtonsProps {
  size: number;
  onSelect: (pos: { x: number; y: number }) => void;
}

export function CornerPresetButtons({ size, onSelect }: CornerPresetButtonsProps) {
  const presets: { key: CornerPreset; label: string }[] = [
    { key: "tl", label: "↖" },
    { key: "tr", label: "↗" },
    { key: "bl", label: "↙" },
    { key: "br", label: "↘" },
  ];
  return (
    <div className="flex gap-1.5">
      {presets.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          title={`Snap to ${key === "tl" ? "top-left" : key === "tr" ? "top-right" : key === "bl" ? "bottom-left" : "bottom-right"}`}
          onClick={() => onSelect(getPresetPosition(key, size))}
          className={cn(
            "h-8 w-8 rounded-lg border border-border bg-surface-elevated text-base font-medium",
            "hover:border-accent-violet/40 hover:bg-surface-hover transition-colors"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
