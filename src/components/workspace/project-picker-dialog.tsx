"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { notifyProjectsChanged } from "@/lib/projects-events";
import { createProject, fetchProjects } from "@/lib/projects-api";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectId?: string | null;
  onSelect: (projectId: string) => void;
}

export function ProjectPickerDialog({
  open,
  onOpenChange,
  currentProjectId,
  onSelect,
}: ProjectPickerDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchProjects()
      .then(setProjects)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load projects")
      )
      .finally(() => setLoading(false));
  }, [open]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject(name);
      setProjects((prev) => [project, ...prev]);
      notifyProjectsChanged();
      setNewName("");
      onSelect(project.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentProjectId ? "Change project" : "Add to project"}
          </DialogTitle>
          <DialogDescription>
            Choose a project for this chat, or create a new one.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 max-h-48 space-y-1 overflow-y-auto">
          {loading && (
            <p className="text-sm text-foreground-muted">Loading projects…</p>
          )}
          {!loading && projects.length === 0 && (
            <p className="text-sm text-foreground-muted">
              No projects yet. Create one below.
            </p>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p.id);
                onOpenChange(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                p.id === currentProjectId
                  ? "bg-accent-violet/10 ring-1 ring-inset ring-accent-violet/25"
                  : "hover:bg-surface-hover"
              )}
            >
              <span className="truncate font-medium">{p.name}</span>
              {p.conversationCount != null && p.conversationCount > 0 && (
                <span className="ml-2 shrink-0 text-xs text-foreground-muted">
                  {p.conversationCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name"
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent-violet/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
