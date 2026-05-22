"use client";

import { useEffect } from "react";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { useWorkspaceStore } from "@/store/workspace-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useWorkspaceStore((s) => s.theme);
  const setTheme = useWorkspaceStore((s) => s.setTheme);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, [setTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return children;
}
