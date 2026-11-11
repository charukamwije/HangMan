/**
 * "Machine Gun" opening hook. Decoding fills the whole first second; the
 * target snap lands right after it (frames @ 30 fps).
 *
 *   Phase 1 · Decoding (0–30) — accelerating, synced to the tape-rewind audio
 *     0          banner "DECODING BOARD…" punches in, gavel + bass drop,
 *                the music bed starts REWINDING (reversed, speeding up 3× → 14×)
 *     0 → 26     decoys fire into the empty slots, gaps shrinking 4 → 1 frame, so the
 *                visual cadence accelerates with the rewind. Slots are revisited:
 *                a new decoy replaces the struck one. Each scrambles through cipher
 *                glyphs (scale 0 → 1.2 → 1), click each
 *     pop + 2    it locks on a noise letter and a crimson ✖ slams over it: board kick,
 *                red edge flash, click + thud
 *     0 → 30     scan beam ping-pongs across the board
 *     29 → 30    everything wiped; rewind hard-stops on 30 (also the first clock tick)
 *   Phase 2 · Target snap (30–42)
 *     30 → 35    banner flips to the hook text ("CAN YOU SOLVE IT?")
 *     ≤ 36       hint-letter slots snap in one frame apart, the LAST one always on 36
 *     36         metallic lock + hint key lights; the same music now plays FORWARD,
 *                fading in 36 → 42, its downbeats on the clock ticks
 *     42         regular reel; no guess may land before this frame
 *
 * Pure module (no React, no remotion import) so the Next.js control panel and
 * the render API can share it with the composition. Frame numbers are authored
 * at 30 fps and scaled with hookFrame() so pacing survives an fps change.
 *
 * Keep `clear` / `musicIn[0]` in sync with REWIND_SECONDS / MUSIC_START_FRAME_30
 * in scripts/generate-sfx.mjs.
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
  snapStart: 31,
  snapEnd: 36,
  banner: [30, 35],
  musicIn: [36, 42],
  end: 42,
} as const;

export const HOOK_INTRO_TEXT = "DECODING BOARD...";

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
  /** Final snap: metallic lock SFX + hint key lights up. */
  lockFrame: number;
  clearFrame: number;
  bannerFrames: readonly [number, number];
  musicInFrames: readonly [number, number];
  /** First frame of the regular reel; guesses never land before it. */
  endFrame: number;
};

const hash = (s: string) =>
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Accelerating pop schedule at 30 fps: 0, 4, 8, 11, 14, 16, … 26. */
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
export function resolveHook(word: string, hintLetter: string, fps: number): HookPlan {
  const F = (f: number) => hookFrame(f, fps);
  const chars = [...word];
  const clearFrame = F(HOOK_FRAMES_30.clear);

  // --- Phase 1: decoys cycling through evenly spread empty (non-hint) slots ---
  const empty = chars.flatMap((c, i) => (c !== " " && c !== hintLetter ? [i] : []));
  const count = Math.min(HOOK_FRAMES_30.maxSlots, empty.length);
  const slots = Array.from({ length: count }, (_, k) => empty[Math.floor(((k + 0.5) * empty.length) / count)]);
  // Zig-zag across the board so the eye is pulled side to side: 0, n-1, 1, n-2, …
  const zigzag = slots.map((_, k) => slots[k % 2 === 0 ? k / 2 : count - 1 - (k - 1) / 2]);
  // Rare "noise" letters (Q, Z, X, J …) that are not in the word, order shuffled per word.
  const pool = [...DECOY_LETTERS]
    .reverse()
    .filter((l) => !word.includes(l))
    .slice(0, 10)
    .sort((a, b) => hash(a + word) - hash(b + word));

  const decoys: HookDecoy[] = count
    ? decoyPopFrames30().map((pop, k) => ({
        id: `d${k}`,
        slot: zigzag[k % count],
        letter: pool[k % Math.max(1, pool.length)] ?? "X",
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

  // --- Phase 2: hint slots snap 1 frame apart, ending exactly on snapEnd ----
  const hintSlots = chars.flatMap((c, i) => (hintLetter && c === hintLetter ? [i] : []));
  const span = HOOK_FRAMES_30.snapEnd - HOOK_FRAMES_30.snapStart;
  const first = HOOK_FRAMES_30.snapEnd - Math.min(span, Math.max(0, hintSlots.length - 1));
  const snapFrames = new Map<number, number>();
  hintSlots.forEach((idx, k) => snapFrames.set(idx, F(Math.min(HOOK_FRAMES_30.snapEnd, first + k))));

  return {
    decoys,
    strikeFrames: decoys.filter((d) => d.strikeFrame < d.endFrame).map((d) => d.strikeFrame).sort((a, b) => a - b),
    snapFrames,
    lockFrame: F(HOOK_FRAMES_30.snapEnd),
    clearFrame,
    bannerFrames: [F(HOOK_FRAMES_30.banner[0]), F(HOOK_FRAMES_30.banner[1])],
    musicInFrames: [F(HOOK_FRAMES_30.musicIn[0]), F(HOOK_FRAMES_30.musicIn[1])],
    endFrame: F(HOOK_FRAMES_30.end),
  };
}
