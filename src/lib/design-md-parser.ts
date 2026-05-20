import type { DesignTokens } from "@/types";

export function parseDesignMd(content: string): DesignTokens {
  const tokens: DesignTokens = {
    typography: {},
    colors: {},
    composition: {},
    motion: {},
    personality: [],
  };

  const lines = content.split("\n");
  let section = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      section = trimmed.slice(2).toLowerCase();
      continue;
    }
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...rest] = trimmed.split(":");
    const value = rest.join(":").trim();
    if (!value) continue;

    switch (section) {
      case "typography":
        if (/primary/i.test(key)) tokens.typography.primary = value;
        if (/secondary/i.test(key)) tokens.typography.secondary = value;
        if (/scale/i.test(key)) tokens.typography.scale = value;
        break;
      case "colors":
        if (/primary/i.test(key)) tokens.colors.primary = value;
        if (/secondary/i.test(key)) tokens.colors.secondary = value;
        if (/accent/i.test(key)) tokens.colors.accent = value;
        if (/background/i.test(key)) tokens.colors.background = value;
        break;
      case "composition":
        if (/layout/i.test(key))
          tokens.composition.preferredLayouts = value.split(",").map((s) => s.trim());
        if (/negative|space/i.test(key))
          tokens.composition.negativeSpace = value;
        if (/align/i.test(key)) tokens.composition.alignment = value;
        break;
      case "motion":
        if (/style|animation/i.test(key)) tokens.motion.style = value;
        if (/intensity|speed/i.test(key)) tokens.motion.intensity = value;
        break;
      case "brand personality":
        tokens.personality.push(
          ...value.split(/[,+&]/).map((s) => s.trim()).filter(Boolean)
        );
        break;
    }
  }

  return tokens;
}

export function augmentPrompt(
  userPrompt: string,
  tokens?: DesignTokens
): string {
  if (!tokens) return userPrompt;

  const parts: string[] = [userPrompt];

  if (tokens.typography.primary) {
    parts.push(`Typography: ${tokens.typography.primary}`);
  }
  if (tokens.colors.accent || tokens.colors.primary) {
    parts.push(
      `Palette: ${tokens.colors.primary ?? ""} ${tokens.colors.accent ?? ""}`.trim()
    );
  }
  if (tokens.composition.negativeSpace) {
    parts.push(`Composition: ${tokens.composition.negativeSpace}`);
  }
  if (tokens.personality.length) {
    parts.push(`Brand tone: ${tokens.personality.join(", ")}`);
  }

  return parts.join(". ");
}

export function recommendLayouts(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const recs: string[] = [];

  if (/luxury|watch|premium|porsche|fashion/i.test(lower)) {
    recs.push("editorial-magazine", "single-hero", "central-focus", "typography-dominant");
  }
  if (/saas|dashboard|app|ui|software/i.test(lower)) {
    recs.push("grid-modular", "ui-showcase", "split-screen", "f-pattern");
  }
  if (/sport|nike|energy|dynamic|automotive/i.test(lower)) {
    recs.push("diagonal-dynamic", "full-bleed", "asymmetrical");
  }
  if (/tiktok|instagram|social|ugc|mobile/i.test(lower)) {
    recs.push("mobile-native", "carousel-sequential", "collage-scrapbook");
  }
  if (/tech|ai|futuristic|cyber/i.test(lower)) {
    recs.push("floating-elements", "radial", "ui-showcase", "layered-depth");
  }

  if (recs.length === 0) {
    return ["single-hero", "editorial-magazine", "central-focus", "grid-modular"];
  }

  return [...new Set(recs)].slice(0, 8);
}
