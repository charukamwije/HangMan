"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_INPUT, DEFAULT_REEL_PROPS } from "@/remotion/defaults";
import type { ThemeId } from "@/remotion/themes";
import { clampTime, normalizeWord, parseLetters, scheduleWithSecondLetter } from "@/remotion/timeline";
import type { Guess, OpeningStyle, ReelAudioSettings, ReelProps } from "@/remotion/types";
import { FPS } from "@/remotion/constants";
import { DEFAULT_LIBRARY_ID, getLibrary, libraryFileBase, type LibraryId } from "@/data/library";
import { calculateFrameTimeline, parsePuzzle, type HangmanPuzzleData } from "@/remotion/puzzle";

export type ReelState = {
  hookText: string;
  /** Opening plate (0–2 s); "" = "ONLY REAL FANS GET THIS IN 5 SECONDS". Set per video by the library. */
  questionLine: string;
  subtitle: string;
  hint2: string;
  word: string;
  /** Pre-filled on frame 0; "" = first letter of the word. */
  hintLetter: string;
  /** Second letter pre-filled on frame 0, as typed; "" = auto (the first correct guess). */
  secondLetter: string;
  /**
   * The letter the scheduler / library loader took OUT of the guess list as the second
   * pre-filled letter (auto mode). Used when `secondLetter` is empty.
   */
  autoSecondLetter: string;
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
  /** A/B test, frame 1: "standard" (A) or "giant" (B: giant spelling-challenge hook). */
  openingStyle: OpeningStyle;
  /** Test B: seconds the giant hook stays up before it flies into the banner. */
  giantHookSeconds: number;
  /** Test B: uploaded picture behind the frame-1 card ("" = the shelves). Kept while you step through videos. */
  coldOpenBackground: string;
  /** Video length (s, 10–30): the video is cut there and loops; the pattern keeps its 30 s timing. */
  durationSeconds: number;
  /** Thumbnail background picture under public/; "" = the shelf scene. The video always uses the shelves. */
  backgroundImage: string;
  /** Which video library the Video Library section steps through (K-Drama / Other). */
  libraryId: LibraryId;
  /** Video number from the current library (data/library.ts) last loaded; null = custom content. */
  videoNumber: number | null;
};

type Actions = {
  update: (patch: Partial<Omit<ReelState, "guesses" | "audio" | "autoSecondLetter">>) => void;
  /** Load video `n` (1-based) from the library: word, banner, hints, pre-filled letter and reveal order. */
  loadVideo: (n: number) => void;
  /** Switch library (K-Drama / Other): selects that library's theme; the loaded content stays until you pick a video. */
  setLibrary: (id: LibraryId) => void;
  updateAudio: (patch: Partial<ReelAudioSettings>) => void;
  setGuess: (index: number, patch: Partial<Guess>) => void;
  addGuess: () => void;
  removeGuess: (index: number) => void;
  autoDistribute: () => void;
  /** Load a HangmanPuzzleData payload (validated; throws on invalid input). */
  loadPuzzle: (raw: unknown) => void;
  reset: () => void;
};

/** The characters picture (public/backgrounds/characters.jpg), on by default. */
export const DEFAULT_BACKGROUND_IMAGE = "backgrounds/characters.jpg";

const INITIAL: ReelState = {
  hookText: DEFAULT_INPUT.hookText,
  questionLine: "",
  subtitle: DEFAULT_INPUT.subtitle,
  hint2: DEFAULT_INPUT.hint2,
  word: DEFAULT_INPUT.word,
  hintLetter: DEFAULT_INPUT.hintLetter,
  secondLetter: "",
  autoSecondLetter: DEFAULT_REEL_PROPS.secondLetter ?? "",
  wrongLetters: DEFAULT_INPUT.wrongLetters,
  holdBack: DEFAULT_INPUT.holdBack,
  finalRevealAt: DEFAULT_INPUT.finalRevealAt,
  themeId: DEFAULT_REEL_PROPS.themeId,
  guesses: DEFAULT_REEL_PROPS.guesses,
  autoTiming: true,
  audio: DEFAULT_REEL_PROPS.audio,
  showSafeZones: false,
  durationSeconds: 30,
  openingStyle: "standard",
  giantHookSeconds: 0.25,
  coldOpenBackground: "",
  libraryId: DEFAULT_LIBRARY_ID,
  videoNumber: null,
  backgroundImage: DEFAULT_BACKGROUND_IMAGE,
};

/** Library reveal order: first guess at 2 s, then one every 3 s (9 guesses → 26 s), final reveal at 29 s. */
const LIBRARY_FIRST_GUESS = 2;
const LIBRARY_GUESS_GAP = 3;
const LIBRARY_FINAL_REVEAL = 29;

/** Auto beat grid + the second pre-filled letter it took out of the guesses (a patch for set()). */
const schedule = (s: Pick<ReelState, "word" | "hintLetter" | "secondLetter" | "wrongLetters" | "holdBack" | "finalRevealAt">) => {
  const { guesses, secondLetter } = scheduleWithSecondLetter({
    word: s.word,
    hintLetter: s.hintLetter,
    secondLetter: s.secondLetter,
    wrongLetters: parseLetters(s.wrongLetters),
    holdBack: s.holdBack,
    finalRevealAt: s.finalRevealAt,
  });
  return { guesses, autoSecondLetter: secondLetter };
};

const PACING_KEYS = ["word", "hintLetter", "secondLetter", "wrongLetters", "holdBack", "finalRevealAt"] as const;

export const useReelStore = create<ReelState & Actions>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      update: (patch) => {
        const next = { ...get(), ...patch };
        const pacingChanged = PACING_KEYS.some((k) => k in patch);
        set({ ...patch, ...(next.autoTiming && pacingChanged ? schedule(next) : {}) });
      },
      updateAudio: (patch) => set({ audio: { ...get().audio, ...patch } }),
      loadVideo: (n) => {
        const lib = getLibrary(get().libraryId);
        const v = lib.entries.find((e) => e.n === n);
        if (!v) return;
        // Second letter on frame 0: the CSV's own second pre-filled letter when it has one, else the
        // first correct guess (taken out of the guesses). The rest keep one guess every 3 s from 2 s.
        const second = v.prefill2 || (v.guesses.find((g) => g.correct && g.letter !== v.prefill)?.letter ?? "");
        set({
          videoNumber: v.n,
          hookText: v.hookText,
          questionLine: v.questionLine ?? "",
          subtitle: v.hint1,
          hint2: v.hint2,
          word: v.word,
          hintLetter: v.prefill,
          secondLetter: "",
          autoSecondLetter: second,
          wrongLetters: v.guesses.filter((g) => !g.correct).map((g) => g.letter).join(", "),
          finalRevealAt: LIBRARY_FINAL_REVEAL,
          guesses: v.guesses
            .filter((g) => g.letter !== second)
            .map((g, i) => ({ letter: g.letter, time: LIBRARY_FIRST_GUESS + LIBRARY_GUESS_GAP * i })),
          // Keep the CSV's exact reveal order: editing the word / pacing must not re-time it.
          autoTiming: false,
          themeId: lib.themeId,
        });
      },
      setLibrary: (id) => {
        if (id === get().libraryId) return;
        set({ libraryId: id, videoNumber: null, themeId: getLibrary(id).themeId });
      },
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
      autoDistribute: () => set({ autoTiming: true, ...schedule(get()) }),
      loadPuzzle: (raw) => {
        const puzzle = parsePuzzle(raw);
        const t = calculateFrameTimeline(puzzle, FPS);
        set({
          hookText: puzzle.viralHookText,
          subtitle: puzzle.hint,
          hint2: puzzle.hint2 ?? "",
          word: t.word,
          hintLetter: puzzle.prefilledLetter ?? "",
          secondLetter: puzzle.secondPrefilledLetter ?? "",
          autoSecondLetter: t.reelProps.secondLetter ?? "",
          wrongLetters: puzzle.wrongGuesses.join(", "),
          holdBack: puzzle.holdBack ?? get().holdBack,
          finalRevealAt: t.reelProps.finalRevealAt,
          themeId: t.reelProps.themeId,
          audio: t.reelProps.audio,
          guesses: t.reelProps.guesses,
          autoTiming: t.mode === "auto",
          durationSeconds: puzzle.durationSeconds ?? 30,
          openingStyle: puzzle.openingStyle ?? "standard",
          giantHookSeconds: puzzle.giantHookSeconds ?? 0.25,
        });
      },
      reset: () => set(INITIAL),
    }),
    {
      name: "hangman-reel-studio",
      version: 11,
      // v1 → v2: 30 fps beat grid + hook fields. v2 → v3: second pre-filled letter (re-timed if auto;
      // with manual timing it is re-derived from the first correct guess). Keeps the user's content.
      migrate: (persisted, version) => {
        const { hookTests: _dropped, ctaStyle: _cta, ...rest } = persisted as Partial<ReelState> & { hookTests?: unknown; ctaStyle?: unknown };
        void _dropped;
        void _cta;
        const p: ReelState = { ...INITIAL, ...rest };
        // v3 → v4: Midnight Noir is the default theme; move anyone still on the old default to it.
        if (version < 4 && p.themeId === "dark-academia") p.themeId = DEFAULT_REEL_PROPS.themeId;
        if (version < 3) {
          p.secondLetter = "";
          p.autoSecondLetter = "";
          if (p.autoTiming) Object.assign(p, schedule(p));
        }
        return p;
      },
      // Rehydrated manually after mount to avoid SSR hydration mismatches.
      skipHydration: true,
    },
  ),
);

/**
 * File-name base while a library video is loaded, e.g. "kdrama-007-HONEYCOMB" / "video-012-DEMOGORGON"
 * (so renders, screenshots and thumbnails can be matched to posts); `fallback` for custom content.
 * Test B gets "-B" and a cut video its length ("-20s").
 */
export const videoFileBase = (s: Pick<ReelState, "libraryId" | "videoNumber" | "word" | "durationSeconds" | "openingStyle">, fallback = "") => {
  const base = s.videoNumber ? libraryFileBase(s.libraryId, s.videoNumber, s.word.trim().replace(/\s+/g, "-")) : fallback;
  // Cut videos are tagged with their length, e.g. kdrama-007-HONEYCOMB-20s.
  // Test B (giant frame-1 hook) is tagged "-B"; cut videos get their length, e.g. kdrama-007-HONEYCOMB-B-20s.
  const len = s.durationSeconds ?? 30;
  if (!base) return base;
  return `${base}${s.openingStyle === "giant" ? "-B" : ""}${len !== 30 ? `-${len}s` : ""}`;
};

/** Maps editor state to the serializable composition input props. */
export const toReelProps = (s: ReelState): ReelProps => ({
  hookText: s.hookText,
  ...(s.questionLine?.trim() ? { questionLine: s.questionLine.trim() } : {}),
  subtitle: s.subtitle,
  hint2: s.hint2 ?? "",
  word: normalizeWord(s.word),
  hintLetter: s.hintLetter,
  secondLetter: s.secondLetter || s.autoSecondLetter || "",
  guesses: s.guesses,
  finalRevealAt: s.finalRevealAt,
  themeId: s.themeId,
  audio: s.audio,
  showSafeZones: s.showSafeZones,
  durationSeconds: s.durationSeconds ?? 30,
  openingStyle: s.openingStyle ?? "standard",
  giantHookSeconds: s.giantHookSeconds ?? 0.25,
  ...(s.coldOpenBackground ? { coldOpenBackground: s.coldOpenBackground } : {}),
  category: s.videoNumber ? (getLibrary(s.libraryId).entries.find((v) => v.n === s.videoNumber)?.category ?? "") : "",
  // The video keeps the shelf scene; the picture (backgroundImage) is used by the thumbnail only.
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
    ...(s.secondLetter || s.autoSecondLetter ? { secondPrefilledLetter: s.secondLetter || s.autoSecondLetter } : {}),
    holdBack: s.holdBack,
    themeId: s.themeId,
    audio: s.audio,
    ...((s.durationSeconds ?? 30) !== 30 ? { durationSeconds: s.durationSeconds } : {}),
    ...(s.openingStyle === "giant" ? { openingStyle: "giant" as const, giantHookSeconds: s.giantHookSeconds ?? 0.25 } : {}),
  };
};
