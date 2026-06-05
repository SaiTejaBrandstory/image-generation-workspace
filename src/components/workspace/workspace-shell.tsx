"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChatThread } from "./chat-thread";
import { PromptComposer } from "./prompt-composer";
import { VisualPanel } from "./visual-panel";
import { ExpandedLayoutView } from "./expanded-layout-view";
import { MobileChrome } from "./mobile-chrome";
import { MobileLayoutsBanner } from "./mobile-layouts-banner";
import { useWorkspaceStore } from "@/store/workspace-store";

export function WorkspaceShell() {
  const { expandedVariantId, mobilePanel } = useWorkspaceStore();

  return (
    <>
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
                <div className="composer-panel min-h-0 shrink-0">
                  <PromptComposer />
                </div>
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
        <main className="hidden min-h-0 w-[min(38vw,420px)] max-w-[420px] shrink-0 flex-col overflow-hidden border-r border-border lg:flex">
          <ChatThread />
          <div className="composer-panel min-h-0 shrink-0">
            <PromptComposer />
          </div>
        </main>
        <VisualPanel className="hidden min-h-0 min-w-0 flex-1 lg:flex" />
      </div>

      <AnimatePresence>
        {expandedVariantId && <ExpandedLayoutView />}
      </AnimatePresence>
    </>
  );
}
