"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const MENU_CLASS =
  "z-[100] w-36 min-w-0 max-w-[9rem] overflow-hidden rounded-md border border-border bg-surface-elevated p-1 shadow-cinematic";

interface ProjectCardMenuProps {
  onRename: () => void;
  onDelete: () => void;
}

export function ProjectCardMenu({ onRename, onDelete }: ProjectCardMenuProps) {
  const stopBubble = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      data-project-menu
      className="relative z-10 shrink-0"
      onClick={stopBubble}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      onKeyDown={stopBubble}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Project options"
            className={cn(
              "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-muted",
              "opacity-0 transition-opacity hover:bg-surface-hover hover:text-foreground",
              "group-hover:opacity-100 data-[state=open]:opacity-100"
            )}
          >
            <MoreHorizontal className="h-4 w-4 pointer-events-none" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={MENU_CLASS}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onSelect={onRename} className="cursor-pointer">
            <Pencil className="mr-2 h-3.5 w-3.5 shrink-0" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-red-400 focus:text-red-300"
            onSelect={onDelete}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5 shrink-0" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
