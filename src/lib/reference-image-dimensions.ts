/** Wan / OpenRouter video reference minimum (both width and height) */
export const MIN_VIDEO_REFERENCE_DIMENSION = 240;

export function parseDataUrlMime(dataUrl: string): string {
  return dataUrl.match(/^data:([^;]+);/i)?.[1]?.toLowerCase() ?? "image/jpeg";
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read reference image."));
    img.src = src;
  });
}

export async function getDataUrlDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }
  const img = await loadHtmlImage(dataUrl);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export function dimensionsMeetMinimum(
  width: number,
  height: number,
  minSize = MIN_VIDEO_REFERENCE_DIMENSION
): boolean {
  return width >= minSize && height >= minSize;
}

/**
 * Upscale reference images that are below provider minimums (keeps aspect ratio).
 * Browser-only; no-op on server if dimensions unknown.
 */
export async function ensureReferenceMinDimensions(
  dataUrl: string,
  minSize = MIN_VIDEO_REFERENCE_DIMENSION
): Promise<{
  dataUrl: string;
  resized: boolean;
  width: number;
  height: number;
}> {
  if (typeof window === "undefined") {
    return { dataUrl, resized: false, width: 0, height: 0 };
  }

  const img = await loadHtmlImage(dataUrl);
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  if (dimensionsMeetMinimum(width, height, minSize)) {
    return { dataUrl, resized: false, width, height };
  }

  const scale = Math.max(minSize / width, minSize / height);
  const targetW = Math.ceil(width * scale);
  const targetH = Math.ceil(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare reference image for upload.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const mime = parseDataUrlMime(dataUrl);
  const outputMime =
    mime === "image/png" ? "image/png" : "image/jpeg";
  const quality = outputMime === "image/jpeg" ? 0.92 : undefined;
  const out = canvas.toDataURL(outputMime, quality);

  return {
    dataUrl: out,
    resized: true,
    width: targetW,
    height: targetH,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:([^;]+)/i)?.[1]?.toLowerCase() ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const ext =
    mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
  const baseName = filename.replace(/\.[^.]+$/i, "") || "reference";
  return new File([bytes], `${baseName}${ext}`, { type: mime });
}

/**
 * Upscale a File below provider minimums (browser-only). Returns the original
 * file when dimensions already meet the minimum.
 */
export async function ensureFileMinDimensions(
  file: File,
  minSize = MIN_VIDEO_REFERENCE_DIMENSION
): Promise<{
  file: File;
  resized: boolean;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}> {
  const { width, height } = await getFileImageDimensions(file);
  if (dimensionsMeetMinimum(width, height, minSize)) {
    return {
      file,
      resized: false,
      width,
      height,
      originalWidth: width,
      originalHeight: height,
    };
  }

  const dataUrl = await fileToDataUrl(file);
  const normalized = await ensureReferenceMinDimensions(dataUrl, minSize);
  const outFile = dataUrlToFile(normalized.dataUrl, file.name);

  return {
    file: outFile,
    resized: true,
    width: normalized.width,
    height: normalized.height,
    originalWidth: width,
    originalHeight: height,
  };
}

export async function getFileImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  }
  const url = URL.createObjectURL(file);
  try {
    return await getDataUrlDimensions(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatReferenceResolutionError(
  width: number,
  height: number,
  minSize = MIN_VIDEO_REFERENCE_DIMENSION
): string {
  return (
    `Reference image is too small (${width}×${height}). ` +
    `Each side must be at least ${minSize}px for video models. ` +
    `Use a larger image or we will upscale automatically on retry.`
  );
}

export function isReferenceResolutionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("resolution must be at least") ||
    m.includes("invalidparameter") && m.includes("resolution")
  );
}
