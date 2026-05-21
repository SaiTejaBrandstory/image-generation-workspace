"use client";

import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

export function ChatThread() {
  const { conversations, activeConversationId } = useWorkspaceStore();

  const messages =
    conversations.find((c) => c.id === activeConversationId)?.messages ?? [];

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md space-y-4"
        >
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            What are we creating today?
          </h2>
          <p className="text-sm text-foreground-muted leading-relaxed">
            Describe your creative vision, attach reference images, and generate
            20 professional layout systems in a single pass.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {[
              "Porsche-inspired luxury watch ad",
              "Nike energy sports campaign",
              "SaaS dashboard product launch",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => useWorkspaceStore.getState().setPrompt(suggestion)}
                className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-xs text-foreground-muted hover:border-accent-violet/30 hover:text-foreground transition-colors"
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
                  : "bg-gradient-to-br from-accent-violet/30 to-accent-blue/30"
              )}
            >
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4 text-accent-violet" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-surface-elevated text-foreground"
                  : "text-foreground-muted"
              )}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
