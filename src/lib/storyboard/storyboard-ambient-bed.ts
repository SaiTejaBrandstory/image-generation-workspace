import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { StoryboardGenre } from "@/types/storyboard";

const execFileAsync = promisify(execFile);

function ffmpegPath(): string {
  const bin = ffmpegStatic;
  if (!bin) {
    throw new Error(
      "Ambient music is not available on this server (ffmpeg missing)."
    );
  }
  return bin;
}

interface GenreTones {
  /** Root, fifth, octave-ish (Hz) */
  freqs: [number, number, number];
  /** Pink noise amount after lowpass */
  noiseAmp: number;
  /** Sine layer volumes */
  sineVols: [number, number, number];
}

function tonesForGenre(genre: StoryboardGenre | undefined): GenreTones {
  switch (genre) {
    case "sports":
    case "social-ad":
      return { freqs: [110, 165, 220], sineVols: [0.14, 0.1, 0.08], noiseAmp: 0.1 };
    case "technology":
    case "corporate":
      return { freqs: [130.81, 196, 261.63], sineVols: [0.12, 0.09, 0.07], noiseAmp: 0.08 };
    case "cinematic":
    case "commercial":
      return { freqs: [55, 82.5, 110], sineVols: [0.16, 0.12, 0.09], noiseAmp: 0.09 };
    case "healthcare":
    case "education":
    case "explainer":
      return { freqs: [98, 146.83, 196], sineVols: [0.11, 0.08, 0.06], noiseAmp: 0.07 };
    default:
      return { freqs: [82.41, 123.47, 164.81], sineVols: [0.13, 0.1, 0.07], noiseAmp: 0.09 };
  }
}

/** Audible pad: layered sine drones + soft texture — reads as background music under voice. */
export async function buildStoryboardAmbientBed(
  durationSec: number,
  genre?: StoryboardGenre
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-bed-"));
  const outFile = path.join(dir, "bed.mp3");
  const dur = Math.max(2, durationSec);
  const fadeIn = Math.min(1.2, dur * 0.06);
  const fadeOut = Math.min(1.5, dur * 0.1);
  const fadeOutStart = Math.max(0, dur - fadeOut);
  const fades = `afade=t=in:st=0:d=${fadeIn.toFixed(3)},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(3)}`;

  const { freqs, sineVols, noiseAmp } = tonesForGenre(genre);
  const [f0, f1, f2] = freqs;
  const [v0, v1, v2] = sineVols;

  const filterComplex = [
    `[0:a]volume=${v0}[a0]`,
    `[1:a]volume=${v1}[a1]`,
    `[2:a]volume=${v2}[a2]`,
    `[3:a]volume=0.3[a3]`,
    `[a0][a1][a2][a3]amix=inputs=4:duration=first:normalize=0,lowpass=f=3200,highpass=f=50,tremolo=f=0.12:d=0.18,${fades}`,
  ].join(";");

  try {
    await execFileAsync(ffmpegPath(), [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${f0}:sample_rate=44100:duration=${dur}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${f1}:sample_rate=44100:duration=${dur}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${f2}:sample_rate=44100:duration=${dur}`,
      "-f",
      "lavfi",
      "-i",
      `anoisesrc=d=${dur}:c=pink:a=${noiseAmp},lowpass=f=1400`,
      "-filter_complex",
      filterComplex,
      "-t",
      String(dur),
      "-ar",
      "44100",
      "-ac",
      "2",
      "-c:a",
      "libmp3lame",
      "-q:a",
      "2",
      outFile,
    ]);
    const buffer = await readFile(outFile);
    if (buffer.length < 500) {
      throw new Error("Ambient bed output was empty.");
    }
    return buffer;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
