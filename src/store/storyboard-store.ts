"use client";

import { create } from "zustand";
import {
  buildDefaultContinuity,
  getStoryboardReferenceScenes,
} from "@/lib/storyboard/continuity";
import {
  STORYBOARD_DEFAULT_IMAGE_ASPECT,
  STORYBOARD_IMAGE_MODEL,
  clampStoryboardImageAspectRatio,
  isStoryboardReferenceFrameImageModel,
  resolveStoryboardImageModel,
} from "@/lib/storyboard/storyboard-image";
import type { AspectRatio } from "@/types";
import {
  chunkStoryboardScenesForVideo,
  needsStoryboardVideoBatching,
  pickStoryboardBatchDuration,
  clampStoryboardVideoAspectRatio,
  resolveStoryboardVideoAspectRatio,
  defaultStoryboardVideoFallbackModel,
  STORYBOARD_VIDEO_HUMAN_FALLBACK_MODEL,
  STORYBOARD_VIDEO_MODEL,
} from "@/lib/storyboard/storyboard-video";
import {
  getVideoModelsCatalog,
  pickStoryboardHumanFrameFallback,
} from "@/lib/openrouter-video-models";
import { runWithConcurrency } from "@/lib/reference-utils";
import { normalizeFrameStyle } from "@/lib/storyboard/frame-styles";
import { normalizeFrameCount } from "@/lib/storyboard/script-utils";
import {
  estimateVideoGenerationMs,
  startEstimatedVideoProgress,
} from "@/lib/video-progress";
import { readJsonResponse } from "@/lib/api-response";
import {
  commitStoryboard,
  fetchStoryboard,
  patchStoryboardOutputs,
  recoverStoryboard,
} from "@/lib/storyboard-api";
import {
  clearPendingVideo,
  getPendingVideo,
  isPendingVideoForConversation,
  markPendingVideo,
} from "@/lib/storyboard/pending-video";
import { createEmptyScene, renumberScenes } from "@/lib/storyboard/scene-engine";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import {
  inputReferencesForDraft,
  sanitizeStoryboardInputReferenceLabel,
  storyboardInputReferenceSlotsLeft,
} from "@/lib/storyboard/storyboard-input-references";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardInputReferenceKind,
  StoryboardScene,
  StoryboardViewMode,
  StoryboardWizardStep,
} from "@/types/storyboard";

const DRAFT_KEY = "brandwise-storyboard-draft";

const DEFAULT_SETTINGS: StoryboardProjectSettings = {
  genre: "commercial",
  durationSec: 30,
  frameCount: 6,
  frameStyle: "sketch",
  sceneEnvironment: "",
};

interface StoryboardState {
  step: StoryboardWizardStep;
  script: string;
  settings: StoryboardProjectSettings;
  continuity: StoryboardContinuity | null;
  scenes: StoryboardScene[];
  selectedSceneId: string | null;
  viewMode: StoryboardViewMode;
  isBreakingDown: boolean;
  isInferringEnvironment: boolean;
  isGeneratingScript: boolean;
  isGeneratingFrames: boolean;
  generationProgress: number;
  isGeneratingVideo: boolean;
  videoProgress: number;
  videoGenerationStatus: string | null;
  storyboardVideoUrl: string | null;
  storyboardVideoDurationSec: number | null;
  /** Model that actually rendered the current storyboard video (from API). */
  storyboardVideoModel: string | null;
  imagePrimaryModel: string;
  imageAspectRatio: AspectRatio;
  videoPrimaryModel: string;
  videoFallbackModel: string | null;
  videoAspectRatio: string;
  isGeneratingStitchedVideo: boolean;
  stitchedVideoProgress: number;
  stitchedVideoStatus: string | null;
  sceneStitchedVideoUrl: string | null;
  sceneStitchedVideoDurationSec: number | null;
  storyboardProjectId: string;
  /** Set after all frames are saved to conversations history. */
  conversationId: string | null;
  wizardLocked: boolean;
  isCommitting: boolean;
  singleVideoStoragePath: string | null;
  stitchedVideoStoragePath: string | null;
  sceneStitchedVideoStoragePath: string | null;
  /** Bumps per scene — stale API responses are ignored when epoch mismatches. */
  frameGenerationEpoch: Record<string, number>;
  sceneVideoGenerationEpoch: Record<string, number>;
  videoGenerationEpoch: number;
  stitchedVideoGenerationEpoch: number;
  error: string | null;
  history: StoryboardScene[][];
  historyIndex: number;

  setStep: (step: StoryboardWizardStep) => void;
  nextStep: () => void;
  goToProjectSettings: () => Promise<void>;
  prevStep: () => void;
  setScript: (script: string) => void;
  generateScriptWithAi: () => Promise<void>;
  patchSettings: (patch: Partial<StoryboardProjectSettings>) => void;
  addInputReference: (
    kind: StoryboardInputReferenceKind,
    file: File
  ) => Promise<void>;
  removeInputReference: (id: string) => void;
  updateInputReferenceLabel: (id: string, label: string) => void;
  setSelectedSceneId: (id: string | null) => void;
  setViewMode: (mode: StoryboardViewMode) => void;
  updateScene: (id: string, patch: Partial<StoryboardScene>) => void;
  addScene: () => void;
  deleteScene: (id: string) => void;
  duplicateScene: (id: string) => void;
  moveScene: (id: string, direction: -1 | 1) => void;
  reorderScene: (fromIndex: number, toIndex: number) => void;
  mergeScenes: (aId: string, bId: string) => void;
  splitScene: (id: string) => void;
  bulkPasteScenes: (text: string) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  generateBreakdown: () => Promise<void>;
  generateAllFrames: (onlyMissing?: boolean) => Promise<void>;
  regenerateFrames: (sceneIds?: string[]) => Promise<void>;
  generateFrame: (sceneId: string) => Promise<void>;
  setStoryboardImageModel: (model: string, aspectRatio?: AspectRatio) => void;
  setStoryboardVideoModels: (
    primary: string,
    fallback: string | null,
    aspectRatio?: string
  ) => void;
  generateStoryboardVideo: (options?: {
    replace?: boolean;
    videoAspectRatio?: string;
  }) => Promise<void>;
  generateSceneVideos: (
    sceneIds: string[],
    options?: { videoAspectRatio?: string }
  ) => Promise<void>;
  stitchSceneAnimations: () => Promise<void>;
  checkPendingStoryboardVideo: () => Promise<void>;
  isFrameBusy: (sceneId: string) => boolean;
  isSceneVideoBusy: (sceneId: string) => boolean;
  isAnyVideoGenerating: () => boolean;
  resetStoryboard: () => void;
  loadStoryboardConversation: (id: string) => Promise<void>;
  refreshStoryboardVideos: () => Promise<void>;
  loadDraft: () => void;
  saveDraft: () => void;
}

function storageFolderId(
  conversationId: string | null,
  projectId: string
): string {
  return conversationId?.trim() || projectId;
}

function storyboardTitle(script: string): string {
  const trimmed = script.trim();
  if (!trimmed) return "Storyboard";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

function cloneScenes(scenes: StoryboardScene[]): StoryboardScene[] {
  return scenes.map((s) => ({ ...s }));
}

function isVideoTimeoutError(message: string): boolean {
  return /timed out|timeout/i.test(message);
}

function isRetryableVideoClientError(message: string): boolean {
  return (
    isVideoTimeoutError(message) ||
    /network error|fetch failed|high load|rate limit|temporarily unavailable/i.test(
      message
    )
  );
}

function pickStoryboardVideoModelFromSegments(models: string[]): string | null {
  if (!models.length) return null;
  const counts = new Map<string, number>();
  for (const id of models) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best = models[0]!;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

async function fetchStoryboardVideoSegment(
  payload: Record<string, unknown>,
  segmentLabel: string
): Promise<{
  videoUrl: string;
  storagePath: string | null;
  durationSec: number;
  model: string | null;
  bridgeFrameUrl?: string;
}> {
  let lastError = "Video generation failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("/api/storyboard/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      videoUrl?: string;
      storagePath?: string;
      durationSec?: number;
      model?: string;
      bridgeFrameUrl?: string;
      error?: string;
    };
    if (res.ok && data.videoUrl) {
      return {
        videoUrl: data.videoUrl,
        storagePath: data.storagePath ?? null,
        durationSec: data.durationSec ?? 0,
        model: data.model?.trim() ?? null,
        bridgeFrameUrl: data.bridgeFrameUrl?.trim() || undefined,
      };
    }
    lastError = data.error ?? "Video generation failed";
    if (attempt === 0 && isRetryableVideoClientError(lastError)) {
      continue;
    }
    throw new Error(`${segmentLabel}: ${lastError}`);
  }
  throw new Error(`${segmentLabel}: ${lastError}`);
}

/** Keep localStorage small — never persist base64 blobs or expiring signed URLs. */
function scenesForDraft(scenes: StoryboardScene[]): StoryboardScene[] {
  return scenes.map((scene) => ({
    ...scene,
    frameImageUrl:
      scene.frameImageUrl?.startsWith("data:") ? undefined : scene.frameImageUrl,
    sceneVideoUrl: undefined,
  }));
}

function readDraftScenesForConversation(
  conversationId: string
): StoryboardScene[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const draft = JSON.parse(raw) as {
      conversationId?: string;
      scenes?: StoryboardScene[];
    };
    if (draft.conversationId !== conversationId || !draft.scenes?.length) {
      return [];
    }
    return draft.scenes.map((scene) => ({
      ...scene,
      ...normalizeSceneFields(scene),
    }));
  } catch {
    return [];
  }
}

let sceneEditSyncTimer: ReturnType<typeof setTimeout> | null = null;

export const useStoryboardStore = create<StoryboardState>((set, get) => {
  const storyboardSettingsForPersist = (): StoryboardProjectSettings => {
    const s = get();
    return {
      ...s.settings,
      imageAspectRatio: s.imageAspectRatio,
      imagePrimaryModel: s.imagePrimaryModel,
      videoAspectRatio: s.videoAspectRatio,
      videoPrimaryModel: s.videoPrimaryModel,
      videoFallbackModel: s.videoFallbackModel,
    };
  };

  const syncStoryboardToHistory = async () => {
    const s = get();
    if (s.isCommitting || !s.script.trim() || !s.scenes.length) return;

    set({ isCommitting: true, error: null });
    try {
      const { conversationId } = await commitStoryboard({
        conversationId: s.conversationId,
        script: s.script,
        settings: storyboardSettingsForPersist(),
        continuity: s.continuity,
        scenes: s.scenes,
        singleVideoStoragePath: s.singleVideoStoragePath,
        stitchedVideoStoragePath: s.stitchedVideoStoragePath,
        sceneStitchedVideoStoragePath: s.sceneStitchedVideoStoragePath,
        singleVideoDurationSec: s.storyboardVideoDurationSec,
        stitchedVideoDurationSec: null,
        sceneStitchedVideoDurationSec: s.sceneStitchedVideoDurationSec,
      });

      useWorkspaceStore.getState().upsertConversationInList({
        id: conversationId,
        title: storyboardTitle(s.script),
        prompt: s.script,
        mediaType: "storyboard",
      });
      useWorkspaceStore.setState({ activeConversationId: conversationId });

      set({ conversationId, isCommitting: false });
      get().saveDraft();
    } catch (err) {
      set({
        isCommitting: false,
        error:
          err instanceof Error ? err.message : "Failed to save storyboard",
      });
    }
  };

  /** Lock wizard and create/update history as soon as the viewer (step 4) opens. */
  const enterStep4 = async () => {
    const hadHistory = Boolean(get().conversationId);
    set({ step: 4, wizardLocked: true, error: null });
    if (!hadHistory) {
      await syncStoryboardToHistory();
    }
  };

  const persistVideoOutputs = async (
    patch: Parameters<typeof patchStoryboardOutputs>[1]
  ) => {
    const { conversationId, wizardLocked } = get();
    if (!conversationId || !wizardLocked) return;
    try {
      await patchStoryboardOutputs(conversationId, patch);
      set((s) => ({
        singleVideoStoragePath:
          patch.singleVideoStoragePath !== undefined
            ? patch.singleVideoStoragePath
            : s.singleVideoStoragePath,
        stitchedVideoStoragePath:
          patch.stitchedVideoStoragePath !== undefined
            ? patch.stitchedVideoStoragePath
            : s.stitchedVideoStoragePath,
        sceneStitchedVideoStoragePath:
          patch.sceneStitchedVideoStoragePath !== undefined
            ? patch.sceneStitchedVideoStoragePath
            : s.sceneStitchedVideoStoragePath,
      }));
      get().saveDraft();
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to save video to history",
      });
    }
  };

  return {
  step: 1,
  script: "",
  settings: { ...DEFAULT_SETTINGS },
  continuity: null,
  scenes: [],
  selectedSceneId: null,
  viewMode: "grid",
  isBreakingDown: false,
  isInferringEnvironment: false,
  isGeneratingScript: false,
  isGeneratingFrames: false,
  generationProgress: 0,
  isGeneratingVideo: false,
  videoProgress: 0,
  videoGenerationStatus: null,
  storyboardVideoUrl: null,
  storyboardVideoDurationSec: null,
  storyboardVideoModel: null,
  imagePrimaryModel: STORYBOARD_IMAGE_MODEL,
  imageAspectRatio: STORYBOARD_DEFAULT_IMAGE_ASPECT,
  videoPrimaryModel: STORYBOARD_VIDEO_MODEL,
  videoFallbackModel: defaultStoryboardVideoFallbackModel(),
  videoAspectRatio: STORYBOARD_DEFAULT_IMAGE_ASPECT,
  isGeneratingStitchedVideo: false,
  stitchedVideoProgress: 0,
  stitchedVideoStatus: null,
  sceneStitchedVideoUrl: null,
  sceneStitchedVideoDurationSec: null,
  storyboardProjectId: crypto.randomUUID(),
  conversationId: null,
  wizardLocked: false,
  isCommitting: false,
  singleVideoStoragePath: null,
  stitchedVideoStoragePath: null,
  sceneStitchedVideoStoragePath: null,
  frameGenerationEpoch: {},
  sceneVideoGenerationEpoch: {},
  videoGenerationEpoch: 0,
  stitchedVideoGenerationEpoch: 0,
  error: null,
  history: [[]],
  historyIndex: 0,

  setStep: (step) => {
    if (get().wizardLocked && step < 4) return;
    set({ step, error: null });
    get().saveDraft();
  },
  nextStep: () => {
    if (get().wizardLocked) return;
    const step = get().step;
    if (step < 4) set({ step: (step + 1) as StoryboardWizardStep, error: null });
    get().saveDraft();
  },
  goToProjectSettings: async () => {
    if (get().wizardLocked) return;
    const script = get().script.trim();
    if (!script) {
      set({ error: "Enter a script before continuing." });
      return;
    }
    set({ isInferringEnvironment: true, error: null });
    try {
      const res = await fetch("/api/storyboard/infer-environment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const data = (await res.json()) as { sceneEnvironment?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to infer scene environment");
      }
      set((s) => ({
        settings: {
          ...s.settings,
          sceneEnvironment: data.sceneEnvironment?.trim() ?? "",
        },
        step: 2,
      }));
      get().saveDraft();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to infer scene environment";
      set((s) => ({
        settings: { ...s.settings, sceneEnvironment: "" },
        step: 2,
        error: `${message} You can fill in scene environment manually below.`,
      }));
      get().saveDraft();
    } finally {
      set({ isInferringEnvironment: false });
    }
  },
  prevStep: () => {
    if (get().wizardLocked) return;
    const step = get().step;
    if (step > 1) set({ step: (step - 1) as StoryboardWizardStep, error: null });
  },

  setScript: (script) => {
    set({ script });
    get().saveDraft();
  },

  generateScriptWithAi: async () => {
    set({ isGeneratingScript: true, error: null });
    try {
      const res = await fetch("/api/storyboard/generate-script", {
        method: "POST",
      });
      const data = (await res.json()) as { script?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate script");
      }
      const script = data.script?.trim();
      if (!script) {
        throw new Error("AI returned an empty script. Please try again.");
      }
      set({ script });
      get().saveDraft();
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to generate script",
      });
    } finally {
      set({ isGeneratingScript: false });
    }
  },

  patchSettings: (patch) => {
    set((s) => {
      const settings = {
        ...s.settings,
        ...patch,
        ...(patch.frameStyle !== undefined
          ? { frameStyle: normalizeFrameStyle(patch.frameStyle) }
          : {}),
        ...(patch.frameCount !== undefined
          ? { frameCount: normalizeFrameCount(patch.frameCount) }
          : {}),
      };
      const scenes =
        patch.sceneEnvironment !== undefined && s.scenes.length
          ? s.scenes.map((scene) => ({
              ...scene,
              environment: settings.sceneEnvironment,
            }))
          : s.scenes;
      return { settings, scenes };
    });
    get().saveDraft();
  },

  addInputReference: async (kind, file) => {
    const state = get();
    const refs = state.settings.inputReferences ?? [];
    if (storyboardInputReferenceSlotsLeft(refs) <= 0) return;

    const id = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    const optimistic = {
      id,
      kind,
      name: file.name,
      previewUrl,
      sizeBytes: file.size,
    };

    set((s) => ({
      error: null,
      settings: {
        ...s.settings,
        inputReferences: [...(s.settings.inputReferences ?? []), optimistic],
      },
    }));

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", state.storyboardProjectId);
      form.append("refId", id);
      form.append("kind", kind);
      form.append("currentCount", String(refs.length));
      form.append(
        "currentTotalBytes",
        String(refs.reduce((sum, ref) => sum + ref.sizeBytes, 0))
      );

      const res = await fetch("/api/storyboard/upload-reference", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        signedUrl?: string;
        storagePath?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Reference upload failed");
      }

      URL.revokeObjectURL(previewUrl);
      set((s) => ({
        settings: {
          ...s.settings,
          inputReferences: (s.settings.inputReferences ?? []).map((ref) =>
            ref.id === id
              ? {
                  ...ref,
                  previewUrl: data.signedUrl as string,
                  imageUrl: data.signedUrl as string,
                  storagePath: data.storagePath as string,
                }
              : ref
          ),
        },
      }));
      get().saveDraft();
      const resolvedModel = resolveStoryboardImageModel(get().imagePrimaryModel);
      if (resolvedModel !== get().imagePrimaryModel) {
        get().setStoryboardImageModel(resolvedModel);
      }
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      set((s) => ({
        settings: {
          ...s.settings,
          inputReferences: (s.settings.inputReferences ?? []).filter(
            (ref) => ref.id !== id
          ),
        },
        error:
          err instanceof Error ? err.message : "Reference upload failed",
      }));
    }
  },

  removeInputReference: (id) => {
    const ref = (get().settings.inputReferences ?? []).find(
      (item) => item.id === id
    );
    if (ref?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(ref.previewUrl);
    }
    set((s) => ({
      settings: {
        ...s.settings,
        inputReferences: (s.settings.inputReferences ?? []).filter(
          (item) => item.id !== id
        ),
      },
    }));
    get().saveDraft();
  },

  updateInputReferenceLabel: (id, label) => {
    const next = sanitizeStoryboardInputReferenceLabel(label);
    set((s) => ({
      settings: {
        ...s.settings,
        inputReferences: (s.settings.inputReferences ?? []).map((ref) =>
          ref.id === id ? { ...ref, label: next || undefined } : ref
        ),
      },
    }));
    get().saveDraft();
  },

  setSelectedSceneId: (id) => set({ selectedSceneId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),

  pushHistory: () => {
    const { scenes, history, historyIndex } = get();
    const next = history.slice(0, historyIndex + 1);
    next.push(cloneScenes(scenes));
    set({ history: next, historyIndex: next.length - 1 });
  },

  updateScene: (id, patch) => {
    get().pushHistory();
    set((s) => ({
      scenes: s.scenes.map((scene) =>
        scene.id === id ? { ...scene, ...patch } : scene
      ),
    }));
    get().saveDraft();
    const { wizardLocked, conversationId } = get();
    if (wizardLocked && conversationId) {
      if (sceneEditSyncTimer) clearTimeout(sceneEditSyncTimer);
      sceneEditSyncTimer = setTimeout(() => {
        sceneEditSyncTimer = null;
        void syncStoryboardToHistory();
      }, 1500);
    }
  },

  addScene: () => {
    get().pushHistory();
    set((s) => {
      const empty = createEmptyScene(s.scenes.length + 1);
      empty.environment = s.settings.sceneEnvironment;
      const next = [...s.scenes, empty];
      return {
        scenes: renumberScenes(next),
        selectedSceneId: next[next.length - 1]?.id ?? null,
      };
    });
    get().saveDraft();
  },

  deleteScene: (id) => {
    get().pushHistory();
    set((s) => {
      const next = renumberScenes(s.scenes.filter((scene) => scene.id !== id));
      return {
        scenes: next,
        selectedSceneId:
          s.selectedSceneId === id ? (next[0]?.id ?? null) : s.selectedSceneId,
      };
    });
    get().saveDraft();
  },

  duplicateScene: (id) => {
    get().pushHistory();
    set((s) => {
      const index = s.scenes.findIndex((scene) => scene.id === id);
      if (index < 0) return s;
      const copy: StoryboardScene = {
        ...s.scenes[index],
        id: crypto.randomUUID(),
        frameImageUrl: undefined,
        frameStatus: "pending",
        frameError: undefined,
      };
      const next = [...s.scenes];
      next.splice(index + 1, 0, copy);
      return { scenes: renumberScenes(next), selectedSceneId: copy.id };
    });
    get().saveDraft();
  },

  moveScene: (id, direction) => {
    set((s) => {
      const index = s.scenes.findIndex((scene) => scene.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= s.scenes.length) return s;
      get().pushHistory();
      const next = [...s.scenes];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { scenes: renumberScenes(next) };
    });
    get().saveDraft();
  },

  reorderScene: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    get().pushHistory();
    set((s) => {
      const next = [...s.scenes];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return { scenes: renumberScenes(next) };
    });
    get().saveDraft();
  },

  mergeScenes: (aId, bId) => {
    get().pushHistory();
    set((s) => {
      const a = s.scenes.find((scene) => scene.id === aId);
      const b = s.scenes.find((scene) => scene.id === bId);
      if (!a || !b) return s;
      const merged: StoryboardScene = {
        ...a,
        durationSec: a.durationSec + b.durationSec,
        voiceover: `${a.voiceover}\n${b.voiceover}`.trim(),
        visualDescription: `${a.visualDescription} ${b.visualDescription}`.trim(),
        imagePrompt: `${a.imagePrompt} ${b.imagePrompt}`.trim(),
        frameImageUrl: undefined,
        frameStatus: "pending",
      };
      const next = s.scenes
        .filter((scene) => scene.id !== bId)
        .map((scene) => (scene.id === aId ? merged : scene));
      return { scenes: renumberScenes(next), selectedSceneId: aId };
    });
    get().saveDraft();
  },

  splitScene: (id) => {
    get().pushHistory();
    set((s) => {
      const index = s.scenes.findIndex((scene) => scene.id === id);
      if (index < 0) return s;
      const original = s.scenes[index];
      const half = Math.max(2, Math.floor(original.durationSec / 2));
      const partA = { ...original, durationSec: half };
      const partB: StoryboardScene = {
        ...createEmptyScene(original.sceneNumber + 1),
        voiceover: "",
        visualDescription: "Continuation of previous scene",
        imagePrompt: `${original.imagePrompt} continuation shot`,
        durationSec: Math.max(2, original.durationSec - half),
      };
      const next = [...s.scenes];
      next.splice(index, 1, partA, partB);
      return { scenes: renumberScenes(next), selectedSceneId: partB.id };
    });
    get().saveDraft();
  },

  bulkPasteScenes: (text) => {
    const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return;
    get().pushHistory();
    set((s) => ({
      scenes: renumberScenes(
        blocks.map((block, index) => ({
          ...createEmptyScene(index + 1),
          voiceover: block,
          visualDescription: block,
          imagePrompt: `Storyboard scene: ${block}`,
        }))
      ),
      selectedSceneId: null,
    }));
    get().saveDraft();
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    set({ scenes: cloneScenes(history[nextIndex]), historyIndex: nextIndex });
    get().saveDraft();
  },

  redo: () => {
    const { history, historyIndex, history: h } = get();
    if (historyIndex >= h.length - 1) return;
    const nextIndex = historyIndex + 1;
    set({ scenes: cloneScenes(history[nextIndex]), historyIndex: nextIndex });
    get().saveDraft();
  },

  generateBreakdown: async () => {
    const { script, settings } = get();
    if (!script.trim()) {
      set({ error: "Enter a script before generating scenes." });
      return;
    }
    set({ isBreakingDown: true, error: null });
    try {
      const res = await fetch("/api/storyboard/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Breakdown failed");
      const scenes = (data.scenes ?? []) as StoryboardScene[];
      const continuity = (data.continuity ?? null) as StoryboardContinuity | null;
      set({
        scenes,
        continuity,
        selectedSceneId: scenes[0]?.id ?? null,
        history: [cloneScenes(scenes)],
        historyIndex: 0,
        step: 3,
      });
      get().saveDraft();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Scene breakdown failed",
      });
    } finally {
      set({ isBreakingDown: false });
    }
  },

  isFrameBusy: (sceneId) => {
    const s = get();
    if (s.isGeneratingFrames) return true;
    const scene = s.scenes.find((item) => item.id === sceneId);
    return scene?.frameStatus === "generating";
  },

  generateFrame: async (sceneId) => {
    const state = get();
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    if (!scene.imagePrompt.trim() && !scene.visualDescription.trim()) return;
    if (scene.frameStatus === "generating") return;

    const epoch = (state.frameGenerationEpoch[sceneId] ?? 0) + 1;
    set((s) => ({
      frameGenerationEpoch: { ...s.frameGenerationEpoch, [sceneId]: epoch },
      error: null,
      scenes: s.scenes.map((item) =>
        item.id === sceneId
          ? { ...item, frameStatus: "generating" as const, frameError: undefined }
          : item
      ),
    }));

    try {
      const { settings, continuity, scenes } = get();
      const current = scenes.find((s) => s.id === sceneId);
      if (!current) return;

      const referenceScenes = getStoryboardReferenceScenes(scenes, sceneId);
      const { conversationId, storyboardProjectId } = get();
      const res = await fetch("/api/storyboard/generate-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          storageConversationId: storageFolderId(
            conversationId,
            storyboardProjectId
          ),
          sceneNumber: current.sceneNumber,
          imagePrompt: current.imagePrompt,
          visualDescription: current.visualDescription,
          cameraDirection: current.cameraDirection,
          characterActions: current.characterActions,
          environment: settings.sceneEnvironment || current.environment,
          genre: settings.genre,
          frameStyle: settings.frameStyle,
          continuity: continuity ?? buildDefaultContinuity(settings),
          referenceFrames: referenceScenes.map((refScene) => ({
            frameImageUrl: refScene.frameImageUrl,
            frameStoragePath: refScene.frameStoragePath,
          })),
          imageModel: resolveStoryboardImageModel(get().imagePrimaryModel),
          aspectRatio: get().imageAspectRatio,
          inputReferences: settings.inputReferences ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Frame generation failed");

      if (get().frameGenerationEpoch[sceneId] !== epoch) return;

      set((s) => ({
        scenes: s.scenes.map((item) =>
          item.id === sceneId
            ? {
                ...item,
                frameImageUrl: data.imageUrl as string,
                frameStoragePath:
                  (data.storagePath as string | undefined) ??
                  item.frameStoragePath,
                frameStatus: "complete" as const,
              }
            : item
        ),
      }));
      get().saveDraft();
      if (get().wizardLocked && get().conversationId) {
        await syncStoryboardToHistory();
      }
    } catch (err) {
      if (get().frameGenerationEpoch[sceneId] !== epoch) return;
      const message =
        err instanceof Error ? err.message : "Frame generation failed";
      set((s) => ({
        scenes: s.scenes.map((item) =>
          item.id === sceneId
            ? { ...item, frameStatus: "error" as const, frameError: message }
            : item
        ),
        error: message,
      }));
    }
  },

  isSceneVideoBusy: (sceneId) => {
    const scene = get().scenes.find((item) => item.id === sceneId);
    return scene?.sceneVideoStatus === "generating";
  },

  isAnyVideoGenerating: () => {
    const s = get();
    if (s.isGeneratingVideo) return true;
    return s.scenes.some((scene) => scene.sceneVideoStatus === "generating");
  },

  generateSceneVideos: async (sceneIds, options) => {
    const uniqueIds = [...new Set(sceneIds)].filter(Boolean);
    if (!uniqueIds.length) return;

    const ordered = get()
      .scenes.filter((scene) => uniqueIds.includes(scene.id))
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    if (!ordered.length) return;

    const blocked = ordered.find(
      (scene) =>
        !scene.frameImageUrl ||
        scene.frameStatus !== "complete" ||
        scene.sceneVideoStatus === "generating"
    );
    if (blocked) {
      if (!blocked.frameImageUrl || blocked.frameStatus !== "complete") {
        set({
          error: `Scene ${blocked.sceneNumber} needs a frame image before animation.`,
        });
      }
      return;
    }

    const {
      script,
      settings,
      continuity,
      storyboardProjectId,
      conversationId,
      videoPrimaryModel,
      videoFallbackModel,
      videoAspectRatio,
      imageAspectRatio,
    } = get();

    const storageFolder = storageFolderId(conversationId, storyboardProjectId);
    const totalScenes = get().scenes.length;
    const aspect =
      options?.videoAspectRatio?.trim() ||
      videoAspectRatio ||
      settings.videoAspectRatio ||
      imageAspectRatio;

    set({ error: null });

    const epochs: Record<string, number> = {};
    for (const scene of ordered) {
      epochs[scene.id] = (get().sceneVideoGenerationEpoch[scene.id] ?? 0) + 1;
    }

    set((s) => ({
      sceneVideoGenerationEpoch: { ...s.sceneVideoGenerationEpoch, ...epochs },
      scenes: s.scenes.map((item) =>
        epochs[item.id] != null
          ? {
              ...item,
              sceneVideoStatus: "generating" as const,
              sceneVideoError: undefined,
            }
          : item
      ),
    }));

    const generateOne = async (scene: (typeof ordered)[number]) => {
      const epoch = epochs[scene.id]!;
      try {
        const res = await fetch("/api/storyboard/generate-scene-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneId: scene.id,
            scene,
            script,
            settings,
            continuity,
            totalScenes,
            storageConversationId: storageFolder,
            projectId: storyboardProjectId,
            videoPrimaryModel,
            videoFallbackModel,
            videoAspectRatio: aspect,
            frameAspectRatio: imageAspectRatio,
          }),
        });
        const data = (await res.json()) as {
          videoUrl?: string;
          storagePath?: string;
          durationSec?: number;
          model?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Scene animation failed");
        }

        if (get().sceneVideoGenerationEpoch[scene.id] !== epoch) return;

        set((s) => ({
          scenes: s.scenes.map((item) =>
            item.id === scene.id
              ? {
                  ...item,
                  sceneVideoUrl: data.videoUrl as string,
                  sceneVideoStoragePath:
                    (data.storagePath as string | undefined) ??
                    item.sceneVideoStoragePath,
                  sceneVideoDurationSec: data.durationSec ?? item.durationSec,
                  sceneVideoStatus: "complete" as const,
                  sceneVideoModel: data.model ?? item.sceneVideoModel,
                }
              : item
          ),
        }));
      } catch (err) {
        if (get().sceneVideoGenerationEpoch[scene.id] !== epoch) return;
        const message =
          err instanceof Error ? err.message : "Scene animation failed";
        set((s) => ({
          scenes: s.scenes.map((item) =>
            item.id === scene.id
              ? {
                  ...item,
                  sceneVideoStatus: "error" as const,
                  sceneVideoError: message,
                }
              : item
          ),
          error: `Scene ${scene.sceneNumber}: ${message}`,
        }));
      }
    };

    await runWithConcurrency(ordered, ordered.length, (scene) =>
      generateOne(scene)
    );

    get().saveDraft();
    if (get().wizardLocked && get().conversationId) {
      await syncStoryboardToHistory();
    }
  },

  stitchSceneAnimations: async () => {
    const ordered = [...get().scenes].sort(
      (a, b) => a.sceneNumber - b.sceneNumber
    );
    if (!ordered.length) return;

    const missing = ordered.filter(
      (scene) =>
        !scene.sceneVideoUrl || scene.sceneVideoStatus !== "complete"
    );
    if (missing.length) {
      set({
        error: `Animate all scenes before stitching (${missing.length} still missing).`,
      });
      return;
    }

    const epoch = get().stitchedVideoGenerationEpoch + 1;
    set({
      stitchedVideoGenerationEpoch: epoch,
      isGeneratingStitchedVideo: true,
      stitchedVideoProgress: 10,
      stitchedVideoStatus: "Stitching scene clips…",
      error: null,
    });

    const clipUrls = ordered.map((scene) => scene.sceneVideoUrl as string);
    const clipStoragePaths = ordered.map((scene) => scene.sceneVideoStoragePath);
    const totalDurationSec = ordered.reduce(
      (sum, scene) => sum + (scene.sceneVideoDurationSec ?? scene.durationSec),
      0
    );
    const { storyboardProjectId, conversationId } = get();
    const storageFolder = storageFolderId(conversationId, storyboardProjectId);

    try {
      set({ stitchedVideoProgress: 35 });
      const stitchRes = await fetch("/api/storyboard/stitch-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: storyboardProjectId,
          storageConversationId: storageFolder,
          clipUrls,
          clipStoragePaths,
          totalDurationSec,
          outputKind: "scene-stitch",
        }),
      });
      const stitchData = await readJsonResponse<{
        videoUrl?: string;
        storagePath?: string;
        durationSec?: number | null;
        error?: string;
      }>(stitchRes);
      if (!stitchRes.ok) {
        throw new Error(stitchData.error ?? "Scene stitch failed");
      }
      if (get().stitchedVideoGenerationEpoch !== epoch) return;

      const durationSec =
        stitchData.durationSec != null && stitchData.durationSec > 0
          ? stitchData.durationSec
          : totalDurationSec;

      const storagePath = stitchData.storagePath as string | undefined;

      set({
        sceneStitchedVideoUrl: stitchData.videoUrl as string,
        sceneStitchedVideoDurationSec: durationSec,
        sceneStitchedVideoStoragePath: storagePath ?? get().sceneStitchedVideoStoragePath,
        isGeneratingStitchedVideo: false,
        stitchedVideoProgress: 100,
        stitchedVideoStatus: null,
      });
      get().saveDraft();

      if (storagePath && get().conversationId) {
        await persistVideoOutputs({
          sceneStitchedVideoStoragePath: storagePath,
          sceneStitchedVideoDurationSec: durationSec,
        });
      }
    } catch (err) {
      if (get().stitchedVideoGenerationEpoch !== epoch) return;
      set({
        isGeneratingStitchedVideo: false,
        stitchedVideoProgress: 0,
        stitchedVideoStatus: null,
        error: err instanceof Error ? err.message : "Scene stitch failed",
      });
    }
  },

  setStoryboardImageModel: (model, aspectRatio) => {
    const resolved = resolveStoryboardImageModel(model);
    const imageAspectRatio = clampStoryboardImageAspectRatio(
      resolved,
      aspectRatio ?? get().imageAspectRatio
    );
    set((s) => ({
      imagePrimaryModel: resolved,
      imageAspectRatio,
      settings: {
        ...s.settings,
        imagePrimaryModel: resolved,
        imageAspectRatio,
      },
    }));
    get().saveDraft();
  },

  setStoryboardVideoModels: (primary, fallback, aspectRatio) => {
    const catalog = getVideoModelsCatalog();
    const resolved =
      pickStoryboardHumanFrameFallback(primary, catalog, fallback) ??
      STORYBOARD_VIDEO_HUMAN_FALLBACK_MODEL;
    const frameAspect =
      get().settings.imageAspectRatio ?? get().imageAspectRatio;
    const videoAspectRatio = resolveStoryboardVideoAspectRatio(primary, {
      frameAspectRatio: frameAspect,
      videoAspectRatio: aspectRatio ?? get().videoAspectRatio,
    });
    set((s) => ({
      videoPrimaryModel: primary,
      videoFallbackModel: resolved !== primary ? resolved : null,
      videoAspectRatio,
      settings: {
        ...s.settings,
        videoPrimaryModel: primary,
        videoFallbackModel: resolved !== primary ? resolved : null,
        videoAspectRatio,
      },
    }));
    get().saveDraft();
  },

  generateStoryboardVideo: async (options) => {
    const {
      scenes,
      script,
      settings,
      continuity,
      storyboardProjectId,
      conversationId,
      isGeneratingFrames,
      storyboardVideoUrl,
      singleVideoStoragePath,
      videoPrimaryModel,
      videoFallbackModel,
      videoAspectRatio,
      imageAspectRatio,
    } = get();
    const frameAspectRatio =
      settings.imageAspectRatio ?? imageAspectRatio;
    const selectedVideoAspect =
      options?.videoAspectRatio?.trim() ||
      settings.videoAspectRatio ||
      videoAspectRatio;
    if (get().isAnyVideoGenerating() || isGeneratingFrames) return;

    if (
      isPendingVideoForConversation(conversationId, "single") &&
      !storyboardVideoUrl
    ) {
      set({
        error:
          "Video generation may still be running. Wait a few minutes or use Check for video — do not start again or you may be charged twice.",
      });
      return;
    }

    if (
      !options?.replace &&
      (storyboardVideoUrl || singleVideoStoragePath)
    ) {
      set({
        error:
          "A video already exists for this storyboard. Use Regenerate video if you want a new one.",
      });
      return;
    }

    const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    const missing = ordered.filter((s) => !s.frameImageUrl?.trim());
    if (missing.length) {
      set({
        error: `Generate all frame images first (missing scene ${missing[0].sceneNumber}).`,
      });
      return;
    }
    if (!ordered.length) return;

    const epoch = get().videoGenerationEpoch + 1;
    const batches = chunkStoryboardScenesForVideo(ordered);
    const batched = batches.length > 1;
    const storyboardDurationSec = ordered.reduce(
      (sum, s) => sum + s.durationSec,
      0
    );
    const storageFolder = storageFolderId(conversationId, storyboardProjectId);

    if (conversationId) {
      markPendingVideo(conversationId, "single");
    }

    set({
      videoGenerationEpoch: epoch,
      isGeneratingVideo: true,
      videoProgress: 4,
      videoGenerationStatus: batched
        ? `Generating ${batches.length} segments sequentially for continuity…`
        : "Generating video…",
      error: null,
      ...(options?.replace
        ? {
            storyboardVideoUrl: null,
            storyboardVideoDurationSec: null,
            storyboardVideoModel: null,
            singleVideoStoragePath: null,
          }
        : {}),
    });

    let stopProgress = () => {};

    try {
      const maxBatchDuration = Math.max(
        ...batches.map((batch) => pickStoryboardBatchDuration(batch))
      );

      set({
        videoGenerationStatus: batched
          ? `Generating segment 1 of ${batches.length} (sequential for continuity)…`
          : "Generating video…",
        videoProgress: 8,
      });

      stopProgress = startEstimatedVideoProgress(
        estimateVideoGenerationMs(maxBatchDuration, { multiFrameRefs: true }) *
          batches.length,
        (percent) => {
          if (get().isGeneratingVideo && get().videoGenerationEpoch === epoch) {
            set({ videoProgress: Math.min(85, Math.round(8 + percent * 0.77)) });
          }
        },
        () => get().videoProgress
      );

      const segmentResults: {
        index: number;
        videoUrl: string;
        storagePath: string | null;
        durationSec: number;
        model: string | null;
      }[] = [];
      let bridgeFrameUrl: string | undefined;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]!;
        const batchDuration = pickStoryboardBatchDuration(batch);
        const segmentLabel = `Segment ${i + 1} (scenes ${batch[0].sceneNumber}–${batch[batch.length - 1].sceneNumber})`;
        const previousBatch = i > 0 ? batches[i - 1] : undefined;
        const previousScene = previousBatch?.[previousBatch.length - 1];

        if (batched) {
          set({
            videoGenerationStatus:
              i === 0
                ? `Generating segment 1 of ${batches.length}…`
                : `Generating segment ${i + 1} of ${batches.length} (matching previous shot)…`,
          });
        }

        const result = await fetchStoryboardVideoSegment(
          {
            projectId: storyboardProjectId,
            storageConversationId: storageFolder,
            scenes: batch,
            script,
            settings,
            continuity,
            videoDurationSec: batchDuration,
            videoPrimaryModel,
            videoFallbackModel,
            videoAspectRatio: selectedVideoAspect,
            frameAspectRatio,
            bridgeFrameUrl,
            batch: batched
              ? {
                  index: i,
                  total: batches.length,
                  totalScenes: ordered.length,
                  previousScene: previousScene
                    ? {
                        sceneNumber: previousScene.sceneNumber,
                        visualDescription: previousScene.visualDescription,
                        voiceover: previousScene.voiceover,
                        transition: previousScene.transition,
                      }
                    : undefined,
                }
              : undefined,
          },
          segmentLabel
        );

        bridgeFrameUrl = result.bridgeFrameUrl;
        segmentResults.push({
          index: i,
          videoUrl: result.videoUrl,
          storagePath: result.storagePath,
          durationSec: result.durationSec,
          model: result.model,
        });

        if (get().videoGenerationEpoch !== epoch) return;
      }

      if (get().videoGenerationEpoch !== epoch) return;
      stopProgress();

      segmentResults.sort((a, b) => a.index - b.index);
      const segmentUrls = segmentResults.map((r) => r.videoUrl);
      const lastSegmentStoragePath =
        segmentResults[segmentResults.length - 1]?.storagePath ?? null;

      let finalVideoUrl = segmentUrls[0]!;
      let finalStoragePath = lastSegmentStoragePath;
      let finalDuration = segmentResults.reduce(
        (sum, r) => sum + r.durationSec,
        0
      );

      const uniqueSegmentUrls = [...new Set(segmentUrls)];
      if (
        uniqueSegmentUrls.length > 1 &&
        uniqueSegmentUrls.length === segmentUrls.length
      ) {
        set({
          videoGenerationStatus:
            "Stitching segments and adding unified voiceover…",
          videoProgress: 90,
        });

        const segmentStoragePaths = segmentResults.map((r) => r.storagePath);
        const stitchRes = await fetch("/api/storyboard/stitch-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: storyboardProjectId,
            storageConversationId: storageFolder,
            clipUrls: uniqueSegmentUrls,
            clipStoragePaths: segmentStoragePaths,
            totalDurationSec: finalDuration,
            outputKind: "full",
            scenes: ordered,
            genre: settings.genre,
          }),
        });
        const stitchData = await readJsonResponse<{
          videoUrl?: string;
          storagePath?: string;
          durationSec?: number | null;
          error?: string;
        }>(stitchRes);
        if (!stitchRes.ok) {
          throw new Error(stitchData.error ?? "Video stitching failed");
        }
        if (get().videoGenerationEpoch !== epoch) return;

        finalVideoUrl = stitchData.videoUrl as string;
        finalStoragePath =
          (stitchData.storagePath as string | undefined) ?? null;
        if (stitchData.durationSec != null && stitchData.durationSec > 0) {
          finalDuration = stitchData.durationSec;
        }
      } else if (
        uniqueSegmentUrls.length === 1 &&
        segmentUrls.length > 1
      ) {
        throw new Error(
          "Video segments were identical — generation could not produce distinct clips. Try Regenerate video."
        );
      }

      const segmentModels = segmentResults
        .map((r) => r.model)
        .filter((m): m is string => !!m);

      stopProgress();
      clearPendingVideo();
      set({
        storyboardVideoUrl: finalVideoUrl,
        storyboardVideoDurationSec: finalDuration,
        storyboardVideoModel: pickStoryboardVideoModelFromSegments(segmentModels),
        singleVideoStoragePath: finalStoragePath,
        isGeneratingVideo: false,
        videoProgress: 100,
        videoGenerationStatus: null,
      });
      get().saveDraft();
      if (finalStoragePath && get().conversationId) {
        await persistVideoOutputs({
          singleVideoStoragePath: finalStoragePath,
          singleVideoDurationSec: finalDuration,
        });
      }
    } catch (err) {
      stopProgress();
      clearPendingVideo();
      if (get().videoGenerationEpoch !== epoch) return;
      set({
        isGeneratingVideo: false,
        videoGenerationStatus: null,
        error: err instanceof Error ? err.message : "Video generation failed",
      });
    }
  },

  checkPendingStoryboardVideo: async () => {
    await get().refreshStoryboardVideos();
    const s = get();
    const pending = getPendingVideo();
    if (!pending || pending.conversationId !== s.conversationId) return;

    if (
      pending.kind === "single" &&
      (s.storyboardVideoUrl || s.singleVideoStoragePath)
    ) {
      clearPendingVideo();
      set({ error: null });
      return;
    }
    if (pending.kind === "stitched") {
      clearPendingVideo();
    }
  },

  regenerateFrames: async (sceneIds) => {
    if (get().isGeneratingFrames) return;

    const targets = sceneIds?.length
      ? sceneIds
      : get().scenes.map((s) => s.id);

    const ordered = get()
      .scenes.filter(
        (s) =>
          targets.includes(s.id) &&
          s.frameStatus !== "generating" &&
          (s.imagePrompt.trim() || s.visualDescription.trim())
      )
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    if (!ordered.length) return;

    set({ isGeneratingFrames: true, generationProgress: 0, error: null });
    for (let i = 0; i < ordered.length; i++) {
      await get().generateFrame(ordered[i].id);
      if (get().frameGenerationEpoch[ordered[i].id] !== undefined) {
        set({
          generationProgress: Math.round(((i + 1) / ordered.length) * 100),
        });
      }
    }
    set({ isGeneratingFrames: false, generationProgress: 100 });
    get().saveDraft();
    if (get().conversationId) {
      await syncStoryboardToHistory();
    }
  },

  generateAllFrames: async (onlyMissing = false) => {
    const allScenes = get().scenes;
    const scenes = onlyMissing
      ? allScenes.filter(
          (s) => !s.frameImageUrl || s.frameStatus === "pending" || s.frameStatus === "error"
        )
      : allScenes;
    if (!scenes.length) {
      if (!onlyMissing) return;
      await enterStep4();
      return;
    }
    const ordered = [...scenes]
      .filter((s) => s.frameStatus !== "generating")
      .sort((a, b) => a.sceneNumber - b.sceneNumber);
    if (!ordered.length) {
      await enterStep4();
      return;
    }
    await enterStep4();
    set({ isGeneratingFrames: true, generationProgress: 0, error: null });
    for (let i = 0; i < ordered.length; i++) {
      await get().generateFrame(ordered[i].id);
      set({ generationProgress: Math.round(((i + 1) / ordered.length) * 100) });
    }
    set({ isGeneratingFrames: false, generationProgress: 100 });
    get().saveDraft();
    if (get().conversationId) {
      await syncStoryboardToHistory();
    }
  },

  loadStoryboardConversation: async (id) => {
    const current = get();
    if (
      current.conversationId === id &&
      (current.isGeneratingVideo || current.isGeneratingStitchedVideo)
    ) {
      return;
    }
    if (current.conversationId !== id) {
      set({
        videoGenerationEpoch: current.videoGenerationEpoch + 1,
        stitchedVideoGenerationEpoch: current.stitchedVideoGenerationEpoch + 1,
      });
      const pending = getPendingVideo();
      if (pending && pending.conversationId !== id) {
        clearPendingVideo();
      }
    }
    set({ error: null });
    try {
      let loaded = await fetchStoryboard(id);
      let scenes = loaded.scenes;
      let recoveredFromDraft = false;
      let recoveredFromServer = false;

      if (!scenes.length) {
        const draftScenes = readDraftScenesForConversation(id);
        if (draftScenes.length) {
          scenes = draftScenes;
          recoveredFromDraft = true;
        } else {
          try {
            const recovery = await recoverStoryboard(id);
            if (recovery.recovered && recovery.storyboard?.scenes.length) {
              loaded = recovery.storyboard;
              scenes = loaded.scenes;
              recoveredFromServer = true;
            }
          } catch (recoveryErr) {
            console.warn(
              "[storyboard] Storage recovery failed",
              recoveryErr instanceof Error ? recoveryErr.message : recoveryErr
            );
          }
        }
      }

      set({
        conversationId: loaded.conversationId,
        wizardLocked: loaded.wizardLocked,
        script: loaded.script,
        settings: {
          ...DEFAULT_SETTINGS,
          ...loaded.settings,
          frameCount: normalizeFrameCount(loaded.settings.frameCount),
          frameStyle: normalizeFrameStyle(loaded.settings.frameStyle),
        },
        continuity: loaded.continuity,
        scenes,
        imagePrimaryModel: resolveStoryboardImageModel(
          loaded.settings.imagePrimaryModel
        ),
        imageAspectRatio: clampStoryboardImageAspectRatio(
          resolveStoryboardImageModel(loaded.settings.imagePrimaryModel),
          loaded.settings.imageAspectRatio ?? STORYBOARD_DEFAULT_IMAGE_ASPECT
        ),
        videoPrimaryModel:
          loaded.settings.videoPrimaryModel ?? STORYBOARD_VIDEO_MODEL,
        videoFallbackModel:
          loaded.settings.videoFallbackModel ??
          defaultStoryboardVideoFallbackModel(
            loaded.settings.videoPrimaryModel ?? STORYBOARD_VIDEO_MODEL
          ),
        videoAspectRatio: resolveStoryboardVideoAspectRatio(
          loaded.settings.videoPrimaryModel ?? STORYBOARD_VIDEO_MODEL,
          {
            frameAspectRatio:
              loaded.settings.imageAspectRatio ?? STORYBOARD_DEFAULT_IMAGE_ASPECT,
            videoAspectRatio:
              loaded.settings.videoAspectRatio ??
              loaded.settings.imageAspectRatio ??
              STORYBOARD_DEFAULT_IMAGE_ASPECT,
          }
        ),
        step: 4,
        selectedSceneId: scenes[0]?.id ?? null,
        viewMode: "grid",
        isBreakingDown: false,
        isGeneratingFrames: false,
        generationProgress: 100,
        isGeneratingVideo: false,
        videoProgress: 0,
        storyboardVideoUrl: loaded.storyboardVideoUrl,
        storyboardVideoDurationSec: loaded.storyboardVideoDurationSec,
        singleVideoStoragePath: loaded.singleVideoStoragePath,
        isGeneratingStitchedVideo: false,
        stitchedVideoProgress: 0,
        stitchedVideoStatus: null,
        sceneStitchedVideoUrl: loaded.sceneStitchedVideoUrl,
        sceneStitchedVideoDurationSec: loaded.sceneStitchedVideoDurationSec,
        sceneStitchedVideoStoragePath: loaded.sceneStitchedVideoStoragePath,
        frameGenerationEpoch: {},
        sceneVideoGenerationEpoch: {},
        history: [cloneScenes(scenes)],
        historyIndex: 0,
        isCommitting: false,
      });
      useWorkspaceStore.setState({ activeConversationId: id });
      get().saveDraft();

      if (recoveredFromDraft) {
        await syncStoryboardToHistory();
        try {
          const reloaded = await fetchStoryboard(id);
          if (reloaded.scenes.length) {
            set((s) => ({
              scenes: reloaded.scenes,
              storyboardVideoUrl:
                reloaded.storyboardVideoUrl ?? s.storyboardVideoUrl,
              storyboardVideoDurationSec:
                reloaded.storyboardVideoDurationSec ??
                s.storyboardVideoDurationSec,
              sceneStitchedVideoUrl:
                reloaded.sceneStitchedVideoUrl ?? s.sceneStitchedVideoUrl,
              sceneStitchedVideoDurationSec:
                reloaded.sceneStitchedVideoDurationSec ??
                s.sceneStitchedVideoDurationSec,
              singleVideoStoragePath:
                reloaded.singleVideoStoragePath ?? s.singleVideoStoragePath,
              sceneStitchedVideoStoragePath:
                reloaded.sceneStitchedVideoStoragePath ??
                s.sceneStitchedVideoStoragePath,
              history: [cloneScenes(reloaded.scenes)],
            }));
            get().saveDraft();
          }
        } catch {
          /* in-memory recovery still usable */
        }
      } else if (recoveredFromServer) {
        get().saveDraft();
      }
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to load storyboard",
      });
    }
  },

  refreshStoryboardVideos: async () => {
    const {
      conversationId,
      wizardLocked,
      isGeneratingVideo,
      isGeneratingStitchedVideo,
    } = get();
    const pendingForThis = isPendingVideoForConversation(conversationId);
    if (!conversationId || !wizardLocked) return;
    if (
      (isGeneratingVideo || isGeneratingStitchedVideo) &&
      !pendingForThis
    ) {
      return;
    }
    try {
      const loaded = await fetchStoryboard(conversationId);
      set({
        storyboardVideoUrl:
          loaded.storyboardVideoUrl ?? get().storyboardVideoUrl,
        storyboardVideoDurationSec:
          loaded.storyboardVideoDurationSec ?? get().storyboardVideoDurationSec,
        singleVideoStoragePath:
          loaded.singleVideoStoragePath ?? get().singleVideoStoragePath,
        sceneStitchedVideoUrl:
          loaded.sceneStitchedVideoUrl ?? get().sceneStitchedVideoUrl,
        sceneStitchedVideoDurationSec:
          loaded.sceneStitchedVideoDurationSec ??
          get().sceneStitchedVideoDurationSec,
        sceneStitchedVideoStoragePath:
          loaded.sceneStitchedVideoStoragePath ??
          get().sceneStitchedVideoStoragePath,
        scenes: get().scenes.map((scene) => {
          const fromDb = loaded.scenes.find((item) => item.id === scene.id);
          if (!fromDb) return scene;
          return {
            ...scene,
            sceneVideoUrl: fromDb.sceneVideoUrl,
            sceneVideoStoragePath: fromDb.sceneVideoStoragePath,
            sceneVideoDurationSec: fromDb.sceneVideoDurationSec,
            sceneVideoStatus: fromDb.sceneVideoStatus,
            sceneVideoError: fromDb.sceneVideoError,
            sceneVideoModel: fromDb.sceneVideoModel,
          };
        }),
      });
      if (loaded.storyboardVideoUrl || loaded.sceneStitchedVideoUrl) {
        clearPendingVideo();
      }
      get().saveDraft();
    } catch {
      /* ignore */
    }
  },

  resetStoryboard: () => {
    set({
      step: 1,
      script: "",
      settings: { ...DEFAULT_SETTINGS },
      continuity: null,
      scenes: [],
      selectedSceneId: null,
      viewMode: "grid",
      isBreakingDown: false,
      isInferringEnvironment: false,
      isGeneratingScript: false,
      isGeneratingFrames: false,
      generationProgress: 0,
      isGeneratingVideo: false,
      videoProgress: 0,
      videoGenerationStatus: null,
      storyboardVideoUrl: null,
      storyboardVideoDurationSec: null,
      storyboardVideoModel: null,
      imagePrimaryModel: STORYBOARD_IMAGE_MODEL,
      imageAspectRatio: STORYBOARD_DEFAULT_IMAGE_ASPECT,
      videoPrimaryModel: STORYBOARD_VIDEO_MODEL,
      videoFallbackModel: defaultStoryboardVideoFallbackModel(),
      videoAspectRatio: STORYBOARD_DEFAULT_IMAGE_ASPECT,
      isGeneratingStitchedVideo: false,
      stitchedVideoProgress: 0,
      stitchedVideoStatus: null,
      sceneStitchedVideoUrl: null,
      sceneStitchedVideoDurationSec: null,
      storyboardProjectId: crypto.randomUUID(),
      conversationId: null,
      wizardLocked: false,
      isCommitting: false,
      singleVideoStoragePath: null,
      stitchedVideoStoragePath: null,
      sceneStitchedVideoStoragePath: null,
      frameGenerationEpoch: {},
      sceneVideoGenerationEpoch: {},
      videoGenerationEpoch: 0,
      stitchedVideoGenerationEpoch: 0,
      error: null,
      history: [[]],
      historyIndex: 0,
    });
    useWorkspaceStore.setState({ activeConversationId: null });
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_KEY);
    }
  },

  loadDraft: () => {
    if (typeof window === "undefined") return;
    if (get().conversationId && get().wizardLocked) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<StoryboardState> & {
        conversationId?: string | null;
        wizardLocked?: boolean;
      };
      if (draft.conversationId && draft.wizardLocked) {
        void get().loadStoryboardConversation(draft.conversationId);
        return;
      }
      set({
        step: draft.step ?? 1,
        script: draft.script ?? "",
        settings: {
          ...DEFAULT_SETTINGS,
          ...draft.settings,
          frameCount: normalizeFrameCount(
            (draft.settings as StoryboardProjectSettings | undefined)?.frameCount
          ),
          frameStyle: normalizeFrameStyle(
            (draft.settings as StoryboardProjectSettings | undefined)?.frameStyle
          ),
        },
        continuity: draft.continuity ?? null,
        scenes: (draft.scenes ?? []).map((scene) => {
          const normalized = {
            ...scene,
            ...normalizeSceneFields(scene),
          };
          return normalized.frameStatus === "generating"
            ? { ...normalized, frameStatus: "pending" as const }
            : normalized;
        }),
        frameGenerationEpoch: {},
        storyboardVideoUrl:
          (draft as { storyboardVideoUrl?: string | null }).storyboardVideoUrl ??
          null,
        storyboardVideoDurationSec:
          (draft as { storyboardVideoDurationSec?: number | null })
            .storyboardVideoDurationSec ?? null,
        storyboardVideoModel:
          (draft as { storyboardVideoModel?: string | null })
            .storyboardVideoModel ?? null,
        imagePrimaryModel: resolveStoryboardImageModel(
          (draft as { imagePrimaryModel?: string }).imagePrimaryModel
        ),
        imageAspectRatio: clampStoryboardImageAspectRatio(
          resolveStoryboardImageModel(
            (draft as { imagePrimaryModel?: string }).imagePrimaryModel
          ),
          (draft as { imageAspectRatio?: AspectRatio }).imageAspectRatio ??
            STORYBOARD_DEFAULT_IMAGE_ASPECT
        ),
        videoPrimaryModel:
          (draft as { videoPrimaryModel?: string }).videoPrimaryModel ??
          STORYBOARD_VIDEO_MODEL,
        videoFallbackModel:
          (draft as { videoFallbackModel?: string | null }).videoFallbackModel ??
          defaultStoryboardVideoFallbackModel(
            (draft as { videoPrimaryModel?: string }).videoPrimaryModel ??
              STORYBOARD_VIDEO_MODEL
          ),
        videoAspectRatio: resolveStoryboardVideoAspectRatio(
          (draft as { videoPrimaryModel?: string }).videoPrimaryModel ??
            STORYBOARD_VIDEO_MODEL,
          {
            frameAspectRatio:
              (draft as { imageAspectRatio?: AspectRatio }).imageAspectRatio ??
              STORYBOARD_DEFAULT_IMAGE_ASPECT,
            videoAspectRatio:
              (draft as { videoAspectRatio?: string }).videoAspectRatio ??
              (draft as { imageAspectRatio?: AspectRatio }).imageAspectRatio ??
              STORYBOARD_DEFAULT_IMAGE_ASPECT,
          }
        ),
        storyboardProjectId:
          (draft as { storyboardProjectId?: string }).storyboardProjectId ??
          crypto.randomUUID(),
        isGeneratingVideo: false,
        isGeneratingStitchedVideo: false,
        stitchedVideoProgress: 0,
        stitchedVideoStatus: null,
        sceneStitchedVideoUrl:
          (draft as { sceneStitchedVideoUrl?: string | null }).sceneStitchedVideoUrl ??
          (draft as { storyboardStitchedVideoUrl?: string | null })
            .storyboardStitchedVideoUrl ??
          null,
        sceneStitchedVideoDurationSec:
          (draft as { sceneStitchedVideoDurationSec?: number | null })
            .sceneStitchedVideoDurationSec ??
          (draft as { storyboardStitchedVideoDurationSec?: number | null })
            .storyboardStitchedVideoDurationSec ??
          null,
        selectedSceneId: draft.selectedSceneId ?? null,
        viewMode: draft.viewMode ?? "grid",
        history: [cloneScenes(draft.scenes ?? [])],
        historyIndex: 0,
      });
    } catch {
      /* ignore */
    }
  },

  saveDraft: () => {
    if (typeof window === "undefined") return;
    const s = get();
    if (s.wizardLocked && s.conversationId) {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            conversationId: s.conversationId,
            wizardLocked: true,
            step: 4,
            script: s.script,
            settings: storyboardSettingsForPersist(),
            continuity: s.continuity,
            scenes: scenesForDraft(s.scenes),
            storyboardProjectId: s.storyboardProjectId,
            storyboardVideoUrl: s.storyboardVideoUrl,
            storyboardVideoDurationSec: s.storyboardVideoDurationSec,
            sceneStitchedVideoUrl: s.sceneStitchedVideoUrl,
            sceneStitchedVideoDurationSec: s.sceneStitchedVideoDurationSec,
            singleVideoStoragePath: s.singleVideoStoragePath,
            sceneStitchedVideoStoragePath: s.sceneStitchedVideoStoragePath,
            selectedSceneId: s.selectedSceneId,
            viewMode: s.viewMode,
            updatedAt: Date.now(),
          })
        );
      } catch {
        /* QuotaExceeded — fall back to ids only */
        try {
          localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify({
              conversationId: s.conversationId,
              wizardLocked: true,
              step: 4,
              updatedAt: Date.now(),
            })
          );
        } catch {
          /* ignore */
        }
      }
      return;
    }
    const payload = {
      step: s.step,
      script: s.script,
      settings: {
        ...s.settings,
        inputReferences: inputReferencesForDraft(s.settings.inputReferences ?? []),
      },
      continuity: s.continuity,
      scenes: scenesForDraft(s.scenes),
      storyboardVideoUrl: s.storyboardVideoUrl,
      storyboardVideoDurationSec: s.storyboardVideoDurationSec,
      storyboardVideoModel: s.storyboardVideoModel,
      imagePrimaryModel: s.imagePrimaryModel,
      imageAspectRatio: s.imageAspectRatio,
      videoPrimaryModel: s.videoPrimaryModel,
      videoFallbackModel: s.videoFallbackModel,
      videoAspectRatio: s.videoAspectRatio,
      sceneStitchedVideoUrl: s.sceneStitchedVideoUrl,
      sceneStitchedVideoDurationSec: s.sceneStitchedVideoDurationSec,
      storyboardProjectId: s.storyboardProjectId,
      selectedSceneId: s.selectedSceneId,
      viewMode: s.viewMode,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      /* QuotaExceeded — drop frame URLs and retry once */
      try {
        const lean = {
          ...payload,
          scenes: scenesForDraft(s.scenes).map((scene) => ({
            ...scene,
            frameImageUrl: undefined,
          })),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(lean));
      } catch {
        /* ignore — in-memory state still valid */
      }
    }
  },
};
});
