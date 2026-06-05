"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DURATION_PRESETS,
  STORYBOARD_FRAME_COUNTS,
  STORYBOARD_GENRES,
  STORYBOARD_PLATFORMS,
} from "@/lib/storyboard/constants";
import type { StoryboardFrameCount } from "@/types/storyboard";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";

export function StepProjectConfig() {
  const {
    settings,
    patchSettings,
    prevStep,
    generateBreakdown,
    isBreakingDown,
    error,
  } = useStoryboardStore();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Project Configuration
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Genre and duration shape camera language, pacing, and visual prompts.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          Genre
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {STORYBOARD_GENRES.map((genre) => (
            <button
              key={genre.id}
              type="button"
              onClick={() => patchSettings({ genre: genre.id })}
              className={cn(
                "rounded-md border p-3 text-left transition-all",
                settings.genre === genre.id
                  ? "border-accent-orange/40 bg-accent-orange/10 ring-1 ring-inset ring-accent-orange/25"
                  : "border-border bg-surface-elevated hover:border-accent-orange/20"
              )}
            >
              <p className="text-sm font-medium">{genre.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
                {genre.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          Duration
        </h2>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.sec}
              type="button"
              onClick={() => patchSettings({ durationSec: preset.sec })}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                settings.durationSec === preset.sec
                  ? "bg-accent-orange text-white"
                  : "bg-surface-elevated text-foreground-muted hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
          <input
            type="number"
            min={5}
            max={600}
            value={settings.durationSec}
            onChange={(e) =>
              patchSettings({ durationSec: Number(e.target.value) || 30 })
            }
            className="h-10 w-24 rounded-md border border-border bg-surface-elevated px-3 text-sm outline-none focus:border-accent-orange/40"
            aria-label="Custom duration in seconds"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          Number of frames
        </h2>
        <div className="flex flex-wrap gap-2">
          {STORYBOARD_FRAME_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() =>
                patchSettings({ frameCount: count as StoryboardFrameCount })
              }
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                settings.frameCount === count
                  ? "bg-accent-orange text-white"
                  : "bg-surface-elevated text-foreground-muted hover:text-foreground"
              )}
            >
              {count} frames
            </button>
          ))}
        </div>
        <p className="text-[11px] text-foreground-muted">
          {settings.frameCount === 6
            ? "Six keyframes — ideal for 30s spots (~5s per frame)."
            : "Four keyframes — tighter story beats for shorter edits."}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["targetAudience", "Target Audience", "e.g. Young professionals"],
            ["visualStyle", "Visual Style", "e.g. Minimal, cinematic"],
            ["mood", "Mood", "e.g. Energetic, calm"],
            ["brandTone", "Brand Tone", "e.g. Premium, playful"],
          ] as const
        ).map(([key, label, placeholder]) => (
          <label key={key} className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              {label}
            </span>
            <input
              value={settings[key]}
              onChange={(e) => patchSettings({ [key]: e.target.value })}
              placeholder={placeholder}
              className="h-11 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm outline-none focus:border-accent-orange/40"
            />
          </label>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          Platform
        </h2>
        <div className="flex flex-wrap gap-2">
          {STORYBOARD_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => patchSettings({ platform: platform.id })}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                settings.platform === platform.id
                  ? "bg-accent-orange/15 text-accent-orange ring-1 ring-inset ring-accent-orange/30"
                  : "bg-surface-elevated text-foreground-muted hover:text-foreground"
              )}
            >
              {platform.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-md border border-accent-orange/30 bg-accent-orange/5 px-4 py-3 text-sm text-accent-orange">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => void generateBreakdown()}
          disabled={isBreakingDown}
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
