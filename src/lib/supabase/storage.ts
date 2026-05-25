import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "generations";
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

/** Avoid Node stack overflow on very large base64 strings */
function decodeBase64ToBuffer(base64: string): Buffer {
  const chunkSize = 256 * 1024;
  const chunks: Buffer[] = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(Buffer.from(base64.slice(i, i + chunkSize), "base64"));
  }
  return Buffer.concat(chunks);
}

export function generationStoragePath(
  userId: string,
  conversationId: string,
  variantId: string,
  ext: "png" | "jpg" | "webp" | "mp4" | "webm" = "png"
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

export function isPersistableVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith("data:video") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  );
}

export async function videoSourceToBuffer(
  source: string
): Promise<{ buffer: Buffer; mime: string; ext: "mp4" | "webm" }> {
  if (source.startsWith("data:")) {
    const match = source.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid video data URL.");
    const mime = match[1];
    const buffer = decodeBase64ToBuffer(match[2]);
    const ext = mime.includes("webm") ? "webm" : "mp4";
    return { buffer, mime, ext };
  }

  const res = await fetch(source, { headers: { Accept: "video/*" } });
  if (!res.ok) throw new Error("Failed to fetch video for storage.");
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "video/mp4";
  const arrayBuffer = await res.arrayBuffer();
  const ext = mime.includes("webm") ? "webm" : "mp4";
  return { buffer: Buffer.from(arrayBuffer), mime, ext };
}

export async function uploadGenerationVideoBuffer(options: {
  userId: string;
  conversationId: string;
  variantId: string;
  buffer: Buffer;
  mime?: string;
}): Promise<{ storagePath: string; signedUrl: string }> {
  const mime = options.mime ?? "video/mp4";
  const ext = mime.includes("webm") ? "webm" : "mp4";
  const storagePath = generationStoragePath(
    options.userId,
    options.conversationId,
    options.variantId,
    ext
  );

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, options.buffer, {
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
    throw new Error(signError?.message ?? "Failed to create video URL.");
  }

  return { storagePath, signedUrl: signed.signedUrl };
}

export async function uploadGenerationVideo(options: {
  userId: string;
  conversationId: string;
  variantId: string;
  videoSource: string;
}): Promise<{ storagePath: string; signedUrl: string }> {
  const { buffer, mime, ext } = await videoSourceToBuffer(options.videoSource);
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
    throw new Error(signError?.message ?? "Failed to create video URL.");
  }

  return { storagePath, signedUrl: signed.signedUrl };
}

export async function getSignedMediaUrl(
  storagePath: string
): Promise<string | null> {
  return getSignedImageUrl(storagePath);
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

/** Remove all generation images for a conversation folder. */
export async function deleteConversationStorage(
  userId: string,
  conversationId: string
): Promise<void> {
  const admin = createAdminClient();
  const prefix = `${userId}/${conversationId}`;
  const { data: files, error: listError } = await admin.storage
    .from(BUCKET)
    .list(prefix);

  if (listError) throw new Error(listError.message);
  if (!files?.length) return;

  const paths = files.map((f) => `${prefix}/${f.name}`);
  const { error: removeError } = await admin.storage
    .from(BUCKET)
    .remove(paths);

  if (removeError) throw new Error(removeError.message);
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
