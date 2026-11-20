/**
 * Hook A/B tests. YouTube has no split test for Shorts, so each flag is posted on
 * 5–6 Shorts and compared with the last ~20 (the control = every flag off).
 * Turn on ONE at a time, or you can't tell which change moved retention.
 *
 * Every flag defaults to off, and off renders the reel exactly as before.
 * Pure module (no React / remotion import): shared by the control panel, the
 * render API and the composition.
 */

export type HookTests = {
  /** 1. Clue text sharp and readable from frame 0, instead of frosted until ~2.1 s. */
  readableClue: boolean;
  /** 2. A question line ("ONLY REAL FANS GET THIS IN 5 SECONDS") over the hint card on frame 0. */
  questionLine: boolean;
  /** 3. Two letters (the hint + one more) already in their slots on frame 0; the decoys still scramble the rest. */
  prefilledLetters: boolean;
  /** 4. Clock fades in at 1.5 s, balloons + pawns at 2.0 s (the banner and keyboard stay), instead of everything on frame 0. */
  staggeredUi: boolean;
  /** 5. "COMMENT BEFORE 0:00" under the clock from 1.5 s, not only the end prompt. */
  commentCta: boolean;
  /** 6. No "Note: Think you know it? …" line under the keyboard, for the whole reel. */
  hideNote: boolean;
};

export type HookTestKey = keyof HookTests;

export const HOOK_TESTS_OFF: HookTests = {
  readableClue: false,
  questionLine: false,
  prefilledLetters: false,
  staggeredUi: false,
  commentCta: false,
  hideNote: false,
};

/** Fills any missing flag with "off" (older props files have no hookTests at all). */
export const resolveHookTests = (t?: Partial<HookTests> | null): HookTests => ({ ...HOOK_TESTS_OFF, ...(t ?? {}) });

/** In test order (test 1 first: the biggest expected win). `tag` names the variant in file names. */
export const HOOK_TEST_INFO: { key: HookTestKey; tag: string; label: string; detail: string }[] = [
  { key: "readableClue", tag: "T1", label: "Readable clue at 0.0 s", detail: "Instead of the frosted blur-in." },
  { key: "questionLine", tag: "T2", label: "Question line at frame 0", detail: "“Only real fans get this in 5 seconds” over the hint card until 1.6 s." },
  { key: "prefilledLetters", tag: "T3", label: "Pre-filled letters", detail: "Two letters already in place on frame 0. The other slots still scramble." },
  { key: "staggeredUi", tag: "T4", label: "Hide UI until 2 s", detail: "Clock in at 1.5 s. Balloons and pawns fade in from 2.0 s. The banner and keyboard stay." },
  { key: "commentCta", tag: "T5", label: "“Comment before 0:00” in the hook", detail: "Under the clock from 1.5 s to 6 s." },
  { key: "hideNote", tag: "T6", label: "Remove the note under the keyboard", detail: "No “Note: Think you know it?…” line, for the whole reel." },
];

/** "control" with nothing on, else the tags joined, e.g. "T1" or "T1-T3". */
export const hookVariantTag = (t?: Partial<HookTests> | null) => {
  const on = resolveHookTests(t);
  const tags = HOOK_TEST_INFO.filter((i) => on[i.key]).map((i) => i.tag);
  return tags.length ? tags.join("-") : "control";
};

/** Text of test 2. */
export const QUESTION_LINE = "ONLY REAL FANS GET THIS IN 5 SECONDS";

/** Timing of the test variants, in seconds. */
export const HOOK_TEST_TIMING = {
  /** Test 2: the question line holds until here, then clears before the first guess (2.0 s). */
  questionOut: [1.6, 1.85],
  /** Test 4: clock fade-in. */
  timerIn: [1.5, 1.8],
  /** Test 4: balloons + pawns fade-in (the first guess lands on 2.0 s). */
  uiIn: [2.0, 2.4],
  /** Test 5: comment prompt in / out. */
  ctaIn: [1.5, 1.7],
  ctaOut: [5.7, 6.0],
} as const;
