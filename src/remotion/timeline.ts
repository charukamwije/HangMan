/**
 * Pacing & automation engine. Pure functions only — shared by the Remotion
 * composition, the Next.js control panel, and the render API.
 */
import {
  AUTO_GAP_BEFORE_REVEAL,
  AUTO_START,
  BEAT_MAX,
  BEAT_MIN,
  COUNTDOWN_ENDS_AT,
  COUNTDOWN_FROM,
  DECOY_LETTERS,
  DURATION_SECONDS,
  MAX_LIVES,
  STRESS_BELOW_SECONDS,
} from "./constants";
import { resolveHook, type HookPlan } from "./hook";
import type { Guess, ReelProps } from "./types";

export type GuessKind = "correct" | "wrong";
export type ResolvedGuess = Guess & { frame: number; kind: GuessKind; index: number };

/** Uppercase, A–Z and single spaces only. */
export const normalizeWord = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();

/** "B, M, w x" → ["B","M","W","X"] (unique, order-preserving). */
export const parseLetters = (raw: string) => [...new Set(raw.toUpperCase().replace(/[^A-Z]/g, "").split(""))];

export const uniqueLetters = (word: string) => [...new Set(normalizeWord(word).replace(/ /g, "").split(""))];

/**
 * The letter pre-filled on frame 0. Uses the requested letter when it is in the
 * word, otherwise the word's first letter. "" only for an empty word.
 */
export const resolveHintLetter = (word: string, requested = "") => {
  const w = normalizeWord(word).replace(/ /g, "");
  const r = requested.toUpperCase().slice(0, 1);
  return r && w.includes(r) ? r : (w[0] ?? "");
};

const hash = (s: string) =>
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type AutoScheduleInput = {
  word: string;
  wrongLetters: string[];
  /** Max correct letters kept hidden until the final reveal (at least 1 is always kept when possible). */
  holdBack: number;
  finalRevealAt: number;
  /** Pre-filled letter (see resolveHintLetter); never scheduled as a guess. */
  hintLetter?: string;
  /** More letters already on the board at frame 0 (the second pre-filled letter); never scheduled. */
  prefilled?: string[];
  start?: number;
  /**
   * Keep every beat 2.0–2.5 s apart. When there are too few guesses to do that,
   * held-back letters are released first (down to one), then plausible decoy
   * misses are added (up to MAX_LIVES). Too many guesses → the rarest correct
   * letters move to the final reveal and surplus misses are dropped.
   */
  fillBeats?: boolean;
};

/**
 * Builds a guess sequence on a fixed beat grid: common letters first (they
 * reveal the most tiles), rarest letters held back for the 00:00 reveal, wrong
 * guesses interleaved evenly, one sequence change every 2.0–2.5 s.
 */
export function autoSchedule({
  word,
  wrongLetters,
  holdBack,
  finalRevealAt,
  hintLetter = "",
  prefilled = [],
  start = AUTO_START,
  fillBeats = true,
}: AutoScheduleInput): Guess[] {
  const w = normalizeWord(word).replace(/ /g, "");
  const hint = resolveHintLetter(w, hintLetter);
  const preset = new Set([hint, ...prefilled.map((l) => l.toUpperCase())]);
  const counts = new Map<string, number>();
  for (const c of w) if (!preset.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  const seed = String(hash(w));
  const ordered = [...counts.keys()].sort(
    (a, b) => counts.get(b)! - counts.get(a)! || hash(a + seed) - hash(b + seed),
  );

  const notInWord = (l: string) => !w.includes(l);
  let held = clamp(holdBack, 0, Math.max(0, ordered.length - 1));
  const wrong = wrongLetters.filter(notInWord);

  const end = Math.max(start, finalRevealAt - AUTO_GAP_BEFORE_REVEAL);
  const span = end - start;
  // Beat counts that keep the step inside [BEAT_MIN, BEAT_MAX].
  const maxBeats = Math.floor(span / BEAT_MIN + 1e-9) + 1;
  const minBeats = Math.min(maxBeats, Math.ceil(span / BEAT_MAX - 1e-9) + 1);
  const total = () => ordered.length - held + wrong.length;

  if (fillBeats) {
    // Too dense: push rare correct letters to the reveal, then drop surplus misses.
    while (total() > maxBeats && ordered.length - held > 1) held++;
    while (total() > maxBeats && wrong.length > 0) wrong.pop();
    // Too sparse: release held letters (keep one for the reveal), then add decoy misses.
    while (total() < minBeats && held > Math.min(1, ordered.length - 1)) held--;
    const decoys = [...DECOY_LETTERS].filter((l) => notInWord(l) && !wrong.includes(l));
    while (total() < minBeats && wrong.length < MAX_LIVES && decoys.length) wrong.push(decoys.shift()!);
  }

  const correct = ordered.slice(0, ordered.length - held);
  const seq = [
    ...correct.map((letter, i) => ({ letter, pos: (i + 0.5) / correct.length })),
    ...wrong.map((letter, i) => ({ letter, pos: (i + 1) / (wrong.length + 1) - 0.001 })),
  ].sort((a, b) => a.pos - b.pos);

  // Step snapped down to 0.1 s so every beat lands on an exact frame (3 frames @ 30 fps).
  const raw = seq.length > 1 ? span / (seq.length - 1) : 0;
  const step = seq.length > 1 ? clamp(Math.floor(raw * 10 + 1e-9) / 10, fillBeats ? BEAT_MIN : 0, fillBeats ? BEAT_MAX : Infinity) : 0;
  return seq.map((s, i) => ({ letter: s.letter, time: round1(start + step * i) }));
}

export type Timeline = {
  word: string;
  /** Snapped into place during the opening hook (see hook.ts), locked on frame 4. */
  hintLetter: string;
  /** Opening "machine gun" hook: decoys, hint snap frames, lock + music handover. */
  hook: HookPlan;
  guesses: ResolvedGuess[];
  /** Per character of `word`: frame it becomes visible (Infinity for spaces, hook snap frame for the hint). */
  charRevealFrames: number[];
  /** Per letter: frame its key lights up as correct (incl. hint + final reveal) / strikes as wrong. */
  correctKeyFrames: Map<string, number>;
  wrongKeyFrames: Map<string, number>;
  wrongFrames: number[];
  finalRevealFrame: number;
  /** Whether any letters are still hidden at the final reveal (drives the reveal sting). */
  hasFinalReveal: boolean;
  /** Frames at which the countdown display changes (for tick SFX + stress pulse). */
  tickFrames: number[];
};

/** Frames between letters popping in at the final reveal (~0.1 s at any fps). */
export const finalRevealStagger = (fps: number) => Math.max(1, Math.round(fps / 12));
/** @deprecated use finalRevealStagger(fps). Value at 30 fps. */
export const FINAL_REVEAL_STAGGER = 3;

/**
 * The second letter pre-filled on frame 0, next to the hint. `requested` wins when it is in
 * the word (and not the hint); otherwise the first correct guess before the reveal, otherwise
 * any other letter of the word. "" for a one-letter word.
 *
 * The store / batch path pick the first correct guess and then re-schedule WITHOUT it (see
 * scheduleWithSecondLetter), so its beat is not lost; with manual timing its guess is skipped.
 */
export function resolveSecondLetter(word: string, hintLetter: string, guesses: readonly Guess[], finalRevealAt: number, requested = ""): string {
  const w = normalizeWord(word).replace(/ /g, "");
  const r = requested.toUpperCase().slice(0, 1);
  if (r && r !== hintLetter && w.includes(r)) return r;
  const first = [...guesses]
    .filter((g) => g.time < finalRevealAt && g.letter.toUpperCase() !== hintLetter && w.includes(g.letter.toUpperCase()))
    .sort((a, b) => a.time - b.time)[0];
  return first?.letter.toUpperCase() ?? [...w].find((c) => c !== hintLetter) ?? "";
}

/**
 * Auto schedule with a second pre-filled letter: schedule once, take its first correct
 * guess as the second letter (unless `secondLetter` is given), then schedule again without
 * it so the beats stay evenly spaced.
 */
export function scheduleWithSecondLetter(input: AutoScheduleInput & { secondLetter?: string }): { guesses: Guess[]; secondLetter: string } {
  const hint = resolveHintLetter(input.word, input.hintLetter ?? "");
  const secondLetter = resolveSecondLetter(input.word, hint, autoSchedule(input), input.finalRevealAt, input.secondLetter ?? "");
  return { guesses: autoSchedule({ ...input, prefilled: secondLetter ? [secondLetter] : [] }), secondLetter };
}

export function resolveTimeline(
  props: Pick<ReelProps, "word" | "guesses" | "finalRevealAt"> & Partial<Pick<ReelProps, "hintLetter" | "secondLetter">>,
  fps: number,
): Timeline {
  const word = normalizeWord(props.word);
  const letters = new Set(word.replace(/ /g, ""));
  const hintLetter = resolveHintLetter(word, props.hintLetter ?? "");
  const durationFrames = Math.round(DURATION_SECONDS * fps);
  const toFrame = (s: number) => Math.max(0, Math.min(durationFrames - 1, Math.round(s * fps)));
  const finalRevealFrame = toFrame(props.finalRevealAt);
  const second = resolveSecondLetter(word, hintLetter, props.guesses, props.finalRevealAt, props.secondLetter ?? "");
  const hook = resolveHook(word, hintLetter, fps, { prefill: second ? [second] : [] });

  // Pre-filled letters are on the board from frame 0, so their guesses are skipped like the hint's.
  const seen = new Set<string>([...(hintLetter ? [hintLetter] : []), ...hook.prefilled]);
  const guesses: ResolvedGuess[] = props.guesses
    .map((g) => ({ letter: g.letter.toUpperCase().slice(0, 1), time: g.time }))
    .filter((g) => /^[A-Z]$/.test(g.letter) && Number.isFinite(g.time))
    .sort((a, b) => a.time - b.time)
    .filter((g) => {
      if (seen.has(g.letter)) return false;
      seen.add(g.letter);
      return true;
    })
    .map((g, index) => ({
      ...g,
      // Nothing may land inside the opening hook (frames 0–59): the first guess is on 60 at the earliest.
      frame: Math.max(hook.endFrame, toFrame(g.time)),
      kind: letters.has(g.letter) ? ("correct" as const) : ("wrong" as const),
      index,
    }));

  const correctKeyFrames = new Map<string, number>();
  const wrongKeyFrames = new Map<string, number>();
  if (hintLetter) correctKeyFrames.set(hintLetter, hook.lockFrame);
  for (const l of hook.prefilled) correctKeyFrames.set(l, hook.lockFrame);
  for (const g of guesses) {
    if (g.kind === "correct" && g.frame < finalRevealFrame) correctKeyFrames.set(g.letter, g.frame);
    if (g.kind === "wrong") wrongKeyFrames.set(g.letter, g.frame);
  }

  // Letters not guessed before the reveal pop in one after another at the reveal.
  // The stagger shrinks if needed so the last pop still lands inside the reel.
  const hidden = [...new Set(word.replace(/ /g, ""))].filter((c) => !correctKeyFrames.has(c));
  const room = durationFrames - 1 - finalRevealFrame;
  const stagger = hidden.length > 1 ? Math.max(0, Math.min(finalRevealStagger(fps), Math.floor(room / (hidden.length - 1)))) : 0;
  let k = 0;
  const finalOrder = new Map<string, number>();
  for (const c of word) {
    if (c === " " || correctKeyFrames.has(c) || finalOrder.has(c)) continue;
    finalOrder.set(c, finalRevealFrame + stagger * k++);
  }
  const charRevealFrames = [...word].map((c, i) =>
    c === " " ? Infinity : (hook.snapFrames.get(i) ?? correctKeyFrames.get(c) ?? finalOrder.get(c) ?? finalRevealFrame),
  );
  for (const [c, f] of finalOrder) correctKeyFrames.set(c, f);

  const tickFrames: number[] = [];
  for (let n = 1; n <= COUNTDOWN_FROM; n++) tickFrames.push(Math.round(((n * COUNTDOWN_ENDS_AT) / COUNTDOWN_FROM) * fps));

  return {
    word,
    hintLetter,
    hook,
    guesses,
    charRevealFrames,
    correctKeyFrames,
    wrongKeyFrames,
    wrongFrames: guesses.filter((g) => g.kind === "wrong").map((g) => g.frame),
    finalRevealFrame,
    hasFinalReveal: finalOrder.size > 0,
    tickFrames,
  };
}

/**
 * First frame of stress mode: the tick on which the clock first reads below
 * STRESS_BELOW_SECONDS (00:07, frame 660 at 30 fps). Shared by the vignette/clock
 * (stressAt) and the audio (music cut + heartbeat), so they switch on the same frame.
 */
export const stressStartFrame = (tickFrames: readonly number[]): number | undefined => tickFrames[COUNTDOWN_FROM - STRESS_BELOW_SECONDS];

/** Seconds shown on the clock at a frame: COUNTDOWN_FROM → 0, reaching 0 at COUNTDOWN_ENDS_AT and holding. */
export const countdownAt = (frame: number, fps: number) =>
  Math.max(0, COUNTDOWN_FROM - Math.floor(((frame / fps) * COUNTDOWN_FROM) / COUNTDOWN_ENDS_AT + 1e-6));

export const formatClock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export const clampTime = (t: number) => Math.max(0, Math.min(DURATION_SECONDS - 0.05, t));
