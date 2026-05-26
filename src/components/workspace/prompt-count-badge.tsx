"use client";

import { cn } from "@/lib/utils";
import { formatPromptCountLabel, maxPromptCharsForMedia } from "@/lib/prompt-limits";
import type { MediaType } from "@/types";

export function PromptCountBadge({
  length,
  mediaType,
  className,
}: {
  length: number;
  mediaType: MediaType;
  className?: string;
}) {
  const max = maxPromptCharsForMedia(mediaType);
  const over = length > max;
  const isVideo = mediaType === "video";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset",
        over
          ? "bg-accent-orange/10 text-accent-orange ring-accent-orange/30"
          : isVideo
            ? "bg-accent-cyan/10 text-accent-cyan ring-accent-cyan/25"
            : "bg-accent-violet/10 text-accent-violet ring-accent-violet/25",
        className
      )}
      aria-live="polite"
      title={`${length} of ${max} characters`}
    >
      {formatPromptCountLabel(length, mediaType)}
    </span>
  );
}
