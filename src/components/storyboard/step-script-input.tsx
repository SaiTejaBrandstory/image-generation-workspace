"use client";

import { useCallback, useRef } from "react";
import { Clapperboard, FileUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORYBOARD_SAMPLE_PROMPTS } from "@/lib/storyboard/sample-prompts";
import { countWords, detectScriptLanguage } from "@/lib/storyboard/script-utils";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";

function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-background/60 px-2.5 py-1 text-[11px] tabular-nums text-foreground-muted ring-1 ring-inset ring-border/60">
      {children}
    </span>
  );
}

export function StepScriptInput() {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    script,
    settings,
    setScript,
    nextStep,
    generateBreakdown,
    isBreakingDown,
    error,
  } = useStoryboardStore();

  const charCount = script.length;
  const wordCount = countWords(script);
  const sceneEstimate = settings.frameCount ?? 6;
  const language = detectScriptLanguage(script);
  const hasScript = Boolean(script.trim());

  const onFile = useCallback(
    async (file: File) => {
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        setScript(await file.text());
        return;
      }
      setScript(
        (useStoryboardStore.getState().script || "") +
          `\n[Uploaded ${file.name} — paste text manually for PDF/DOCX for now]`
      );
    },
    [setScript]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void onFile(file);
    },
    [onFile]
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-2 sm:py-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-accent-orange/10 ring-1 ring-inset ring-accent-orange/20">
          <Clapperboard className="h-5 w-5 text-accent-orange" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
            Create New Storyboard
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-foreground-muted">
            Describe your idea in a sentence or paste a full script — we&apos;ll
            build the scene breakdown for you.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-center text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-muted">
          Try an example
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {STORYBOARD_SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => setScript(sample.prompt)}
              className={cn(
                "rounded-md border px-4 py-2 text-xs font-medium transition-all",
                script === sample.prompt
                  ? "border-accent-orange/50 bg-accent-orange/12 text-accent-orange shadow-[0_0_20px_rgba(251,146,60,0.12)] ring-1 ring-inset ring-accent-orange/25"
                  : "border-border bg-surface-elevated text-foreground-muted hover:border-accent-orange/25 hover:text-foreground"
              )}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-surface-elevated/90",
          "shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-white/[0.06]",
          "transition-shadow focus-within:ring-accent-orange/20"
        )}
      >
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={10}
          placeholder="Describe your video in a few lines…&#10;&#10;e.g. 30-second running shoe ad, rainy city streets at night, energetic mood"
          className="min-h-[220px] w-full resize-y bg-transparent px-5 py-5 text-sm leading-relaxed outline-none placeholder:text-foreground-muted/50"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-background/30 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            <StatPill>{charCount.toLocaleString()} chars</StatPill>
            <StatPill>{wordCount.toLocaleString()} words</StatPill>
            <StatPill>~{sceneEstimate} scenes</StatPill>
            {hasScript && <StatPill>{language}</StatPill>}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent-orange transition-colors hover:bg-accent-orange/8"
          >
            <FileUp className="h-3.5 w-3.5" />
            Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf,.doc,.docx,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-accent-orange/30 bg-accent-orange/5 px-4 py-3 text-center text-sm text-accent-orange">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={nextStep}
          disabled={!hasScript}
          className="w-full sm:w-auto"
        >
          Configure project
        </Button>
        <Button
          onClick={() => void generateBreakdown()}
          disabled={!hasScript || isBreakingDown}
          className={cn(
            "w-full border-0 sm:w-auto",
            "bg-accent-orange text-white shadow-[0_4px_24px_rgba(251,146,60,0.25)]",
            "hover:bg-accent-orange/90 disabled:opacity-50"
          )}
        >
          {isBreakingDown ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Scene Breakdown
        </Button>
      </div>
    </div>
  );
}
