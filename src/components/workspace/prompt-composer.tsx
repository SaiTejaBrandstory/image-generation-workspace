"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AspectRatio,
  DesignElement,
  ReferenceUsageMode,
  StyleEngine,
} from "@/types";
import {
  Loader2,
  Plus,
  Sparkles,
  SlidersHorizontal,
  Settings2,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  DESIGN_ELEMENTS,
  PROMPT_COLOR_SLOTS,
  STYLE_ENGINES,
} from "@/lib/constants";
import {
  getVideoModelConfig,
  videoModelAcceptsReferences,
} from "@/lib/openrouter-video-models";
import {
  selectIsViewingActiveGeneration,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ReferenceChips } from "./reference-chips";
import { ReferenceModeDialog } from "./reference-mode-dialog";
import { LayoutSelector } from "./layout-selector";
import { ModelSelector } from "./model-selector";
import { VideoModelSelector } from "./video-model-selector";
import { VideoOptionsSelects } from "./video-options-selects";
import {
  clampImageAspectRatioToModel,
  getAspectRatiosForModel,
  getModelConfig,
} from "@/lib/openrouter-models";
import { ASPECT_RATIOS as ALL_ASPECT_RATIOS } from "@/lib/constants";
import {
  dimensionsMeetMinimum,
  getFileImageDimensions,
  MIN_VIDEO_REFERENCE_DIMENSION,
} from "@/lib/reference-image-dimensions";
import {
  formatReferenceRejectionMessage,
  isSupportedReferenceImageFile,
  partitionReferenceImageFiles,
  referenceFormatHint,
  referenceImageAcceptAttr,
} from "@/lib/reference-image-formats";
import {
  formatReferenceLimitHint,
  planReferenceFileAdds,
  remainingReferenceSlots,
  totalReferenceBytes,
} from "@/lib/reference-limits";
import {
  clampPromptText,
  maxPromptCharsForMedia,
  promptOverLimitMessage,
  promptWithinLimit,
  formatPromptCountLabel,
} from "@/lib/prompt-limits";
import { cn } from "@/lib/utils";
import { PromptCountBadge } from "./prompt-count-badge";
import { ReferenceCountBadge } from "./reference-count-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMPOSER_MENU_CONTENT,
  COMPOSER_MENU_ITEM,
  COMPOSER_MENU_SCROLL,
  COMPOSER_MENU_TRIGGER_BTN,
} from "./composer-menu-styles";

const ASPECT_LABEL_SEP = " — ";

function splitAspectOptionLabel(full: string): { ratio: string; hint: string } {
  const i = full.indexOf(ASPECT_LABEL_SEP);
  if (i === -1) return { ratio: full.trim(), hint: "" };
  return {
    ratio: full.slice(0, i).trim(),
    hint: full.slice(i + ASPECT_LABEL_SEP.length).trim(),
  };
}

/** Custom menu so ratio + description columns align (native <option> text cannot). */
function AspectRatioComposerSelect({
  options,
  value,
  onChange,
}: {
  options: { value: AspectRatio; label: string }[];
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
}) {
  const current = options.find((o) => o.value === value);
  const currentLabel = current?.label ?? String(value);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Aspect ratio" className={COMPOSER_MENU_TRIGGER_BTN}>
          <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 shrink-0 text-foreground-muted/55" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={COMPOSER_MENU_CONTENT}>
        <div className={COMPOSER_MENU_SCROLL}>
          {options.map((o) => {
            const selected = o.value === value;
            const { ratio, hint } = splitAspectOptionLabel(o.label);
            return (
              <DropdownMenuItem
                key={o.value}
                onSelect={() => {
                  onChange(o.value);
                }}
                className={cn(
                  COMPOSER_MENU_ITEM,
                  selected &&
                    "bg-accent-violet/12 data-[highlighted]:bg-accent-violet/18"
                )}
              >
                <div className="flex w-full min-w-0 items-start gap-2">
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center">
                    {selected ? (
                      <Check className="h-3.5 w-3.5 text-accent-violet" aria-hidden strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <div className="grid min-w-0 flex-1 grid-cols-[3rem_minmax(0,1fr)] gap-x-2 text-left leading-snug">
                    <span className="shrink-0 pt-px text-left font-mono text-[11px] font-semibold tabular-nums text-foreground tracking-tight">
                      {ratio}
                    </span>
                    {hint ? (
                      <span className="min-w-0 text-[11px] text-foreground-muted">
                        {hint}
                      </span>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Same menu shell as aspect ratio; one left-aligned label column (existing copy only). */
function ComposerLabeledPickMenu<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  const currentLabel = current?.label ?? String(value);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={COMPOSER_MENU_TRIGGER_BTN}>
          <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 shrink-0 text-foreground-muted/55" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={COMPOSER_MENU_CONTENT}>
        <div className={COMPOSER_MENU_SCROLL}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <DropdownMenuItem
                key={o.value}
                onSelect={() => onChange(o.value)}
                className={cn(
                  COMPOSER_MENU_ITEM,
                  selected &&
                    "bg-accent-violet/12 data-[highlighted]:bg-accent-violet/18"
                )}
              >
                <div className="flex w-full min-w-0 items-start gap-2">
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center">
                    {selected ? (
                      <Check className="h-3.5 w-3.5 text-accent-violet" aria-hidden strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 text-left text-[11px] font-medium leading-snug text-foreground">
                    {o.label}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ComposerField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function ImageGenerationSelects() {
  const {
    aspectRatio,
    setAspectRatio,
    designElement,
    setDesignElement,
    style,
    setStyle,
    imageModel,
  } = useWorkspaceStore();

  // Derive the aspect ratios supported by the currently selected model.
  // Fall back to the full list if the model is unknown.
  const modelAspectRatios = useMemo(() => {
    const supported = getAspectRatiosForModel(imageModel);
    return ALL_ASPECT_RATIOS.filter((a) => supported.includes(a.value));
  }, [imageModel]);

  // Keep store aspect in sync when the model's supported list changes.
  useEffect(() => {
    const clamped = clampImageAspectRatioToModel(imageModel, aspectRatio);
    if (clamped !== aspectRatio) setAspectRatio(clamped);
  }, [imageModel, aspectRatio, setAspectRatio]);

  const modelAndAspectRow = (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <ModelSelector showLabel />
      <ComposerField label="Aspect ratio">
        <AspectRatioComposerSelect
          options={modelAspectRatios}
          value={aspectRatio}
          onChange={(v) => setAspectRatio(v)}
        />
      </ComposerField>
    </div>
  );

  const styleAndDesignRow = (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <ComposerField label="Design element">
        <ComposerLabeledPickMenu<DesignElement>
          ariaLabel="Design element"
          options={DESIGN_ELEMENTS}
          value={designElement}
          onChange={setDesignElement}
        />
      </ComposerField>
      <ComposerField label="Style">
        <ComposerLabeledPickMenu<StyleEngine>
          ariaLabel="Style"
          options={STYLE_ENGINES}
          value={style}
          onChange={setStyle}
        />
      </ComposerField>
    </div>
  );

  return (
    <div className="flex min-w-0 w-full flex-col gap-3">
      {modelAndAspectRow}
      {styleAndDesignRow}
    </div>
  );
}

function PromptColorSlotRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 py-1.5">
      <span className="w-[4.75rem] shrink-0 text-[11px] font-medium text-foreground">
        {label}
      </span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
        aria-label={`Pick ${label} color`}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 min-w-0 flex-1 rounded border border-border bg-surface-elevated px-2 text-[11px] font-mono uppercase text-foreground outline-none focus:border-accent-violet/45"
        aria-label={`${label} color hex`}
      />
    </div>
  );
}

export function PromptComposer() {
  const [showOptions, setShowOptions] = useState(false);
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [referenceUploadWarning, setReferenceUploadWarning] = useState<
    string | null
  >(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const modeDialogOpenRef = useRef(false);

  const {
    prompt,
    setPrompt,
    mediaType,
    addReference,
    generate,
    references,
    imageModel,
    videoModel,
    colorPreferenceEnabled,
    promptColors,
    setColorPreferenceEnabled,
    setPromptColor,
  } = useWorkspaceStore();

  const isGenerating = useWorkspaceStore((s) => s.isGenerating);
  const isViewingGeneration = useWorkspaceStore(selectIsViewingActiveGeneration);

  const isVideo = mediaType === "video";
  const modelConfig = getModelConfig(imageModel);
  const videoConfig = getVideoModelConfig(videoModel);
  const videoAcceptsRefs = videoModelAcceptsReferences(videoModel);
  const usesVisionRefs = isVideo
    ? videoAcceptsRefs
    : modelConfig.supportsVisionInput;
  const refsAttachedButIgnored =
    isVideo && references.length > 0 && !videoAcceptsRefs;

  // Pass imageModel so limits are model-specific for image mode.
  const imageModelId = isVideo ? undefined : imageModel;
  const referenceSlotsLeft = remainingReferenceSlots(
    references.length,
    mediaType,
    imageModelId
  );
  const atReferenceLimit = referenceSlotsLeft === 0;
  const canAddReferences =
    (!isVideo || videoAcceptsRefs) && !atReferenceLimit && modelConfig.maxReferenceImages > 0;

  const invalidAttachedRefs = useMemo(() => {
    if (!isVideo || references.length === 0) return [];
    return references.filter(
      (r) =>
        !isSupportedReferenceImageFile(
          new File([], r.name || "image", { type: "" }),
          "video"
        )
    );
  }, [isVideo, references]);

  const [generateClickLock, setGenerateClickLock] = useState(false);

  const maxPromptChars = maxPromptCharsForMedia(mediaType, imageModelId);
  const promptCharCount = prompt.length;
  const promptTooLong = promptCharCount > maxPromptChars;

  const canGenerate =
    promptWithinLimit(prompt, mediaType, imageModelId) &&
    !isGenerating &&
    !generateClickLock &&
    invalidAttachedRefs.length === 0;

  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(clampPromptText(value, mediaType, imageModelId));
    },
    [setPrompt, mediaType, imageModelId]
  );

  const handleGenerate = useCallback(async () => {
    if (generateClickLock || isGenerating || !canGenerate) return;
    setGenerateClickLock(true);
    try {
      await generate();
    } finally {
      setGenerateClickLock(false);
    }
  }, [generateClickLock, isGenerating, canGenerate, generate]);
  const generateTooltip = isViewingGeneration
    ? "Generation in progress…"
    : promptTooLong
      ? promptOverLimitMessage(promptCharCount, mediaType, imageModelId)
      : !prompt.trim()
        ? "Enter a prompt to generate"
        : isVideo
          ? "Generate video from your prompt"
          : "Generate all selected creatives";

  const clearPendingBatch = useCallback(() => {
    for (const url of previewUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    previewUrlsRef.current = [];
    setPendingPreviewUrls([]);
    setPendingFiles([]);
    modeDialogOpenRef.current = false;
  }, []);

  const applyReferenceLimits = useCallback(
    (
      files: File[],
      baseCount: number,
      baseBytes: number
    ): { toAdd: File[]; warnings: string[] } => {
      const { accepted: formatOk, rejected: formatRejected } =
        partitionReferenceImageFiles(files, mediaType);
      const { toAdd, rejections: limitRejected } = planReferenceFileAdds(
        formatOk,
        baseCount,
        baseBytes,
        mediaType,
        imageModelId
      );
      const warnings = [
        ...(formatRejected.length > 0
          ? [formatReferenceRejectionMessage(formatRejected, mediaType)]
          : []),
        ...limitRejected,
      ];
      if (warnings.length > 0) {
        setReferenceUploadWarning(warnings.join(" "));
      } else if (toAdd.length > 0) {
        setReferenceUploadWarning(null);
      }
      return { toAdd, warnings };
    },
    [mediaType]
  );

  const openPendingBatch = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const { toAdd } = applyReferenceLimits(
        files,
        references.length + pendingFiles.length,
        totalReferenceBytes(references) +
          pendingFiles.reduce((s, f) => s + f.size, 0)
      );
      if (toAdd.length === 0) return;

      clearPendingBatch();
      modeDialogOpenRef.current = true;
      previewUrlsRef.current = toAdd.map((f) => URL.createObjectURL(f));
      setPendingPreviewUrls([...previewUrlsRef.current]);
      setPendingFiles(toAdd);
    },
    [applyReferenceLimits, references, pendingFiles, clearPendingBatch]
  );

  const enqueueImageFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const candidates = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.name)
      );
      if (candidates.length === 0) {
        setReferenceUploadWarning(
          `No image files detected. Use ${referenceFormatHint(mediaType)}.`
        );
        return;
      }

      if (!canAddReferences) {
        if (atReferenceLimit) {
          setReferenceUploadWarning(
            `Maximum references reached (${formatReferenceLimitHint(mediaType, imageModelId)}).`
          );
        }
        return;
      }

      // Video: consistency references (avatar, location, style) — not keyframe cards
      if (isVideo) {
        if (!videoAcceptsRefs) {
          setReferenceUploadWarning(
            "This video model cannot use consistency references. Choose Wan 2.7, Seedance, or Grok Imagine in the model picker."
          );
          return;
        }
        const { toAdd, warnings: limitWarnings } = applyReferenceLimits(
          candidates,
          references.length,
          totalReferenceBytes(references)
        );
        if (toAdd.length === 0) return;

        void (async () => {
          const small: string[] = [];
          for (const file of toAdd) {
            try {
              const dims = await getFileImageDimensions(file);
              if (
                dims.width > 0 &&
                !dimensionsMeetMinimum(
                  dims.width,
                  dims.height,
                  MIN_VIDEO_REFERENCE_DIMENSION
                )
              ) {
                small.push(
                  `${file.name} (${dims.width}×${dims.height})`
                );
              }
            } catch {
              /* ignore dimension probe */
            }
            addReference(file, "inspire");
          }
          if (small.length > 0) {
            const upscaleNote = `Reference${small.length > 1 ? "s" : ""} below ${MIN_VIDEO_REFERENCE_DIMENSION}×${MIN_VIDEO_REFERENCE_DIMENSION}px — auto-upscaled before send.`;
            setReferenceUploadWarning(
              limitWarnings.length > 0
                ? `${limitWarnings.join(" ")} ${upscaleNote}`
                : upscaleNote
            );
          }
        })();
        return;
      }

      const sessionMode = references[0]?.usageMode;
      if (references.length > 0 && sessionMode) {
        const { toAdd } = applyReferenceLimits(
          candidates,
          references.length,
          totalReferenceBytes(references)
        );
        for (const file of toAdd) addReference(file, sessionMode);
        return;
      }

      if (modeDialogOpenRef.current) {
        openPendingBatch([...pendingFiles, ...candidates]);
        return;
      }

      openPendingBatch(candidates);
    },
    [
      mediaType,
      isVideo,
      videoAcceptsRefs,
      canAddReferences,
      references,
      addReference,
      pendingFiles,
      openPendingBatch,
      applyReferenceLimits,
    ]
  );

  const handleModeSelect = useCallback(
    (mode: ReferenceUsageMode) => {
      const { toAdd } = applyReferenceLimits(
        pendingFiles,
        references.length,
        totalReferenceBytes(references)
      );
      for (const file of toAdd) addReference(file, mode);
      clearPendingBatch();
    },
    [addReference, pendingFiles, clearPendingBatch, applyReferenceLimits, references]
  );

  const handleModeCancel = useCallback(() => {
    clearPendingBatch();
  }, [clearPendingBatch]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      enqueueImageFiles(e.dataTransfer.files);
    },
    [enqueueImageFiles]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const pasted: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) pasted.push(file);
        }
      }
      if (pasted.length > 0) enqueueImageFiles(pasted);
    },
    [enqueueImageFiles]
  );

  const referenceMode = references[0]?.usageMode;
  const videoKeyframeMode = isVideo && referenceMode === "preserve";

  return (
    <div
      ref={dropRef}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="shrink-0 border-t border-border bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:px-4 sm:pt-3 lg:pb-4"
    >
      <div className="mx-auto w-full max-w-3xl lg:pb-0">
        <ReferenceModeDialog
          open={!isVideo && pendingFiles.length > 0}
          previewUrls={pendingPreviewUrls}
          fileCount={pendingFiles.length}
          mediaType={mediaType}
          onSelect={handleModeSelect}
          onCancel={handleModeCancel}
        />

        <ReferenceChips />

        {(referenceUploadWarning ||
          invalidAttachedRefs.length > 0 ||
          refsAttachedButIgnored ||
          (videoKeyframeMode && references.length > 0)) && (
          <div
            role="alert"
            className="mb-2 flex items-start gap-2 rounded-xl border border-accent-orange/25 bg-accent-orange/5 px-2.5 py-2 text-[11px] leading-snug text-accent-orange"
          >
            <p className="min-w-0 flex-1">
              {invalidAttachedRefs.length > 0
                ? `Unsupported format — remove before generating (${referenceFormatHint("video")}): ${invalidAttachedRefs.map((r) => r.name).join(", ")}`
                : refsAttachedButIgnored
                  ? "This video model is text-only — references will not be sent."
                  : videoKeyframeMode
                    ? "Keyframe mode uses start/end frames, not consistency. Switch to Consistency above."
                    : referenceUploadWarning}
            </p>
            {referenceUploadWarning && invalidAttachedRefs.length === 0 && (
              <button
                type="button"
                onClick={() => setReferenceUploadWarning(null)}
                className="shrink-0 rounded-md p-0.5 text-accent-orange/80 hover:bg-accent-orange/10 hover:text-accent-orange"
                aria-label="Dismiss notice"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="rounded-[22px] border border-border/90 bg-surface shadow-cinematic ring-1 ring-black/[0.04] dark:ring-white/[0.06] overflow-hidden">
          <div className="relative bg-gradient-to-b from-background/80 to-surface-hover/15">
            <textarea
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onPaste={onPaste}
              maxLength={maxPromptChars}
              placeholder={
                isVideo
                  ? "Describe the video you want to generate…"
                  : "Describe the creative you want to generate..."
              }
              rows={3}
              aria-describedby="prompt-char-count"
              className={cn(
                "w-full resize-none bg-transparent pl-14 pr-16 py-4 text-[15px] leading-relaxed text-foreground placeholder:text-foreground-muted/65 outline-none min-h-[96px] transition-colors",
                promptTooLong && "text-accent-orange"
              )}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
              }}
            />

            <div
              id="prompt-char-count"
              className="pointer-events-none absolute right-3 top-3"
            >
              <PromptCountBadge length={promptCharCount} mediaType={mediaType} imageModelId={imageModelId} />
            </div>

            <Tooltip
              content={
                !canAddReferences
                  ? atReferenceLimit || modelConfig.maxReferenceImages === 0
                    ? modelConfig.maxReferenceImages === 0 && !isVideo
                      ? `${modelConfig.label} is text-to-image only — no reference images`
                      : `Maximum references attached (${formatReferenceLimitHint(mediaType, imageModelId)})`
                    : `${videoConfig.label} does not accept reference images — prompt only`
                  : isVideo
                    ? `Add consistency reference (${formatReferenceLimitHint("video")})`
                    : `Add reference image (${formatReferenceLimitHint(mediaType, imageModelId)})`
              }
            >
              <span className="absolute left-3 bottom-3 inline-flex items-center gap-1.5">
              {references.length > 0 && (
                <ReferenceCountBadge
                  count={references.length}
                  mediaType={mediaType}
                  imageModelId={imageModelId}
                />
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!canAddReferences}
                title={
                  isVideo
                    ? "Add reference image for video"
                    : "Add reference image"
                }
                aria-label={
                  isVideo
                    ? "Add reference image for video"
                    : "Add reference image"
                }
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border border-border/90 bg-background text-foreground-muted shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground hover:border-foreground/15 disabled:cursor-not-allowed disabled:opacity-40",
                  isVideo
                    ? "hover:border-accent-cyan/35"
                    : "hover:border-accent-violet/35"
                )}
              >
                <Plus className="h-5 w-5" strokeWidth={2} />
              </button>
              </span>
            </Tooltip>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={referenceImageAcceptAttr(mediaType)}
            multiple
            className="hidden"
            onChange={(e) => {
              enqueueImageFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {!isVideo ? (
            <div className="composer-toolbar hidden min-w-0 flex-col gap-0 border-t border-border/80 bg-surface-hover/20 px-4 py-3 dark:bg-white/[0.025] lg:flex">
              <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/50 pb-3">
                <LayoutSelector />
              </div>
              <div className="pt-3">
                <ImageGenerationSelects />
              </div>
            </div>
          ) : (
            <div className="composer-toolbar hidden flex-wrap items-center gap-2 border-t border-border/80 bg-surface-hover/20 px-4 py-3 dark:bg-white/[0.025] lg:flex">
              <VideoModelSelector />
              <VideoOptionsSelects />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="flex w-full items-center justify-between border-t border-border/80 bg-surface-hover/10 px-4 py-2.5 text-xs text-foreground-muted lg:hidden"
          >
            <span className="font-medium">Generation options</span>
            <SlidersHorizontal
              className={cn(
                "h-4 w-4 transition-transform",
                showOptions && "rotate-90 text-accent-violet"
              )}
            />
          </button>

          {showOptions && (
            <div className="space-y-3 border-t border-border/80 bg-surface-hover/15 px-4 py-4 lg:hidden">
              {!isVideo ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <LayoutSelector />
                  </div>
                  <ImageGenerationSelects />
                </>
              ) : (
                <>
                  <VideoModelSelector />
                  <VideoOptionsSelects mobile />
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/80 bg-surface-hover/15 px-4 py-3">
            {!isVideo ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/90 bg-background text-foreground-muted shadow-sm transition-colors hover:border-foreground/15 hover:bg-surface-hover hover:text-foreground"
                    aria-label="Color prompt settings"
                    title="Color prompt settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[300px] p-2.5">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                      Prompt color
                    </p>
                    <label className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-2.5 py-2 text-xs text-foreground">
                      <span>Enable color</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={colorPreferenceEnabled}
                        onClick={() =>
                          setColorPreferenceEnabled(!colorPreferenceEnabled)
                        }
                        className={cn(
                          "relative h-5 w-9 rounded-full transition-colors",
                          colorPreferenceEnabled
                            ? "bg-accent-violet"
                            : "bg-foreground/20"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                            colorPreferenceEnabled
                              ? "translate-x-4"
                              : "translate-x-0"
                          )}
                        />
                      </button>
                    </label>
                    {colorPreferenceEnabled && (
                      <div className="space-y-1.5">
                        {PROMPT_COLOR_SLOTS.map(({ key, label }) => (
                          <PromptColorSlotRow
                            key={key}
                            label={label}
                            value={promptColors[key]}
                            onChange={(hex) => setPromptColor(key, hex)}
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] leading-snug text-foreground-muted">
                      Adds primary and secondary colors as palette hints in the
                      prompt.
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span />
            )}
            <Tooltip content={generateTooltip}>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void handleGenerate()}
                  disabled={!canGenerate}
                  aria-busy={isViewingGeneration || generateClickLock}
                  aria-disabled={!canGenerate}
                  className={cn(
                    "h-10 min-w-[160px] gap-2 rounded-xl px-5 text-sm font-medium shadow-sm",
                    canGenerate && "hover:brightness-110 active:scale-[0.98]",
                    isVideo && "bg-accent-cyan hover:bg-accent-cyan/90"
                  )}
                >
                  {isViewingGeneration ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isViewingGeneration
                    ? isVideo
                      ? "Generating video…"
                      : "Generating…"
                    : isVideo
                      ? "Generate video"
                      : "Generate creatives"}
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>

        {isVideo && !videoAcceptsRefs && (
          <p className="mt-2 text-center text-[10px] text-accent-orange/90">
            This model is prompt-only — pick Wan 2.7, Seedance, or Grok for
            consistency references.
          </p>
        )}
      </div>
    </div>
  );
}
