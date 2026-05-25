"use client";

import { ArrowRight, LayoutGrid } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspaceStore } from "@/store/workspace-store";

export function MobileLayoutsBanner() {
  const {
    mobilePanel,
    setMobilePanel,
    variants,
    isGenerating,
    mediaType,
  } = useWorkspaceStore();

  const isVideo = mediaType === "video";
  const displayVariants = variants.filter((v) =>
    isVideo ? v.mediaType === "video" : v.mediaType !== "video"
  );
  const completeCount = displayVariants.filter(
    (v) => v.status === "complete"
  ).length;
  const show =
    mobilePanel === "chat" &&
    completeCount > 0 &&
    (isGenerating || completeCount === displayVariants.length);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="shrink-0 border-t border-border bg-surface px-3 py-2 lg:hidden"
        >
          <button
            type="button"
            onClick={() => setMobilePanel("layouts")}
            className={
              isVideo
                ? "flex w-full items-center justify-between gap-3 rounded-xl bg-accent-cyan/10 px-4 py-3 text-left transition-colors hover:bg-accent-cyan/15"
                : "flex w-full items-center justify-between gap-3 rounded-xl bg-accent-violet/10 px-4 py-3 text-left transition-colors hover:bg-accent-violet/15"
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={
                  isVideo
                    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-cyan/20"
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-violet/20"
                }
              >
                <LayoutGrid
                  className={
                    isVideo
                      ? "h-4 w-4 text-accent-cyan"
                      : "h-4 w-4 text-accent-violet"
                  }
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {isVideo
                    ? isGenerating
                      ? "Generating video…"
                      : "Video ready"
                    : isGenerating
                      ? `${completeCount} of ${displayVariants.length} layouts`
                      : `${completeCount} layout${completeCount !== 1 ? "s" : ""} ready`}
                </p>
                <p className="text-xs text-foreground-muted truncate">
                  {isVideo
                    ? "Tap to view your video"
                    : isGenerating
                      ? "Tap to watch them generate"
                      : "Tap to view your matrix"}
                </p>
              </div>
            </div>
            <ArrowRight
              className={
                isVideo
                  ? "h-4 w-4 shrink-0 text-accent-cyan"
                  : "h-4 w-4 shrink-0 text-accent-violet"
              }
            />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
