"use client";

import { Sidebar } from "@/components/workspace/sidebar";
import { HistoryLoader } from "@/components/workspace/history-loader";
import { ProjectsView } from "@/components/projects/projects-view";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AuthUser } from "@/types/auth";

interface ProjectsShellProps {
  user: AuthUser;
  children?: React.ReactNode;
}

export function ProjectsShell({ user, children }: ProjectsShellProps) {
  return (
    <TooltipProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background font-sans text-foreground">
        <HistoryLoader />
        <Sidebar user={user} />
        {children ?? <ProjectsView />}
      </div>
    </TooltipProvider>
  );
}
