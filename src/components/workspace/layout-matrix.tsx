"use client";

import {
  filterRootVariants,
  LayoutCardGroup,
} from "./layout-card-group";
import {
  formatRoundLabel,
  groupVariantsByRound,
} from "@/lib/variant-rounds";
import type { LayoutVariant } from "@/types";

interface LayoutMatrixProps {
  variants: LayoutVariant[];
  skeletonCount?: number;
}

export function LayoutMatrix({ variants, skeletonCount = 0 }: LayoutMatrixProps) {
  const groups = groupVariantsByRound(variants);

  if (groups.length === 0 && skeletonCount > 0) {
    return (
      <div className="generation-rounds">
        <RoundCaption label="Generating…" count={skeletonCount} />
        <div className="layout-matrix layout-matrix--in-round">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  let cardIndex = 0;

  return (
    <div className="generation-rounds">
      {groups.map((group, groupIndex) => (
        <section key={group.round} className="generation-round">
          {groupIndex > 0 && (
            <div className="generation-round-divider" role="separator" />
          )}
          <RoundCaption
            label={formatRoundLabel(group.createdAt)}
            count={filterRootVariants(group.variants).length}
            isLatest={groupIndex === groups.length - 1 && groups.length > 1}
            showLatestTag={groups.length > 1}
          />
          <div className="layout-matrix layout-matrix--in-round">
            {filterRootVariants(group.variants).map((variant) => {
              const index = cardIndex++;
              return (
                <LayoutCardGroup
                  key={variant.id}
                  variant={variant}
                  index={index}
                  allVariants={variants}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoundCaption({
  label,
  count,
  isLatest,
  showLatestTag,
}: {
  label: string;
  count: number;
  isLatest?: boolean;
  showLatestTag?: boolean;
}) {
  return (
    <p className="generation-round-caption">
      {showLatestTag && isLatest && (
        <>
          <span className="font-medium text-accent-violet">Latest</span>
          <span className="text-foreground-muted/40"> · </span>
        </>
      )}
      <span>{label}</span>
      <span className="text-foreground-muted/40"> · </span>
      <span>
        {count} {count === 1 ? "layout" : "layouts"}
      </span>
    </p>
  );
}

function SkeletonCard() {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface lg:rounded-[20px]">
      <div className="layout-card-preview skeleton-shimmer" />
      <div className="space-y-2 px-4 py-3.5">
        <div className="h-3.5 w-2/3 rounded-md skeleton-shimmer" />
        <div className="h-3 w-full rounded-md skeleton-shimmer" />
      </div>
    </div>
  );
}
