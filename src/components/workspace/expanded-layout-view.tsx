"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, Shuffle, Loader2, Download } from "lucide-react";
import { LAYOUT_MAP } from "@/lib/layout-systems";
import { buildImageFilename, downloadImage } from "@/lib/download-utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { GeneratedImage } from "./generated-image";
import { cn } from "@/lib/utils";

function isRealImage(url?: string) {
  return (
    !!url &&
    (url.startsWith("data:image") ||
      url.startsWith("http://") ||
      url.startsWith("https://"))
  );
}

export function ExpandedLayoutView() {
  const {
    expandedVariantId,
    expandedMode,
    setExpandedVariant,
    variants,
    regenerateVariant,
    prompt: composerPrompt,
  } = useWorkspaceStore();

  const variant = variants.find((v) => v.id === expandedVariantId);
  const [editPrompt, setEditPrompt] = useState("");
  const [downloading, setDownloading] = useState(false);
  const editSessionRef = useRef<string | null>(null);

  // Initialize edit textarea only when opening edit mode — not on every variant update
  useEffect(() => {
    if (expandedMode !== "edit" || !expandedVariantId || !variant) {
      if (expandedMode !== "edit") {
        editSessionRef.current = null;
      }
      return;
    }

    const sessionKey = `${expandedVariantId}-edit`;
    if (editSessionRef.current === sessionKey) return;

    editSessionRef.current = sessionKey;
    const initial =
      variant.userPrompt?.trim() ||
      composerPrompt.trim() ||
      "";
    setEditPrompt(initial);
  }, [expandedMode, expandedVariantId, variant, composerPrompt]);

  if (!variant) return null;

  const layout = LAYOUT_MAP[variant.layoutId];
  const hasImage = isRealImage(variant.imageUrl);
  const isRegenerating = variant.status === "generating";
  const displayPrompt = variant.userPrompt || composerPrompt.trim();

  const handleRemix = () => {
    void regenerateVariant(variant.id);
  };

  const handleEditRegenerate = () => {
    const trimmed = editPrompt.trim();
    if (!trimmed) return;
    void regenerateVariant(variant.id, trimmed);
  };

  const handleDownload = async () => {
    if (!variant.imageUrl || !layout) return;
    setDownloading(true);
    try {
      await downloadImage(
        variant.imageUrl,
        buildImageFilename(layout.name, variant.layoutId)
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download image");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex bg-black/90 backdrop-blur-md"
      onClick={() => setExpandedVariant(null)}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full w-full flex-col lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6 lg:p-10">
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2 lg:right-8 lg:top-8">
            {hasImage && variant.imageUrl && (
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                title="Download image"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated hover:bg-surface-hover disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpandedVariant(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated hover:bg-surface-hover"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isRegenerating ? (
            <div className="flex flex-col items-center gap-3 text-foreground-muted">
              <Loader2 className="h-10 w-10 animate-spin text-accent-violet" />
              <p className="text-sm">Regenerating with your prompt…</p>
            </div>
          ) : hasImage && variant.imageUrl ? (
            <GeneratedImage
              src={variant.imageUrl}
              alt={layout?.name ?? "Layout"}
              variant="expanded"
            />
          ) : (
            <div
              className={cn(
                "flex h-[60vh] w-full max-w-lg items-center justify-center rounded-[32px] border border-border bg-gradient-to-br",
                layout?.gradient
              )}
            />
          )}
        </div>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-surface p-6 lg:w-[420px] lg:border-l lg:border-t-0 lg:p-8 space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground-muted mb-1">
              {expandedMode === "edit" ? "Edit & regenerate" : "Layout system"}
            </p>
            <h2 className="text-xl font-semibold">{layout?.name}</h2>
          </div>

          {expandedMode === "edit" ? (
            <div className="space-y-3">
              <label
                htmlFor="edit-layout-prompt"
                className="block text-[10px] font-medium uppercase tracking-widest text-foreground-muted"
              >
                Prompt for this layout
              </label>
              <textarea
                id="edit-layout-prompt"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm leading-relaxed outline-none focus:border-accent-violet/50"
                placeholder="Describe what this layout should show…"
              />
              <p className="text-[11px] text-foreground-muted">
                Only this text is sent as your creative brief. Style, model, and
                references still come from the composer.
              </p>
              <button
                type="button"
                onClick={handleEditRegenerate}
                disabled={isRegenerating || !editPrompt.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0B0B] text-white py-3 text-sm font-medium hover:bg-[#1A1A1A] glow-subtle disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shuffle className="h-4 w-4" />
                )}
                Regenerate this layout
              </button>
            </div>
          ) : (
            <>
              <Block title="Prompt used">
                <p className="text-sm text-foreground leading-relaxed">
                  {displayPrompt || "—"}
                </p>
              </Block>

              <Block title="Design rationale">
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {variant.rationale}
                </p>
              </Block>

              <button
                type="button"
                onClick={handleRemix}
                disabled={isRegenerating}
                title="Regenerate with the main composer prompt"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0B0B] text-white py-3 text-sm font-medium hover:bg-[#1A1A1A] glow-subtle disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shuffle className="h-4 w-4" />
                )}
                Remix (same composer prompt)
              </button>

              <button
                type="button"
                onClick={() => {
                  editSessionRef.current = null;
                  setExpandedVariant(variant.id, "edit");
                }}
                className="flex w-full items-center justify-center rounded-2xl border border-border py-3 text-sm text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
              >
                Edit prompt…
              </button>
            </>
          )}
        </aside>
      </motion.div>
    </motion.div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
