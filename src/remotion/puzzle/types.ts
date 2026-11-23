/**
 * HangmanPuzzleData: the standard daily-puzzle payload for The Dark Board.
 * One JSON object = one 30 s reel. Used by the /api/render-reel route, the
 * `npm run batch` CLI, the HangmanPuzzle composition and the studio store.
 */
import type { ThemeId } from "../themes";
import type { OpeningStyle, ReelAudioSettings, ReelProps } from "../types";

/** What happens on a reveal frame. */
export type RevealStatus =
  /** Pre-filled on frame 0 (the hook's free letter). */
  | "prefilled"
  /** Guessed correctly: tiles reveal, key lights neon, typewriter + chime. */
  | "correct"
  /** Wrong guess: key strikes red, pawn falls, key box shakes, wood thud. */
  | "wrong"
  /** Never guessed; pops in at the final reveal (00:00). */
  | "final";

export interface RevealEvent {
  /** Frame at the timeline fps (0 … durationInFrames − 1). */
  frame: number;
  /** Single uppercase letter A–Z. */
  letter: string;
  status: RevealStatus;
}

// A `type` (not `interface`) so Remotion accepts it as composition props (Record<string, unknown>).
export type HangmanPuzzleData = {
  /** Optional slug for output file names, e.g. "2026-11-11". [A-Za-z0-9_-] only. */
  id?: string;
  /** Subtitle hint (white), e.g. "A TRICKY US & UK CHALLENGE WORD". */
  hint: string;
  /** Second hint, replaces `hint` at 10 s (blur out → chip flip → word-by-word reveal). "" = keep hint 1. */
  hint2: string;
  /** The answer. Letters and spaces, ≤ 36 chars. */
  secretWord: string;
  /** Letters the "player" gets wrong. Letters that are actually in the word are ignored. */
  wrongGuesses: string[];
  /**
   * Optional hand-authored timeline. Leave it empty to have
   * calculateFrameTimeline() build one on the 2.0–2.5 s beat grid. Only
   * "correct"/"wrong" entries are read; their status is re-derived from
   * the word, and prefilled/final entries are always computed.
   */
  revealSequence: RevealEvent[];
  /** Banner challenge text, shown from frame 0, e.g. "99% FAIL THIS". */
  viralHookText: string;
  /** Letter pre-filled on frame 0. Default: the word's first letter. */
  prefilledLetter?: string;
  /** Second letter pre-filled on frame 0. Default: the first correct guess (its beat is re-timed away). */
  secondPrefilledLetter?: string;
  /** Max correct letters saved for the final reveal (auto mode). Default 2. */
  holdBack?: number;
  /** A/B test, frame 1: "standard" (default) or "giant" (giant spelling-challenge hook). */
  openingStyle?: OpeningStyle;
  /** Test B: seconds the giant hook stays up. Default 0.25. */
  giantHookSeconds?: number;
  /** Video length (s): cut there and loop; the pattern keeps its 30 s timing. Default 30. */
  durationSeconds?: number;
  themeId?: ThemeId;
  audio?: Partial<ReelAudioSettings>;
};

export interface FrameTimeline {
  fps: number;
  /** Always exactly DURATION_SECONDS × fps (900 at 30 fps). */
  durationInFrames: number;
  /** Normalised answer (uppercase, single spaces). */
  word: string;
  prefilledLetter: string;
  /** Frame the clock hits 00:00 and hidden letters start popping in. */
  finalRevealFrame: number;
  /** Every letter event, sorted by frame, all inside [0, durationInFrames − 1]. */
  revealSequence: RevealEvent[];
  /** "manual" when the puzzle supplied its own correct/wrong frames. */
  mode: "auto" | "manual";
  /** Non-fatal adjustments (clamped frames, ignored letters…). */
  warnings: string[];
  /** Ready-to-render composition props (pass as inputProps to HangmanReel). */
  reelProps: ReelProps;
}
