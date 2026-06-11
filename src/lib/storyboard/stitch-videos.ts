import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { runWithConcurrency } from "@/lib/reference-utils";

const execFileAsync = promisify(execFile);

/** User-facing stitch errors — never mention OpenRouter or other providers. */
export function formatStitchVideoErrorForUser(raw: string): string {
  const message = raw.trim();
  const lower = message.toLowerCase();

  if (lower.includes("ffmpeg missing")) {
    return "Video stitching is not available on this server. Please try again later.";
  }
  if (lower.includes("no video clips")) {
    return "No scene clips to stitch. Animate all scenes first.";
  }
  if (
    lower.includes("failed to fetch video") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up")
  ) {
    return (
      "Could not download one or more scene clips. Refresh the page and try again."
    );
  }
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("service unavailable") ||
    lower.includes("function_invocation")
  ) {
    return (
      "Stitching took too long. Try again, or stitch fewer scenes at a time."
    );
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("high load") ||
    lower.includes("temporarily unavailable")
  ) {
    return "The server is busy. Wait a minute and try stitching again.";
  }
  if (
    lower.includes("xfade") &&
    (lower.includes("do not match") || lower.includes("failed to configure"))
  ) {
    return (
      "Scene clips have different sizes and could not be joined. " +
      "Try stitching again — we now normalize clip sizes automatically."
    );
  }
  if (lower.includes("command failed") && lower.includes("ffmpeg")) {
    return "Could not join scene clips. Try again, or re-animate scenes with the same video aspect ratio.";
  }
  if (
    lower.includes("an error occurred") ||
    lower.includes("gateway timeout") ||
    lower.includes("function_invocation") ||
    lower.includes("__next_error__") ||
    lower.includes("<!doctype html")
  ) {
    return (
      "Stitching took too long on the server (timeout). " +
      "Try again, or stitch fewer scenes at a time."
    );
  }

  return message || "Could not stitch clips. Please try again.";
}

/** Crossfade between stitched segments so cuts feel like one continuous edit. */
export const STORYBOARD_STITCH_CROSSFADE_SEC = 0.35;
/** Cap scene-stitch resolution so serverless FFmpeg finishes within platform limits. */
export const SCENE_STITCH_MAX_WIDTH = 1280;
/** Fade out picture + sound at the end so the video does not stop on a hard cut. */
export const STORYBOARD_END_FADE_SEC = 0.9;

function ffmpegPath(): string {
  const bin = ffmpegStatic;
  if (!bin) {
    throw new Error(
      "Video stitching is not available on this server (ffmpeg missing)."
    );
  }
  return bin;
}

async function runConcat(listFile: string, outFile: string, reencode: boolean) {
  const ffmpeg = ffmpegPath();
  const args = reencode
    ? [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        outFile,
      ]
    : ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outFile];

  await execFileAsync(ffmpeg, args);
}

function parseDurationFromFfmpegStderr(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  const seconds = Number.parseFloat(match[3]!);
  return hours * 3600 + minutes * 60 + seconds;
}

async function probeMp4FileDurationFloat(filePath: string): Promise<number | null> {
  try {
    const { stderr } = await execFileAsync(ffmpegPath(), [
      "-i",
      filePath,
      "-f",
      "null",
      "-",
    ]);
    return parseDurationFromFfmpegStderr(String(stderr));
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr?: string }).stderr ?? "")
        : "";
    return parseDurationFromFfmpegStderr(stderr);
  }
}

/** Read container duration from an MP4 buffer (seconds, fractional). */
export async function probeMp4DurationFloat(buffer: Buffer): Promise<number | null> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-probe-"));
  const file = path.join(dir, "probe.mp4");
  try {
    await writeFile(file, buffer);
    return await probeMp4FileDurationFloat(file);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Read container duration from an MP4 buffer (seconds, rounded). */
export async function probeMp4DurationSec(buffer: Buffer): Promise<number | null> {
  const duration = await probeMp4DurationFloat(buffer);
  return duration == null ? null : Math.round(duration);
}

/** Last frame of a clip — used as a bridge reference for the next segment. */
export async function extractLastFrameFromMp4(buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-frame-"));
  const videoFile = path.join(dir, "clip.mp4");
  const frameFile = path.join(dir, "last.jpg");
  try {
    await writeFile(videoFile, buffer);
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-sseof",
      "-0.08",
      "-i",
      videoFile,
      "-vframes",
      "1",
      "-q:v",
      "2",
      frameFile,
    ]);
    return await readFile(frameFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function ffmpegProbeStderr(filePath: string): Promise<string> {
  return execFileAsync(ffmpegPath(), ["-i", filePath, "-f", "null", "-"]).then(
    () => "",
    (err: { stderr?: string }) => String(err.stderr ?? "")
  );
}

async function probeMp4VideoDimensions(
  filePath: string
): Promise<{ width: number; height: number } | null> {
  const stderr = await ffmpegProbeStderr(filePath);
  const match = stderr.match(/Video:[^\n]*?,\s*(\d{2,5})x(\d{2,5})/);
  if (!match) return null;
  const width = Number.parseInt(match[1]!, 10);
  const height = Number.parseInt(match[2]!, 10);
  if (!width || !height) return null;
  return { width, height };
}

function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function pickCrossfadeTargetSize(
  sizes: Array<{ width: number; height: number }>
): { width: number; height: number } {
  if (!sizes.length) {
    return { width: 1920, height: 1080 };
  }
  let width = sizes[0]!.width;
  let height = sizes[0]!.height;
  for (const size of sizes) {
    width = Math.max(width, size.width);
    height = Math.max(height, size.height);
  }
  return { width: evenDimension(width), height: evenDimension(height) };
}

function capStitchTargetSize(
  size: { width: number; height: number },
  maxWidth: number
): { width: number; height: number } {
  if (size.width <= maxWidth) return size;
  const scale = maxWidth / size.width;
  return {
    width: evenDimension(maxWidth),
    height: evenDimension(size.height * scale),
  };
}

async function clipHasAudioStream(filePath: string): Promise<boolean> {
  try {
    await execFileAsync(ffmpegPath(), [
      "-hide_banner",
      "-i",
      filePath,
      "-map",
      "0:a:0",
      "-f",
      "null",
      "-",
    ]);
    return true;
  } catch {
    const stderr = await ffmpegProbeStderr(filePath);
    return (
      /\bAudio:/i.test(stderr) ||
      /Stream #\d+:\d+.*\baudio\b/i.test(stderr)
    );
  }
}

/**
 * Scale every clip to the same frame size and re-encode to h264 (+ stereo AAC when needed)
 * so xfade / acrossfade filters receive matching streams.
 */
async function normalizeClipForCrossfade(
  inputPath: string,
  outputPath: string,
  durationSec: number,
  targetWidth: number,
  targetHeight: number,
  options: { ensureAudio?: boolean; preset?: "ultrafast" | "fast" } = {}
): Promise<void> {
  const preset = options.preset ?? "fast";
  const vf = `scale=${targetWidth}:${targetHeight}:flags=lanczos,setsar=1`;
  const hasAudio = await clipHasAudioStream(inputPath);

  if (hasAudio) {
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      inputPath,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    return;
  }

  if (options.ensureAudio) {
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      inputPath,
      "-f",
      "lavfi",
      "-t",
      durationSec.toFixed(3),
      "-i",
      "anullsrc=r=48000:cl=stereo",
      "-vf",
      vf,
      "-map",
      "0:v",
      "-map",
      "1:a",
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    return;
  }

  await execFileAsync(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    preset,
    "-crf",
    "23",
    "-an",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

/** Trim a clip to an exact duration (no fade) — removes trailing black or overrun. */
export async function trimMp4ToDuration(
  videoBuffer: Buffer,
  durationSec: number
): Promise<Buffer> {
  if (durationSec <= 0) return videoBuffer;

  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-trim-"));
  const inFile = path.join(dir, "in.mp4");
  const outFile = path.join(dir, "out.mp4");
  try {
    await writeFile(inFile, videoBuffer);
    const probed = await probeMp4FileDurationFloat(inFile);
    if (!probed || probed <= durationSec + 0.2) {
      return videoBuffer;
    }

    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      inFile,
      "-t",
      String(durationSec),
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outFile,
    ]);
    return await readFile(outFile);
  } catch (trimErr) {
    console.warn(
      "[stitch-videos] Trim to duration failed — keeping original",
      trimErr instanceof Error ? trimErr.message : trimErr
    );
    return videoBuffer;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Gentle fade-to-black + audio fade on the last ~1s (storyboard full videos). */
export async function applySmoothEndingToMp4(
  videoBuffer: Buffer
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-endfade-"));
  const inFile = path.join(dir, "in.mp4");
  const outFile = path.join(dir, "out.mp4");
  try {
    await writeFile(inFile, videoBuffer);
    const duration = await probeMp4FileDurationFloat(inFile);
    if (!duration || duration < STORYBOARD_END_FADE_SEC + 0.4) {
      return videoBuffer;
    }

    const fadeStart = Math.max(0, duration - STORYBOARD_END_FADE_SEC);
    const fade = STORYBOARD_END_FADE_SEC.toFixed(3);
    const start = fadeStart.toFixed(3);
    const hasAudio = await clipHasAudioStream(inFile);

    if (hasAudio) {
      try {
        await execFileAsync(ffmpegPath(), [
          "-y",
          "-i",
          inFile,
          "-filter_complex",
          `[0:v]fade=t=out:st=${start}:d=${fade}[v];[0:a]afade=t=out:st=${start}:d=${fade}[a]`,
          "-map",
          "[v]",
          "-map",
          "[a]",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart",
          outFile,
        ]);
        return await readFile(outFile);
      } catch (fadeErr) {
        console.warn(
          "[stitch-videos] End fade with audio failed — keeping original",
          fadeErr instanceof Error ? fadeErr.message : fadeErr
        );
        return videoBuffer;
      }
    }

    // Never re-encode with -an: a false "no audio" probe would strip narration we just mixed in.
    try {
      await execFileAsync(ffmpegPath(), [
        "-y",
        "-i",
        inFile,
        "-vf",
        `fade=t=out:st=${start}:d=${fade}`,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        outFile,
      ]);
      return await readFile(outFile);
    } catch {
      return videoBuffer;
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface StoryboardAudioMixOptions {
  narrationBuffer?: Buffer;
  ambientBedBuffer?: Buffer;
}

/**
 * Final storyboard audio: model ambient (if any) + music bed + TTS narration.
 * Guarantees a music layer even when video segments ship without audio.
 */
export async function mixStoryboardFinalAudio(
  videoBuffer: Buffer,
  options: StoryboardAudioMixOptions
): Promise<Buffer> {
  const { narrationBuffer, ambientBedBuffer } = options;
  if (!narrationBuffer && !ambientBedBuffer) return videoBuffer;

  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-mix-"));
  const videoFile = path.join(dir, "video.mp4");
  const outFile = path.join(dir, "mixed.mp4");
  try {
    await writeFile(videoFile, videoBuffer);
    const hasModelAudio = await clipHasAudioStream(videoFile);

    const inputArgs = ["-i", videoFile];
    const filterParts: string[] = [];
    const mixLabels: string[] = [];
    let nextInput = 1;

    if (ambientBedBuffer?.length) {
      const bedFile = path.join(dir, "bed.mp3");
      await writeFile(bedFile, ambientBedBuffer);
      inputArgs.push("-i", bedFile);
      filterParts.push(`[${nextInput}:a]apad,volume=0.72[bed]`);
      mixLabels.push("[bed]");
      nextInput++;
    }

    if (hasModelAudio) {
      filterParts.push("[0:a]volume=0.28[mdl]");
      mixLabels.push("[mdl]");
    }

    if (narrationBuffer?.length) {
      const narFile = path.join(dir, "nar.mp3");
      await writeFile(narFile, narrationBuffer);
      inputArgs.push("-i", narFile);
      filterParts.push(`[${nextInput}:a]volume=1[nar]`);
      mixLabels.push("[nar]");
      nextInput++;
    }

    if (!mixLabels.length) return videoBuffer;

    const filterComplex = `${filterParts.join(";")};${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0:normalize=0[aout]`;

    await execFileAsync(ffmpegPath(), [
      "-y",
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "0:v:0",
      "-map",
      "[aout]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      outFile,
    ]);
    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** @deprecated Use mixStoryboardFinalAudio with ambientBedBuffer */
export async function mixNarrationOntoVideo(
  videoBuffer: Buffer,
  narrationBuffer: Buffer
): Promise<Buffer> {
  return mixStoryboardFinalAudio(videoBuffer, { narrationBuffer });
}

export interface ConcatMp4CrossfadeOptions {
  /** Normalize clip audio (stereo AAC) and always crossfade sound — for scene animation stitches. */
  preserveClipAudio?: boolean;
}

export interface ConcatMp4FastOptions {
  maxWidth?: number;
  /** Scene animations keep native audio; full storyboard stitch replaces audio with TTS. */
  ensureAudio?: boolean;
}

/**
 * Fast stitch: normalize clips (capped resolution) then hard-cut concat.
 * Much faster than crossfade on serverless — avoids platform timeouts on live.
 */
export async function concatMp4BuffersFast(
  clips: Buffer[],
  options: ConcatMp4FastOptions = {}
): Promise<Buffer> {
  const ensureAudio = options.ensureAudio ?? false;
  if (!clips.length) {
    throw new Error("No video clips to stitch.");
  }
  if (clips.length === 1) {
    return clips[0]!;
  }

  const maxWidth = options.maxWidth ?? SCENE_STITCH_MAX_WIDTH;
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-fast-stitch-"));
  try {
    const rawPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clipPath = path.join(dir, `clip-raw-${i}.mp4`);
      await writeFile(clipPath, clips[i]);
      rawPaths.push(clipPath);
    }

    const durations: number[] = [];
    const dimensions: Array<{ width: number; height: number }> = [];
    for (const clipPath of rawPaths) {
      durations.push((await probeMp4FileDurationFloat(clipPath)) ?? 8);
      const size = await probeMp4VideoDimensions(clipPath);
      if (size) dimensions.push(size);
    }

    const targetSize = capStitchTargetSize(
      pickCrossfadeTargetSize(dimensions),
      maxWidth
    );

    const preparedPaths = await runWithConcurrency(
      rawPaths.map((rawPath, index) => ({ rawPath, index })),
      2,
      async ({ rawPath, index }) => {
        const preparedPath = path.join(dir, `clip-${index}.mp4`);
        await normalizeClipForCrossfade(
          rawPath,
          preparedPath,
          durations[index]!,
          targetSize.width,
          targetSize.height,
          { ensureAudio, preset: "ultrafast" }
        );
        return preparedPath;
      }
    );

    const listFile = path.join(dir, "concat.txt");
    const listContent = preparedPaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listFile, listContent);

    const outFile = path.join(dir, "stitched.mp4");
    try {
      await runConcat(listFile, outFile, false);
    } catch {
      await runConcat(listFile, outFile, true);
    }

    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function concatMp4BuffersFastWithAudio(
  clips: Buffer[],
  options: Omit<ConcatMp4FastOptions, "ensureAudio"> = {}
): Promise<Buffer> {
  return concatMp4BuffersFast(clips, { ...options, ensureAudio: true });
}

/** Concatenate MP4 buffers with short crossfades between segments. */
export async function concatMp4BuffersWithCrossfade(
  clips: Buffer[],
  crossfadeSec = STORYBOARD_STITCH_CROSSFADE_SEC,
  options: ConcatMp4CrossfadeOptions = {}
): Promise<Buffer> {
  if (!clips.length) {
    throw new Error("No video clips to stitch.");
  }
  if (clips.length === 1) {
    return clips[0]!;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-xfade-"));
  try {
    const rawPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clipPath = path.join(dir, `clip-raw-${i}.mp4`);
      await writeFile(clipPath, clips[i]);
      rawPaths.push(clipPath);
    }

    const durations: number[] = [];
    const dimensions: Array<{ width: number; height: number }> = [];
    for (const clipPath of rawPaths) {
      durations.push((await probeMp4FileDurationFloat(clipPath)) ?? 8);
      const size = await probeMp4VideoDimensions(clipPath);
      if (size) dimensions.push(size);
    }

    const targetSize = pickCrossfadeTargetSize(dimensions);
    const inputPaths: string[] = [];
    for (let i = 0; i < rawPaths.length; i++) {
      const preparedPath = path.join(dir, `clip-${i}.mp4`);
      await normalizeClipForCrossfade(
        rawPaths[i]!,
        preparedPath,
        durations[i]!,
        targetSize.width,
        targetSize.height,
        { ensureAudio: options.preserveClipAudio }
      );
      inputPaths.push(preparedPath);
      durations[i] =
        (await probeMp4FileDurationFloat(preparedPath)) ?? durations[i]!;
    }

    const fade = Math.min(
      crossfadeSec,
      Math.max(0.15, Math.min(...durations) * 0.12)
    );

    const inputArgs = inputPaths.flatMap((clipPath) => ["-i", clipPath]);
    const clipHasAudio = await Promise.all(
      inputPaths.map((clipPath) => clipHasAudioStream(clipPath))
    );
    const stitchAudio =
      options.preserveClipAudio || clipHasAudio.every(Boolean);

    let videoFilter = "";
    let prevVideo = "0:v";
    let accumulated = durations[0]!;

    for (let i = 1; i < inputPaths.length; i++) {
      const offset = Math.max(0, accumulated - fade);
      const outLabel = i === inputPaths.length - 1 ? "vout" : `v${i}`;
      videoFilter += `[${prevVideo}][${i}:v]xfade=transition=fade:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}]`;
      if (i < inputPaths.length - 1) videoFilter += ";";
      prevVideo = outLabel;
      accumulated += durations[i]! - fade;
    }

    let filterComplex = videoFilter;
    if (stitchAudio) {
      let audioFilter = "";
      let prevAudio = "0:a";
      for (let i = 1; i < inputPaths.length; i++) {
        const outLabel = i === inputPaths.length - 1 ? "aout" : `a${i}`;
        audioFilter += `[${prevAudio}][${i}:a]acrossfade=d=${fade.toFixed(3)}:c1=tri:c2=tri[${outLabel}]`;
        if (i < inputPaths.length - 1) audioFilter += ";";
        prevAudio = outLabel;
      }
      filterComplex = `${videoFilter};${audioFilter}`;
    }

    const outFile = path.join(dir, "stitched.mp4");
    const outputArgs = stitchAudio
      ? ["-map", "[vout]", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]
      : ["-map", "[vout]", "-an"];

    await execFileAsync(ffmpegPath(), [
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      ...outputArgs,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      "-y",
      outFile,
    ]);

    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Concatenate MP4 buffers in order into one file (hard cuts). */
export async function concatMp4Buffers(clips: Buffer[]): Promise<Buffer> {
  if (!clips.length) {
    throw new Error("No video clips to stitch.");
  }
  if (clips.length === 1) {
    return clips[0]!;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-stitch-"));
  try {
    const inputPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clipPath = path.join(dir, `clip-${i}.mp4`);
      await writeFile(clipPath, clips[i]);
      inputPaths.push(clipPath);
    }

    const listFile = path.join(dir, "concat.txt");
    const listContent = inputPaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listFile, listContent);

    const outFile = path.join(dir, "stitched.mp4");

    try {
      await runConcat(listFile, outFile, false);
    } catch {
      await runConcat(listFile, outFile, true);
    }

    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
