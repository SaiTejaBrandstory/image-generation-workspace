"use client";

import { Loader2, Sparkles } from "lucide-react";
import {
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  SCENE_EMOTIONS,
  SCENE_TRANSITIONS,
  SHOT_TYPES,
} from "@/lib/storyboard/constants";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import { cn } from "@/lib/utils";
import type { StoryboardScene } from "@/types/storyboard";

const TEXT_FIELDS = [
  ["voiceover", "Voiceover", 3],
  ["visualDescription", "Visual description", 3],
  ["characterActions", "Character actions", 2],
  ["imagePrompt", "AI image prompt", 4],
] as const;

type TextFieldKey = (typeof TEXT_FIELDS)[number][0];

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40";

export function StoryboardSceneEditForm({
  scene,
  onUpdate,
  onRegenerate,
  isRegenerating = false,
  actionsDisabled = false,
  showRegenerate = true,
  compact = false,
}: {
  scene: StoryboardScene;
  onUpdate: (patch: Partial<StoryboardScene>) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  actionsDisabled?: boolean;
  showRegenerate?: boolean;
  /** Smaller text in frame cards */
  compact?: boolean;
}) {
  const normalized = normalizeSceneFields(scene);
  const canRegenerate =
    Boolean(scene.imagePrompt.trim() || scene.visualDescription.trim()) &&
    !isRegenerating &&
    !actionsDisabled;

  return (
    <div className={cn("space-y-4", compact && "text-xs")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SceneField label="Duration (seconds)">
          <input
            type="number"
            min={1}
            value={scene.durationSec}
            onChange={(e) =>
              onUpdate({ durationSec: Number(e.target.value) || 1 })
            }
            className={inputClass}
          />
        </SceneField>
        <SceneField label="Shot type">
          <select
            value={scene.cameraDirection}
            onChange={(e) => onUpdate({ cameraDirection: e.target.value })}
            className={inputClass}
          >
            {SHOT_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </SceneField>
        <SceneField label="Camera angle">
          <select
            value={normalized.cameraAngle}
            onChange={(e) => onUpdate({ cameraAngle: e.target.value })}
            className={inputClass}
          >
            {CAMERA_ANGLES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </SceneField>
        <SceneField label="Camera movement">
          <select
            value={normalized.cameraMovement}
            onChange={(e) => onUpdate({ cameraMovement: e.target.value })}
            className={inputClass}
          >
            {CAMERA_MOVEMENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </SceneField>
        <SceneField label="Emotion">
          <select
            value={scene.emotion}
            onChange={(e) =>
              onUpdate({
                emotion: e.target.value as StoryboardScene["emotion"],
              })
            }
            className={inputClass}
          >
            {SCENE_EMOTIONS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </SceneField>
        <SceneField label="Transition">
          <select
            value={scene.transition}
            onChange={(e) =>
              onUpdate({
                transition: e.target.value as StoryboardScene["transition"],
              })
            }
            className={inputClass}
          >
            {SCENE_TRANSITIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </SceneField>
      </div>

      <div className="grid gap-3">
        {TEXT_FIELDS.map(([key, label, rows]) => (
          <SceneField key={key} label={label}>
            <textarea
              rows={rows}
              value={scene[key as TextFieldKey]}
              onChange={(e) =>
                onUpdate({ [key]: e.target.value } as Partial<StoryboardScene>)
              }
              className={cn(
                inputClass,
                "min-h-[72px] resize-y",
                compact && "text-xs"
              )}
            />
          </SceneField>
        ))}
      </div>

      {showRegenerate && onRegenerate && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <p className="text-[10px] text-foreground-muted">
            Save edits, then regenerate to update the frame image
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            disabled={!canRegenerate}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
              canRegenerate
                ? "bg-accent-orange text-white hover:bg-accent-orange/90"
                : "cursor-not-allowed bg-surface-hover text-foreground-muted/50"
            )}
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Regenerate frame
          </button>
        </div>
      )}
    </div>
  );
}

function SceneField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
