"use client";

import { useState } from "react";
import { ChevronDown, Check, Wand2, LayoutGrid } from "lucide-react";
import { LAYOUT_SYSTEMS } from "@/lib/layout-systems";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMPOSER_MENU_CONTENT,
  COMPOSER_MENU_ITEM,
  COMPOSER_MENU_SCROLL,
  COMPOSER_MENU_TRIGGER_BTN,
} from "./composer-menu-styles";
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
  const layoutCount = LAYOUT_SYSTEMS.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            COMPOSER_MENU_TRIGGER_BTN,
            "text-foreground-muted hover:text-foreground data-[state=open]:text-foreground"
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
            {isFree ? (
              <>
                <Wand2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                <span>Free ({freeStyleCount})</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                <span>Layouts ({selectedLayouts.length})</span>
              </>
            )}
          </span>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 shrink-0 text-foreground-muted/55" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className={COMPOSER_MENU_CONTENT}>
        {/* Mode toggle */}
        <div className="border-b border-border px-2 py-2">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
            Generation mode
          </p>
          <div className="grid grid-cols-2 gap-1.5 px-1">
            <button
              type="button"
              onClick={() => setImageGenerationMode("layout")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/20",
                !isFree
                  ? "bg-accent-violet/15 text-accent-violet"
                  : "bg-surface-hover text-foreground-muted hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3 w-3 shrink-0" aria-hidden />
              Layout systems
            </button>
            <button
              type="button"
              onClick={() => setImageGenerationMode("free")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/20",
                isFree
                  ? "bg-accent-violet/15 text-accent-violet"
                  : "bg-surface-hover text-foreground-muted hover:text-foreground"
              )}
            >
              <Wand2 className="h-3 w-3 shrink-0" aria-hidden />
              Free style
            </button>
          </div>
        </div>

        {isFree ? (
          <div className="space-y-2 px-2 py-2">
            <p className="px-1 text-[10px] leading-snug text-foreground-muted">
              Your prompt is sent directly to the model — no layout system applied. Pick how many images to generate.
            </p>
            <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setFreeStyleCount(n);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-7 min-w-[1.75rem] rounded-lg px-1.5 text-[11px] font-medium transition-colors",
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
          <>
            <div className="sticky top-0 z-10 border-b border-border bg-surface-elevated px-2 py-2">
              <div className="flex gap-1.5">
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
                  Select all ({layoutCount})
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

            <div className={cn(COMPOSER_MENU_SCROLL, "space-y-1.5 py-1")}>
              {LAYOUT_SYSTEMS.map((layout) => {
                const checked = selectedLayouts.includes(layout.id as LayoutId);
                return (
                  <DropdownMenuItem
                    key={layout.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleLayout(layout.id as LayoutId);
                    }}
                    className={cn(
                      COMPOSER_MENU_ITEM,
                      "py-2",
                      checked &&
                        "bg-accent-violet/12 data-[highlighted]:bg-accent-violet/18",
                      !checked &&
                        "data-[highlighted]:bg-surface-hover"
                    )}
                  >
                    <div className="flex w-full min-w-0 items-start gap-2">
                      <span
                        className={cn(
                          "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-accent-violet bg-accent-violet text-white"
                            : "border-border/90 bg-background"
                        )}
                        aria-hidden
                      >
                        {checked ? (
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 text-left leading-snug">
                        <span className="block text-[11px] font-medium text-foreground">
                          {layout.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-foreground-muted line-clamp-2">
                          {layout.description}
                        </span>
                      </span>
                    </div>
                  </DropdownMenuItem>
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
