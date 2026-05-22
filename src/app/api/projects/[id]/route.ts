import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteProject,
  getProject,
  updateProject,
} from "@/lib/supabase/projects-db";
import { formatSupabaseSetupError } from "@/lib/supabase/setup-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const project = await getProject(supabase, user.id, id);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load project";
    console.error("[projects/[id] GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const project = await updateProject(supabase, user.id, id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
    });
    return NextResponse.json({ project });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update project";
    console.error("[projects/[id] PATCH]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    await deleteProject(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete project";
    console.error("[projects/[id] DELETE]", message);
    const friendly = formatSupabaseSetupError(message);
    const isSetup = friendly !== message;
    return NextResponse.json(
      { error: friendly },
      { status: isSetup ? 503 : 500 }
    );
  }
}
