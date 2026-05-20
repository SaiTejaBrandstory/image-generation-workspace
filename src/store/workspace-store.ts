"use client";

import { create } from "zustand";
import { DEFAULT_PARAMS, SAMPLE_DESIGN_MD } from "@/lib/constants";
import { parseDesignMd } from "@/lib/design-md-parser";
import {
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

  toggleSidebar: () => void;
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
  newConversation: () => void;
  selectConversation: (id: string) => void;
  generate: () => Promise<void>;
  remixVariant: (variantId: string) => Promise<void>;
  retryFailedVariant: (variantId: string) => Promise<void>;
}

const defaultBrand: Brand = {
  id: "brand-porsche",
  name: "Porsche",
  industry: "Automotive / Luxury",
  designMdRaw: SAMPLE_DESIGN_MD,
  designTokens: parseDesignMd(SAMPLE_DESIGN_MD),
};

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
  activeBrand: defaultBrand,
  designTokens: defaultBrand.designTokens ?? null,
  imageModel: DEFAULT_IMAGE_MODEL,

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
    const id = uid();
    const conv: Conversation = {
      id,
      title: "New generation",
      messages: [],
      variants: [],
      createdAt: Date.now(),
    };
    set({
      activeConversationId: id,
      conversations: [conv, ...get().conversations],
      prompt: "",
      variants: [],
      references: [],
      expandedVariantId: null,
    });
  },

  selectConversation: (id) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (conv) {
      set({
        activeConversationId: id,
        variants: conv.variants,
        prompt: conv.messages.find((m) => m.role === "user")?.content ?? "",
      });
    }
  },

  generate: async () => {
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
      activeConversationId,
      conversations,
    } = get();

    if (!prompt.trim()) return;

    set({ generationError: null });

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      referenceIds: references.map((r) => r.id),
    };

    const assistantMsg: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: `Generating ${selectedLayouts.length || 20} layout variations using ${style} style engine${get().activeBrand ? ` with ${get().activeBrand!.name} brand DNA` : ""}…`,
      timestamp: Date.now(),
    };

    const layoutIds =
      selectedLayouts.length > 0
        ? selectedLayouts
        : (LAYOUT_SYSTEMS.map((l) => l.id) as LayoutId[]);

    set({ isGenerating: true, generationProgress: 0, variants: [] });

    let variants: LayoutVariant[] = [];
    try {
      variants = await generateLayoutVariants({
        prompt,
        layoutIds,
        style,
        platform,
        aspectRatio,
        params,
        references,
        imageModel,
        designTokens: designTokens ?? undefined,
        onProgress: (progress, partial) => {
          set({ generationProgress: progress, variants: partial });
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Generation failed";
      set({
        isGenerating: false,
        generationError: message,
      });
      return;
    }

    const successCount = variants.filter((v) => v.status === "complete").length;
    const errorCount = variants.filter((v) => v.status === "error").length;

    const finalAssistant: ChatMessage = {
      id: uid(),
      role: "assistant",
      content:
        errorCount > 0
          ? `Created ${successCount} images (${errorCount} failed — check OPENROUTER_API_KEY and credits). Open any card to expand or remix.`
          : `Created ${successCount} layout images via OpenRouter. Each includes design rationale and platform recommendations. Open any card to edit, remix, or expand.`,
      timestamp: Date.now(),
    };

    const title =
      prompt.length > 40 ? `${prompt.slice(0, 40)}…` : prompt;

    let updatedConversations = [...conversations];
    if (activeConversationId) {
      updatedConversations = updatedConversations.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              title,
              messages: [...c.messages, userMsg, finalAssistant],
              variants,
            }
          : c
      );
    } else {
      const newId = uid();
      updatedConversations = [
        {
          id: newId,
          title,
          messages: [userMsg, finalAssistant],
          variants,
          createdAt: Date.now(),
        },
        ...conversations,
      ];
      set({ activeConversationId: newId });
    }

    set({
      variants,
      isGenerating: false,
      generationProgress: 100,
      conversations: updatedConversations,
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
      });

      set((s) => ({
        variants: s.variants.map((v) =>
          v.id === variantId ? updated : v
        ),
      }));
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
