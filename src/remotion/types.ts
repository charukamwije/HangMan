import type { ThemeId } from "./themes";


export type OpeningStyle = "standard" | "giant";

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
  guesses: Guess[];
  /** Second at which any letters still hidden are revealed (usually when the clock hits 00:00). */
  finalRevealAt: number;
  themeId: ThemeId;
  audio: ReelAudioSettings;
  /** Preview-only overlay of platform UI safe zones. Forced off for renders. */
  showSafeZones: boolean;
  /**
   * A/B test, frame 1: "standard" (A, default) = the current opening; "giant" (B) = a giant
   * spelling-challenge title card (the banner text + "N LETTERS · 29 SECONDS") over a dimmed stage
   * that flies up into the banner after `giantHookSeconds`.
   */
  openingStyle?: OpeningStyle;
  /** Test B: how long (s) the giant hook stays up before it flies into the banner. Default 0.25. */
  giantHookSeconds?: number;
  /**
   * Video length in whole seconds (10–30, default 30). The video is cut there and loops back to
   * 0 s; the letter pattern keeps its 30 s timing (anything after the cut is not in the video).
   */
  durationSeconds?: number;
  /** Picture under public/ used instead of the shelf scene (e.g. "backgrounds/characters.jpg"). Empty / missing = shelves. */
  backgroundImage?: string;
};
