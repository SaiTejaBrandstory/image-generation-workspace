"use client";

import Image from "next/image";
import { Sparkles, ImageIcon, Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { referenceFormatHint } from "@/lib/reference-image-formats";
import { cn } from "@/lib/utils";
import type { MediaType, ReferenceUsageMode } from "@/types";

interface ReferenceModeDialogProps {
  open: boolean;
  previewUrls: string[];
  fileCount: number;
  mediaType?: MediaType;
  onSelect: (mode: ReferenceUsageMode) => void;
  onCancel: () => void;
}

export function ReferenceModeDialog({
  open,
  previewUrls,
  fileCount,
  mediaType = "image",
  onSelect,
  onCancel,
}: ReferenceModeDialogProps) {
  const isVideo = mediaType === "video";
  const count = Math.max(fileCount, previewUrls.length);
  const visible = previewUrls.slice(0, 4);
  const overflow = count - visible.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] max-w-[480px] gap-0 overflow-hidden rounded-lg p-0 font-sans">
        <DialogHeader className="border-b border-border/60 bg-surface-elevated/40 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            {isVideo && <Film className="h-5 w-5 text-accent-cyan" />}
            {count > 1
              ? `How should we use these ${count} images?`
              : "How should we use this image?"}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground-muted">
            {isVideo
              ? `Image + prompt for video (${referenceFormatHint("video")}). One mode for all uploads in this batch.`
              : `One choice for every image (${referenceFormatHint("image")}). All references share the same mode — Inspire or Preserve, not both.`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          {visible.length > 0 && (
            <div
              className={cn(
                "mx-auto mb-5 flex flex-wrap justify-center gap-2",
                count > 1 && "max-w-[280px]"
              )}
            >
              {visible.map((url, i) => (
                <div
                  key={url}
                  className={cn(
                    "relative overflow-hidden rounded-lg bg-surface-elevated shadow-sm",
                    count > 1 ? "h-16 w-16" : "h-28 w-28"
                  )}
                >
                  <Image
                    src={url}
                    alt={`Upload preview ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
              {overflow > 0 && (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-elevated text-xs font-medium text-foreground-muted ring-1 ring-foreground/10">
                  +{overflow}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
                type="button"
                onClick={() => onSelect("inspire")}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-2 rounded-lg bg-surface-elevated p-4 text-left",
                  "ring-1 ring-foreground/10 transition-all hover:bg-surface-hover",
                  isVideo
                    ? "hover:ring-accent-cyan/35"
                    : "hover:ring-accent-violet/35"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md",
                    isVideo ? "bg-accent-cyan/15" : "bg-accent-violet/15"
                  )}
                >
                  <Sparkles
                    className={cn(
                      "h-4 w-4",
                      isVideo ? "text-accent-cyan" : "text-accent-violet"
                    )}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  Inspire
                </span>
                <span className="text-xs leading-relaxed text-foreground-muted">
                  {isVideo
                    ? fileCount >= 2
                      ? "All images are sent as style references (Wan, Seedance, Grok, etc.). Use First frame mode for start/end stills."
                      : "Style and content reference — guides the video look without locking the first frame."
                    : "Visual direction for all uploads — mood, palette, and composition. The AI may reinterpret each image."}
                </span>
              </button>

            <button
              type="button"
              onClick={() => onSelect("preserve")}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-2 rounded-lg bg-surface-elevated p-4 text-left",
                "ring-1 ring-foreground/10 transition-all hover:bg-surface-hover hover:ring-accent-cyan/35"
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-cyan/15">
                <ImageIcon className="h-4 w-4 text-accent-cyan" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                {isVideo ? "First frame" : "Preserve"}
              </span>
              <span className="text-xs leading-relaxed text-foreground-muted">
                {isVideo
                  ? fileCount >= 2
                    ? "Image 1 → opening frame · image 2 → closing frame (when the model supports it)."
                    : "Image-to-video — this still becomes the opening frame; motion follows your prompt."
                  : "Keep every upload as the exact asset — same subject and details. Only layout and framing adapt."}
              </span>
            </button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
