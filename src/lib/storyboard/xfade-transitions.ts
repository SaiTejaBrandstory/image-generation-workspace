/**
 * FFmpeg xfade transitions (ffmpeg -h filter=xfade).
 * IDs match FFmpeg `transition=` names exactly for stitch output, except:
 * - `dissolve` → `fade` (NLE cross-dissolve; native FFmpeg `dissolve` is dithered speckle).
 *
 * durationSec follows typical NLE defaults (Resolve / Premiere / CapCut):
 * - crossfade / dissolve: ~0.75–1.0s
 * - fast / match-cut: ~0.25–0.45s
 * - wipes & slides: ~0.55–0.7s
 * - slow / dip fades: ~1.0–1.5s
 */

export type TransitionCategory =
  | "fade"
  | "blend"
  | "wipe"
  | "slide"
  | "smooth"
  | "iris"
  | "diagonal"
  | "slice"
  | "motion";

export const TRANSITION_CATEGORIES: {
  id: TransitionCategory;
  label: string;
}[] = [
  { id: "fade", label: "Fade" },
  { id: "blend", label: "Blend" },
  { id: "wipe", label: "Wipe" },
  { id: "slide", label: "Slide" },
  { id: "smooth", label: "Smooth" },
  { id: "iris", label: "Iris & shape" },
  { id: "diagonal", label: "Diagonal" },
  { id: "slice", label: "Slice" },
  { id: "motion", label: "Motion" },
];

export type TransitionPreviewGroup =
  | "fade"
  | "dissolve"
  | "fade-black"
  | "fade-white"
  | "fade-grays"
  | "fade-fast"
  | "fade-slow"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "wipe-tl"
  | "wipe-tr"
  | "wipe-bl"
  | "wipe-br"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "smooth-left"
  | "smooth-right"
  | "smooth-up"
  | "smooth-down"
  | "circle"
  | "circle-open"
  | "circle-close"
  | "rect-crop"
  | "vert-open"
  | "vert-close"
  | "horz-open"
  | "horz-close"
  | "radial"
  | "distance"
  | "pixelize"
  | "diag-tl"
  | "diag-tr"
  | "diag-bl"
  | "diag-br"
  | "slice-h"
  | "slice-v"
  | "blur"
  | "squeeze-h"
  | "squeeze-v"
  | "zoom-in";

/** Legacy storyboard values — still accepted when loading old projects. */
export type LegacySceneTransition = "cut" | "wipe" | "match-cut" | "jump-cut";

export interface XfadeTransitionMeta {
  id: string;
  label: string;
  description: string;
  category: TransitionCategory;
  /** FFmpeg xfade transition name */
  xfade: string;
  durationSec: number;
  previewGroup: TransitionPreviewGroup;
  previewMs: number;
}

export const XFADE_TRANSITIONS: XfadeTransitionMeta[] = [
  { id: "fade", label: "Fade", description: "Linear crossfade at the join between clips (~0.75s).", category: "fade", xfade: "fade", durationSec: 0.75, previewGroup: "fade", previewMs: 750 },
  { id: "fadefast", label: "Fade fast", description: "Accelerated crossfade — transitions quickly at the join (~0.5s).", category: "fade", xfade: "fadefast", durationSec: 0.5, previewGroup: "fade-fast", previewMs: 500 },
  { id: "fadeslow", label: "Fade slow", description: "Slow eased crossfade with soft start and end at the join (~1.4s).", category: "fade", xfade: "fadeslow", durationSec: 1.4, previewGroup: "fade-slow", previewMs: 1400 },
  { id: "fadeblack", label: "Fade through black", description: "Outgoing dips to black, then incoming rises from black at the join (~1s).", category: "fade", xfade: "fadeblack", durationSec: 1.0, previewGroup: "fade-black", previewMs: 1000 },
  { id: "fadewhite", label: "Fade through white", description: "Outgoing flashes to white, then incoming returns from white at the join (~1s).", category: "fade", xfade: "fadewhite", durationSec: 1.0, previewGroup: "fade-white", previewMs: 1000 },
  { id: "fadegrays", label: "Fade through gray", description: "Both clips desaturate through gray at the midpoint of the join (~1.4s).", category: "fade", xfade: "fadegrays", durationSec: 1.4, previewGroup: "fade-grays", previewMs: 1400 },
  { id: "dissolve", label: "Dissolve", description: "Smooth cross-dissolve at the join — opacity blend between clips (~1s).", category: "blend", xfade: "fade", durationSec: 1.0, previewGroup: "dissolve", previewMs: 1000 },
  { id: "distance", label: "Distance", description: "Similar-color pixels shift first — best on matching shots; morph-like reveal (~1.25s).", category: "blend", xfade: "distance", durationSec: 1.25, previewGroup: "distance", previewMs: 1250 },
  { id: "pixelize", label: "Pixelize", description: "Mosaic blocks coarsen mid-transition then refine into the next clip (~1.2s).", category: "blend", xfade: "pixelize", durationSec: 1.2, previewGroup: "pixelize", previewMs: 1200 },
  { id: "wipeleft", label: "Wipe left", description: "Hard-edge wipe at the join — incoming reveals from the right (~0.7s).", category: "wipe", xfade: "wipeleft", durationSec: 0.7, previewGroup: "wipe-left", previewMs: 700 },
  { id: "wiperight", label: "Wipe right", description: "Hard-edge wipe at the join — incoming reveals from the left (~0.7s).", category: "wipe", xfade: "wiperight", durationSec: 0.7, previewGroup: "wipe-right", previewMs: 700 },
  { id: "wipeup", label: "Wipe up", description: "Hard-edge wipe at the join — incoming reveals from below (~0.7s).", category: "wipe", xfade: "wipeup", durationSec: 0.7, previewGroup: "wipe-up", previewMs: 700 },
  { id: "wipedown", label: "Wipe down", description: "Hard-edge wipe at the join — incoming reveals from above (~0.7s).", category: "wipe", xfade: "wipedown", durationSec: 0.7, previewGroup: "wipe-down", previewMs: 700 },
  { id: "wipetl", label: "Wipe top-left", description: "Hard-edge diagonal wipe at the join from the top-left corner (~0.7s).", category: "wipe", xfade: "wipetl", durationSec: 0.7, previewGroup: "wipe-tl", previewMs: 700 },
  { id: "wipetr", label: "Wipe top-right", description: "Hard-edge diagonal wipe at the join from the top-right corner (~0.7s).", category: "wipe", xfade: "wipetr", durationSec: 0.7, previewGroup: "wipe-tr", previewMs: 700 },
  { id: "wipebl", label: "Wipe bottom-left", description: "Hard-edge diagonal wipe at the join from the bottom-left corner (~0.7s).", category: "wipe", xfade: "wipebl", durationSec: 0.7, previewGroup: "wipe-bl", previewMs: 700 },
  { id: "wipebr", label: "Wipe bottom-right", description: "Hard-edge diagonal wipe at the join from the bottom-right corner (~0.7s).", category: "wipe", xfade: "wipebr", durationSec: 0.7, previewGroup: "wipe-br", previewMs: 700 },
  { id: "slideleft", label: "Slide left", description: "Outgoing clip slides left as incoming enters from the right at the join (~0.8s).", category: "slide", xfade: "slideleft", durationSec: 0.8, previewGroup: "slide-left", previewMs: 800 },
  { id: "slideright", label: "Slide right", description: "Outgoing clip slides right as incoming enters from the left at the join (~0.8s).", category: "slide", xfade: "slideright", durationSec: 0.8, previewGroup: "slide-right", previewMs: 800 },
  { id: "slideup", label: "Slide up", description: "Outgoing clip slides up as incoming enters from below at the join (~0.8s).", category: "slide", xfade: "slideup", durationSec: 0.8, previewGroup: "slide-up", previewMs: 800 },
  { id: "slidedown", label: "Slide down", description: "Outgoing clip slides down as incoming enters from above at the join (~0.8s).", category: "slide", xfade: "slidedown", durationSec: 0.8, previewGroup: "slide-down", previewMs: 800 },
  { id: "smoothleft", label: "Smooth left", description: "Soft feathered reveal from the left — like a gentle match-cut (~0.75s).", category: "smooth", xfade: "smoothleft", durationSec: 0.75, previewGroup: "smooth-left", previewMs: 750 },
  { id: "smoothright", label: "Smooth right", description: "Soft feathered reveal from the right (~0.75s).", category: "smooth", xfade: "smoothright", durationSec: 0.75, previewGroup: "smooth-right", previewMs: 750 },
  { id: "smoothup", label: "Smooth up", description: "Soft feathered reveal from the top (~0.75s).", category: "smooth", xfade: "smoothup", durationSec: 0.75, previewGroup: "smooth-up", previewMs: 750 },
  { id: "smoothdown", label: "Smooth down", description: "Soft feathered reveal from the bottom (~0.75s).", category: "smooth", xfade: "smoothdown", durationSec: 0.75, previewGroup: "smooth-down", previewMs: 750 },
  { id: "circlecrop", label: "Circle crop", description: "Circular mask through black — iris crop between clips (~1s).", category: "iris", xfade: "circlecrop", durationSec: 1.0, previewGroup: "circle", previewMs: 1000 },
  { id: "circleopen", label: "Circle open", description: "Iris expands from the center to reveal the next clip (~1s).", category: "iris", xfade: "circleopen", durationSec: 1.0, previewGroup: "circle-open", previewMs: 1000 },
  { id: "circleclose", label: "Circle close", description: "Iris contracts from the edges into the next clip (~1s).", category: "iris", xfade: "circleclose", durationSec: 1.0, previewGroup: "circle-close", previewMs: 1000 },
  { id: "rectcrop", label: "Rect crop", description: "Rectangular window through black between clips (~1s).", category: "iris", xfade: "rectcrop", durationSec: 1.0, previewGroup: "rect-crop", previewMs: 1000 },
  { id: "vertopen", label: "Vertical open", description: "Vertical blinds open outward from the center (~1s).", category: "iris", xfade: "vertopen", durationSec: 1.0, previewGroup: "vert-open", previewMs: 1000 },
  { id: "vertclose", label: "Vertical close", description: "Vertical blinds close inward from the sides (~1s).", category: "iris", xfade: "vertclose", durationSec: 1.0, previewGroup: "vert-close", previewMs: 1000 },
  { id: "horzopen", label: "Horizontal open", description: "Horizontal blinds open outward from the center (~1s).", category: "iris", xfade: "horzopen", durationSec: 1.0, previewGroup: "horz-open", previewMs: 1000 },
  { id: "horzclose", label: "Horizontal close", description: "Horizontal blinds close inward from top and bottom (~1s).", category: "iris", xfade: "horzclose", durationSec: 1.0, previewGroup: "horz-close", previewMs: 1000 },
  { id: "radial", label: "Radial", description: "Radial clock-sweep reveal around the center (~1.75s).", category: "iris", xfade: "radial", durationSec: 1.75, previewGroup: "radial", previewMs: 1750 },
  { id: "diagtl", label: "Diagonal TL", description: "Diagonal reveal from the top-left corner (~1s).", category: "diagonal", xfade: "diagtl", durationSec: 1.0, previewGroup: "diag-tl", previewMs: 1000 },
  { id: "diagtr", label: "Diagonal TR", description: "Diagonal reveal from the top-right corner (~1s).", category: "diagonal", xfade: "diagtr", durationSec: 1.0, previewGroup: "diag-tr", previewMs: 1000 },
  { id: "diagbl", label: "Diagonal BL", description: "Diagonal reveal from the bottom-left corner (~1s).", category: "diagonal", xfade: "diagbl", durationSec: 1.0, previewGroup: "diag-bl", previewMs: 1000 },
  { id: "diagbr", label: "Diagonal BR", description: "Diagonal reveal from the bottom-right corner (~1s).", category: "diagonal", xfade: "diagbr", durationSec: 1.0, previewGroup: "diag-br", previewMs: 1000 },
  { id: "hlslice", label: "Slice horizontal L", description: "Staggered horizontal bands reveal from the left (~1s).", category: "slice", xfade: "hlslice", durationSec: 1.0, previewGroup: "slice-h", previewMs: 1000 },
  { id: "hrslice", label: "Slice horizontal R", description: "Staggered horizontal bands reveal from the right (~1s).", category: "slice", xfade: "hrslice", durationSec: 1.0, previewGroup: "slice-h", previewMs: 1000 },
  { id: "vuslice", label: "Slice vertical up", description: "Staggered vertical bands reveal upward (~1s).", category: "slice", xfade: "vuslice", durationSec: 1.0, previewGroup: "slice-v", previewMs: 1000 },
  { id: "vdslice", label: "Slice vertical down", description: "Staggered vertical bands reveal downward (~1s).", category: "slice", xfade: "vdslice", durationSec: 1.0, previewGroup: "slice-v", previewMs: 1000 },
  // Motion — FFmpeg xfade names match `id` exactly (see ffmpeg -h filter=xfade).
  { id: "hblur", label: "Horizontal blur", description: "Horizontal motion blur at the join — blur peaks mid-transition (~1s).", category: "motion", xfade: "hblur", durationSec: 1.0, previewGroup: "blur", previewMs: 1000 },
  { id: "squeezeh", label: "Squeeze horizontal", description: "Outgoing clip compresses horizontally into the next (~1.2s).", category: "motion", xfade: "squeezeh", durationSec: 1.2, previewGroup: "squeeze-h", previewMs: 1200 },
  { id: "squeezev", label: "Squeeze vertical", description: "Outgoing clip compresses vertically into the next (~1.2s).", category: "motion", xfade: "squeezev", durationSec: 1.2, previewGroup: "squeeze-v", previewMs: 1200 },
  { id: "zoomin", label: "Zoom in", description: "Push into the next clip from the center (~1s).", category: "motion", xfade: "zoomin", durationSec: 1.0, previewGroup: "zoom-in", previewMs: 1000 },
];

export type XfadeTransitionId = (typeof XFADE_TRANSITIONS)[number]["id"];

export type SceneTransition = XfadeTransitionId | LegacySceneTransition;

const XFADE_BY_ID = new Map(XFADE_TRANSITIONS.map((item) => [item.id, item]));

const LEGACY_TO_XFADE: Record<LegacySceneTransition, string> = {
  cut: "fade",
  wipe: "wiperight",
  "match-cut": "smoothleft",
  "jump-cut": "fadefast",
};

const LEGACY_DURATION_SEC: Partial<Record<LegacySceneTransition, number>> = {
  cut: 0.12,
  "jump-cut": 0.2,
};

const LEGACY_LABELS: Record<LegacySceneTransition, string> = {
  cut: "Cut",
  wipe: "Wipe",
  "match-cut": "Match cut",
  "jump-cut": "Jump cut",
};

export function normalizeSceneTransition(
  transition: string | undefined
): XfadeTransitionId {
  const raw = transition?.trim().toLowerCase();
  if (!raw) return "fade";
  if (raw in LEGACY_TO_XFADE) {
    return LEGACY_TO_XFADE[raw as LegacySceneTransition] as XfadeTransitionId;
  }
  if (XFADE_BY_ID.has(raw)) return raw as XfadeTransitionId;
  return "fade";
}

export function resolveSceneTransitionMeta(
  transition: string | undefined
): XfadeTransitionMeta & { storedId: string } {
  const storedId = transition?.trim().toLowerCase() || "fade";
  const normalized = normalizeSceneTransition(storedId);
  const meta = XFADE_BY_ID.get(normalized)!;
  const legacyDuration =
    storedId in LEGACY_DURATION_SEC
      ? LEGACY_DURATION_SEC[storedId as LegacySceneTransition]
      : undefined;
  const legacyLabel =
    storedId in LEGACY_LABELS
      ? LEGACY_LABELS[storedId as LegacySceneTransition]
      : undefined;

  return {
    ...meta,
    storedId,
    label: legacyLabel ?? meta.label,
    durationSec: legacyDuration ?? meta.durationSec,
    previewMs: legacyDuration
      ? Math.round(legacyDuration * 1000)
      : meta.previewMs,
  };
}

export function getXfadeTransitionMeta(
  transition: string | undefined
): XfadeTransitionMeta {
  return resolveSceneTransitionMeta(transition);
}

export function mapStoryboardTransitionToStitchJoin(transition: string | undefined): {
  xfade: string;
  durationSec: number;
} {
  const resolved = resolveSceneTransitionMeta(transition);
  return { xfade: resolved.xfade, durationSec: resolved.durationSec };
}

/** Incoming clip context after the join in modal previews. */
export function getJoinPreviewIncomingSec(transition: string | undefined): number {
  const { durationSec, id } = resolveSceneTransitionMeta(transition);
  if (id === "squeezeh" || id === "squeezev") {
    return Math.max(durationSec + 1.5, 3.5);
  }
  if (id === "radial") {
    return Math.max(durationSec + 2, 4);
  }
  return Math.max(1.25, durationSec + 0.75);
}

/** FFmpeg squeeze transitions — need full overlap duration in stitch/preview. */
export function isSqueezeXfade(xfade: string): boolean {
  return xfade === "squeezeh" || xfade === "squeezev";
}

/** Hard-cut slide pushes — native FFmpeg uses a sharp edge, not smoothstep. */
export function isSlideXfade(xfade: string): boolean {
  return (
    xfade === "slideleft" ||
    xfade === "slideright" ||
    xfade === "slideup" ||
    xfade === "slidedown"
  );
}

/** Hard-edge wipes — linear reveal at the join between clips. */
export function isWipeXfade(xfade: string): boolean {
  return (
    xfade === "wipeleft" ||
    xfade === "wiperight" ||
    xfade === "wipeup" ||
    xfade === "wipedown" ||
    xfade === "wipetl" ||
    xfade === "wipetr" ||
    xfade === "wipebl" ||
    xfade === "wipebr"
  );
}

/** Fade-tab crossfades and dip transitions — need full overlap at the join. */
export function isFadeCategoryXfade(xfade: string): boolean {
  return (
    xfade === "fade" ||
    xfade === "fadefast" ||
    xfade === "fadeslow" ||
    xfade === "fadeblack" ||
    xfade === "fadewhite" ||
    xfade === "fadegrays"
  );
}

/** Blend transitions — need full overlap so the effect reads through at the join. */
export function isBlendXfade(xfade: string): boolean {
  return xfade === "distance" || xfade === "pixelize";
}

/** Transitions that must not be shortened by the 55% clip cap in stitch. */
export function isFullOverlapXfade(xfade: string): boolean {
  return isSqueezeXfade(xfade) || xfade === "radial" || isSlideXfade(xfade);
}

export function isSceneTransition(value: string): value is SceneTransition {
  const lower = value.toLowerCase();
  return lower in LEGACY_TO_XFADE || XFADE_BY_ID.has(lower);
}

export function getTransitionsForCategory(
  category: TransitionCategory
): XfadeTransitionMeta[] {
  return XFADE_TRANSITIONS.filter((item) => item.category === category);
}

export function getCategoryForTransition(
  transition: string | undefined
): TransitionCategory {
  const normalized = normalizeSceneTransition(transition);
  return XFADE_BY_ID.get(normalized)?.category ?? "fade";
}
