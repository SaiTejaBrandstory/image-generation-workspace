import { NextRequest, NextResponse } from "next/server";
import { buildDefaultContinuity } from "@/lib/storyboard/continuity";
import {
  getFrameStyleConfig,
  normalizeFrameStyle,
} from "@/lib/storyboard/frame-styles";
import { normalizeFrameCount } from "@/lib/storyboard/script-utils";
import { generateScenesFromScript } from "@/lib/storyboard/scene-engine";
import { normalizeSceneFields } from "@/lib/storyboard/scene-fields";
import {
  dedupeSceneContent,
  padScenesToTarget,
} from "@/lib/storyboard/scene-expansion";
import { sanitizeScenes } from "@/lib/storyboard/brief-meta";
import {
  injectBookendScenes,
  parseBookendSceneFields,
} from "@/lib/storyboard/bookend-scenes";
import { applyGlobalSceneEnvironment } from "@/lib/storyboard/scene-environment";
import { storyboardChatCompletion } from "@/lib/storyboard/openrouter-text";
import { getTargetSceneCount } from "@/lib/storyboard/script-utils";
import {
  formatVoiceoverBudgetPrompt,
  normalizeScenesToTimeline,
} from "@/lib/storyboard/voiceover-timing";
import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import { buildInputReferencesPromptBlock } from "@/lib/storyboard/storyboard-input-references";
import { createClient } from "@/lib/supabase/server";
import type {
  StoryboardContinuity,
  StoryboardProjectSettings,
  StoryboardScene,
} from "@/types/storyboard";

export const maxDuration = 60;

interface BreakdownBody {
  script: string;
  settings: StoryboardProjectSettings;
}

function parseContinuity(
  raw: unknown,
  settings: StoryboardProjectSettings
): StoryboardContinuity {
  const defaults = buildDefaultContinuity(settings);
  if (!raw || typeof raw !== "object") return defaults;
  const c = raw as Record<string, unknown>;
  return {
    characters: String(c.characters ?? defaults.characters),
    locations: String(c.locations ?? defaults.locations),
    props: String(c.props ?? defaults.props),
    sketchStyle: String(c.sketchStyle ?? defaults.sketchStyle),
  };
}

async function breakdownWithLlm(
  script: string,
  settings: StoryboardProjectSettings
): Promise<{
  scenes: StoryboardScene[];
  continuity: StoryboardContinuity;
  openingBookend?: ReturnType<typeof parseBookendSceneFields>;
  closingBookend?: ReturnType<typeof parseBookendSceneFields>;
} | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const targetScenes = getTargetSceneCount(settings);
  const frameStyleConfig = getFrameStyleConfig(settings.frameStyle);
  const voiceoverBudget = formatVoiceoverBudgetPrompt(
    targetScenes,
    settings.durationSec
  );

  const referenceLabelsBlock = buildInputReferencesPromptBlock(
    settings.inputReferences ?? []
  );

  const system = `You are a professional storyboard supervisor for film production. Return ONLY valid JSON with "continuity", "scenes", "openingBookend", and "closingBookend".

"continuity" object (visual bible for the ENTIRE storyboard — must stay identical across every frame):
- characters: detailed locked descriptions of every recurring character (face, hair, age, build, clothing, distinguishing features). Use specific names.
- locations: locked descriptions of recurring sets/environments.
- props: locked descriptions of hero products, vehicles, or key objects.
- sketchStyle: one consistent ${frameStyleConfig.label.toLowerCase()} visual style for the full sequence (${frameStyleConfig.continuityHint}).

"scenes" array — each scene must have: voiceover, visualDescription, cameraDirection (shot type e.g. Wide Shot, Close Up), cameraAngle (e.g. Eye Level, Low Angle), cameraMovement (e.g. Static, Pan, Dolly In, Tracking), characterActions, environment, emotion (neutral|joy|tension|sadness|excitement|calm|urgency|hope), transition (FFmpeg xfade name e.g. fade, dissolve, wiperight, smoothleft, circleopen, pixelize — default fade), imagePrompt, durationSec (integer).
Return EXACTLY ${targetScenes} scenes in the array — no more, no fewer.
Total duration must be EXACTLY ${settings.durationSec} seconds across all ${targetScenes} scenes.
Use these per-scene voiceover time budgets (do not exceed word limits — narration is recorded at natural speed):
${voiceoverBudget}
Genre: ${settings.genre}.
${
  settings.sceneEnvironment?.trim()
    ? `Global scene environment for ALL scenes (use exactly this in every scene's environment field): ${settings.sceneEnvironment.trim()}`
    : ""
}

CRITICAL: Every scene must be UNIQUE. Different voiceover, visualDescription, cameraDirection, cameraAngle, cameraMovement, characterActions, and imagePrompt per scene. Do NOT copy-paste or repeat the same beat across scenes. Each scene advances the story forward.

BRIEF INPUT RULES: The user brief may mention runtime (e.g. "45-second ad") — IGNORE that completely. Total duration is ${settings.durationSec}s from project settings only. Do NOT copy the brief's opening sentence into voiceover or visualDescription. Do NOT repeat "A 45-second ad for…", duration labels, or format meta in any scene field.

voiceover: Spoken narration for THIS scene only — short lines that fit the scene's second slot and word limit above. Natural pace; never cram extra sentences. Not ad-format meta.
visualDescription: What the camera sees in this single shot — subject, action, setting, mood. Not ad-length meta or the brief preamble.

Use the SAME character names and physical descriptions in every scene. For imagePrompt: ${frameStyleConfig.breakdownHint}. Reference continuity bible characters by name. Never include scene numbers, shot labels, or any text that could appear in the image. No text, labels, UI, timelines, collages, or multi-panel layouts.

"openingBookend" and "closingBookend" — extra cinematic intro/outro frames (NOT in the scenes array). Choose the best approach FROM THIS SCRIPT — examples only, pick what fits:
- Long shot of the same world with the main character before/after the story
- Environmental establishing or epilogue of the story location
- Product hero framing for brand/product ads
- Character arrival, departure, or resolution beat

openingBookend: smooth lead-in BEFORE scene 1 — same story world as scene 1, continuous feel, different composition (not a duplicate of scene 1).
closingBookend: smooth lead-out AFTER the final scene — same story world, NOT a duplicate of the final scene; script-appropriate resolution.

Each bookend object: visualDescription, imagePrompt, cameraDirection, cameraAngle, cameraMovement, characterActions, environment, emotion, transition.
Bookend imagePrompt rules: full brightness, normal exposure — NO black frame, NO dark vignette, NO fade-to-black in the image (video fades are post-production only). No voiceover on bookends.
${referenceLabelsBlock ? `\n${referenceLabelsBlock}` : ""}`;

  let raw: string;
  try {
    raw = await storyboardChatCompletion({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Create ${targetScenes} storyboard scenes from this input. It may be a short creative brief or a full screenplay — if brief, invent a complete script with voiceover, characters, and visual beats:\n\n${script}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      continuity?: Record<string, unknown>;
      scenes?: Array<Record<string, unknown>>;
      openingBookend?: unknown;
      closingBookend?: unknown;
    };
    const list = Array.isArray(parsed.scenes)
      ? parsed.scenes
      : Array.isArray(parsed)
        ? (parsed as Array<Record<string, unknown>>)
        : [];
    if (!list.length) return null;

    const continuity = parseContinuity(parsed.continuity, settings);
    const scenes = list.map((item, index) => {
      const camera = normalizeSceneFields({
        cameraDirection: String(
          item.cameraDirection ?? item.shotType ?? "Wide Shot"
        ),
        cameraAngle: String(item.cameraAngle ?? ""),
        cameraMovement: String(item.cameraMovement ?? ""),
      });
      return {
        id: crypto.randomUUID(),
        sceneNumber: index + 1,
        durationSec: Number(item.durationSec) || 3,
        voiceover: String(item.voiceover ?? ""),
        visualDescription: String(item.visualDescription ?? ""),
        ...camera,
        characterActions: String(item.characterActions ?? ""),
        environment: String(item.environment ?? ""),
        emotion: (item.emotion as StoryboardScene["emotion"]) ?? "neutral",
        transition: (item.transition as StoryboardScene["transition"]) ?? "cut",
        imagePrompt: String(item.imagePrompt ?? item.visualDescription ?? ""),
        frameStatus: "pending" as const,
      };
    });

    return {
      scenes,
      continuity,
      openingBookend: parseBookendSceneFields(parsed.openingBookend),
      closingBookend: parseBookendSceneFields(parsed.closingBookend),
    };
  } catch {
    return null;
  }
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

    const body = (await request.json()) as BreakdownBody;
    if (!body.script?.trim()) {
      return NextResponse.json({ error: "Script is required." }, { status: 400 });
    }

    const settings: StoryboardProjectSettings = {
      ...body.settings,
      frameCount: normalizeFrameCount(body.settings?.frameCount),
      frameStyle: normalizeFrameStyle(body.settings?.frameStyle),
    };

    const llmResult = await breakdownWithLlm(body.script, settings);
    const targetScenes = getTargetSceneCount(settings);
    let scenes =
      llmResult?.scenes ??
      generateScenesFromScript(body.script, settings, targetScenes);
    const continuity =
      llmResult?.continuity ?? buildDefaultContinuity(settings);

    scenes = padScenesToTarget(
      scenes,
      body.script,
      settings,
      targetScenes
    );
    scenes = dedupeSceneContent(scenes, body.script, settings);
    scenes = sanitizeScenes(scenes);
    scenes = normalizeScenesToTimeline(scenes, settings.durationSec);

    scenes = injectBookendScenes(scenes, settings, {
      script: body.script,
      openingBookend: llmResult?.openingBookend,
      closingBookend: llmResult?.closingBookend,
    });

    return NextResponse.json({
      scenes: applyGlobalSceneEnvironment(scenes, settings.sceneEnvironment),
      continuity,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? formatOpenRouterErrorForUser(err.message)
        : "Scene breakdown failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
