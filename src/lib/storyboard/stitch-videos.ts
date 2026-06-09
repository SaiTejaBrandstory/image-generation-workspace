import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Crossfade between stitched segments so cuts feel like one continuous edit. */
export const STORYBOARD_STITCH_CROSSFADE_SEC = 0.35;

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
  const stderr = await ffmpegProbeStderr(filePath);
  return /\bAudio:/i.test(stderr);
}

/** Mux narration when the video has no ambient audio track. */
export async function muxMp4WithAudio(
  videoBuffer: Buffer,
  audioBuffer: Buffer
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-mux-"));
  const videoFile = path.join(dir, "video.mp4");
  const audioFile = path.join(dir, "audio.mp3");
  const outFile = path.join(dir, "muxed.mp4");
  try {
    await writeFile(videoFile, videoBuffer);
    await writeFile(audioFile, audioBuffer);
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      videoFile,
      "-i",
      audioFile,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
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

/** Layer unified narration over existing ambient / music from the video. */
export async function mixNarrationOntoVideo(
  videoBuffer: Buffer,
  narrationBuffer: Buffer
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-mix-"));
  const videoFile = path.join(dir, "video.mp4");
  const narrationFile = path.join(dir, "narration.mp3");
  const outFile = path.join(dir, "mixed.mp4");
  try {
    await writeFile(videoFile, videoBuffer);
    await writeFile(narrationFile, narrationBuffer);

    const hasAmbient = await clipHasAudioStream(videoFile);
    if (!hasAmbient) {
      return muxMp4WithAudio(videoBuffer, narrationBuffer);
    }

    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      videoFile,
      "-i",
      narrationFile,
      "-filter_complex",
      "[0:a]volume=0.5[amb];[1:a]volume=1[nar];[amb][nar]amix=inputs=2:duration=first:dropout_transition=2[aout]",
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

/** Concatenate MP4 buffers with short crossfades between segments. */
export async function concatMp4BuffersWithCrossfade(
  clips: Buffer[],
  crossfadeSec = STORYBOARD_STITCH_CROSSFADE_SEC
): Promise<Buffer> {
  if (!clips.length) {
    throw new Error("No video clips to stitch.");
  }
  if (clips.length === 1) {
    return clips[0]!;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-xfade-"));
  try {
    const inputPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clipPath = path.join(dir, `clip-${i}.mp4`);
      await writeFile(clipPath, clips[i]);
      inputPaths.push(clipPath);
    }

    const durations: number[] = [];
    for (const clipPath of inputPaths) {
      durations.push((await probeMp4FileDurationFloat(clipPath)) ?? 8);
    }

    const fade = Math.min(
      crossfadeSec,
      Math.max(0.15, Math.min(...durations) * 0.12)
    );

    const inputArgs = inputPaths.flatMap((clipPath) => ["-i", clipPath]);
    const clipHasAudio = await Promise.all(
      inputPaths.map((clipPath) => clipHasAudioStream(clipPath))
    );
    const stitchAudio = clipHasAudio.every(Boolean);

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
