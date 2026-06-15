"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Link2,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { StoryboardVideoModelDialog } from "@/components/storyboard/storyboard-video-model-dialog";
import { SceneTransitionJoin } from "@/components/storyboard/scene-transition-join";
import { StoryboardVideoPlayer } from "@/components/storyboard/storyboard-video-player";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadVideo } from "@/lib/download-utils";
import { formatStoryboardVideoModelLabel } from "@/lib/openrouter-video-models";
import { formatStoryboardSceneLabel } from "@/lib/storyboard/bookend-scenes";
import {
  peekSceneClipUrl,
  resolveSceneClipUrl,
  sceneHasAnimatedClip,
  writeSceneClipUrlToStore,
} from "@/lib/storyboard/resolve-scene-clip-url";
import { storyboardVideoAspectRatioCss } from "@/lib/storyboard/storyboard-video";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";
import type { SceneTransition, StoryboardScene } from "@/types/storyboard";

function sceneClipDownloadName(scene: StoryboardScene, allScenes: StoryboardScene[]) {
  const label = formatStoryboardSceneLabel(scene, allScenes)
    .toLowerCase()
    .replace(/\s+/g, "-");
  return `storyboard-${label}.mp4`;
}

function SceneVideoPreview({
  scene,
  allScenes,
  aspectRatio,
  onWatch,
  disabled,
}: {
  scene: StoryboardScene;
  allScenes: StoryboardScene[];
  aspectRatio: string;
  onWatch: () => void;
  disabled: boolean;
}) {
  const [clipUrl, setClipUrl] = useState<string | undefined>(() =>
    peekSceneClipUrl(scene)
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const animated = sceneHasAnimatedClip(scene);

  useEffect(() => {
    let cancelled = false;
    if (!animated) {
      setClipUrl(undefined);
      return;
    }
    const peek = peekSceneClipUrl(scene);
    if (peek) {
      setClipUrl(peek);
      return;
    }

    void resolveSceneClipUrl(scene).then((url) => {
      if (cancelled || !url) return;
      setClipUrl(url);
      writeSceneClipUrlToStore(scene.id, url);
    });
    return () => {
      cancelled = true;
    };
  }, [animated, scene.id, scene.sceneVideoStoragePath, scene.sceneVideoStatus]);

  const playPreview = () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    void el.play().catch(() => undefined);
  };

  const pausePreview = () => {
    videoRef.current?.pause();
  };

  const sceneLabel = formatStoryboardSceneLabel(scene, allScenes);
  const aspectCss = storyboardVideoAspectRatioCss(aspectRatio);
  const durationLabel =
    scene.sceneVideoDurationSec != null
      ? `${scene.sceneVideoDurationSec}s`
      : `${scene.durationSec}s`;

  return (
    <button
      type="button"
      onClick={onWatch}
      onMouseEnter={playPreview}
      onMouseLeave={pausePreview}
      onFocus={playPreview}
      onBlur={pausePreview}
      disabled={disabled || !clipUrl}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-none border border-border bg-background text-left shadow-sm transition-all",
        "hover:border-accent-violet/50 hover:ring-2 hover:ring-accent-violet/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet",
        disabled && "pointer-events-none opacity-60"
      )}
      style={{ aspectRatio: aspectCss, width: "7.5rem" }}
      aria-label={`Watch ${sceneLabel} animation`}
    >
      {clipUrl ? (
        <video
          ref={videoRef}
          src={clipUrl}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : animated ? (
        <div className="flex h-full w-full items-center justify-center bg-black/80 text-[10px] text-foreground-muted">
          Loading…
        </div>
      ) : scene.frameImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={scene.frameImageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20" />

      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Ready
      </span>

      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
        {durationLabel}
      </span>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-accent-violet shadow-md transition-transform group-hover:scale-110">
          <Play className="h-4 w-4 fill-current pl-0.5" />
        </span>
      </div>
    </button>
  );
}

function WatchSceneClipPlayer({
  scene,
  aspectRatio,
  videoRef,
}: {
  scene: StoryboardScene;
  aspectRatio: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [clipUrl, setClipUrl] = useState<string | undefined>(() =>
    peekSceneClipUrl(scene)
  );
  const [loading, setLoading] = useState(!peekSceneClipUrl(scene));

  useEffect(() => {
    let cancelled = false;
    const peek = peekSceneClipUrl(scene);
    if (peek) {
      setClipUrl(peek);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void resolveSceneClipUrl(scene).then((url) => {
      if (cancelled) return;
      if (url) {
        setClipUrl(url);
        writeSceneClipUrlToStore(scene.id, url);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [scene.id, scene.sceneVideoStoragePath, scene.sceneVideoStatus]);

  const aspectCss = storyboardVideoAspectRatioCss(aspectRatio);

  if (loading && !clipUrl) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-none bg-black text-sm text-foreground-muted"
        style={{ aspectRatio: aspectCss, maxHeight: "min(70vh, 560px)" }}
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading clip…
      </div>
    );
  }

  if (!clipUrl) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-none bg-black px-4 text-center text-sm text-accent-orange"
        style={{ aspectRatio: aspectCss, maxHeight: "min(70vh, 560px)" }}
      >
        Could not load this clip. Try again in a moment.
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      key={clipUrl}
      src={clipUrl}
      className="w-full rounded-none bg-black object-contain"
      style={{
        aspectRatio: aspectCss,
        maxHeight: "min(70vh, 560px)",
      }}
      controls
      autoPlay
      playsInline
    />
  );
}

function SceneAnimateRow({
  scene,
  allScenes,
  aspectRatio,
  selected,
  onToggleSelect,
  onWatch,
  onAnimate,
  onRegenerate,
  disabled,
}: {
  scene: StoryboardScene;
  allScenes: StoryboardScene[];
  aspectRatio: string;
  selected: boolean;
  onToggleSelect: () => void;
  onWatch: () => void;
  onAnimate: () => void;
  onRegenerate: () => void;
  disabled: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const isGenerating = scene.sceneVideoStatus === "generating";
  const hasVideo = sceneHasAnimatedClip(scene);
  const sceneLabel = formatStoryboardSceneLabel(scene, allScenes);

  const handleDownload = async () => {
    const url =
      scene.sceneVideoUrl?.trim() || peekSceneClipUrl(scene);
    if (!url || downloading) return;
    setDownloading(true);
    try {
      await downloadVideo(url, sceneClipDownloadName(scene, allScenes));
    } catch {
      window.alert("Could not download this clip. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="rounded-lg border border-border bg-surface-elevated/50">
      <div className="flex flex-wrap items-start gap-3 p-3">
        <input
          type="checkbox"
          className="mt-2 h-4 w-4 rounded border-border"
          checked={selected}
          onChange={onToggleSelect}
          disabled={disabled || isGenerating || !scene.frameImageUrl}
          aria-label={`Select ${sceneLabel}`}
        />

        {hasVideo ? (
          <SceneVideoPreview
            scene={scene}
            allScenes={allScenes}
            aspectRatio={aspectRatio}
            onWatch={onWatch}
            disabled={disabled}
          />
        ) : (
          <div className="h-[4.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-none border border-border bg-background">
            {scene.frameImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scene.frameImageUrl}
                alt={`${sceneLabel} frame`}
                className="h-full w-full object-cover opacity-80"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-foreground-muted">
                No frame
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-accent-orange">
              {sceneLabel}
            </span>
            <span className="text-[11px] text-foreground-muted">
              {hasVideo &&
              scene.sceneVideoDurationSec &&
              scene.sceneVideoDurationSec !== scene.durationSec
                ? `slot ${scene.durationSec}s · clip ${scene.sceneVideoDurationSec}s`
                : `${scene.durationSec}s`}
            </span>
            {scene.sceneVideoModel && hasVideo ? (
              <span className="text-[11px] text-foreground-muted">
                ·{" "}
                {formatStoryboardVideoModelLabel(scene.sceneVideoModel, {
                  perClip: true,
                })}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-foreground">
            {scene.visualDescription || scene.voiceover || "Empty scene"}
          </p>
          {hasVideo ? (
            <p className="mt-1 text-[11px] text-accent-violet">
              Tap preview to watch clip
            </p>
          ) : null}
          {scene.sceneVideoError ? (
            <p className="mt-1 text-xs text-accent-orange">
              {scene.sceneVideoError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isGenerating ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-orange" />
              Animating…
            </span>
          ) : hasVideo ? (
            <>
              <Button
                variant="tintViolet"
                size="sm"
                onClick={onWatch}
                disabled={disabled}
              >
                <Play className="h-4 w-4" />
                Watch clip
              </Button>
              <Button
                variant="tintCyan"
                size="sm"
                onClick={() => void handleDownload()}
                disabled={downloading || disabled}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download
              </Button>
              <Button
                variant="tintOrange"
                size="sm"
                onClick={onRegenerate}
                disabled={disabled}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={onAnimate}
              disabled={disabled || !scene.frameImageUrl}
            >
              <Play className="h-4 w-4" />
              Animate
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function StoryboardSceneVideos() {
  const {
    scenes,
    settings,
    videoPrimaryModel,
    videoFallbackModel,
    videoAspectRatio,
    imageAspectRatio,
    generateSceneVideos,
    stitchSceneAnimations,
    updateScene,
    isAnyVideoGenerating,
    isGeneratingVideo,
    isGeneratingFrames,
    isGeneratingStitchedVideo,
    stitchedVideoProgress,
    stitchedVideoStatus,
    sceneStitchedVideoUrl,
    sceneStitchedVideoDurationSec,
  } = useStoryboardStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [watchSceneId, setWatchSceneId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingSceneIds, setPendingSceneIds] = useState<string[]>([]);
  const [dialogMode, setDialogMode] = useState<"generate" | "regenerate">(
    "generate"
  );
  const watchVideoRef = useRef<HTMLVideoElement>(null);

  const ordered = useMemo(
    () => [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber),
    [scenes]
  );

  const aspectRatio =
    videoAspectRatio || settings.imageAspectRatio || imageAspectRatio || "16:9";

  const watchableScenes = useMemo(
    () => ordered.filter((s) => sceneHasAnimatedClip(s)),
    [ordered]
  );

  const watchScene = useMemo(
    () => ordered.find((s) => s.id === watchSceneId) ?? null,
    [ordered, watchSceneId]
  );

  const watchIndex = useMemo(
    () => watchableScenes.findIndex((s) => s.id === watchSceneId),
    [watchableScenes, watchSceneId]
  );

  const goToWatchScene = useCallback(
    (direction: -1 | 1) => {
      if (watchIndex < 0) return;
      const next = watchableScenes[watchIndex + direction];
      if (next) setWatchSceneId(next.id);
    },
    [watchIndex, watchableScenes]
  );

  const canGoPrev = watchIndex > 0;
  const canGoNext =
    watchIndex >= 0 && watchIndex < watchableScenes.length - 1;

  useEffect(() => {
    if (!watchScene || !sceneHasAnimatedClip(watchScene)) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && canGoPrev) {
        e.preventDefault();
        goToWatchScene(-1);
      } else if (e.key === "ArrowRight" && canGoNext) {
        e.preventDefault();
        goToWatchScene(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [watchScene, canGoPrev, canGoNext, goToWatchScene]);

  const anyBusy =
    isGeneratingVideo ||
    isGeneratingFrames ||
    isGeneratingStitchedVideo ||
    isAnyVideoGenerating() ||
    ordered.some((s) => s.frameStatus === "generating");

  const allAnimated =
    ordered.length > 0 &&
    ordered.every((scene) => sceneHasAnimatedClip(scene));

  const stitchTotalDurationSec = ordered.reduce(
    (sum, scene) => sum + (scene.sceneVideoDurationSec ?? scene.durationSec),
    0
  );

  const dialogScenes = useMemo(
    () => ordered.filter((scene) => pendingSceneIds.includes(scene.id)),
    [ordered, pendingSceneIds]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDialog = (sceneIds: string[], mode: "generate" | "regenerate") => {
    setPendingSceneIds(sceneIds);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handleDialogConfirm = (
    primary: string,
    fallback: string,
    aspect: string,
    enableVoiceover: boolean
  ) => {
    setDialogOpen(false);
    useStoryboardStore.getState().setStoryboardVideoModels(primary, fallback, aspect);
    void generateSceneVideos(pendingSceneIds, {
      videoAspectRatio: aspect,
      enableVoiceover,
    });
    setSelectedIds(new Set());
  };

  const animateSelected = () => {
    const ids = selectedIds.size
      ? [...selectedIds]
      : ordered
          .filter((s) => !sceneHasAnimatedClip(s) && s.frameImageUrl)
          .map((s) => s.id);
    if (!ids.length) return;
    openDialog(ids, "generate");
  };

  const animatedCount = ordered.filter((s) => sceneHasAnimatedClip(s)).length;

  return (
    <section className="mt-8 space-y-4 border-t border-border pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Clapperboard className="h-4 w-4 text-accent-violet" />
            Scene animations
          </h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Animate all selected scenes in parallel — model voice and music per clip.
            {animatedCount > 0
              ? ` · ${animatedCount} of ${ordered.length} animated`
              : ""}
          </p>
        </div>
        <Button
          variant="tintViolet"
          size="sm"
          onClick={animateSelected}
          disabled={anyBusy || !ordered.some((s) => s.frameImageUrl)}
        >
          {anyBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Animate {selectedIds.size ? `selected (${selectedIds.size})` : "missing"}
        </Button>
      </div>

      <div className="space-y-2">
        {ordered.map((scene, index) => (
          <Fragment key={scene.id}>
            <SceneAnimateRow
              scene={scene}
              allScenes={ordered}
              aspectRatio={aspectRatio}
              selected={selectedIds.has(scene.id)}
              onToggleSelect={() => toggleSelect(scene.id)}
              onWatch={() => setWatchSceneId(scene.id)}
              onAnimate={() => openDialog([scene.id], "generate")}
              onRegenerate={() => openDialog([scene.id], "regenerate")}
              disabled={anyBusy}
            />
            {index < ordered.length - 1 ? (
              <SceneTransitionJoin
                fromScene={scene}
                toScene={ordered[index + 1]!}
                allScenes={ordered}
                aspectRatio={aspectRatio}
                disabled={anyBusy}
                onTransitionChange={(transition: SceneTransition) =>
                  updateScene(scene.id, { transition }, { skipHistory: true })
                }
              />
            ) : null}
          </Fragment>
        ))}
      </div>

      {(animatedCount > 0 || sceneStitchedVideoUrl) && (
        <div className="mt-6 border-t border-border pt-6">
          <StoryboardVideoPlayer
            title="Stitched scene animations"
            subtitle={
              isGeneratingStitchedVideo
                ? (stitchedVideoStatus ?? "Joining clips in scene order…")
                : allAnimated
                  ? `${ordered.length} clips · transitions only at scene joins you set · keeps each clip's audio`
                  : `${animatedCount} of ${ordered.length} animated — finish all scenes to stitch`
            }
            progressLabel={
              stitchedVideoStatus ?? "Stitching scene clips — usually under a minute"
            }
            placeholderText="No stitched video yet"
            emptyStateHint="Join scene clips with motion transitions between each scene."
            downloadFilename="storyboard-scene-stitch.mp4"
            videoUrl={sceneStitchedVideoUrl}
            durationSec={sceneStitchedVideoDurationSec ?? undefined}
            storyboardDurationSec={stitchTotalDurationSec}
            sceneCount={ordered.length}
            aspectRatio={aspectRatio}
            isGenerating={isGeneratingStitchedVideo}
            videoProgress={stitchedVideoProgress}
            onGenerate={
              allAnimated ? () => void stitchSceneAnimations() : undefined
            }
            onRegenerate={
              allAnimated && sceneStitchedVideoUrl
                ? () => void stitchSceneAnimations()
                : undefined
            }
            generateDisabled={!allAnimated || anyBusy}
            regenerateDisabled={!allAnimated || anyBusy}
            generateLabel="Stitch clips"
            regenerateLabel="Re-stitch clips"
          />
          {!isGeneratingStitchedVideo && allAnimated && !sceneStitchedVideoUrl ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground-muted">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              All clips are ready — stitch joins them into one video without
              re-generating.
            </p>
          ) : null}
        </div>
      )}

      <Dialog
        open={Boolean(watchScene && sceneHasAnimatedClip(watchScene))}
        onOpenChange={(open) => {
          if (!open) {
            watchVideoRef.current?.pause();
            setWatchSceneId(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 pb-3 pt-5 pr-12">
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base">
              <span>
                {watchScene
                  ? `${formatStoryboardSceneLabel(watchScene, ordered)} · animation`
                  : "Animation"}
              </span>
              {watchableScenes.length > 1 ? (
                <span className="text-xs font-normal tabular-nums text-foreground-muted">
                  ({watchIndex + 1} of {watchableScenes.length})
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="mt-1 line-clamp-2 text-xs">
              {watchScene?.visualDescription ||
                watchScene?.voiceover ||
                "Storyboard clip"}
            </DialogDescription>
            {watchScene?.sceneVideoModel ? (
              <p className="mt-1.5 text-[11px] text-foreground-muted">
                {formatStoryboardVideoModelLabel(watchScene.sceneVideoModel, {
                  perClip: true,
                })}
              </p>
            ) : null}
          </DialogHeader>
          {watchScene && sceneHasAnimatedClip(watchScene) ? (
            <div className="relative bg-background px-5 pb-5 pt-4">
              {canGoPrev ? (
                <button
                  type="button"
                  onClick={() => goToWatchScene(-1)}
                  className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-md backdrop-blur transition-colors hover:bg-surface-elevated"
                  aria-label="Previous scene clip"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : null}
              {canGoNext ? (
                <button
                  type="button"
                  onClick={() => goToWatchScene(1)}
                  className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-md backdrop-blur transition-colors hover:bg-surface-elevated"
                  aria-label="Next scene clip"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              ) : null}
              <WatchSceneClipPlayer
                scene={watchScene}
                aspectRatio={aspectRatio}
                videoRef={watchVideoRef}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <StoryboardVideoModelDialog
        open={dialogOpen}
        mode={dialogMode}
        variant="scene"
        primaryModel={videoPrimaryModel}
        fallbackModel={videoFallbackModel}
        videoAspectRatio={videoAspectRatio}
        frameAspectRatio={imageAspectRatio}
        settingsFrameAspectRatio={settings.imageAspectRatio}
        scenes={dialogScenes}
        enableVoiceover={settings.enableVoiceover !== false}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogOpen(false)}
      />
    </section>
  );
}
