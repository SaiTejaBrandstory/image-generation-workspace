/** Fonts for text overlay — preview + canvas export (load via OVERLAY_GOOGLE_FONTS_HREF). */

export type OverlayFontOption = { label: string; value: string };

export const TEXT_FONT_GROUPS: { label: string; fonts: OverlayFontOption[] }[] = [
  {
    label: "Sans serif",
    fonts: [
      { label: "Inter", value: "Inter, system-ui, sans-serif" },
      { label: "Roboto", value: "Roboto, Helvetica, sans-serif" },
      { label: "Open Sans", value: "'Open Sans', Helvetica, sans-serif" },
      { label: "Lato", value: "Lato, Helvetica, sans-serif" },
      { label: "Montserrat", value: "Montserrat, Helvetica, sans-serif" },
      { label: "Poppins", value: "Poppins, Helvetica, sans-serif" },
      { label: "Nunito", value: "Nunito, Helvetica, sans-serif" },
      { label: "Raleway", value: "Raleway, Helvetica, sans-serif" },
      { label: "Rubik", value: "Rubik, Helvetica, sans-serif" },
      { label: "Ubuntu", value: "Ubuntu, Helvetica, sans-serif" },
      { label: "Work Sans", value: "'Work Sans', Helvetica, sans-serif" },
      { label: "DM Sans", value: "'DM Sans', Helvetica, sans-serif" },
      { label: "Outfit", value: "Outfit, Helvetica, sans-serif" },
      { label: "Barlow", value: "Barlow, Helvetica, sans-serif" },
      { label: "Source Sans 3", value: "'Source Sans 3', Helvetica, sans-serif" },
      { label: "Fira Sans", value: "'Fira Sans', Helvetica, sans-serif" },
      { label: "Josefin Sans", value: "'Josefin Sans', Helvetica, sans-serif" },
      { label: "Space Grotesk", value: "'Space Grotesk', Helvetica, sans-serif" },
      { label: "Oswald", value: "Oswald, Helvetica, sans-serif" },
      { label: "Arial", value: "Arial, Helvetica, sans-serif" },
      { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
      { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
    ],
  },
  {
    label: "Serif",
    fonts: [
      { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
      { label: "Merriweather", value: "Merriweather, Georgia, serif" },
      { label: "Lora", value: "Lora, Georgia, serif" },
      { label: "Libre Baskerville", value: "'Libre Baskerville', Georgia, serif" },
      { label: "Crimson Text", value: "'Crimson Text', Georgia, serif" },
      { label: "PT Serif", value: "'PT Serif', Georgia, serif" },
      { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
    ],
  },
  {
    label: "Display",
    fonts: [
      { label: "Bebas Neue", value: "'Bebas Neue', Impact, sans-serif" },
      { label: "Anton", value: "Anton, Impact, sans-serif" },
      { label: "Archivo Black", value: "'Archivo Black', Impact, sans-serif" },
      { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
    ],
  },
  {
    label: "Script",
    fonts: [
      { label: "Pacifico", value: "Pacifico, cursive" },
      { label: "Dancing Script", value: "'Dancing Script', cursive" },
    ],
  },
  {
    label: "Monospace",
    fonts: [
      { label: "Roboto Mono", value: "'Roboto Mono', 'Courier New', monospace" },
      { label: "Courier New", value: "'Courier New', Courier, monospace" },
    ],
  },
];

/** Flat list for lookups */
export const TEXT_FONT_OPTIONS: OverlayFontOption[] = TEXT_FONT_GROUPS.flatMap(
  (g) => g.fonts
);

/** Google Fonts stylesheet — weights used by overlay (400, 600, 700). */
export const OVERLAY_GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Roboto:wght@400;600;700",
    "family=Open+Sans:wght@400;600;700",
    "family=Lato:wght@400;600;700",
    "family=Montserrat:wght@400;600;700",
    "family=Poppins:wght@400;600;700",
    "family=Nunito:wght@400;600;700",
    "family=Raleway:wght@400;600;700",
    "family=Rubik:wght@400;600;700",
    "family=Ubuntu:wght@400;600;700",
    "family=Work+Sans:wght@400;600;700",
    "family=DM+Sans:wght@400;600;700",
    "family=Outfit:wght@400;600;700",
    "family=Barlow:wght@400;600;700",
    "family=Source+Sans+3:wght@400;600;700",
    "family=Fira+Sans:wght@400;600;700",
    "family=Josefin+Sans:wght@400;600;700",
    "family=Space+Grotesk:wght@400;600;700",
    "family=Oswald:wght@400;600;700",
    "family=Playfair+Display:wght@400;600;700",
    "family=Merriweather:wght@400;600;700",
    "family=Lora:wght@400;600;700",
    "family=Libre+Baskerville:wght@400;700",
    "family=Crimson+Text:wght@400;600;700",
    "family=PT+Serif:wght@400;700",
    "family=Bebas+Neue",
    "family=Anton",
    "family=Archivo+Black",
    "family=Pacifico",
    "family=Dancing+Script:wght@400;600;700",
    "family=Roboto+Mono:wght@400;600;700",
  ].join("&") +
  "&display=swap";
