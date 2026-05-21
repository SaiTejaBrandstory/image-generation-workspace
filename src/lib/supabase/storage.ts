import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "generations";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export function generationStoragePath(
  userId: string,
  conversationId: string,
  variantId: string,
  ext: "png" | "jpg" | "webp" = "png"
): string {
  return `${userId}/${conversationId}/${variantId}.${ext}`;
}

function extFromMime(mime: string): "png" | "jpg" | "webp" {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

/** Parse data URL or remote URL into bytes for upload. */
export async function imageSourceToBuffer(
  source: string
): Promise<{ buffer: Buffer; mime: string; ext: "png" | "jpg" | "webp" }> {
  if (source.startsWith("data:")) {
    const match = source.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URL.");
    const mime = match[1];
    const buffer = Buffer.from(match[2], "base64");
    return { buffer, mime, ext: extFromMime(mime) };
  }

  const res = await fetch(source);
  if (!res.ok) throw new Error("Failed to fetch image for storage.");
  const mime = res.headers.get("content-type") ?? "image/png";
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mime,
    ext: extFromMime(mime),
  };
}

export function isPersistableImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("gradient:")) return false;
  return (
    url.startsWith("data:image") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  );
}

export async function uploadGenerationImage(options: {
  userId: string;
  conversationId: string;
  variantId: string;
  imageSource: string;
}): Promise<{ storagePath: string; signedUrl: string }> {
  const { buffer, mime, ext } = await imageSourceToBuffer(options.imageSource);
  const storagePath = generationStoragePath(
    options.userId,
    options.conversationId,
    options.variantId,
    ext
  );

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    throw new Error(signError?.message ?? "Failed to create image URL.");
  }

  return { storagePath, signedUrl: signed.signedUrl };
}

export async function getSignedImageUrl(
  storagePath: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
