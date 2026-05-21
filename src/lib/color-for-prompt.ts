/** Turn design-token color values into image-safe wording (never raw hex). */

const NAMED_HEX: Record<string, string> = {
  "#7c3aed": "rich violet purple",
  "#0b0b0b": "near-black",
  "#000000": "black",
  "#ffffff": "white",
  "#3b82f6": "bright blue",
  "#06b6d4": "cyan",
  "#f97316": "warm orange",
  "#ec4899": "pink",
};

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace(/^#/, "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function describeRgb(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;

  if (lightness < 0.12) return "deep black";
  if (lightness > 0.9) return "bright white";

  if (r > g && r > b) return lightness > 0.55 ? "warm red" : "deep red";
  if (g > r && g > b) return lightness > 0.55 ? "fresh green" : "deep green";
  if (b > r && b > g) return lightness > 0.55 ? "vivid blue" : "deep blue";

  if (r > 200 && g > 100 && b < 100) return "golden orange";
  if (r > 180 && g < 120 && b > 180) return "violet purple";
  if (r > 120 && g < 100 && b > 200) return "purple violet";

  return lightness > 0.55 ? "soft neutral" : "dark neutral";
}

/** Use in image prompts only — never pass #RRGGBB literals to the model. */
export function colorForImagePrompt(value?: string): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  const lower = v.toLowerCase();

  if (NAMED_HEX[lower]) return NAMED_HEX[lower];
  if (!/^#[0-9a-f]{3,8}$/i.test(v)) return v;

  const rgb = parseHex(v);
  return rgb ? describeRgb(rgb.r, rgb.g, rgb.b) : "brand accent hue";
}

export const NO_SPEC_TEXT_IN_IMAGE =
  "Do not render hex color codes, color swatches, typography specimens, design-system labels, or any metadata/spec text in the image.";
