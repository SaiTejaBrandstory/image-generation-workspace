"use client";

import { Film, ImageIcon, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export type HistoryMediaFilter = "all" | "image" | "video";

const OPTIONS: {
  value: HistoryMediaFilter;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "image", label: "Images", icon: ImageIcon },
  { value: "video", label: "Videos", icon: Film },
];

export function HistoryMediaFilterToggle({
  value,
  onChange,
  className,
}: {
  value: HistoryMediaFilter;
  onChange: (value: HistoryMediaFilter) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-elevated/80 p-0.5",
        className
      )}
      role="group"
      aria-label="Filter history by media type"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        const isVideo = opt.value === "video";
        const isImage = opt.value === "image";
        return (
          <Tooltip key={opt.value} content={opt.label}>
            <button
              type="button"
              aria-pressed={active}
              aria-label={opt.label}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                active
                  ? isVideo
                    ? "bg-accent-cyan/20 text-accent-cyan"
                    : isImage
                      ? "bg-accent-violet/20 text-accent-violet"
                      : "bg-surface-hover text-foreground"
                  : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function conversationMatchesMediaFilter(
  conversation: { mediaType?: "image" | "video" },
  filter: HistoryMediaFilter
): boolean {
  if (filter === "all") return true;
  return (conversation.mediaType ?? "image") === filter;
}
