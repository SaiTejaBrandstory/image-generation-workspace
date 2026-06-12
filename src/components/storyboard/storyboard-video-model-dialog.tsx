"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { Check, Clock, Film, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  inferAspectRatioFromImageUrl,
  resolveStoryboardFrameAspectRatio,
} from "@/lib/storyboard/storyboard-image";
import {
  clampStoryboardVideoAspectRatio,
  estimateStoryboardSceneClipsCost,
  estimateStoryboardSceneClipsDuration,
  estimateStoryboardVideoJobCost,
  estimateStoryboardVideoOutputDuration,
  chunkStoryboardScenesForVideo,
  storyboardVideoAspectRatiosForModel,
} from "@/lib/storyboard/storyboard-video";
import { DEFAULT_VIDEO_ASPECT } from "@/lib/openrouter-video-models";
import type { AspectRatio } from "@/types";
import { formatStoryboardJobCost } from "@/lib/video-model-pricing";
import {
  getVideoModelConfig,
  getVideoModelMaxDurationSec,
  getVideoModelsCatalog,
  isValidVideoModel,
  OPENROUTER_VIDEO_MODELS,
  pickStoryboardHumanFrameFallback,
  setVideoModelsCatalog,
  sortVideoModelsByCost,
  storyboardCapableVideoModels,
  storyboardHumanFrameFallbackModels,
  type VideoModelConfig,
} from "@/lib/openrouter-video-models";
import { cn } from "@/lib/utils";
import type { StoryboardScene } from "@/types/storyboard";

export type StoryboardVideoModelDialogMode = "generate" | "regenerate";
export type StoryboardVideoModelDialogVariant = "full" | "scene";

interface StoryboardVideoModelDialogProps {
  open: boolean;
  mode: StoryboardVideoModelDialogMode;
  variant?: StoryboardVideoModelDialogVariant;
  primaryModel: string;
  fallbackModel: string | null;
  videoAspectRatio: string;
  frameAspectRatio: AspectRatio;
  /** Persisted from DB — may be missing on older storyboards. */
  settingsFrameAspectRatio?: AspectRatio;
  scenes: StoryboardScene[];
  /** Whether to include voiceover narration in the video (default true). */
  enableVoiceover?: boolean;
  onConfirm: (
    primary: string,
    fallback: string,
    aspectRatio: string,
    enableVoiceover: boolean
  ) => void;
  onCancel: () => void;
}

function MetaChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
  );
}

const MODEL_META_COL_MAX = "min-w-[3.25rem]";
const MODEL_META_COL_RATE = "min-w-[3.75rem]";

function ModelListHeader() {
  return (
    <div className="flex items-center gap-3 px-3 pb-1 text-[10px] font-medium text-foreground-muted">
      <span className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1" />
      <span className="flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            MODEL_META_COL_MAX,
            "text-center tabular-nums tracking-tight"
          )}
        >
          Max
        </span>
        <span
          className={cn(
            MODEL_META_COL_RATE,
            "text-center tabular-nums tracking-tight"
          )}
        >
          $/s
        </span>
      </span>
    </div>
  );
}

function ModelRow({
  model,
  selected,
  onSelect,
  rowRef,
}: {
  model: VideoModelConfig;
  selected: boolean;
  onSelect: () => void;
  rowRef?: Ref<HTMLButtonElement>;
}) {
  const maxSec = getVideoModelMaxDurationSec(model.id);

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
        "ring-1 ring-inset",
        selected
          ? "bg-accent-cyan/8 ring-accent-cyan/40 shadow-sm"
          : "bg-surface-elevated ring-foreground/8 hover:bg-surface-hover hover:ring-foreground/12"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-accent-cyan bg-accent-cyan text-white"
            : "border-border/80 bg-surface"
        )}
      >
        {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {model.label}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {maxSec != null ? (
          <MetaChip
            className={cn(
              MODEL_META_COL_MAX,
              "justify-center bg-surface text-foreground-muted ring-border/60"
            )}
          >
            <Clock className="h-2.5 w-2.5 opacity-70" />
            {maxSec}s
          </MetaChip>
        ) : (
          <span className={MODEL_META_COL_MAX} aria-hidden />
        )}
        <MetaChip
          className={cn(
            MODEL_META_COL_RATE,
            "justify-center bg-surface text-foreground-muted ring-border/60"
          )}
        >
          {model.costLabel}
        </MetaChip>
      </span>
    </button>
  );
}

function ModelSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="px-0.5">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {hint ? (
          <p className="mt-0.5 text-[11px] leading-snug text-foreground-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <ModelListHeader />
        <div className="space-y-1.5">{children}</div>
      </div>
    </section>
  );
}

export function StoryboardVideoModelDialog({
  open,
  mode,
  variant = "full",
  primaryModel,
  fallbackModel,
  videoAspectRatio,
  frameAspectRatio,
  settingsFrameAspectRatio,
  scenes,
  enableVoiceover: enableVoiceoverProp = true,
  onConfirm,
  onCancel,
}: StoryboardVideoModelDialogProps) {
  const isRegenerate = mode === "regenerate";
  const isSceneClips = variant === "scene";
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<VideoModelConfig[]>([]);
  const [primary, setPrimary] = useState(primaryModel);
  const [fallback, setFallback] = useState(fallbackModel);
  const [aspectRatio, setAspectRatio] = useState(videoAspectRatio);
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(enableVoiceoverProp);
  const [inferredFrameAspect, setInferredFrameAspect] =
    useState<AspectRatio | null>(null);
  const primarySelectedRef = useRef<HTMLButtonElement>(null);
  const fallbackSelectedRef = useRef<HTMLButtonElement>(null);
  const didInitialScrollRef = useRef(false);

  const effectiveFrameAspect = useMemo(
    () =>
      resolveStoryboardFrameAspectRatio({
        inferredFromFrames: inferredFrameAspect,
        settingsAspect: settingsFrameAspectRatio,
        storeAspect: frameAspectRatio,
      }),
    [
      inferredFrameAspect,
      settingsFrameAspectRatio,
      frameAspectRatio,
    ]
  );

  useEffect(() => {
    if (!open) return;
    const frameUrl = scenes.find((s) => s.frameImageUrl?.trim())?.frameImageUrl;
    if (!frameUrl) {
      setInferredFrameAspect(null);
      return;
    }
    let cancelled = false;
    void inferAspectRatioFromImageUrl(frameUrl).then((ratio) => {
      if (!cancelled) setInferredFrameAspect(ratio);
    });
    return () => {
      cancelled = true;
    };
  }, [open, scenes]);

  useEffect(() => {
    if (!open) return;
    setPrimary(primaryModel);
    setFallback(fallbackModel);
    setVoiceoverEnabled(enableVoiceoverProp);
    const modelRatios = storyboardVideoAspectRatiosForModel(primaryModel);
    setAspectRatio(
      modelRatios.includes(videoAspectRatio)
        ? videoAspectRatio
        : modelRatios.includes(effectiveFrameAspect)
          ? effectiveFrameAspect
          : clampStoryboardVideoAspectRatio(primaryModel, videoAspectRatio)
    );
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/video/models");
        const data = (await res.json()) as { models?: VideoModelConfig[] };
        if (!cancelled && Array.isArray(data.models) && data.models.length) {
          setVideoModelsCatalog(data.models);
          setModels(storyboardCapableVideoModels(data.models));
        }
      } catch {
        /* static catalog */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    primaryModel,
    fallbackModel,
    videoAspectRatio,
    effectiveFrameAspect,
    enableVoiceoverProp,
  ]);

  const sorted = useMemo(() => {
    const source = models.length ? models : getVideoModelsCatalog();
    const capable =
      source.length > 0
        ? storyboardCapableVideoModels(source)
        : storyboardCapableVideoModels(OPENROUTER_VIDEO_MODELS);
    return sortVideoModelsByCost(capable);
  }, [models]);

  const fallbackOptions = useMemo(
    () => storyboardHumanFrameFallbackModels(sorted),
    [sorted]
  );

  const segmentCount = useMemo(
    () => chunkStoryboardScenesForVideo(scenes).length,
    [scenes]
  );

  const primaryId = isValidVideoModel(primary) ? primary : (sorted[0]?.id ?? "");

  const allAspectOptions = useMemo(
    () => storyboardVideoAspectRatiosForModel(primaryId),
    [primaryId]
  );

  const aspectOptions = allAspectOptions;

  const resolvedAspect = useMemo(() => {
    if (aspectOptions.includes(aspectRatio)) return aspectRatio;
    if (aspectOptions.includes(effectiveFrameAspect)) return effectiveFrameAspect;
    return clampStoryboardVideoAspectRatio(
      primaryId,
      aspectRatio || effectiveFrameAspect || DEFAULT_VIDEO_ASPECT
    );
  }, [aspectOptions, aspectRatio, effectiveFrameAspect, primaryId]);

  useEffect(() => {
    if (!aspectOptions.includes(aspectRatio)) {
      setAspectRatio(resolvedAspect);
    }
  }, [aspectOptions, aspectRatio, resolvedAspect]);

  const fallbackId = useMemo(
    () =>
      pickStoryboardHumanFrameFallback(primaryId, sorted, fallback) ?? "",
    [primaryId, sorted, fallback]
  );

  const storyboardDurationSec = useMemo(
    () => scenes.reduce((sum, s) => sum + s.durationSec, 0),
    [scenes]
  );

  const outputDurationSec = useMemo(
    () =>
      isSceneClips
        ? estimateStoryboardSceneClipsDuration(scenes, primaryId)
        : estimateStoryboardVideoOutputDuration(scenes, primaryId),
    [scenes, primaryId, isSceneClips]
  );

  const primaryCost = useMemo(
    () =>
      isSceneClips
        ? estimateStoryboardSceneClipsCost(scenes, primaryId)
        : estimateStoryboardVideoJobCost(scenes, primaryId),
    [scenes, primaryId, isSceneClips]
  );

  const canConfirm =
    !loading &&
    isValidVideoModel(primaryId) &&
    !!fallbackId &&
    fallbackId !== primaryId;

  const handlePrimaryChange = (id: string) => {
    setPrimary(id);
    setFallback(pickStoryboardHumanFrameFallback(id, sorted, fallback));
    const ratios = storyboardVideoAspectRatiosForModel(id);
    setAspectRatio((current) => clampStoryboardVideoAspectRatio(id, current));
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(primaryId, fallbackId, resolvedAspect, voiceoverEnabled);
  };

  const primaryOptions = sorted;
  const fallbackChoices = fallbackOptions.filter((m) => m.id !== primaryId);

  const primaryLabel = getVideoModelConfig(primaryId).label;
  const fallbackLabel = fallbackId
    ? getVideoModelConfig(fallbackId).label
    : null;

  useEffect(() => {
    if (!open) {
      didInitialScrollRef.current = false;
      return;
    }
    if (loading || didInitialScrollRef.current) return;

    const id = requestAnimationFrame(() => {
      primarySelectedRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      didInitialScrollRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [open, loading]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent className="flex max-h-[min(85dvh,calc(100dvh-2rem))] w-[min(420px,calc(100vw-2rem))] max-w-[420px] flex-col gap-0 overflow-hidden rounded-xl p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 bg-surface-elevated/40 px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Film className="h-4 w-4 text-accent-cyan" />
            {isSceneClips
              ? isRegenerate
                ? "Re-animate scenes"
                : "Animate scenes"
              : isRegenerate
                ? "Regenerate video"
                : "Generate video"}
          </DialogTitle>
          <DialogDescription className="text-xs text-foreground-muted">
            {isSceneClips
              ? `${scenes.length} scene clip${scenes.length === 1 ? "" : "s"} · model voice + music · not stitched`
              : `${scenes.length} frames${segmentCount > 1 ? ` · ${segmentCount} clips` : ""} · cheapest first`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-foreground-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading models…
            </div>
          ) : (
            <div className="space-y-4">
              <ModelSection
                title="Primary"
                hint={`Selected: ${primaryLabel} · runs first on every clip`}
              >
                <div className="max-h-[min(168px,28vh)] space-y-1.5 overflow-y-auto pr-0.5 scroll-smooth">
                  {primaryOptions.map((m) => (
                    <ModelRow
                      key={m.id}
                      model={m}
                      selected={primaryId === m.id}
                      rowRef={primaryId === m.id ? primarySelectedRef : undefined}
                      onSelect={() => handlePrimaryChange(m.id)}
                    />
                  ))}
                </div>
              </ModelSection>

              <div className="border-t border-border/50" />

              <ModelSection
                title="Human-frame fallback"
                hint={
                  fallbackLabel
                    ? `Selected: ${fallbackLabel} · Veo only if primary rejects human frames`
                    : "Veo only if the primary rejects real-person frames"
                }
              >
                <div className="max-h-[min(120px,18vh)] space-y-1.5 overflow-y-auto pr-0.5 scroll-smooth">
                  {fallbackChoices.map((m) => (
                    <ModelRow
                      key={m.id}
                      model={m}
                      selected={fallbackId === m.id}
                      rowRef={fallbackId === m.id ? fallbackSelectedRef : undefined}
                      onSelect={() => setFallback(m.id)}
                    />
                  ))}
                </div>
              </ModelSection>

              <div className="border-t border-border/50 pt-2">
                  <button
                    type="button"
                    onClick={() => setVoiceoverEnabled((v) => !v)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                      "ring-1 ring-inset",
                      voiceoverEnabled
                        ? "bg-accent-cyan/8 ring-accent-cyan/40 shadow-sm"
                        : "bg-surface-elevated ring-foreground/8 hover:bg-surface-hover hover:ring-foreground/12"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        voiceoverEnabled
                          ? "border-accent-cyan bg-accent-cyan text-white"
                          : "border-border/80 bg-surface"
                      )}
                    >
                      {voiceoverEnabled ? (
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                      {voiceoverEnabled ? (
                        <Mic className="h-3.5 w-3.5 shrink-0 text-accent-cyan" />
                      ) : (
                        <MicOff className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                      )}
                      <span className="text-sm font-medium text-foreground">
                        Voiceover narration
                      </span>
                    </span>
                    <span className="text-[10px] text-foreground-muted">
                      {voiceoverEnabled ? "on" : "off"}
                    </span>
                  </button>
                  <p className="mt-1.5 px-1 text-[11px] leading-snug text-foreground-muted">
                    {voiceoverEnabled
                      ? "Narrator reads each scene's voiceover line over soft background music."
                      : "Background music only — no spoken narration."}
                  </p>
                </div>

              <div className="space-y-2 border-t border-border/50 pt-2">
                <h3 className="px-0.5 text-xs font-semibold text-foreground">
                  Aspect ratio
                </h3>
                <p className="px-0.5 text-[11px] leading-snug text-foreground-muted">
                  Frames: {effectiveFrameAspect}
                  {resolvedAspect !== effectiveFrameAspect
                    ? ` · output ${resolvedAspect}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aspectOptions.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium tabular-nums ring-1 ring-inset transition-colors",
                        resolvedAspect === ratio
                          ? "bg-accent-cyan/10 text-foreground ring-accent-cyan/40"
                          : "bg-surface-elevated text-foreground-muted ring-foreground/10 hover:bg-surface-hover"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-0 shrink-0 flex-col items-stretch gap-2 border-t border-border/60 bg-surface-elevated/20 px-5 py-3">
          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
            <span>
              <span className="font-medium text-foreground">{resolvedAspect}</span>
              <span aria-hidden className="text-border/80">
                {" "}
                ·{" "}
              </span>
              <span className="tabular-nums">{storyboardDurationSec}s</span> script
              <span className="text-foreground-muted/50"> → </span>
              <span className="font-semibold tabular-nums text-foreground">
                ~{outputDurationSec}s
              </span>{" "}
              output
              {storyboardDurationSec > outputDurationSec ? (
                <span className="text-foreground-muted/70"> (capped)</span>
              ) : null}
            </span>
            {primaryCost != null ? (
              <>
                <span aria-hidden className="text-border/80">
                  ·
                </span>
                <span>
                  Est.{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatStoryboardJobCost(primaryCost)}
                  </span>
                </span>
                <span className="text-foreground-muted/70">
                  {getVideoModelConfig(primaryId).costLabel}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex w-full shrink-0 justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="accent"
              size="sm"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {isRegenerate ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
