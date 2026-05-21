"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";

/** Loads signed-in user's conversation history from the database on mount. */
export function HistoryLoader() {
  const loadHistory = useWorkspaceStore((s) => s.loadHistory);
  const historyLoaded = useWorkspaceStore((s) => s.historyLoaded);

  useEffect(() => {
    if (!historyLoaded) {
      loadHistory();
    }
  }, [historyLoaded, loadHistory]);

  return null;
}
