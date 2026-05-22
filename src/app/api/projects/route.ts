import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createProject,
  listProjects,
} from "@/lib/supabase/projects-db";
import { formatSupabaseSetupError } from "@/lib/supabase/setup-errors";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const projects = await listProjects(supabase, user.id);
    return NextResponse.json({ projects });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load projects";
    console.error("[projects GET]", message);
    const friendly = formatSupabaseSetupError(message);
    const isSetup = friendly !== message;
    return NextResponse.json(
      { error: friendly },
      { status: isSetup ? 503 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
    };
    const project = await createProject(supabase, user.id, {
      name: body.name ?? "",
      description: body.description ?? null,
    });
    return NextResponse.json({ project });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create project";
    console.error("[projects POST]", message);
    const friendly = formatSupabaseSetupError(message);
    const isSetup = friendly !== message;
    return NextResponse.json(
      { error: friendly },
      { status: isSetup ? 503 : 500 }
    );
  }
}
