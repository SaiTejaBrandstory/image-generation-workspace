"use client";

import {
  DEFAULT_IMAGE_MODEL,
  getImageModelsCatalog,
  getModelConfig,
  IMAGE_MODEL_GROUPS,
  isValidImageModel,
  modelsByGroup,
  modelSupportsVisionInput,
  resolveModelId,
  setImageModelsCatalog,
} from "@/lib/openrouter-models";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

type CatalogSource = "loading" | "openrouter" | "fallback";

/** First vision-capable model id in the static list — used as auto-switch target. */
const FIRST_VISION_MODEL = DEFAULT_IMAGE_MODEL; // Gemini 2.5 Flash supports vision

export function ModelSelector({ showLabel = false }: { showLabel?: boolean } = {}) {
  const { imageModel, setImageModel, references } = useWorkspaceStore();
  const [source, setSource] = useState<CatalogSource>("loading");

  const hasReferences = references.length > 0;

  // Fetch live model list on mount; fall back to static catalog on error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/image/models");
        const data = await res.json();
        if (!cancelled && Array.isArray(data.models) && data.models.length) {
          setImageModelsCatalog(data.models);
          if (!cancelled)
            setSource(data.source === "openrouter" ? "openrouter" : "fallback");
        } else {
          if (!cancelled) setSource("fallback");
        }
      } catch {
        if (!cancelled) setSource("fallback");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // After catalog is ready, validate the selected model.
  useEffect(() => {
    if (source === "loading") return;
    const resolved = resolveModelId(imageModel);
    if (!isValidImageModel(imageModel)) {
      setImageModel(DEFAULT_IMAGE_MODEL);
    } else if (resolved !== imageModel) {
      setImageModel(resolved);
    }
  }, [source, imageModel, setImageModel]);

  // When references are uploaded, auto-switch to a vision-capable model if
  // the current model doesn't support image input.
  useEffect(() => {
    if (!hasReferences) return;
    if (!modelSupportsVisionInput(imageModel)) {
      setImageModel(FIRST_VISION_MODEL);
    }
  }, [hasReferences, imageModel, setImageModel]);

  const activeId = isValidImageModel(imageModel)
    ? resolveModelId(imageModel)
    : DEFAULT_IMAGE_MODEL;

  const config = getModelConfig(activeId);

  // When references are present, only show models that can accept image input.
  const grouped = useMemo(() => {
    const all = modelsByGroup();
    if (!hasReferences) return all;
    const filtered = new Map<string, ReturnType<typeof getImageModelsCatalog>>();
    for (const [group, models] of all) {
      const visionModels = models.filter((m) => m.supportsVisionInput);
      if (visionModels.length > 0) filtered.set(group, visionModels);
    }
    return filtered;
  }, [hasReferences]);

  const totalModels = getImageModelsCatalog().length;
  const visibleCount = [...grouped.values()].reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  const sourceDot =
    source === "loading"
      ? { color: "bg-foreground/20", title: "Loading models…" }
      : source === "openrouter"
        ? { color: "bg-green-500", title: `Live · ${totalModels} models` }
        : { color: "bg-yellow-500", title: `Static fallback · ${totalModels} models (live fetch failed)` };

  return (
    <div className="flex min-w-0 w-full flex-col gap-1.5">
      {showLabel && (
        <div className="flex items-center gap-1.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
            Model
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${sourceDot.color}`}
            title={sourceDot.title}
          />
        </div>
      )}
      <div className="relative min-w-0 flex-1">
      <select
        value={activeId}
        onChange={(e) => setImageModel(e.target.value)}
        title={
          hasReferences
            ? `${config.label} — image input supported · ${visibleCount} compatible models`
            : `${config.label} — ${config.description}\n${sourceDot.title}`
        }
        aria-label={`Image model (${visibleCount} available${hasReferences ? ", filtered for image input" : ""})`}
        className="h-9 w-full min-w-0 max-w-full cursor-pointer appearance-none truncate rounded-xl border border-border/90 bg-background py-2 pl-3 pr-9 text-xs font-medium text-foreground shadow-sm outline-none transition-[border-color,box-shadow] hover:border-foreground/15 hover:bg-surface-hover/30 focus:border-accent-violet/45 focus:ring-2 focus:ring-accent-violet/15"
      >
        {IMAGE_MODEL_GROUPS.map((group) => {
          const models = grouped.get(group) ?? [];
          if (models.length === 0) return null;
          return (
            <optgroup key={group} label={group}>
              {models.map((m) => (
                <option key={m.id} value={m.id} title={m.description}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted/55"
        aria-hidden
      />
      </div>
      {hasReferences && (
        <span
          className="shrink-0 rounded-md bg-accent-violet/15 px-1.5 py-0.5 text-[10px] text-accent-violet"
          title={`Showing ${visibleCount} models that support reference image input`}
        >
          img2img
        </span>
      )}
    </div>
  );
}
