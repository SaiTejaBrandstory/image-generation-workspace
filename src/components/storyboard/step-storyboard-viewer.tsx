"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  Film,
  Grid3X3,
  LayoutGrid,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Sparkles,
  Timer,
  Video,
  Layers,
} from "lucide-react";
import { StoryboardVideoPlayer } from "@/components/storyboard/storyboard-video-player";
import { Button } from "@/components/ui/button";
import { exportStoryboardPdf } from "@/lib/storyboard/export";
import { SCENE_TRANSITIONS } from "@/lib/storyboard/constants";
import { isPendingVideoForConversation } from "@/lib/storyboard/pending-video";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
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
    storyboardVideoUrl,
    storyboardVideoDurationSec,
    isGeneratingStitchedVideo,
    stitchedVideoProgress,
    stitchedVideoStatus,
    storyboardStitchedVideoUrl,
    storyboardStitchedVideoDurationSec,
    generateStoryboardVideo,
    generateStoryboardStitchedVideo,
    isAnyVideoGenerating,
    resetStoryboard,
    refreshStoryboardVideos,
    checkPendingStoryboardVideo,
    conversationId,
    singleVideoStoragePath,
    stitchedVideoStoragePath,
  } = useStoryboardStore();

  const pendingSingleVideo =
    isPendingVideoForConversation(conversationId, "single") &&
    !storyboardVideoUrl;
  const pendingStitchedVideo =
    isPendingVideoForConversation(conversationId, "stitched") &&
    !storyboardStitchedVideoUrl;
  const hasSingleVideo = Boolean(
    storyboardVideoUrl || singleVideoStoragePath
  );
  const hasStitchedVideo = Boolean(
    storyboardStitchedVideoUrl || stitchedVideoStoragePath
  );

  const [presentationIndex, setPresentationIndex] = useState(0);
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const stitchedVideoSectionRef = useRef<HTMLDivElement>(null);

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

  const handleRegenerateSelected = () => {
    if (anyFrameGenerating) return;
    const ids = selectedIds.size ? [...selectedIds] : undefined;
    void regenerateFrames(ids);
  };

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

  const showVideoSection =
    wizardLocked || isGeneratingVideo || Boolean(storyboardVideoUrl);
  const showStitchedVideoSection =
    wizardLocked ||
    isGeneratingStitchedVideo ||
    Boolean(storyboardStitchedVideoUrl);
  const anyVideoGenerating =
    isAnyVideoGenerating() || pendingSingleVideo || pendingStitchedVideo;

  useEffect(() => {
    if (!wizardLocked || !conversationId) return;
    void refreshStoryboardVideos();
  }, [conversationId, wizardLocked, refreshStoryboardVideos]);

  useEffect(() => {
    if (!conversationId || (!pendingSingleVideo && !pendingStitchedVideo)) {
      return;
    }
    void checkPendingStoryboardVideo();
    const id = setInterval(() => {
      void checkPendingStoryboardVideo();
    }, 20_000);
    return () => clearInterval(id);
  }, [
    conversationId,
    pendingSingleVideo,
    pendingStitchedVideo,
    checkPendingStoryboardVideo,
  ]);

  useEffect(() => {
    if (isGeneratingVideo && videoSectionRef.current) {
      videoSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isGeneratingVideo]);

  useEffect(() => {
    if (isGeneratingStitchedVideo && stitchedVideoSectionRef.current) {
      stitchedVideoSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [isGeneratingStitchedVideo]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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
                expandedPrompt={expandedPromptId === scene.id}
                onTogglePrompt={() =>
                  setExpandedPromptId((id) =>
                    id === scene.id ? null : scene.id
                  )
                }
                onPromptChange={(prompt) =>
                  updateScene(scene.id, { imagePrompt: prompt })
                }
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
                  expandedPrompt={expandedPromptId === scene.id}
                  onTogglePrompt={() =>
                    setExpandedPromptId((id) =>
                      id === scene.id ? null : scene.id
                    )
                  }
                  onPromptChange={(prompt) =>
                    updateScene(scene.id, { imagePrompt: prompt })
                  }
                  onRegenerate={() => handleRegenerateOne(scene.id)}
                  isRegenerating={scene.frameStatus === "generating"}
                  actionsDisabled={anyFrameGenerating}
                  compact
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
              expandedPrompt={expandedPromptId === presentationScene.id}
              onTogglePrompt={() =>
                setExpandedPromptId((id) =>
                  id === presentationScene.id ? null : presentationScene.id
                )
              }
              onPromptChange={(prompt) =>
                updateScene(presentationScene.id, { imagePrompt: prompt })
              }
              onRegenerate={() => handleRegenerateOne(presentationScene.id)}
              isRegenerating={presentationScene.frameStatus === "generating"}
              actionsDisabled={anyFrameGenerating}
              large
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
                  expandedPrompt={expandedPromptId === scene.id}
                  onTogglePrompt={() =>
                    setExpandedPromptId((id) =>
                      id === scene.id ? null : scene.id
                    )
                  }
                  onPromptChange={(prompt) =>
                    updateScene(scene.id, { imagePrompt: prompt })
                  }
                  onRegenerate={() => handleRegenerateOne(scene.id)}
                  isRegenerating={scene.frameStatus === "generating"}
                  actionsDisabled={anyFrameGenerating}
                  compact
                />
              ))}
            </div>
          </div>
        )}

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
                    : "One AI video from all frames and script"
                  : `${scenes.length} frames · single AI generation`
              }
              videoUrl={storyboardVideoUrl}
              durationSec={storyboardVideoDurationSec ?? undefined}
              sceneCount={scenes.length}
              isGenerating={isGeneratingVideo || pendingSingleVideo}
              videoProgress={
                isGeneratingVideo || pendingSingleVideo ? videoProgress : 0
              }
              progressLabel={
                pendingSingleVideo && !isGeneratingVideo
                  ? "Video may still be generating — do not click Generate again"
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
                  ? () => void generateStoryboardVideo()
                  : undefined
              }
              generateDisabled={
                !allFramesReady || anyFrameGenerating || anyVideoGenerating
              }
              generateLabel="Generate video"
            />
          </div>
        )}

        {showStitchedVideoSection && (
          <div
            ref={stitchedVideoSectionRef}
            className="mt-8 border-t border-border pt-8 pb-6"
          >
            <StoryboardVideoPlayer
              title="Stitched storyboard video"
              subtitle={
                isGeneratingStitchedVideo || pendingStitchedVideo
                  ? pendingStitchedVideo && !isGeneratingStitchedVideo
                    ? "Generation started — checking history for stitched video"
                    : (stitchedVideoStatus ??
                      "One clip per frame, then stitched together")
                  : `${scenes.length} clips stitched · full timeline`
              }
              progressLabel={
                pendingStitchedVideo && !isGeneratingStitchedVideo
                  ? "Stitched video may still be generating — do not start again"
                  : (stitchedVideoStatus ??
                    "Generating clips and stitching — this can take many minutes")
              }
              placeholderText={
                pendingStitchedVideo && !isGeneratingStitchedVideo
                  ? "Still checking for your stitched video…"
                  : "Stitched video will appear here when all clips are ready"
              }
              videoUrl={storyboardStitchedVideoUrl}
              durationSec={storyboardStitchedVideoDurationSec ?? undefined}
              sceneCount={scenes.length}
              isGenerating={
                isGeneratingStitchedVideo || pendingStitchedVideo
              }
              videoProgress={
                isGeneratingStitchedVideo || pendingStitchedVideo
                  ? stitchedVideoProgress
                  : 0
              }
              downloadFilename="storyboard-stitched.mp4"
            />
          </div>
        )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateSelected}
            disabled={anyFrameGenerating || anyVideoGenerating || !scenes.length}
          >
            {anyFrameGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate {selectedIds.size ? `(${selectedIds.size})` : "all"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void generateAllFrames(true)}
            disabled={anyFrameGenerating || anyVideoGenerating || !scenes.length}
          >
            <LayoutGrid className="h-4 w-4" />
            Generate missing
          </Button>
          {!hasSingleVideo ? (
            <Button
              size="sm"
              onClick={() => void generateStoryboardVideo()}
              disabled={
                !allFramesReady ||
                anyFrameGenerating ||
                anyVideoGenerating ||
                pendingSingleVideo
              }
              title={
                pendingSingleVideo
                  ? "A generation may still be running — use Check for video"
                  : allFramesReady
                    ? "One AI video from all frames and script (faster)"
                    : "Generate all frame images first"
              }
            >
              {isGeneratingVideo || pendingSingleVideo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              {pendingSingleVideo ? "Video in progress…" : "Generate video"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generateStoryboardVideo({ replace: true })}
              disabled={
                !allFramesReady || anyFrameGenerating || anyVideoGenerating
              }
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate video
            </Button>
          )}
          {!hasStitchedVideo ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generateStoryboardStitchedVideo()}
              disabled={
                !allFramesReady ||
                anyFrameGenerating ||
                anyVideoGenerating ||
                pendingStitchedVideo
              }
              title={
                pendingStitchedVideo
                  ? "Stitched generation may still be running"
                  : allFramesReady
                    ? "One clip per frame, stitched into full-length video"
                    : "Generate all frame images first"
              }
            >
              {isGeneratingStitchedVideo || pendingStitchedVideo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}
              {pendingStitchedVideo
                ? "Stitch in progress…"
                : "Generate stitched video"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void generateStoryboardStitchedVideo({ replace: true })
              }
              disabled={
                !allFramesReady || anyFrameGenerating || anyVideoGenerating
              }
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate stitched
            </Button>
          )}
          {(pendingSingleVideo || pendingStitchedVideo) && (
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
            variant="outline"
            size="sm"
            onClick={() => void handleExportPdf()}
            disabled={isExportingPdf || !scenes.length}
            title="PDF with script and scene table including frame images"
          >
            {isExportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </Button>
          {exportPdfError && (
            <span className="text-xs text-accent-orange">{exportPdfError}</span>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-3">
        {!wizardLocked ? (
          <Button variant="outline" onClick={prevStep}>
            Back to scenes
          </Button>
        ) : (
          <span />
        )}
        <Button variant="outline" onClick={resetStoryboard}>
          New storyboard
        </Button>
      </div>
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

function StoryboardFrameCard({
  scene,
  selected,
  onSelect,
  detailsOpen,
  onToggleDetails,
  expandedPrompt,
  onTogglePrompt,
  onPromptChange,
  onRegenerate,
  isRegenerating,
  actionsDisabled,
  compact,
  large,
}: {
  scene: StoryboardScene;
  selected: boolean;
  onSelect: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  expandedPrompt: boolean;
  onTogglePrompt: () => void;
  onPromptChange: (prompt: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  actionsDisabled: boolean;
  compact?: boolean;
  large?: boolean;
}) {
  const camera = normalizeSceneFields(scene);
  const actionNotes = [scene.characterActions, scene.visualDescription]
    .filter(Boolean)
    .join(" · ");
  const transitionLabel =
    SCENE_TRANSITIONS.find((t) => t.id === scene.transition)?.label ??
    scene.transition;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-surface-elevated transition-colors",
        selected
          ? "border-accent-orange/40 ring-1 ring-inset ring-accent-orange/25"
          : "border-border"
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-background",
          large ? "aspect-video" : compact ? "aspect-[4/3]" : "aspect-video"
        )}
      >
        {scene.frameImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.frameImageUrl}
            alt={`Scene ${scene.sceneNumber}`}
            className={cn(
              "absolute inset-0 block h-full w-full object-cover object-center transition-opacity",
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
            onClick={onTogglePrompt}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              expandedPrompt
                ? "bg-accent-orange/10 text-accent-orange"
                : "bg-surface-hover text-foreground-muted hover:text-foreground"
            )}
          >
            {expandedPrompt ? "Hide AI prompt" : "Edit AI prompt"}
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
              label="Action / Notes"
              value={actionNotes}
              isLast
            />
          </div>
        )}

        {expandedPrompt && (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={scene.imagePrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="Describe the sketch frame for the AI…"
              className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-accent-orange/40"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-foreground-muted">
                Edit prompt, then regenerate to apply
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                disabled={
                  isRegenerating ||
                  actionsDisabled ||
                  !scene.imagePrompt.trim()
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  isRegenerating || actionsDisabled || !scene.imagePrompt.trim()
                    ? "cursor-not-allowed bg-surface-hover text-foreground-muted/50"
                    : "bg-accent-orange text-white hover:bg-accent-orange/90"
                )}
              >
                {isRegenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Regenerate frame
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
