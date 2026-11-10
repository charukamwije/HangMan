export const COMPOSITION_ID = "HangmanReel"; // 4K master (2160×3840)
export const COMPOSITION_ID_1080 = "HangmanReel1080"; // 1080×1920 delivery

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

/** The clock reads 00:00 at this second and holds there for the final beat. */
export const COUNTDOWN_ENDS_AT = 29;
export const COUNTDOWN_FROM = 30;

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

export const AUDIO = {
  ambient: "audio/ambient.wav",
  tick: "audio/tick.wav",
  tock: "audio/tock.wav",
  correct: "audio/correct.wav",
  wrong: "audio/wrong.wav",
  reveal: "audio/reveal.wav",
  whoosh: "audio/whoosh.wav",
} as const;
