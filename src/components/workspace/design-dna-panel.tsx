"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";

export function DesignDnaPanel() {
  const { designTokens, activeBrand, setShowDesignDna } = useWorkspaceStore();
  const tokens = designTokens;

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      className="shrink-0 border-l border-border bg-surface overflow-y-auto"
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3 z-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-foreground-muted">
            Design DNA
          </p>
          <p className="text-sm font-semibold">{activeBrand?.name}</p>
        </div>
        <button
          onClick={() => setShowDesignDna(false)}
          className="rounded-lg p-1.5 hover:bg-surface-elevated"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-6 p-4">
        <Section title="Typography DNA">
          <div className="space-y-2 text-sm">
            <Row label="Primary" value={tokens?.typography.primary ?? "—"} />
            <Row label="Secondary" value={tokens?.typography.secondary ?? "—"} />
          </div>
          <div className="mt-3 space-y-1">
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: "inherit" }}
            >
              Aa
            </p>
            <p className="text-xs text-foreground-muted">Heading scale preview</p>
          </div>
        </Section>

        <Section title="Color DNA">
          <div className="flex gap-2 flex-wrap">
            {[
              tokens?.colors.primary ?? "#0B0B0B",
              tokens?.colors.accent ?? "#7C3AED",
              "#3B82F6",
              "#F5F5F5",
            ].map((color, i) => (
              <div key={i} className="space-y-1">
                <div
                  className="h-12 w-12 rounded-xl border border-border shadow-cinematic"
                  style={{ backgroundColor: color }}
                />
                <p className="text-[10px] text-foreground-muted font-mono">
                  {color}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-accent-cyan">Accessibility: AA pass</p>
        </Section>

        <Section title="Composition DNA">
          <p className="text-xs text-foreground-muted leading-relaxed">
            {tokens?.composition.negativeSpace ??
              "Strong negative space with asymmetrical balance"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(tokens?.composition.preferredLayouts ?? [
              "Editorial",
              "Single Hero",
              "Central Focus",
            ]).map((l) => (
              <span
                key={l}
                className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px]"
              >
                {l}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Motion DNA">
          <p className="text-xs text-foreground-muted">
            {tokens?.motion.style ?? "Soft spring animations"}
          </p>
          <div className="mt-3 h-8 rounded-lg bg-gradient-to-r from-accent-violet/20 via-accent-blue/20 to-accent-cyan/20 animate-pulse" />
        </Section>

        <Section title="Brand Personality">
          <div className="flex flex-wrap gap-1.5">
            {(tokens?.personality ?? ["Luxury", "Futuristic", "Minimal"]).map(
              (p) => (
                <span
                  key={p}
                  className="rounded-full border border-accent-violet/30 bg-accent-violet/10 px-2.5 py-1 text-[10px] text-accent-violet"
                >
                  {p}
                </span>
              )
            )}
          </div>
        </Section>
      </div>
    </motion.aside>
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
      <h4 className="mb-3 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-foreground-muted">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}
