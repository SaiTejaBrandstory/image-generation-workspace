"use client";

import {
  Check,
  Clock,
  Film,
  LayoutGrid,
  Loader2,
  MapPin,
  Palette,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DURATION_PRESETS,
  STORYBOARD_FRAME_COUNTS,
  STORYBOARD_GENRES,
} from "@/lib/storyboard/constants";
import {
  getFrameStyleLabel,
  STORYBOARD_FRAME_STYLES,
} from "@/lib/storyboard/frame-styles";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";

function SummaryPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-background/60 px-2.5 py-1 text-[11px] font-medium tabular-nums text-foreground-muted ring-1 ring-inset ring-border/60">
      {children}
    </span>
  );
}

function ConfigCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface-elevated/90",
        "shadow-[0_12px_40px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-white/[0.06]",
        className
      )}
    >
      <div className="border-b border-border/70 bg-background/30 px-5 py-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-orange/10 ring-1 ring-inset ring-accent-orange/20">
              <Icon className="h-4 w-4 text-accent-orange" />
            </div>
          )}
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-xs leading-relaxed text-foreground-muted">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-muted">
      {children}
    </span>
  );
}

const textareaClass =
  "min-h-[96px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-foreground-muted/50 focus:border-accent-orange/40 focus:ring-1 focus:ring-accent-orange/20";

const choiceBtnClass = (selected: boolean) =>
  cn(
    "rounded-md border px-4 py-2.5 text-sm font-medium transition-all",
    selected
      ? "border-accent-orange/50 bg-accent-orange/12 text-accent-orange shadow-[0_0_20px_rgba(251,146,60,0.1)] ring-1 ring-inset ring-accent-orange/25"
      : "border-border bg-background text-foreground-muted hover:border-accent-orange/25 hover:text-foreground"
  );

export function StepProjectConfig() {
  const {
    settings,
    patchSettings,
    prevStep,
    generateBreakdown,
    isBreakingDown,
    error,
  } = useStoryboardStore();

  const genreLabel =
    STORYBOARD_GENRES.find((g) => g.id === settings.genre)?.label ?? "—";
  const secPerFrame = Math.round(settings.durationSec / settings.frameCount);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-2 sm:gap-8 sm:py-4">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-accent-orange/10 ring-1 ring-inset ring-accent-orange/20">
          <Settings2 className="h-5 w-5 text-accent-orange" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
            Project settings
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-foreground-muted">
            Choose genre, frame style, duration, and frame count. Scene
            environment is inferred from your script and applies to every frame.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <SummaryPill>{genreLabel}</SummaryPill>
          <SummaryPill>{settings.durationSec}s</SummaryPill>
          <SummaryPill>{settings.frameCount} frames</SummaryPill>
          <SummaryPill>{getFrameStyleLabel(settings.frameStyle)}</SummaryPill>
          <SummaryPill>~{secPerFrame}s / frame</SummaryPill>
        </div>
      </div>

      <ConfigCard
        title="Scene environment"
        description="Global setting for every frame — inferred from your script. Edit if needed."
        icon={MapPin}
      >
        <label className="block space-y-2">
          <FieldLabel>Environment</FieldLabel>
          <textarea
            rows={4}
            value={settings.sceneEnvironment}
            onChange={(e) =>
              patchSettings({ sceneEnvironment: e.target.value })
            }
            placeholder="e.g. Rainy downtown street at night, neon reflections on wet asphalt, cinematic urban mood"
            className={textareaClass}
          />
        </label>
      </ConfigCard>

      <ConfigCard
        title="Genre"
        description="Sets the overall look, pacing, and camera language."
        icon={Film}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STORYBOARD_GENRES.map((genre) => {
            const selected = settings.genre === genre.id;
            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => patchSettings({ genre: genre.id })}
                style={{ cursor: "pointer" }}
                className={cn(
                  "group relative rounded-md border p-3.5 text-left transition-all",
                  selected
                    ? "border-accent-orange/45 bg-accent-orange/10 ring-1 ring-inset ring-accent-orange/25"
                    : "border-border bg-background hover:border-accent-orange/25"
                )}
              >
                {selected && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent-orange text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <p className="pr-7 text-sm font-medium">{genre.label}</p>
                <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
                  {genre.description}
                </p>
              </button>
            );
          })}
        </div>
      </ConfigCard>

      <ConfigCard
        title="Frame style"
        description="Visual look for every generated storyboard frame image."
        icon={Palette}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STORYBOARD_FRAME_STYLES.map((style) => {
            const selected = settings.frameStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => patchSettings({ frameStyle: style.id })}
                style={{ cursor: "pointer" }}
                className={cn(
                  "group relative rounded-md border p-3.5 text-left transition-all",
                  selected
                    ? "border-accent-orange/45 bg-accent-orange/10 ring-1 ring-inset ring-accent-orange/25"
                    : "border-border bg-background hover:border-accent-orange/25"
                )}
              >
                {selected && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent-orange text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <p className="pr-7 text-sm font-medium">{style.label}</p>
                <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
                  {style.description}
                </p>
              </button>
            );
          })}
        </div>
      </ConfigCard>

      <div className="flex flex-col gap-6">
        <ConfigCard
          title="Duration"
          description="Total runtime for the spot."
          icon={Clock}
        >
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.sec}
                type="button"
                onClick={() => patchSettings({ durationSec: preset.sec })}
                style={{ cursor: "pointer" }}
                className={choiceBtnClass(settings.durationSec === preset.sec)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-4">
            <FieldLabel>Custom (seconds)</FieldLabel>
            <input
              type="number"
              min={5}
              max={600}
              value={settings.durationSec}
              onChange={(e) =>
                patchSettings({ durationSec: Number(e.target.value) || 30 })
              }
              className="h-10 w-24 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-accent-orange/40"
              aria-label="Custom duration in seconds"
            />
          </div>
        </ConfigCard>

        <ConfigCard
          title="Frame count"
          description="How many key storyboard frames to generate."
          icon={LayoutGrid}
        >
          <div className="flex flex-wrap gap-2">
            {STORYBOARD_FRAME_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => patchSettings({ frameCount: count })}
                style={{ cursor: "pointer" }}
                className={choiceBtnClass(settings.frameCount === count)}
              >
                {count} frames
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-foreground-muted">
            ~{secPerFrame}s per frame at {settings.durationSec}s total
          </p>
        </ConfigCard>
      </div>

      {error && (
        <p className="rounded-md border border-accent-orange/30 bg-accent-orange/5 px-4 py-3 text-center text-sm text-accent-orange">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => void generateBreakdown()}
          disabled={isBreakingDown}
          className="w-full bg-accent-orange text-white shadow-[0_4px_24px_rgba(251,146,60,0.25)] hover:bg-accent-orange/90 sm:w-auto"
        >
          {isBreakingDown ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate scene breakdown
        </Button>
      </div>
    </div>
  );
}
