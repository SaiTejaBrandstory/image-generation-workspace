import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteConversation,
  fetchConversationDetail,
  updateConversationMeta,
} from "@/lib/supabase/conversations-db";
import { assertProjectOwned } from "@/lib/supabase/projects-db";
import { deleteConversationStorage } from "@/lib/supabase/storage";
import type { ChatMessage } from "@/types";

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

    const conversation = await fetchConversationDetail(
      supabase,
      id,
      user.id
    );

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load conversation";
    console.error("[conversations/[id] GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface PatchBody {
  title?: string;
  starred?: boolean;
  projectId?: string | null;
  messages?: ChatMessage[];
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

    const body = (await request.json()) as PatchBody;

    const metaPatch: {
      title?: string;
      starred?: boolean;
      projectId?: string | null;
    } = {};

    if (body.title !== undefined && body.title.trim()) {
      metaPatch.title = body.title.trim();
    }
    if (body.starred !== undefined) metaPatch.starred = body.starred;
    if (body.projectId !== undefined) {
      if (body.projectId) {
        await assertProjectOwned(supabase, user.id, body.projectId);
      }
      metaPatch.projectId = body.projectId;
    }

    let metaUpdated: Awaited<ReturnType<typeof updateConversationMeta>> = null;

    if (Object.keys(metaPatch).length > 0) {
      metaUpdated = await updateConversationMeta(
        supabase,
        user.id,
        id,
        metaPatch
      );
      if (!metaUpdated && !body.messages?.length) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (!body.messages?.length) {
      if (metaUpdated) {
        return NextResponse.json({ conversation: metaUpdated });
      }
      const conversation = await fetchConversationDetail(
        supabase,
        id,
        user.id
      );
      if (!conversation) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ conversation });
    }

    if (body.messages?.length) {
      await supabase.from("chat_messages").delete().eq("conversation_id", id);

      const rows = body.messages.map((m, i) => ({
        id: m.id,
        conversation_id: id,
        user_id: user.id,
        role: m.role,
        content: m.content,
        reference_ids: m.referenceIds ?? null,
        position: i,
        created_at: new Date(m.timestamp).toISOString(),
      }));

      const { error } = await supabase.from("chat_messages").insert(rows);
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    const conversation = await fetchConversationDetail(supabase, id, user.id);
    return NextResponse.json({ conversation });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update conversation";
    console.error("[conversations/[id] PATCH]", message);
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

    try {
      await deleteConversationStorage(user.id, id);
    } catch (storageErr) {
      console.warn(
        "[conversations/[id] DELETE] storage cleanup:",
        storageErr instanceof Error ? storageErr.message : storageErr
      );
    }

    await deleteConversation(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete conversation";
    console.error("[conversations/[id] DELETE]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
