import type { LayoutVariant } from "@/types";

export interface VariantRoundGroup {
  round: number;
  createdAt: number;
  variants: LayoutVariant[];
}

export function groupVariantsByRound(variants: LayoutVariant[]): VariantRoundGroup[] {
  const byRound = new Map<number, VariantRoundGroup>();

  for (const variant of variants) {
    const round = variant.generationRound ?? 0;
    let group = byRound.get(round);
    if (!group) {
      group = {
        round,
        createdAt: variant.createdAt ?? Date.now(),
        variants: [],
      };
      byRound.set(round, group);
    }
    group.variants.push(variant);
    const ts = variant.createdAt ?? 0;
    if (ts > 0 && ts < group.createdAt) {
      group.createdAt = ts;
    }
  }

  return [...byRound.values()]
    .map((g) => ({
      ...g,
      variants: g.variants.sort(
        (a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)
      ),
    }))
    .sort((a, b) => a.round - b.round);
}

export function formatRoundLabel(createdAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

export function formatRoundDateParts(createdAt: number): {
  dateLine: string;
  timeLine: string;
} {
  const d = new Date(createdAt);
  return {
    dateLine: new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d),
    timeLine: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(d),
  };
}

export function roundHeaderTitle(
  groupIndex: number,
  totalGroups: number
): string {
  if (totalGroups === 1) return "Layout batch";
  if (groupIndex === totalGroups - 1) return "Latest batch";
  return `Batch ${groupIndex + 1}`;
}
