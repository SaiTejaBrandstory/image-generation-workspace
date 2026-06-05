import type { SupabaseClient } from "@supabase/supabase-js";
import { getSignedImageUrl } from "@/lib/supabase/storage";
import type {
  AspectRatio,
  ChatMessage,
  Conversation,
  ConversationMediaType,
  GenerationParams,
  LayoutId,
  LayoutVariant,
  MediaType,
  PlatformPreset,
  StyleEngine,
  VideoMeta,
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
  video_model: string | null;
  media_type: ConversationMediaType;
  params: GenerationParams;
  selected_layouts: LayoutId[];
  starred: boolean;
  project_id: string | null;
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
  parent_variant_id: string | null;
  variant_kind: string;
  variation_index: number | null;
  media_type: MediaType;
  video_meta: VideoMeta | null;
  created_at: string;
}

export async function mapVariantRowToClient(
  row: DbVariantRow
): Promise<LayoutVariant> {
  const isVideo = row.media_type === "video";
  let imageUrl: string | undefined;
  let videoUrl: string | undefined;
  if (row.storage_path) {
    const signed = (await getSignedImageUrl(row.storage_path)) ?? undefined;
    if (isVideo) videoUrl = signed;
    else imageUrl = signed;
  }

  return {
    id: row.id,
    layoutId: row.layout_id as LayoutId,
    mediaType: row.media_type ?? "image",
    videoUrl,
    videoMeta: row.video_meta ?? undefined,
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
    parentVariantId: row.parent_variant_id ?? undefined,
    variantKind: (row.variant_kind as LayoutVariant["variantKind"]) ?? "layout",
    variationIndex: row.variation_index ?? undefined,
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
    mediaType: row.media_type ?? "image",
    messages: [],
    variants: [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    starred: row.starred,
    projectId: row.project_id ?? null,
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

  const row = conv as DbConversationRow;
  const inferredMediaType =
    row.media_type ??
    (mappedVariants.some((v) => v.mediaType === "video") ? "video" : "image");
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt ?? undefined,
    mediaType: inferredMediaType,
    messages: ((messages ?? []) as DbMessageRow[]).map(mapMessageRow),
    variants: mappedVariants,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    starred: row.starred,
    projectId: row.project_id ?? null,
  };
}

export async function updateConversationMeta(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  patch: {
    title?: string;
    starred?: boolean;
    projectId?: string | null;
  }
): Promise<Conversation | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.starred !== undefined) update.starred = patch.starred;
  if (patch.projectId !== undefined) update.project_id = patch.projectId;

  const { error } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const { data, error: fetchError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) return null;
  return mapConversationListRow(data as DbConversationRow);
}

export async function deleteConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
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
  videoMeta: VideoMeta;
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
    signedUrl: signedUrl ?? (typeof imageSource === "string" ? imageSource : ""),
  };
}

export async function persistVariantVideo(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  variantId: string,
  videoSource:
    | string
    | { buffer: Buffer; mime?: string },
  patch: VariantDbPatch & { videoMeta?: VideoMeta }
): Promise<{ storagePath: string; signedUrl: string }> {
  const {
    uploadGenerationVideo,
    uploadGenerationVideoBuffer,
    isPersistableVideoUrl,
  } = await import("@/lib/supabase/storage");

  let storagePath: string | null = null;
  let signedUrl: string | null = null;

  if (typeof videoSource === "object" && Buffer.isBuffer(videoSource.buffer)) {
    const uploaded = await uploadGenerationVideoBuffer({
      userId,
      conversationId,
      variantId,
      buffer: videoSource.buffer,
      mime: videoSource.mime,
    });
    storagePath = uploaded.storagePath;
    signedUrl = uploaded.signedUrl;
  } else if (
    typeof videoSource === "string" &&
    isPersistableVideoUrl(videoSource)
  ) {
    const uploaded = await uploadGenerationVideo({
      userId,
      conversationId,
      variantId,
      videoSource,
    });
    storagePath = uploaded.storagePath;
    signedUrl = uploaded.signedUrl;
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    media_type: "video",
    ...variantPatchToDb(patch),
  };
  if (storagePath) update.storage_path = storagePath;
  if (patch.videoMeta) update.video_meta = patch.videoMeta;
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
    signedUrl:
      signedUrl ??
      (typeof videoSource === "string" ? videoSource : ""),
  };
}

export { GENERATIONS_BUCKET };
