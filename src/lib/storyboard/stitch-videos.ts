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
