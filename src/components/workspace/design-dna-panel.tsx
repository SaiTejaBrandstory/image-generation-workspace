"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DesignTokens } from "@/types";

export function DesignDnaPanel() {
  const { designTokens, activeBrand } = useWorkspaceStore();
  const tokens = designTokens;
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <>
      {/* Mobile: inline strip — does not block the layout grid */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="shrink-0 overflow-hidden border-b border-border bg-surface lg:hidden"
      >
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Design DNA
            </p>
            <p className="truncate text-sm font-semibold">
              {activeBrand?.name ?? "Brand"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-foreground-muted transition-transform",
              mobileExpanded && "rotate-180"
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {mobileExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-h-[40dvh] overflow-y-auto border-t border-border"
            >
              <DnaContent tokens={tokens} compact />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Desktop: side panel */}
      <motion.aside
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 320, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        className="hidden shrink-0 overflow-y-auto border-l border-border bg-surface lg:flex lg:flex-col"
      >
        <div className="sticky top-0 border-b border-border bg-surface px-4 py-3 z-10">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground-muted">
            Design DNA
          </p>
          <p className="text-sm font-semibold">{activeBrand?.name}</p>
        </div>
        <DnaContent tokens={tokens} />
      </motion.aside>
    </>
  );
}

function DnaContent({
  tokens,
  compact,
}: {
  tokens: DesignTokens | null;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto p-4",
        compact ? "space-y-4" : "space-y-6"
      )}
    >
      <Section title="Typography DNA">
        <div className="space-y-2 text-sm">
          <Row label="Primary" value={tokens?.typography.primary ?? "—"} />
          <Row label="Secondary" value={tokens?.typography.secondary ?? "—"} />
        </div>
        <div className="mt-3 space-y-1">
          <p
            className="text-2xl font-light tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Aa Bb Cc
          </p>
        </div>
      </Section>

      <Section title="Color DNA">
        <div className="flex flex-wrap gap-2">
          {[
            tokens?.colors.primary,
            tokens?.colors.secondary,
            tokens?.colors.accent,
            tokens?.colors.background,
          ]
            .filter(Boolean)
            .map((c) => (
              <div
                key={c}
                className="h-10 w-10 rounded-xl border border-border shadow-sm"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
        </div>
      </Section>

      <Section title="Composition">
        <div className="space-y-2 text-sm text-foreground-muted">
          <Row
            label="Layouts"
            value={tokens?.composition.preferredLayouts?.join(", ") ?? "—"}
          />
          <Row
            label="Negative space"
            value={tokens?.composition.negativeSpace ?? "—"}
          />
        </div>
      </Section>

      <Section title="Personality">
        <div className="flex flex-wrap gap-1.5">
          {(tokens?.personality ?? []).map((p) => (
            <span
              key={p}
              className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-foreground-muted"
            >
              {p}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-foreground-muted">{label}</span>
      <span className="text-foreground text-right truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
