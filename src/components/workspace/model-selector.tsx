"use client";

import {
  getModelConfig,
  DEFAULT_IMAGE_MODEL,
  isValidImageModel,
  modelsByGroup,
  resolveModelId,
  IMAGE_MODEL_GROUPS,
} from "@/lib/openrouter-models";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useEffect } from "react";

export function ModelSelector() {
  const { imageModel, setImageModel } = useWorkspaceStore();
  const resolved = resolveModelId(imageModel);
  const config = getModelConfig(resolved);

  useEffect(() => {
    if (!isValidImageModel(imageModel)) {
      setImageModel(DEFAULT_IMAGE_MODEL);
    } else if (resolved !== imageModel) {
      setImageModel(resolved);
    }
  }, [imageModel, resolved, setImageModel]);

  const activeId = isValidImageModel(imageModel)
    ? resolveModelId(imageModel)
    : DEFAULT_IMAGE_MODEL;

  const grouped = modelsByGroup();

  return (
    <select
      value={activeId}
      onChange={(e) => setImageModel(e.target.value)}
      title={`${config.label} — ${config.description}`}
      className="max-w-[180px] truncate rounded-xl bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground-muted border-0 outline-none cursor-pointer hover:text-foreground"
    >
      {IMAGE_MODEL_GROUPS.map((group) => (
        <optgroup key={group} label={group}>
          {(grouped.get(group) ?? []).map((m) => (
            <option key={m.id} value={m.id} title={m.description}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
