"use client";

import type { Ref, RefObject } from "react";
import {
  filterRootVariants,
  LayoutCardGroup,
} from "./layout-card-group";
import {
  formatRoundLabel,
  groupVariantsByRound,
} from "@/lib/variant-rounds";
import { cn } from "@/lib/utils";
import type { LayoutVariant, MediaType } from "@/types";

interface LayoutMatrixProps {
  variants: LayoutVariant[];
  skeletonCount?: number;
  mediaType?: "image" | "video";
  latestRoundRef?: RefObject<HTMLElement | null>;
}

export function LayoutMatrix({
  variants,
  skeletonCount = 0,
  mediaType = "image",
  latestRoundRef,
}: LayoutMatrixProps) {
  const isVideo = mediaType === "video";
  const groups = groupVariantsByRound(variants);

  if (groups.length === 0 && skeletonCount > 0) {
    return (
      <div
        ref={latestRoundRef as Ref<HTMLDivElement>}
        data-latest-generation-round
        className="generation-rounds"
      >
        <RoundCaption
          label={isVideo ? "Generating video…" : "Generating…"}
          count={skeletonCount}
          mediaType={mediaType}
        />
        <div
          className={cn(
            "layout-matrix layout-matrix--in-round",
            isVideo && "layout-matrix--single-video"
          )}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} isVideo={isVideo} />
          ))}
        </div>
      </div>
    );
  }

  let cardIndex = 0;

  return (
    <div className="generation-rounds">
      {groups.map((group, groupIndex) => {
        const isLatestRound = groupIndex === groups.length - 1;
        return (
        <section
          key={group.round}
          ref={isLatestRound ? latestRoundRef : undefined}
          data-latest-generation-round={isLatestRound ? "" : undefined}
          className="generation-round"
        >
          {groupIndex > 0 && (
            <div className="generation-round-divider" role="separator" />
          )}
          <RoundCaption
            label={formatRoundLabel(group.createdAt)}
            count={filterRootVariants(group.variants).length}
            isLatest={groupIndex === groups.length - 1 && groups.length > 1}
            showLatestTag={groups.length > 1}
            mediaType={
              (filterRootVariants(group.variants)[0]?.mediaType ??
                "image") as MediaType
            }
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
        );
      })}
    </div>
  );
}

function RoundCaption({
  label,
  count,
  isLatest,
  showLatestTag,
  mediaType = "image",
}: {
  label: string;
  count: number;
  isLatest?: boolean;
  showLatestTag?: boolean;
  mediaType?: "image" | "video";
}) {
  const unit =
    mediaType === "video"
      ? count === 1
        ? "video"
        : "videos"
      : count === 1
        ? "layout"
        : "layouts";
  return (
    <p className="generation-round-caption">
      {showLatestTag && isLatest && (
        <>
          <span
            className={
              mediaType === "video"
                ? "font-medium text-accent-cyan"
                : "font-medium text-accent-violet"
            }
          >
            Latest
          </span>
          <span className="text-foreground-muted/40"> · </span>
        </>
      )}
      <span>{label}</span>
      <span className="text-foreground-muted/40"> · </span>
      <span>
        {count} {unit}
      </span>
    </p>
  );
}

function SkeletonCard({ isVideo }: { isVideo?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface lg:rounded-[20px]">
      <div
        className={cn(
          "layout-card-preview skeleton-shimmer",
          isVideo && "aspect-video max-h-none min-h-[200px]"
        )}
      />
      <div className="space-y-2 px-4 py-3.5">
        <div className="h-3.5 w-2/3 rounded-md skeleton-shimmer" />
        {!isVideo && (
          <div className="h-3 w-full rounded-md skeleton-shimmer" />
        )}
      </div>
    </div>
  );
}
