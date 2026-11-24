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
  /** Top banner challenge text, legible from frame 0, e.g. "99% FAIL THIS". Empty → "GUESS THE WORD". */
  hookText: string;
  /**
   * Short challenge on the reel's top banner for the whole video, e.g. "99% FAIL THIS". Empty / missing
   * = DEFAULT_CHALLENGE. The longer `hookText` is the thumbnail / test-B frame-1 headline.
   */
  challenge?: string;
  /** Opening plate over the hint card (0–1.85 s). Empty / missing = "ONLY REAL FANS GET THIS IN 5 SECONDS". */
  questionLine?: string;
  /** Hint 1, shown from the start. */
  subtitle: string;
  /** Hint 2, replaces hint 1 at HINT2_AT_SECONDS (10 s). Empty or missing = hint 1 all the way. */
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
   * Video length in whole seconds (10–30, default 30). The video is cut there and loops back to
   * 0 s; the letter pattern keeps its 30 s timing (anything after the cut is not in the video).
   */
  durationSeconds?: number;
  /** Picture under public/ used instead of the shelf scene (e.g. "backgrounds/characters.jpg"). Empty / missing = shelves. */
  backgroundImage?: string;
};
