import type { ThemeId } from "./themes";

export type CtaStyle = "balloons" | "pops";

/** One guess on the timeline. Whether it is correct is derived from the word. */
export type Guess = { letter: string; time: number };

export type ReelAudioSettings = {
  enabled: boolean;
  music: number; // 0–1
  tick: number;
  sfx: number;
};

/** Serializable input props for the composition (Player, CLI --props, API route). */
export type ReelProps = {
  /** Top banner challenge text, legible from frame 0, e.g. "99% FAIL THIS". Empty → "GUESS THE WORD". */
  hookText: string;
  /** Hint 1, shown from the start. */
  subtitle: string;
  /** Hint 2, replaces hint 1 at HINT2_AT_SECONDS (15 s). Empty or missing = hint 1 all the way. */
  hint2?: string;
  word: string;
  /** Letter pre-filled on frame 0 (every occurrence). Empty → first letter of the word. */
  hintLetter: string;
  /** Second letter pre-filled on frame 0. Empty / missing → the first correct guess (see resolveSecondLetter). */
  secondLetter?: string;
  /**
   * A/B test: how viewers are asked to like / subscribe.
   *   "balloons" (A, default): Like + Subscribe balloon clusters on the hook banner.
   *   "pops" (B): no balloons; LIKE then SUBSCRIBE pop once each on a paint splat as the last two
   *               highlighted beats before the reveal (guesses re-spaced to fit).
   */
  ctaStyle?: CtaStyle;
  guesses: Guess[];
  /** Second at which any letters still hidden are revealed (usually when the clock hits 00:00). */
  finalRevealAt: number;
  themeId: ThemeId;
  audio: ReelAudioSettings;
  /** Preview-only overlay of platform UI safe zones. Forced off for renders. */
  showSafeZones: boolean;
  /** Picture under public/ used instead of the shelf scene (e.g. "backgrounds/characters.jpg"). Empty / missing = shelves. */
  backgroundImage?: string;
};
