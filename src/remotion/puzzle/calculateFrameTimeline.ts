/**
 * Puzzle → frame-exact timeline → composition props.
 *
 * The math (all at `fps`, 30 by default, so D = 900 frames):
 *
 *   frames 0–60              opening hook (hook.ts): prefilled letter locks on 4, pattern interrupt on 30, first guess on 60
 *   frame F₁ = 2.0 s · fps   first guess
 *   Fₙ = F₁ + (n − 1) · S    S = step snapped to 0.1 s, 2.0 s ≤ S ≤ 2.5 s
 *                            (60–75 frames), chosen as the widest step that
 *                            fits all guesses before  R − 2.5 s
 *   R  = 29 s · fps = 870    final reveal: the clock reads 00:00
 *   R + k · s                hidden letters pop in, s = min(fps/12, ⌊(D − 1 − R)/(h − 1)⌋)
 *                            so the last pop is ≤ D − 1 = 899
 *
 * Too many guesses for the grid → the rarest correct letters move to the final
 * reveal and surplus misses are dropped. Too few → held-back letters are
 * released first, then plausible decoy misses are added (max 6 mistakes).
 * Every returned frame is an integer in [0, D − 1].
 */
import { COUNTDOWN_ENDS_AT, DURATION_SECONDS } from "../constants";
import { DEFAULT_INPUT, DEFAULT_REEL_PROPS } from "../defaults";
import { HOOK_FRAMES_30, hookFrame } from "../hook";
import { autoSchedule, normalizeWord, resolveHintLetter, resolveTimeline } from "../timeline";
import type { Guess, ReelProps } from "../types";
import type { FrameTimeline, HangmanPuzzleData, RevealEvent } from "./types";

const STATUS_ORDER: Record<RevealEvent["status"], number> = { prefilled: 0, correct: 1, wrong: 1, final: 2 };

export function calculateFrameTimeline(puzzle: HangmanPuzzleData, fps = 30): FrameTimeline {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`fps must be a positive number, got ${fps}`);
  const word = normalizeWord(puzzle.secretWord);
  if (!word) throw new Error("secretWord must contain at least one letter");

  const durationInFrames = Math.round(DURATION_SECONDS * fps);
  const finalRevealFrame = Math.round(COUNTDOWN_ENDS_AT * fps);
  const letters = new Set(word.replace(/ /g, ""));
  const warnings: string[] = [];

  const prefilledLetter = resolveHintLetter(word, puzzle.prefilledLetter ?? "");
  if (puzzle.prefilledLetter && puzzle.prefilledLetter.toUpperCase() !== prefilledLetter) {
    warnings.push(`prefilledLetter "${puzzle.prefilledLetter}" is not in the word; using "${prefilledLetter}".`);
  }
  const wrongGuesses = [...new Set(puzzle.wrongGuesses.map((l) => l.toUpperCase()))];
  const misplaced = wrongGuesses.filter((l) => letters.has(l));
  if (misplaced.length) warnings.push(`wrongGuesses ${misplaced.join(", ")} are in "${word}" and were ignored.`);

  // ---- 1. Guess frames: hand-authored or auto beat grid -------------------
  const manual = puzzle.revealSequence.filter((e) => e.status === "correct" || e.status === "wrong");
  const mode: FrameTimeline["mode"] = manual.length ? "manual" : "auto";
  let guesses: Guess[];

  if (mode === "manual") {
    const seen = new Set<string>([prefilledLetter]);
    guesses = [];
    for (const e of [...manual].sort((a, b) => a.frame - b.frame)) {
      const l = e.letter.toUpperCase();
      if (seen.has(l)) {
        warnings.push(`revealSequence: duplicate or prefilled letter "${l}" at frame ${e.frame} skipped.`);
        continue;
      }
      seen.add(l);
      const actual = letters.has(l) ? "correct" : "wrong";
      if (actual !== e.status) warnings.push(`revealSequence: "${l}" is ${actual}, not ${e.status}.`);
      // Guesses must land after the opening hook and before the reveal (a late correct letter would just merge into it).
      const frame = Math.max(hookFrame(HOOK_FRAMES_30.end, fps), Math.min(finalRevealFrame - 1, Math.round(e.frame)));
      if (frame !== e.frame) warnings.push(`revealSequence: "${l}" moved from frame ${e.frame} to ${frame}.`);
      guesses.push({ letter: l, time: frame / fps });
    }
  } else {
    guesses = autoSchedule({
      word,
      hintLetter: prefilledLetter,
      wrongLetters: wrongGuesses,
      holdBack: puzzle.holdBack ?? DEFAULT_INPUT.holdBack,
      finalRevealAt: COUNTDOWN_ENDS_AT,
    });
    const added = guesses.filter((g) => !letters.has(g.letter) && !wrongGuesses.includes(g.letter)).map((g) => g.letter);
    if (added.length) warnings.push(`Added decoy misses ${added.join(", ")} to keep a beat every 2–2.5 s.`);
  }

  // ---- 2. Composition props -------------------------------------------------
  const reelProps: ReelProps = {
    hookText: puzzle.viralHookText,
    subtitle: puzzle.hint,
    hint2: puzzle.hint2 ?? "",
    word,
    hintLetter: prefilledLetter,
    guesses,
    finalRevealAt: finalRevealFrame / fps,
    themeId: puzzle.themeId ?? DEFAULT_REEL_PROPS.themeId,
    audio: { ...DEFAULT_REEL_PROPS.audio, ...puzzle.audio },
    showSafeZones: false,
  };

  // ---- 3. Resolve with the same engine the composition renders with --------
  const tl = resolveTimeline(reelProps, fps);
  const revealSequence: RevealEvent[] = [];
  if (prefilledLetter) revealSequence.push({ frame: tl.hook.lockFrame, letter: prefilledLetter, status: "prefilled" });
  for (const g of tl.guesses) {
    if (g.kind === "wrong") revealSequence.push({ frame: g.frame, letter: g.letter, status: "wrong" });
    else if (g.frame < tl.finalRevealFrame) revealSequence.push({ frame: g.frame, letter: g.letter, status: "correct" });
  }
  for (const [letter, frame] of tl.correctKeyFrames) {
    if (frame >= tl.finalRevealFrame) revealSequence.push({ frame, letter, status: "final" });
  }
  revealSequence.sort((a, b) => a.frame - b.frame || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  // ---- 4. Hard bounds: nothing may fall outside the 900-frame reel -----------
  const out = revealSequence.find((e) => !Number.isInteger(e.frame) || e.frame < 0 || e.frame > durationInFrames - 1);
  if (out) throw new Error(`Timeline out of bounds: ${out.letter} at frame ${out.frame} (reel is ${durationInFrames} frames).`);

  return { fps, durationInFrames, word, prefilledLetter, finalRevealFrame: tl.finalRevealFrame, revealSequence, mode, warnings, reelProps };
}

/** Shorthand when only the composition props are needed. */
export const puzzleToReelProps = (puzzle: HangmanPuzzleData, fps = 30): ReelProps => calculateFrameTimeline(puzzle, fps).reelProps;
