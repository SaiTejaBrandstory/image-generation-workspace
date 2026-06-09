"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { Check, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { estimateStoryboardImageBatchCost } from "@/lib/image-model-pricing";
import {
  clampStoryboardImageAspectRatio,
  isStoryboardReferenceFrameImageModel,
  sortStoryboardImageModels,
  storyboardAspectRatiosForModel,
  storyboardReferenceFrameImageModels,
  STORYBOARD_DEFAULT_IMAGE_ASPECT,
  STORYBOARD_IMAGE_MODEL,
} from "@/lib/storyboard/storyboard-image";
import { formatStoryboardJobCost } from "@/lib/video-model-pricing";
import {
  getImageModelsCatalog,
  getModelConfig,
  OPENROUTER_IMAGE_MODELS,
  setImageModelsCatalog,
  type ImageModelConfig,
} from "@/lib/openrouter-models";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/types";

export type StoryboardImageModelDialogMode =
  | "generate"
  | "regenerate"
  | "missing";

interface StoryboardImageModelDialogProps {
  open: boolean;
  mode: StoryboardImageModelDialogMode;
  imageModel: string;
  imageAspectRatio: AspectRatio;
  frameCount: number;
  onConfirm: (model: string, aspectRatio: AspectRatio) => void;
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

const MODEL_META_COL_PRICE = "min-w-[4.25rem]";

function ModelListHeader() {
  return (
    <div className="flex items-center gap-3 px-3 pb-1 text-[10px] font-medium text-foreground-muted">
      <span className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1" />
      <span
        className={cn(
          MODEL_META_COL_PRICE,
          "text-center tabular-nums tracking-tight"
        )}
      >
        $/img
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
  model: ImageModelConfig;
  selected: boolean;
  onSelect: () => void;
  rowRef?: Ref<HTMLButtonElement>;
}) {
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

      <MetaChip
        className={cn(
          MODEL_META_COL_PRICE,
          "shrink-0 justify-center bg-surface text-foreground-muted ring-border/60"
        )}
      >
        {model.costLabel}
      </MetaChip>
    </button>
  );
}

const MODE_COPY: Record<
  StoryboardImageModelDialogMode,
  { title: string; action: string }
> = {
  generate: { title: "Generate storyboards", action: "Generate" },
  regenerate: { title: "Regenerate frames", action: "Regenerate" },
  missing: { title: "Generate missing frames", action: "Generate" },
};

export function StoryboardImageModelDialog({
  open,
  mode,
  imageModel,
  imageAspectRatio,
  frameCount,
  onConfirm,
  onCancel,
}: StoryboardImageModelDialogProps) {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ImageModelConfig[]>([]);
  const [selected, setSelected] = useState(imageModel);
  const [aspectRatio, setAspectRatio] = useState(imageAspectRatio);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const didInitialScrollRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setSelected(imageModel);
    setAspectRatio(imageAspectRatio);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/image/models");
        const data = (await res.json()) as { models?: ImageModelConfig[] };
        if (!cancelled && Array.isArray(data.models) && data.models.length) {
          setImageModelsCatalog(data.models);
          setModels(storyboardReferenceFrameImageModels(data.models));
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
  }, [open, imageModel, imageAspectRatio]);

  const sorted = useMemo(() => {
    const source = models.length ? models : getImageModelsCatalog();
    const refModels =
      source.length > 0
        ? storyboardReferenceFrameImageModels(source)
        : storyboardReferenceFrameImageModels(OPENROUTER_IMAGE_MODELS);
    return sortStoryboardImageModels(refModels);
  }, [models]);

  const modelId =
    selected && isStoryboardReferenceFrameImageModel(selected)
      ? selected
      : (sorted[0]?.id ?? STORYBOARD_IMAGE_MODEL);

  const aspectOptions = useMemo(
    () => storyboardAspectRatiosForModel(modelId),
    [modelId]
  );

  const resolvedAspect = useMemo(() => {
    if (aspectOptions.includes(aspectRatio)) return aspectRatio;
    return clampStoryboardImageAspectRatio(
      modelId,
      aspectRatio || STORYBOARD_DEFAULT_IMAGE_ASPECT
    );
  }, [aspectOptions, aspectRatio, modelId]);

  useEffect(() => {
    if (!aspectOptions.includes(aspectRatio)) {
      setAspectRatio(resolvedAspect);
    }
  }, [aspectOptions, aspectRatio, resolvedAspect]);

  const selectedModel = sorted.find((m) => m.id === modelId);
  const modelLabel = selectedModel?.label ?? getModelConfig(modelId).label;
  const batchCost = useMemo(
    () =>
      estimateStoryboardImageBatchCost(
        frameCount,
        selectedModel?.costPerImageUsd ?? getModelConfig(modelId).costPerImageUsd
      ),
    [frameCount, modelId, selectedModel?.costPerImageUsd]
  );
  const copy = MODE_COPY[mode];

  useEffect(() => {
    if (!open) {
      didInitialScrollRef.current = false;
      return;
    }
    if (loading || didInitialScrollRef.current) return;

    const id = requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      didInitialScrollRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [open, loading]);

  const handleModelSelect = (id: string) => {
    setSelected(id);
    setAspectRatio((current) =>
      clampStoryboardImageAspectRatio(id, current)
    );
  };

  const handleConfirm = () => {
    if (!isStoryboardReferenceFrameImageModel(modelId)) return;
    onConfirm(modelId, resolvedAspect);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent className="w-[min(420px,calc(100vw-2rem))] max-w-[420px] gap-0 overflow-hidden rounded-xl p-0">
        <DialogHeader className="border-b border-border/60 bg-surface-elevated/40 px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ImageIcon className="h-4 w-4 text-accent-cyan" />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-foreground-muted">
            {sorted.length} ref-frame models · {frameCount} frames · cheapest
            first
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-foreground-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading models…
            </div>
          ) : (
            <section className="space-y-3">
              <div className="px-0.5">
                <h3 className="text-xs font-semibold text-foreground">Model</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-foreground-muted">
                  Selected: {modelLabel} · anchor-frame continuity on scene 2+
                </p>
              </div>
              <div className="space-y-1">
                <ModelListHeader />
                <div className="max-h-[min(280px,40vh)] space-y-1.5 overflow-y-auto pr-0.5 scroll-smooth">
                  {sorted.map((m) => (
                    <ModelRow
                      key={m.id}
                      model={m}
                      selected={modelId === m.id}
                      rowRef={modelId === m.id ? selectedRef : undefined}
                      onSelect={() => handleModelSelect(m.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-border/50 pt-3">
                <h3 className="px-0.5 text-xs font-semibold text-foreground">
                  Aspect ratio
                </h3>
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
            </section>
          )}
        </div>

        <DialogFooter className="mt-0 shrink-0 flex-col items-stretch gap-3 border-t border-border/60 bg-surface-elevated/20 px-5 py-4">
          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
            <span>
              <span className="tabular-nums">{frameCount}</span> frames ·{" "}
              <span className="font-medium text-foreground">{resolvedAspect}</span>
            </span>
            {batchCost != null ? (
              <>
                <span aria-hidden className="text-border/80">
                  ·
                </span>
                <span>
                  Est.{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatStoryboardJobCost(batchCost)}
                  </span>
                </span>
                <span className="text-foreground-muted/70">
                  {selectedModel?.costLabel ??
                    getModelConfig(modelId).costLabel}
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
              disabled={loading || !isStoryboardReferenceFrameImageModel(modelId)}
              onClick={handleConfirm}
            >
              {copy.action}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
