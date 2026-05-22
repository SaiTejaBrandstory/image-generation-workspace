import type { Project } from "@/types";

export async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load project");
  return data.project as Project;
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load projects");
  return data.projects as Project[];
}

export async function createProject(
  name: string,
  description?: string | null
): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description ?? null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create project");
  return data.project as Project;
}

export async function updateProject(
  id: string,
  patch: { name?: string; description?: string | null }
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update project");
  return data.project as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to delete project");
}
