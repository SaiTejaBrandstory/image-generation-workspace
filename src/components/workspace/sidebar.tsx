"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchConversationHistory } from "@/lib/conversations-api";
import { useIsDesktop } from "@/lib/use-media-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { UserMenu } from "@/components/auth/user-menu";
import type { AuthUser } from "@/types/auth";
import type { Conversation } from "@/types";

interface SidebarProps {
  user: AuthUser;
}

export function Sidebar({ user }: SidebarProps) {
  const isDesktop = useIsDesktop();
  const {
    sidebarExpanded,
    toggleSidebar,
    newConversation,
    conversations,
    selectConversation,
    activeConversationId,
    historyLoading,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useWorkspaceStore();

  const [historySearch, setHistorySearch] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(
    null
  );
  const [searching, setSearching] = useState(false);

  const isSearching = historySearch.trim().length > 0;
  const displayed = isSearching ? (searchResults ?? []) : conversations;
  const showExpanded = isDesktop ? sidebarExpanded : true;

  useEffect(() => {
    const query = historySearch.trim();
    if (!query) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchConversationHistory(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [historySearch]);

  const handleSelectConversation = (id: string) => {
    void selectConversation(id);
    if (!isDesktop) setMobileSidebarOpen(false);
  };

  const desktopWidth = sidebarExpanded ? 280 : 72;

  return (
    <TooltipProvider>
      <AnimatePresence>
        {mobileSidebarOpen && !isDesktop && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={
          isDesktop
            ? { width: desktopWidth, x: 0 }
            : {
                x: mobileSidebarOpen ? 0 : "-100%",
              }
        }
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={cn(
          "flex h-full flex-col border-r border-border bg-surface z-50",
          "fixed inset-y-0 left-0 w-[min(280px,88vw)] max-w-[280px]",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          "lg:relative lg:z-auto lg:max-w-none lg:shrink-0 lg:pt-0 lg:pb-0"
        )}
        style={isDesktop ? { width: desktopWidth } : undefined}
      >
        <div className="flex flex-col gap-1 p-3">
          {!isDesktop && (
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">History</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close history"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <button
            onClick={() => {
              if (isDesktop) toggleSidebar();
            }}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-foreground hover:bg-surface-elevated transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-violet to-accent-blue">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence>
              {showExpanded && (
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
              onClick={() => {
                newConversation();
                if (!isDesktop) setMobileSidebarOpen(false);
              }}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors",
                showExpanded ? "px-3" : "justify-center"
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {showExpanded && <span className="text-sm">New generation</span>}
            </button>
          </Tooltip>

          {showExpanded ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history…"
                className="h-10 w-full rounded-xl border border-border bg-surface-elevated pl-9 pr-8 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-accent-violet/40"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <Tooltip content="Expand to search history">
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-10 w-full items-center justify-center rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors"
              >
                <Search className="h-4 w-4 shrink-0" />
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {showExpanded && (
            <p className="px-2 pb-2 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              {isSearching ? "Results" : "History"}
            </p>
          )}
          <div className="space-y-0.5">
            {showExpanded && searching && (
              <p className="px-3 py-2 text-xs text-foreground-muted">
                Searching…
              </p>
            )}
            {showExpanded &&
              !searching &&
              !historyLoading &&
              displayed.length === 0 && (
                <p className="px-3 py-2 text-xs text-foreground-muted">
                  {isSearching
                    ? "No matches for your search."
                    : "No generations yet. Create one to see it here."}
                </p>
              )}
            {historyLoading && !isSearching && showExpanded && (
              <p className="px-3 py-2 text-xs text-foreground-muted">
                Loading history…
              </p>
            )}
            {showExpanded &&
              displayed.map((item) => {
                const isActive = activeConversationId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectConversation(item.id)}
                    className={cn(
                      "flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150",
                      isActive
                        ? "bg-accent-violet/10 text-foreground ring-1 ring-inset ring-accent-violet/25"
                        : "text-foreground-muted hover:bg-surface-elevated/80 hover:text-foreground"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate leading-snug",
                          isActive ? "font-medium" : "font-normal"
                        )}
                      >
                        {item.title}
                      </span>
                      {isSearching &&
                        item.prompt &&
                        item.prompt !== item.title && (
                          <span className="mt-0.5 block truncate text-[11px] font-normal text-foreground-muted/80">
                            {item.prompt}
                          </span>
                        )}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="border-t border-border p-2">
          <UserMenu user={user} expanded={showExpanded} />
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
