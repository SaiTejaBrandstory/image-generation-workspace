"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchConversationHistory } from "@/lib/conversations-api";
import { useIsDesktop } from "@/lib/use-media-query";
import { useStoryboardStore } from "@/store/storyboard-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { UserMenu } from "@/components/auth/user-menu";
import {
  conversationMatchesMediaFilter,
  HistoryMediaFilterToggle,
  type HistoryMediaFilter,
} from "@/components/workspace/history-media-filter";
import { HistoryListItem } from "@/components/workspace/history-list-item";
import {
  WorkspaceToolsNav,
  prefetchVideoModels,
} from "@/components/workspace/workspace-tools-nav";
import { isStoryboardTool, type WorkspaceToolId } from "@/lib/workspace-tools";
import type { AuthUser } from "@/types/auth";
import type { Conversation } from "@/types";

interface SidebarProps {
  user: AuthUser;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isProjectsPage = pathname.startsWith("/projects");
  const isWorkspaceHome = pathname === "/";
  const isStoryboardPage = pathname.startsWith("/storyboard");
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
    setMobilePanel,
    setMediaType,
    mediaType,
    isGenerating,
  } = useWorkspaceStore();

  const resetStoryboard = useStoryboardStore((s) => s.resetStoryboard);
  const loadStoryboardConversation = useStoryboardStore(
    (s) => s.loadStoryboardConversation
  );
  const storyboardConversationId = useStoryboardStore((s) => s.conversationId);

  const startNewChatWithTool = useCallback(
    (tool: WorkspaceToolId) => {
      if (isGenerating) return;
      newConversation();
      if (isStoryboardTool(tool)) {
        resetStoryboard();
        if (!isStoryboardPage) router.push("/storyboard");
        if (!isDesktop) setMobileSidebarOpen(false);
        return;
      }
      setMediaType(tool);
      if (tool === "video") prefetchVideoModels();
      if (!isWorkspaceHome) router.push("/");
      setMobilePanel(tool === "video" ? "layouts" : "chat");
      if (!isDesktop) setMobileSidebarOpen(false);
    },
    [
      isGenerating,
      resetStoryboard,
      isStoryboardPage,
      isWorkspaceHome,
      isDesktop,
      newConversation,
      router,
      setMediaType,
      setMobilePanel,
      setMobileSidebarOpen,
    ]
  );

  const startNewGeneration = useCallback(() => {
    if (isGenerating) return;
    if (isStoryboardPage) {
      startNewChatWithTool("storyboard");
      return;
    }
    startNewChatWithTool(mediaType);
  }, [isGenerating, isStoryboardPage, mediaType, startNewChatWithTool]);

  const [historySearch, setHistorySearch] = useState("");
  const [historyMediaFilter, setHistoryMediaFilter] =
    useState<HistoryMediaFilter>("all");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(
    null
  );
  const [searching, setSearching] = useState(false);

  const isSearching = historySearch.trim().length > 0;
  const displayed = isSearching ? (searchResults ?? []) : conversations;
  const filteredDisplayed = useMemo(
    () =>
      displayed.filter((c) =>
        conversationMatchesMediaFilter(c, historyMediaFilter)
      ),
    [displayed, historyMediaFilter]
  );
  const { starredItems, historyItems } = useMemo(() => {
    if (isSearching) {
      return {
        starredItems: [] as Conversation[],
        historyItems: filteredDisplayed,
      };
    }
    return {
      starredItems: filteredDisplayed.filter((c) => c.starred),
      historyItems: filteredDisplayed.filter((c) => !c.starred),
    };
  }, [filteredDisplayed, isSearching]);
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
    const item =
      displayed.find((c) => c.id === id) ??
      conversations.find((c) => c.id === id);
    if (item?.mediaType === "storyboard") {
      void loadStoryboardConversation(id).then(() => {
        if (!isStoryboardPage) router.push("/storyboard");
        if (!isDesktop) setMobileSidebarOpen(false);
      });
      return;
    }

    if (item?.mediaType === "video") prefetchVideoModels();
    void selectConversation(id);

    // Image/video chats live on workspace home — leave storyboard/projects routes.
    if (!isWorkspaceHome) {
      router.push("/");
    }

    setMobilePanel(item?.mediaType === "video" ? "layouts" : "chat");
    if (!isDesktop) setMobileSidebarOpen(false);
  };

  const isHistoryItemActive = (item: Conversation) => {
    if (item.mediaType === "storyboard") {
      return isStoryboardPage && storyboardConversationId === item.id;
    }
    return isWorkspaceHome && activeConversationId === item.id;
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
          <div
            className={cn(
              "flex h-11 w-full items-center rounded-2xl text-foreground",
              showExpanded ? "gap-2 px-2" : "justify-center"
            )}
          >
            <Tooltip
              content={
                isDesktop
                  ? sidebarExpanded
                    ? "Collapse sidebar"
                    : "Expand sidebar"
                  : "Home"
              }
            >
              <button
                type="button"
                onClick={() => {
                  if (isDesktop) {
                    toggleSidebar();
                  } else {
                    setMobileSidebarOpen(false);
                  }
                }}
                aria-label={
                  isDesktop
                    ? sidebarExpanded
                      ? "Collapse sidebar"
                      : "Expand sidebar"
                    : "Close menu"
                }
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-violet to-accent-blue transition-opacity hover:opacity-90",
                  !isDesktop && "hover:bg-surface-elevated"
                )}
              >
                <Sparkles className="h-4 w-4 text-white" />
              </button>
            </Tooltip>

            <AnimatePresence>
              {showExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex min-w-0 flex-1 items-center gap-1"
                >
                  <Link
                    href="/"
                    onClick={() => {
                      if (!isDesktop) setMobileSidebarOpen(false);
                    }}
                    className="min-w-0 flex-1 truncate rounded-lg px-1 py-1 text-sm font-semibold tracking-tight hover:bg-surface-elevated transition-colors"
                  >
                    Brandwise
                  </Link>
                  {isDesktop && (
                    <Tooltip content="Collapse sidebar">
                      <button
                        type="button"
                        onClick={toggleSidebar}
                        aria-label="Collapse sidebar"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors"
                      >
                        <PanelLeftClose className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          <WorkspaceToolsNav
            compact={!showExpanded}
            showLabel={showExpanded}
            onSelect={startNewChatWithTool}
          />

          <Tooltip content="Projects">
            <Link
              href="/projects"
              onClick={() => {
                if (!isDesktop) setMobileSidebarOpen(false);
              }}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl transition-colors",
                showExpanded ? "px-3" : "justify-center",
                isProjectsPage
                  ? "bg-accent-violet/10 text-foreground ring-1 ring-inset ring-accent-violet/25"
                  : "text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
              )}
            >
              <FolderKanban className="h-4 w-4 shrink-0" />
              {showExpanded && <span className="text-sm">Projects</span>}
            </Link>
          </Tooltip>

          <Tooltip content="New generation">
            <button
              type="button"
              disabled={isGenerating}
              onClick={startNewGeneration}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors disabled:opacity-50",
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
          <div className="space-y-0.5">
            {showExpanded && searching && (
              <p className="px-3 py-2 text-xs text-foreground-muted">
                Searching…
              </p>
            )}
            {showExpanded &&
              !searching &&
              !historyLoading &&
              conversations.length === 0 && (
                <p className="px-3 py-2 text-xs text-foreground-muted">
                  No generations yet. Create one to see it here.
                </p>
              )}
            {showExpanded &&
              !searching &&
              !historyLoading &&
              conversations.length > 0 &&
              filteredDisplayed.length === 0 && (
                <p className="px-3 py-2 text-xs text-foreground-muted">
                  {historyMediaFilter === "video"
                    ? "No video generations in history yet."
                    : historyMediaFilter === "image"
                      ? "No image generations in history yet."
                      : "No generations match this filter."}
                </p>
              )}
            {historyLoading && !isSearching && showExpanded && (
              <p className="px-3 py-2 text-xs text-foreground-muted">
                Loading history…
              </p>
            )}

            {showExpanded &&
              isSearching &&
              !searching &&
              filteredDisplayed.length === 0 && (
                <p className="px-3 py-2 text-xs text-foreground-muted">
                  {displayed.length === 0
                    ? "No matches for your search."
                    : historyMediaFilter === "video"
                      ? "No videos match your search."
                      : historyMediaFilter === "image"
                        ? "No images match your search."
                        : "No matches for this filter."}
                </p>
              )}

            {showExpanded && isSearching && filteredDisplayed.length > 0 && (
              <>
                <div className="mb-2 flex items-center justify-between gap-2 px-2">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                    Results
                  </p>
                  <HistoryMediaFilterToggle
                    value={historyMediaFilter}
                    onChange={setHistoryMediaFilter}
                  />
                </div>
                {filteredDisplayed.map((item) => (
                  <HistoryListItem
                    key={item.id}
                    item={item}
                    isActive={isHistoryItemActive(item)}
                    isSearching={isSearching}
                    onSelect={handleSelectConversation}
                  />
                ))}
              </>
            )}

            {showExpanded && !isSearching && starredItems.length > 0 && (
              <>
                <p className="px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                  Starred
                </p>
                {starredItems.map((item) => (
                  <HistoryListItem
                    key={item.id}
                    item={item}
                    isActive={isHistoryItemActive(item)}
                    isSearching={false}
                    onSelect={handleSelectConversation}
                  />
                ))}
              </>
            )}

            {showExpanded && !isSearching && (
              <>
                <div
                  className={cn(
                    "mb-2 flex items-center justify-between gap-2 px-2",
                    starredItems.length > 0 && "pt-2"
                  )}
                >
                  <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
                    History
                  </p>
                  <HistoryMediaFilterToggle
                    value={historyMediaFilter}
                    onChange={setHistoryMediaFilter}
                  />
                </div>
                {historyItems.map((item) => (
                  <HistoryListItem
                    key={item.id}
                    item={item}
                    isActive={isHistoryItemActive(item)}
                    isSearching={false}
                    onSelect={handleSelectConversation}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="border-t border-border p-2">
          <UserMenu user={user} expanded={showExpanded} />
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
