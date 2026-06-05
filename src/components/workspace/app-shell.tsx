"use client";

import { Sidebar } from "@/components/workspace/sidebar";
import { HistoryLoader } from "@/components/workspace/history-loader";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AuthUser } from "@/types/auth";

interface AppShellProps {
  user: AuthUser;
  children: React.ReactNode;
}

/** Shared shell — sidebar persists across workspace tool routes. */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <TooltipProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground lg:flex-row">
        <HistoryLoader />
        <Sidebar user={user} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </TooltipProvider>
  );
}
