"use client";

import { cn } from "@/lib/utils";
import {
  formatReferenceCountLabel,
  maxReferencesForMedia,
} from "@/lib/reference-limits";
import type { MediaType } from "@/types";

export function ReferenceCountBadge({
  count,
  mediaType,
  imageModelId,
  className,
}: {
  count: number;
  mediaType: MediaType;
  imageModelId?: string;
  className?: string;
}) {
  const max = maxReferencesForMedia(mediaType, imageModelId);
  const atMax = count >= max;
  const isVideo = mediaType === "video";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset",
        atMax
          ? "bg-accent-orange/10 text-accent-orange ring-accent-orange/30"
          : isVideo
            ? "bg-accent-cyan/10 text-accent-cyan ring-accent-cyan/25"
            : "bg-accent-violet/10 text-accent-violet ring-accent-violet/25",
        className
      )}
      title={`${count} of ${max} reference images attached`}
    >
      {formatReferenceCountLabel(count, mediaType, imageModelId)}
    </span>
  );
}
