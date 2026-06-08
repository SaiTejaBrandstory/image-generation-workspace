"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryboardSceneEditForm } from "@/components/storyboard/storyboard-scene-edit-form";
import type { StoryboardScene } from "@/types/storyboard";

export function StoryboardSceneEditDialog({
  scene,
  open,
  onOpenChange,
  onUpdate,
  onRegenerate,
  isRegenerating,
  actionsDisabled,
}: {
  scene: StoryboardScene | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (patch: Partial<StoryboardScene>) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  actionsDisabled: boolean;
}) {
  if (!scene) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[min(720px,calc(100vw-2rem))] max-h-[min(90vh,880px)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pb-4 pt-6">
          <DialogTitle>
            Edit scene {String(scene.sceneNumber).padStart(2, "0")}
          </DialogTitle>
          <DialogDescription>
            Update shot details, prompts, and regenerate the frame without
            leaving the storyboard viewer.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <StoryboardSceneEditForm
            scene={scene}
            onUpdate={onUpdate}
            onRegenerate={onRegenerate}
            isRegenerating={isRegenerating}
            actionsDisabled={actionsDisabled}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
