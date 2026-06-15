import { NextRequest, NextResponse } from "next/server";
import { getSignedMediaUrl } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/server";

interface SignClipBody {
  storagePath?: string;
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

    const body = (await request.json()) as SignClipBody;
    const storagePath = body.storagePath?.trim();
    if (!storagePath) {
      return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
    }

    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid storage path." }, { status: 403 });
    }

    const signedUrl = await getSignedMediaUrl(storagePath);
    if (!signedUrl) {
      return NextResponse.json({ error: "Could not sign clip URL." }, { status: 404 });
    }

    return NextResponse.json({ signedUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not sign clip URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
