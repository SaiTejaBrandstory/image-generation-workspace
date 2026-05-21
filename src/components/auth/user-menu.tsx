"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/types/auth";
import { Tooltip } from "@/components/ui/tooltip";

interface UserMenuProps {
  user: AuthUser;
  expanded: boolean;
}

export function UserMenu({ user, expanded }: UserMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const displayName = user.fullName ?? user.email ?? "Account";
  const initials = (user.fullName ?? user.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const signOutButton = (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors disabled:opacity-50",
        expanded ? "h-10 px-3" : "h-10 justify-center"
      )}
    >
      {signingOut ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4 shrink-0" />
      )}
      {expanded && (
        <span className="text-sm">{signingOut ? "Signing out…" : "Sign out"}</span>
      )}
    </button>
  );

  if (!expanded) {
    return (
      <div className="space-y-1">
        <Tooltip content={displayName}>
          <div className="flex justify-center py-1">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-violet/20 text-xs font-medium text-accent-violet">
                {initials}
              </div>
            )}
          </div>
        </Tooltip>
        <Tooltip content="Sign out">{signOutButton}</Tooltip>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 rounded-xl px-3 py-2">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-violet/20 text-xs font-medium text-accent-violet">
            {initials}
          </div>
        )}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-w-0 flex-1"
          >
            <p className="truncate text-sm font-medium">{displayName}</p>
            {user.email && user.fullName && (
              <p className="truncate text-xs text-foreground-muted">
                {user.email}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {signOutButton}
    </div>
  );
}
