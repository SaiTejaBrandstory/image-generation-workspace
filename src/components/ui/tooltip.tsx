"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className={cn(
            "z-50 rounded-lg bg-surface-elevated px-3 py-1.5 text-xs text-foreground border border-border shadow-cinematic"
          )}
          sideOffset={6}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-surface-elevated" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
