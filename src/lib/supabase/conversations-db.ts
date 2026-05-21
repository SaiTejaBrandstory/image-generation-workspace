import type { SupabaseClient } from "@supabase/supabase-js";
import { getSignedImageUrl } from "@/lib/supabase/storage";
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

const GENERATIONS_BUCKET = "generations";

export interface DbConversationRow {
  id: string;
  user_id: string;
  title: string;
  prompt: string | null;
  style: string | null;
  platform: string | null;
  aspect_ratio: string | null;
  image_model: string | null;
  params: GenerationParams;
  selected_layouts: LayoutId[];
  starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reference_ids: string[] | null;
  position: number;
  created_at: string;
}

export interface DbVariantRow {
  id: string;
  conversation_id: string;
  layout_id: string;
  user_prompt: string | null;
  prompt: string | null;
  storage_path: string | null;
  rationale: string | null;
  visual_psychology: string | null;
  best_use: string | null;
  suggested_platform: string | null;
  principles: string[];
  influence_breakdown: Record<string, number> | null;
  status: LayoutVariant["status"];
  error_message: string | null;
  sort_index: number;
  generation_round: number;
  created_at: string;
}

export async function mapVariantRowToClient(
  row: DbVariantRow
): Promise<LayoutVariant> {
  let imageUrl: string | undefined;
  if (row.storage_path) {
    imageUrl = (await getSignedImageUrl(row.storage_path)) ?? undefined;
  }

  return {
    id: row.id,
    layoutId: row.layout_id as LayoutId,
    userPrompt: row.user_prompt ?? undefined,
    prompt: row.prompt ?? "",
    imageUrl,
    rationale: row.rationale ?? "",
    visualPsychology: row.visual_psychology ?? "",
    bestUse: row.best_use ?? "",
    suggestedPlatform: row.suggested_platform ?? "",
    principles: row.principles ?? [],
    influenceBreakdown: row.influence_breakdown ?? undefined,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    generationRound: row.generation_round ?? 0,
    createdAt: new Date(row.created_at).getTime(),
    sortIndex: row.sort_index,
  };
}

function mapMessageRow(row: DbMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
    referenceIds: row.reference_ids ?? undefined,
  };
}

export function mapConversationListRow(row: DbConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt ?? undefined,
    messages: [],
    variants: [],
    createdAt: new Date(row.created_at).getTime(),
    starred: row.starred,
  };
}

export async function searchConversations(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit = 50
): Promise<Conversation[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listConversations(supabase, userId, limit);

  const all = await listConversations(supabase, userId, 100);

  const { data: messageMatches, error: msgError } = await supabase
    .from("chat_messages")
    .select("conversation_id")
    .eq("user_id", userId)
    .ilike("content", `%${query.trim()}%`);

  if (msgError) throw new Error(msgError.message);

  const messageConvIds = new Set(
    (messageMatches ?? []).map((m) => m.conversation_id as string)
  );

  const filtered = all.filter((c) => {
    if (c.title.toLowerCase().includes(q)) return true;
    if (c.prompt?.toLowerCase().includes(q)) return true;
    if (messageConvIds.has(c.id)) return true;
    return false;
  });

  return filtered.slice(0, limit);
}

export async function fetchConversationDetail(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (convError || !conv) return null;

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("position", { ascending: true });

  const { data: variants } = await supabase
    .from("layout_variants")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("generation_round", { ascending: true })
    .order("sort_index", { ascending: true });

  const mappedVariants = await Promise.all(
    ((variants ?? []) as DbVariantRow[]).map(mapVariantRowToClient)
  );

  return {
    id: conv.id,
    title: conv.title,
    messages: ((messages ?? []) as DbMessageRow[]).map(mapMessageRow),
    variants: mappedVariants,
    createdAt: new Date(conv.created_at).getTime(),
    starred: conv.starred,
  };
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbConversationRow[]).map(mapConversationListRow);
}

type VariantDbPatch = Partial<{
  status: LayoutVariant["status"];
  errorMessage: string | null;
  userPrompt: string;
  prompt: string;
  rationale: string;
  visualPsychology: string;
  bestUse: string;
  suggestedPlatform: string;
  principles: string[];
  influenceBreakdown: Record<string, number>;
}>;

/** Map client field names to Postgres column names for layout_variants */
function variantPatchToDb(patch: VariantDbPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;
  if (patch.userPrompt !== undefined) row.user_prompt = patch.userPrompt;
  if (patch.prompt !== undefined) row.prompt = patch.prompt;
  if (patch.rationale !== undefined) row.rationale = patch.rationale;
  if (patch.visualPsychology !== undefined) {
    row.visual_psychology = patch.visualPsychology;
  }
  if (patch.bestUse !== undefined) row.best_use = patch.bestUse;
  if (patch.suggestedPlatform !== undefined) {
    row.suggested_platform = patch.suggestedPlatform;
  }
  if (patch.principles !== undefined) row.principles = patch.principles;
  if (patch.influenceBreakdown !== undefined) {
    row.influence_breakdown = patch.influenceBreakdown;
  }
  return row;
}

export async function persistVariantImage(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  variantId: string,
  imageSource: string,
  patch: VariantDbPatch
): Promise<{ storagePath: string; signedUrl: string }> {
  const { uploadGenerationImage, isPersistableImageUrl } = await import(
    "@/lib/supabase/storage"
  );

  let storagePath: string | null = null;
  let signedUrl: string | null = null;

  if (isPersistableImageUrl(imageSource)) {
    const uploaded = await uploadGenerationImage({
      userId,
      conversationId,
      variantId,
      imageSource,
    });
    storagePath = uploaded.storagePath;
    signedUrl = uploaded.signedUrl;
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...variantPatchToDb(patch),
  };
  if (storagePath) update.storage_path = storagePath;
  if (patch.status === "error") {
    update.error_message = patch.errorMessage ?? null;
  } else if (patch.status === "complete") {
    update.error_message = null;
  }

  const { error } = await supabase
    .from("layout_variants")
    .update(update)
    .eq("id", variantId)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId);

  if (error) throw new Error(error.message);

  return {
    storagePath: storagePath ?? "",
    signedUrl: signedUrl ?? imageSource,
  };
}

export { GENERATIONS_BUCKET };
