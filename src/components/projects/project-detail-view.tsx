"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderKanban, MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoryListItem } from "@/components/workspace/history-list-item";
import {
  ProjectsContent,
  ProjectsPageBody,
  ProjectsSurface,
} from "@/components/projects/projects-page-chrome";
import { fetchProject, updateProject } from "@/lib/projects-api";
import { notifyProjectsChanged } from "@/lib/projects-events";
import { formatUpdatedAgo } from "@/lib/format-relative-time";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Project } from "@/types";

interface ProjectDetailViewProps {
  projectId: string;
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const router = useRouter();
  const conversations = useWorkspaceStore((s) => s.conversations);
  const activeConversationId = useWorkspaceStore((s) => s.activeConversationId);
  const historyLoaded = useWorkspaceStore((s) => s.historyLoaded);
  const historyLoading = useWorkspaceStore((s) => s.historyLoading);
  const loadHistory = useWorkspaceStore((s) => s.loadHistory);
  const selectConversation = useWorkspaceStore((s) => s.selectConversation);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProject(projectId);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project not found");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!historyLoaded && !historyLoading) {
      void loadHistory();
    }
  }, [historyLoaded, historyLoading, loadHistory]);

  const projectChats = useMemo(() => {
    return conversations
      .filter((c) => c.projectId === projectId)
      .sort(
        (a, b) =>
          (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)
      );
  }, [conversations, projectId]);

  const startEditing = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProject(projectId, {
        name,
        description: editDescription.trim() || null,
      });
      setProject(updated);
      setEditing(false);
      notifyProjectsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const openChat = (id: string) => {
    void selectConversation(id);
    router.push("/");
  };

  return (
    <ProjectsPageBody>
      <ProjectsContent narrow>
        <Link
          href="/projects"
          className="mb-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-surface-elevated/80 px-3.5 py-1.5 text-sm text-foreground-muted shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All projects
        </Link>

        {loading && (
          <p className="text-sm text-foreground-muted">Loading project…</p>
        )}

        {error && !editing && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {project && !loading && (
          <>
            <ProjectsSurface className="mb-8 p-6">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-elevated shadow-sm">
                  <FolderKanban className="h-5 w-5 text-foreground-muted" />
                </div>

                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label
                          htmlFor="edit-project-name"
                          className="text-xs font-medium text-foreground-muted"
                        >
                          Project name
                        </label>
                        <input
                          id="edit-project-name"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-11 w-full rounded-lg bg-surface-elevated px-3 text-sm text-foreground outline-none ring-1 ring-foreground/10 focus:ring-accent-violet/30"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelEditing();
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="edit-project-description"
                          className="text-xs font-medium text-foreground-muted"
                        >
                          Description
                        </label>
                        <textarea
                          id="edit-project-description"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={4}
                          placeholder="What is this project about?"
                          className="w-full resize-none rounded-lg bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted outline-none ring-1 ring-foreground/10 focus:ring-accent-violet/30"
                        />
                      </div>
                      {error && (
                        <p className="text-sm text-red-400" role="alert">
                          {error}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="cancel"
                          size="sm"
                          className="h-9 cursor-pointer rounded-lg px-4"
                          onClick={cancelEditing}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 cursor-pointer rounded-lg px-4"
                          onClick={() => void handleSave()}
                          disabled={saving || !editName.trim()}
                        >
                          {saving ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                          {project.name}
                        </h1>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-lg px-3"
                          onClick={startEditing}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </div>
                      {project.description ? (
                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                          {project.description}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm italic text-foreground-muted/70">
                          No description yet. Click Edit to add one.
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                        <span>{formatUpdatedAgo(project.updatedAt)}</span>
                        {projectChats.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-elevated px-2 py-0.5">
                            <MessageSquare className="h-3 w-3" />
                            {projectChats.length} chat
                            {projectChats.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </ProjectsSurface>

            <ProjectsSurface className="overflow-hidden">
              <p className="px-5 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">
                Chats in this project
              </p>

              <div className="px-3 pb-4 pt-1">
                {historyLoading && (
                  <p className="px-2 py-6 text-center text-sm text-foreground-muted">
                    Loading chats…
                  </p>
                )}

                {!historyLoading && projectChats.length === 0 && (
                  <div className="px-2 py-10 text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-foreground-muted/30" />
                    <p className="mt-3 text-sm text-foreground-muted">
                      No chats in this project yet. Use{" "}
                      <strong className="font-medium text-foreground">
                        Add to project
                      </strong>{" "}
                      from a chat&apos;s menu in the sidebar.
                    </p>
                  </div>
                )}

                {!historyLoading && projectChats.length > 0 && (
                  <div className="space-y-2">
                    {projectChats.map((chat) => (
                      <HistoryListItem
                        key={chat.id}
                        item={chat}
                        isActive={activeConversationId === chat.id}
                        isSearching={false}
                        onSelect={openChat}
                        variant="panel"
                        timestampLabel={formatUpdatedAgo(
                          chat.updatedAt ?? chat.createdAt
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ProjectsSurface>
          </>
        )}
      </ProjectsContent>
    </ProjectsPageBody>
  );
}
