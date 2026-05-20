"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Sparkles,
  Star,
  Settings,
  CreditCard,
  Code2,
  Sun,
  Moon,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_CONVERSATIONS } from "@/lib/constants";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

export function Sidebar() {
  const {
    sidebarExpanded,
    toggleSidebar,
    theme,
    setTheme,
    newConversation,
    conversations,
    selectConversation,
    activeConversationId,
    activeBrand,
  } = useWorkspaceStore();

  const width = sidebarExpanded ? 280 : 72;

  return (
    <TooltipProvider>
      <motion.aside
        animate={{ width }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="relative flex h-full shrink-0 flex-col border-r border-border bg-surface"
      >
        <div className="flex flex-col gap-1 p-3">
          <button
            onClick={toggleSidebar}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-foreground hover:bg-surface-elevated transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-violet to-accent-blue">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence>
              {sidebarExpanded && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-semibold tracking-tight"
                >
                  Brandwise
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <Tooltip content="New generation">
            <button
              onClick={newConversation}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors",
                sidebarExpanded ? "px-3" : "justify-center"
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {sidebarExpanded && <span className="text-sm">New generation</span>}
            </button>
          </Tooltip>

          <Tooltip content="Search conversations">
            <button
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors",
                sidebarExpanded ? "px-3" : "justify-center"
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              {sidebarExpanded && <span className="text-sm">Search</span>}
            </button>
          </Tooltip>
        </div>

        {sidebarExpanded && (
          <div className="px-4 py-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Active Brand
            </p>
            <button className="mt-2 flex w-full items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2.5 text-left hover:bg-surface-hover transition-colors">
              <FolderOpen className="h-4 w-4 text-accent-violet shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {activeBrand?.name ?? "No brand"}
                </p>
                <p className="truncate text-xs text-foreground-muted">
                  {activeBrand?.industry ?? "Select brand"}
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-foreground-muted" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sidebarExpanded && (
            <p className="px-2 pb-2 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              History
            </p>
          )}
          <div className="space-y-0.5">
            {(conversations.length > 0
              ? conversations.map((c) => ({
                  id: c.id,
                  title: c.title,
                  starred: c.starred,
                }))
              : SAMPLE_CONVERSATIONS
            ).map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  conversations.length > 0
                    ? selectConversation(item.id)
                    : undefined
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl py-2.5 text-left text-sm transition-colors hover:bg-surface-elevated",
                  sidebarExpanded ? "px-3" : "justify-center px-0",
                  activeConversationId === item.id && "bg-surface-elevated"
                )}
              >
                {item.starred && (
                  <Star className="h-3 w-3 shrink-0 fill-accent-orange text-accent-orange" />
                )}
                {sidebarExpanded ? (
                  <span className="truncate text-foreground-muted hover:text-foreground">
                    {item.title}
                  </span>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-surface-hover" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-2 space-y-0.5">
          {[
            { icon: Settings, label: "Settings" },
            { icon: CreditCard, label: "Billing" },
            { icon: Code2, label: "API" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors",
                sidebarExpanded ? "px-3" : "justify-center"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {sidebarExpanded && <span className="text-sm">{label}</span>}
            </button>
          ))}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors",
              sidebarExpanded ? "px-3" : "justify-center"
            )}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 shrink-0" />
            ) : (
              <Moon className="h-4 w-4 shrink-0" />
            )}
            {sidebarExpanded && (
              <span className="text-sm">
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            )}
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
