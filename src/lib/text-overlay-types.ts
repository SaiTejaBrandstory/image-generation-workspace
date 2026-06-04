export type TextFontWeight = "400" | "600" | "700";
export type TextFontStyle = "normal" | "italic";
export type TextAlign = "left" | "center" | "right";

export interface TextOverlayState {
  content: string;
  /**
   * Horizontal anchor on the image in % (see textAlign).
   * left → left edge; center → horizontal center; right → right edge.
   */
  x: number;
  /** Top edge of text block in % of image height. */
  y: number;
  /** Font size in px at full image resolution (export size). */
  fontSize: number;
  fontFamily: string;
  fontWeight: TextFontWeight;
  fontStyle: TextFontStyle;
  color: string;
  textAlign: TextAlign;
}

export interface TextBoundsPct {
  widthPct: number;
  heightPct: number;
}
