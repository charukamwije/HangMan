export type ThemeId =
  | "dark-academia"
  | "midnight-noir"
  | "seoul-blossom"
  | "emerald-library"
  | "ivory-hall"
  | "morning-study"
  | "sage-garden";

export type ThemeMode = "dark" | "light";

/** Scene surfaces that depend on whether the room is dark or light (panels, keys, slots, shading). */
type Surface = {
  mode: ThemeMode;
  /** Text colour on accent-filled chips and keys. */
  onAccent: string;
  /** "r,g,b" used for drop/text shadows, dims and vignettes. */
  shade: string;
  /** Strength multiplier for vignettes, dims and drop shadows (1 = full cinematic dark). */
  vignette: number;
  /** Strength multiplier for neon glows around accent letters. */
  glow: number;
  /** Blend mode for full-frame flashes and blooms (screen vanishes on light scenes). */
  glowBlend: "screen" | "multiply";
  /** Overlay over the bookshelf so UI text reads (top → bottom). */
  backdropShade: string;
  /** Shelf plank gradient. */
  shelfFrame: string;
  /** Header card + keyboard tray glass (top, bottom). */
  panel: [string, string];
  panelBorder: string;
  key: { bg: string; border: string; text: string; shadow: string };
  usedKey: { bg: string; text: string };
  slotBg: string;
  /** "r,g,b" of the empty-slot outline. */
  emptyRgb: string;
  /** Light themes only: the sunlit window-wall backdrop (<LightRoom>). Dark themes use the library. */
  room: { sky: [string, string]; trim: string; foliage: string };
};

export type Theme = Surface & {
  id: ThemeId;
  name: string;
  /** "HINT" label, timer, slot outlines, revealed letters. */
  accent: string;
  text: string;
  wrong: string;
  /** Background wood gradient (top → bottom). */
  wood: [string, string, string];
  /** Warm focal lamp colour. */
  lamp: string;
  /** Book spine palette for the shelves. */
  books: string[];
  piece: string;
};

const DARK: Surface = {
  mode: "dark",
  onAccent: "#0b0b05",
  shade: "0,0,0",
  vignette: 1,
  glow: 1,
  glowBlend: "screen",
  backdropShade:
    "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 22%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.78) 75%, rgba(0,0,0,0.88) 100%)",
  shelfFrame: "linear-gradient(180deg, #4a2c17 0%, #2a170b 60%, #120904 100%)",
  panel: ["rgba(12,11,8,0.78)", "rgba(4,4,3,0.86)"],
  panelBorder: "rgba(255,255,255,0.10)",
  key: {
    bg: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
    border: "rgba(255,255,255,0.20)",
    text: "#FFFFFF",
    shadow: "0 4px 12px rgba(0,0,0,0.6)",
  },
  usedKey: { bg: "rgba(0,0,0,0.35)", text: "rgba(255,255,255,0.10)" },
  slotBg: "linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55))",
  emptyRgb: "255,255,255",
  room: { sky: ["#000000", "#000000"], trim: "#000000", foliage: "#000000" },
};

const LIGHT: Surface = {
  mode: "light",
  onAccent: "#FFFFFF",
  shade: "60,40,20",
  vignette: 0.3,
  glow: 0.35,
  glowBlend: "multiply",
  backdropShade:
    "linear-gradient(180deg, rgba(255,250,240,0.12) 0%, rgba(255,250,240,0.05) 22%, rgba(255,250,240,0.14) 38%, rgba(255,250,240,0.22) 55%, rgba(255,250,240,0.3) 75%, rgba(255,250,240,0.35) 100%)",
  shelfFrame: "linear-gradient(180deg, #c9a274 0%, #a8804f 60%, #7d5a33 100%)",
  panel: ["rgba(255,251,243,0.86)", "rgba(246,238,224,0.92)"],
  panelBorder: "rgba(60,40,20,0.14)",
  key: {
    bg: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(244,236,222,0.95))",
    border: "rgba(60,40,20,0.22)",
    text: "#1b140e",
    shadow: "0 2px 0 rgba(255,255,255,0.7)",
  },
  usedKey: { bg: "rgba(60,40,20,0.08)", text: "rgba(27,20,14,0.18)" },
  slotBg: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(240,230,212,0.88))",
  emptyRgb: "60,40,20",
  room: { sky: ["#cfe3f2", "#f6efe0"], trim: "#fbf7ef", foliage: "#8fae7c" },
};

export const THEMES: Record<ThemeId, Theme> = {
  "dark-academia": {
    ...DARK,
    id: "dark-academia",
    name: "Queen's Gambit Dark Academia",
    accent: "#DFFF00",
    text: "#FFFFFF",
    wrong: "#FF2E2E",
    wood: ["#1b0f08", "#120a05", "#070403"],
    lamp: "#ffb25e",
    books: ["#4a1d14", "#2f2a1a", "#5b3a1e", "#1f2b22", "#3d1f2b", "#6b4a26", "#24180f"],
    piece: "#e9dcc4",
  },
  "midnight-noir": {
    ...DARK,
    id: "midnight-noir",
    name: "Midnight Noir Chess Club",
    accent: "#CCFF00",
    text: "#FFFFFF",
    wrong: "#FF2E2E",
    wood: ["#0d1018", "#080a10", "#030406"],
    lamp: "#9cc4ff",
    books: ["#1b2233", "#2b2f3d", "#13283a", "#30243a", "#1e1e24", "#2d3a4f"],
    piece: "#dfe6f2",
  },
  // Seoul at night under cherry blossoms: indigo sky, warm gold highlights, pink blossom glow
  // (the lamp / dust colour, so the floating motes read as petals) and a rose-red for misses.
  "seoul-blossom": {
    ...DARK,
    id: "seoul-blossom",
    name: "Seoul Cherry Blossom Night",
    accent: "#FFC94A",
    onAccent: "#1c1206",
    text: "#FFF6EA",
    wrong: "#FF3D6E",
    shade: "6,4,22",
    wood: ["#1b1745", "#100d2e", "#06051a"],
    lamp: "#ff9cc8",
    books: ["#2a2358", "#3b2a5e", "#5a2e5c", "#1e2a55", "#6b3a6e", "#2e1f45", "#4a2f6b"],
    shelfFrame: "linear-gradient(180deg, #3a2552 0%, #221638 60%, #0e0a1d 100%)",
    backdropShade:
      "linear-gradient(180deg, rgba(8,6,28,0.45) 0%, rgba(8,6,28,0.22) 22%, rgba(8,6,28,0.42) 38%, rgba(8,6,28,0.56) 55%, rgba(8,6,28,0.74) 75%, rgba(8,6,28,0.86) 100%)",
    panel: ["rgba(24,18,58,0.80)", "rgba(10,8,30,0.88)"],
    panelBorder: "rgba(255,156,200,0.18)",
    key: {
      bg: "linear-gradient(180deg, rgba(255,214,235,0.12), rgba(255,214,235,0.04))",
      border: "rgba(255,190,220,0.24)",
      text: "#FFF6EA",
      shadow: "0 4px 12px rgba(6,4,22,0.65)",
    },
    usedKey: { bg: "rgba(6,4,22,0.4)", text: "rgba(255,246,234,0.12)" },
    slotBg: "linear-gradient(180deg, rgba(12,8,34,0.35), rgba(6,4,22,0.62))",
    emptyRgb: "255,214,235",
    piece: "#fde7f0",
  },
  "emerald-library": {
    ...DARK,
    id: "emerald-library",
    name: "Emerald Reading Room",
    accent: "#DFFF00",
    text: "#FFFFFF",
    wrong: "#FF2E2E",
    wood: ["#0d1a12", "#08110b", "#030604"],
    lamp: "#ffd48a",
    books: ["#1d3b27", "#4a2a17", "#2b2416", "#0f2a22", "#5a3d1c", "#33251a"],
    piece: "#efe6cf",
  },
  "ivory-hall": {
    ...LIGHT,
    id: "ivory-hall",
    name: "Ivory Tournament Hall",
    accent: "#0E7A4B",
    text: "#1b140e",
    wrong: "#D61F1F",
    wood: ["#f4ead8", "#e6d6b8", "#cbb48c"],
    lamp: "#fff1c9",
    books: ["#b5654a", "#7a8f6a", "#c9a66b", "#5d7a8c", "#a8706b", "#8a6d4a", "#d4b88a"],
    piece: "#2a211b",
  },
  "morning-study": {
    ...LIGHT,
    id: "morning-study",
    name: "Morning Study",
    accent: "#1E3A8A",
    text: "#1b140e",
    wrong: "#D61F1F",
    wood: ["#f3eee4", "#dfd3bd", "#bfa98a"],
    lamp: "#ffe9b0",
    books: ["#6b7fa8", "#b08a5e", "#9a5a4a", "#8fa3a0", "#c7b08a", "#5e6b84"],
    shelfFrame: "linear-gradient(180deg, #d1b58e 0%, #b0915f 60%, #86673e 100%)",
    room: { sky: ["#bcd4ee", "#f3ecdf"], trim: "#f7f3ea", foliage: "#7f9c86" },
    piece: "#2b2522",
  },
  "sage-garden": {
    ...LIGHT,
    id: "sage-garden",
    name: "Sage Garden Club",
    accent: "#0F6E6E",
    room: { sky: ["#d9ead9", "#f4f1e2"], trim: "#f6f7ef", foliage: "#79a06a" },
    text: "#1b140e",
    wrong: "#C81E1E",
    wood: ["#eef1e6", "#d7dcc6", "#b3bb9c"],
    lamp: "#fff4d0",
    books: ["#7f9a72", "#c98b5a", "#a9b48a", "#6d7f63", "#d1a874", "#8c6f52"],
    piece: "#26302a",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const getTheme = (id: ThemeId | string): Theme => THEMES[id as ThemeId] ?? THEMES["midnight-noir"];

/** `rgba()` from the theme's "r,g,b" shade, with alpha scaled by its vignette strength. */
export const shadeA = (theme: Theme, alpha: number) => `rgba(${theme.shade},${(alpha * theme.vignette).toFixed(3)})`;
