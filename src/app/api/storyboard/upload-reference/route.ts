import { NextRequest, NextResponse } from "next/server";
import {
  isSupportedReferenceImageFile,
  referenceFormatHint,
} from "@/lib/reference-image-formats";
import {
  maxReferenceTotalBytesForMedia,
  STORYBOARD_MAX_INPUT_REFERENCES,
  validateStoryboardInputReferenceUpload,
} from "@/lib/storyboard/storyboard-input-references";
import { createClient } from "@/lib/supabase/server";
import { uploadGenerationImage } from "@/lib/supabase/storage";
import type { StoryboardInputReferenceKind } from "@/types/storyboard";

const KINDS = new Set<StoryboardInputReferenceKind>([
  "character",
  "product",
  "environment",
]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "").trim();
    const refId = String(form.get("refId") ?? "").trim();
    const kind = String(form.get("kind") ?? "").trim() as StoryboardInputReferenceKind;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }
    if (!refId) {
      return NextResponse.json({ error: "refId is required." }, { status: 400 });
    }
    if (!KINDS.has(kind)) {
      return NextResponse.json({ error: "Invalid reference kind." }, { status: 400 });
    }

    const uploadError = validateStoryboardInputReferenceUpload(file);
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 });
    }

    if (!isSupportedReferenceImageFile(file, "image")) {
      return NextResponse.json(
        { error: `Unsupported format. Use ${referenceFormatHint("image")}.` },
        { status: 400 }
      );
    }

    const currentCount = Number.parseInt(
      String(form.get("currentCount") ?? "0"),
      10
    );
    if (
      Number.isFinite(currentCount) &&
      currentCount >= STORYBOARD_MAX_INPUT_REFERENCES
    ) {
      return NextResponse.json(
        {
          error: `Maximum ${STORYBOARD_MAX_INPUT_REFERENCES} reference images across all categories.`,
        },
        { status: 400 }
      );
    }

    const currentTotalBytes = Number.parseInt(
      String(form.get("currentTotalBytes") ?? "0"),
      10
    );
    const maxTotalBytes = maxReferenceTotalBytesForMedia("image");
    if (
      Number.isFinite(currentTotalBytes) &&
      currentTotalBytes + file.size > maxTotalBytes
    ) {
      return NextResponse.json(
        { error: "Total reference upload size exceeded." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = (file.type || "image/jpeg").toLowerCase();
    const allowed = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (!allowed.has(mime)) {
      return NextResponse.json(
        { error: `Unsupported format. Use ${referenceFormatHint("image")}.` },
        { status: 400 }
      );
    }
    const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
    const dataUrl = `data:${normalizedMime};base64,${buffer.toString("base64")}`;

    const uploaded = await uploadGenerationImage({
      userId: user.id,
      conversationId: projectId,
      variantId: `input-ref-${kind}-${refId}`,
      imageSource: dataUrl,
    });

    return NextResponse.json({
      storagePath: uploaded.storagePath,
      signedUrl: uploaded.signedUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Reference upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
