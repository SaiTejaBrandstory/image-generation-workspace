import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

/** Read container duration from an MP4 buffer (seconds, rounded). */
export async function probeMp4DurationSec(buffer: Buffer): Promise<number | null> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-probe-"));
  const file = path.join(dir, "probe.mp4");
  try {
    await writeFile(file, buffer);
    const { stderr } = await execFileAsync(ffmpegPath(), [
      "-i",
      file,
      "-f",
      "null",
      "-",
    ]);
    const output = String(stderr);
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const hours = Number.parseInt(match[1]!, 10);
    const minutes = Number.parseInt(match[2]!, 10);
    const seconds = Number.parseFloat(match[3]!);
    return Math.round(hours * 3600 + minutes * 60 + seconds);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Concatenate MP4 buffers in order into one file. */
export async function concatMp4Buffers(clips: Buffer[]): Promise<Buffer> {
  if (!clips.length) {
    throw new Error("No video clips to stitch.");
  }
  if (clips.length === 1) {
    return clips[0];
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
