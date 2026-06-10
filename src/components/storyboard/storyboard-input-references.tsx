"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ImageIcon,
  ImagePlus,
  Loader2,
  Package,
  Tag,
  Trees,
  User,
  X,
} from "lucide-react";
import { formatReferenceCountLabel } from "@/lib/reference-limits";
import {
  STORYBOARD_INPUT_REFERENCE_ACCEPT,
  STORYBOARD_INPUT_REFERENCE_KINDS,
  STORYBOARD_MAX_INPUT_REFERENCES,
  storyboardInputReferenceKindLabel,
  storyboardInputReferenceLabelPlaceholder,
  storyboardInputReferenceLimitHint,
  storyboardInputReferenceSlotsLeft,
  storyboardInputReferencesForKind,
  validateStoryboardInputReferenceFiles,
} from "@/lib/storyboard/storyboard-input-references";
import { useStoryboardStore } from "@/store/storyboard-store";
import { cn } from "@/lib/utils";
import type {
  StoryboardInputReference,
  StoryboardInputReferenceKind,
} from "@/types/storyboard";

/** Stable fallback — never use `?? []` inline in Zustand selectors. */
const EMPTY_INPUT_REFERENCES: StoryboardInputReference[] = [];

const KIND_ICONS: Record<StoryboardInputReferenceKind, typeof User> = {
  character: User,
  product: Package,
  environment: Trees,
};

const KIND_HINTS: Record<StoryboardInputReferenceKind, string> = {
  character: "Faces & outfits — label each person for the script",
  product: "Packaging or logo — label hero product vs brand mark",
  environment: "Sets & locations — label the place when helpful",
};

const KIND_ACCENT: Record<
  StoryboardInputReferenceKind,
  { ring: string; bg: string; text: string; border: string }
> = {
  character: {
    ring: "ring-accent-violet/25",
    bg: "bg-accent-violet/10",
    text: "text-accent-violet",
    border: "border-accent-violet/30",
  },
  product: {
    ring: "ring-accent-orange/25",
    bg: "bg-accent-orange/10",
    text: "text-accent-orange",
    border: "border-accent-orange/30",
  },
  environment: {
    ring: "ring-accent-cyan/25",
    bg: "bg-accent-cyan/10",
    text: "text-accent-cyan",
    border: "border-accent-cyan/30",
  },
};

function SpecPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-background/70 px-2 py-0.5 text-[10px] text-foreground-muted ring-1 ring-inset ring-border/50">
      {children}
    </span>
  );
}

function SlotMeter({ filled }: { filled: number }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className="text-[11px] font-medium tabular-nums text-foreground-muted">
        {formatReferenceCountLabel(filled, "image")}
      </span>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: STORYBOARD_MAX_INPUT_REFERENCES }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-5 rounded-full transition-colors",
              i < filled ? "bg-accent-violet" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ReferenceItem({
  refItem,
  kind,
  onRemove,
  onLabelChange,
  removing,
}: {
  refItem: StoryboardInputReference;
  kind: StoryboardInputReferenceKind;
  onRemove: () => void;
  onLabelChange: (label: string) => void;
  removing: boolean;
}) {
  const [draftLabel, setDraftLabel] = useState(refItem.label ?? "");
  const accent = KIND_ACCENT[kind];

  useEffect(() => {
    setDraftLabel(refItem.label ?? "");
  }, [refItem.id, refItem.label]);

  return (
    <div
      className={cn(
        "flex items-stretch gap-3 rounded-lg border bg-background/80 p-2.5",
        "ring-1 ring-inset ring-border/40",
        accent.border
      )}
    >
      <div className="group relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-background shadow-sm">
        {refItem.previewUrl ? (
          <Image
            src={refItem.previewUrl}
            alt={refItem.label || refItem.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-foreground-muted">
            <ImageIcon className="h-4 w-4 opacity-40" />
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          aria-label={`Remove ${refItem.name}`}
        >
          {removing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p
          className="truncate text-[10px] text-foreground-muted"
          title={refItem.name}
        >
          {refItem.name}
        </p>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-foreground-muted/80">
            <Tag className="h-2.5 w-2.5" />
            Label
          </span>
          <input
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={() => {
              if (draftLabel !== (refItem.label ?? "")) {
                onLabelChange(draftLabel);
              }
            }}
            placeholder={storyboardInputReferenceLabelPlaceholder(kind)}
            className={cn(
              "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground",
              "placeholder:text-foreground-muted/50",
              "focus:border-accent-violet/40 focus:outline-none focus:ring-2 focus:ring-accent-violet/15"
            )}
            maxLength={80}
          />
        </label>
      </div>
    </div>
  );
}

function ReferenceKindRow({
  kind,
  inputRefs,
  slotsLeft,
  onAdd,
  onRemove,
  onLabelChange,
  uploading,
}: {
  kind: StoryboardInputReferenceKind;
  inputRefs: StoryboardInputReference[];
  slotsLeft: number;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  uploading: boolean;
}) {
  const refs = storyboardInputReferencesForKind(inputRefs, kind);
  const fileRef = useRef<HTMLInputElement>(null);
  const Icon = KIND_ICONS[kind];
  const accent = KIND_ACCENT[kind];
  const canAdd = slotsLeft > 0 && !uploading;

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
            accent.bg,
            accent.ring
          )}
        >
          <Icon className={cn("h-4 w-4", accent.text)} />
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                {storyboardInputReferenceKindLabel(kind)}
              </p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {KIND_HINTS[kind]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!canAdd}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                canAdd
                  ? cn(
                      "border bg-background text-foreground shadow-sm",
                      "hover:shadow-md",
                      accent.border,
                      accent.text
                    )
                  : "cursor-not-allowed border border-border/50 text-foreground-muted/50"
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Add image"}
            </button>
          </div>

          {refs.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {refs.map((ref) => (
                <ReferenceItem
                  key={ref.id}
                  refItem={ref}
                  kind={kind}
                  onRemove={() => onRemove(ref.id)}
                  onLabelChange={(label) => onLabelChange(ref.id, label)}
                  removing={uploading}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => canAdd && fileRef.current?.click()}
              disabled={!canAdd}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-xs transition-colors",
                canAdd
                  ? cn(
                      "border-border/80 bg-background/40 text-foreground-muted",
                      "hover:border-accent-violet/35 hover:bg-accent-violet/[0.03] hover:text-foreground"
                    )
                  : "cursor-not-allowed border-border/40 bg-background/20 text-foreground-muted/40"
              )}
            >
              <ImagePlus className="h-4 w-4 shrink-0 opacity-60" />
              {slotsLeft <= 0
                ? "All 4 reference slots are in use"
                : "Click to upload an image"}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={STORYBOARD_INPUT_REFERENCE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function StoryboardInputReferences() {
  const inputReferences = useStoryboardStore(
    (s) => s.settings.inputReferences ?? EMPTY_INPUT_REFERENCES
  );
  const addInputReference = useStoryboardStore((s) => s.addInputReference);
  const removeInputReference = useStoryboardStore((s) => s.removeInputReference);
  const updateInputReferenceLabel = useStoryboardStore(
    (s) => s.updateInputReferenceLabel
  );
  const [uploadingKind, setUploadingKind] =
    useState<StoryboardInputReferenceKind | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const slotsLeft = storyboardInputReferenceSlotsLeft(inputReferences);
  const limitHint = storyboardInputReferenceLimitHint();

  const handleAdd = async (
    kind: StoryboardInputReferenceKind,
    files: FileList | File[]
  ) => {
    const list = Array.from(files);
    const { accepted, errors } = await validateStoryboardInputReferenceFiles(
      list,
      inputReferences
    );
    if (errors.length) {
      setWarning(errors.join(" "));
    } else {
      setWarning(null);
    }
    if (!accepted.length) return;

    setUploadingKind(kind);
    try {
      for (const file of accepted) {
        await addInputReference(kind, file);
      }
    } finally {
      setUploadingKind(null);
    }
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface-elevated/90",
        "shadow-[0_12px_40px_rgba(0,0,0,0.05)] ring-1 ring-inset ring-white/[0.06]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-violet/10 ring-1 ring-inset ring-accent-violet/20">
            <ImageIcon className="h-5 w-5 text-accent-violet" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Reference images
            </h2>
            <p className="mt-0.5 max-w-md text-xs leading-relaxed text-foreground-muted">
              Optional visual anchors for characters, products, and sets. Add a
              short label on each image so your script matches the right ref.
            </p>
          </div>
        </div>
        <SlotMeter filled={inputReferences.length} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border/40 bg-background/30 px-4 py-2.5">
        {limitHint.split(" · ").map((part) => (
          <SpecPill key={part}>{part}</SpecPill>
        ))}
      </div>

      <div className="divide-y divide-border/50">
        {STORYBOARD_INPUT_REFERENCE_KINDS.map((kind) => (
          <ReferenceKindRow
            key={kind}
            kind={kind}
            inputRefs={inputReferences}
            slotsLeft={slotsLeft}
            uploading={uploadingKind === kind}
            onAdd={(files) => void handleAdd(kind, files)}
            onRemove={removeInputReference}
            onLabelChange={updateInputReferenceLabel}
          />
        ))}
      </div>

      {warning ? (
        <p className="border-t border-accent-orange/20 bg-accent-orange/5 px-4 py-2.5 text-xs text-accent-orange">
          {warning}
        </p>
      ) : null}
    </section>
  );
}
