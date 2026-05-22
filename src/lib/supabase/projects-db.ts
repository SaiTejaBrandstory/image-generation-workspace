import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "@/types";

export interface DbProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function mapProjectRow(
  row: DbProjectRow,
  conversationCount?: number
): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    conversationCount,
  };
}

export async function getProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { count, error: countError } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", projectId);

  if (countError) throw new Error(countError.message);

  return mapProjectRow(data as DbProjectRow, count ?? 0);
}

export async function listProjects(
  supabase: SupabaseClient,
  userId: string
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const projects = (data ?? []) as DbProjectRow[];
  if (projects.length === 0) return [];

  const { data: counts, error: countError } = await supabase
    .from("conversations")
    .select("project_id")
    .eq("user_id", userId)
    .not("project_id", "is", null);

  if (countError) throw new Error(countError.message);

  const countByProject = new Map<string, number>();
  for (const row of counts ?? []) {
    const pid = row.project_id as string;
    countByProject.set(pid, (countByProject.get(pid) ?? 0) + 1);
  }

  return projects.map((p) =>
    mapProjectRow(p, countByProject.get(p.id) ?? 0)
  );
}

export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  options: { name: string; description?: string | null }
): Promise<Project> {
  const trimmed = options.name.trim();
  if (!trimmed) throw new Error("Project name is required.");

  const description = options.description?.trim() || null;

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name: trimmed, description })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapProjectRow(data as DbProjectRow, 0);
}

export async function updateProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  patch: { name?: string; description?: string | null }
): Promise<Project> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("Project name is required.");
    update.name = trimmed;
  }

  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null;
  }

  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapProjectRow(data as DbProjectRow);
}

export async function deleteProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function assertProjectOwned(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found.");
}
