/**
 * Runtime validation for HangmanPuzzleData (zod 4). Lives inside src/remotion
 * so the API route, the batch CLI and the Remotion bundle all validate with the
 * same rules. `puzzleJsonSchema` is the same contract as standard JSON Schema,
 * for external generators (LLMs, spreadsheets, n8n…).
 */
import { z } from "zod";
import { DEFAULT_HOOK_TEXT, DURATION_FRAMES } from "../constants";
import { THEME_IDS, type ThemeId } from "../themes";
import type { HangmanPuzzleData } from "./types";

const letter = z
  .string()
  .regex(/^[A-Za-z]$/, "A single letter A–Z")
  .transform((s) => s.toUpperCase());

export const revealEventSchema = z.object({
  frame: z.number().int().min(0).max(DURATION_FRAMES - 1),
  letter,
  status: z.enum(["prefilled", "correct", "wrong", "final"]),
});

export const hangmanPuzzleSchema = z.object({
  id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "Use letters, digits, - or _ (max 64)")
    .optional(),
  hint: z.string().trim().max(120).default(""),
  /** Second hint, replaces `hint` at 15 s. Optional. */
  hint2: z.string().trim().max(120).default(""),
  secretWord: z
    .string()
    .trim()
    .min(1)
    .max(36)
    .regex(/^[A-Za-z ]+$/, "Only letters and spaces"),
  wrongGuesses: z.array(letter).max(12).default([]),
  revealSequence: z.array(revealEventSchema).max(40).default([]),
  viralHookText: z.string().trim().max(60).default(DEFAULT_HOOK_TEXT),
  prefilledLetter: letter.optional(),
  /** Second letter on the board at 0 s. Missing → the first correct guess (its beat is re-timed away). */
  secondPrefilledLetter: letter.optional(),
  holdBack: z.number().int().min(0).max(10).optional(),
  themeId: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]).optional(),
  audio: z
    .object({
      enabled: z.boolean(),
      music: z.number().min(0).max(1),
      tick: z.number().min(0).max(1),
      sfx: z.number().min(0).max(1),
    })
    .partial()
    .optional(),
});

/** Payload accepted by /api/render-reel: one puzzle, an array, or { puzzles: [...] }. */
export const puzzleBatchSchema = z.union([
  hangmanPuzzleSchema.transform((p) => [p]),
  z.array(hangmanPuzzleSchema).min(1).max(31),
  z.object({ puzzles: z.array(hangmanPuzzleSchema).min(1).max(31) }).transform((b) => b.puzzles),
]);

// Compile-time guard: the schema's output must stay assignable to the interface.
type Parsed = z.output<typeof hangmanPuzzleSchema>;
const _schemaMatchesInterface: Parsed extends HangmanPuzzleData ? true : never = true;
void _schemaMatchesInterface;

export type PuzzleValidation = { ok: true; data: HangmanPuzzleData } | { ok: false; issues: z.core.$ZodIssue[]; message: string };

export function validatePuzzle(input: unknown): PuzzleValidation {
  const r = hangmanPuzzleSchema.safeParse(input);
  return r.success ? { ok: true, data: r.data } : { ok: false, issues: r.error.issues, message: z.prettifyError(r.error) };
}

/** Throws a readable one-line error (survives Remotion's error wrapping in Studio / CLI) when the puzzle is invalid. */
export function parsePuzzle(input: unknown): HangmanPuzzleData {
  const r = validatePuzzle(input);
  if (!r.ok) {
    const detail = r.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("; ");
    throw new Error(`Invalid HangmanPuzzleData: ${detail}`);
  }
  return r.data;
}

/** JSON Schema (draft 2020-12) of the input payload. */
export const puzzleJsonSchema = () => z.toJSONSchema(hangmanPuzzleSchema, { io: "input" });
