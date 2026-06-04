"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  RefreshCw,
  Loader2,
  Download,
  Layers,
  ArrowLeft,
  ImagePlus,
  Trash2,
  Type,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getChildVariations,
  isRootVariant,
  MAX_VARIATIONS,
  remainingVariationSlots,
} from "@/lib/variation-utils";
import { VariationCountStepper } from "./variation-count-stepper";
import { LAYOUT_MAP } from "@/lib/layout-systems";
import { buildImageFilename, downloadImage } from "@/lib/download-utils";
import { compositeOverlaysOnImage } from "@/lib/image-overlay-composite";
import { useWorkspaceStore } from "@/store/workspace-store";
import { GeneratedImage } from "./generated-image";
import { cn } from "@/lib/utils";
import type { LayoutVariant } from "@/types";
import {
  type LogoState,
  LogoOverlay,
  CornerPresetButtons,
  getPresetPosition,
} from "./logo-overlay";
import {
  type TextOverlayState,
  TextOverlay,
  TextAlignButtons,
  TextPositionButtons,
  getTextHorizontalAlignPosition,
  DEFAULT_TEXT_OVERLAY,
  TEXT_FONT_GROUPS,
  TEXT_WEIGHT_OPTIONS,
} from "./text-overlay";

function isRealImage(url?: string) {
  return (
    !!url &&
    (url.startsWith("data:image") ||
      url.startsWith("http://") ||
      url.startsWith("https://"))
  );
}

function isRealVideo(url?: string) {
  return (
    !!url &&
    (url.startsWith("data:video") ||
      url.startsWith("http://") ||
      url.startsWith("https://"))
  );
}

/** Root variants in chat order — used for prev/next in expand view */
function getNavigableRootVariants(variants: LayoutVariant[]): LayoutVariant[] {
  return variants
    .filter(isRootVariant)
    .sort((a, b) => {
      const ra = a.generationRound ?? 0;
      const rb = b.generationRound ?? 0;
      if (ra !== rb) return ra - rb;
      const sa = a.sortIndex ?? 0;
      const sb = b.sortIndex ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    });
}

export function ExpandedLayoutView() {
  const {
    expandedVariantId,
    expandedMode,
    setExpandedVariant,
    pushExpandedView,
    expandBack,
    expandedReturnTo,
    variants,
    regenerateVariant,
    generateVariations,
    generatingVariationsParentId,
    variationBatchSize,
    setVariationBatchSize,
    prompt: composerPrompt,
  } = useWorkspaceStore();

  const variant = variants.find((v) => v.id === expandedVariantId);
  const [editPrompt, setEditPrompt] = useState("");
  const [downloading, setDownloading] = useState(false);
  /** Which variation is previewed on the main canvas (null = parent layout) */
  const [previewVariationId, setPreviewVariationId] = useState<string | null>(
    null
  );
  const editSessionRef = useRef<string | null>(null);

  // ── Logo & text overlay state ─────────────────────────────────────────────
  const [logo, setLogo] = useState<LogoState | null>(null);
  const [textOverlay, setTextOverlay] = useState<TextOverlayState | null>(null);
  const [textBounds, setTextBounds] = useState({ widthPct: 25, heightPct: 8 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasImageRef = useRef<HTMLImageElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const maxQualitySafeLogoSize = (() => {
    if (!logo?.sourceWidth) return 50;
    const baseWidth = canvasImageRef.current?.naturalWidth ?? 0;
    if (!baseWidth) return 50;
    return Math.max(5, Math.min(50, (logo.sourceWidth / baseWidth) * 100));
  })();

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          setLogo({
            dataUrl,
            sourceWidth: img.naturalWidth,
            sourceHeight: img.naturalHeight,
            ...getPresetPosition("br", 20),
            size: 20,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    []
  );

  const updateTextOverlay = useCallback((patch: Partial<TextOverlayState>) => {
    setTextOverlay((prev) => (prev ? { ...prev, ...patch } : null));
  }, []);

  const updateLogo = useCallback((patch: Partial<LogoState>) => {
    setLogo((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...patch };
      // Keep within quality-safe upper bound to avoid export upscaling blur.
      if (typeof next.size === "number") {
        next.size = Math.max(5, Math.min(maxQualitySafeLogoSize, next.size));
      }
      return next;
    });
  }, [maxQualitySafeLogoSize]);

  useEffect(() => {
    setLogo((prev) => {
      if (!prev) return null;
      const clamped = Math.max(5, Math.min(maxQualitySafeLogoSize, prev.size));
      return clamped === prev.size ? prev : { ...prev, size: clamped };
    });
  }, [maxQualitySafeLogoSize]);

  useEffect(() => {
    setPreviewVariationId(null);
    setLogo(null);
    setTextOverlay(null);
  }, [expandedVariantId]);

  useEffect(() => {
    setLogo(null);
    setTextOverlay(null);
  }, [previewVariationId]);

  useEffect(() => {
    if (!expandedVariantId) return;
    const root = variants.find((v) => v.id === expandedVariantId);
    if (!root || root.parentVariantId) return;
    const left = remainingVariationSlots(
      getChildVariations(variants, root.id)
    );
    if (left > 0 && variationBatchSize > left) {
      setVariationBatchSize(left);
    }
  }, [
    expandedVariantId,
    variants,
    variationBatchSize,
    setVariationBatchSize,
  ]);

  // Initialize edit textarea only when opening edit mode — not on every variant update
  useEffect(() => {
    if (expandedMode !== "edit" || !expandedVariantId || !variant) {
      if (expandedMode !== "edit") {
        editSessionRef.current = null;
      }
      return;
    }

    const sessionKey = `${expandedVariantId}-edit`;
    if (editSessionRef.current === sessionKey) return;

    editSessionRef.current = sessionKey;
    const initial =
      variant.userPrompt?.trim() ||
      composerPrompt.trim() ||
      "";
    setEditPrompt(initial);
  }, [expandedMode, expandedVariantId, variant, composerPrompt]);

  const navigableRoots = getNavigableRootVariants(variants);
  const expandedForNav = expandedVariantId
    ? variants.find((v) => v.id === expandedVariantId)
    : undefined;
  const currentRootId = expandedForNav
    ? expandedForNav.parentVariantId ?? expandedForNav.id
    : null;
  const currentNavIndex =
    currentRootId != null
      ? navigableRoots.findIndex((v) => v.id === currentRootId)
      : -1;
  const canNavigateGallery =
    navigableRoots.length > 1 && currentNavIndex >= 0;

  const goToAdjacent = useCallback(
    (direction: -1 | 1) => {
      if (currentNavIndex < 0) return;
      const next = navigableRoots[currentNavIndex + direction];
      if (next) setExpandedVariant(next.id, "view");
    },
    [currentNavIndex, navigableRoots, setExpandedVariant]
  );

  useEffect(() => {
    if (!expandedVariantId || !canNavigateGallery || expandedMode !== "view")
      return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToAdjacent(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToAdjacent(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedVariantId, canNavigateGallery, expandedMode, goToAdjacent]);

  if (!variant) return null;

  const isFreeVariant = variant.layoutId === "free";
  const layout = isFreeVariant ? null : LAYOUT_MAP[variant.layoutId];
  const hasImage = isRealImage(variant.imageUrl);
  const isRoot = !variant.parentVariantId && variant.variantKind !== "variation";
  const childVariations = isRoot
    ? getChildVariations(variants, variant.id)
    : [];
  const variationCount = childVariations.length;
  const slotsLeft = isRoot ? remainingVariationSlots(childVariations) : 0;
  const variationsBusy =
    generatingVariationsParentId === variant.id ||
    childVariations.some(
      (v) => v.status === "generating" || v.status === "pending"
    );
  const hasVariations = variationCount > 0;
  const canGenerateMore =
    isRoot && hasImage && slotsLeft > 0 && !variationsBusy;
  const effectiveBatchMax = slotsLeft > 0 ? slotsLeft : MAX_VARIATIONS;
  const inFlightCount = childVariations.filter(
    (v) => v.status === "pending" || v.status === "generating"
  ).length;

  const previewVariation = previewVariationId
    ? childVariations.find((c) => c.id === previewVariationId)
    : null;
  const isVideoLayout =
    variant.mediaType === "video" || previewVariation?.mediaType === "video";
  const actionVariant =
    isRoot && previewVariation ? previewVariation : variant;
  const actionIsVariation =
    actionVariant.variantKind === "variation" ||
    Boolean(actionVariant.parentVariantId);
  const actionVariationLabel = actionIsVariation
    ? `Variation ${(actionVariant.variationIndex ?? 0) + 1}`
    : null;

  const displayPrompt =
    actionVariant.userPrompt || composerPrompt.trim();
  const isRegenerating = actionVariant.status === "generating";
  const actionsLocked = variationsBusy || isRegenerating;
  const showBack = Boolean(expandedReturnTo);
  const isVariation =
    variant.variantKind === "variation" || Boolean(variant.parentVariantId);
  const variationTitle = isVariation
    ? `Variation ${(variant.variationIndex ?? 0) + 1}`
    : null;

  const canvasVariant = previewVariation ?? variant;
  const canvasHasImage = isRealImage(canvasVariant.imageUrl);
  const canvasHasVideo = isRealVideo(canvasVariant.videoUrl);
  const canvasRegenerating = canvasVariant.status === "generating";
  const previewVariationLabel = previewVariation
    ? `Variation ${(previewVariation.variationIndex ?? 0) + 1}`
    : null;

  const canGoPrev = canNavigateGallery && currentNavIndex > 0;
  const canGoNext =
    canNavigateGallery && currentNavIndex < navigableRoots.length - 1;

  const handleRemix = () => {
    void regenerateVariant(actionVariant.id);
  };

  const handleEditRegenerate = () => {
    const trimmed = editPrompt.trim();
    if (!trimmed) return;
    void regenerateVariant(actionVariant.id, trimmed);
  };

  const openEditMode = () => {
    editSessionRef.current = null;
    const returnTarget =
      isRoot && previewVariation
        ? { variantId: variant.id, mode: "view" as const }
        : { variantId: variant.id, mode: "view" as const };
    pushExpandedView(actionVariant.id, "edit", returnTarget);
  };

  const handleDownload = async () => {
    const videoSrc = canvasVariant.videoUrl;
    const imageSrc = canvasVariant.imageUrl;
    if (!videoSrc && !imageSrc) return;
    setDownloading(true);
    try {
      if (videoSrc) {
        const res = await fetch(videoSrc);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "generated-video.mp4";
        a.click();
        URL.revokeObjectURL(url);
      } else if (imageSrc) {
        const suffix = previewVariation
          ? `-variation-${(previewVariation.variationIndex ?? 0) + 1}`
          : "";
        const filename = buildImageFilename(
          `${isFreeVariant ? "free-style" : layout?.name ?? variant.layoutId}${suffix}`,
          variant.layoutId
        );

        if (logo || textOverlay) {
          const blob = await compositeOverlaysOnImage(imageSrc, {
            logo: logo ?? undefined,
            text: textOverlay ?? undefined,
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download =
            filename.replace(/\.\w+$/, "") + "-with-overlays.png";
          a.click();
          URL.revokeObjectURL(url);
        } else {
          await downloadImage(imageSrc, filename);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex min-h-0 flex-col bg-black/90 backdrop-blur-md"
      onClick={() => setExpandedVariant(null)}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full min-h-0 w-full flex-col lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex min-h-[38dvh] flex-1 flex-col overflow-hidden lg:min-h-0">
          <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4 lg:left-8 lg:top-8">
            {showBack && (
              <button
                type="button"
                onClick={expandBack}
                className="flex h-10 items-center gap-1.5 rounded-full bg-surface-elevated px-3.5 text-sm font-medium text-foreground hover:bg-surface-hover"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                Back
              </button>
            )}
          </div>
          <div className="absolute right-3 top-3 z-20 flex max-w-[calc(100%-5rem)] flex-wrap items-center justify-end gap-1.5 sm:right-4 sm:top-4 sm:gap-2 lg:right-8 lg:top-8">
            {/* Add / remove logo & text — images only */}
            {canvasHasImage && (
              <>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                {logo ? (
                  <button
                    type="button"
                    onClick={() => setLogo(null)}
                    title="Remove logo"
                    className="flex h-10 items-center gap-1.5 rounded-full bg-accent-orange/15 px-3 text-xs font-medium text-accent-orange hover:bg-accent-orange/25"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove logo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    title="Add logo overlay"
                    className="flex h-10 items-center gap-1.5 rounded-full bg-surface-elevated px-3 text-xs font-medium text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Add logo
                  </button>
                )}
                {textOverlay ? (
                  <button
                    type="button"
                    onClick={() => setTextOverlay(null)}
                    title="Remove text"
                    className="flex h-10 items-center gap-1.5 rounded-full bg-accent-orange/15 px-3 text-xs font-medium text-accent-orange hover:bg-accent-orange/25"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove text
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setTextOverlay({ ...DEFAULT_TEXT_OVERLAY })
                    }
                    title="Add text overlay"
                    className="flex h-10 items-center gap-1.5 rounded-full bg-surface-elevated px-3 text-xs font-medium text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                  >
                    <Type className="h-4 w-4" />
                    Add text
                  </button>
                )}
              </>
            )}
            {(canvasHasImage || canvasHasVideo) && (
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                title={
                  logo || textOverlay ? "Download with overlays" : "Download"
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated hover:bg-surface-hover disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpandedVariant(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated hover:bg-surface-hover"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {canNavigateGallery && (
            <>
              <button
                type="button"
                onClick={() => goToAdjacent(-1)}
                disabled={!canGoPrev}
                aria-label="Previous image or video"
                className={cn(
                  "absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70 disabled:pointer-events-none disabled:opacity-25 lg:left-6 lg:h-12 lg:w-12"
                )}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => goToAdjacent(1)}
                disabled={!canGoNext}
                aria-label="Next image or video"
                className={cn(
                  "absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70 disabled:pointer-events-none disabled:opacity-25 lg:right-6 lg:h-12 lg:w-12"
                )}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <p className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium tabular-nums text-white/90 backdrop-blur-sm sm:bottom-4">
                {currentNavIndex + 1} / {navigableRoots.length}
              </p>
            </>
          )}

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-3 pb-3 pt-14 sm:px-6 sm:pt-16 lg:p-10 lg:pt-10">
          {canvasRegenerating ? (
            <div className="flex flex-col items-center gap-3 text-foreground-muted">
              <Loader2 className="h-10 w-10 animate-spin text-accent-violet" />
              <p className="text-sm">Regenerating with your prompt…</p>
            </div>
          ) : canvasHasVideo && canvasVariant.videoUrl ? (
            <video
              src={canvasVariant.videoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-full max-w-full rounded-2xl shadow-2xl lg:max-h-[85vh]"
            />
          ) : canvasHasImage && canvasVariant.imageUrl ? (
            <div
              ref={canvasContainerRef}
              className="relative w-fit max-w-full overflow-hidden rounded-[24px]"
            >
              {/* Render img directly so logo drag bounds match the visible image box. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={canvasImageRef}
                src={canvasVariant.imageUrl}
                alt={
                  previewVariationLabel ??
                  (isFreeVariant ? "Free Style" : layout?.name) ??
                  "Layout"
                }
                className="block h-auto max-h-full w-auto max-w-[min(100%,calc(100vw-1.5rem))] rounded-[24px] object-contain shadow-cinematic lg:max-h-[85vh] lg:max-w-[min(100%,calc(100vw-28rem))]"
              />
              {textOverlay && (
                <TextOverlay
                  text={textOverlay}
                  containerRef={canvasContainerRef}
                  boundsRef={canvasImageRef}
                  onChange={updateTextOverlay}
                  onBoundsChange={setTextBounds}
                />
              )}
              {logo && (
                <LogoOverlay
                  logo={logo}
                  containerRef={canvasContainerRef}
                  boundsRef={canvasImageRef}
                  onChange={updateLogo}
                />
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex h-[60vh] w-full max-w-lg items-center justify-center rounded-[32px] border border-border bg-gradient-to-br",
                layout?.gradient
              )}
            />
          )}
          </div>
        </div>

        <aside className="w-full max-h-[min(50dvh,520px)] shrink-0 overflow-y-auto border-t border-border bg-surface p-4 sm:p-6 lg:max-h-none lg:h-full lg:w-[420px] lg:border-l lg:border-t-0 lg:p-8 space-y-5">
          {/* Text overlay controls */}
          {textOverlay && canvasHasImage && (
            <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                  Text overlay
                </p>
                <button
                  type="button"
                  onClick={() => setTextOverlay(null)}
                  className="text-[10px] text-foreground-muted hover:text-accent-orange transition-colors"
                >
                  Remove
                </button>
              </div>

              <textarea
                value={textOverlay.content}
                onChange={(e) => updateTextOverlay({ content: e.target.value })}
                rows={2}
                placeholder="Enter text…"
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-violet/45"
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-foreground-muted">
                    Font family
                  </label>
                  <select
                    value={textOverlay.fontFamily}
                    onChange={(e) =>
                      updateTextOverlay({ fontFamily: e.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-accent-violet/45"
                  >
                    {TEXT_FONT_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.fonts.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-foreground-muted">
                    Weight
                  </label>
                  <select
                    value={textOverlay.fontWeight}
                    onChange={(e) =>
                      updateTextOverlay({
                        fontWeight: e.target.value as TextOverlayState["fontWeight"],
                      })
                    }
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-accent-violet/45"
                  >
                    {TEXT_WEIGHT_OPTIONS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-foreground-muted">
                    Style
                  </label>
                  <select
                    value={textOverlay.fontStyle}
                    onChange={(e) =>
                      updateTextOverlay({
                        fontStyle: e.target.value as TextOverlayState["fontStyle"],
                      })
                    }
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-accent-violet/45"
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-foreground-muted">
                    Color
                  </label>
                  <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2">
                    <input
                      type="color"
                      value={textOverlay.color}
                      onChange={(e) =>
                        updateTextOverlay({ color: e.target.value })
                      }
                      className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Text color"
                    />
                    <input
                      type="text"
                      value={textOverlay.color}
                      onChange={(e) =>
                        updateTextOverlay({ color: e.target.value })
                      }
                      className="min-w-0 flex-1 bg-transparent text-[10px] font-mono uppercase outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-foreground-muted">
                    Font size
                  </label>
                  <span className="text-[10px] tabular-nums text-foreground-muted">
                    {Math.round(textOverlay.fontSize)} px
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={1}
                  value={textOverlay.fontSize}
                  onChange={(e) =>
                    updateTextOverlay({ fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-accent-violet"
                />
                <p className="text-[10px] leading-snug text-foreground-muted">
                  Size is in pixels at full image resolution — downloads stay sharp
                  (preview may look softer when scaled down).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-foreground-muted">
                  Alignment
                </label>
                <TextAlignButtons
                  value={textOverlay.textAlign}
                  onChange={(textAlign) =>
                    updateTextOverlay({
                      textAlign,
                      ...getTextHorizontalAlignPosition(
                        textAlign,
                        textBounds,
                        textOverlay.y
                      ),
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-foreground-muted">
                  Position
                </label>
                <TextPositionButtons
                  bounds={textBounds}
                  align={textOverlay.textAlign}
                  onSelect={(pos) => updateTextOverlay(pos)}
                />
              </div>
            </div>
          )}

          {/* Logo controls — images only */}
          {logo && canvasHasImage && (
            <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                  Logo position
                </p>
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="text-[10px] text-foreground-muted hover:text-accent-orange transition-colors"
                >
                  Remove
                </button>
              </div>

              <CornerPresetButtons
                size={logo.size}
                onSelect={(pos) => updateLogo(pos)}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-foreground-muted">Size</label>
                  <span className="text-[10px] tabular-nums text-foreground-muted">{Math.round(logo.size)}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={Math.max(5, Math.floor(maxQualitySafeLogoSize))}
                  step={1}
                  value={logo.size}
                  onChange={(e) =>
                    updateLogo({ size: Number(e.target.value) })
                  }
                  className="w-full accent-accent-violet"
                />
                {logo.sourceWidth && (
                  <p className="text-[10px] leading-snug text-foreground-muted">
                    Quality-safe max: {Math.floor(maxQualitySafeLogoSize)}% for this logo on this image.
                  </p>
                )}
              </div>

            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground-muted mb-1">
              {expandedMode === "edit"
                ? "Edit & regenerate"
                : isVariation
                  ? "Variation"
                  : "Layout system"}
            </p>
            <h2 className="text-xl font-semibold">
              {expandedMode === "edit"
                ? isVideoLayout
                  ? "Video"
                  : isFreeVariant ? "Free Style" : layout?.name
                : (variationTitle ?? (isVideoLayout ? "Video" : isFreeVariant ? "Free Style" : layout?.name))}
            </h2>
            {isRoot && previewVariationLabel && expandedMode === "view" && (
              <p className="mt-1 text-sm text-accent-violet">
                Previewing {previewVariationLabel} — regenerate and edit apply
                to this variation only
              </p>
            )}
          </div>

          {expandedMode === "edit" ? (
            <div className="space-y-3">
              <label
                htmlFor="edit-layout-prompt"
                className="block text-[10px] font-medium uppercase tracking-widest text-foreground-muted"
              >
                Prompt for this layout
              </label>
              <textarea
                id="edit-layout-prompt"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={5}
                disabled={actionsLocked}
                className="w-full resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm leading-relaxed outline-none focus:border-accent-violet/50 disabled:opacity-50"
                placeholder="Describe what this layout should show…"
              />
              <p className="text-[11px] text-foreground-muted">
                Only this text is sent as your creative brief. Style, model, and
                references still come from the composer.
              </p>
              <button
                type="button"
                onClick={handleEditRegenerate}
                disabled={actionsLocked || !editPrompt.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0B0B] text-white py-3 text-sm font-medium hover:bg-[#1A1A1A] glow-subtle disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : variationsBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {actionIsVariation
                  ? `Regenerate ${actionVariationLabel}`
                  : "Regenerate this layout"}
              </button>
            </div>
          ) : (
            <>
              <Block title="Prompt used">
                <p className="text-sm text-foreground leading-relaxed">
                  {displayPrompt || "—"}
                </p>
              </Block>

              <Block title="Design rationale">
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {actionVariant.rationale}
                </p>
              </Block>

              {actionIsVariation && (
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Changes only update {actionVariationLabel}. Other variations
                  and the original layout stay the same.
                </p>
              )}

              {!isVideoLayout && (
              <button
                type="button"
                onClick={handleRemix}
                disabled={actionsLocked}
                title={
                  actionIsVariation
                    ? "Regenerate this variation only"
                    : "Regenerate with the main composer prompt"
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0B0B] text-white py-3 text-sm font-medium hover:bg-[#1A1A1A] glow-subtle disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {actionIsVariation
                  ? `Regenerate ${actionVariationLabel}`
                  : "Regenerate"}
              </button>
              )}

              {!isVideoLayout && (
              <button
                type="button"
                onClick={openEditMode}
                disabled={actionsLocked}
                title={
                  variationsBusy
                    ? "Wait for variations to finish generating"
                    : undefined
                }
                className="flex w-full items-center justify-center rounded-2xl border border-border py-3 text-sm text-foreground-muted hover:bg-surface-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Edit prompt…
              </button>
              )}

              {isRoot && variant.mediaType !== "video" && (
                <div className="space-y-3">
                  {(hasVariations || canGenerateMore) && (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                        {hasVariations
                          ? `${variationCount} variation${variationCount === 1 ? "" : "s"}`
                          : "Variations"}
                        {variationsBusy && (
                          <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-accent-violet" />
                        )}
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        <ExpandedVariationThumb
                          label="Original"
                          imageUrl={variant.imageUrl}
                          isSelected={!previewVariationId}
                          isDimmed={Boolean(previewVariationId)}
                          onSelect={() => setPreviewVariationId(null)}
                        />
                        {childVariations.map((child, i) => (
                          <ExpandedVariationThumb
                            key={child.id}
                            variation={child}
                            index={i}
                            isSelected={previewVariationId === child.id}
                            isDimmed={
                              previewVariationId !== null &&
                              previewVariationId !== child.id
                            }
                            onSelect={() =>
                              setPreviewVariationId((current) =>
                                current === child.id ? null : child.id
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {canGenerateMore && (
                    <>
                      <VariationCountStepper
                        value={variationBatchSize}
                        onChange={setVariationBatchSize}
                        disabled={actionsLocked}
                        maxAllowed={effectiveBatchMax}
                      />
                      <button
                        type="button"
                        onClick={() => void generateVariations(variant.id)}
                        disabled={actionsLocked}
                        title={
                          hasVariations
                            ? `Generate ${Math.min(variationBatchSize, slotsLeft)} more variation(s)`
                            : `Generate ${Math.min(variationBatchSize, slotsLeft)} variation(s) from this image`
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-accent-violet/30 bg-accent-violet/10 py-3 text-sm font-medium text-accent-violet hover:bg-accent-violet/15 disabled:opacity-50"
                      >
                        <Layers className="h-4 w-4" />
                        {hasVariations ? "Generate more variations" : "Generate variations"}
                      </button>
                      {slotsLeft < MAX_VARIATIONS && (
                        <p className="text-center text-[11px] text-foreground-muted">
                          {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left (max{" "}
                          {MAX_VARIATIONS})
                        </p>
                      )}
                    </>
                  )}

                  {variationsBusy && (
                    <p className="flex items-center justify-center gap-2 py-2 text-sm text-accent-violet">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating{" "}
                      {inFlightCount > 0
                        ? `${inFlightCount} variation${inFlightCount === 1 ? "" : "s"}`
                        : "variations"}
                      …
                    </p>
                  )}

                  {!canGenerateMore && slotsLeft === 0 && hasImage && (
                    <p className="text-center text-[11px] text-foreground-muted">
                      Maximum of {MAX_VARIATIONS} variations reached.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </motion.div>
    </motion.div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ExpandedVariationThumb({
  label,
  imageUrl,
  variation,
  index = 0,
  isSelected,
  isDimmed,
  onSelect,
}: {
  label?: string;
  imageUrl?: string;
  variation?: LayoutVariant;
  index?: number;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}) {
  const thumbLabel =
    label ?? `Variation ${(variation?.variationIndex ?? index) + 1}`;
  const src = imageUrl ?? variation?.imageUrl;
  const hasImage = isRealImage(src);
  const loading =
    variation?.status === "pending" || variation?.status === "generating";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!hasImage && !loading}
      className={cn(
        "group flex flex-col gap-1.5 text-left transition-opacity disabled:cursor-default",
        isDimmed && "opacity-40 hover:opacity-55",
        isSelected && "opacity-100"
      )}
    >
      <div
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-elevated ring-1 transition-all",
          isSelected
            ? "ring-2 ring-accent-violet"
            : "ring-border group-hover:ring-accent-violet/40"
        )}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent-violet" />
          </div>
        ) : hasImage && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={thumbLabel}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-1 text-center text-[9px] text-foreground-muted">
            {variation?.errorMessage ?? "Failed"}
          </div>
        )}
      </div>
      <span
        className={cn(
          "truncate text-center text-[10px] font-medium",
          isSelected ? "text-accent-violet" : "text-foreground-muted group-hover:text-foreground"
        )}
      >
        {thumbLabel}
      </span>
    </button>
  );
}
