"use client";

import { LayoutGrid, Menu, MessageSquare, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { DownloadAllButton } from "./download-all-button";
import { ThemeToggle } from "./theme-toggle";

export function MobileChrome() {
  const {
    mobilePanel,
    setMobilePanel,
    setMobileSidebarOpen,
    variants,
    isGenerating,
    generationProgress,
  } = useWorkspaceStore();

  const completeCount = variants.filter((v) => v.status === "complete").length;
  const totalCount = variants.length;
  const hasLayouts = totalCount > 0 || isGenerating;

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-md supports-[backdrop-filter]:bg-surface/80 lg:hidden">
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open history"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div
          className="inline-flex w-full max-w-[240px] rounded-xl bg-surface-elevated p-1"
          role="tablist"
          aria-label="Workspace views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === "chat"}
            onClick={() => setMobilePanel("chat")}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors",
              mobilePanel === "chat"
                ? "text-foreground"
                : "text-foreground-muted"
            )}
          >
            {mobilePanel === "chat" && (
              <motion.span
                layoutId="mobile-tab"
                className="absolute inset-0 rounded-lg bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === "layouts"}
            onClick={() => hasLayouts && setMobilePanel("layouts")}
            disabled={!hasLayouts}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-35",
              mobilePanel === "layouts"
                ? "text-foreground"
                : "text-foreground-muted"
            )}
          >
            {mobilePanel === "layouts" && (
              <motion.span
                layoutId="mobile-tab"
                className="absolute inset-0 rounded-lg bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              Layouts
              {totalCount > 0 && (
                <span className="rounded-md bg-accent-violet/15 px-1.5 py-0.5 text-[10px] tabular-nums text-accent-violet">
                  {isGenerating
                    ? `${completeCount}/${totalCount}`
                    : totalCount}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isGenerating && (
          <span className="flex h-10 items-center gap-1.5 rounded-xl bg-accent-violet/10 px-2 text-[10px] font-medium tabular-nums text-accent-violet">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            {Math.round(generationProgress)}%
          </span>
        )}
        {mobilePanel === "layouts" && completeCount > 0 && !isGenerating && (
          <DownloadAllButton variants={variants} variant="icon" />
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
