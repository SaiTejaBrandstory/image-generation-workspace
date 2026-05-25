"use client";

import { useEffect } from "react";
import {
  clampVideoSettingsToModel,
  getVideoModelConfig,
} from "@/lib/openrouter-video-models";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

export function VideoOptionsSelects({ mobile }: { mobile?: boolean }) {
  const {
    videoModel,
    videoDuration,
    setVideoDuration,
    videoResolution,
    setVideoResolution,
    videoAspectRatio,
    setVideoAspectRatio,
    videoGenerateAudio,
    setVideoGenerateAudio,
  } = useWorkspaceStore();

  const config = getVideoModelConfig(videoModel);

  useEffect(() => {
    const clamped = clampVideoSettingsToModel(videoModel, {
      duration: videoDuration,
      resolution: videoResolution,
      aspectRatio: videoAspectRatio,
      generateAudio: videoGenerateAudio,
    });
    if (clamped.duration !== videoDuration) setVideoDuration(clamped.duration);
    if (clamped.resolution !== videoResolution) {
      setVideoResolution(clamped.resolution);
    }
    if (clamped.aspectRatio !== videoAspectRatio) {
      setVideoAspectRatio(clamped.aspectRatio);
    }
    if (clamped.generateAudio !== videoGenerateAudio) {
      setVideoGenerateAudio(clamped.generateAudio);
    }
  }, [
    videoModel,
    videoDuration,
    videoResolution,
    videoAspectRatio,
    videoGenerateAudio,
    setVideoDuration,
    setVideoResolution,
    setVideoAspectRatio,
    setVideoGenerateAudio,
  ]);

  const selectClass = mobile
    ? "w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm text-foreground border-0 outline-none cursor-pointer"
    : "shrink-0 rounded-xl bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground-muted border-0 outline-none cursor-pointer";

  const showAudioToggle = config.generateAudio === true;
  const durationCount = config.supportedDurations.length;

  return (
    <div
      className={cn(
        mobile ? "space-y-2" : "flex flex-wrap items-center gap-2"
      )}
    >
      <select
        value={videoDuration}
        onChange={(e) => setVideoDuration(Number(e.target.value))}
        className={selectClass}
        aria-label="Video duration in seconds"
        title={`${durationCount} duration option(s) for this model`}
      >
        {config.supportedDurations.map((d) => (
          <option key={d} value={d}>
            {d}s
          </option>
        ))}
      </select>
      <select
        value={videoResolution}
        onChange={(e) => setVideoResolution(e.target.value)}
        className={selectClass}
        aria-label="Video resolution"
        title={`${config.supportedResolutions.length} resolution(s) for this model`}
      >
        {config.supportedResolutions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select
        value={videoAspectRatio}
        onChange={(e) => setVideoAspectRatio(e.target.value)}
        className={cn(selectClass, !mobile && "max-w-[88px]")}
        aria-label="Video aspect ratio"
        title={`${config.supportedAspectRatios.length} aspect ratio(s) for this model`}
      >
        {config.supportedAspectRatios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      {showAudioToggle && (
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-xl bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground-muted",
            mobile && "justify-center py-2.5"
          )}
        >
          <input
            type="checkbox"
            checked={videoGenerateAudio}
            onChange={(e) => setVideoGenerateAudio(e.target.checked)}
            className="rounded border-border text-accent-cyan focus:ring-accent-cyan/40"
          />
          Audio
        </label>
      )}
      {config.generateAudio === false && !mobile && (
        <span className="text-[10px] text-foreground-muted/70">No audio</span>
      )}
    </div>
  );
}
