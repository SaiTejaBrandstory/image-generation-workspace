"use client";

import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import { CHAT_EMPTY_STATE } from "@/lib/constants";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

function formatMsgTime(timestamp: number | undefined): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatThread() {
  const { conversations, activeConversationId, mediaType } = useWorkspaceStore();

  const messages =
    conversations.find((c) => c.id === activeConversationId)?.messages ?? [];

  const isVideo = mediaType === "video";
  const empty = CHAT_EMPTY_STATE[mediaType];

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 text-center sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md space-y-4"
        >
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {empty.title}
          </h2>
          <p className="text-sm text-foreground-muted leading-relaxed">
            {empty.description}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {empty.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => useWorkspaceStore.getState().setPrompt(suggestion)}
                className={cn(
                  "rounded-full border border-border bg-surface-elevated px-4 py-2 text-xs text-foreground-muted transition-colors",
                  isVideo
                    ? "hover:border-accent-cyan/40 hover:text-foreground"
                    : "hover:border-accent-violet/30 hover:text-foreground"
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-3xl space-y-8">
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex gap-4",
              msg.role === "user" ? "flex-row-reverse" : ""
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                msg.role === "user"
                  ? "bg-surface-elevated"
                  : isVideo
                    ? "bg-gradient-to-br from-accent-cyan/30 to-accent-blue/30"
                    : "bg-gradient-to-br from-accent-violet/30 to-accent-blue/30"
              )}
            >
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot
                  className={cn(
                    "h-4 w-4",
                    isVideo ? "text-accent-cyan" : "text-accent-violet"
                  )}
                />
              )}
            </div>
            <div className={cn("flex max-w-[85%] flex-col gap-1", msg.role === "user" && "items-end")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-surface-elevated text-foreground"
                    : "text-foreground-muted"
                )}
              >
                {msg.content}
              </div>
              {msg.timestamp ? (
                <span className="px-1 text-[10px] text-foreground-muted/50">
                  {formatMsgTime(msg.timestamp)}
                </span>
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
