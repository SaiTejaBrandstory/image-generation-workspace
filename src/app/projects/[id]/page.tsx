import { redirect } from "next/navigation";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import { ProjectsShell } from "@/components/projects/projects-shell";
import { createClient } from "@/lib/supabase/server";
import { authUserFromSupabase } from "@/types/auth";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ProjectsShell user={authUserFromSupabase(user)}>
      <ProjectDetailView projectId={id} />
    </ProjectsShell>
  );
}
