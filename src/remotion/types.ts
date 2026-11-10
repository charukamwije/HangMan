import type { ThemeId } from "./themes";

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
  /** Urgent top banner shown from frame 0, e.g. "95% FAIL THIS". Empty → "GUESS THE WORD". */
  hookText: string;
  category: string;
  subtitle: string;
  word: string;
  /** Letter pre-filled on frame 0 (every occurrence). Empty → first letter of the word. */
  hintLetter: string;
  guesses: Guess[];
  /** Second at which any letters still hidden are revealed (usually when the clock hits 00:00). */
  finalRevealAt: number;
  themeId: ThemeId;
  audio: ReelAudioSettings;
  /** Preview-only overlay of platform UI safe zones. Forced off for renders. */
  showSafeZones: boolean;
};
