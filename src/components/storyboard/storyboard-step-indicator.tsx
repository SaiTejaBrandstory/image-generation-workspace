"use client";

import { WIZARD_STEPS } from "@/lib/storyboard/constants";
import { cn } from "@/lib/utils";
import type { StoryboardWizardStep } from "@/types/storyboard";

export function StoryboardStepIndicator({
  current,
  wizardLocked = false,
}: {
  current: StoryboardWizardStep;
  wizardLocked?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {WIZARD_STEPS.map(({ step, label }, index) => {
        const locked = wizardLocked && step < 4;
        return (
        <div key={step} className="flex items-center gap-1.5 sm:gap-2">
          <div
            className={cn(
              "flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors sm:h-8 sm:min-w-8 sm:text-xs",
              locked
                ? "bg-surface-elevated/60 text-foreground-muted/50 ring-1 ring-inset ring-border/60"
                : current === step
                ? "bg-accent-orange text-white shadow-[0_0_16px_rgba(251,146,60,0.35)]"
                : current > step
                  ? "bg-accent-orange/15 text-accent-orange ring-1 ring-inset ring-accent-orange/25"
                  : "bg-surface-elevated text-foreground-muted ring-1 ring-inset ring-border"
            )}
          >
            {step}
          </div>
          <span
            className={cn(
              "hidden text-[11px] font-medium md:inline sm:text-xs",
              current === step ? "text-foreground" : "text-foreground-muted"
            )}
          >
            {label}
          </span>
          {index < WIZARD_STEPS.length - 1 && (
            <div
              className={cn(
                "hidden h-px w-4 sm:block md:w-6",
                current > step ? "bg-accent-orange/40" : "bg-border"
              )}
            />
          )}
        </div>
      );
      })}
    </div>
  );
}
