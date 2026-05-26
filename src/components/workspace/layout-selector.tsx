"use client";

import { useState } from "react";
import { ChevronDown, Check, Wand2, LayoutGrid } from "lucide-react";
import { LAYOUT_SYSTEMS } from "@/lib/layout-systems";
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
  const [open, setOpen] = useState(false);

  const {
    selectedLayouts,
    toggleLayout,
    selectAllLayouts,
    clearLayouts,
    imageGenerationMode,
    setImageGenerationMode,
    freeStyleCount,
    setFreeStyleCount,
  } = useWorkspaceStore();

  const allSelected = selectedLayouts.length === LAYOUT_SYSTEMS.length;
  const isFree = imageGenerationMode === "free";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-foreground-muted outline-none hover:bg-surface-elevated hover:text-foreground data-[state=open]:bg-surface-elevated data-[state=open]:text-foreground"
        >
          {isFree ? (
            <>
              <Wand2 className="h-3 w-3" />
              Free ({freeStyleCount})
            </>
          ) : (
            <>
              <LayoutGrid className="h-3 w-3" />
              Layouts ({selectedLayouts.length})
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-[300px]">
        {/* Mode toggle */}
        <div className="border-b border-border px-3 pt-2.5 pb-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">
            Generation mode
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setImageGenerationMode("layout")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors",
                !isFree
                  ? "bg-accent-violet/15 text-accent-violet"
                  : "bg-surface-hover text-foreground-muted hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3 w-3 shrink-0" />
              Layout systems
            </button>
            <button
              type="button"
              onClick={() => setImageGenerationMode("free")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors",
                isFree
                  ? "bg-accent-violet/15 text-accent-violet"
                  : "bg-surface-hover text-foreground-muted hover:text-foreground"
              )}
            >
              <Wand2 className="h-3 w-3 shrink-0" />
              Free style
            </button>
          </div>
        </div>

        {isFree ? (
          /* Free-style: just a count picker */
          <div className="px-3 py-3 space-y-2">
            <p className="text-[10px] text-foreground-muted leading-snug">
              Your prompt is sent directly to the model — no layout system applied. Pick how many images to generate.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setFreeStyleCount(n);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-medium transition-colors",
                    freeStyleCount === n
                      ? "bg-accent-violet text-white"
                      : "bg-surface-hover text-foreground-muted hover:text-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Layout systems: select / clear + list */
          <>
            <div className="sticky top-0 z-10 border-b border-border bg-surface-elevated px-3 py-2.5">
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
                  onClick={clearLayouts}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                    selectedLayouts.length === 0
                      ? "bg-accent-orange/15 text-accent-orange"
                      : "bg-surface-hover text-foreground-muted hover:text-foreground"
                  )}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto p-1.5">
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ALL_LAYOUT_IDS };
