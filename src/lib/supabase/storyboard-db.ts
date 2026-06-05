import type { SupabaseClient } from "@supabase/supabase-js";
import { getSignedImageUrl } from "@/lib/supabase/storage";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

export interface DbStoryboardSceneRow {
  id: string;
  conversation_id: string;
  user_id: string;
  scene_number: number;
  duration_sec: number;
  voiceover: string;
  visual_description: string;
  camera_direction: string;
  camera_angle: string;
  camera_movement: string;
  character_actions: string;
  environment: string;
  emotion: string;
  transition: string;
  image_prompt: string;
  frame_storage_path: string | null;
  frame_status: StoryboardScene["frameStatus"];
  frame_error: string | null;
  sort_index: number;
}

export interface DbStoryboardOutputsRow {
  conversation_id: string;
  user_id: string;
  continuity: StoryboardContinuity | null;
  settings: StoryboardProjectSettings;
  single_video_storage_path: string | null;
  stitched_video_storage_path: string | null;
  single_video_duration_sec: number | null;
  stitched_video_duration_sec: number | null;
  wizard_locked: boolean;
}

export interface StoryboardPersistPayload {
  conversationId?: string | null;
  script: string;
  settings: StoryboardProjectSettings;
  continuity: StoryboardContinuity | null;
  scenes: StoryboardScene[];
  singleVideoStoragePath?: string | null;
  stitchedVideoStoragePath?: string | null;
  singleVideoDurationSec?: number | null;
  stitchedVideoDurationSec?: number | null;
}

export interface LoadedStoryboard {
  conversationId: string;
  title: string;
  script: string;
  settings: StoryboardProjectSettings;
  continuity: StoryboardContinuity | null;
  scenes: StoryboardScene[];
  wizardLocked: boolean;
  storyboardVideoUrl: string | null;
  storyboardStitchedVideoUrl: string | null;
  storyboardVideoDurationSec: number | null;
  storyboardStitchedVideoDurationSec: number | null;
}

function sceneToRow(
  scene: StoryboardScene,
  conversationId: string,
  userId: string,
  index: number
): Omit<DbStoryboardSceneRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
} {
  return {
    id: scene.id,
    conversation_id: conversationId,
    user_id: userId,
    scene_number: scene.sceneNumber,
    duration_sec: scene.durationSec,
    voiceover: scene.voiceover,
    visual_description: scene.visualDescription,
    camera_direction: scene.cameraDirection,
    camera_angle: scene.cameraAngle,
    camera_movement: scene.cameraMovement,
    character_actions: scene.characterActions,
    environment: scene.environment,
    emotion: scene.emotion,
    transition: scene.transition,
    image_prompt: scene.imagePrompt,
    frame_storage_path: scene.frameStoragePath ?? null,
    frame_status: scene.frameStatus,
    frame_error: scene.frameError ?? null,
    sort_index: index,
  };
}

async function mapSceneRow(row: DbStoryboardSceneRow): Promise<StoryboardScene> {
  let frameImageUrl: string | undefined;
  if (row.frame_storage_path) {
    frameImageUrl =
      (await getSignedImageUrl(row.frame_storage_path)) ?? undefined;
  }

  return {
    id: row.id,
    sceneNumber: row.scene_number,
    durationSec: row.duration_sec,
    voiceover: row.voiceover,
    visualDescription: row.visual_description,
    cameraDirection: row.camera_direction,
    cameraAngle: row.camera_angle,
    cameraMovement: row.camera_movement,
    characterActions: row.character_actions,
    environment: row.environment,
    emotion: row.emotion as StoryboardScene["emotion"],
    transition: row.transition as StoryboardScene["transition"],
    imagePrompt: row.image_prompt,
    frameStoragePath: row.frame_storage_path ?? undefined,
    frameImageUrl,
    frameStatus: row.frame_status,
    frameError: row.frame_error ?? undefined,
  };
}

export async function persistStoryboard(
  supabase: SupabaseClient,
  userId: string,
  payload: StoryboardPersistPayload
): Promise<{ conversationId: string }> {
  const title =
    payload.script.trim().length > 48
      ? `${payload.script.trim().slice(0, 48)}…`
      : payload.script.trim() || "Storyboard";

  let conversationId = payload.conversationId?.trim() || null;

  if (conversationId) {
    const { error } = await supabase
      .from("conversations")
      .update({
        title,
        prompt: payload.script,
        media_type: "storyboard",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        title,
        prompt: payload.script,
        media_type: "storyboard",
        style: "none",
        platform: payload.settings.platform,
        aspect_ratio: "16:9",
        image_model: null,
        params: {},
        selected_layouts: [],
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create storyboard");
    }
    conversationId = data.id as string;
  }

  await supabase
    .from("storyboard_scenes")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  const sceneRows = payload.scenes.map((scene, index) =>
    sceneToRow(scene, conversationId!, userId, index)
  );

  if (sceneRows.length) {
    const { error: scenesError } = await supabase
      .from("storyboard_scenes")
      .insert(sceneRows);
    if (scenesError) throw new Error(scenesError.message);
  }

  const outputsRow = {
    conversation_id: conversationId,
    user_id: userId,
    continuity: payload.continuity,
    settings: payload.settings,
    single_video_storage_path: payload.singleVideoStoragePath ?? null,
    stitched_video_storage_path: payload.stitchedVideoStoragePath ?? null,
    single_video_duration_sec: payload.singleVideoDurationSec ?? null,
    stitched_video_duration_sec: payload.stitchedVideoDurationSec ?? null,
    wizard_locked: true,
    updated_at: new Date().toISOString(),
  };

  const { error: outputsError } = await supabase
    .from("storyboard_outputs")
    .upsert(outputsRow, { onConflict: "conversation_id" });

  if (outputsError) throw new Error(outputsError.message);

  return { conversationId };
}

export async function loadStoryboardByConversationId(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<LoadedStoryboard | null> {
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("id, title, prompt, media_type")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (convError || !conv || conv.media_type !== "storyboard") return null;

  const { data: scenes } = await supabase
    .from("storyboard_scenes")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sort_index", { ascending: true });

  const { data: outputs } = await supabase
    .from("storyboard_outputs")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  const mappedScenes = await Promise.all(
    ((scenes ?? []) as DbStoryboardSceneRow[]).map(mapSceneRow)
  );

  const out = outputs as DbStoryboardOutputsRow | null;
  const settings = (out?.settings ?? {
    genre: "commercial",
    durationSec: 30,
    frameCount: 6,
    targetAudience: "",
    visualStyle: "",
    mood: "",
    brandTone: "",
    platform: "youtube",
  }) as StoryboardProjectSettings;

  let storyboardVideoUrl: string | null = null;
  let storyboardStitchedVideoUrl: string | null = null;
  if (out?.single_video_storage_path) {
    storyboardVideoUrl =
      (await getSignedImageUrl(out.single_video_storage_path)) ?? null;
  }
  if (out?.stitched_video_storage_path) {
    storyboardStitchedVideoUrl =
      (await getSignedImageUrl(out.stitched_video_storage_path)) ?? null;
  }

  return {
    conversationId,
    title: conv.title as string,
    script: (conv.prompt as string) ?? "",
    settings,
    continuity: out?.continuity ?? null,
    scenes: mappedScenes,
    wizardLocked: out?.wizard_locked ?? true,
    storyboardVideoUrl,
    storyboardStitchedVideoUrl,
    storyboardVideoDurationSec: out?.single_video_duration_sec ?? null,
    storyboardStitchedVideoDurationSec:
      out?.stitched_video_duration_sec ?? null,
  };
}

export async function updateStoryboardOutputs(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  patch: Partial<{
    singleVideoStoragePath: string | null;
    stitchedVideoStoragePath: string | null;
    singleVideoDurationSec: number | null;
    stitchedVideoDurationSec: number | null;
  }>
): Promise<void> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.singleVideoStoragePath !== undefined) {
    row.single_video_storage_path = patch.singleVideoStoragePath;
  }
  if (patch.stitchedVideoStoragePath !== undefined) {
    row.stitched_video_storage_path = patch.stitchedVideoStoragePath;
  }
  if (patch.singleVideoDurationSec !== undefined) {
    row.single_video_duration_sec = patch.singleVideoDurationSec;
  }
  if (patch.stitchedVideoDurationSec !== undefined) {
    row.stitched_video_duration_sec = patch.stitchedVideoDurationSec;
  }

  const { error } = await supabase
    .from("storyboard_outputs")
    .update(row)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
}

/** Extract storage path from Supabase signed URL if possible */
export function storagePathFromGenerationsUrl(
  url: string,
  userId: string
): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/object/sign/${"generations"}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(
      parsed.pathname.slice(idx + marker.length).split("?")[0] ?? ""
    );
    return path.startsWith(userId) ? path : null;
  } catch {
    return null;
  }
}
