import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { generateSpeechWithOpenRouter } from "@/lib/openrouter-tts";
import type { StoryboardScene } from "@/types/storyboard";

const execFileAsync = promisify(execFile);

function ffmpegPath(): string {
  const bin = ffmpegStatic;
  if (!bin) {
    throw new Error(
      "Voiceover mixing is not available on this server (ffmpeg missing)."
    );
  }
  return bin;
}

function escapeConcatPath(filePath: string): string {
  return `file '${filePath.replace(/'/g, "'\\''")}'`;
}

async function writeSceneAudioSegment(
  scene: StoryboardScene,
  index: number,
  dir: string
): Promise<string> {
  const targetDur = Math.max(0.5, scene.durationSec);
  const segPath = path.join(dir, `seg-${index}.mp3`);
  const text = scene.voiceover?.trim();

  if (text) {
    const raw = await generateSpeechWithOpenRouter({ input: text });
    const rawPath = path.join(dir, `raw-${index}.mp3`);
    await writeFile(rawPath, raw);
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      rawPath,
      "-af",
      "apad",
      "-t",
      String(targetDur),
      "-ar",
      "44100",
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      segPath,
    ]);
  } else {
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      String(targetDur),
      "-c:a",
      "libmp3lame",
      segPath,
    ]);
  }

  return segPath;
}

function scaleSceneDurations(
  scenes: StoryboardScene[],
  targetTotalSec: number
): StoryboardScene[] {
  const sum = scenes.reduce((acc, scene) => acc + scene.durationSec, 0);
  if (sum <= 0 || targetTotalSec <= 0) return scenes;
  const scale = targetTotalSec / sum;
  return scenes.map((scene) => ({
    ...scene,
    durationSec: Math.max(0.5, scene.durationSec * scale),
  }));
}

/**
 * Build one narrator track timed to scene durations — same TTS voice for every line.
 * Returns null when no scene has voiceover text.
 */
export async function buildStoryboardVoiceoverTrack(
  scenes: StoryboardScene[],
  options?: { targetDurationSec?: number }
): Promise<Buffer | null> {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  if (!ordered.length) return null;
  if (!ordered.some((scene) => scene.voiceover?.trim())) return null;

  const timedScenes =
    options?.targetDurationSec != null && options.targetDurationSec > 0
      ? scaleSceneDurations(ordered, options.targetDurationSec)
      : ordered;

  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-vo-"));
  try {
    const segmentPaths: string[] = [];
    for (let i = 0; i < timedScenes.length; i++) {
      segmentPaths.push(await writeSceneAudioSegment(timedScenes[i]!, i, dir));
    }

    const listFile = path.join(dir, "concat.txt");
    await writeFile(
      listFile,
      segmentPaths.map(escapeConcatPath).join("\n")
    );

    const outPath = path.join(dir, "voiceover.mp3");
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c:a",
      "libmp3lame",
      outPath,
    ]);

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
