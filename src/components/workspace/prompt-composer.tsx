"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Sparkles, SlidersHorizontal } from "lucide-react";
import {
  ASPECT_RATIOS,
  PLATFORM_PRESETS,
  STYLE_ENGINES,
} from "@/lib/constants";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { ReferenceChips } from "./reference-chips";
import { LayoutSelector } from "./layout-selector";
import { ModelSelector } from "./model-selector";
import { getModelConfig } from "@/lib/openrouter-models";
import { cn } from "@/lib/utils";

const PARAM_LABELS: { key: keyof import("@/types").GenerationParams; label: string }[] = [
  { key: "creativity", label: "Creativity" },
  { key: "typographyStrength", label: "Typography" },
  { key: "visualDensity", label: "Density" },
  { key: "motionEnergy", label: "Motion" },
  { key: "depthIntensity", label: "Depth" },
  { key: "contrast", label: "Contrast" },
  { key: "uiPresence", label: "UI Presence" },
];

function AspectPlatformStyleSelects({ mobile }: { mobile?: boolean }) {
  const {
    aspectRatio,
    setAspectRatio,
    platform,
    setPlatform,
    style,
    setStyle,
  } = useWorkspaceStore();

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
      <select
        value={style}
        onChange={(e) => setStyle(e.target.value as typeof style)}
        className={selectClass}
        aria-label="Style engine"
      >
        {STYLE_ENGINES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </>
  );

  if (mobile) {
    return <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{selects}</div>;
  }

  return <>{selects}</>;
}

export function PromptComposer() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const {
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    platform,
    setPlatform,
    style,
    setStyle,
    params,
    setParam,
    addReference,
    generate,
    isGenerating,
    references,
    imageModel,
  } = useWorkspaceStore();

  const modelConfig = getModelConfig(imageModel);
  const usesVisionRefs = modelConfig.supportsVisionInput;

  const canGenerate = prompt.trim().length > 0 && !isGenerating;
  const generateTooltip = isGenerating
    ? "Generation in progress…"
    : !prompt.trim()
      ? "Enter a prompt to generate layouts"
      : "Generate all selected layouts";

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((f) => {
        if (f.type.startsWith("image/")) addReference(f);
      });
    },
    [addReference]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) addReference(file);
        }
      }
    },
    [addReference]
  );

  return (
    <div
      ref={dropRef}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="shrink-0 border-t border-border bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:px-4 sm:pt-3 lg:pb-4"
    >
      <div className="mx-auto w-full max-w-3xl lg:pb-0">
        <ReferenceChips />

        <motion.div
          layout
          className="rounded-[20px] border border-border bg-surface shadow-cinematic overflow-hidden"
        >
          {references.length > 0 && (
            <p
              className={cn(
                "border-b border-border/60 px-4 py-2 text-[11px]",
                usesVisionRefs ? "text-accent-cyan" : "text-accent-orange"
              )}
            >
              {references.length} reference
              {references.length > 1 ? "s" : ""} — used on every layout you generate
              {references.length > 4 ? " (max 4 sent per request)" : ""}
              {usesVisionRefs
                ? ""
                : " · refs described in text only for this model"}
            </p>
          )}

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste}
              placeholder="Describe the creative you want to generate..."
              rows={3}
              className="w-full resize-none bg-transparent pl-14 pr-5 py-4 text-[15px] leading-relaxed text-foreground placeholder:text-foreground-muted outline-none min-h-[96px]"
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
              }}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Add reference image (style, product, composition…)"
              aria-label="Add reference image"
              className="absolute left-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-foreground-muted transition-colors hover:border-accent-violet/40 hover:bg-surface-hover hover:text-foreground"
            >
              <Plus className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Desktop: full toolbar (Layouts, Model, Aspect, Platform, Style, Params) */}
          <div className="composer-toolbar hidden flex-wrap items-center gap-2 border-t border-border px-3 py-2.5 lg:flex">
            <LayoutSelector />
            <ModelSelector />
            <AspectPlatformStyleSelects />
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                "ml-auto flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs transition-colors",
                showAdvanced
                  ? "bg-accent-violet/20 text-accent-violet"
                  : "text-foreground-muted hover:bg-surface-elevated"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Params
            </button>
          </div>

          {/* Mobile: collapsible options */}
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
              <div className="grid grid-cols-2 gap-2">
                <LayoutSelector />
                <ModelSelector />
              </div>
              <AspectPlatformStyleSelects mobile />
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs",
                  showAdvanced
                    ? "bg-accent-violet/20 text-accent-violet"
                    : "bg-surface-elevated text-foreground-muted"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Advanced params
              </button>
            </div>
          )}

          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="border-t border-border px-4 py-3 grid grid-cols-2 gap-4 sm:grid-cols-3"
            >
              {PARAM_LABELS.map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-foreground-muted">
                    <span>{label}</span>
                    <span>{params[key]}</span>
                  </div>
                  <Slider
                    value={[params[key]]}
                    onValueChange={([v]) => setParam(key, v)}
                  />
                </div>
              ))}
            </motion.div>
          )}

          <div className="flex justify-end border-t border-border px-3 py-2">
            <Tooltip content={generateTooltip}>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void generate()}
                  disabled={!canGenerate}
                  aria-busy={isGenerating}
                  aria-disabled={!canGenerate}
                  className={cn(
                    "h-9 min-w-[140px] gap-1.5 rounded-xl px-4 text-xs font-medium",
                    canGenerate && "hover:brightness-110 active:scale-[0.98]"
                  )}
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isGenerating ? "Generating…" : "Generate layouts"}
                </Button>
              </span>
            </Tooltip>
          </div>
        </motion.div>

        <p className="mt-2 text-center text-[10px] text-foreground-muted/70">
          Drop or paste reference images · + adds a visual reference for generation
        </p>
      </div>
    </div>
  );
}
