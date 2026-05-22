"use client";

import { cn } from "@/lib/utils";

/** Shared scrollable projects area with subtle depth vs sidebar */
export function ProjectsPageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden font-sans",
        className
      )}
    >
      <div className="flex-1 overflow-y-auto bg-background">
        <div
          className={cn(
            "min-h-full border-l border-border/60",
            "bg-gradient-to-b from-surface/40 via-background to-background"
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

export function ProjectsContent({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 py-8 lg:px-10 lg:py-10",
        narrow ? "max-w-3xl" : "max-w-5xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ProjectsPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-sm",
        "ring-1 ring-foreground/[0.03]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ProjectsSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">
      {children}
    </p>
  );
}

/** Borderless panel — shadow and background only */
export function ProjectsSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface shadow-sm ring-1 ring-foreground/[0.04]",
        className
      )}
    >
      {children}
    </div>
  );
}
