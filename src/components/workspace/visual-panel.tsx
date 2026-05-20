"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Dna } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LayoutCard } from "./layout-card";
import { DesignDnaPanel } from "./design-dna-panel";
import { DownloadAllButton } from "./download-all-button";

export function VisualPanel({ className }: { className?: string }) {
  const {
    variants,
    isGenerating,
    generationProgress,
    generationError,
    showDesignDna,
    setShowDesignDna,
  } = useWorkspaceStore();

  const hasVariants = variants.length > 0;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col bg-background overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-foreground-muted" />
          <span className="text-sm font-medium">
            {hasVariants
              ? `${variants.filter((v) => v.status === "complete").length} / ${variants.length} layouts`
              : "Layout Matrix"}
          </span>
          {generationError && (
            <span className="max-w-[280px] truncate rounded-md bg-accent-orange/10 px-2 py-0.5 text-[10px] text-accent-orange">
              {generationError}
            </span>
          )}
          {hasVariants && !generationError && (
            <span className="rounded-md bg-accent-cyan/10 px-2 py-0.5 text-[10px] text-accent-cyan">
              OpenRouter
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DownloadAllButton variants={variants} />
          {isGenerating && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-elevated">
                <motion.div
                  className="h-full bg-accent-violet"
                  animate={{ width: `${generationProgress}%` }}
                />
              </div>
              <span className="text-xs text-foreground-muted">
                {Math.round(generationProgress)}%
              </span>
            </div>
          )}
          <button
            onClick={() => setShowDesignDna(!showDesignDna)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition-colors ${
              showDesignDna
                ? "bg-accent-violet/20 text-accent-violet"
                : "text-foreground-muted hover:bg-surface-elevated"
            }`}
          >
            <Dna className="h-3.5 w-3.5" />
            Design DNA
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {!hasVariants && !isGenerating ? (
            <EmptyState />
          ) : (
            <div className="layout-matrix grid w-full min-w-0 grid-cols-2 gap-6 p-6 md:gap-8 md:p-8">
              {hasVariants
                ? variants.map((v, i) => (
                    <LayoutCard key={v.id} variant={v} index={i} />
                  ))
                : Array.from({ length: 20 }).map((_, i) => (
                    <SkeletonCard key={i} index={i} />
                  ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showDesignDna && <DesignDnaPanel />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm space-y-6"
      >
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[32px] border border-border bg-surface-elevated">
          <LayoutGrid className="h-10 w-10 text-foreground-muted/40" />
        </div>
        <p className="text-lg text-foreground-muted leading-relaxed">
          Your creative layouts will appear here.
        </p>
        <p className="text-xs text-foreground-muted/60">
          2 × 10 matrix · 20 layout systems · Reference-aware generation
        </p>
      </motion.div>
    </div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-border"
    >
      <div className="h-[min(360px,45vh)] min-h-[240px] skeleton-shimmer" />
      <div className="space-y-2 px-4 py-3.5">
        <div className="h-3.5 w-2/3 rounded-md skeleton-shimmer" />
        <div className="h-3 w-full rounded-md skeleton-shimmer" />
      </div>
    </motion.div>
  );
}
