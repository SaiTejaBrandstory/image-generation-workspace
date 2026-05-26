"use client";

import { X, Sparkles, ImageIcon } from "lucide-react";
import Image from "next/image";
import {
  videoReferenceSlotLabel,
} from "@/lib/video-reference-usage";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { ReferenceUsageMode } from "@/types";

const MODE_OPTIONS: {
  value: ReferenceUsageMode;
  label: string;
  videoLabel: string;
  title: string;
}[] = [
  {
    value: "inspire",
    label: "Inspire",
    videoLabel: "Consistency",
    title:
      "Avatar, location, and style stay consistent across the video (or visual direction for images)",
  },
  {
    value: "preserve",
    label: "Preserve",
    videoLabel: "Keyframe",
    title:
      "Advanced: lock opening/closing frame for video, or exact assets for images",
  },
];

export function ReferenceChips() {
  const {
    references,
    removeReference,
    setReferencesUsageMode,
    mediaType,
    videoModel,
  } = useWorkspaceStore();

  if (references.length === 0) return null;

  const isVideo = mediaType === "video";
  const usageMode = references[0]?.usageMode ?? "inspire";

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
      {references.map((ref, i) => {
        const slotLabel =
          isVideo &&
          videoReferenceSlotLabel(
            i,
            references.length,
            usageMode,
            videoModel
          );
        return (
          <div
            key={ref.id}
            className={cn(
              "group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-elevated shadow-sm ring-1",
              isVideo ? "ring-accent-cyan/20" : "ring-foreground/5"
            )}
            title={ref.name}
          >
            {slotLabel && (
              <span className="absolute left-0.5 top-0.5 z-10 rounded bg-black/65 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-white">
                {slotLabel}
              </span>
            )}
            <Image
              src={ref.url}
              alt={`Reference ${i + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={() => removeReference(ref.id)}
              className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`Remove reference ${i + 1}`}
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        );
      })}

      {!isVideo && (
        <div
          className="flex rounded-md bg-surface-elevated p-0.5 ring-1 ring-foreground/5"
          role="group"
          aria-label="Usage mode for all uploaded images"
        >
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.title}
              onClick={() => setReferencesUsageMode(opt.value)}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                usageMode === opt.value
                  ? "bg-accent-violet/20 text-accent-violet"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {opt.value === "inspire" ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <ImageIcon className="h-3 w-3" />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {isVideo && (
        <div
          className="ml-auto flex rounded-md bg-surface-elevated p-0.5 ring-1 ring-foreground/5"
          role="group"
          aria-label="How reference images are used for video"
        >
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.title}
              onClick={() => setReferencesUsageMode(opt.value)}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                usageMode === opt.value
                  ? "bg-accent-cyan/20 text-accent-cyan"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {opt.value === "inspire" ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <ImageIcon className="h-3 w-3" />
              )}
              {opt.videoLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
