"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-elevated">
        <SliderPrimitive.Range className="absolute h-full bg-accent-violet/80" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-accent-violet bg-white shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-accent-violet/40" />
    </SliderPrimitive.Root>
  );
}
