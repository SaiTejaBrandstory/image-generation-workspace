"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StoryboardVideoPlayer({
  title = "Storyboard video",
  subtitle,
  progressLabel = "Generating video — this can take several minutes",
  placeholderText = "Your video will appear here when ready",
  downloadFilename = "storyboard-video.mp4",
  videoUrl,
  durationSec,
  sceneCount,
  isGenerating,
  videoProgress = 0,
}: {
  title?: string;
  subtitle?: string;
  progressLabel?: string;
  placeholderText?: string;
  downloadFilename?: string;
  videoUrl?: string | null;
  durationSec?: number;
  sceneCount?: number;
  isGenerating?: boolean;
  videoProgress?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

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
          {!isGenerating && durationSec ? ` · ${durationSec}s` : ""}
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
              className="h-full rounded-full bg-accent-orange transition-all duration-500"
              style={{ width: `${videoProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {isGenerating ? (
          <div className="flex aspect-video max-h-[min(70vh,480px)] w-full flex-col items-center justify-center gap-3 text-foreground-muted">
            <Loader2 className="h-10 w-10 animate-spin text-accent-orange" />
            <p className="text-sm">{placeholderText}</p>
            <p className="text-xs text-foreground-muted/80">
              Do not close this tab while generation is in progress
            </p>
          </div>
        ) : (
          videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className="aspect-video max-h-[min(70vh,480px)] w-full object-cover"
              playsInline
              controls
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          )
        )}
      </div>

      {!isGenerating && videoUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={togglePlay}>
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {playing ? "Pause" : "Play"}
          </Button>
          <a
            href={videoUrl}
            download={downloadFilename}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Download video
          </a>
        </div>
      )}
    </section>
  );
}
