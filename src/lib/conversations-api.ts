import type {
  AspectRatio,
  ChatMessage,
  Conversation,
  GenerationParams,
  LayoutId,
  LayoutVariant,
  PlatformPreset,
  StyleEngine,
} from "@/types";

export async function fetchConversationHistory(
  query?: string
): Promise<Conversation[]> {
  const params = new URLSearchParams();
  if (query?.trim()) params.set("q", query.trim());
  const url = params.size
    ? `/api/conversations?${params}`
    : "/api/conversations";
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load history");
  return data.conversations as Conversation[];
}

export async function fetchConversationById(
  id: string
): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load conversation");
  return data.conversation as Conversation;
}

function variantsToApiPayload(
  variants: LayoutVariant[],
  defaultPrompt: string
) {
  return variants.map((v, i) => ({
    id: v.id,
    layoutId: v.layoutId,
    userPrompt: v.userPrompt,
    prompt: v.prompt,
    rationale: v.rationale,
    visualPsychology: v.visualPsychology,
    bestUse: v.bestUse,
    suggestedPlatform: v.suggestedPlatform,
    principles: v.principles,
    influenceBreakdown: v.influenceBreakdown,
    status: v.status,
    sortIndex: i,
    generationRound: v.generationRound ?? 0,
  }));
}

export interface PrepareGenerationResult {
  conversationId: string;
  generationRound: number;
  roundCreatedAt: string;
}

export async function prepareConversationForGeneration(
  conversationId: string,
  options: {
    prompt: string;
    style: StyleEngine;
    platform: PlatformPreset;
    aspectRatio: AspectRatio;
    imageModel: string;
    params: GenerationParams;
    selectedLayouts: LayoutId[];
    variants: LayoutVariant[];
  }
): Promise<PrepareGenerationResult> {
  const res = await fetch(`/api/conversations/${conversationId}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      style: options.style,
      platform: options.platform,
      aspectRatio: options.aspectRatio,
      imageModel: options.imageModel,
      params: options.params,
      selectedLayouts: options.selectedLayouts,
      variants: variantsToApiPayload(options.variants, options.prompt),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update conversation");
  return {
    conversationId: data.conversationId as string,
    generationRound: data.generationRound as number,
    roundCreatedAt: data.roundCreatedAt as string,
  };
}

export async function createConversationRecord(options: {
  prompt: string;
  style: StyleEngine;
  platform: PlatformPreset;
  aspectRatio: AspectRatio;
  imageModel: string;
  params: GenerationParams;
  selectedLayouts: LayoutId[];
  variants: LayoutVariant[];
}): Promise<string> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      style: options.style,
      platform: options.platform,
      aspectRatio: options.aspectRatio,
      imageModel: options.imageModel,
      params: options.params,
      selectedLayouts: options.selectedLayouts,
      variants: variantsToApiPayload(options.variants, options.prompt),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to save conversation");
  return data.conversationId as string;
}

export async function finalizeConversation(
  id: string,
  options: { title?: string; messages: ChatMessage[] }
): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to save messages");
  return data.conversation as Conversation;
}

export async function patchConversationMeta(
  id: string,
  patch: {
    title?: string;
    starred?: boolean;
    projectId?: string | null;
  }
): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update conversation");
  return (data.conversation ?? data) as Conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to delete conversation");
}

export async function prepareVariationsForParent(
  conversationId: string,
  parentVariantId: string,
  variants: LayoutVariant[]
): Promise<void> {
  const res = await fetch(
    `/api/conversations/${conversationId}/variations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentVariantId,
        variants: variants.map((v) => ({
          id: v.id,
          layoutId: v.layoutId,
          parentVariantId: v.parentVariantId!,
          variationIndex: v.variationIndex ?? 0,
          userPrompt: v.userPrompt,
          prompt: v.prompt,
          rationale: v.rationale,
          visualPsychology: v.visualPsychology,
          bestUse: v.bestUse,
          suggestedPlatform: v.suggestedPlatform,
          principles: v.principles,
          influenceBreakdown: v.influenceBreakdown,
          status: v.status,
          sortIndex: v.sortIndex ?? 0,
          generationRound: v.generationRound ?? 0,
        })),
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to save variations");
}
