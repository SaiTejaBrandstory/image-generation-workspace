"use client";

import { Film, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import type { MediaType } from "@/types";

export function MediaTypeBadge({
  mediaType = "image",
  className,
}: {
  mediaType?: MediaType;
  className?: string;
}) {
  const isVideo = mediaType === "video";
  const label = isVideo ? "Video" : "Image";

  return (
    <Tooltip content={label}>
      <span
        aria-label={label}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
          isVideo
            ? "bg-accent-cyan/15 text-accent-cyan ring-1 ring-inset ring-accent-cyan/25"
            : "bg-accent-violet/15 text-accent-violet ring-1 ring-inset ring-accent-violet/25",
          className
        )}
      >
        {isVideo ? (
          <Film className="h-3 w-3" strokeWidth={2.25} />
        ) : (
          <ImageIcon className="h-3 w-3" strokeWidth={2.25} />
        )}
      </span>
    </Tooltip>
  );
}
