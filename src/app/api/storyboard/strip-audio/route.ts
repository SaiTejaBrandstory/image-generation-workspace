import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

function ffmpegPath(): string {
  const p = ffmpegStatic as string | null;
  if (!p) throw new Error("ffmpeg missing — cannot strip audio");
  return p;
}

interface StripAudioBody {
  /** Signed or public URL of the video to mute. */
  videoUrl: string;
  /** Suggested download filename returned in Content-Disposition. */
  filename?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = (await request.json()) as StripAudioBody;
    if (!body.videoUrl?.trim()) {
      return NextResponse.json({ error: "videoUrl is required." }, { status: 400 });
    }

    // Fetch the source video
    const fetchRes = await fetch(body.videoUrl);
    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: "Could not fetch the source video." },
        { status: 502 }
      );
    }
    const inputBuffer = Buffer.from(await fetchRes.arrayBuffer());

    const dir = await mkdtemp(path.join(os.tmpdir(), "storyboard-strip-audio-"));
    const inFile = path.join(dir, "in.mp4");
    const outFile = path.join(dir, "out.mp4");

    try {
      await writeFile(inFile, inputBuffer);

      // -an strips all audio streams; -c:v copy avoids re-encoding for speed
      await execFileAsync(ffmpegPath(), [
        "-y",
        "-i",
        inFile,
        "-an",
        "-c:v",
        "copy",
        "-movflags",
        "+faststart",
        outFile,
      ]);

      const outputBuffer = await readFile(outFile);
      const filename = body.filename?.trim() || "storyboard-video-no-audio.mp4";

      return new NextResponse(outputBuffer, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(outputBuffer.length),
        },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not strip audio from video.";
    console.error("[storyboard/strip-audio]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
