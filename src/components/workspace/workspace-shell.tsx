"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./sidebar";
import { ChatThread } from "./chat-thread";
import { PromptComposer } from "./prompt-composer";
import { VisualPanel } from "./visual-panel";
import { ExpandedLayoutView } from "./expanded-layout-view";
import { MobileChrome } from "./mobile-chrome";
import { MobileLayoutsBanner } from "./mobile-layouts-banner";
import { useWorkspaceStore } from "@/store/workspace-store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HistoryLoader } from "@/components/workspace/history-loader";
import type { AuthUser } from "@/types/auth";

interface WorkspaceShellProps {
  user: AuthUser;
}

export function WorkspaceShell({ user }: WorkspaceShellProps) {
  const { expandedVariantId, mobilePanel } = useWorkspaceStore();

  return (
    <TooltipProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground lg:flex-row">
        <HistoryLoader />
        <Sidebar user={user} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MobileChrome />

          <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* —— Mobile: one panel at a time —— */}
            <div className="flex min-h-0 flex-1 flex-col lg:hidden">
              <AnimatePresence mode="wait" initial={false}>
                {mobilePanel === "chat" ? (
                  <motion.main
                    key="chat"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <ChatThread />
                    <MobileLayoutsBanner />
                    <PromptComposer />
                  </motion.main>
                ) : (
                  <motion.div
                    key="layouts"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <VisualPanel className="min-h-0 flex-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* —— Desktop: side by side —— */}
            <main className="hidden min-h-0 w-[min(38vw,420px)] max-w-[420px] shrink-0 flex-col border-r border-border lg:flex">
              <ChatThread />
              <PromptComposer />
            </main>
            <VisualPanel className="hidden min-h-0 min-w-0 flex-1 lg:flex" />
          </div>
        </div>

        <AnimatePresence>
          {expandedVariantId && <ExpandedLayoutView />}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
