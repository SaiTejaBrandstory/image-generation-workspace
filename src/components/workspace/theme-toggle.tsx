"use client";

import { Moon, Sun } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Tooltip } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useWorkspaceStore();
  const isDark = theme === "dark";

  return (
    <Tooltip content={isDark ? "Light mode" : "Dark mode"}>
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        {isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );
}
