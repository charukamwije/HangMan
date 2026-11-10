import { DEFAULT_HOOK_TEXT } from "../constants";
import type { HangmanPuzzleData } from "./types";

/** Minimal valid payload: revealSequence left empty → auto beat grid. */
export const EXAMPLE_PUZZLE: HangmanPuzzleData = {
  id: "example-landmarks",
  topic: "GLOBAL LANDMARKS & GEOGRAPHY",
  hint: "A TRICKY US & UK CHALLENGE WORD",
  secretWord: "LANDMARKS",
  wrongGuesses: ["B", "W", "X", "Q"],
  revealSequence: [],
  viralHookText: DEFAULT_HOOK_TEXT,
};
