"use client";

import { motion } from "framer-motion";
import { Film, LayoutGrid } from "lucide-react";
import { useScrollToLatestGeneration } from "@/hooks/use-scroll-to-latest-generation";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LayoutMatrix } from "./layout-matrix";
import { DownloadAllButton } from "./download-all-button";
import { ThemeToggle } from "./theme-toggle";

export function VisualPanel({ className }: { className?: string }) {
  const {
    variants,
    isGenerating,
    generationProgress,
    generationError,
    mediaType,
  } = useWorkspaceStore();

  const isVideo = mediaType === "video";
  const displayVariants = variants.filter((v) =>
    isVideo ? v.mediaType === "video" : v.mediaType !== "video"
  );
  const hasDisplayVariants = displayVariants.length > 0;
  const completeCount = displayVariants.filter(
    (v) => v.status === "complete"
  ).length;
  const rootCount = displayVariants.filter((v) => !v.parentVariantId).length;
  const skeletonCount =
    !hasDisplayVariants && isGenerating ? (isVideo ? 1 : 20) : 0;

  const latestRoundRef = useScrollToLatestGeneration(
    displayVariants,
    isGenerating,
    skeletonCount
  );

  return (
    <div
      className={cn(
        "relative flex h-full flex-col bg-background overflow-hidden",
        className
      )}
    >
      {/* Desktop header */}
      <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-border px-6 py-4 lg:flex">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isVideo ? (
            <Film className="h-4 w-4 shrink-0 text-accent-cyan" />
          ) : (
            <LayoutGrid className="h-4 w-4 shrink-0 text-foreground-muted" />
          )}
          <span className="truncate text-sm font-medium">
            {hasDisplayVariants
              ? isVideo
                ? `${completeCount} / ${rootCount} video${rootCount === 1 ? "" : "s"}`
                : `${completeCount} / ${displayVariants.length} layouts`
              : isVideo
                ? "Video output"
                : "Layout Matrix"}
          </span>
          {generationError && (
            <span className="max-w-[280px] truncate rounded-md bg-accent-orange/10 px-2 py-0.5 text-[10px] text-accent-orange">
              {generationError}
            </span>
          )}
          {hasDisplayVariants && !generationError && (
            <span
              className={
                isVideo
                  ? "rounded-md bg-accent-cyan/10 px-2 py-0.5 text-[10px] text-accent-cyan"
                  : "rounded-md bg-accent-cyan/10 px-2 py-0.5 text-[10px] text-accent-cyan"
              }
            >
              {isVideo ? "Video" : "Generated"}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DownloadAllButton variants={displayVariants} />
          {isGenerating && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-elevated">
                <motion.div
                  className={cn(
                    "h-full",
                    isVideo ? "bg-accent-cyan" : "bg-accent-violet"
                  )}
                  animate={{ width: `${generationProgress}%` }}
                  transition={
                    isVideo
                      ? { duration: 0.6, ease: "easeOut" }
                      : { duration: 0.2 }
                  }
                />
              </div>
              <span className="text-xs text-foreground-muted">
                {isVideo ? (
                  <>
                    ~{Math.round(generationProgress)}%
                    <span className="text-foreground-muted/70"> est.</span>
                  </>
                ) : (
                  <>{Math.round(generationProgress)}%</>
                )}
              </span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>

      {generationError && (
        <p className="shrink-0 border-b border-accent-orange/20 bg-accent-orange/5 px-3 py-2 text-xs text-accent-orange lg:hidden">
          {generationError}
        </p>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="layout-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!hasDisplayVariants && !isGenerating ? (
            <EmptyState isVideo={isVideo} />
          ) : (
            <LayoutMatrix
              variants={displayVariants}
              skeletonCount={skeletonCount}
              mediaType={mediaType}
              latestRoundRef={latestRoundRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ isVideo }: { isVideo: boolean }) {
  return (
    <div className="flex h-full min-h-[40dvh] flex-col items-center justify-center px-6 py-12 text-center lg:min-h-0 lg:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm space-y-4"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-elevated lg:h-24 lg:w-24 lg:rounded-[32px]">
          {isVideo ? (
            <Film className="h-8 w-8 text-accent-cyan/50 lg:h-10 lg:w-10" />
          ) : (
            <LayoutGrid className="h-8 w-8 text-foreground-muted/40 lg:h-10 lg:w-10" />
          )}
        </div>
        <p className="text-base text-foreground-muted leading-relaxed lg:text-lg">
          {isVideo
            ? "One video per prompt appears here."
            : "Layouts appear here after you generate."}
        </p>
        <p className="text-xs text-foreground-muted/60">
          {isVideo
            ? "No layout grid — switch to Chat to write your prompt."
            : "Switch to Chat to write your prompt."}
        </p>
      </motion.div>
    </div>
  );
}

