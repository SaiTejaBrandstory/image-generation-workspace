import JSZip from "jszip";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch image");
  return res.blob();
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}

export async function downloadImage(
  imageUrl: string,
  filename: string
): Promise<void> {
  const blob = await urlToBlob(imageUrl);
  const ext = blob.type.includes("png")
    ? "png"
    : blob.type.includes("jpeg") || blob.type.includes("jpg")
      ? "jpg"
      : "png";
  const name = filename.endsWith(`.${ext}`)
    ? filename
    : `${filename}.${ext}`;
  triggerBlobDownload(blob, name);
}

/** Fetch cross-origin video (e.g. Supabase signed URL) and save as file. */
export async function downloadVideo(
  videoUrl: string,
  filename: string
): Promise<void> {
  const blob = await urlToBlob(videoUrl);
  const ext = blob.type.includes("webm") ? "webm" : "mp4";
  const name = filename.match(/\.(mp4|webm)$/i) ? filename : `${filename}.${ext}`;
  triggerBlobDownload(blob, name);
}

export interface DownloadableImage {
  url: string;
  layoutName: string;
  layoutId: string;
}

export async function downloadAllImages(
  images: DownloadableImage[]
): Promise<void> {
  if (images.length === 0) return;

  if (images.length === 1) {
    const img = images[0];
    await downloadImage(img.url, slugify(img.layoutName));
    return;
  }

  const zip = new JSZip();

  await Promise.all(
    images.map(async (img, index) => {
      const blob = await urlToBlob(img.url);
      const ext = blob.type.includes("jpeg") ? "jpg" : "png";
      const base = slugify(img.layoutName) || img.layoutId;
      zip.file(`${String(index + 1).padStart(2, "0")}-${base}.${ext}`, blob);
    })
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(zipBlob, `brandwise-layouts-${stamp}.zip`);
}

export function buildImageFilename(
  layoutName: string,
  layoutId: string,
  index?: number
): string {
  const base = slugify(layoutName) || layoutId;
  return index !== undefined ? `${base}-${index + 1}` : base;
}
