"use client";

import { Clapperboard, Film, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import type { ConversationMediaType } from "@/types";

export function MediaTypeBadge({
  mediaType = "image",
  className,
}: {
  mediaType?: ConversationMediaType;
  className?: string;
}) {
  const isVideo = mediaType === "video";
  const isStoryboard = mediaType === "storyboard";
  const label = isStoryboard ? "Storyboard" : isVideo ? "Video" : "Image";

  return (
    <Tooltip content={label}>
      <span
        aria-label={label}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
          isStoryboard
            ? "bg-accent-orange/15 text-accent-orange ring-1 ring-inset ring-accent-orange/25"
            : isVideo
              ? "bg-accent-cyan/15 text-accent-cyan ring-1 ring-inset ring-accent-cyan/25"
              : "bg-accent-violet/15 text-accent-violet ring-1 ring-inset ring-accent-violet/25",
          className
        )}
      >
        {isStoryboard ? (
          <Clapperboard className="h-3 w-3" strokeWidth={2.25} />
        ) : isVideo ? (
          <Film className="h-3 w-3" strokeWidth={2.25} />
        ) : (
          <ImageIcon className="h-3 w-3" strokeWidth={2.25} />
        )}
      </span>
    </Tooltip>
  );
}
