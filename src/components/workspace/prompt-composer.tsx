"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReferenceUsageMode } from "@/types";
import { motion } from "framer-motion";
import { Loader2, Plus, Sparkles, SlidersHorizontal } from "lucide-react";
import { ASPECT_RATIOS, PLATFORM_PRESETS } from "@/lib/constants";
import {
  getVideoModelConfig,
  videoModelAcceptsReferences,
} from "@/lib/openrouter-video-models";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ReferenceChips } from "./reference-chips";
import { ReferenceModeDialog } from "./reference-mode-dialog";
import { LayoutSelector } from "./layout-selector";
import { ModelSelector } from "./model-selector";
import { VideoModelSelector } from "./video-model-selector";
import { VideoOptionsSelects } from "./video-options-selects";
import { MediaTypeToggle } from "./media-type-toggle";
import { getModelConfig } from "@/lib/openrouter-models";
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
import { cn } from "@/lib/utils";

function AspectPlatformSelects({ mobile }: { mobile?: boolean }) {
  const { aspectRatio, setAspectRatio, platform, setPlatform } =
    useWorkspaceStore();

  const selectClass = mobile
    ? "w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm text-foreground border-0 outline-none cursor-pointer"
    : "shrink-0 rounded-xl bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground-muted border-0 outline-none cursor-pointer";

  const selects = (
    <>
      <select
        value={aspectRatio}
        onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
        className={selectClass}
        aria-label="Aspect ratio"
      >
        {ASPECT_RATIOS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value as typeof platform)}
        className={cn(selectClass, !mobile && "max-w-[120px]")}
        aria-label="Platform"
      >
        {PLATFORM_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </>
  );

  if (mobile) {
    return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{selects}</div>;
  }

  return <>{selects}</>;
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
    isGenerating,
    references,
    imageModel,
    videoModel,
  } = useWorkspaceStore();

  const isVideo = mediaType === "video";
  const modelConfig = getModelConfig(imageModel);
  const videoConfig = getVideoModelConfig(videoModel);
  const videoAcceptsRefs = videoModelAcceptsReferences(videoModel);
  const usesVisionRefs = isVideo
    ? videoAcceptsRefs
    : modelConfig.supportsVisionInput;
  const refsAttachedButIgnored =
    isVideo && references.length > 0 && !videoAcceptsRefs;

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

  const canGenerate =
    prompt.trim().length > 0 &&
    !isGenerating &&
    !generateClickLock &&
    invalidAttachedRefs.length === 0;

  const handleGenerate = useCallback(async () => {
    if (generateClickLock || isGenerating || !prompt.trim()) return;
    setGenerateClickLock(true);
    try {
      await generate();
    } finally {
      setGenerateClickLock(false);
    }
  }, [generateClickLock, isGenerating, prompt, generate]);
  const generateTooltip = isGenerating
    ? "Generation in progress…"
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

  const openPendingBatch = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const { accepted, rejected } = partitionReferenceImageFiles(
        files,
        mediaType
      );
      if (rejected.length > 0) {
        setReferenceUploadWarning(
          formatReferenceRejectionMessage(rejected, mediaType)
        );
      }
      if (accepted.length === 0) return;

      clearPendingBatch();
      modeDialogOpenRef.current = true;
      previewUrlsRef.current = accepted.map((f) => URL.createObjectURL(f));
      setPendingPreviewUrls([...previewUrlsRef.current]);
      setPendingFiles(accepted);
    },
    [clearPendingBatch, mediaType]
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

      const { accepted, rejected } = partitionReferenceImageFiles(
        candidates,
        mediaType
      );

      if (rejected.length > 0) {
        setReferenceUploadWarning(
          formatReferenceRejectionMessage(rejected, mediaType)
        );
      } else {
        setReferenceUploadWarning(null);
      }

      if (accepted.length === 0) return;

      // Video: consistency references (avatar, location, style) — not keyframe cards
      if (isVideo) {
        if (!videoAcceptsRefs) {
          setReferenceUploadWarning(
            "This video model cannot use consistency references. Choose Wan 2.7, Seedance, or Grok Imagine in the model picker."
          );
          return;
        }
        void (async () => {
          const small: string[] = [];
          for (const file of accepted) {
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
            setReferenceUploadWarning(
              `Small reference${small.length > 1 ? "s" : ""} will be upscaled to at least ${MIN_VIDEO_REFERENCE_DIMENSION}×${MIN_VIDEO_REFERENCE_DIMENSION}px before send: ${small.join(", ")}`
            );
          }
        })();
        return;
      }

      const sessionMode = references[0]?.usageMode;
      if (references.length > 0 && sessionMode) {
        for (const file of accepted) addReference(file, sessionMode);
        return;
      }

      if (modeDialogOpenRef.current) {
        openPendingBatch([...pendingFiles, ...accepted]);
        return;
      }

      openPendingBatch(accepted);
    },
    [
      mediaType,
      isVideo,
      videoAcceptsRefs,
      references,
      addReference,
      pendingFiles,
      openPendingBatch,
    ]
  );

  const handleModeSelect = useCallback(
    (mode: ReferenceUsageMode) => {
      for (const file of pendingFiles) addReference(file, mode);
      clearPendingBatch();
    },
    [addReference, pendingFiles, clearPendingBatch]
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

        <div className="mb-2 flex justify-center">
          <MediaTypeToggle />
        </div>

        <ReferenceChips />

        <motion.div
          layout
          className="rounded-[20px] border border-border bg-surface shadow-cinematic overflow-hidden"
        >
          {videoKeyframeMode && references.length > 0 && (
            <p
              role="status"
              className="border-b border-accent-orange/20 bg-accent-orange/5 px-4 py-2 text-xs text-accent-orange"
            >
              Keyframe mode treats uploads as opening/closing clips, not avatar or
              location consistency. Switch to <strong>Consistency</strong> in the
              reference bar above.
            </p>
          )}

          {(referenceUploadWarning || invalidAttachedRefs.length > 0) && (
            <p
              role="alert"
              className="border-b border-accent-orange/20 bg-accent-orange/5 px-4 py-2 text-xs text-accent-orange"
            >
              {invalidAttachedRefs.length > 0
                ? `Remove unsupported references (${referenceFormatHint("video")}) before generating: ${invalidAttachedRefs.map((r) => r.name).join(", ")}`
                : referenceUploadWarning}
            </p>
          )}

          {references.length > 0 && (
            <p
              className={cn(
                "border-b border-border/60 px-4 py-2 text-[11px]",
                refsAttachedButIgnored
                  ? "text-accent-orange"
                  : usesVisionRefs
                    ? isVideo
                      ? "text-accent-cyan"
                      : "text-foreground-muted"
                    : "text-accent-orange"
              )}
            >
              {isVideo ? "Video: " : ""}
              {references.length} reference image
              {references.length > 1 ? "s" : ""} + prompt
              {isVideo &&
                videoAcceptsRefs &&
                (referenceMode === "preserve"
                  ? " · keyframe clip (advanced)"
                  : " · consistency refs")}
              {!isVideo &&
                (referenceMode === "preserve"
                  ? " · preserve (exact assets)"
                  : referenceMode
                    ? " · inspire (visual direction)"
                    : "")}
              {references.length > 4 ? " (max 4 per request)" : ""}
              {refsAttachedButIgnored
                ? " · this video model is text-only — images will not be sent"
                : null}
              {!usesVisionRefs && !isVideo
                ? " · this model uses text-only direction"
                : null}
            </p>
          )}

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste}
              placeholder={
                isVideo
                  ? "Describe the video you want to generate…"
                  : "Describe the creative you want to generate..."
              }
              rows={3}
              className="w-full resize-none bg-transparent pl-14 pr-5 py-4 text-[15px] leading-relaxed text-foreground placeholder:text-foreground-muted outline-none min-h-[96px]"
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
              }}
            />

            <Tooltip
              content={
                isVideo && !videoAcceptsRefs
                  ? `${videoConfig.label} does not accept reference images — prompt only`
                  : isVideo
                    ? "Add image + prompt (first frame or style reference)"
                    : "Add reference image"
              }
            >
              <span className="absolute left-3 bottom-3 inline-flex">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isVideo && !videoAcceptsRefs}
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
                  "flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                  isVideo
                    ? "hover:border-accent-cyan/40"
                    : "hover:border-accent-violet/40"
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
            <div className="composer-toolbar hidden flex-wrap items-center gap-2 border-t border-border px-3 py-2.5 lg:flex">
              <LayoutSelector />
              <ModelSelector />
              <AspectPlatformSelects />
            </div>
          ) : (
            <div className="composer-toolbar hidden flex-wrap items-center gap-2 border-t border-border px-3 py-2.5 lg:flex">
              <VideoModelSelector />
              <VideoOptionsSelects />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-xs text-foreground-muted lg:hidden"
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
            <div className="space-y-3 border-t border-border px-3 py-3 lg:hidden">
              {!isVideo ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <LayoutSelector />
                    <ModelSelector />
                  </div>
                  <AspectPlatformSelects mobile />
                </>
              ) : (
                <>
                  <VideoModelSelector />
                  <VideoOptionsSelects mobile />
                </>
              )}
            </div>
          )}

          <div className="flex justify-end border-t border-border px-3 py-2">
            <Tooltip content={generateTooltip}>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void handleGenerate()}
                  disabled={!canGenerate}
                  aria-busy={isGenerating || generateClickLock}
                  aria-disabled={!canGenerate}
                  className={cn(
                    "h-9 min-w-[140px] gap-1.5 rounded-xl px-4 text-xs font-medium",
                    canGenerate && "hover:brightness-110 active:scale-[0.98]",
                    isVideo && "bg-accent-cyan hover:bg-accent-cyan/90"
                  )}
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isGenerating
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
        </motion.div>

        <p className="mt-2 text-center text-[10px] text-foreground-muted/70">
          {isVideo
            ? videoAcceptsRefs
              ? `Attach avatar, location, or style refs (${referenceFormatHint("video")}) — all sent for consistency, not as start/end cards`
              : "This model is prompt-only — pick Wan 2.7, Seedance, or Grok for consistency references"
            : `Drop or paste images (${referenceFormatHint(mediaType)}) · one Inspire or Preserve mode for all uploads`}
        </p>
      </div>
    </div>
  );
}
