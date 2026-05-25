"use client";

import {
  clampVideoSettingsToModel,
  DEFAULT_VIDEO_MODEL,
  getVideoModelConfig,
  getVideoModelsCatalog,
  isValidVideoModel,
  setVideoModelsCatalog,
  videoModelsByGroup,
  VIDEO_MODEL_GROUPS,
} from "@/lib/openrouter-video-models";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useEffect, useState } from "react";

export function VideoModelSelector() {
  const {
    videoModel,
    setVideoModel,
    videoDuration,
    videoResolution,
    videoAspectRatio,
    videoGenerateAudio,
    setVideoDuration,
    setVideoResolution,
    setVideoAspectRatio,
    setVideoGenerateAudio,
  } = useWorkspaceStore();
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/video/models");
        const data = await res.json();
        if (!cancelled && Array.isArray(data.models) && data.models.length) {
          setVideoModelsCatalog(data.models);
        }
      } catch {
        /* static catalog */
      } finally {
        if (!cancelled) setCatalogReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!catalogReady) return;
    if (!isValidVideoModel(videoModel)) {
      setVideoModel(DEFAULT_VIDEO_MODEL);
    }
  }, [catalogReady, videoModel, setVideoModel]);

  const handleModelChange = (id: string) => {
    setVideoModel(id);
    const clamped = clampVideoSettingsToModel(id, {
      duration: videoDuration,
      resolution: videoResolution,
      aspectRatio: videoAspectRatio,
      generateAudio: videoGenerateAudio,
    });
    setVideoDuration(clamped.duration);
    setVideoResolution(clamped.resolution);
    setVideoAspectRatio(clamped.aspectRatio);
    setVideoGenerateAudio(clamped.generateAudio);
  };

  const activeId = isValidVideoModel(videoModel)
    ? videoModel
    : DEFAULT_VIDEO_MODEL;
  const config = getVideoModelConfig(activeId);
  const grouped = videoModelsByGroup();
  const totalModels = getVideoModelsCatalog().length;

  return (
    <select
      value={activeId}
      onChange={(e) => handleModelChange(e.target.value)}
      title={`${config.label} — ${config.description}`}
      className="max-w-[220px] truncate rounded-xl bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground-muted border-0 outline-none cursor-pointer hover:text-foreground"
      aria-label={`Video model (${totalModels} available)`}
    >
      {VIDEO_MODEL_GROUPS.map((group) => {
        const models = grouped.get(group) ?? [];
        if (models.length === 0) return null;
        return (
          <optgroup key={group} label={group}>
            {models.map((m) => (
              <option key={m.id} value={m.id} title={m.description}>
                {m.label}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
