"use client";

import {
  useRef,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";
import type { CornerPreset } from "./logo-overlay";
export { TEXT_FONT_GROUPS, TEXT_FONT_OPTIONS } from "@/lib/overlay-fonts";

export type TextFontWeight = "400" | "600" | "700";
export type TextFontStyle = "normal" | "italic";
export type TextAlign = "left" | "center" | "right";

export interface TextOverlayState {
  content: string;
  /**
   * Horizontal anchor on the image in % (see textAlign).
   * left → left edge; center → horizontal center; right → right edge.
   */
  x: number;
  /** Top edge of text block in % of image height. */
  y: number;
  /** Font size in px at full image resolution (export size). */
  fontSize: number;
  fontFamily: string;
  fontWeight: TextFontWeight;
  fontStyle: TextFontStyle;
  color: string;
  textAlign: TextAlign;
}

export const DEFAULT_TEXT_OVERLAY: TextOverlayState = {
  content: "Your text",
  x: 8,
  y: 85,
  fontSize: 36,
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontWeight: "700",
  fontStyle: "normal",
  color: "#ffffff",
  textAlign: "left",
};

export const TEXT_WEIGHT_OPTIONS: { value: TextFontWeight; label: string }[] = [
  { value: "400", label: "Regular" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
];

export interface TextBoundsPct {
  widthPct: number;
  heightPct: number;
}

/** Convert anchor x when alignment changes so the text block stays in place. */
export function convertAnchorOnAlignChange(
  x: number,
  widthPct: number,
  from: TextAlign,
  to: TextAlign
): number {
  const leftX =
    from === "left" ? x : from === "center" ? x - widthPct / 2 : x - widthPct;
  if (to === "left") return leftX;
  if (to === "center") return leftX + widthPct / 2;
  return leftX + widthPct;
}

const POSITION_PAD = 5;

export function clampTextPosition(
  x: number,
  y: number,
  bounds: TextBoundsPct,
  align: TextAlign
): { x: number; y: number } {
  const { widthPct: w, heightPct: h } = bounds;
  const pad = POSITION_PAD;
  let minX = pad;
  let maxX = 100 - pad - w;
  if (align === "center") {
    minX = pad + w / 2;
    maxX = 100 - pad - w / 2;
  } else if (align === "right") {
    minX = pad + w;
    maxX = 100 - pad;
  }
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(pad, Math.min(100 - pad - h, y)),
  };
}

/**
 * Horizontal placement on the image for L / C / R (keeps current vertical position).
 */
export function getTextHorizontalAlignPosition(
  align: TextAlign,
  bounds: TextBoundsPct,
  y: number
): { x: number; y: number } {
  const { widthPct: w, heightPct: h } = bounds;
  const pad = POSITION_PAD;
  const clampedY = Math.max(pad, Math.min(100 - pad - h, y));
  let x: number;
  if (align === "left") {
    x = pad;
  } else if (align === "center") {
    x = 50;
  } else {
    x = 100 - pad;
  }
  return clampTextPosition(x, clampedY, bounds, align);
}

/**
 * Snap anchor to a corner or image center using measured text bounds (%).
 */
export function getTextPresetPosition(
  preset: CornerPreset,
  bounds: TextBoundsPct,
  align: TextAlign
): { x: number; y: number } {
  const { widthPct: w, heightPct: h } = bounds;
  const pad = POSITION_PAD;

  const anchorXForLeft = (leftPct: number) => {
    if (align === "left") return leftPct;
    if (align === "center") return leftPct + w / 2;
    return leftPct + w;
  };

  switch (preset) {
    case "tl":
      return { x: anchorXForLeft(pad), y: pad };
    case "tr":
      return { x: anchorXForLeft(100 - pad - w), y: pad };
    case "bl":
      return { x: anchorXForLeft(pad), y: 100 - pad - h };
    case "br":
      return { x: anchorXForLeft(100 - pad - w), y: 100 - pad - h };
    case "center":
      return {
        x: anchorXForLeft(50 - w / 2),
        y: Math.max(pad, 50 - h / 2),
      };
  }
}

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
    // Hard offset shadow (no blur) keeps letter edges sharp on PNG export.
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(line, anchorX + shadowOffset, lineY + shadowOffset);
    ctx.fillStyle = text.color;
    ctx.fillText(line, anchorX, lineY);
  });
  ctx.restore();
}

function buildTextOverlayPositionStyle(
  text: TextOverlayState
): Pick<CSSProperties, "left" | "right" | "top" | "transform"> {
  if (text.textAlign === "right") {
    return {
      top: `${text.y}%`,
      right: `${100 - text.x}%`,
      left: "auto",
    };
  }
  if (text.textAlign === "center") {
    return {
      top: `${text.y}%`,
      left: `${text.x}%`,
      transform: "translateX(-50%)",
    };
  }
  return {
    top: `${text.y}%`,
    left: `${text.x}%`,
  };
}

interface TextOverlayProps {
  text: TextOverlayState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  boundsRef?: React.RefObject<HTMLElement | null>;
  onChange: (patch: Partial<TextOverlayState>) => void;
  onBoundsChange?: (bounds: TextBoundsPct) => void;
}

export function TextOverlay({
  text,
  containerRef,
  boundsRef,
  onChange,
  onBoundsChange,
}: TextOverlayProps) {
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const textRef = useRef<HTMLDivElement>(null);
  const [displayFontPx, setDisplayFontPx] = useState(text.fontSize);

  useEffect(() => {
    const boundsEl = boundsRef?.current ?? containerRef.current;
    const textEl = textRef.current;
    if (!boundsEl || !textEl) return;

    const measure = () => {
      const rect = boundsEl.getBoundingClientRect();
      const img =
        boundsRef?.current instanceof HTMLImageElement
          ? boundsRef.current
          : null;
      const naturalW = img?.naturalWidth || rect.width;
      const scale = rect.width / naturalW;
      setDisplayFontPx(Math.max(8, text.fontSize * scale));

      const textRect = textEl.getBoundingClientRect();
      const widthPct = (textRect.width / rect.width) * 100;
      const heightPct = (textRect.height / rect.height) * 100;
      onBoundsChange?.({ widthPct, heightPct });

      if (!dragging.current) {
        const clamped = clampTextPosition(
          text.x,
          text.y,
          { widthPct, heightPct },
          text.textAlign
        );
        if (clamped.x !== text.x || clamped.y !== text.y) {
          onChange(clamped);
        }
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(boundsEl);
    ro.observe(textEl);
    if (boundsRef?.current instanceof HTMLImageElement && !boundsRef.current.complete) {
      boundsRef.current.addEventListener("load", measure);
    }
    return () => {
      ro.disconnect();
      if (boundsRef?.current instanceof HTMLImageElement) {
        boundsRef.current.removeEventListener("load", measure);
      }
    };
  }, [
    text.content,
    text.fontSize,
    text.fontFamily,
    text.fontWeight,
    text.fontStyle,
    text.textAlign,
    boundsRef,
    containerRef,
    onBoundsChange,
    onChange,
    text.x,
    text.y,
  ]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      dragOrigin.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: text.x,
        oy: text.y,
      };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [text.x, text.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const boundsEl = boundsRef?.current ?? containerRef.current;
      const textEl = textRef.current;
      if (!boundsEl || !textEl) return;
      const rect = boundsEl.getBoundingClientRect();
      const textRect = textEl.getBoundingClientRect();
      const wPct = (textRect.width / rect.width) * 100;
      const hPct = (textRect.height / rect.height) * 100;
      const dx = ((e.clientX - dragOrigin.current.mx) / rect.width) * 100;
      const dy = ((e.clientY - dragOrigin.current.my) / rect.height) * 100;
      const next = clampTextPosition(
        dragOrigin.current.ox + dx,
        dragOrigin.current.oy + dy,
        { widthPct: wPct, heightPct: hPct },
        text.textAlign
      );
      onChange(next);
    },
    [boundsRef, containerRef, onChange, text.textAlign]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={textRef}
      className="absolute max-w-[calc(100%-10%)] cursor-move select-none touch-none whitespace-pre-wrap break-words"
      style={{
        ...buildTextOverlayPositionStyle(text),
        fontFamily: text.fontFamily,
        fontSize: displayFontPx,
        fontWeight: text.fontWeight,
        fontStyle: text.fontStyle,
        color: text.color,
        lineHeight: 1.2,
        textShadow: "0 1px 4px rgba(0,0,0,0.65)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {text.content || "Your text"}
    </div>
  );
}

interface TextAlignButtonsProps {
  value: TextAlign;
  onChange: (align: TextAlign) => void;
}

export function TextAlignButtons({ value, onChange }: TextAlignButtonsProps) {
  const options: { key: TextAlign; label: string }[] = [
    { key: "left", label: "L" },
    { key: "center", label: "C" },
    { key: "right", label: "R" },
  ];
  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          title={`Place text on ${key}`}
          onClick={() => onChange(key)}
          className={cn(
            "h-8 min-w-8 rounded-lg border px-2 text-xs font-medium transition-colors",
            value === key
              ? "border-accent-violet bg-accent-violet/15 text-accent-violet"
              : "border-border bg-surface-elevated hover:border-accent-violet/40 hover:bg-surface-hover"
          )}
        >
          {label}
        </button>
      ))}
      </div>
      <p className="text-[10px] text-foreground-muted">
        Places text on the left, center, or right of the image.
      </p>
    </div>
  );
}

interface TextPositionButtonsProps {
  bounds: TextBoundsPct;
  align: TextAlign;
  onSelect: (pos: { x: number; y: number }) => void;
}

export function TextPositionButtons({
  bounds,
  align,
  onSelect,
}: TextPositionButtonsProps) {
  const corners: { key: CornerPreset; label: string }[] = [
    { key: "tl", label: "↖" },
    { key: "tr", label: "↗" },
    { key: "bl", label: "↙" },
    { key: "br", label: "↘" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {corners.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          title={`Snap to ${key}`}
          onClick={() => {
            const pos = getTextPresetPosition(key, bounds, align);
            onSelect(clampTextPosition(pos.x, pos.y, bounds, align));
          }}
          className={cn(
            "h-8 w-8 rounded-lg border border-border bg-surface-elevated text-base font-medium",
            "hover:border-accent-violet/40 hover:bg-surface-hover transition-colors"
          )}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        title="Snap to center"
        onClick={() => {
          const pos = getTextPresetPosition("center", bounds, align);
          onSelect(clampTextPosition(pos.x, pos.y, bounds, align));
        }}
        className="h-8 rounded-lg border border-border bg-surface-elevated px-2.5 text-[10px] font-medium hover:border-accent-violet/40 hover:bg-surface-hover"
      >
        Center
      </button>
    </div>
  );
}
