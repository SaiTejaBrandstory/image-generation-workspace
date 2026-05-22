import { redirect } from "next/navigation";
import { ProjectsShell } from "@/components/projects/projects-shell";
import { createClient } from "@/lib/supabase/server";
import { authUserFromSupabase } from "@/types/auth";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <ProjectsShell user={authUserFromSupabase(user)} />;
}
