/**
 * Opening hook: a CLEAN, readable board from frame 0, so the viewer gets "I can solve this"
 * at the moment they decide to stay (frames @ 30 fps).
 *
 *   0          the challenge banner ("99% FAIL THIS") is already up and slams in at full
 *              scale, gavel + slap pop, and the music bed starts playing FORWARD with its
 *              beat on the clock ticks (no reversed burst, no near-silent gap). The pre-filled letters
 *              (the hint + one or two more) are seated; every other slot is a clean blank.
 *              The clue is sharp but covered by the question line ("ONLY REAL FANS…"); the
 *              keyboard is up, and so is the 00:29 clock with "COMMENT BEFORE 0:00" under it
 *              (ticking from frame 0); only the pawns are still hidden
 *   0 → 30     ONE smooth camera zoom-in on the board; the empty slots pulse (accent
 *              outline + glow, ~2 Hz) until the first guess. No decoy letters, no red
 *              flashes, no glitch glyphs: nothing that makes the board look broken
 *   30         first clock tick: banner re-slam, hint re-flash, slap pop
 *   48 → 60    the zoom eases back out before the first guess
 *   84 → 93    the question line (the joke / challenge, held ~3 s) clears; hint 1 comes in word by word
 *   60         regular reel: the first guess slams down (no guess may land before this
 *              frame); pawns fade in 60 → 72
 *
 * Pure module (no React, no remotion import) so the Next.js control panel and
 * the render API can share it with the composition. Frame numbers are authored
 * at 30 fps and scaled with hookFrame() so pacing survives an fps change.
 *
 * Keep `clear` / `musicIn[0]` / the pop schedule in sync with REWIND_SECONDS /
 * MUSIC_START_FRAME_30 / hookDecode() in scripts/generate-sfx.mjs.
 */
import { DECOY_LETTERS } from "./constants";

export const HOOK_FRAMES_30 = {
  /** Last decoy pops by this frame (so its strike lands before the clear). */
  lastPop: 26,
  /** Gap between pops eases from firstGap → lastGap frames across 0 → lastPop. */
  firstGap: 4,
  lastGap: 1,
  /** Distinct empty slots used (decoys cycle through them). */
  maxSlots: 8,
  strikeDelay: 2,
  clear: 30,
  /** Hint (first correct) letter snaps in right away, among the scrambling decoys; snapEnd is the lock. */
  snapStart: 0,
  snapEnd: 4,
  /** Pattern interrupt on the first clock tick (camera kick, flash, banner re-slam). */
  pulse: 30,
  /** Ghost-glyph rattle in the empty slots, cut just before the first guess. */
  rattle: [30, 57],
  /** Music bed: forward from frame 0 (a 3-frame fade-in under the gavel), the beat on the clock ticks. */
  musicIn: [0, 3],
  end: 60,
} as const;

/** The question line over the hint card on frame 0. */
export const QUESTION_LINE = "ONLY REAL FANS GET THIS IN 5 SECONDS";

/** Hook UI beats, in seconds. */
export const HOOK_UI_TIMING = {
  /**
   * The question line clears before the first guess (2.0 s): its text fades first, then the empty plate
   * settles into the hint card; hint 1 then reveals word by word from the end of this window.
   */
  questionOut: [2.8, 3.1],
  /** Clock: up and ticking from frame 0 (a visible countdown is a strong reason to stay). */
  timerIn: [0, 0],
  /** Balloons + pawns fade-in (the first guess lands on 2.0 s). */
  uiIn: [2.0, 2.4],
  /** "COMMENT BEFORE 0:00" in (frame 0) / out. */
  ctaIn: [0, 0],
  ctaOut: [5.7, 6.0],
} as const;

/** Clean opening (no decoys / red strike flashes / ghost glyphs in the first 2 s). */
export const CLEAN_OPENING = true;

/** A 30 fps hook frame expressed at `fps`. */
export const hookFrame = (f: number, fps: number) => Math.round((f * fps) / 30);

export type HookDecoy = {
  /** Unique per decoy (stable React key / cue id). */
  id: string;
  /** Character index into the (normalized) word. */
  slot: number;
  letter: string;
  popFrame: number;
  strikeFrame: number;
  /** First frame it is gone: the next decoy in the same slot pops, or the clear. */
  endFrame: number;
};

export type HookPlan = {
  decoys: HookDecoy[];
  /** Every ✖ frame, sorted (board kick + red flash). */
  strikeFrames: number[];
  /** Character index → frame that hint-letter slot snaps in. */
  snapFrames: Map<number, number>;
  /** Frame the pre-filled keys count as lit: negative (already lit on frame 0). Without pre-filled letters, the lock snap. */
  lockFrame: number;
  clearFrame: number;
  /** Pattern-interrupt frame (first clock tick). */
  pulseFrame: number;
  /** [from, to): ghost-glyph rattle in the still-empty slots. */
  rattleFrames: readonly [number, number];
  musicInFrames: readonly [number, number];
  /** First frame of the regular reel; guesses never land before it. */
  endFrame: number;
  /**
   * Letters already seated in their slots on frame 0 (the hint + a second one).
   * The decoys still scramble the other slots. Empty = the hint snaps in on frame 4.
   */
  prefilled: string[];
};

const hash = (s: string) =>
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * Accelerating pop schedule at 30 fps: 0, 4, 8, 11, 14, 16, … 26.
 * Mirrored by hookDecode() in scripts/generate-sfx.mjs (the pre-mixed decode SFX) — keep in sync.
 */
export function decoyPopFrames30(): number[] {
  const { lastPop, firstGap, lastGap } = HOOK_FRAMES_30;
  const pops: number[] = [];
  for (let t = 0; t <= lastPop; ) {
    pops.push(t);
    t += Math.max(lastGap, Math.round(firstGap + (lastGap - firstGap) * (t / lastPop)));
  }
  return pops;
}

/**
 * Deterministic hook plan for a word. `word` must already be normalized
 * (uppercase A–Z + single spaces) and `hintLetter` resolved (see timeline.ts).
 */
export function resolveHook(word: string, hintLetter: string, fps: number, { prefill = [] }: { prefill?: string[] } = {}): HookPlan {
  const F = (f: number) => hookFrame(f, fps);
  const chars = [...word];
  const clearFrame = F(HOOK_FRAMES_30.clear);

  // --- Phase 1: decoys cycling through evenly spread empty (non-hint) slots ---
  const prefilled = prefill.length ? [...new Set([hintLetter, ...prefill].filter((l) => l && chars.includes(l)))] : [];
  const empty = chars.flatMap((c, i) => (c !== " " && c !== hintLetter && !prefilled.includes(c) ? [i] : []));
  const count = Math.min(HOOK_FRAMES_30.maxSlots, empty.length);
  const slots = Array.from({ length: count }, (_, k) => empty[Math.floor(((k + 0.5) * empty.length) / count)]);
  // Zig-zag across the board so the eye is pulled side to side: 0, n-1, 1, n-2, …
  const zigzag = slots.map((_, k) => slots[k % 2 === 0 ? k / 2 : count - 1 - (k - 1) / 2]);
  // Decoys use the ANSWER's own letters (shuffled per word), but never the slot's correct letter,
  // so the scramble teases the answer without giving any position away.
  const answerLetters = [...new Set(chars.filter((c) => c !== " "))].sort((a, b) => hash(a + word) - hash(b + word));
  const decoyLetter = (slot: number, k: number) => {
    const options = answerLetters.filter((l) => l !== chars[slot]);
    const fallback = [...DECOY_LETTERS].find((l) => l !== chars[slot]) ?? "X"; // single-letter words
    return options.length ? options[(k + hash(`${word}-${slot}`)) % options.length] : fallback;
  };

  // Clean opening: decoy letters are no longer fired into the empty slots (they made the board read as
  // a glitch, "DQ_I_G", right when the viewer decides). Kept behind CLEAN_OPENING for an easy A/B back.
  const decoys: HookDecoy[] = count && !CLEAN_OPENING
    ? decoyPopFrames30().map((pop, k) => ({
        id: `d${k}`,
        slot: zigzag[k % count],
        letter: decoyLetter(zigzag[k % count], k),
        popFrame: F(pop),
        strikeFrame: F(pop + HOOK_FRAMES_30.strikeDelay),
        endFrame: clearFrame,
      }))
    : [];
  // A slot's decoy ends when the next one lands in that slot.
  decoys.forEach((d, k) => {
    const next = decoys.slice(k + 1).find((n) => n.slot === d.slot);
    if (next) d.endFrame = next.popFrame;
  });

  // --- Hint slots snap 1 frame apart mid-decode, ending exactly on snapEnd ----
  const hintSlots = chars.flatMap((c, i) => (hintLetter && c === hintLetter ? [i] : []));
  const span = HOOK_FRAMES_30.snapEnd - HOOK_FRAMES_30.snapStart;
  const first = HOOK_FRAMES_30.snapEnd - Math.min(span, Math.max(0, hintSlots.length - 1));
  const snapFrames = new Map<number, number>();
  // Pre-filled: the snap is set far enough in the past that frame 0 shows the letters seated, no flash.
  const seated = -2 * fps;
  if (prefilled.length) chars.forEach((c, idx) => prefilled.includes(c) && snapFrames.set(idx, seated));
  else hintSlots.forEach((idx, k) => snapFrames.set(idx, F(Math.min(HOOK_FRAMES_30.snapEnd, first + k))));

  return {
    decoys,
    strikeFrames: decoys.filter((d) => d.strikeFrame < d.endFrame).map((d) => d.strikeFrame).sort((a, b) => a - b),
    snapFrames,
    lockFrame: prefilled.length ? seated : F(HOOK_FRAMES_30.snapEnd),
    clearFrame,
    pulseFrame: F(HOOK_FRAMES_30.pulse),
    rattleFrames: [F(HOOK_FRAMES_30.rattle[0]), F(HOOK_FRAMES_30.rattle[1])],
    musicInFrames: [F(HOOK_FRAMES_30.musicIn[0]), F(HOOK_FRAMES_30.musicIn[1])],
    endFrame: F(HOOK_FRAMES_30.end),
    prefilled,
  };
}
