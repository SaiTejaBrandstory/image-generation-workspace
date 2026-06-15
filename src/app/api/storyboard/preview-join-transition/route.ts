import { NextRequest, NextResponse } from "next/server";
import {
  formatStitchVideoErrorForUser,
  renderJoinTransitionPreview,
} from "@/lib/storyboard/stitch-videos";
import { isSceneTransition } from "@/lib/storyboard/xfade-transitions";
import { createClient } from "@/lib/supabase/server";
import {
  getSignedMediaUrl,
  videoSourceToBuffer,
} from "@/lib/supabase/storage";

export const maxDuration = 60;
export const runtime = "nodejs";

interface PreviewJoinTransitionBody {
  fromStoragePath?: string;
  toStoragePath?: string;
  transition?: string;
}

function assertUserStoragePath(storagePath: string, userId: string): boolean {
  return storagePath.startsWith(`${userId}/`);
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

    const body = (await request.json()) as PreviewJoinTransitionBody;
    const fromStoragePath = body.fromStoragePath?.trim();
    const toStoragePath = body.toStoragePath?.trim();
    const transition = body.transition?.trim().toLowerCase() || "fade";

    if (!fromStoragePath || !toStoragePath) {
      return NextResponse.json(
        { error: "fromStoragePath and toStoragePath are required." },
        { status: 400 }
      );
    }

    if (
      !assertUserStoragePath(fromStoragePath, user.id) ||
      !assertUserStoragePath(toStoragePath, user.id)
    ) {
      return NextResponse.json({ error: "Invalid storage path." }, { status: 403 });
    }

    if (!isSceneTransition(transition)) {
      return NextResponse.json({ error: "Invalid transition." }, { status: 400 });
    }

    const [fromSigned, toSigned] = await Promise.all([
      getSignedMediaUrl(fromStoragePath),
      getSignedMediaUrl(toStoragePath),
    ]);

    if (!fromSigned || !toSigned) {
      return NextResponse.json(
        { error: "Could not load one or both scene clips." },
        { status: 404 }
      );
    }

    const [{ buffer: outgoing }, { buffer: incoming }] = await Promise.all([
      videoSourceToBuffer(fromSigned),
      videoSourceToBuffer(toSigned),
    ]);

    const preview = await renderJoinTransitionPreview(
      outgoing,
      incoming,
      transition
    );

    return new NextResponse(new Uint8Array(preview), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const message = formatStitchVideoErrorForUser(
      err instanceof Error ? err.message : "Could not render transition preview."
    );
    console.error("[storyboard/preview-join-transition]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
