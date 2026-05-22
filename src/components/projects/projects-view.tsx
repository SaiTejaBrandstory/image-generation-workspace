"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FolderKanban, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectCardMenu } from "@/components/projects/project-card-menu";
import {
  ProjectsContent,
  ProjectsPageBody,
  ProjectsPanel,
} from "@/components/projects/projects-page-chrome";
import {
  deleteProject,
  fetchProjects,
  updateProject,
} from "@/lib/projects-api";
import {
  notifyProjectsChanged,
  PROJECTS_CHANGED_EVENT,
} from "@/lib/projects-events";
import { formatUpdatedAgo } from "@/lib/format-relative-time";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

type SortKey = "activity" | "name";

export function ProjectsView() {
  const router = useRouter();
  const conversations = useWorkspaceStore((s) => s.conversations);
  const historyLoaded = useWorkspaceStore((s) => s.historyLoaded);
  const historyLoading = useWorkspaceStore((s) => s.historyLoading);
  const loadHistory = useWorkspaceStore((s) => s.loadHistory);
  const upsertConversationInList = useWorkspaceStore(
    (s) => s.upsertConversationInList
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("activity");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProjects();
      setProjects(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const refresh = () => void loadProjects();
    window.addEventListener(PROJECTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, refresh);
  }, [loadProjects]);

  useEffect(() => {
    if (!historyLoaded && !historyLoading) {
      void loadHistory();
    }
  }, [historyLoaded, historyLoading, loadHistory]);

  const chatsByProject = (projectId: string) =>
    conversations.filter((c) => c.projectId === projectId);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = projects;
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [projects, searchQuery, sortBy]);

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev]);
    notifyProjectsChanged();
  };

  const handleSaveRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    try {
      const updated = await updateProject(id, { name });
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (
      !confirm(
        "Delete this project? Chats will stay but be removed from the project."
      )
    ) {
      return;
    }
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      for (const chat of conversations.filter((c) => c.projectId === id)) {
        upsertConversationInList({ id: chat.id, projectId: null });
      }
      notifyProjectsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <ProjectsPageBody>
      <ProjectsContent>
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">
              Workspace
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Projects
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 text-sm shadow-sm">
              <span className="text-foreground-muted">Sort by</span>
              <div className="relative h-full">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="h-full appearance-none bg-transparent pr-6 text-sm font-medium text-foreground outline-none"
                  aria-label="Sort projects"
                >
                  <option value="activity">Activity</option>
                  <option value="name">Name</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              className="h-10 shrink-0 cursor-pointer rounded-lg px-4 text-sm"
              onClick={() => setCreateOpen(true)}
            >
              New project
            </Button>
          </div>
        </header>

        {/* Search */}
        <ProjectsPanel className="mb-8 p-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects…"
              className="h-12 w-full rounded-lg bg-transparent pl-11 pr-4 text-sm text-foreground placeholder:text-foreground-muted outline-none"
            />
          </div>
        </ProjectsPanel>

        {error && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {loading && (
          <p className="text-sm text-foreground-muted">Loading projects…</p>
        )}

        {!loading && projects.length === 0 && (
          <ProjectsPanel className="p-8 text-center">
            <FolderKanban className="mx-auto h-10 w-10 text-foreground-muted/40" />
            <p className="mt-4 text-sm text-foreground-muted">
              No projects yet. Click{" "}
              <strong className="font-medium text-foreground">New project</strong>{" "}
              or add chats from the sidebar menu.
            </p>
          </ProjectsPanel>
        )}

        {!loading &&
          projects.length > 0 &&
          filteredProjects.length === 0 && (
            <ProjectsPanel className="p-8 text-center">
              <p className="text-sm text-foreground-muted">
                No projects match your search.
              </p>
            </ProjectsPanel>
          )}

        {/* Grid */}
        {!loading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {filteredProjects.map((project) => {
              const chatCount =
                project.conversationCount ??
                chatsByProject(project.id).length;
              const isEditing = editingId === project.id;

              return (
                <article
                  key={project.id}
                  role={isEditing ? undefined : "button"}
                  tabIndex={isEditing ? undefined : 0}
                  onClick={(e) => {
                    if (isEditing) return;
                    const target = e.target as Node;
                    const menuZone = (e.currentTarget as HTMLElement).querySelector(
                      "[data-project-menu]"
                    );
                    if (menuZone?.contains(target)) return;
                    if (
                      (e.currentTarget as HTMLElement).querySelector(
                        "[data-project-action]"
                      )?.contains(target)
                    ) {
                      return;
                    }
                    router.push(`/projects/${project.id}`);
                  }}
                  onKeyDown={(e) => {
                    if (
                      !isEditing &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      router.push(`/projects/${project.id}`);
                    }
                  }}
                  className={cn(
                    "group relative flex min-h-[132px] flex-col rounded-lg border border-border bg-surface p-5 shadow-sm",
                    "ring-1 ring-foreground/[0.04] transition-colors duration-150",
                    isEditing
                      ? "cursor-default"
                      : "cursor-pointer hover:border-foreground/20 hover:bg-surface-elevated/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                        "bg-surface-elevated ring-1 ring-border"
                      )}
                    >
                      <FolderKanban className="h-4 w-4 text-foreground-muted" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        {isEditing ? (
                          <div
                            data-project-action
                            className="flex min-w-0 flex-1 gap-2"
                          >
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-accent-violet/40"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  void handleSaveRename(project.id);
                                }
                                if (e.key === "Escape") setEditingId(null);
                              }}
                            />
                            <Button
                              type="button"
                              variant="cancel"
                              size="sm"
                              data-project-action
                              className="shrink-0 cursor-pointer"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setEditingId(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              data-project-action
                              className="shrink-0 cursor-pointer"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                void handleSaveRename(project.id);
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                            <h2 className="pointer-events-none min-w-0 flex-1 truncate text-base font-semibold leading-snug text-foreground">
                              {project.name}
                            </h2>
                            <ProjectCardMenu
                              onRename={() => {
                                setEditingId(project.id);
                                setEditName(project.name);
                              }}
                              onDelete={() =>
                                void handleDeleteProject(project.id)
                              }
                            />
                          </div>
                        )}
                      </div>

                      {project.description && !isEditing && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="mt-auto flex items-center gap-2 pt-4 pl-[52px]">
                      <span className="text-xs text-foreground-muted">
                        {formatUpdatedAgo(project.updatedAt)}
                      </span>
                      {chatCount > 0 && (
                        <>
                          <span className="text-foreground-muted/40">·</span>
                          <span className="inline-flex items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 text-xs text-foreground-muted ring-1 ring-border">
                            <MessageSquare className="h-3 w-3" />
                            {chatCount}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-12 text-center">
          <Link
            href="/"
            className="text-sm text-foreground-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Back to workspace
          </Link>
        </p>
      </ProjectsContent>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleProjectCreated}
      />
    </ProjectsPageBody>
  );
}
