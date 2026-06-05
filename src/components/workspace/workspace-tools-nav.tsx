"use client";

import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui/tooltip";
import { setVideoModelsCatalog } from "@/lib/openrouter-video-models";
import {
  WORKSPACE_TOOLS,
  type WorkspaceToolId,
} from "@/lib/workspace-tools";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

export function prefetchVideoModels() {
  void fetch("/api/video/models")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data.models) && data.models.length) {
        setVideoModelsCatalog(data.models);
      }
    })
    .catch(() => {});
}

function toolActiveStyle(id: WorkspaceToolId, active: boolean): string {
  if (!active) {
    return "text-foreground-muted hover:bg-surface-elevated hover:text-foreground";
  }
  if (id === "video") {
    return "bg-accent-cyan/10 text-accent-cyan ring-1 ring-inset ring-accent-cyan/25";
  }
  if (id === "storyboard") {
    return "bg-accent-orange/10 text-accent-orange ring-1 ring-inset ring-accent-orange/25";
  }
  return "bg-accent-violet/10 text-foreground ring-1 ring-inset ring-accent-violet/25";
}

export function WorkspaceToolsNav({
  className,
  compact = false,
  showLabel = false,
  onSelect,
}: {
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
  onSelect: (tool: WorkspaceToolId) => void;
}) {
  const pathname = usePathname();
  const { mediaType, isGenerating } = useWorkspaceStore();
  const onStoryboard = pathname.startsWith("/storyboard");

  const isActive = (id: WorkspaceToolId) => {
    if (id === "storyboard") return onStoryboard;
    return pathname === "/" && mediaType === id;
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {showLabel && !compact && (
        <p className="px-3 pb-0.5 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          Tools
        </p>
      )}
      <div
        className="flex flex-col gap-1"
        role="listbox"
        aria-label="Workspace tools"
      >
        {WORKSPACE_TOOLS.map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          const button = (
            <button
              type="button"
              role="option"
              aria-selected={active}
              aria-label={compact ? label : undefined}
              disabled={isGenerating}
              onClick={() => onSelect(id)}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl text-sm transition-colors disabled:opacity-50",
                compact ? "justify-center px-0" : "px-3",
                toolActiveStyle(id, active)
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!compact && <span>{label}</span>}
            </button>
          );
          return compact ? (
            <Tooltip key={id} content={label}>
              {button}
            </Tooltip>
          ) : (
            <span key={id}>{button}</span>
          );
        })}
      </div>
    </div>
  );
}
