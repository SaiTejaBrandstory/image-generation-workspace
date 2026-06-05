import type { ReferenceImagePayload } from "@/types";

/** Extract the opening frame from a video URL for use as a preserve reference. */
export async function videoUrlToPreserveReference(
  videoUrl: string
): Promise<ReferenceImagePayload | null> {
  if (typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const fail = () => {
      cleanup();
      resolve(null);
    };

    video.addEventListener("error", fail, { once: true });

    video.addEventListener(
      "loadeddata",
      () => {
        video.currentTime = 0;
      },
      { once: true }
    );

    video.addEventListener(
      "seeked",
      () => {
        try {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (!width || !height) {
            fail();
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            fail();
            return;
          }

          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          cleanup();
          resolve({
            role: "product",
            influence: 100,
            dataUrl,
            usageMode: "preserve",
          });
        } catch {
          fail();
        }
      },
      { once: true }
    );

    video.src = videoUrl;
  });
}
