"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Expand,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import { LAYOUT_MAP } from "@/lib/layout-systems";
import { buildImageFilename, downloadImage } from "@/lib/download-utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { estimateVideoGenerationMs } from "@/lib/video-progress";
import { GeneratedImage } from "./generated-image";
import { cn } from "@/lib/utils";
import type { LayoutVariant } from "@/types";

interface LayoutCardProps {
  variant: LayoutVariant;
  index: number;
  /** Parent only — e.g. "3 variations available" */
  variationLabel?: string;
  onVariationLabelClick?: () => void;
  titleOverride?: string;
  descriptionOverride?: string;
}

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

export function LayoutCard({
  variant,
  index,
  variationLabel,
  onVariationLabelClick,
  titleOverride,
  descriptionOverride,
}: LayoutCardProps) {
  const layout = LAYOUT_MAP[variant.layoutId];
  const { setExpandedVariant, retryFailedVariant } = useWorkspaceStore();
  const isVideo = variant.mediaType === "video";

  const isLoading =
    variant.status === "pending" || variant.status === "generating";
  const isError = variant.status === "error";
  const gradient = layout?.gradient ?? "from-zinc-900 to-zinc-800";
  const hasImage = isRealImage(variant.imageUrl);
  const hasVideo = isRealVideo(variant.videoUrl);
  const [downloading, setDownloading] = useState(false);

  // Live estimated progress for video generating cards (persists across tab switches)
  const [cardProgress, setCardProgress] = useState<number | null>(null);
  useEffect(() => {
    if (!isLoading || !isVideo || !variant.createdAt) {
      setCardProgress(null);
      return;
    }
    const estimateMs = estimateVideoGenerationMs(
      variant.videoMeta?.duration ?? 6
    );
    const tick = () => {
      const elapsed = Date.now() - variant.createdAt!;
      setCardProgress(Math.min(92, Math.round(8 + (elapsed / estimateMs) * 84)));
    };
    tick();
    const id = setInterval(tick, 2_000);
    return () => clearInterval(id);
  }, [isLoading, isVideo, variant.createdAt, variant.videoMeta?.duration]);

  const handleDownload = async () => {
    const src = isVideo ? variant.videoUrl : variant.imageUrl;
    if (!src) return;
    setDownloading(true);
    try {
      if (isVideo) {
        const res = await fetch(src);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `video-${index + 1}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (layout) {
        await downloadImage(
          src,
          buildImageFilename(layout.name, variant.layoutId, index)
        );
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert(
        err instanceof Error
          ? err.message
          : `Failed to download ${isVideo ? "video" : "image"}`
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleAction =
    (fn: () => void) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.4), duration: 0.25 }}
      className={cn(
        "group relative flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border bg-surface shadow-cinematic transition-[border-color,box-shadow] lg:rounded-[20px]",
        isError
          ? "border-accent-orange/40"
          : "border-border hover:border-accent-violet/25 hover:shadow-[0_8px_40px_rgba(124,58,237,0.1)]"
      )}
    >
      <div className="relative w-full shrink-0 overflow-hidden">
        {isLoading ? (
          <div className="layout-card-preview flex flex-col items-center justify-center gap-3">
            <Loader2
              className={cn(
                "h-8 w-8 animate-spin",
                isVideo ? "text-accent-cyan" : "text-accent-violet"
              )}
            />
            {isVideo && cardProgress !== null && (
              <div className="w-28 space-y-1.5 px-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full bg-accent-cyan transition-[width] duration-1000 ease-linear"
                    style={{ width: `${cardProgress}%` }}
                  />
                </div>
                <p className="text-center text-[10px] text-foreground-muted/70">
                  ~{cardProgress}% estimated
                </p>
              </div>
            )}
          </div>
        ) : hasVideo && variant.videoUrl ? (
          <div className="relative layout-card-preview overflow-hidden bg-black">
            <video
              src={variant.videoUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              loop
              preload="metadata"
            />
            <button
              type="button"
              onClick={handleAction(() => void handleDownload())}
              disabled={downloading}
              title="Download video"
              className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleAction(() =>
                setExpandedVariant(variant.id, "view")
              )}
              title="Expand to preview video"
              className="absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/80"
            >
              <Expand className="h-3.5 w-3.5 shrink-0" />
              Expand
            </button>
          </div>
        ) : hasImage && variant.imageUrl ? (
          <div className="relative layout-card-preview overflow-hidden">
            <GeneratedImage
              src={variant.imageUrl}
              alt={`${layout?.name} layout`}
              variant="card"
              className="absolute inset-0"
            />
            <button
              type="button"
              onClick={handleAction(() => void handleDownload())}
              disabled={downloading}
              title="Download image"
              className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleAction(() =>
                setExpandedVariant(variant.id, "view")
              )}
              title="Expand to view, regenerate, or edit"
              className="absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/80"
            >
              <Expand className="h-3.5 w-3.5 shrink-0" />
              Expand
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "layout-card-preview flex items-center justify-center bg-gradient-to-br",
              gradient
            )}
          >
            {isError && (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <AlertCircle className="h-5 w-5 text-accent-orange" />
                <span className="text-[10px] text-foreground-muted leading-snug line-clamp-3">
                  {variant.errorMessage ?? "Generation failed"}
                </span>
                <button
                  type="button"
                  onClick={handleAction(() => retryFailedVariant(variant.id))}
                  className="rounded-lg bg-accent-orange/10 px-3 py-1 text-[10px] font-medium text-accent-orange hover:bg-accent-orange/20"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-3 border-t border-border/80 bg-surface px-4 py-3.5">
        <div className="space-y-1.5">
          <h3 className="truncate text-sm font-semibold leading-tight tracking-tight">
            {titleOverride ?? (isVideo ? "Video" : variant.layoutId === "free" ? "Free Style" : layout?.name ?? variant.layoutId)}
          </h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-foreground-muted">
            {descriptionOverride ??
              (isVideo
                ? variant.rationale
                : layout?.description)}
          </p>
        </div>
        {!isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex max-w-full truncate rounded-lg px-2.5 py-1 text-[10px] font-medium",
                isError
                  ? "bg-accent-orange/10 text-accent-orange"
                  : "bg-surface-elevated text-foreground-muted ring-1 ring-inset ring-border"
              )}
            >
              {isError ? "Failed" : variant.suggestedPlatform}
            </span>
            {variationLabel &&
              (onVariationLabelClick ? (
                <button
                  type="button"
                  onClick={handleAction(onVariationLabelClick)}
                  className="shrink-0 cursor-pointer text-[11px] font-medium text-accent-violet transition-colors hover:text-accent-violet/80 hover:underline"
                >
                  {variationLabel}
                </button>
              ) : (
                <span className="shrink-0 text-[11px] font-medium text-accent-violet">
                  {variationLabel}
                </span>
              ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}
