"use client";

import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./sidebar";
import { ChatThread } from "./chat-thread";
import { PromptComposer } from "./prompt-composer";
import { VisualPanel } from "./visual-panel";
import { ExpandedLayoutView } from "./expanded-layout-view";
import { useWorkspaceStore } from "@/store/workspace-store";
import { TooltipProvider } from "@/components/ui/tooltip";

export function WorkspaceShell() {
  const { expandedVariantId, theme } = useWorkspaceStore();

  return (
    <TooltipProvider>
      <div
        data-theme={theme}
        className="flex h-screen w-screen overflow-hidden bg-background text-foreground"
      >
        <Sidebar />

        <main className="flex min-w-[300px] w-[min(38vw,420px)] shrink-0 flex-col border-r border-border">
          <ChatThread />
          <PromptComposer />
        </main>

        <VisualPanel className="min-w-0 flex-1" />

        <AnimatePresence>
          {expandedVariantId && <ExpandedLayoutView />}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
