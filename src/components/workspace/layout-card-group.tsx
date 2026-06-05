"use client";

import { LayoutCard } from "./layout-card";
import { getChildVariations, isRootVariant } from "@/lib/variation-utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { LayoutVariant } from "@/types";

interface LayoutCardGroupProps {
  variant: LayoutVariant;
  index: number;
  allVariants: LayoutVariant[];
}

export function LayoutCardGroup({
  variant,
  index,
  allVariants,
}: LayoutCardGroupProps) {
  const openExpandedWithVariations = useWorkspaceStore(
    (s) => s.openExpandedWithVariations
  );
  const children = getChildVariations(allVariants, variant.id);
  const variationTotal = children.length;
  const variationsBusy = children.some(
    (v) => v.status === "generating" || v.status === "pending"
  );
  const hasVariations = variationTotal > 0;

  const variationLabel = variationsBusy
    ? variationTotal > 0
      ? `${variationTotal} variation${variationTotal === 1 ? "" : "s"}…`
      : "Creating variations…"
    : variationTotal > 0
      ? `${variationTotal} variation${variationTotal === 1 ? "" : "s"}`
      : undefined;

  const openVariationsInExpand = () => {
    openExpandedWithVariations(variant.id);
  };

  return (
    <>
      <LayoutCard
        variant={variant}
        index={index}
        variationLabel={variationLabel}
        onVariationLabelClick={
          hasVariations && !variationsBusy ? openVariationsInExpand : undefined
        }
      />

      {/* Inline grid toggle — disabled for now; variations open in expand view only
      const [variationsOpen, setVariationsOpen] = useState(false);
      {variationsOpen && hasVariations && (
        <section className="variations-section col-span-full">
          <h3 className="variations-section-heading">Variations</h3>
          <div className="variations-grid">
            {children.map((child, i) => (
              <LayoutCard
                key={child.id}
                variant={child}
                index={i}
                titleOverride={`Variation ${(child.variationIndex ?? i) + 1}`}
                descriptionOverride={child.rationale}
              />
            ))}
          </div>
        </section>
      )}
      */}
    </>
  );
}

export function filterRootVariants(variants: LayoutVariant[]): LayoutVariant[] {
  return variants.filter(isRootVariant);
}
