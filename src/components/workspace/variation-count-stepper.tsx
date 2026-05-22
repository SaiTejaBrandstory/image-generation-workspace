"use client";

import { Minus, Plus } from "lucide-react";
import {
  clampVariationBatch,
  MAX_VARIATIONS,
  MIN_VARIATIONS,
} from "@/lib/variation-utils";
import { cn } from "@/lib/utils";

interface VariationCountStepperProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Cap the stepper when fewer slots remain (e.g. already have 8 variations) */
  maxAllowed?: number;
  className?: string;
}

export function VariationCountStepper({
  value,
  onChange,
  disabled,
  maxAllowed = MAX_VARIATIONS,
  className,
}: VariationCountStepperProps) {
  const max = Math.min(MAX_VARIATIONS, Math.max(MIN_VARIATIONS, maxAllowed));
  const clamped = clampVariationBatch(Math.min(value, max));

  const decrement = () => onChange(clampVariationBatch(clamped - 1));
  const increment = () => onChange(clampVariationBatch(clamped + 1));

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface-elevated px-2 py-1.5",
        className
      )}
    >
      <span className="pl-2 text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
        Count
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || clamped <= MIN_VARIATIONS}
          aria-label="Decrease variation count"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
          {clamped}
        </span>
        <button
          type="button"
          onClick={increment}
          disabled={disabled || clamped >= max}
          aria-label="Increase variation count"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
