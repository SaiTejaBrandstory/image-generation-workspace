"use client";

import { create } from "zustand";
import { DEFAULT_PARAMS } from "@/lib/constants";
import { parseDesignMd } from "@/lib/design-md-parser";
import {
  createConversationRecord,
  fetchConversationById,
  fetchConversationHistory,
  finalizeConversation,
  prepareConversationForGeneration,
  prepareVariationsForParent,
} from "@/lib/conversations-api";
import {
  buildPendingVariants,
  generateLayoutVariants,
  generateSingleVariant,
  generateVariantVariations,
} from "@/lib/generation-engine";
import {
  buildPendingVariations,
  clampVariationBatch,
  DEFAULT_VARIATION_BATCH,
  getChildVariations,
  getNextVariationStartIndex,
  MAX_VARIATIONS,
  remainingVariationSlots,
  sourceImageToPreserveReference,
} from "@/lib/variation-utils";
import { DEFAULT_IMAGE_MODEL } from "@/lib/openrouter-models";
import {
  clampVideoSettingsToModel,
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_RESOLUTION,
} from "@/lib/openrouter-video-models";
import {
  buildPendingVideoVariant,
  generateVideoVariant,
} from "@/lib/video-generation";
import {
  estimateVideoGenerationMs,
  startEstimatedVideoProgress,
} from "@/lib/video-progress";
import {
  DEFAULT_SELECTED_LAYOUTS,
  LAYOUT_SYSTEMS,
} from "@/lib/layout-systems";
import { uid } from "@/lib/utils";
import type {
  AspectRatio,
  Brand,
  ChatMessage,
  Conversation,
  DesignTokens,
  GenerationParams,
  LayoutId,
  LayoutVariant,
  MediaType,
  PlatformPreset,
  ReferenceImage,
  ReferenceImagePayload,
  ReferenceUsageMode,
  StyleEngine,
  VideoAspectRatio,
  VideoResolution,
} from "@/types";

export interface ExpandedReturnTarget {
  variantId: string;
  mode: "view" | "edit";
}

interface WorkspaceState {
  sidebarExpanded: boolean;
  theme: "dark" | "light";
  activeConversationId: string | null;
  conversations: Conversation[];
  prompt: string;
  selectedLayouts: LayoutId[];
  aspectRatio: AspectRatio;
  platform: PlatformPreset;
  style: StyleEngine;
  params: GenerationParams;
  references: ReferenceImage[];
  variants: LayoutVariant[];
  isGenerating: boolean;
  generatingVariationsParentId: string | null;
  /** How many variations to generate on the next batch (1–10) */
  variationBatchSize: number;
  generationProgress: number;
  generationError: string | null;
  expandedVariantId: string | null;
  expandedMode: "view" | "edit";
  expandedReturnTo: ExpandedReturnTarget | null;
  showDesignDna: boolean;
  activeBrand: Brand | null;
  designTokens: DesignTokens | null;
  imageModel: string;
  mediaType: MediaType;
  videoModel: string;
  videoDuration: number;
  videoResolution: VideoResolution;
  videoAspectRatio: VideoAspectRatio;
  videoGenerateAudio: boolean;
  historyLoaded: boolean;
  historyLoading: boolean;
  /** Mobile: chat composer vs layout matrix */
  mobilePanel: "chat" | "layouts";
  mobileSidebarOpen: boolean;

  toggleSidebar: () => void;
  setMobilePanel: (panel: "chat" | "layouts") => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setTheme: (theme: "dark" | "light") => void;
  setPrompt: (prompt: string) => void;
  setSelectedLayouts: (layouts: LayoutId[]) => void;
  selectAllLayouts: () => void;
  clearLayouts: () => void;
  toggleLayout: (id: LayoutId) => void;
  setImageModel: (model: string) => void;
  setMediaType: (type: MediaType) => void;
  setVideoModel: (model: string) => void;
  setVideoDuration: (seconds: number) => void;
  setVideoResolution: (resolution: VideoResolution) => void;
  setVideoAspectRatio: (ratio: VideoAspectRatio) => void;
  setVideoGenerateAudio: (enabled: boolean) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setPlatform: (platform: PlatformPreset) => void;
  setStyle: (style: StyleEngine) => void;
  setParam: <K extends keyof GenerationParams>(
    key: K,
    value: GenerationParams[K]
  ) => void;
  addReference: (file: File, usageMode?: ReferenceUsageMode) => void;
  setReferencesUsageMode: (mode: ReferenceUsageMode) => void;
  removeReference: (id: string) => void;
  updateReference: (
    id: string,
    patch: Partial<
      Pick<ReferenceImage, "role" | "influence" | "locked" | "usageMode">
    >
  ) => void;
  setExpandedVariant: (id: string | null, mode?: "view" | "edit") => void;
  openExpandedWithVariations: (variantId: string) => void;
  pushExpandedView: (
    id: string,
    mode: "view" | "edit",
    returnTo: ExpandedReturnTarget
  ) => void;
  expandBack: () => void;
  openEditVariant: (id: string) => void;
  regenerateVariant: (variantId: string, customPrompt?: string) => Promise<void>;
  setVariationBatchSize: (count: number) => void;
  generateVariations: (parentVariantId: string) => Promise<void>;
  setShowDesignDna: (show: boolean) => void;
  loadDesignMd: (content: string) => void;
  setActiveBrand: (brand: Brand | null) => void;
  loadHistory: () => Promise<void>;
  upsertConversationInList: (
    patch: Partial<Conversation> & { id: string }
  ) => void;
  removeConversationFromList: (id: string) => void;
  newConversation: () => void;
  selectConversation: (id: string) => Promise<void>;
  generate: () => Promise<void>;
  remixVariant: (variantId: string) => Promise<void>;
  retryVideoVariant: (variantId: string) => Promise<void>;
  retryFailedVariant: (variantId: string) => Promise<void>;
}

type WorkspaceSet = (
  partial:
    | Partial<WorkspaceState>
    | ((state: WorkspaceState) => Partial<WorkspaceState>)
) => void;

/** Synchronous lock — prevents double-clicks before any await. */
function claimGenerationStart(set: WorkspaceSet): boolean {
  let claimed = false;
  set((s) => {
    if (s.isGenerating || !s.prompt.trim()) return s;
    claimed = true;
    return {
      isGenerating: true,
      generationError: null,
      generationProgress: 0,
    };
  });
  return claimed;
}

async function runVideoGeneration(
  get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  const state = get();
  const {
    prompt,
    style,
    platform,
    aspectRatio,
    params,
    references,
    videoModel,
    videoDuration,
    videoResolution,
    videoAspectRatio,
    videoGenerateAudio,
    conversations,
    activeConversationId,
  } = state;

  const existingConv = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId)
    : null;
  const continuing = Boolean(activeConversationId && existingConv);

  let priorMessages = existingConv?.messages ?? [];
  let priorVariantsFromFetch: LayoutVariant[] = [];
  if (continuing && activeConversationId) {
    try {
      const full = await fetchConversationById(activeConversationId);
      if (priorMessages.length === 0) priorMessages = full.messages;
      priorVariantsFromFetch = full.variants;
    } catch {
      /* use local */
    }
  }

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: prompt,
    timestamp: Date.now(),
    referenceIds: references.map((r) => r.id),
  };

  const videoMeta = {
    duration: videoDuration,
    resolution: videoResolution,
    aspectRatio: videoAspectRatio,
    generateAudio: videoGenerateAudio,
    model: videoModel,
  };

  const pendingVariant = buildPendingVideoVariant({ prompt, videoMeta });

  const priorVariants = continuing
    ? priorVariantsFromFetch.length > 0
      ? priorVariantsFromFetch
      : (existingConv?.variants ?? state.variants)
    : [];

  let conversationId: string;
  let generationRound = 0;
  let roundCreatedAt = Date.now();

  try {
    if (continuing && activeConversationId) {
      const prepared = await prepareConversationForGeneration(
        activeConversationId,
        {
          prompt,
          style,
          platform,
          aspectRatio,
          params,
          imageModel: state.imageModel,
          mediaType: "video",
          videoModel,
          selectedLayouts: [],
          variants: [pendingVariant],
        }
      );
      conversationId = prepared.conversationId;
      generationRound = prepared.generationRound;
      roundCreatedAt = new Date(prepared.roundCreatedAt).getTime();
    } else {
      conversationId = await createConversationRecord({
        prompt,
        style,
        platform,
        aspectRatio,
        params,
        imageModel: state.imageModel,
        mediaType: "video",
        videoModel,
        selectedLayouts: [],
        variants: [pendingVariant],
      });
    }
  } catch (err) {
    set({
      isGenerating: false,
      generationError:
        err instanceof Error ? err.message : "Failed to save to history",
    });
    return;
  }

  const pendingWithRound = {
    ...pendingVariant,
    generationRound,
    createdAt: roundCreatedAt,
    sortIndex: 0,
    status: "generating" as const,
  };

  const allVariantsForUi = [...priorVariants, pendingWithRound];
  const optimisticMessages = [...priorMessages, userMsg];

  set({
    variants: allVariantsForUi,
    activeConversationId: conversationId,
    mobileSidebarOpen: false,
    mobilePanel: "layouts",
    conversations: continuing
      ? conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                mediaType: "video" as const,
                messages: optimisticMessages,
                variants: allVariantsForUi,
              }
            : c
        )
      : [
          {
            id: conversationId,
            title:
              prompt.length > 40 ? `${prompt.slice(0, 40)}…` : prompt,
            prompt,
            mediaType: "video",
            messages: optimisticMessages,
            variants: allVariantsForUi,
            createdAt: Date.now(),
          },
          ...conversations,
        ],
  });

  let completedVariant: LayoutVariant = pendingWithRound;
  const stopEstimatedProgress = startEstimatedVideoProgress(
    estimateVideoGenerationMs(videoDuration),
    (percent) => set({ generationProgress: percent })
  );
  try {
    set({ generationProgress: 8 });
    completedVariant = await generateVideoVariant({
      prompt,
      videoModel,
      duration: videoDuration,
      resolution: videoResolution,
      aspectRatio: videoAspectRatio,
      generateAudio: videoGenerateAudio,
      references,
      conversationId,
      variant: pendingWithRound,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Video generation failed";
    completedVariant = {
      ...pendingWithRound,
      status: "error",
      errorMessage: message,
    };
    stopEstimatedProgress();
    set({
      variants: [...priorVariants, completedVariant],
      isGenerating: false,
      generationProgress: 0,
      generationError: message,
    });
    return;
  }
  stopEstimatedProgress();

  let variants = [...priorVariants, completedVariant];
  try {
    const refreshed = await fetchConversationById(conversationId);
    variants = refreshed.variants;
  } catch {
    /* keep local */
  }

  const finalAssistant: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content:
      completedVariant.status === "complete"
        ? "Your video is ready. Open the card to preview or download."
        : "Video generation failed. Try again with a shorter prompt.",
    timestamp: Date.now(),
  };

  const allMessages = [...priorMessages, userMsg, finalAssistant];
  const title = continuing
    ? existingConv!.title
    : prompt.length > 40
      ? `${prompt.slice(0, 40)}…`
      : prompt;

  let savedConversation: Conversation | null = null;
  try {
    savedConversation = await finalizeConversation(conversationId, {
      ...(continuing ? {} : { title }),
      messages: allMessages,
    });
  } catch {
    savedConversation = {
      id: conversationId,
      title,
      prompt,
      mediaType: "video",
      messages: allMessages,
      variants,
      createdAt: existingConv?.createdAt ?? Date.now(),
      starred: existingConv?.starred,
    };
  }

  const merged: Conversation = {
    ...savedConversation,
    mediaType: "video",
    variants,
  };

  set({
    variants,
    isGenerating: false,
    generationProgress: 100,
    conversations: [
      merged,
      ...conversations.filter((c) => c.id !== conversationId),
    ],
    activeConversationId: conversationId,
    mobilePanel: "layouts",
  });
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  sidebarExpanded: false,
  theme: "dark",
  activeConversationId: null,
  conversations: [],
  prompt: "",
  selectedLayouts: [...DEFAULT_SELECTED_LAYOUTS],
  aspectRatio: "auto",
  platform: "instagram-post",
  style: "luxury",
  params: { ...DEFAULT_PARAMS },
  references: [],
  variants: [],
  isGenerating: false,
  generatingVariationsParentId: null,
  variationBatchSize: DEFAULT_VARIATION_BATCH,
  generationProgress: 0,
  generationError: null,
  expandedVariantId: null,
  expandedMode: "view",
  expandedReturnTo: null,
  showDesignDna: false,
  activeBrand: null,
  designTokens: null,
  imageModel: DEFAULT_IMAGE_MODEL,
  mediaType: "image",
  videoModel: DEFAULT_VIDEO_MODEL,
  videoDuration: DEFAULT_VIDEO_DURATION,
  videoResolution: DEFAULT_VIDEO_RESOLUTION,
  videoAspectRatio: DEFAULT_VIDEO_ASPECT,
  videoGenerateAudio: true,
  historyLoaded: false,
  historyLoading: false,
  mobilePanel: "chat",
  mobileSidebarOpen: false,

  setMobilePanel: (panel) => set({ mobilePanel: panel }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  loadHistory: async () => {
    if (get().historyLoading || get().historyLoaded) return;
    set({ historyLoading: true });
    try {
      const conversations = await fetchConversationHistory();
      set({ conversations, historyLoaded: true, historyLoading: false });
    } catch {
      set({ historyLoaded: true, historyLoading: false });
    }
  },

  upsertConversationInList: (patch) =>
    set((s) => {
      const existing = s.conversations.find((c) => c.id === patch.id);
      const merged: Conversation = {
        id: patch.id,
        title: patch.title ?? existing?.title ?? "Untitled",
        messages: existing?.messages ?? [],
        variants: existing?.variants ?? [],
        createdAt: existing?.createdAt ?? Date.now(),
        prompt: patch.prompt ?? existing?.prompt,
        mediaType: patch.mediaType ?? existing?.mediaType ?? "image",
        starred: patch.starred ?? existing?.starred,
        projectId:
          patch.projectId !== undefined
            ? patch.projectId
            : existing?.projectId,
      };
      const rest = s.conversations.filter((c) => c.id !== patch.id);
      return { conversations: [merged, ...rest] };
    }),

  removeConversationFromList: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id ? null : s.activeConversationId,
    })),

  toggleSidebar: () =>
    set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),

  setTheme: (theme) => set({ theme }),

  setPrompt: (prompt) => set({ prompt }),

  setSelectedLayouts: (layouts) => set({ selectedLayouts: layouts }),

  selectAllLayouts: () =>
    set({ selectedLayouts: LAYOUT_SYSTEMS.map((l) => l.id) }),

  clearLayouts: () => set({ selectedLayouts: [] }),

  toggleLayout: (id) => {
    const current = get().selectedLayouts;
    if (current.includes(id)) {
      set({ selectedLayouts: current.filter((l) => l !== id) });
    } else {
      set({ selectedLayouts: [...current, id] });
    }
  },

  setImageModel: (model) => set({ imageModel: model }),
  setMediaType: (type) =>
    set((s) => ({
      mediaType: type,
      generationError: null,
      mobilePanel: type === "video" ? "layouts" : s.mobilePanel,
      references:
        type === "video"
          ? s.references.map((r) => ({
              ...r,
              usageMode: "inspire" as const,
              locked: false,
              influence: 70,
            }))
          : s.references,
    })),
  setVideoModel: (model) => {
    const state = get();
    const clamped = clampVideoSettingsToModel(model, {
      duration: state.videoDuration,
      resolution: state.videoResolution,
      aspectRatio: state.videoAspectRatio,
      generateAudio: state.videoGenerateAudio,
    });
    set({
      videoModel: model,
      videoDuration: clamped.duration,
      videoResolution: clamped.resolution,
      videoAspectRatio: clamped.aspectRatio,
      videoGenerateAudio: clamped.generateAudio,
    });
  },
  setVideoDuration: (seconds) => set({ videoDuration: seconds }),
  setVideoResolution: (resolution) => set({ videoResolution: resolution }),
  setVideoAspectRatio: (ratio) => set({ videoAspectRatio: ratio }),
  setVideoGenerateAudio: (enabled) => set({ videoGenerateAudio: enabled }),

  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setPlatform: (platform) => set({ platform }),
  setStyle: (style) => set({ style }),

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),

  addReference: (file, usageMode = "inspire") => {
    const state = get();
    const mode =
      state.mediaType === "video" ? "inspire" : usageMode;
    const url = URL.createObjectURL(file);
    const ref: ReferenceImage = {
      id: uid(),
      url,
      name: file.name,
      role: "style",
      influence: mode === "preserve" ? 100 : 70,
      locked: mode === "preserve",
      usageMode: mode,
    };
    set((s) => ({ references: [...s.references, ref] }));
  },

  setReferencesUsageMode: (mode) =>
    set((s) => ({
      references: s.references.map((r) => ({
        ...r,
        usageMode: mode,
        locked: mode === "preserve",
        influence: mode === "preserve" ? 100 : 70,
      })),
    })),

  removeReference: (id) => {
    const ref = get().references.find((r) => r.id === id);
    if (ref?.url) URL.revokeObjectURL(ref.url);
    set((s) => ({
      references: s.references.filter((r) => r.id !== id),
    }));
  },

  updateReference: (id, patch) =>
    set((s) => ({
      references: s.references.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    })),

  setExpandedVariant: (id, mode = "view") =>
    set({
      expandedVariantId: id,
      expandedMode: id ? mode : "view",
      expandedReturnTo: null,
    }),

  /** Opens expand for a layout; variations show inline when they exist */
  openExpandedWithVariations: (variantId) =>
    set({
      expandedVariantId: variantId,
      expandedMode: "view",
      expandedReturnTo: null,
    }),

  pushExpandedView: (id, mode, returnTo) =>
    set({
      expandedVariantId: id,
      expandedMode: mode,
      expandedReturnTo: returnTo,
    }),

  expandBack: () => {
    const ret = get().expandedReturnTo;
    if (!ret) return;
    set({
      expandedVariantId: ret.variantId,
      expandedMode: ret.mode,
      expandedReturnTo: null,
    });
  },

  openEditVariant: (id) =>
    set({
      expandedVariantId: id,
      expandedMode: "edit",
      expandedReturnTo: { variantId: id, mode: "view" },
    }),
  setShowDesignDna: (show) => set({ showDesignDna: show }),

  loadDesignMd: (content) => {
    const tokens = parseDesignMd(content);
    set({
      designTokens: tokens,
      activeBrand: get().activeBrand
        ? { ...get().activeBrand!, designMdRaw: content, designTokens: tokens }
        : null,
    });
  },

  setActiveBrand: (brand) =>
    set({
      activeBrand: brand,
      designTokens: brand?.designTokens ?? null,
    }),

  newConversation: () => {
    set({
      activeConversationId: null,
      prompt: "",
      variants: [],
      references: [],
      selectedLayouts: [...DEFAULT_SELECTED_LAYOUTS],
      expandedVariantId: null,
      generationError: null,
      mobilePanel: "chat",
      mobileSidebarOpen: false,
    });
  },

  selectConversation: async (id) => {
    set({
      activeConversationId: id,
      generationError: null,
      mobileSidebarOpen: false,
      mobilePanel: "chat",
      expandedVariantId: null,
      expandedMode: "view",
    });

    try {
      const conversation = await fetchConversationById(id);
      set((s) => ({
        variants: conversation.variants,
        mediaType: conversation.mediaType ?? "image",
        prompt:
          conversation.messages.find((m) => m.role === "user")?.content ??
          conversation.prompt ??
          conversation.title,
        conversations: s.conversations.map((c) =>
          c.id === id ? conversation : c
        ),
        mobilePanel: "chat",
      }));
    } catch (err) {
      set({
        generationError:
          err instanceof Error ? err.message : "Failed to load conversation",
      });
    }
  },

  generate: async () => {
    if (!claimGenerationStart(set)) return;

    const state = get();

    if (state.mediaType === "video") {
      await runVideoGeneration(get, set);
      return;
    }

    const {
      prompt,
      selectedLayouts,
      style,
      platform,
      aspectRatio,
      params,
      references,
      designTokens,
      imageModel,
      conversations,
      activeConversationId,
    } = state;

    const existingConv = activeConversationId
      ? conversations.find((c) => c.id === activeConversationId)
      : null;
    const continuing = Boolean(activeConversationId && existingConv);

    let priorMessages = existingConv?.messages ?? [];
    let priorVariantsFromFetch: LayoutVariant[] = [];
    if (continuing && activeConversationId) {
      const needsFull =
        priorMessages.length === 0 ||
        !(existingConv?.variants?.length ?? state.variants.length);
      if (needsFull) {
        try {
          const full = await fetchConversationById(activeConversationId);
          if (priorMessages.length === 0) priorMessages = full.messages;
          priorVariantsFromFetch = full.variants;
        } catch {
          /* use local state */
        }
      }
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      referenceIds: references.map((r) => r.id),
    };

    const layoutIds =
      selectedLayouts.length > 0
        ? selectedLayouts
        : [...DEFAULT_SELECTED_LAYOUTS];

    const priorVariants = continuing
      ? priorVariantsFromFetch.length > 0
        ? priorVariantsFromFetch
        : existingConv?.variants?.length
          ? existingConv.variants
          : state.activeConversationId === activeConversationId
            ? state.variants.filter(
                (v) =>
                  v.status === "complete" ||
                  v.status === "error" ||
                  (v.imageUrl && v.status !== "pending")
              )
            : []
      : [];

    const pendingVariants = buildPendingVariants({
      prompt,
      layoutIds,
      style,
      references,
      designTokens: designTokens ?? undefined,
    });

    let conversationId: string;
    let generationRound = 0;
    let roundCreatedAt = Date.now();

    try {
      if (continuing && activeConversationId) {
        const prepared = await prepareConversationForGeneration(
          activeConversationId,
          {
            prompt,
            style,
            platform,
            aspectRatio,
            params,
            imageModel,
            selectedLayouts: layoutIds,
            variants: pendingVariants,
          }
        );
        conversationId = prepared.conversationId;
        generationRound = prepared.generationRound;
        roundCreatedAt = new Date(prepared.roundCreatedAt).getTime();
      } else {
        conversationId = await createConversationRecord({
          prompt,
          style,
          platform,
          aspectRatio,
          params,
          imageModel,
          selectedLayouts: layoutIds,
          variants: pendingVariants,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save to history";
      set({ isGenerating: false, generationError: message });
      return;
    }

    const optimisticMessages = [...priorMessages, userMsg];

    const pendingWithRound = pendingVariants.map((v, i) => ({
      ...v,
      generationRound,
      createdAt: roundCreatedAt,
      sortIndex: i,
    }));

    const allVariantsForUi = [...priorVariants, ...pendingWithRound];

    set({
      variants: allVariantsForUi,
      activeConversationId: conversationId,
      mobileSidebarOpen: false,
      mobilePanel: "layouts",
      conversations: continuing
        ? conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: optimisticMessages,
                  variants: allVariantsForUi,
                }
              : c
          )
        : conversations,
    });

    let newBatchVariants: LayoutVariant[] = [];
    try {
      newBatchVariants = await generateLayoutVariants({
        prompt,
        layoutIds,
        style,
        platform,
        aspectRatio,
        params,
        references,
        imageModel,
        designTokens: designTokens ?? undefined,
        conversationId,
        pendingVariants: pendingWithRound,
        onProgress: (progress, partial) => {
          set({
            generationProgress: progress,
            variants: [...priorVariants, ...partial],
          });
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Generation failed";
      try {
        const refreshed = await fetchConversationById(conversationId);
        set({
          variants: refreshed.variants,
          isGenerating: false,
          generationError: message,
        });
      } catch {
        set({
          isGenerating: false,
          generationError: message,
        });
      }
      return;
    }

    let variants = [...priorVariants, ...newBatchVariants];
    try {
      const refreshed = await fetchConversationById(conversationId);
      variants = refreshed.variants;
    } catch {
      /* keep merged local variants */
    }

    const successCount = newBatchVariants.filter(
      (v) => v.status === "complete"
    ).length;
    const errorCount = newBatchVariants.filter((v) => v.status === "error").length;

    const finalAssistant: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        errorCount > 0
          ? `Created ${successCount} images (${errorCount} failed). Open any card to retry, expand, or regenerate.`
          : `Created ${successCount} layout images. Each includes design rationale and platform recommendations. Open any card to edit, regenerate, or expand.`,
      timestamp: Date.now(),
    };

    const allMessages = [...priorMessages, userMsg, finalAssistant];
    const title = continuing
      ? existingConv!.title
      : prompt.length > 40
        ? `${prompt.slice(0, 40)}…`
        : prompt;

    let savedConversation: Conversation | null = null;
    try {
      savedConversation = await finalizeConversation(conversationId, {
        ...(continuing ? {} : { title }),
        messages: allMessages,
      });
    } catch {
      savedConversation = {
        id: conversationId,
        title,
        messages: allMessages,
        variants,
        createdAt: existingConv?.createdAt ?? Date.now(),
        starred: existingConv?.starred,
      };
    }

    const merged: Conversation = {
      ...savedConversation,
      variants,
    };

    const withoutDup = conversations.filter((c) => c.id !== conversationId);
    set({
      variants,
      isGenerating: false,
      generationProgress: 100,
      conversations: [merged, ...withoutDup],
      activeConversationId: conversationId,
      mobilePanel: "layouts",
    });
  },

  setVariationBatchSize: (count) =>
    set({ variationBatchSize: clampVariationBatch(count) }),

  regenerateVariant: async (variantId, customPrompt) => {
    const state = get();
    const variant = state.variants.find((v) => v.id === variantId);
    if (!variant) return;

    if (variant.mediaType === "video") {
      await get().retryVideoVariant(variantId);
      return;
    }

    // When customPrompt is passed (edit panel), use it exactly — never fall back to variant.prompt
    const promptText =
      customPrompt !== undefined
        ? customPrompt.trim()
        : (state.prompt.trim() || variant.userPrompt || "").trim();

    if (!promptText) {
      set({
        generationError:
          "Enter a prompt in the composer (or edit panel) to regenerate.",
      });
      return;
    }

    set((s) => ({
      generationError: null,
      variants: s.variants.map((v) =>
        v.id === variantId ? { ...v, status: "generating" as const } : v
      ),
    }));

    try {
      let referenceOverrides: ReferenceImagePayload[] | undefined;
      if (variant.parentVariantId) {
        const parent = state.variants.find(
          (v) => v.id === variant.parentVariantId
        );
        if (parent?.imageUrl) {
          referenceOverrides = [
            await sourceImageToPreserveReference(parent.imageUrl),
          ];
        }
      }

      const updated = await generateSingleVariant({
        prompt: promptText,
        layoutId: variant.layoutId,
        style: state.style,
        platform: state.platform,
        aspectRatio: state.aspectRatio,
        params: state.params,
        references: state.references,
        referenceOverrides,
        imageModel: state.imageModel,
        designTokens: state.designTokens ?? undefined,
        existing: variant,
        conversationId: state.activeConversationId ?? undefined,
      });

      set((s) => {
        const nextVariants = s.variants.map((v) =>
          v.id === variantId ? updated : v
        );
        return {
          variants: nextVariants,
          conversations: s.activeConversationId
            ? s.conversations.map((c) =>
                c.id === s.activeConversationId
                  ? { ...c, variants: nextVariants }
                  : c
              )
            : s.conversations,
        };
      });
    } catch (err) {
      set((s) => ({
        variants: s.variants.map((v) =>
          v.id === variantId
            ? { ...v, status: "error" as const }
            : v
        ),
        generationError:
          err instanceof Error ? err.message : "Regeneration failed",
      }));
    }
  },

  remixVariant: async (variantId) => {
    await get().regenerateVariant(variantId);
  },

  retryVideoVariant: async (variantId) => {
    const state = get();
    const variant = state.variants.find((v) => v.id === variantId);
    if (!variant || variant.mediaType !== "video") return;

    const promptText = (
      state.prompt.trim() ||
      variant.userPrompt ||
      variant.prompt ||
      ""
    ).trim();
    if (!promptText) {
      set({ generationError: "Enter a prompt to retry video generation." });
      return;
    }

    const conversationId = state.activeConversationId;
    if (!conversationId) {
      set({ generationError: "No active conversation for this video." });
      return;
    }

    const meta = variant.videoMeta ?? {
      duration: state.videoDuration,
      resolution: state.videoResolution,
      aspectRatio: state.videoAspectRatio,
      generateAudio: state.videoGenerateAudio,
      model: state.videoModel,
    };

    set((s) => ({
      generationError: null,
      variants: s.variants.map((v) =>
        v.id === variantId
          ? { ...v, status: "generating" as const, errorMessage: undefined }
          : v
      ),
    }));

    try {
      const updated = await generateVideoVariant({
        prompt: promptText,
        videoModel: meta.model ?? state.videoModel,
        duration: meta.duration ?? state.videoDuration,
        resolution: meta.resolution ?? state.videoResolution,
        aspectRatio: meta.aspectRatio ?? state.videoAspectRatio,
        generateAudio: meta.generateAudio ?? state.videoGenerateAudio,
        references: state.references,
        conversationId,
        variant: { ...variant, status: "generating" },
      });

      set((s) => {
        const nextVariants = s.variants.map((v) =>
          v.id === variantId ? updated : v
        );
        return {
          variants: nextVariants,
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, variants: nextVariants }
              : c
          ),
        };
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Video generation failed";
      set((s) => ({
        variants: s.variants.map((v) =>
          v.id === variantId
            ? { ...v, status: "error" as const, errorMessage: message }
            : v
        ),
        generationError: message,
      }));
    }
  },

  retryFailedVariant: async (variantId) => {
    const variant = get().variants.find((v) => v.id === variantId);
    if (variant?.mediaType === "video") {
      await get().retryVideoVariant(variantId);
      return;
    }
    await get().regenerateVariant(variantId);
  },

  generateVariations: async (parentVariantId) => {
    const state = get();
    const parent = state.variants.find((v) => v.id === parentVariantId);
    if (!parent?.imageUrl || parent.status !== "complete") {
      set({
        generationError:
          "Wait for this layout image to finish before creating variations.",
      });
      return;
    }

    const existing = getChildVariations(state.variants, parentVariantId);
    const busy = existing.some(
      (v) => v.status === "generating" || v.status === "pending"
    );
    if (busy) return;

    const slotsLeft = remainingVariationSlots(existing);
    if (slotsLeft <= 0) {
      set({
        generationError: `This layout already has the maximum of ${MAX_VARIATIONS} variations.`,
      });
      return;
    }

    const batchCount = Math.min(
      clampVariationBatch(state.variationBatchSize),
      slotsLeft
    );
    const startIndex = getNextVariationStartIndex(existing);

    const conversationId = state.activeConversationId;
    if (!conversationId) {
      set({
        generationError: "Save this generation to history before adding variations.",
      });
      return;
    }

    const pendingVariations = buildPendingVariations(
      parent,
      state.style,
      batchCount,
      startIndex
    );
    set({
      generationError: null,
      generatingVariationsParentId: parentVariantId,
    });

    try {
      await prepareVariationsForParent(
        conversationId,
        parentVariantId,
        pendingVariations
      );
    } catch (err) {
      set({
        generatingVariationsParentId: null,
        generationError:
          err instanceof Error ? err.message : "Failed to save variations",
      });
      return;
    }

    const withPending = [...state.variants, ...pendingVariations];
    set({ variants: withPending });

    try {
      const completed = await generateVariantVariations({
        parent,
        pendingVariations,
        style: state.style,
        platform: state.platform,
        aspectRatio: state.aspectRatio,
        params: state.params,
        imageModel: state.imageModel,
        designTokens: state.designTokens ?? undefined,
        conversationId,
        onProgress: (partial) => {
          set((s) => ({
            variants: s.variants.map((v) => {
              const updated = partial.find((p) => p.id === v.id);
              return updated ?? v;
            }),
          }));
        },
      });

      set((s) => {
        const nextVariants = s.variants.map((v) => {
          const updated = completed.find((c) => c.id === v.id);
          return updated ?? v;
        });
        return {
          variants: nextVariants,
          generatingVariationsParentId: null,
          conversations: s.activeConversationId
            ? s.conversations.map((c) =>
                c.id === s.activeConversationId
                  ? { ...c, variants: nextVariants }
                  : c
              )
            : s.conversations,
        };
      });

      try {
        const refreshed = await fetchConversationById(conversationId);
        set((s) => ({
          variants: refreshed.variants,
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, variants: refreshed.variants } : c
          ),
        }));
      } catch {
        /* keep local */
      }
    } catch (err) {
      set({
        generatingVariationsParentId: null,
        generationError:
          err instanceof Error ? err.message : "Variation generation failed",
      });
    }
  },
}));
