"use client";

import { cn } from "@/lib/utils";

interface GeneratedImageProps {
  src: string;
  alt: string;
  /** grid card vs fullscreen expanded */
  variant?: "card" | "expanded";
  className?: string;
}

/** Shows the full image without cropping (letterboxed if needed). */
export function GeneratedImage({
  src,
  alt,
  variant = "card",
  className,
}: GeneratedImageProps) {
  if (variant === "expanded") {
    return (
      <div
        className={cn(
          "flex max-h-[calc(100vh-6rem)] max-w-full items-center justify-center",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[calc(100dvh-8rem)] max-w-[min(100%,calc(100vw-2rem))] w-auto h-auto object-contain rounded-[24px] shadow-cinematic lg:max-h-[calc(100vh-6rem)] lg:max-w-[min(100%,calc(100vw-28rem))]"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full min-h-0 items-center justify-center bg-black/30",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
