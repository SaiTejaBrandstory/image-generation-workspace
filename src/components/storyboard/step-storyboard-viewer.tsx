"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  Expand,
  Film,
  Grid3X3,
  LayoutGrid,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Timer,
} from "lucide-react";
import { StoryboardImageModelDialog } from "@/components/storyboard/storyboard-image-model-dialog";
import { StoryboardSceneEditDialog } from "@/components/storyboard/storyboard-scene-edit-dialog";
import { StoryboardVideoModelDialog } from "@/components/storyboard/storyboard-video-model-dialog";
import { StoryboardSceneVideos } from "@/components/storyboard/storyboard-scene-videos";
import { StoryboardVideoPlayer } from "@/components/storyboard/storyboard-video-player";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadImage } from "@/lib/download-utils";
import { exportStoryboardPdf } from "@/lib/storyboard/export";
import { SCENE_TRANSITIONS } from "@/lib/storyboard/constants";
import { isPendingVideoForConversation } from "@/lib/storyboard/pending-video";
import { formatStoryboardVideoModelLabel } from "@/lib/openrouter-video-models";
import {
  chunkStoryboardScenesForVideo,
  needsStoryboardVideoBatching,
} from "@/lib/storyboard/storyboard-video";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import type { AspectRatio } from "@/types";
import type { StoryboardScene, StoryboardViewMode } from "@/types/storyboard";

const VIEW_MODES: {
  id: StoryboardViewMode;
  label: string;
  icon: typeof Grid3X3;
}[] = [
  { id: "grid", label: "Grid", icon: Grid3X3 },
  { id: "filmstrip", label: "Filmstrip", icon: Film },
  { id: "presentation", label: "Presentation", icon: MonitorPlay },
  { id: "timeline", label: "Timeline", icon: Timer },
];

export function StepStoryboardViewer() {
  const {
    scenes,
    script,
    settings,
    viewMode,
    setViewMode,
    prevStep,
    wizardLocked,
    isCommitting,
    error,
    generateFrame,
    generateAllFrames,
    regenerateFrames,
    isFrameBusy,
    updateScene,
    isGeneratingFrames,
    generationProgress,
    isGeneratingVideo,
    videoProgress,
    videoGenerationStatus,
    storyboardVideoUrl,
    storyboardVideoDurationSec,
    storyboardVideoModel,
    generateStoryboardVideo,
    imagePrimaryModel,
    imageAspectRatio,
    setStoryboardImageModel,
    videoPrimaryModel,
    videoFallbackModel,
    videoAspectRatio,
    setStoryboardVideoModels,
    isAnyVideoGenerating,
    resetStoryboard,
    refreshStoryboardVideos,
    checkPendingStoryboardVideo,
    conversationId,
    singleVideoStoragePath,
    loadStoryboardConversation,
  } = useStoryboardStore();

  const [isRestoring, setIsRestoring] = useState(false);

  const pendingSingleVideo =
    isPendingVideoForConversation(conversationId, "single") &&
    !storyboardVideoUrl;
  const hasSingleVideo = Boolean(
    storyboardVideoUrl || singleVideoStoragePath
  );
  const usesVideoBatching = needsStoryboardVideoBatching(scenes);
  const videoSegmentCount = useMemo(
    () => chunkStoryboardScenesForVideo(scenes).length,
    [scenes]
  );

  const [presentationIndex, setPresentationIndex] = useState(0);
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);
  const [imageModelDialogOpen, setImageModelDialogOpen] = useState(false);
  const [imageDialogMode, setImageDialogMode] = useState<
    "regenerate" | "missing"
  >("regenerate");
  const [pendingRegenerateIds, setPendingRegenerateIds] = useState<
    string[] | undefined
  >(undefined);
  const [videoModelDialogOpen, setVideoModelDialogOpen] = useState(false);
  const [videoReplaceOnConfirm, setVideoReplaceOnConfirm] = useState(false);
  const videoSectionRef = useRef<HTMLDivElement>(null);

  const videoModelIdForSubtitle =
    hasSingleVideo && storyboardVideoModel
      ? storyboardVideoModel
      : isGeneratingVideo || pendingSingleVideo
        ? videoPrimaryModel
        : null;

  const videoSubtitleModelLabel = videoModelIdForSubtitle
    ? formatStoryboardVideoModelLabel(videoModelIdForSubtitle, {
        perClip: usesVideoBatching,
      })
    : null;

  const openVideoModelDialog = (replace = false) => {
    setVideoReplaceOnConfirm(replace);
    setVideoModelDialogOpen(true);
  };

  const handleVideoModelConfirm = (
    primary: string,
    fallback: string,
    aspectRatio: string
  ) => {
    setVideoModelDialogOpen(false);
    setStoryboardVideoModels(primary, fallback, aspectRatio);
    void generateStoryboardVideo({
      replace: videoReplaceOnConfirm,
      videoAspectRatio: aspectRatio,
    });
  };

  const totalDuration = useMemo(
    () => scenes.reduce((sum, s) => sum + s.durationSec, 0),
    [scenes]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const anyFrameGenerating =
    isGeneratingFrames || scenes.some((s) => s.frameStatus === "generating");

  const allFramesReady =
    scenes.length > 0 &&
    scenes.every((s) => s.frameImageUrl && s.frameStatus === "complete");

  const handleRegenerateOne = (sceneId: string) => {
    if (isFrameBusy(sceneId)) return;
    void generateFrame(sceneId);
  };

  const openImageModelDialog = (
    mode: "regenerate" | "missing",
    sceneIds?: string[]
  ) => {
    setImageDialogMode(mode);
    setPendingRegenerateIds(sceneIds);
    setImageModelDialogOpen(true);
  };

  const handleRegenerateSelected = () => {
    if (anyFrameGenerating) return;
    const ids = selectedIds.size ? [...selectedIds] : undefined;
    openImageModelDialog("regenerate", ids);
  };

  const handleImageModelConfirm = (model: string, aspectRatio: AspectRatio) => {
    setImageModelDialogOpen(false);
    setStoryboardImageModel(model, aspectRatio);
    if (imageDialogMode === "missing") {
      void generateAllFrames(true);
      return;
    }
    void regenerateFrames(pendingRegenerateIds);
  };

  const imageDialogFrameCount = useMemo(() => {
    if (imageDialogMode === "missing") {
      return scenes.filter(
        (s) =>
          !s.frameImageUrl || s.frameStatus === "pending" || s.frameStatus === "error"
      ).length;
    }
    if (pendingRegenerateIds?.length) return pendingRegenerateIds.length;
    return scenes.length;
  }, [imageDialogMode, pendingRegenerateIds, scenes]);

  const handleExportPdf = async () => {
    setExportPdfError(null);
    setIsExportingPdf(true);
    try {
      await exportStoryboardPdf(script, settings, scenes);
    } catch (err) {
      setExportPdfError(
        err instanceof Error ? err.message : "Failed to export storyboard PDF"
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const presentationScene = scenes[presentationIndex];
  const previewSceneIndex =
    previewSceneId !== null
      ? scenes.findIndex((s) => s.id === previewSceneId)
      : -1;
  const previewScene =
    previewSceneIndex >= 0 ? scenes[previewSceneIndex] : null;
  const editScene = useMemo(
    () => scenes.find((s) => s.id === editSceneId) ?? null,
    [scenes, editSceneId]
  );

  const showVideoSection =
    wizardLocked ||
    isGeneratingVideo ||
    hasSingleVideo ||
    pendingSingleVideo;
  const anyVideoGenerating =
    isAnyVideoGenerating() || pendingSingleVideo;

  useEffect(() => {
    if (!wizardLocked || !conversationId) return;
    void refreshStoryboardVideos();
  }, [conversationId, wizardLocked, refreshStoryboardVideos]);

  useEffect(() => {
    if (!conversationId || !pendingSingleVideo) {
      return;
    }
    void checkPendingStoryboardVideo();
    const id = setInterval(() => {
      void checkPendingStoryboardVideo();
    }, 20_000);
    return () => clearInterval(id);
  }, [conversationId, pendingSingleVideo, checkPendingStoryboardVideo]);

  useEffect(() => {
    if (isGeneratingVideo && videoSectionRef.current) {
      videoSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isGeneratingVideo]);

  const handleRestoreStoryboard = async () => {
    if (!conversationId) return;
    setIsRestoring(true);
    try {
      await loadStoryboardConversation(conversationId);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {wizardLocked && !scenes.length && conversationId ? (
        <div className="rounded-lg border border-accent-violet/30 bg-accent-violet/5 px-4 py-4 text-sm">
          <p className="font-medium text-foreground">
            This storyboard looks empty after a save error.
          </p>
          <p className="mt-1 text-foreground-muted">
            Your script and generated files may still be in storage. Try restoring
            before starting over.
          </p>
          <Button
            className="mt-3"
            variant="tintViolet"
            size="sm"
            disabled={isRestoring || isCommitting}
            onClick={() => void handleRestoreStoryboard()}
          >
            {isRestoring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Restore storyboard
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Storyboard Viewer
          </h1>
          <p className="text-sm text-foreground-muted">
            {scenes.length} frames · {totalDuration}s total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {VIEW_MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                viewMode === id
                  ? "bg-accent-orange/15 text-accent-orange ring-1 ring-inset ring-accent-orange/30"
                  : "bg-surface-elevated text-foreground-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {anyFrameGenerating && (
        <div className="rounded-lg border border-border bg-surface-elevated px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-foreground-muted">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isGeneratingFrames ? "Generating frames…" : "Regenerating frame…"}
            </span>
            <span>{generationProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent-orange transition-all"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {viewMode === "grid" && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {scenes.map((scene) => (
              <StoryboardFrameCard
                key={scene.id}
                scene={scene}
                selected={selectedIds.has(scene.id)}
                onSelect={() => toggleSelect(scene.id)}
                detailsOpen={expandedDetailsId === scene.id}
                onToggleDetails={() =>
                  setExpandedDetailsId((id) =>
                    id === scene.id ? null : scene.id
                  )
                }
                onEditScene={() => setEditSceneId(scene.id)}
                onPreview={() => setPreviewSceneId(scene.id)}
                onRegenerate={() => handleRegenerateOne(scene.id)}
                isRegenerating={scene.frameStatus === "generating"}
                actionsDisabled={anyFrameGenerating}
              />
            ))}
          </div>
        )}

        {viewMode === "filmstrip" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {scenes.map((scene) => (
              <div key={scene.id} className="w-72 shrink-0">
                <StoryboardFrameCard
                  scene={scene}
                  selected={selectedIds.has(scene.id)}
                  onSelect={() => toggleSelect(scene.id)}
                  detailsOpen={expandedDetailsId === scene.id}
                  onToggleDetails={() =>
                    setExpandedDetailsId((id) =>
                      id === scene.id ? null : scene.id
                    )
                  }
                  onEditScene={() => setEditSceneId(scene.id)}
                  onPreview={() => setPreviewSceneId(scene.id)}
                  onRegenerate={() => handleRegenerateOne(scene.id)}
                  isRegenerating={scene.frameStatus === "generating"}
                  actionsDisabled={anyFrameGenerating}
                />
              </div>
            ))}
          </div>
        )}

        {viewMode === "presentation" && presentationScene && (
          <div className="mx-auto max-w-4xl">
            <StoryboardFrameCard
              scene={presentationScene}
              selected={false}
              onSelect={() => {}}
              detailsOpen={expandedDetailsId === presentationScene.id}
              onToggleDetails={() =>
                setExpandedDetailsId((id) =>
                  id === presentationScene.id ? null : presentationScene.id
                )
              }
              onEditScene={() => setEditSceneId(presentationScene.id)}
              onPreview={() => setPreviewSceneId(presentationScene.id)}
              onRegenerate={() => handleRegenerateOne(presentationScene.id)}
              isRegenerating={presentationScene.frameStatus === "generating"}
              actionsDisabled={anyFrameGenerating}
            />
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={presentationIndex <= 0}
                onClick={() => setPresentationIndex((i) => i - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm tabular-nums text-foreground-muted">
                {presentationIndex + 1} / {scenes.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={presentationIndex >= scenes.length - 1}
                onClick={() => setPresentationIndex((i) => i + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {viewMode === "timeline" && (
          <div className="space-y-3">
            <div className="flex h-12 items-end gap-1 rounded-lg border border-border bg-surface-elevated p-3">
              {scenes.map((scene) => {
                const widthPct = (scene.durationSec / totalDuration) * 100;
                return (
                  <div
                    key={scene.id}
                    className="group relative min-w-[40px] rounded-md bg-accent-orange/30 transition-colors hover:bg-accent-orange/50"
                    style={{ width: `${widthPct}%` }}
                    title={`Scene ${scene.sceneNumber} · ${scene.durationSec}s`}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] text-foreground-muted opacity-0 transition-opacity group-hover:opacity-100">
                      {scene.durationSec}s
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scenes.map((scene) => (
                <StoryboardFrameCard
                  key={scene.id}
                  scene={scene}
                  selected={selectedIds.has(scene.id)}
                  onSelect={() => toggleSelect(scene.id)}
                  detailsOpen={expandedDetailsId === scene.id}
                  onToggleDetails={() =>
                    setExpandedDetailsId((id) =>
                      id === scene.id ? null : scene.id
                    )
                  }
                  onEditScene={() => setEditSceneId(scene.id)}
                  onPreview={() => setPreviewSceneId(scene.id)}
                  onRegenerate={() => handleRegenerateOne(scene.id)}
                  isRegenerating={scene.frameStatus === "generating"}
                  actionsDisabled={anyFrameGenerating}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
          <p className="text-xs font-medium text-foreground-muted">
            Frame images
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="tintViolet"
              size="sm"
              onClick={handleRegenerateSelected}
              disabled={anyFrameGenerating || anyVideoGenerating || !scenes.length}
            >
              {anyFrameGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {selectedIds.size
                ? `Regenerate frames (${selectedIds.size})`
                : "Regenerate all frames"}
            </Button>
            <Button
              variant="tintViolet"
              size="sm"
              onClick={() => openImageModelDialog("missing")}
              disabled={anyFrameGenerating || anyVideoGenerating || !scenes.length}
            >
              <LayoutGrid className="h-4 w-4" />
              Generate missing frames
            </Button>
          </div>
        </div>

        {showVideoSection && (
          <div
            ref={videoSectionRef}
            className="mt-8 border-t border-border pt-8"
          >
            <StoryboardVideoPlayer
              title="Storyboard video"
              subtitle={
                isGeneratingVideo || pendingSingleVideo
                  ? pendingSingleVideo && !isGeneratingVideo
                    ? "Generation started — checking history for your video"
                    : videoGenerationStatus ??
                      (usesVideoBatching
                        ? `Generating ${videoSegmentCount} linked clips, crossfading, then one narrator voice`
                        : "One AI video from all frames and script")
                  : usesVideoBatching
                    ? `${scenes.length} frames · ${videoSegmentCount} clips${videoSubtitleModelLabel ? ` · ${videoSubtitleModelLabel}` : ""}`
                    : `${scenes.length} frames${videoSubtitleModelLabel ? ` · ${videoSubtitleModelLabel}` : ""}`
              }
              videoUrl={storyboardVideoUrl}
              aspectRatio={
                videoAspectRatio || settings.imageAspectRatio || "16:9"
              }
              durationSec={storyboardVideoDurationSec ?? undefined}
              storyboardDurationSec={totalDuration}
              sceneCount={scenes.length}
              isGenerating={isGeneratingVideo || pendingSingleVideo}
              videoProgress={
                isGeneratingVideo || pendingSingleVideo ? videoProgress : 0
              }
              progressLabel={
                pendingSingleVideo && !isGeneratingVideo
                  ? "Video may still be generating — do not click Generate again"
                  : isGeneratingVideo
                    ? (videoGenerationStatus ?? undefined)
                    : undefined
              }
              placeholderText={
                pendingSingleVideo && !isGeneratingVideo
                  ? "Still checking for your video… use Check for video below"
                  : undefined
              }
              downloadFilename="storyboard-video.mp4"
              onGenerate={
                !hasSingleVideo && !pendingSingleVideo
                  ? () => openVideoModelDialog(false)
                  : undefined
              }
              onRegenerate={
                hasSingleVideo && !pendingSingleVideo && !isGeneratingVideo
                  ? () => openVideoModelDialog(true)
                  : undefined
              }
              generateDisabled={
                !allFramesReady ||
                anyFrameGenerating ||
                anyVideoGenerating ||
                pendingSingleVideo
              }
              regenerateDisabled={
                !allFramesReady || anyFrameGenerating || anyVideoGenerating
              }
              generateLabel={
                pendingSingleVideo ? "Video in progress…" : "Generate video"
              }
            />
          </div>
        )}

        {wizardLocked && scenes.length > 0 ? <StoryboardSceneVideos /> : null}

      </div>

      {error && (
        <p className="shrink-0 rounded-md border border-accent-orange/30 bg-accent-orange/5 px-4 py-3 text-center text-sm text-accent-orange">
          {error}
        </p>
      )}

      {isCommitting && (
        <p className="shrink-0 text-center text-sm text-foreground-muted">
          Saving storyboard to history…
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {pendingSingleVideo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void checkPendingStoryboardVideo()}
            >
              Check for video
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="tintCyan"
            size="sm"
            onClick={() => void handleExportPdf()}
            disabled={isExportingPdf || !scenes.length}
            title="PDF with script and scene cards including frame images"
          >
            {isExportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </Button>
          <Button variant="tintViolet" size="sm" onClick={resetStoryboard}>
            New storyboard
          </Button>
          {exportPdfError && (
            <span className="w-full text-xs text-accent-orange">
              {exportPdfError}
            </span>
          )}
        </div>
      </div>

      {!wizardLocked ? (
        <div className="flex gap-3">
          <Button variant="outline" onClick={prevStep}>
            Back to scenes
          </Button>
        </div>
      ) : null}

      <StoryboardImageModelDialog
        open={imageModelDialogOpen}
        mode={imageDialogMode}
        imageModel={imagePrimaryModel}
        imageAspectRatio={imageAspectRatio}
        frameCount={imageDialogFrameCount}
        onConfirm={handleImageModelConfirm}
        onCancel={() => setImageModelDialogOpen(false)}
      />

      <StoryboardVideoModelDialog
        open={videoModelDialogOpen}
        mode={videoReplaceOnConfirm ? "regenerate" : "generate"}
        primaryModel={videoPrimaryModel}
        fallbackModel={videoFallbackModel}
        videoAspectRatio={videoAspectRatio}
        frameAspectRatio={imageAspectRatio}
        settingsFrameAspectRatio={settings.imageAspectRatio}
        scenes={scenes}
        onConfirm={handleVideoModelConfirm}
        onCancel={() => setVideoModelDialogOpen(false)}
      />

      <StoryboardFramePreviewDialog
        scenes={scenes}
        scene={previewScene}
        sceneIndex={previewSceneIndex}
        open={previewSceneId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewSceneId(null);
        }}
        onNavigate={(sceneId) => setPreviewSceneId(sceneId)}
      />

      <StoryboardSceneEditDialog
        scene={editScene}
        open={editSceneId !== null}
        onOpenChange={(open) => {
          if (!open) setEditSceneId(null);
        }}
        onUpdate={(patch) => {
          if (editSceneId) updateScene(editSceneId, patch);
        }}
        onRegenerate={() => {
          if (editSceneId) handleRegenerateOne(editSceneId);
        }}
        isRegenerating={editScene?.frameStatus === "generating"}
        actionsDisabled={anyFrameGenerating}
      />
    </div>
  );
}

function FrameDetailRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(7rem,38%)_1fr] gap-x-3 gap-y-0.5 py-2.5 text-xs",
        !isLast && "border-b border-border/50"
      )}
    >
      <span className="font-medium text-foreground-muted">{label}</span>
      <span
        className={cn(
          "leading-relaxed",
          value?.trim() ? "text-foreground" : "italic text-foreground-muted/60"
        )}
      >
        {value?.trim() || "—"}
      </span>
    </div>
  );
}

const frameImageActionClass =
  "flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60";

function StoryboardFramePreviewDialog({
  scenes,
  scene,
  sceneIndex,
  open,
  onOpenChange,
  onNavigate,
}: {
  scenes: StoryboardScene[];
  scene: StoryboardScene | null;
  sceneIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (sceneId: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const previewableSceneIds = useMemo(
    () => scenes.filter((s) => s.frameImageUrl).map((s) => s.id),
    [scenes]
  );
  const previewSlot = scene ? previewableSceneIds.indexOf(scene.id) : -1;
  const canGoPrevious = previewSlot > 0;
  const canGoNext =
    previewSlot >= 0 && previewSlot < previewableSceneIds.length - 1;

  const goPrevious = () => {
    const prevId = previewableSceneIds[previewSlot - 1];
    if (prevId) onNavigate(prevId);
  };

  const goNext = () => {
    const nextId = previewableSceneIds[previewSlot + 1];
    if (nextId) onNavigate(nextId);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && previewSlot > 0) {
        e.preventDefault();
        const prevId = previewableSceneIds[previewSlot - 1];
        if (prevId) onNavigate(prevId);
      }
      if (
        e.key === "ArrowRight" &&
        previewSlot >= 0 &&
        previewSlot < previewableSceneIds.length - 1
      ) {
        e.preventDefault();
        const nextId = previewableSceneIds[previewSlot + 1];
        if (nextId) onNavigate(nextId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, previewSlot, previewableSceneIds, onNavigate]);

  const handleDownload = async () => {
    if (!scene?.frameImageUrl) return;
    setDownloading(true);
    try {
      await downloadImage(
        scene.frameImageUrl,
        `storyboard-scene-${String(scene.sceneNumber).padStart(2, "0")}`
      );
    } catch (err) {
      console.error("Frame download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (!scene) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80dvh] w-[80vw] max-w-[80vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 pb-3 pt-5">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle>
              Scene {String(scene.sceneNumber).padStart(2, "0")} preview
            </DialogTitle>
            <span className="text-xs tabular-nums text-foreground-muted">
              {previewSlot >= 0 ? previewSlot + 1 : sceneIndex + 1} /{" "}
              {previewableSceneIds.length || scenes.length}
            </span>
          </div>
          <DialogDescription className="sr-only">
            Full-size storyboard frame preview. Use arrow keys or on-screen
            buttons to move between scenes.
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 bg-black/90">
          <button
            type="button"
            onClick={goPrevious}
            disabled={!canGoPrevious}
            className={cn(
              "absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30",
              canGoPrevious && "cursor-pointer"
            )}
            aria-label="Previous scene"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className={cn(
              "absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30",
              canGoNext && "cursor-pointer"
            )}
            aria-label="Next scene"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-0 flex items-center justify-center px-12 py-3">
            {scene.frameImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scene.frameImageUrl}
                alt={`Scene ${scene.sceneNumber} storyboard frame`}
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="text-sm text-foreground-muted">No frame image yet</p>
            )}
          </div>
          {scene.frameImageUrl && (
            <div className="absolute bottom-3 right-3 z-10">
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                className={frameImageActionClass}
                style={{ cursor: "pointer" }}
                title="Download frame"
                aria-label="Download frame"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StoryboardFrameCard({
  scene,
  selected,
  onSelect,
  detailsOpen,
  onToggleDetails,
  onEditScene,
  onPreview,
  onRegenerate,
  isRegenerating,
  actionsDisabled,
}: {
  scene: StoryboardScene;
  selected: boolean;
  onSelect: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onEditScene: () => void;
  onPreview: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  actionsDisabled: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const camera = normalizeSceneFields(scene);
  const transitionLabel =
    SCENE_TRANSITIONS.find((t) => t.id === scene.transition)?.label ??
    scene.transition;
  const hasFrame = Boolean(scene.frameImageUrl);

  const handleDownload = async () => {
    if (!scene.frameImageUrl) return;
    setDownloading(true);
    try {
      await downloadImage(
        scene.frameImageUrl,
        `storyboard-scene-${String(scene.sceneNumber).padStart(2, "0")}`
      );
    } catch (err) {
      console.error("Frame download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-surface-elevated transition-colors",
        selected
          ? "border-accent-orange/40 ring-1 ring-inset ring-accent-orange/25"
          : "border-border"
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-background">
        {scene.frameImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.frameImageUrl}
            alt={`Scene ${scene.sceneNumber}`}
            className={cn(
              "absolute inset-0 block h-full w-full object-contain object-center transition-opacity",
              isRegenerating && "opacity-35"
            )}
          />
        ) : !isRegenerating ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-foreground-muted">
            <LayoutGrid className="h-8 w-8 opacity-40" />
            <span className="text-xs">
              {scene.frameStatus === "error"
                ? scene.frameError ?? "Generation failed"
                : "No frame yet"}
            </span>
          </div>
        ) : null}
        {isRegenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/50 backdrop-blur-[2px]">
            <Loader2 className="h-8 w-8 animate-spin text-accent-orange" />
            <span className="text-xs font-medium text-foreground-muted">
              Regenerating…
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onSelect}
          disabled={actionsDisabled}
          className={cn(
            "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-[10px]",
            selected
              ? "border-accent-orange bg-accent-orange text-white"
              : "border-border bg-background/80",
            actionsDisabled && "cursor-not-allowed opacity-50"
          )}
        >
          {selected ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRegenerate();
          }}
          disabled={isRegenerating || actionsDisabled}
          className={cn(
            "absolute right-2 top-2 rounded-md bg-background/80 p-1.5 backdrop-blur transition-colors",
            isRegenerating || actionsDisabled
              ? "cursor-not-allowed text-foreground-muted/40"
              : "text-foreground-muted hover:bg-background hover:text-foreground"
          )}
          aria-label="Regenerate frame"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")}
          />
        </button>
        {hasFrame && (
          <div className="absolute bottom-2 right-2 z-10 flex gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className={frameImageActionClass}
              style={{ cursor: "pointer" }}
              title="Preview frame"
              aria-label="Preview frame"
            >
              <Expand className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleDownload();
              }}
              disabled={downloading}
              className={frameImageActionClass}
              style={{ cursor: "pointer" }}
              title="Download frame"
              aria-label="Download frame"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border/60 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-accent-orange">
            Scene {String(scene.sceneNumber).padStart(2, "0")}
          </span>
          <span className="text-foreground-muted">{scene.durationSec}s</span>
          <span className="text-foreground-muted">{camera.cameraDirection}</span>
          <span className="text-foreground-muted">{transitionLabel}</span>
        </div>
        {scene.voiceover && (
          <p className="text-xs leading-relaxed text-foreground-muted">
            <span className="font-medium text-foreground">VO: </span>
            {scene.voiceover}
          </p>
        )}
        {scene.visualDescription && (
          <p className="text-xs leading-relaxed text-foreground-muted">
            <span className="font-medium text-foreground">Visual: </span>
            {scene.visualDescription}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            onClick={onEditScene}
            className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2.5 py-1.5 text-[11px] font-medium text-foreground-muted transition-colors hover:text-foreground"
          >
            Edit scene
          </button>
          <button
            type="button"
            onClick={onToggleDetails}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              detailsOpen
                ? "bg-accent-orange/10 text-accent-orange"
                : "bg-surface-hover text-foreground-muted hover:text-foreground"
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Frame details
            {detailsOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>

        {detailsOpen && (
          <div className="overflow-hidden rounded-md border border-border/70 bg-background/40 px-3">
            <FrameDetailRow label="Shot type" value={camera.cameraDirection} />
            <FrameDetailRow label="Camera angle" value={camera.cameraAngle} />
            <FrameDetailRow
              label="Camera movement"
              value={camera.cameraMovement}
            />
            <FrameDetailRow label="Dialogue / VO" value={scene.voiceover} />
            <FrameDetailRow
              label="Character actions"
              value={scene.characterActions}
            />
            <FrameDetailRow
              label="Visual description"
              value={scene.visualDescription}
              isLast
            />
          </div>
        )}

      </div>
    </article>
  );
}
