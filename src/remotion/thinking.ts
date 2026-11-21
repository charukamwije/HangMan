/**
 * "Thinking" beat: before each guess a cursor hops over 2–3 idle keys, as if a
 * player is choosing, and lands on the guessed letter just before the whoosh.
 * Fills the stillness between beats so something changes about every second.
 *
 * Pure module (no React / remotion import), deterministic per word.
 *
 *   regular guess at G     hops at G − 0.9 s, G − 0.65 s, final (target) at G − 0.4 s
 *   first guess (frame 60) hops on hook frames 36, 43, final on 50 (after the music
 *                          handover, landing as the whoosh starts on 51)
 *
 * A hop never lands on a used key (lit / struck at that frame), the hint letter or
 * the target (except the final hop), and early hops are dropped when the previous
 * guess is too recent (its close-up is still on screen).
 */
import { KEY_ROWS } from "./constants";
import { hookFrame } from "./hook";
import type { Timeline } from "./timeline";

export type Hop = {
  frame: number;
  letter: string;
  /** Last hop of a run: it is the guessed letter and stays lit until `until` (the impact). */
  final: boolean;
  /** Frame the cursor leaves this key (next hop, or the impact for the final hop). */
  until: number;
};

/** Seconds before impact for each hop of a regular run (last = the target). */
const HOP_LEADS = [0.9, 0.65, 0.4];
/** First guess: hook frames @ 30 fps (relative to the first guess on hook frame 60). */
const FIRST_HOPS_30 = [36, 43, 50];
/** Early hops must land at least this long after the previous guess. */
const MIN_AFTER_PREV = 0.75;
/** The final hop needs at least this much room after the previous guess. */
const MIN_FINAL_AFTER_PREV = 0.45;
/** Decoy hops are picked among the nearest N idle keys to the target. */
const NEAREST = 7;

const POS = new Map<string, { r: number; c: number }>();
KEY_ROWS.forEach((row, r) => [...row].forEach((l, c) => POS.set(l, { r, c: c + (row.length < 7 ? 0.5 : 0) })));
const dist = (a: string, b: string) => {
  const p = POS.get(a)!;
  const q = POS.get(b)!;
  return Math.hypot(p.r - q.r, p.c - q.c);
};

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

export function thinkingHops(
  timeline: Pick<Timeline, "word" | "guesses" | "hintLetter" | "correctKeyFrames" | "wrongKeyFrames" | "finalRevealFrame">,
  fps: number,
): Hop[] {
  const hops: Hop[] = [];
  const used = (l: string, f: number) =>
    l === timeline.hintLetter || (timeline.correctKeyFrames.get(l) ?? Infinity) <= f || (timeline.wrongKeyFrames.get(l) ?? Infinity) <= f;
  const hookEnd = hookFrame(60, fps);

  timeline.guesses.forEach((g, i) => {
    if (g.frame >= timeline.finalRevealFrame) return;
    const prev = i > 0 ? timeline.guesses[i - 1].frame : -Infinity;
    const frames =
      i === 0 && g.frame < hookEnd + Math.round(0.9 * fps)
        ? FIRST_HOPS_30.map((f) => hookFrame(f, fps) + (g.frame - hookEnd))
        : HOP_LEADS.map((s) => g.frame - Math.round(s * fps));
    const run: { frame: number; letter: string; final: boolean }[] = [];
    frames.forEach((f, k) => {
      const final = k === frames.length - 1;
      if (f < 0 || f <= prev + Math.round((final ? MIN_FINAL_AFTER_PREV : MIN_AFTER_PREV) * fps)) return;
      if (final) {
        run.push({ frame: f, letter: g.letter, final: true });
        return;
      }
      const last = run.length ? run[run.length - 1].letter : undefined;
      const pool = [...POS.keys()]
        .filter((l) => l !== g.letter && l !== last && !used(l, f))
        .sort((a, b) => dist(a, g.letter) - dist(b, g.letter) || a.localeCompare(b))
        .slice(0, NEAREST);
      if (pool.length) run.push({ frame: f, letter: pool[hash(`${timeline.word}-${g.letter}-${k}`) % pool.length], final: false });
    });
    run.forEach((h, k) => hops.push({ ...h, until: k + 1 < run.length ? run[k + 1].frame : g.frame }));
  });
  return hops;
}

/**
 * Cursor glow on `letter` at `frame` (0..1): snaps on over 2 frames, holds while the
 * cursor sits there, and leaves a short 5-frame trail when it moves on (decoy hops only;
 * the final hop hands straight over to the key's impact pop).
 */
export function hopGlow(hops: readonly Hop[], letter: string, frame: number): number {
  let best = 0;
  for (const h of hops) {
    if (h.letter !== letter || frame < h.frame) continue;
    if (frame < h.until) best = Math.max(best, Math.min(1, 0.6 + 0.2 * (frame - h.frame)));
    else if (!h.final && frame < h.until + 5) best = Math.max(best, 1 - (frame - h.until) / 5);
  }
  return best;
}
