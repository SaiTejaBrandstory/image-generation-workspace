"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { LAYOUT_MAP } from "@/lib/layout-systems";
import { downloadAllImages } from "@/lib/download-utils";
import type { LayoutVariant } from "@/types";

function isRealImage(url?: string) {
  return (
    !!url &&
    (url.startsWith("data:image") ||
      url.startsWith("http://") ||
      url.startsWith("https://"))
  );
}

export function DownloadAllButton({
  variants,
  variant = "default",
}: {
  variants: LayoutVariant[];
  variant?: "default" | "icon";
}) {
  const [downloading, setDownloading] = useState(false);

  const complete = variants.filter(
    (v) => v.status === "complete" && isRealImage(v.imageUrl)
  );

  if (complete.length === 0) return null;

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      await downloadAllImages(
        complete.map((v) => ({
          url: v.imageUrl!,
          layoutName: LAYOUT_MAP[v.layoutId]?.name ?? v.layoutId,
          layoutId: v.layoutId,
        }))
      );
    } catch (err) {
      console.error("Download all failed:", err);
      alert(
        err instanceof Error ? err.message : "Failed to download images"
      );
    } finally {
      setDownloading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => void handleDownloadAll()}
        disabled={downloading}
        aria-label={`Download all ${complete.length} images`}
        title={`Download all ${complete.length} images as ZIP`}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-elevated hover:text-foreground disabled:opacity-50"
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownloadAll()}
      disabled={downloading}
      title={`Download all ${complete.length} images as ZIP`}
      className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
    >
      {downloading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Download all
    </button>
  );
}
