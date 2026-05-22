"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/projects-api";
import type { Project } from "@/types";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: Project) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setError(null);
  }, [open]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject(
        trimmed,
        description.trim() || null
      );
      onCreated(project);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(640px,calc(100vw-2rem))] max-w-[640px] gap-0 overflow-hidden rounded-lg p-0 font-sans shadow-cinematic ring-1 ring-foreground/[0.06]">
        <DialogHeader className="border-b border-border bg-surface-elevated/40 px-8 pb-5 pt-8">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Create a project
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 bg-surface px-8 py-6">
          <div className="space-y-2.5">
            <label
              htmlFor="project-name"
              className="block text-sm font-semibold text-foreground"
            >
              What are you working on?
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name your project"
              className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-sm text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent-violet/50 focus:ring-2 focus:ring-accent-violet/15"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) void handleCreate();
              }}
            />
          </div>

          <div className="space-y-2.5">
            <label
              htmlFor="project-description"
              className="block text-sm font-semibold text-foreground"
            >
              What are you trying to achieve?
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project, goals, subject, etc..."
              rows={5}
              className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent-violet/50 focus:ring-2 focus:ring-accent-violet/15"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2.5 border-t border-border bg-surface-elevated/30 px-8 py-5 sm:justify-end">
          <Button
            type="button"
            variant="cancel"
            className="h-10 min-w-[7.5rem] cursor-pointer rounded-lg px-5 text-sm"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="h-10 min-w-[7.5rem] cursor-pointer rounded-lg px-5 text-sm"
            onClick={() => void handleCreate()}
            disabled={creating || !name.trim()}
          >
            {creating ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
