import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { generateSpeechWithOpenRouter } from "@/lib/openrouter-tts";
import { fitVoiceoverToSceneDuration } from "@/lib/storyboard/voiceover-timing";
import type { StoryboardScene } from "@/types/storyboard";

const execFileAsync = promisify(execFile);

/** Silence after the last line when narration is shorter than the video. */
const END_TAIL_SILENCE_SEC = 0.8;

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

function parseDurationFromFfmpegStderr(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  const seconds = Number.parseFloat(match[3]!);
  return hours * 3600 + minutes * 60 + seconds;
}

async function probeAudioDurationSec(filePath: string): Promise<number> {
  try {
    const { stderr } = await execFileAsync(ffmpegPath(), [
      "-i",
      filePath,
      "-f",
      "null",
      "-",
    ]);
    return parseDurationFromFfmpegStderr(String(stderr)) ?? 0;
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr?: string }).stderr ?? "")
        : "";
    return parseDurationFromFfmpegStderr(stderr) ?? 0;
  }
}

async function normalizeSpeechMp3(inputPath: string, outPath: string): Promise<void> {
  await execFileAsync(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-ar",
    "44100",
    "-ac",
    "1",
    "-c:a",
    "libmp3lame",
    outPath,
  ]);
}

async function writeSilenceMp3(
  durationSec: number,
  outPath: string
): Promise<void> {
  await execFileAsync(ffmpegPath(), [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=mono",
    "-t",
    String(Math.max(0.05, durationSec)),
    "-c:a",
    "libmp3lame",
    outPath,
  ]);
}

/**
 * One scene time slot: TTS at natural pace, padded with silence to fill the slot.
 * Text is trimmed to the slot before synthesis — never sped up.
 */
async function writeSceneSlotAudio(
  scene: StoryboardScene,
  index: number,
  dir: string
): Promise<string | null> {
  const slotDur = Math.max(0.5, scene.durationSec);
  const segPath = path.join(dir, `slot-${index}.mp3`);
  const text = fitVoiceoverToSceneDuration(scene.voiceover, slotDur);

  if (!text) {
    await writeSilenceMp3(slotDur, segPath);
    return segPath;
  }

  const raw = await generateSpeechWithOpenRouter({ input: text });
  const rawPath = path.join(dir, `raw-${index}.mp3`);
  const speechPath = path.join(dir, `speech-${index}.mp3`);
  await writeFile(rawPath, raw);
  await normalizeSpeechMp3(rawPath, speechPath);

  const speechDur = await probeAudioDurationSec(speechPath);
  const padAfter = Math.max(0, slotDur - speechDur);

  if (padAfter > 0.01) {
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      speechPath,
      "-af",
      `apad=pad_dur=${padAfter.toFixed(3)}`,
      "-t",
      String(slotDur),
      "-c:a",
      "libmp3lame",
      segPath,
    ]);
  } else {
    const fadeDur = Math.min(0.25, slotDur * 0.12);
    const fadeStart = Math.max(0, slotDur - fadeDur);
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      speechPath,
      "-af",
      `afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeDur.toFixed(3)}`,
      "-t",
      String(slotDur),
      "-c:a",
      "libmp3lame",
      segPath,
    ]);
  }

  return segPath;
}

async function concatAudioFiles(
  paths: string[],
  outPath: string
): Promise<void> {
  const listFile = `${outPath}.txt`;
  await writeFile(listFile, paths.map(escapeConcatPath).join("\n"));
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
}

/** Fit narration to video length: pad silence or fade-trim tail — never speed up. */
async function padToVideoDuration(
  audioPath: string,
  outPath: string,
  videoDurationSec: number
): Promise<number> {
  const speechDur = await probeAudioDurationSec(audioPath);

  if (speechDur > videoDurationSec + 0.1) {
    const fadeDur = Math.min(0.4, videoDurationSec * 0.12);
    const fadeStart = Math.max(0, videoDurationSec - fadeDur);
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-i",
      audioPath,
      "-af",
      `afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeDur.toFixed(3)}`,
      "-t",
      String(videoDurationSec),
      "-c:a",
      "libmp3lame",
      outPath,
    ]);
    return videoDurationSec;
  }

  const padSec = Math.max(END_TAIL_SILENCE_SEC, videoDurationSec - speechDur);
  await execFileAsync(ffmpegPath(), [
    "-y",
    "-i",
    audioPath,
    "-af",
    `apad=pad_dur=${padSec.toFixed(3)}`,
    "-t",
    String(videoDurationSec),
    "-c:a",
    "libmp3lame",
    outPath,
  ]);

  return videoDurationSec;
}

export interface StoryboardVoiceoverResult {
  buffer: Buffer;
  durationSec: number;
}

/**
 * Build narrator track aligned to each scene's durationSec slot.
 * Returns null when no scene has voiceover text.
 */
export async function buildStoryboardVoiceoverTrack(
  scenes: StoryboardScene[],
  options?: { targetDurationSec?: number }
): Promise<StoryboardVoiceoverResult | null> {
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  if (!ordered.length) return null;
  if (!ordered.some((scene) => scene.voiceover?.trim())) return null;

  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-vo-"));
  try {
    const slotPaths: string[] = [];

    for (let i = 0; i < ordered.length; i++) {
      const slotPath = await writeSceneSlotAudio(ordered[i]!, i, dir);
      if (slotPath) slotPaths.push(slotPath);
    }

    if (!slotPaths.length) return null;

    const timelinePath = path.join(dir, "timeline.mp3");
    await concatAudioFiles(slotPaths, timelinePath);

    const videoDur = options?.targetDurationSec;
    if (videoDur != null && videoDur > 0) {
      const finalPath = path.join(dir, "final.mp3");
      const durationSec = await padToVideoDuration(timelinePath, finalPath, videoDur);
      return {
        buffer: await readFile(finalPath),
        durationSec,
      };
    }

    const naturalDur = await probeAudioDurationSec(timelinePath);
    return {
      buffer: await readFile(timelinePath),
      durationSec: naturalDur,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
