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
} from "@/lib/conversations-api";
import {
  buildPendingVariants,
  generateLayoutVariants,
  generateSingleVariant,
} from "@/lib/generation-engine";
import { DEFAULT_IMAGE_MODEL } from "@/lib/openrouter-models";
import { LAYOUT_SYSTEMS } from "@/lib/layout-systems";
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
  PlatformPreset,
  ReferenceImage,
  StyleEngine,
} from "@/types";

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
  generationProgress: number;
  generationError: string | null;
  expandedVariantId: string | null;
  expandedMode: "view" | "edit";
  showDesignDna: boolean;
  activeBrand: Brand | null;
  designTokens: DesignTokens | null;
  imageModel: string;
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
  setAspectRatio: (ratio: AspectRatio) => void;
  setPlatform: (platform: PlatformPreset) => void;
  setStyle: (style: StyleEngine) => void;
  setParam: <K extends keyof GenerationParams>(
    key: K,
    value: GenerationParams[K]
  ) => void;
  addReference: (file: File) => void;
  removeReference: (id: string) => void;
  updateReference: (
    id: string,
    patch: Partial<Pick<ReferenceImage, "role" | "influence" | "locked">>
  ) => void;
  setExpandedVariant: (id: string | null, mode?: "view" | "edit") => void;
  openEditVariant: (id: string) => void;
  regenerateVariant: (variantId: string, customPrompt?: string) => Promise<void>;
  setShowDesignDna: (show: boolean) => void;
  loadDesignMd: (content: string) => void;
  setActiveBrand: (brand: Brand | null) => void;
  loadHistory: () => Promise<void>;
  newConversation: () => void;
  selectConversation: (id: string) => Promise<void>;
  generate: () => Promise<void>;
  remixVariant: (variantId: string) => Promise<void>;
  retryFailedVariant: (variantId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  sidebarExpanded: false,
  theme: "dark",
  activeConversationId: null,
  conversations: [],
  prompt: "",
  selectedLayouts: LAYOUT_SYSTEMS.map((l) => l.id),
  aspectRatio: "auto",
  platform: "instagram-post",
  style: "luxury",
  params: { ...DEFAULT_PARAMS },
  references: [],
  variants: [],
  isGenerating: false,
  generationProgress: 0,
  generationError: null,
  expandedVariantId: null,
  expandedMode: "view",
  showDesignDna: false,
  activeBrand: null,
  designTokens: null,
  imageModel: DEFAULT_IMAGE_MODEL,
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

  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setPlatform: (platform) => set({ platform }),
  setStyle: (style) => set({ style }),

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),

  addReference: (file) => {
    const url = URL.createObjectURL(file);
    const ref: ReferenceImage = {
      id: uid(),
      url,
      name: file.name,
      role: "style",
      influence: 70,
      locked: false,
    };
    set((s) => ({ references: [...s.references, ref] }));
  },

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
    }),

  openEditVariant: (id) =>
    set({ expandedVariantId: id, expandedMode: "edit" }),
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
      expandedVariantId: null,
      generationError: null,
      mobilePanel: "chat",
      mobileSidebarOpen: false,
    });
  },

  selectConversation: async (id) => {
    set({ activeConversationId: id, generationError: null, mobileSidebarOpen: false });

    try {
      const conversation = await fetchConversationById(id);
      set((s) => ({
        variants: conversation.variants,
        prompt:
          conversation.messages.find((m) => m.role === "user")?.content ??
          conversation.title,
        conversations: s.conversations.map((c) =>
          c.id === id ? conversation : c
        ),
        mobilePanel:
          conversation.variants.length > 0 ? "layouts" : "chat",
      }));
    } catch (err) {
      set({
        generationError:
          err instanceof Error ? err.message : "Failed to load conversation",
      });
    }
  },

  generate: async () => {
    const state = get();
    if (state.isGenerating) return;
    if (!state.prompt.trim()) return;

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

    set({ isGenerating: true, generationError: null, generationProgress: 0 });

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
        : (LAYOUT_SYSTEMS.map((l) => l.id) as LayoutId[]);

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

  regenerateVariant: async (variantId, customPrompt) => {
    const state = get();
    const variant = state.variants.find((v) => v.id === variantId);
    if (!variant) return;

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
      const updated = await generateSingleVariant({
        prompt: promptText,
        layoutId: variant.layoutId,
        style: state.style,
        platform: state.platform,
        aspectRatio: state.aspectRatio,
        params: state.params,
        references: state.references,
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

  retryFailedVariant: async (variantId) => {
    await get().regenerateVariant(variantId);
  },
}));
