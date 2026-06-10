"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadVideo } from "@/lib/download-utils";
import { storyboardVideoAspectRatioCss } from "@/lib/storyboard/storyboard-video";
import { cn } from "@/lib/utils";

export function StoryboardVideoPlayer({
  title = "Storyboard video",
  subtitle,
  progressLabel = "Generating video — this can take several minutes",
  placeholderText = "Your video will appear here when ready",
  downloadFilename = "storyboard-video.mp4",
  videoUrl,
  durationSec,
  storyboardDurationSec,
  sceneCount,
  aspectRatio = "16:9",
  isGenerating,
  videoProgress = 0,
  onGenerate,
  onRegenerate,
  generateDisabled = false,
  regenerateDisabled = false,
  generateLabel = "Generate video",
  regenerateLabel = "Regenerate video",
}: {
  title?: string;
  subtitle?: string;
  progressLabel?: string;
  placeholderText?: string;
  downloadFilename?: string;
  videoUrl?: string | null;
  durationSec?: number;
  /** Storyboard script timing (may differ from actual generated clip length). */
  storyboardDurationSec?: number;
  sceneCount?: number;
  aspectRatio?: string;
  isGenerating?: boolean;
  videoProgress?: number;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  generateDisabled?: boolean;
  regenerateDisabled?: boolean;
  generateLabel?: string;
  regenerateLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const aspectCss = storyboardVideoAspectRatioCss(aspectRatio);
  const isPortrait =
    aspectRatio === "9:16" ||
    aspectRatio === "3:4" ||
    aspectRatio === "2:3" ||
    aspectRatio === "9:21" ||
    aspectRatio === "1:4" ||
    aspectRatio === "1:8";

  const frameClassName = cn(
    "mx-auto w-full max-h-[min(70vh,560px)] bg-background",
    isPortrait ? "max-w-[min(100%,calc(min(70vh,560px)*9/16))]" : "max-w-full"
  );

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const handleDownload = async () => {
    if (!videoUrl || downloading) return;
    setDownloading(true);
    try {
      await downloadVideo(videoUrl, downloadFilename);
    } catch {
      window.alert("Could not download the video. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-foreground-muted">
          {subtitle ??
            (isGenerating
              ? "Generating…"
              : sceneCount
                ? `${sceneCount} frames`
                : "Storyboard animatic")}
          {!isGenerating && aspectRatio ? ` · ${aspectRatio}` : ""}
          {!isGenerating && durationSec
            ? storyboardDurationSec && storyboardDurationSec !== durationSec
              ? ` · video ${durationSec}s (storyboard ${storyboardDurationSec}s)`
              : ` · ${durationSec}s`
            : ""}
        </p>
      </div>

      {isGenerating && (
        <div className="rounded-lg border border-border bg-surface-elevated px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-foreground-muted">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-orange" />
              {progressLabel}
            </span>
            <span className="tabular-nums">{videoProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent-orange transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, videoProgress))}%` }}
            />
          </div>
          {videoProgress >= 70 && videoProgress < 100 && (
            <p className="mt-2 text-[11px] text-foreground-muted/80">
              Still working — video models can take several more minutes after 70%.
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {isGenerating ? (
          <div
            className={cn(
              frameClassName,
              "flex flex-col items-center justify-center gap-3 text-foreground-muted"
            )}
            style={{ aspectRatio: aspectCss }}
          >
            <Loader2 className="h-10 w-10 animate-spin text-accent-orange" />
            <p className="text-sm">{placeholderText}</p>
            <p className="text-xs text-foreground-muted/80">
              Do not close this tab while generation is in progress
            </p>
          </div>
        ) : videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className={cn(frameClassName, "object-contain")}
            style={{ aspectRatio: aspectCss }}
            playsInline
            controls
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div
            className={cn(
              frameClassName,
              "flex flex-col items-center justify-center gap-3 px-6 text-center text-foreground-muted"
            )}
            style={{ aspectRatio: aspectCss }}
          >
            <p className="text-sm">No video yet</p>
            <p className="text-xs text-foreground-muted/80">
              {onGenerate
                ? "Generate a single AI video from all frames and your script."
                : "Keep this tab open until generation finishes."}
            </p>
            {onGenerate && (
              <Button
                variant="accent"
                size="sm"
                onClick={onGenerate}
                disabled={generateDisabled}
              >
                {generateLabel}
              </Button>
            )}
          </div>
        )}
      </div>

      {!isGenerating && videoUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="tintViolet" size="sm" onClick={togglePlay}>
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            variant="tintCyan"
            size="sm"
            onClick={() => void handleDownload()}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? "Downloading…" : "Download video"}
          </Button>
          {onRegenerate ? (
            <Button
              variant="tintOrange"
              size="sm"
              onClick={onRegenerate}
              disabled={regenerateDisabled}
            >
              <RefreshCw className="h-4 w-4" />
              {regenerateLabel}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
