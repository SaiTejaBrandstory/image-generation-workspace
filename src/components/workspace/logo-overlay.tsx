"use client";

import { useRef, useCallback, useEffect } from "react";
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

export type CornerPreset = "tl" | "tr" | "bl" | "br" | "center";
export type LogoHorizontalAlign = "left" | "center" | "right";

export interface LogoBoundsPct {
  widthPct: number;
  heightPct: number;
}

const POSITION_PAD = 5;

/** @deprecated Use getLogoPresetPosition with measured bounds */
export function getPresetPosition(
  preset: CornerPreset,
  size: number
): { x: number; y: number } {
  return getLogoPresetPosition(preset, { widthPct: size, heightPct: size });
}

export function estimateLogoBounds(
  logo: LogoState,
  imageAspect = 1
): LogoBoundsPct {
  const w = logo.size;
  const logoAspect =
    logo.sourceWidth && logo.sourceHeight
      ? logo.sourceHeight / logo.sourceWidth
      : 1;
  const h = (w * logoAspect) / Math.max(0.25, imageAspect);
  return { widthPct: w, heightPct: h };
}

export function clampLogoPosition(
  x: number,
  y: number,
  bounds: LogoBoundsPct
): { x: number; y: number } {
  const { widthPct: w, heightPct: h } = bounds;
  const pad = POSITION_PAD;
  return {
    x: Math.max(pad, Math.min(100 - pad - w, x)),
    y: Math.max(pad, Math.min(100 - pad - h, y)),
  };
}

/** Horizontal placement for L / C / R (keeps current vertical position). */
export function getLogoHorizontalAlignPosition(
  align: LogoHorizontalAlign,
  bounds: LogoBoundsPct,
  y: number
): { x: number; y: number } {
  const { widthPct: w, heightPct: h } = bounds;
  const pad = POSITION_PAD;
  const clampedY = Math.max(pad, Math.min(100 - pad - h, y));
  let x: number;
  if (align === "left") {
    x = pad;
  } else if (align === "center") {
    x = 50 - w / 2;
  } else {
    x = 100 - pad - w;
  }
  return clampLogoPosition(x, clampedY, bounds);
}

export function getLogoPresetPosition(
  preset: CornerPreset,
  bounds: LogoBoundsPct
): { x: number; y: number } {
  const { widthPct: w, heightPct: h } = bounds;
  const pad = POSITION_PAD;

  switch (preset) {
    case "tl":
      return { x: pad, y: pad };
    case "tr":
      return { x: 100 - pad - w, y: pad };
    case "bl":
      return { x: pad, y: 100 - pad - h };
    case "br":
      return { x: 100 - pad - w, y: 100 - pad - h };
    case "center":
      return {
        x: 50 - w / 2,
        y: Math.max(pad, 50 - h / 2),
      };
  }
}

interface LogoOverlayProps {
  logo: LogoState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  boundsRef?: React.RefObject<HTMLElement | null>;
  onChange: (patch: Partial<LogoState>) => void;
  onBoundsChange?: (bounds: LogoBoundsPct) => void;
}

export function LogoOverlay({
  logo,
  containerRef,
  boundsRef,
  onChange,
  onBoundsChange,
}: LogoOverlayProps) {
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundsEl = boundsRef?.current ?? containerRef.current;
    const logoEl = logoRef.current;
    if (!boundsEl || !logoEl) return;

    const measure = () => {
      const rect = boundsEl.getBoundingClientRect();
      const logoRect = logoEl.getBoundingClientRect();
      const widthPct = (logoRect.width / rect.width) * 100;
      const heightPct = (logoRect.height / rect.height) * 100;
      onBoundsChange?.({ widthPct, heightPct });

      if (!dragging.current) {
        const clamped = clampLogoPosition(logo.x, logo.y, {
          widthPct,
          heightPct,
        });
        if (clamped.x !== logo.x || clamped.y !== logo.y) {
          onChange(clamped);
        }
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(boundsEl);
    ro.observe(logoEl);
    if (
      boundsRef?.current instanceof HTMLImageElement &&
      !boundsRef.current.complete
    ) {
      boundsRef.current.addEventListener("load", measure);
    }
    return () => {
      ro.disconnect();
      if (boundsRef?.current instanceof HTMLImageElement) {
        boundsRef.current.removeEventListener("load", measure);
      }
    };
  }, [
    logo.x,
    logo.y,
    logo.size,
    logo.dataUrl,
    boundsRef,
    containerRef,
    onBoundsChange,
    onChange,
  ]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      dragOrigin.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: logo.x,
        oy: logo.y,
      };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [logo.x, logo.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const boundsEl = boundsRef?.current ?? containerRef.current;
      const logoEl = logoRef.current;
      if (!boundsEl || !logoEl) return;
      const rect = boundsEl.getBoundingClientRect();
      const logoRect = logoEl.getBoundingClientRect();
      const wPct = (logoRect.width / rect.width) * 100;
      const hPct = (logoRect.height / rect.height) * 100;
      const dx = ((e.clientX - dragOrigin.current.mx) / rect.width) * 100;
      const dy = ((e.clientY - dragOrigin.current.my) / rect.height) * 100;
      onChange(
        clampLogoPosition(
          dragOrigin.current.ox + dx,
          dragOrigin.current.oy + dy,
          { widthPct: wPct, heightPct: hPct }
        )
      );
    },
    [boundsRef, containerRef, onChange]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={logoRef}
      className="absolute cursor-move select-none touch-none"
      style={{ left: `${logo.x}%`, top: `${logo.y}%`, width: `${logo.size}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <img
        src={logo.dataUrl}
        alt="Logo overlay"
        className="block h-auto w-full pointer-events-none"
        draggable={false}
      />
    </div>
  );
}

interface LogoAlignButtonsProps {
  value: LogoHorizontalAlign;
  onChange: (align: LogoHorizontalAlign) => void;
}

export function LogoAlignButtons({ value, onChange }: LogoAlignButtonsProps) {
  const options: { key: LogoHorizontalAlign; label: string }[] = [
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
            title={`Place logo on ${key}`}
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
        Places logo on the left, center, or right of the image.
      </p>
    </div>
  );
}

interface LogoPositionButtonsProps {
  bounds: LogoBoundsPct;
  onSelect: (pos: { x: number; y: number }) => void;
}

export function LogoPositionButtons({
  bounds,
  onSelect,
}: LogoPositionButtonsProps) {
  const corners: { key: CornerPreset; label: string }[] = [
    { key: "tl", label: "↖" },
    { key: "tr", label: "↗" },
    { key: "bl", label: "↙" },
    { key: "br", label: "↘" },
  ];
  const snap = (preset: CornerPreset) => {
    const pos = getLogoPresetPosition(preset, bounds);
    onSelect(clampLogoPosition(pos.x, pos.y, bounds));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {corners.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          title={`Snap to ${key}`}
          onClick={() => snap(key)}
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
        onClick={() => snap("center")}
        className="h-8 rounded-lg border border-border bg-surface-elevated px-2.5 text-[10px] font-medium hover:border-accent-violet/40 hover:bg-surface-hover"
      >
        Center
      </button>
    </div>
  );
}

/** @deprecated Use LogoPositionButtons */
export function CornerPresetButtons({
  size,
  onSelect,
}: {
  size: number;
  onSelect: (pos: { x: number; y: number }) => void;
}) {
  return (
    <LogoPositionButtons
      bounds={{ widthPct: size, heightPct: size }}
      onSelect={onSelect}
    />
  );
}
