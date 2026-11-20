export const COMPOSITION_ID = "HangmanReel"; // 4K master (2160×3840)
export const COMPOSITION_ID_1080 = "HangmanReel1080"; // 1080×1920 delivery
/** Same reel, but input props are raw HangmanPuzzleData (batch JSON files). */
export const PUZZLE_COMPOSITION_ID = "HangmanPuzzle";
export const PUZZLE_COMPOSITION_ID_1080 = "HangmanPuzzle1080";
/** Custom 9:16 thumbnail still (1080×1920, one frame). */
export const THUMBNAIL_COMPOSITION_ID = "HangmanThumbnail";

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
/** Hint 2 replaces hint 1 at this second (blur out → chip flip → word-by-word reveal). */
export const HINT2_AT_SECONDS = 15;

/** Banner challenge, up and legible from frame 0 (hook.ts). Short = big type; power words take the accent (HookBanner). */
export const DEFAULT_HOOK_TEXT = "99% FAIL THIS";
/** Stress mode (vignette tightens, clock pulses) starts once the clock reads below this. */
export const STRESS_BELOW_SECONDS = 8;
/** Key-box shake amplitude, in output px at 1080 wide (scales with resolution: 10 px at 4K). */
export const KEYBOX_SHAKE_PX_AT_1080 = 5;
/** Ken Burns push-in on the background across the full reel. */
export const KEN_BURNS = { from: 1, to: 1.08 } as const;

/**
 * Platform UI on the 2160×3840 design canvas, measured from real phone
 * screenshots of the reel on Instagram Reels and YouTube Shorts. Both apps
 * show the video ~815 px wide on a 738 px screen, so ~105 design px are
 * cropped off EACH side before any overlay is drawn.
 *
 *   top        status bar / app header strip (full width)
 *   left/right side crop (+ a little margin)
 *   bottom     channel name + title + caption (YouTube starts ≈ y 3080, Instagram ≈ 3420)
 */
export const SAFE_ZONE = { top: 300, bottom: 800, left: 140, right: 140 };
/** Top corners: Instagram back arrow / "Reels" title (left), search · profile · ⋯ (right, both apps), y ≈ 350–480. */
export const TOP_CORNERS = { bottom: 520, leftWidth: 290, rightWidth: 560 };
/** Right action rail (like · comment · share · save · remix · ⋯): x ≥ 1800 from y ≈ 2050 (Shorts) / 2430 (Reels). */
export const RIGHT_RAIL = { top: 1980, width: 380 };

/** Upper/middle band (below the top corners, above the rail): side crop only. Centre content on SAFE_CENTER_X. */
export const SAFE_WIDTH = DESIGN_WIDTH - SAFE_ZONE.left - SAFE_ZONE.right; // 1880
export const SAFE_CENTER_X = SAFE_ZONE.left + SAFE_WIDTH / 2; // 1080
/** Lower band (y ≥ RIGHT_RAIL.top): from the left crop to the action rail. */
export const LOWER_SAFE_WIDTH = DESIGN_WIDTH - SAFE_ZONE.left - RIGHT_RAIL.width; // 1640
export const LOWER_SAFE_CENTER_X = SAFE_ZONE.left + LOWER_SAFE_WIDTH / 2; // 960
/** Banner + clock row: just below the top-corner icons (search · profile · more), full safe width. */
export const TOP_ROW = { left: SAFE_ZONE.left + 60, right: DESIGN_WIDTH - SAFE_ZONE.right - 60, top: TOP_CORNERS.bottom + 20 }; // x 200 → 1960, y 540

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
  /** Guess impacts: sub drop + rising pluck (correct) / distorted buzzer (wrong). */
  correct: "audio/correct.wav",
  wrong: "audio/wrong.wav",
  /** 0.3 s rising whoosh that lands exactly on each guess frame. */
  whoosh: "audio/whoosh.wav",
  /** Opening hook: every decoy click / strike / thud pre-mixed into one 1 s file (see generate-sfx.mjs). */
  hookDecode: "audio/hook-decode.wav",
  /** Opening hook: geiger/typewriter click per decoy pop + strike. */
  click: "audio/click.wav",
  /** Opening hook: metallic lock as the hint letter lands (frame 25). */
  lock: "audio/lock.wav",
  /** Frame-0 scroll-stopper: crisp digital pop paired with the 1.08× zero-frame punch-in (reused on the 1 s pattern interrupt). */
  slapPop: "audio/slap-pop.wav",
  /** Loop point: fast rewind of the end of the song over the last LOOP_RESET_SECONDS. */
  loopRewind: "audio/loop-rewind.wav",
  /** Opening hook: the music bed rewinding (reversed, accelerating) under the 1 s decode. */
  rewind: "audio/rewind.wav",
  /** 120 BPM staccato cello + woodblock bed, crossfaded in at the end of the hook. */
  music: "audio/music.wav",
  /** Stress mode: low lub-dub between the ticks once the music cuts at 00:07. */
  heartbeat: "audio/heartbeat.wav",
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
  click: 0.05,
  hookDecode: 1.05,
  correct: 0.9,
  wrong: 0.55,
  whoosh: 0.3,
  lock: 0.5,
  slapPop: 0.25,
  heartbeat: 0.45,
} as const;

/**
 * Seamless loop: over the last 0.6 s every element animates smoothly back to its
 * frame-0 state (see loop.ts), so the platform's auto-replay lands on the hook with no cut.
 */
export const LOOP_RESET_SECONDS = 0.6;

/** Brass swell timing relative to the final reveal: starts 4 s before (00:25), peaks 1 s before (00:28). */
export const SWELL_LEAD_SECONDS = 4;
/** The last N seconds whose ticks rise in pitch and volume. */
export const FINAL_TICK_SECONDS = 5;
