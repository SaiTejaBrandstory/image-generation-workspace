"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, RefreshCw, Loader2, Download, Layers, ArrowLeft } from "lucide-react";
import {
  getChildVariations,
  MAX_VARIATIONS,
  remainingVariationSlots,
} from "@/lib/variation-utils";
import { VariationCountStepper } from "./variation-count-stepper";
import { LAYOUT_MAP } from "@/lib/layout-systems";
import { buildImageFilename, downloadImage } from "@/lib/download-utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { GeneratedImage } from "./generated-image";
import { cn } from "@/lib/utils";
import type { LayoutVariant } from "@/types";

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

  useEffect(() => {
    setPreviewVariationId(null);
  }, [expandedVariantId]);

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

  if (!variant) return null;

  const layout = LAYOUT_MAP[variant.layoutId];
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
      } else if (imageSrc && layout) {
        const suffix = previewVariation
          ? `-variation-${(previewVariation.variationIndex ?? 0) + 1}`
          : "";
        await downloadImage(
          imageSrc,
          buildImageFilename(`${layout.name}${suffix}`, variant.layoutId)
        );
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
      className="fixed inset-0 z-50 flex bg-black/90 backdrop-blur-md"
      onClick={() => setExpandedVariant(null)}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full w-full flex-col lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6 lg:p-10">
          <div className="absolute left-4 top-4 z-20 lg:left-8 lg:top-8">
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
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2 lg:right-8 lg:top-8">
            {canvasHasImage && canvasVariant.imageUrl && (
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                title="Download image"
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
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
            />
          ) : canvasHasImage && canvasVariant.imageUrl ? (
            <GeneratedImage
              src={canvasVariant.imageUrl}
              alt={previewVariationLabel ?? layout?.name ?? "Layout"}
              variant="expanded"
            />
          ) : (
            <div
              className={cn(
                "flex h-[60vh] w-full max-w-lg items-center justify-center rounded-[32px] border border-border bg-gradient-to-br",
                layout?.gradient
              )}
            />
          )}
        </div>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-surface p-6 lg:w-[420px] lg:border-l lg:border-t-0 lg:p-8 space-y-5">
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
                  : layout?.name
                : (variationTitle ?? (isVideoLayout ? "Video" : layout?.name))}
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
                  : "Regenerate (same composer prompt)"}
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
