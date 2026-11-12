export type ThemeId = "dark-academia" | "midnight-noir" | "emerald-library";

export type Theme = {
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

export const THEMES: Record<ThemeId, Theme> = {
  "dark-academia": {
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
  "emerald-library": {
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
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const getTheme = (id: ThemeId | string): Theme => THEMES[id as ThemeId] ?? THEMES["dark-academia"];
