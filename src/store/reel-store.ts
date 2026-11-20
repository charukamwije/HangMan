"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_INPUT, DEFAULT_REEL_PROPS } from "@/remotion/defaults";
import type { ThemeId } from "@/remotion/themes";
import { autoSchedule, clampTime, normalizeWord, parseLetters } from "@/remotion/timeline";
import type { Guess, ReelAudioSettings, ReelProps } from "@/remotion/types";
import { FPS } from "@/remotion/constants";
import { HOOK_TESTS_OFF, resolveHookTests, type HookTests } from "@/remotion/hookTests";
import { calculateFrameTimeline, parsePuzzle, type HangmanPuzzleData } from "@/remotion/puzzle";

export type ReelState = {
  hookText: string;
  subtitle: string;
  hint2: string;
  word: string;
  /** Pre-filled on frame 0; "" = first letter of the word. */
  hintLetter: string;
  /** Raw text as typed, e.g. "B, M, W, X". */
  wrongLetters: string;
  holdBack: number;
  finalRevealAt: number;
  themeId: ThemeId;
  guesses: Guess[];
  /** When on, keyframes are regenerated whenever the word / wrong letters / pacing change. */
  autoTiming: boolean;
  audio: ReelAudioSettings;
  showSafeZones: boolean;
  /** Hook A/B test flags; all off = the control reel. */
  hookTests: HookTests;
};

type Actions = {
  update: (patch: Partial<Omit<ReelState, "guesses" | "audio" | "hookTests">>) => void;
  setHookTest: (key: keyof HookTests, on: boolean) => void;
  updateAudio: (patch: Partial<ReelAudioSettings>) => void;
  setGuess: (index: number, patch: Partial<Guess>) => void;
  addGuess: () => void;
  removeGuess: (index: number) => void;
  autoDistribute: () => void;
  /** Load a HangmanPuzzleData payload (validated; throws on invalid input). */
  loadPuzzle: (raw: unknown) => void;
  reset: () => void;
};

const INITIAL: ReelState = {
  hookText: DEFAULT_INPUT.hookText,
  subtitle: DEFAULT_INPUT.subtitle,
  hint2: DEFAULT_INPUT.hint2,
  word: DEFAULT_INPUT.word,
  hintLetter: DEFAULT_INPUT.hintLetter,
  wrongLetters: DEFAULT_INPUT.wrongLetters,
  holdBack: DEFAULT_INPUT.holdBack,
  finalRevealAt: DEFAULT_INPUT.finalRevealAt,
  themeId: DEFAULT_REEL_PROPS.themeId,
  guesses: DEFAULT_REEL_PROPS.guesses,
  autoTiming: true,
  audio: DEFAULT_REEL_PROPS.audio,
  showSafeZones: false,
  hookTests: HOOK_TESTS_OFF,
};

const schedule = (s: Pick<ReelState, "word" | "hintLetter" | "wrongLetters" | "holdBack" | "finalRevealAt">) =>
  autoSchedule({
    word: s.word,
    hintLetter: s.hintLetter,
    wrongLetters: parseLetters(s.wrongLetters),
    holdBack: s.holdBack,
    finalRevealAt: s.finalRevealAt,
  });

const PACING_KEYS = ["word", "hintLetter", "wrongLetters", "holdBack", "finalRevealAt"] as const;

export const useReelStore = create<ReelState & Actions>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      update: (patch) => {
        const next = { ...get(), ...patch };
        const pacingChanged = PACING_KEYS.some((k) => k in patch);
        set({ ...patch, ...(next.autoTiming && pacingChanged ? { guesses: schedule(next) } : {}) });
      },
      updateAudio: (patch) => set({ audio: { ...get().audio, ...patch } }),
      setHookTest: (key, on) => set({ hookTests: { ...resolveHookTests(get().hookTests), [key]: on } }),
      setGuess: (index, patch) =>
        set({
          autoTiming: false,
          guesses: get().guesses.map((g, i) =>
            i === index
              ? {
                  letter: (patch.letter ?? g.letter).toUpperCase().replace(/[^A-Z]/g, "").slice(-1) || g.letter,
                  time: patch.time !== undefined ? clampTime(Math.round(patch.time * 100) / 100) : g.time,
                }
              : g,
          ),
        }),
      addGuess: () => {
        const { guesses, word, wrongLetters, finalRevealAt } = get();
        const used = new Set(guesses.map((g) => g.letter));
        const pool = [...normalizeWord(word).replace(/ /g, ""), ...parseLetters(wrongLetters), ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
        const letter = pool.find((l) => !used.has(l));
        if (!letter) return;
        const last = guesses.reduce((m, g) => Math.max(m, g.time), 1.5);
        set({ autoTiming: false, guesses: [...guesses, { letter, time: clampTime(Math.min(last + 1, finalRevealAt - 0.5)) }] });
      },
      removeGuess: (index) => set({ autoTiming: false, guesses: get().guesses.filter((_, i) => i !== index) }),
      autoDistribute: () => set({ autoTiming: true, guesses: schedule(get()) }),
      loadPuzzle: (raw) => {
        const puzzle = parsePuzzle(raw);
        const t = calculateFrameTimeline(puzzle, FPS);
        set({
          hookText: puzzle.viralHookText,
          subtitle: puzzle.hint,
          hint2: puzzle.hint2 ?? "",
          word: t.word,
          hintLetter: puzzle.prefilledLetter ?? "",
          wrongLetters: puzzle.wrongGuesses.join(", "),
          holdBack: puzzle.holdBack ?? get().holdBack,
          finalRevealAt: t.reelProps.finalRevealAt,
          themeId: t.reelProps.themeId,
          audio: t.reelProps.audio,
          guesses: t.reelProps.guesses,
          autoTiming: t.mode === "auto",
          hookTests: resolveHookTests(puzzle.hookTests),
        });
      },
      reset: () => set(INITIAL),
    }),
    {
      name: "hangman-reel-studio",
      version: 2,
      // v1 → v2: 30 fps beat grid + hook fields. Keep the user's content, re-time if auto.
      migrate: (persisted, version) => {
        const p = { ...INITIAL, ...(persisted as Partial<ReelState>) };
        if (version < 2 && p.autoTiming) p.guesses = schedule(p);
        return p;
      },
      // Rehydrated manually after mount to avoid SSR hydration mismatches.
      skipHydration: true,
    },
  ),
);

/** Maps editor state to the serializable composition input props. */
export const toReelProps = (s: ReelState): ReelProps => ({
  hookText: s.hookText,
  subtitle: s.subtitle,
  hint2: s.hint2 ?? "",
  word: normalizeWord(s.word),
  hintLetter: s.hintLetter,
  guesses: s.guesses,
  finalRevealAt: s.finalRevealAt,
  themeId: s.themeId,
  audio: s.audio,
  showSafeZones: s.showSafeZones,
  hookTests: resolveHookTests(s.hookTests),
});

/**
 * Maps editor state to a HangmanPuzzleData payload for /api/render-reel or
 * `npm run batch`. Manual timings are exported as frames; auto timing exports
 * an empty revealSequence so the server recomputes the beat grid.
 */
export const toPuzzleData = (s: ReelState): HangmanPuzzleData => {
  const word = normalizeWord(s.word);
  const letters = new Set(word.replace(/ /g, ""));
  return {
    hint: s.subtitle,
    hint2: s.hint2 ?? "",
    secretWord: word,
    wrongGuesses: parseLetters(s.wrongLetters).filter((l) => !letters.has(l)),
    revealSequence: s.autoTiming
      ? []
      : s.guesses.map((g) => ({ frame: Math.round(g.time * FPS), letter: g.letter, status: letters.has(g.letter) ? ("correct" as const) : ("wrong" as const) })),
    viralHookText: s.hookText,
    ...(s.hintLetter ? { prefilledLetter: s.hintLetter } : {}),
    holdBack: s.holdBack,
    themeId: s.themeId,
    audio: s.audio,
    hookTests: resolveHookTests(s.hookTests),
  };
};
