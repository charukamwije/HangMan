export const COMPOSITION_ID = "HangmanReel"; // 4K master (2160×3840)
export const COMPOSITION_ID_1080 = "HangmanReel1080"; // 1080×1920 delivery
/** Same reel, but input props are raw HangmanPuzzleData (batch JSON files). */
export const PUZZLE_COMPOSITION_ID = "HangmanPuzzle";
export const PUZZLE_COMPOSITION_ID_1080 = "HangmanPuzzle1080";

/**
 * Design canvas. Every layout value in src/remotion is authored in this 4K
 * space; <HangmanReel> scales the whole stage to the composition's real size,
 * so 1080×1920 and 2160×3840 renders are pixel-identical in proportion.
 */
export const DESIGN_WIDTH = 2160;
export const DESIGN_HEIGHT = 3840;
/** @deprecated alias kept for older imports; this is the design canvas, not the output size. */
export const WIDTH = DESIGN_WIDTH;
/** @deprecated alias kept for older imports; this is the design canvas, not the output size. */
export const HEIGHT = DESIGN_HEIGHT;

export const RESOLUTIONS = {
  "4k": { width: 2160, height: 3840 },
  "1080p": { width: 1080, height: 1920 },
} as const;

export const FPS = 30;
export const DURATION_SECONDS = 30;
export const DURATION_FRAMES = FPS * DURATION_SECONDS; // 900

/**
 * True 1 Hz clock: 00:29 on frame 0, one change every second (every 30 frames
 * at 30 fps), 00:00 at 29 s where it holds for the final beat. Keeping
 * FROM === ENDS_AT is what lets the tick SFX land exactly on each digit change.
 */
export const COUNTDOWN_ENDS_AT = 29;
export const COUNTDOWN_FROM = 29;

// ---------------------------------------------------------------- pacing ----
/** First guess lands here; frame 0 → 2 s is carried by the hook (banner + hint letter). */
export const AUTO_START = 2;
/** Gap between the last scheduled guess and the final reveal. */
export const AUTO_GAP_BEFORE_REVEAL = 2.5;
/** Every sequence change (reveal / strike) is spaced 2.0–2.5 s apart, snapped to 0.1 s (3 frames @ 30 fps). */
export const BEAT_MIN = 2;
export const BEAT_MAX = 2.5;
/** Mistake pawns shown; also the cap for auto-added decoy misses. */
export const MAX_LIVES = 6;
/** Plausible "player" guesses used to pad empty beats, most likely first. */
export const DECOY_LETTERS = "ETAOINSHRDLCUMWFGYPBVKJXQZ";

// ------------------------------------------------------------- retention ----
export const DEFAULT_HOOK_TEXT = "95% FAIL THIS";
/** Stress mode (vignette tightens, clock pulses) starts once the clock reads below this. */
export const STRESS_BELOW_SECONDS = 8;
/** Key-box shake amplitude, in output px at 1080 wide (scales with resolution: 10 px at 4K). */
export const KEYBOX_SHAKE_PX_AT_1080 = 5;
/** Ken Burns push-in on the background across the full reel. */
export const KEN_BURNS = { from: 1, to: 1.08 } as const;

/** Platform UI overlays (Reels / Shorts / TikTok) on the design canvas, in px. */
export const SAFE_ZONE = { top: 230, bottom: 700, right: 220, left: 80 };

/** Procedural SFX (scripts/generate-sfx.mjs). Drop in licensed files with the same names to replace them. */
export const AUDIO = {
  ambient: "audio/ambient.wav",
  gavel: "audio/gavel.wav",
  tick: "audio/tick.wav",
  tock: "audio/tock.wav",
  /** Rising-pitch ticks for the last 5 seconds, keyed by the second shown (5 → 1). */
  tickFinal: (secondsLeft: number) => `audio/tick-final-${secondsLeft}.wav`,
  typewriter: "audio/typewriter.wav",
  chime: "audio/chime.wav",
  thud: "audio/thud.wav",
  swell: "audio/swell.wav",
  reveal: "audio/reveal.wav",
} as const;

/** Asset lengths in seconds (used to size each cue's <Sequence>). */
export const AUDIO_SECONDS = {
  gavel: 1.3,
  tick: 0.12,
  typewriter: 0.16,
  chime: 1.3,
  thud: 0.65,
  swell: 4.5,
  reveal: 3.2,
} as const;

/** Brass swell timing relative to the final reveal: starts 4 s before (00:25), peaks 1 s before (00:28). */
export const SWELL_LEAD_SECONDS = 4;
/** The last N seconds whose ticks rise in pitch and volume. */
export const FINAL_TICK_SECONDS = 5;
