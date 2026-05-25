"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { groupVariantsByRound } from "@/lib/variant-rounds";
import { isRootVariant } from "@/lib/variation-utils";
import type { LayoutVariant } from "@/types";

function latestScrollToken(
  variants: LayoutVariant[],
  skeletonCount: number,
  isGenerating: boolean
): string | null {
  if (skeletonCount > 0 && variants.length === 0) {
    return `skeleton:${skeletonCount}`;
  }

  const groups = groupVariantsByRound(variants);
  const latest = groups.at(-1);
  if (!latest) return null;

  const roots = latest.variants.filter(isRootVariant);
  // Single-card rounds (video): also scroll when status changes (e.g. complete).
  const statusKey =
    roots.length <= 1 ? roots.map((v) => v.status).join(",") : "";
  return `${latest.round}|${roots.length}|${statusKey}|${isGenerating ? 1 : 0}`;
}

export function useScrollToLatestGeneration(
  variants: LayoutVariant[],
  isGenerating: boolean,
  skeletonCount: number
): RefObject<HTMLElement | null> {
  const anchorRef = useRef<HTMLElement | null>(null);
  const token = useMemo(
    () => latestScrollToken(variants, skeletonCount, isGenerating),
    [variants, skeletonCount, isGenerating]
  );
  const prevTokenRef = useRef<string | null>(null);
  const wasGeneratingRef = useRef(false);

  const scrollToLatest = () => {
    requestAnimationFrame(() => {
      anchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    if (!token) return;

    const tokenChanged = token !== prevTokenRef.current;
    const generationStarted = isGenerating && !wasGeneratingRef.current;

    if (tokenChanged || generationStarted) {
      scrollToLatest();
    }

    prevTokenRef.current = token;
    wasGeneratingRef.current = isGenerating;
  }, [token, isGenerating]);

  return anchorRef;
}
