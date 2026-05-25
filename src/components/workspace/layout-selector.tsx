"use client";

import { ChevronDown, Check } from "lucide-react";
import { LAYOUT_SYSTEMS, DEFAULT_SELECTED_LAYOUTS } from "@/lib/layout-systems";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { LayoutId } from "@/types";

const ALL_LAYOUT_IDS = LAYOUT_SYSTEMS.map((l) => l.id as LayoutId);

export function LayoutSelector() {
  const {
    selectedLayouts,
    toggleLayout,
    selectAllLayouts,
    setSelectedLayouts,
  } = useWorkspaceStore();

  const allSelected = selectedLayouts.length === LAYOUT_SYSTEMS.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-foreground-muted outline-none hover:bg-surface-elevated hover:text-foreground data-[state=open]:bg-surface-elevated data-[state=open]:text-foreground"
        >
          Layouts ({selectedLayouts.length})
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-[300px]">
        <div className="sticky top-0 z-10 border-b border-border bg-surface-elevated px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">
            Layout systems
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllLayouts}
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                allSelected
                  ? "bg-accent-violet/20 text-accent-violet"
                  : "bg-surface-hover text-foreground-muted hover:text-foreground"
              )}
            >
              Select all (20)
            </button>
            <button
              type="button"
              onClick={() => setSelectedLayouts([...DEFAULT_SELECTED_LAYOUTS])}
              className="flex-1 rounded-lg bg-surface-hover px-2 py-1.5 text-[11px] font-medium text-foreground-muted hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {LAYOUT_SYSTEMS.map((layout) => {
            const checked = selectedLayouts.includes(layout.id as LayoutId);
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => toggleLayout(layout.id as LayoutId)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                  checked
                    ? "bg-accent-violet/10 text-foreground"
                    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked
                      ? "border-accent-violet bg-accent-violet text-white"
                      : "border-border bg-surface"
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">{layout.name}</span>
                  <span className="block text-[10px] leading-snug opacity-70 line-clamp-1">
                    {layout.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ALL_LAYOUT_IDS };
