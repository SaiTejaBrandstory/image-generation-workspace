"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  SCENE_EMOTIONS,
  SCENE_TRANSITIONS,
  SHOT_TYPES,
} from "@/lib/storyboard/constants";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";

export function StepSceneBreakdown() {
  const {
    scenes,
    selectedSceneId,
    setSelectedSceneId,
    updateScene,
    addScene,
    deleteScene,
    duplicateScene,
    moveScene,
    mergeScenes,
    splitScene,
    bulkPasteScenes,
    undo,
    redo,
    history,
    historyIndex,
    prevStep,
    generateAllFrames,
    isGeneratingFrames,
    error,
  } = useStoryboardStore();

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const selected =
    scenes.find((s) => s.id === selectedSceneId) ?? scenes[0] ?? null;

  useEffect(() => {
    if (!selectedSceneId && scenes[0]) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [selectedSceneId, scenes, setSelectedSceneId]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Scene Breakdown Editor
          </h1>
          <p className="text-sm text-foreground-muted">
            {scenes.length} scene{scenes.length === 1 ? "" : "s"} · edit, reorder,
            or paste manual breakdowns
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={addScene}>
            <Plus className="h-4 w-4" />
            Add scene
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void generateAllFrames()}
            disabled={!scenes.length || isGeneratingFrames}
          >
            {isGeneratingFrames ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Storyboards
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-accent-orange/30 bg-accent-orange/5 px-4 py-3 text-sm text-accent-orange">
          {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="flex min-h-0 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-2">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => setSelectedSceneId(scene.id)}
              className={cn(
                "rounded-md border px-3 py-2.5 text-left transition-colors",
                selected?.id === scene.id
                  ? "border-accent-orange/35 bg-accent-orange/10"
                  : "border-transparent hover:border-border/60 hover:bg-surface-hover"
              )}
            >
              <p className="text-xs font-semibold text-accent-orange">
                Scene {String(scene.sceneNumber).padStart(2, "0")}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-foreground-muted">
                {scene.voiceover || "Empty scene"}
              </p>
              <p className="mt-1 text-[10px] tabular-nums text-foreground-muted">
                {scene.durationSec}s · {scene.cameraDirection}
              </p>
            </button>
          ))}
        </aside>

        {selected ? (
          <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                Scene {String(selected.sceneNumber).padStart(2, "0")}
              </h2>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => moveScene(selected.id, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => moveScene(selected.id, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => duplicateScene(selected.id)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => splitScene(selected.id)}>
                  Split
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = scenes.find(
                      (s) => s.sceneNumber === selected.sceneNumber + 1
                    );
                    if (next) mergeScenes(selected.id, next.id);
                  }}
                >
                  Merge next
                </Button>
                <Button
                  variant="cancel"
                  size="sm"
                  onClick={() => deleteScene(selected.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration (seconds)">
                <input
                  type="number"
                  min={1}
                  value={selected.durationSec}
                  onChange={(e) =>
                    updateScene(selected.id, {
                      durationSec: Number(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40"
                />
              </Field>
              <Field label="Shot type">
                <select
                  value={selected.cameraDirection}
                  onChange={(e) =>
                    updateScene(selected.id, { cameraDirection: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40"
                >
                  {SHOT_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Camera angle">
                <select
                  value={normalizeSceneFields(selected).cameraAngle}
                  onChange={(e) =>
                    updateScene(selected.id, { cameraAngle: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40"
                >
                  {CAMERA_ANGLES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Camera movement">
                <select
                  value={normalizeSceneFields(selected).cameraMovement}
                  onChange={(e) =>
                    updateScene(selected.id, { cameraMovement: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40"
                >
                  {CAMERA_MOVEMENTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Emotion">
                <select
                  value={selected.emotion}
                  onChange={(e) =>
                    updateScene(selected.id, {
                      emotion: e.target.value as typeof selected.emotion,
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40"
                >
                  {SCENE_EMOTIONS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Transition">
                <select
                  value={selected.transition}
                  onChange={(e) =>
                    updateScene(selected.id, {
                      transition: e.target.value as typeof selected.transition,
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40"
                >
                  {SCENE_TRANSITIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4 grid gap-4">
              {(
                [
                  ["voiceover", "Voiceover", 3],
                  ["visualDescription", "Visual description", 3],
                  ["characterActions", "Character actions", 2],
                  ["environment", "Environment", 2],
                  ["imagePrompt", "AI image prompt", 4],
                ] as const
              ).map(([key, label, rows]) => (
                <Field key={key} label={label}>
                  <textarea
                    rows={rows}
                    value={selected[key]}
                    onChange={(e) =>
                      updateScene(selected.id, { [key]: e.target.value })
                    }
                    className="min-h-[72px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-orange/40"
                  />
                </Field>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-foreground-muted">
            Add a scene to start editing
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated p-4 pb-12">
        <button
          type="button"
          onClick={() => setBulkOpen((v) => !v)}
          className="text-sm font-medium text-accent-orange"
        >
          {bulkOpen ? "Hide" : "Bulk paste scene breakdowns"}
        </button>
        {bulkOpen && (
          <div className="mt-3 space-y-2">
            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Paste one scene per paragraph…"
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                bulkPasteScenes(bulkText);
                setBulkText("");
                setBulkOpen(false);
              }}
            >
              Apply bulk paste
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
      </div>
    </div>
  );
}

function Field({
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
