"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Volume2, VolumeX } from "lucide-react";
import "./scene-transition-join.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessageFromUnknown } from "@/lib/api-response";
import { formatStoryboardSceneLabel } from "@/lib/storyboard/bookend-scenes";
import { getSceneTransitionMeta } from "@/lib/storyboard/scene-transition-meta";
import { fetchJoinTransitionPreview } from "@/lib/storyboard/preview-join-transition-client";
import { sceneHasAnimatedClip } from "@/lib/storyboard/resolve-scene-clip-url";
import {
  getCategoryForTransition,
  getTransitionsForCategory,
  normalizeSceneTransition,
  TRANSITION_CATEGORIES,
  type TransitionCategory,
} from "@/lib/storyboard/xfade-transitions";
import { storyboardVideoAspectRatioCss } from "@/lib/storyboard/storyboard-video";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";
import type { SceneTransition, StoryboardScene } from "@/types/storyboard";

function useJoinScenesReady(
  fromScene: StoryboardScene,
  toScene: StoryboardScene
) {
  const liveFrom = useStoryboardStore(
    (s) => s.scenes.find((scene) => scene.id === fromScene.id) ?? fromScene
  );
  const liveTo = useStoryboardStore(
    (s) => s.scenes.find((scene) => scene.id === toScene.id) ?? toScene
  );

  const hasClips =
    sceneHasAnimatedClip(liveFrom) && sceneHasAnimatedClip(liveTo);

  return {
    hasClips,
    fromStoragePath: liveFrom.sceneVideoStoragePath?.trim(),
    toStoragePath: liveTo.sceneVideoStoragePath?.trim(),
  };
}

function useJoinTransitionPreview({
  open,
  enabled,
  fromStoragePath,
  toStoragePath,
  transition,
  transitionLabel,
}: {
  open: boolean;
  enabled: boolean;
  fromStoragePath?: string;
  toStoragePath?: string;
  transition: SceneTransition;
  transitionLabel: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Loading preview…");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !enabled || !fromStoragePath || !toStoragePath) {
      setPreviewUrl(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }

    const ac = new AbortController();
    setPreviewUrl(undefined);
    setLoading(true);
    setLoadingLabel(`Loading ${transitionLabel} preview…`);
    setError(undefined);

    const startedAt = Date.now();

    void fetchJoinTransitionPreview({
      fromStoragePath,
      toStoragePath,
      transition,
      signal: ac.signal,
    })
      .then((url) => {
        if (ac.signal.aborted) return;
        const elapsed = Date.now() - startedAt;
        const minLoadingMs = 700;
        const reveal = () => {
          if (ac.signal.aborted) return;
          setPreviewUrl(url);
          setLoading(false);
        };
        if (elapsed < minLoadingMs) {
          setTimeout(reveal, minLoadingMs - elapsed);
        } else {
          reveal();
        }
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setPreviewUrl(undefined);
        setError(errorMessageFromUnknown(err, "Could not load preview."));
        setLoading(false);
      });

    return () => ac.abort();
  }, [
    open,
    enabled,
    fromStoragePath,
    toStoragePath,
    transition,
    transitionLabel,
  ]);

  return { previewUrl, loading, loadingLabel, error };
}

function JoinTransitionPreview({
  previewUrl,
  loading,
  loadingLabel,
  error,
  hasClips,
  aspectCss,
  className,
  replayToken = 0,
}: {
  previewUrl?: string;
  loading: boolean;
  loadingLabel: string;
  error?: string;
  hasClips: boolean;
  aspectCss: string;
  className?: string;
  replayToken?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioMuted, setAudioMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewUrl) return;
    video.muted = audioMuted;
    try {
      video.currentTime = 0;
    } catch {
      /* ignore */
    }
    void video.play().catch(() => undefined);
  }, [previewUrl, replayToken, audioMuted]);

  const toggleAudio = useCallback(() => {
    setAudioMuted((prev) => {
      const next = !prev;
      const video = videoRef.current;
      if (video) {
        video.muted = next;
        if (!next) void video.play().catch(() => undefined);
      }
      return next;
    });
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-black",
        className
      )}
      style={{ aspectRatio: aspectCss }}
    >
      {loading || !previewUrl ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/80 px-3 text-center text-[11px] text-foreground-muted">
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-accent-violet" />
              <span>{loadingLabel}</span>
            </>
          ) : error ? (
            <span>{error}</span>
          ) : hasClips ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-accent-violet" />
              <span>Loading preview…</span>
            </>
          ) : (
            <>
              <span>Animate both scenes</span>
              <span>to preview this join</span>
            </>
          )}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={previewUrl}
            muted={audioMuted}
            playsInline
            loop
            preload="auto"
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={toggleAudio}
            className={cn(
              "absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-md backdrop-blur-sm transition-colors",
              "hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/50"
            )}
            aria-label={audioMuted ? "Unmute preview" : "Mute preview"}
            title={audioMuted ? "Unmute" : "Mute"}
          >
            {audioMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </>
      )}
    </div>
  );
}

function TransitionCategoryTab({
  category,
  active,
  onClick,
}: {
  category: (typeof TRANSITION_CATEGORIES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "transition-cat-tab",
        `transition-cat-tab--${category.id}`,
        active && "transition-cat-tab--active"
      )}
      aria-pressed={active}
    >
      <span className="transition-cat-tab__swatch" aria-hidden />
      <span className="transition-cat-tab__label">{category.label}</span>
    </button>
  );
}

function TransitionOptionChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        selected
          ? "border-accent-violet bg-accent-violet/10 text-accent-violet"
          : "border-border text-foreground-muted hover:border-accent-violet/30 hover:text-foreground"
      )}
    >
      {label}
      {selected ? <Check className="h-3 w-3 shrink-0" /> : null}
    </button>
  );
}

export function SceneTransitionJoin({
  fromScene,
  toScene,
  allScenes,
  aspectRatio,
  disabled,
  onTransitionChange,
}: {
  fromScene: StoryboardScene;
  toScene: StoryboardScene;
  allScenes: StoryboardScene[];
  aspectRatio: string;
  disabled?: boolean;
  onTransitionChange: (transition: SceneTransition) => void;
}) {
  const [open, setOpen] = useState(false);
  const savedTransition = fromScene.transition ?? "cut";
  const [previewTransition, setPreviewTransition] =
    useState<SceneTransition>(savedTransition);
  const [activeCategory, setActiveCategory] = useState<TransitionCategory>("fade");
  const [replayToken, setReplayToken] = useState(0);

  const liveFrom = useStoryboardStore(
    (s) => s.scenes.find((scene) => scene.id === fromScene.id) ?? fromScene
  );

  const { hasClips, fromStoragePath, toStoragePath } = useJoinScenesReady(
    fromScene,
    toScene
  );

  const canPreview = Boolean(
    hasClips && fromStoragePath && toStoragePath
  );

  const previewMeta = useMemo(
    () => getSceneTransitionMeta(previewTransition),
    [previewTransition]
  );

  const appliedMeta = useMemo(
    () => getSceneTransitionMeta(liveFrom.transition ?? "cut"),
    [liveFrom.transition]
  );

  const { previewUrl, loading: previewLoading, loadingLabel, error: previewError } =
    useJoinTransitionPreview({
      open,
      enabled: canPreview,
      fromStoragePath,
      toStoragePath,
      transition: previewTransition,
      transitionLabel: previewMeta.label,
    });

  useEffect(() => {
    if (open) {
      const initial = fromScene.transition ?? "cut";
      setPreviewTransition(initial);
      setActiveCategory(getCategoryForTransition(initial));
      setReplayToken(0);
    }
  }, [open, fromScene.transition]);

  const categoryOptions = useMemo(
    () => getTransitionsForCategory(activeCategory),
    [activeCategory]
  );

  const selectedTransitionId = normalizeSceneTransition(previewTransition);

  const aspectCss = storyboardVideoAspectRatioCss(aspectRatio);
  const fromLabel = formatStoryboardSceneLabel(fromScene, allScenes);
  const toLabel = formatStoryboardSceneLabel(toScene, allScenes);

  const isDirty = previewTransition !== savedTransition;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPreviewTransition(fromScene.transition ?? "cut");
      setReplayToken(0);
    }
    setOpen(next);
  };

  const handleCancel = () => {
    setPreviewTransition(fromScene.transition ?? "cut");
    setOpen(false);
  };

  const handleApply = () => {
    if (previewTransition !== savedTransition) {
      onTransitionChange(previewTransition);
    }
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 py-0.5 pl-8 pr-3">
        <div className="h-px flex-1 bg-border" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/30",
            "border-accent-violet/35 bg-accent-violet/8 text-accent-violet",
            "hover:border-accent-violet/50 hover:bg-accent-violet/12",
            disabled && "pointer-events-none opacity-50"
          )}
          title={`${appliedMeta.label} — transition from ${fromLabel} to ${toLabel}`}
        >
          <Plus className="h-3 w-3 shrink-0" />
          <span>{appliedMeta.label}</span>
        </button>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">Scene transition</DialogTitle>
                <DialogDescription>
                  {fromLabel} → {toLabel}. Effect applies only at the join between
                  these two clips.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-foreground-muted">
                    Preview — {previewMeta.label}
                  </p>
                  <JoinTransitionPreview
                    previewUrl={previewUrl}
                    loading={previewLoading}
                    loadingLabel={loadingLabel}
                    error={previewError}
                    hasClips={hasClips}
                    aspectCss={aspectCss}
                    className="w-full"
                    replayToken={replayToken}
                  />
                  <p className="mt-1.5 text-[11px] text-foreground-muted">
                    {previewLoading
                      ? loadingLabel
                      : previewError
                        ? previewError
                        : canPreview
                          ? `${previewMeta.description} Select another option to compare.`
                          : hasClips
                            ? "Re-animate scenes to enable preview."
                            : "Animate both scenes first."}
                  </p>
                </div>

                <div className="space-y-2 rounded-md border border-border p-2">
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3">
                    {TRANSITION_CATEGORIES.map((category) => (
                      <TransitionCategoryTab
                        key={category.id}
                        category={category}
                        active={activeCategory === category.id}
                        onClick={() => setActiveCategory(category.id)}
                      />
                    ))}
                  </div>
                  <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pt-0.5">
                    {categoryOptions.map((item) => (
                      <TransitionOptionChip
                        key={item.id}
                        label={item.label}
                        selected={selectedTransitionId === item.id}
                        onClick={() => {
                          setPreviewTransition(item.id as SceneTransition);
                          setReplayToken((t) => t + 1);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-2 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="tintViolet"
                  size="sm"
                  onClick={handleApply}
                  disabled={!isDirty}
                >
                  Apply transition
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
