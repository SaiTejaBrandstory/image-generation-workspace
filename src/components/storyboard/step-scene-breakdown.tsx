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
import { StoryboardImageModelDialog } from "@/components/storyboard/storyboard-image-model-dialog";
import { StoryboardSceneEditForm } from "@/components/storyboard/storyboard-scene-edit-form";
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
    undo,
    redo,
    history,
    historyIndex,
    prevStep,
    generateAllFrames,
    isGeneratingFrames,
    imagePrimaryModel,
    imageAspectRatio,
    setStoryboardImageModel,
    error,
  } = useStoryboardStore();

  const [imageModelDialogOpen, setImageModelDialogOpen] = useState(false);

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
            {scenes.length} scene{scenes.length === 1 ? "" : "s"} · edit and reorder
            scenes before generating frames
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0}>
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          >
            <Redo2 className="h-4 w-4" />
            Redo
          </Button>
          <Button variant="outline" size="sm" onClick={addScene}>
            <Plus className="h-4 w-4" />
            Add scene
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveScene(selected.id, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                  Move up
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveScene(selected.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                  Move down
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => duplicateScene(selected.id)}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
                <Button
                  variant="cancel"
                  size="sm"
                  onClick={() => deleteScene(selected.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            <StoryboardSceneEditForm
              scene={selected}
              onUpdate={(patch) => updateScene(selected.id, patch)}
              showRegenerate={false}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-foreground-muted">
            Add a scene to start editing
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => setImageModelDialogOpen(true)}
          disabled={!scenes.length || isGeneratingFrames}
          className="w-full bg-accent-orange text-white shadow-[0_4px_24px_rgba(251,146,60,0.25)] hover:bg-accent-orange/90 sm:w-auto"
        >
          {isGeneratingFrames ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate storyboards
        </Button>
      </div>

      <StoryboardImageModelDialog
        open={imageModelDialogOpen}
        mode="generate"
        imageModel={imagePrimaryModel}
        imageAspectRatio={imageAspectRatio}
        frameCount={scenes.length}
        onConfirm={(model, aspectRatio) => {
          setImageModelDialogOpen(false);
          setStoryboardImageModel(model, aspectRatio);
          void generateAllFrames();
        }}
        onCancel={() => setImageModelDialogOpen(false)}
      />
    </div>
  );
}
