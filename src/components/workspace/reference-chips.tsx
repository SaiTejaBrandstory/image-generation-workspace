"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useWorkspaceStore } from "@/store/workspace-store";

export function ReferenceChips() {
  const { references, removeReference } = useWorkspaceStore();

  if (references.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mr-1">
        References
      </span>
      {references.map((ref, i) => (
        <div
          key={ref.id}
          className="group relative flex h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-elevated"
          title={ref.name}
        >
          <Image
            src={ref.url}
            alt={`Reference ${i + 1}`}
            fill
            className="object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={() => removeReference(ref.id)}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Remove reference ${i + 1}`}
          >
            <X className="h-4 w-4 text-white" />
          </button>
          <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[8px] font-medium text-white">
            {i + 1}
          </span>
        </div>
      ))}
      {references.length > 4 && (
        <span className="text-[10px] text-accent-orange">
          First 4 sent to model
        </span>
      )}
    </div>
  );
}
