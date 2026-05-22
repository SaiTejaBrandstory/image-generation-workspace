"use client";

import { cn } from "@/lib/utils";
import { HistoryItemMenu } from "./history-item-menu";
import type { Conversation } from "@/types";

interface HistoryListItemProps {
  item: Conversation;
  isActive: boolean;
  isSearching: boolean;
  onSelect: (id: string) => void;
  /** Shown under the title (e.g. "Updated 38 minutes ago") */
  timestampLabel?: string;
  variant?: "sidebar" | "panel";
}

export function HistoryListItem({
  item,
  isActive,
  isSearching,
  onSelect,
  timestampLabel,
  variant = "sidebar",
}: HistoryListItemProps) {
  const isPanel = variant === "panel";

  return (
    <div className={cn("group relative", isPanel && "not-last:mb-2")}>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className={cn(
          "flex w-full flex-col text-left text-sm transition-all duration-150",
          isPanel
            ? "cursor-pointer rounded-lg bg-surface-elevated/80 px-4 py-3.5 pr-10 shadow-sm hover:bg-surface-hover"
            : "rounded-lg px-3 py-2.5 pr-9",
          isActive
            ? "bg-accent-violet/10 text-foreground ring-1 ring-inset ring-accent-violet/25"
            : isPanel
              ? "text-foreground hover:bg-surface-elevated"
              : "text-foreground-muted hover:bg-surface-elevated/80 hover:text-foreground"
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate leading-snug",
              isActive ? "font-medium" : "font-normal"
            )}
          >
            {item.title}
          </span>
          {timestampLabel && (
            <span
              className={cn(
                "mt-1 block truncate text-[11px] font-normal text-foreground-muted",
                isPanel && "mt-1.5"
              )}
            >
              {timestampLabel}
            </span>
          )}
          {isSearching && item.prompt && item.prompt !== item.title && (
            <span className="mt-0.5 block truncate text-[11px] font-normal text-foreground-muted/80">
              {item.prompt}
            </span>
          )}
        </span>
      </button>
      <HistoryItemMenu item={item} />
    </div>
  );
}
