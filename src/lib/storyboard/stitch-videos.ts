import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Crossfade between stitched segments so cuts feel like one continuous edit. */
export const STORYBOARD_STITCH_CROSSFADE_SEC = 0.35;
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

/** Re-encode clip to h264 + stereo AAC so crossfade audio filters work reliably. */
async function prepareClipForAudioCrossfade(
  inputPath: string,
  outputPath: string,
  durationSec: number
): Promise<void> {
  const hasAudio = await clipHasAudioStream(inputPath);
  if (hasAudio) {
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      inputPath,
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
    "-map",
    "0:v",
    "-map",
    "1:a",
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
    "-shortest",
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
    for (const clipPath of rawPaths) {
      durations.push((await probeMp4FileDurationFloat(clipPath)) ?? 8);
    }

    const inputPaths: string[] = [];
    if (options.preserveClipAudio) {
      for (let i = 0; i < rawPaths.length; i++) {
        const preparedPath = path.join(dir, `clip-${i}.mp4`);
        await prepareClipForAudioCrossfade(
          rawPaths[i]!,
          preparedPath,
          durations[i]!
        );
        inputPaths.push(preparedPath);
        durations[i] =
          (await probeMp4FileDurationFloat(preparedPath)) ?? durations[i]!;
      }
    } else {
      inputPaths.push(...rawPaths);
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
