import { DEFAULT_HOOK_TEXT } from "../constants";
import type { HangmanPuzzleData } from "./types";

/** Minimal valid payload: revealSequence left empty → auto beat grid. */
export const EXAMPLE_PUZZLE: HangmanPuzzleData = {
  id: "example-landmarks",
  hint: "A TRICKY US & UK CHALLENGE WORD",
  hint2: "FAMOUS PLACES PEOPLE TRAVEL TO SEE",
  secretWord: "LANDMARKS",
  wrongGuesses: ["B", "W", "X", "Q"],
  revealSequence: [],
  viralHookText: DEFAULT_HOOK_TEXT,
};
