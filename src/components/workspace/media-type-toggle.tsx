"use client";

import { ImageIcon, Video } from "lucide-react";
import { setVideoModelsCatalog } from "@/lib/openrouter-video-models";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { MediaType } from "@/types";

export function MediaTypeToggle({ className }: { className?: string }) {
  const { mediaType, setMediaType, isGenerating } = useWorkspaceStore();

  const options: { id: MediaType; label: string; icon: typeof ImageIcon }[] = [
    { id: "image", label: "Image", icon: ImageIcon },
    { id: "video", label: "Video", icon: Video },
  ];

  return (
    <div
      className={cn(
        "inline-flex rounded-xl bg-surface-elevated p-0.5 ring-1 ring-inset ring-border",
        className
      )}
      role="tablist"
      aria-label="Media type"
    >
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mediaType === id}
          disabled={isGenerating}
          onClick={() => {
            setMediaType(id);
            if (id === "video") {
              void fetch("/api/video/models")
                .then((r) => r.json())
                .then((data) => {
                  if (Array.isArray(data.models) && data.models.length) {
                    setVideoModelsCatalog(data.models);
                  }
                })
                .catch(() => {});
            }
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            mediaType === id
              ? id === "video"
                ? "bg-accent-cyan/20 text-accent-cyan shadow-sm"
                : "bg-accent-violet/20 text-accent-violet shadow-sm"
              : "text-foreground-muted hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
