import { DEFAULT_HOOK_TEXT } from "./constants";
import { autoSchedule } from "./timeline";
import type { ReelProps } from "./types";

export const DEFAULT_INPUT = {
  hookText: DEFAULT_HOOK_TEXT,
  category: "GLOBAL LANDMARKS & GEOGRAPHY",
  subtitle: "A TRICKY US & UK CHALLENGE WORD",
  word: "LANDMARKS",
  hintLetter: "",
  wrongLetters: "B, W, X, Q",
  holdBack: 2,
  finalRevealAt: 29,
};

export const DEFAULT_REEL_PROPS: ReelProps = {
  hookText: DEFAULT_INPUT.hookText,
  category: DEFAULT_INPUT.category,
  subtitle: DEFAULT_INPUT.subtitle,
  word: DEFAULT_INPUT.word,
  hintLetter: DEFAULT_INPUT.hintLetter,
  guesses: autoSchedule({
    word: DEFAULT_INPUT.word,
    wrongLetters: ["B", "W", "X", "Q"],
    holdBack: DEFAULT_INPUT.holdBack,
    finalRevealAt: DEFAULT_INPUT.finalRevealAt,
    hintLetter: DEFAULT_INPUT.hintLetter,
  }),
  finalRevealAt: DEFAULT_INPUT.finalRevealAt,
  themeId: "dark-academia",
  audio: { enabled: true, music: 0.32, tick: 0.45, sfx: 0.9 },
  showSafeZones: false,
};
