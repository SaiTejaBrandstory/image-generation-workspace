"use client";

import { useState } from "react";
import {
  FolderInput,
  FolderMinus,
  FolderSync,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteConversation,
  patchConversationMeta,
} from "@/lib/conversations-api";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { ProjectPickerDialog } from "./project-picker-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";
import type { Conversation } from "@/types";

interface HistoryItemMenuProps {
  item: Conversation;
  className?: string;
}

export function HistoryItemMenu({ item, className }: HistoryItemMenuProps) {
  const {
    activeConversationId,
    upsertConversationInList,
    removeConversationFromList,
    newConversation,
  } = useWorkspaceStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const inProject = Boolean(item.projectId);
  const isStarred = Boolean(item.starred);

  const applyMeta = async (
    patch: Parameters<typeof patchConversationMeta>[1]
  ) => {
    setBusy(true);
    try {
      await patchConversationMeta(item.id, patch);
      upsertConversationInList({
        ...item,
        ...patch,
        title: patch.title ?? item.title,
        starred: patch.starred ?? item.starred,
        projectId:
          patch.projectId !== undefined ? patch.projectId : item.projectId,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStarToggle = async () => {
    setMenuOpen(false);
    await applyMeta({ starred: !isStarred });
  };

  const handleRemoveFromProject = async () => {
    setMenuOpen(false);
    await applyMeta({ projectId: null });
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteConversation(item.id);
      removeConversationFromList(item.id);
      if (activeConversationId === item.id) {
        newConversation();
      }
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Chat options"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-foreground-muted",
              "opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100",
              "hover:bg-surface-hover hover:text-foreground",
              className
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setRenameOpen(true);
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleStarToggle()}>
            <Star
              className={cn(
                "mr-2 h-3.5 w-3.5",
                isStarred && "fill-amber-400 text-amber-400"
              )}
            />
            {isStarred ? "Unstar" : "Star"}
          </DropdownMenuItem>
          {inProject ? (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setProjectOpen(true);
                }}
              >
                <FolderSync className="mr-2 h-3.5 w-3.5" />
                Change project
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void handleRemoveFromProject()}
              >
                <FolderMinus className="mr-2 h-3.5 w-3.5" />
                Remove from project
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                setProjectOpen(true);
              }}
            >
              <FolderInput className="mr-2 h-3.5 w-3.5" />
              Add to project
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-400 focus:text-red-300"
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameChatDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        initialTitle={item.title}
        saving={busy}
        onSave={async (title) => {
          await applyMeta({ title });
          setRenameOpen(false);
        }}
      />

      <ProjectPickerDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        currentProjectId={item.projectId}
        onSelect={(projectId) => void applyMeta({ projectId })}
      />

      <DeleteChatDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={item.title}
        deleting={busy}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
