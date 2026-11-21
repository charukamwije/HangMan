import { DEFAULT_HOOK_TEXT } from "./constants";
import { scheduleWithSecondLetter } from "./timeline";
import type { ReelProps } from "./types";

export const DEFAULT_INPUT = {
  hookText: DEFAULT_HOOK_TEXT,
  subtitle: "A TRICKY US & UK CHALLENGE WORD",
  hint2: "FAMOUS PLACES PEOPLE TRAVEL TO SEE",
  word: "LANDMARKS",
  hintLetter: "",
  // E first: the most common English letter missing at 4.4 s is the comment bait.
  wrongLetters: "E, B, W, X, Q",
  holdBack: 2,
  finalRevealAt: 29,
};

/** Default beat grid: the first correct guess becomes the second pre-filled letter, the rest re-timed. */
const DEFAULT_SCHEDULE = scheduleWithSecondLetter({
  word: DEFAULT_INPUT.word,
  wrongLetters: ["E", "B", "W", "X", "Q"],
  holdBack: DEFAULT_INPUT.holdBack,
  finalRevealAt: DEFAULT_INPUT.finalRevealAt,
  hintLetter: DEFAULT_INPUT.hintLetter,
});

export const DEFAULT_REEL_PROPS: ReelProps = {
  hookText: DEFAULT_INPUT.hookText,
  subtitle: DEFAULT_INPUT.subtitle,
  hint2: DEFAULT_INPUT.hint2,
  word: DEFAULT_INPUT.word,
  hintLetter: DEFAULT_INPUT.hintLetter,
  secondLetter: DEFAULT_SCHEDULE.secondLetter,
  guesses: DEFAULT_SCHEDULE.guesses,
  finalRevealAt: DEFAULT_INPUT.finalRevealAt,
  themeId: "midnight-noir",
  audio: { enabled: true, music: 0.32, tick: 0.45, sfx: 0.9 },
  showSafeZones: false,
};
