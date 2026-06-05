"use client";

import { create } from "zustand";
import { getAnchorFrameUrl } from "@/lib/storyboard/continuity";
import { pickStoryboardVideoDuration } from "@/lib/storyboard/storyboard-video";
import { normalizeFrameCount } from "@/lib/storyboard/script-utils";
import {
  estimateVideoGenerationMs,
  startEstimatedVideoProgress,
} from "@/lib/video-progress";
import {
  commitStoryboard,
  fetchStoryboard,
  patchStoryboardOutputs,
} from "@/lib/storyboard-api";
import {
  clearPendingVideo,
  getPendingVideo,
  isPendingVideoForConversation,
  markPendingVideo,
} from "@/lib/storyboard/pending-video";
import { createEmptyScene, renumberScenes } from "@/lib/storyboard/scene-engine";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
  StoryboardViewMode,
  StoryboardWizardStep,
} from "@/types/storyboard";

const DRAFT_KEY = "brandwise-storyboard-draft";

const DEFAULT_SETTINGS: StoryboardProjectSettings = {
  genre: "commercial",
  durationSec: 30,
  frameCount: 6,
  targetAudience: "",
  visualStyle: "Premium cinematic",
  mood: "Confident",
  brandTone: "Professional",
  platform: "youtube",
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
  isGeneratingFrames: boolean;
  generationProgress: number;
  isGeneratingVideo: boolean;
  videoProgress: number;
  storyboardVideoUrl: string | null;
  storyboardVideoDurationSec: number | null;
  isGeneratingStitchedVideo: boolean;
  stitchedVideoProgress: number;
  stitchedVideoStatus: string | null;
  storyboardStitchedVideoUrl: string | null;
  storyboardStitchedVideoDurationSec: number | null;
  storyboardProjectId: string;
  /** Set after all frames are saved to conversations history. */
  conversationId: string | null;
  wizardLocked: boolean;
  isCommitting: boolean;
  singleVideoStoragePath: string | null;
  stitchedVideoStoragePath: string | null;
  /** Bumps per scene — stale API responses are ignored when epoch mismatches. */
  frameGenerationEpoch: Record<string, number>;
  videoGenerationEpoch: number;
  stitchedVideoGenerationEpoch: number;
  error: string | null;
  history: StoryboardScene[][];
  historyIndex: number;

  setStep: (step: StoryboardWizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setScript: (script: string) => void;
  patchSettings: (patch: Partial<StoryboardProjectSettings>) => void;
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
  generateStoryboardVideo: (options?: { replace?: boolean }) => Promise<void>;
  generateStoryboardStitchedVideo: (options?: {
    replace?: boolean;
  }) => Promise<void>;
  checkPendingStoryboardVideo: () => Promise<void>;
  isFrameBusy: (sceneId: string) => boolean;
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

/** Keep localStorage small — never persist base64 frame blobs. */
function scenesForDraft(scenes: StoryboardScene[]): StoryboardScene[] {
  return scenes.map((scene) => ({
    ...scene,
    frameImageUrl:
      scene.frameImageUrl?.startsWith("data:") ? undefined : scene.frameImageUrl,
  }));
}

export const useStoryboardStore = create<StoryboardState>((set, get) => {
  const syncStoryboardToHistory = async () => {
    const s = get();
    if (s.isCommitting || !s.script.trim() || !s.scenes.length) return;

    set({ isCommitting: true, error: null });
    try {
      const { conversationId } = await commitStoryboard({
        conversationId: s.conversationId,
        script: s.script,
        settings: s.settings,
        continuity: s.continuity,
        scenes: s.scenes,
        singleVideoStoragePath: s.singleVideoStoragePath,
        stitchedVideoStoragePath: s.stitchedVideoStoragePath,
        singleVideoDurationSec: s.storyboardVideoDurationSec,
        stitchedVideoDurationSec: s.storyboardStitchedVideoDurationSec,
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
  isGeneratingFrames: false,
  generationProgress: 0,
  isGeneratingVideo: false,
  videoProgress: 0,
  storyboardVideoUrl: null,
  storyboardVideoDurationSec: null,
  isGeneratingStitchedVideo: false,
  stitchedVideoProgress: 0,
  stitchedVideoStatus: null,
  storyboardStitchedVideoUrl: null,
  storyboardStitchedVideoDurationSec: null,
  storyboardProjectId: crypto.randomUUID(),
  conversationId: null,
  wizardLocked: false,
  isCommitting: false,
  singleVideoStoragePath: null,
  stitchedVideoStoragePath: null,
  frameGenerationEpoch: {},
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
  prevStep: () => {
    if (get().wizardLocked) return;
    const step = get().step;
    if (step > 1) set({ step: (step - 1) as StoryboardWizardStep, error: null });
  },

  setScript: (script) => {
    set({ script });
    get().saveDraft();
  },

  patchSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
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
  },

  addScene: () => {
    get().pushHistory();
    set((s) => {
      const next = [...s.scenes, createEmptyScene(s.scenes.length + 1)];
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

      const referenceFrameUrl = getAnchorFrameUrl(scenes, sceneId);
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
          environment: current.environment,
          genre: settings.genre,
          visualStyle: settings.visualStyle,
          continuity,
          referenceFrameUrl,
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

  isAnyVideoGenerating: () =>
    get().isGeneratingVideo || get().isGeneratingStitchedVideo,

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
    } = get();
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
    const videoDuration = pickStoryboardVideoDuration(settings.durationSec);
    if (conversationId) {
      markPendingVideo(conversationId, "single");
    }

    set({
      videoGenerationEpoch: epoch,
      isGeneratingVideo: true,
      videoProgress: 8,
      error: null,
      ...(options?.replace
        ? {
            storyboardVideoUrl: null,
            storyboardVideoDurationSec: null,
            singleVideoStoragePath: null,
          }
        : {}),
    });

    const stopProgress = startEstimatedVideoProgress(
      estimateVideoGenerationMs(videoDuration, { multiFrameRefs: true }),
      (percent) => {
        if (
          get().isGeneratingVideo &&
          get().videoGenerationEpoch === epoch
        ) {
          set({ videoProgress: percent });
        }
      },
      () => get().videoProgress
    );

    try {
      const res = await fetch("/api/storyboard/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: storyboardProjectId,
          storageConversationId: storageFolderId(
            conversationId,
            storyboardProjectId
          ),
          scenes: ordered,
          script,
          settings,
          continuity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Video generation failed");
      if (get().videoGenerationEpoch !== epoch) return;

      stopProgress();
      clearPendingVideo();
      const storagePath = (data.storagePath as string | undefined) ?? null;
      set({
        storyboardVideoUrl: data.videoUrl as string,
        storyboardVideoDurationSec: (data.durationSec as number) ?? null,
        singleVideoStoragePath: storagePath,
        isGeneratingVideo: false,
        videoProgress: 100,
      });
      get().saveDraft();
      if (storagePath && get().conversationId) {
        await persistVideoOutputs({
          singleVideoStoragePath: storagePath,
          singleVideoDurationSec: (data.durationSec as number) ?? null,
        });
      }
    } catch (err) {
      stopProgress();
      clearPendingVideo();
      if (get().videoGenerationEpoch !== epoch) return;
      set({
        isGeneratingVideo: false,
        error: err instanceof Error ? err.message : "Video generation failed",
      });
    }
  },

  generateStoryboardStitchedVideo: async (options) => {
    const {
      scenes,
      script,
      settings,
      continuity,
      storyboardProjectId,
      conversationId,
      isGeneratingFrames,
    } = get();
    if (get().isAnyVideoGenerating() || isGeneratingFrames) return;

    const {
      storyboardStitchedVideoUrl,
      stitchedVideoStoragePath,
    } = get();

    if (
      isPendingVideoForConversation(conversationId, "stitched") &&
      !storyboardStitchedVideoUrl
    ) {
      set({
        error:
          "Stitched video may still be running. Wait or use Check for video — do not start again.",
      });
      return;
    }

    if (
      !options?.replace &&
      (storyboardStitchedVideoUrl || stitchedVideoStoragePath)
    ) {
      set({
        error:
          "A stitched video already exists. Use Regenerate stitched video for a new one.",
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

    const totalDuration = ordered.reduce((sum, s) => sum + s.durationSec, 0);
    const clipUrls: string[] = [];
    const epoch = get().stitchedVideoGenerationEpoch + 1;

    if (conversationId) {
      markPendingVideo(conversationId, "stitched");
    }

    set({
      stitchedVideoGenerationEpoch: epoch,
      isGeneratingStitchedVideo: true,
      ...(options?.replace
        ? {
            storyboardStitchedVideoUrl: null,
            storyboardStitchedVideoDurationSec: null,
            stitchedVideoStoragePath: null,
          }
        : {}),
      stitchedVideoProgress: 0,
      stitchedVideoStatus: `Generating clip 1 of ${ordered.length}…`,
      error: null,
    });

    try {
      for (let i = 0; i < ordered.length; i++) {
        const scene = ordered[i];
        const nextScene = ordered[i + 1] ?? null;
        const clipId = `${scene.id}-${i}`;
        const clipDuration = pickStoryboardVideoDuration(scene.durationSec);
        const clipBaseProgress = Math.round((i / ordered.length) * 85);

        set({
          stitchedVideoStatus: `Generating clip ${i + 1} of ${ordered.length} (scene ${scene.sceneNumber})…`,
          stitchedVideoProgress: clipBaseProgress,
        });

        let stopClipProgress = () => {};
        try {
          stopClipProgress = startEstimatedVideoProgress(
            estimateVideoGenerationMs(clipDuration),
            (percent) => {
              if (
                get().isGeneratingStitchedVideo &&
                get().stitchedVideoGenerationEpoch === epoch
              ) {
                const slice = 85 / ordered.length;
                const mapped = Math.round(
                  clipBaseProgress + (percent / 100) * slice
                );
                set({ stitchedVideoProgress: Math.min(85, mapped) });
              }
            },
            () => get().stitchedVideoProgress
          );

          const res = await fetch("/api/storyboard/generate-video-clip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: storyboardProjectId,
              storageConversationId: storageFolderId(
                conversationId,
                storyboardProjectId
              ),
              clipId,
              scene,
              nextScene,
              script,
              settings,
              continuity,
              sceneIndex: i,
              totalScenes: ordered.length,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(
              data.error ?? `Clip ${scene.sceneNumber} generation failed`
            );
          }
          if (get().stitchedVideoGenerationEpoch !== epoch) return;
          clipUrls.push(data.videoUrl as string);
          set({
            stitchedVideoProgress: Math.round(((i + 1) / ordered.length) * 85),
          });
        } finally {
          stopClipProgress();
        }
      }

      if (get().stitchedVideoGenerationEpoch !== epoch) return;

      set({
        stitchedVideoStatus: "Stitching clips into one video…",
        stitchedVideoProgress: 90,
      });

      const stitchRes = await fetch("/api/storyboard/stitch-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: storyboardProjectId,
          storageConversationId: storageFolderId(
            conversationId,
            storyboardProjectId
          ),
          clipUrls,
          totalDurationSec: totalDuration,
        }),
      });
      const stitchData = await stitchRes.json();
      if (!stitchRes.ok) {
        throw new Error(stitchData.error ?? "Video stitching failed");
      }

      const storagePath = (stitchData.storagePath as string | undefined) ?? null;
      const durationSec =
        (stitchData.durationSec as number) ?? totalDuration;
      clearPendingVideo();
      set({
        storyboardStitchedVideoUrl: stitchData.videoUrl as string,
        storyboardStitchedVideoDurationSec: durationSec,
        stitchedVideoStoragePath: storagePath,
        isGeneratingStitchedVideo: false,
        stitchedVideoProgress: 100,
        stitchedVideoStatus: null,
      });
      get().saveDraft();
      if (storagePath && get().conversationId) {
        await persistVideoOutputs({
          stitchedVideoStoragePath: storagePath,
          stitchedVideoDurationSec: durationSec,
        });
      }
    } catch (err) {
      clearPendingVideo();
      if (get().stitchedVideoGenerationEpoch !== epoch) return;
      set({
        isGeneratingStitchedVideo: false,
        stitchedVideoStatus: null,
        error:
          err instanceof Error ? err.message : "Stitched video generation failed",
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
    if (
      pending.kind === "stitched" &&
      (s.storyboardStitchedVideoUrl || s.stitchedVideoStoragePath)
    ) {
      clearPendingVideo();
      set({ error: null });
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
      const loaded = await fetchStoryboard(id);
      set({
        conversationId: loaded.conversationId,
        wizardLocked: loaded.wizardLocked,
        script: loaded.script,
        settings: loaded.settings,
        continuity: loaded.continuity,
        scenes: loaded.scenes,
        step: 4,
        selectedSceneId: loaded.scenes[0]?.id ?? null,
        viewMode: "grid",
        isBreakingDown: false,
        isGeneratingFrames: false,
        generationProgress: 100,
        isGeneratingVideo: false,
        videoProgress: 0,
        storyboardVideoUrl: loaded.storyboardVideoUrl,
        storyboardVideoDurationSec: loaded.storyboardVideoDurationSec,
        isGeneratingStitchedVideo: false,
        stitchedVideoProgress: 0,
        stitchedVideoStatus: null,
        storyboardStitchedVideoUrl: loaded.storyboardStitchedVideoUrl,
        storyboardStitchedVideoDurationSec:
          loaded.storyboardStitchedVideoDurationSec,
        frameGenerationEpoch: {},
        history: [cloneScenes(loaded.scenes)],
        historyIndex: 0,
        isCommitting: false,
      });
      useWorkspaceStore.setState({ activeConversationId: id });
      get().saveDraft();
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
        storyboardVideoUrl: loaded.storyboardVideoUrl,
        storyboardVideoDurationSec: loaded.storyboardVideoDurationSec,
        storyboardStitchedVideoUrl: loaded.storyboardStitchedVideoUrl,
        storyboardStitchedVideoDurationSec:
          loaded.storyboardStitchedVideoDurationSec,
      });
      if (loaded.storyboardVideoUrl || loaded.storyboardStitchedVideoUrl) {
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
      isGeneratingFrames: false,
      generationProgress: 0,
      isGeneratingVideo: false,
      videoProgress: 0,
      storyboardVideoUrl: null,
      storyboardVideoDurationSec: null,
      isGeneratingStitchedVideo: false,
      stitchedVideoProgress: 0,
      stitchedVideoStatus: null,
      storyboardStitchedVideoUrl: null,
      storyboardStitchedVideoDurationSec: null,
      storyboardProjectId: crypto.randomUUID(),
      conversationId: null,
      wizardLocked: false,
      isCommitting: false,
      singleVideoStoragePath: null,
      stitchedVideoStoragePath: null,
      frameGenerationEpoch: {},
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
        storyboardProjectId:
          (draft as { storyboardProjectId?: string }).storyboardProjectId ??
          crypto.randomUUID(),
        isGeneratingVideo: false,
        isGeneratingStitchedVideo: false,
        stitchedVideoProgress: 0,
        stitchedVideoStatus: null,
        storyboardStitchedVideoUrl:
          (draft as { storyboardStitchedVideoUrl?: string | null })
            .storyboardStitchedVideoUrl ?? null,
        storyboardStitchedVideoDurationSec:
          (draft as { storyboardStitchedVideoDurationSec?: number | null })
            .storyboardStitchedVideoDurationSec ?? null,
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
            updatedAt: Date.now(),
          })
        );
      } catch {
        /* ignore */
      }
      return;
    }
    const payload = {
      step: s.step,
      script: s.script,
      settings: s.settings,
      continuity: s.continuity,
      scenes: scenesForDraft(s.scenes),
      storyboardVideoUrl: s.storyboardVideoUrl,
      storyboardVideoDurationSec: s.storyboardVideoDurationSec,
      storyboardStitchedVideoUrl: s.storyboardStitchedVideoUrl,
      storyboardStitchedVideoDurationSec: s.storyboardStitchedVideoDurationSec,
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
