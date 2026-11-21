import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH, HINT2_AT_SECONDS, KEYBOX_SHAKE_PX_AT_1080, RIGHT_RAIL, SAFE_ZONE, TOP_CORNERS } from "./constants";
import { framesSinceLast, NEVER, ramp, strikeShake, stressAt } from "./motion";
import { loopReset } from "./loop";
import { getTheme } from "./themes";
import { resolveTimeline } from "./timeline";
import type { ReelProps } from "./types";
import { AudioTrack } from "./components/AudioTrack";
import { Background } from "./components/Background";
import { CtaPops, GuessCallouts } from "./components/GuessCallout";
import { Pigeons } from "./components/Pigeons";
import { Header } from "./components/Header";
import { Keyboard, KEYBOARD_HEIGHT } from "./components/Keyboard";
import { LivesRow } from "./components/LivesRow";
import { StressVignette } from "./components/StressVignette";
import { measureWordBoard, WordBoard } from "./components/WordBoard";
import { stagedVisibility } from "./components/HookOverlays";
import { HOOK_UI_TIMING } from "./hook";

// Vertical layout on the 2160×3840 design canvas, stacked UP from the keyboard:
// keys → pawns → word board → "HINT" label + hint text. Banner + clock are pinned below the platform icons.
const LIVES_HEIGHT = 200;
const GAP_BOARD_LIVES = 130; // lifts board + hint a little off the pawns
/** Guess callout centre, below the keyboard top: it plays over the upper key rows so the word board stays visible. */
const CALLOUT_BELOW_KEYS_TOP = 280;
/** Seconds after the last guessed letter before the end comment prompt comes in. */
const PROMPT_AFTER_LAST_GUESS = 0.6;
const KEYBOARD_BOTTOM =DESIGN_HEIGHT - SAFE_ZONE.bottom - 20; // 3020: whole key box sits above YouTube's channel/title (≈ 3080)
/** 5 px at 1080 wide → 10 design px; the stage scale turns it back into 5 px / 10 px on output. */
const KEYBOX_SHAKE = KEYBOX_SHAKE_PX_AT_1080 * (DESIGN_WIDTH / 1080);

/**
 * "The Dark Board" — 30 s · 9:16 · 30 fps Hangman reel (1080×1920 or 2160×3840).
 *
 * Retention structure:
 *  - Frame 0 is a complete frame: hook banner, hint, every word slot, the
 *    first decoy mid-pop, clock and keys. No black frame, no fade-in.
 *  - Frames 0–60 are the "machine gun" hook (hook.ts), scripted end to end:
 *    zero-frame camera punch-in + challenge banner on 0, hint locks on 4 among
 *    accelerating decoys, pattern interrupt on the first tick (30), then a
 *    ghost-glyph rattle under a tension push-in until the first guess on 60.
 *  - Background pushes in 1.00 → 1.08 (Ken Burns) for the whole reel.
 *  - A reveal or strike lands every 2.0–2.5 s (see autoSchedule).
 *  - Strikes kick the key box sideways with a spring.
 *  - Below 00:08 the vignette closes in and throbs with the neon clock.
 *  - Two letters are pre-filled on frame 0 (the hint + the first correct guess); the clue is
 *    sharp under a question line ("ONLY REAL FANS…", until 1.6 s); the clock + "COMMENT BEFORE
 *    0:00" fade in at 1.5 s, the balloons + pawns at 2 s. The keyboard is up from frame 0.
 *  - A/B test (props.ctaStyle): A = Like / Subscribe balloons on the banner; B = no balloons,
 *    LIKE / SHARE / SUBSCRIBE are highlighted beats of their own in the letter rhythm (timeline.ctaPops).
 *  - Seamless loop: over the last 0.6 s keys, pawns, timer, answer, banner and
 *    background animate back to their frame-0 state (loop.ts), so the
 *    platform's auto-replay continues straight into the hook.
 *
 * All motion is derived from useCurrentFrame() (spring / interpolate), so every
 * render is deterministic. No setInterval / requestAnimationFrame.
 */
export const HangmanReel: React.FC<ReelProps> = (props) => {
  const { width, height } = useVideoConfig();
  // The layout is authored once at 4K; scale the stage to whatever size is rendering.
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

  return (
    <AbsoluteFill style={{ backgroundColor: getTheme(props.themeId).wood[2], overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <ReelStage {...props} />
      </div>
      <AudioTrackForProps {...props} />
    </AbsoluteFill>
  );
};

/** Hook so stage + audio share one memoised timeline per prop set. */
function useReelTimeline(props: ReelProps) {
  const { fps } = useVideoConfig();
  return useMemo(
    () => resolveTimeline(props, fps),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.word, props.guesses, props.finalRevealAt, props.hintLetter, props.secondLetter, props.ctaStyle, fps],
  );
}

const ReelStage: React.FC<ReelProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = getTheme(props.themeId);
  const timeline = useReelTimeline(props);
  // "COMMENT THE WORD YOU GUESSED!" comes in just after the last letter guessed (once its callout
  // has landed), not at the final reveal, so it stays up long enough to read before the loop.
  const lastGuess = Math.max(-1, ...timeline.guesses.filter((g) => g.frame < timeline.finalRevealFrame).map((g) => g.frame));
  const promptFrame = lastGuess >= 0 ? lastGuess + Math.round(PROMPT_AFTER_LAST_GUESS * fps) : timeline.finalRevealFrame;
  const stress =stressAt(frame, fps, timeline.tickFrames);
  // The pawns fade and rise in from 2.0 s (the keyboard is up from frame 0).
  const uiVis = stagedVisibility(frame, fps, durationInFrames, HOOK_UI_TIMING.uiIn);

  const board = measureWordBoard(timeline.word || " ");
  const keyboardTop = KEYBOARD_BOTTOM - KEYBOARD_HEIGHT;
  const livesTop = keyboardTop - LIVES_HEIGHT;
  const wordTop = Math.round(livesTop - GAP_BOARD_LIVES - board.height);
  const WORD_CENTER_Y = Math.round(wordTop + board.height / 2);

  // Impact overlays: red edge flash on a strike, accent bloom on a correct reveal.
  const sinceWrong = framesSinceLast(timeline.wrongFrames, frame) / fps;
  // Opening hook: every ✖ fires a short, sharp crimson edge flash (machine-gun strobe).
  const sinceHookStrike = frame < timeline.hook.clearFrame ? framesSinceLast(timeline.hook.strikeFrames, frame) : NEVER;
  const redFlash = Math.max(ramp(sinceWrong, [0, 0.03, 0.5], [0, 0.85, 0]), ramp(sinceHookStrike, [0, 2], [0.4, 0]));
  // Full-frame crimson hit on the first 2 frames of a wrong guess.
  const redHit = ramp(sinceWrong, [0, 0.067], [0.28, 0]);
  const correctFrames = useMemo(
    () => [
      timeline.hook.lockFrame, // accent bloom as the hint locks in (frame 4)
      ...timeline.guesses.filter((g) => g.kind === "correct" && g.frame < timeline.finalRevealFrame).map((g) => g.frame),
    ],
    [timeline],
  );
  const sinceCorrect = framesSinceLast(correctFrames, frame);
  const bloom = ramp(sinceCorrect / fps, [0, 0.05, 0.6], [0, 0.45, 0]);
  // White exposure pop on the correct impact frame, and a harder one on the hook's pattern interrupt.
  const { pulseFrame, rattleFrames, endFrame: hookEnd } = timeline.hook;
  const sincePulse = frame >= pulseFrame ? frame - pulseFrame : NEVER;
  const whiteHit = Math.max(ramp(sinceCorrect, [0, 2], [0.18, 0]), ramp(sincePulse, [0, 3], [0.24, 0]));

  // Camera: wrong guesses shake the whole stage (x + y, out of phase); correct ones punch in.
  const wrongSince = framesSinceLast(timeline.wrongFrames, frame);
  const camX = strikeShake(wrongSince, fps, 44);
  const camY = strikeShake(wrongSince - 1, fps, -22);
  const punch = ramp(sinceCorrect / fps, [0, 0.05, 0.4], [0, 1, 0]);
  // Overscan just enough while shaking that the frame edge never shows.
  // (origin is x centre / WORD_CENTER_Y, so the nearest edges are DESIGN_WIDTH/2 and WORD_CENTER_Y away)
  const overscan = 1.1 * Math.max(Math.abs(camX) / (DESIGN_WIDTH / 2), Math.abs(camY) / WORD_CENTER_Y);
  // Zero-frame punch-in: frame 0 is already cut in tight (1.08×, no ramp), held 3 frames, then released by frame 9.
  const F = (f: number) => Math.round((f * fps) / 30);
  const slap = interpolate(frame, [F(3), F(9)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  // Pattern interrupt (first tick): a hard camera kick that peaks on the pulse frame itself.
  const kick = ramp(sincePulse, [0, F(7)], [1, 0]);
  // Tension push-in across the rattle, released over the last frames before the first guess.
  const [rattleFrom, rattleTo] = rattleFrames;
  const tension = frame < rattleTo ? Easing.in(Easing.quad)(ramp(frame, [rattleFrom, rattleTo], [0, 1])) : ramp(frame, [rattleTo, hookEnd], [1, 0]);
  const camScale = 1 + 0.035 * punch + 0.08 * slap + 0.04 * kick + 0.025 * tension + overscan;
  const camera = camX || camY || punch || slap || kick || tension ?`translate(${camX.toFixed(2)}px, ${camY.toFixed(2)}px) scale(${camScale})` : undefined;
  const finalBloom = ramp((frame - timeline.finalRevealFrame) / fps, [0, 0.1, 1], [0, 0.35, 0.08]) * (1 - loopReset(frame, durationInFrames, fps, 0, 0.6));

  return (
    <AbsoluteFill style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <AbsoluteFill style={{ transform: camera, transformOrigin: `50% ${WORD_CENTER_Y}px` }}>
      <Background theme={theme} image={props.backgroundImage || undefined} />
      <StressVignette stress={stress} theme={theme} />
      {/* behind the header: pigeons start tucked behind the timer and fly out from it */}
      <Pigeons />

      <Header theme={theme} hookText={props.hookText} subtitle={props.subtitle} hint2={props.hint2 ?? ""} hint2At={Math.round(HINT2_AT_SECONDS * fps)} bannerPulse={timeline.hook.pulseFrame} wrongFrames={timeline.wrongFrames} boardTop={wordTop} tickFrames={timeline.tickFrames} stress={stress} balloons={(props.ctaStyle ?? "balloons") === "balloons"} />
      <WordBoard theme={theme} word={timeline.word} revealFrames={timeline.charRevealFrames} finalRevealFrame={timeline.finalRevealFrame} top={wordTop} hook={timeline.hook} />
      {uiVis > 0.001 && (
        <AbsoluteFill style={uiVis < 1 ? { opacity: uiVis, transform: `translateY(${(80 * (1 - uiVis)).toFixed(1)}px)` } : undefined}>
          <LivesRow theme={theme} wrongFrames={timeline.wrongFrames} promptFrame={promptFrame} top={livesTop} />
        </AbsoluteFill>
      )}
      {/* The keyboard is up from frame 0. */}
      <Keyboard
        theme={theme}
        top={keyboardTop}
        correctKeyFrames={timeline.correctKeyFrames}
        wrongKeyFrames={timeline.wrongKeyFrames}
        wrongFrames={timeline.wrongFrames}
        shakePx={KEYBOX_SHAKE}
      />
      <GuessCallouts theme={theme} guesses={timeline.guesses} finalRevealFrame={timeline.finalRevealFrame} centerY={keyboardTop + CALLOUT_BELOW_KEYS_TOP} />
      {/* A/B test B: LIKE / SHARE / SUBSCRIBE hero beats between the guesses (empty for A). */}
      <CtaPops theme={theme} pops={timeline.ctaPops} centerY={keyboardTop + CALLOUT_BELOW_KEYS_TOP} />
      </AbsoluteFill>

      {redFlash > 0.001 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: redFlash * (theme.mode === "light" ? 0.6 : 1),
            background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, ${theme.wrong} 120%)`,
            mixBlendMode: theme.glowBlend,
          }}
        />
      )}
      {redHit > 0.001 && <AbsoluteFill style={{ pointerEvents: "none", background: theme.wrong, opacity: redHit * (theme.mode === "light" ? 0.45 : 1), mixBlendMode: theme.glowBlend }} />}
      {whiteHit > 0.001 && <AbsoluteFill style={{ pointerEvents: "none", background: "#ffffff", opacity: whiteHit, mixBlendMode: "screen" }} />}
      {Math.max(bloom, finalBloom) > 0.001 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: Math.max(bloom, finalBloom),
            background: `radial-gradient(ellipse 60% 25% at 50% ${WORD_CENTER_Y}px, ${theme.accent}, transparent 70%)`,
            mixBlendMode: theme.glowBlend,
          }}
        />
      )}

      {props.showSafeZones && <SafeZones />}
    </AbsoluteFill>
  );
};

const AudioTrackForProps: React.FC<ReelProps> = (props) => {
  const timeline = useReelTimeline(props);
  return <AudioTrack timeline={timeline} audio={props.audio} />;
};

const hatch = "repeating-linear-gradient(45deg, rgba(255,0,180,0.30) 0 18px, rgba(255,0,180,0.10) 18px 36px)";
const zoneLabel: React.CSSProperties = { position: "absolute", fontFamily: "sans-serif", fontSize: 40, color: "#ff4fd2", fontWeight: 700, textShadow: "0 2px 6px #000" };
/**
 * Preview-only map of where Instagram Reels / YouTube Shorts draw their UI
 * (see SAFE_ZONE, TOP_CORNERS, RIGHT_RAIL in constants.ts). Nothing essential
 * may sit under a hatched area.
 */
const SafeZones: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {/* status bar / app header */}
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: SAFE_ZONE.top, background: hatch }} />
    {/* top corners: back arrow / "Reels" (left), search · profile · ⋯ (right) */}
    <div style={{ position: "absolute", left: 0, top: SAFE_ZONE.top, width: TOP_CORNERS.leftWidth, height: TOP_CORNERS.bottom - SAFE_ZONE.top, background: hatch }} />
    <div style={{ position: "absolute", right: 0, top: SAFE_ZONE.top, width: TOP_CORNERS.rightWidth, height: TOP_CORNERS.bottom - SAFE_ZONE.top, background: hatch }} />
    {/* side crop on tall phones */}
    <div style={{ position: "absolute", left: 0, top: TOP_CORNERS.bottom, bottom: SAFE_ZONE.bottom, width: SAFE_ZONE.left, background: hatch }} />
    <div style={{ position: "absolute", right: 0, top: TOP_CORNERS.bottom, height: RIGHT_RAIL.top - TOP_CORNERS.bottom, width: SAFE_ZONE.right, background: hatch }} />
    {/* right action rail */}
    <div style={{ position: "absolute", right: 0, top: RIGHT_RAIL.top, bottom: SAFE_ZONE.bottom, width: RIGHT_RAIL.width, background: hatch }} />
    {/* channel / title / caption */}
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: SAFE_ZONE.bottom, background: hatch }} />
    <div style={{ ...zoneLabel, left: 40, top: 200 }}>STATUS BAR · APP HEADER</div>
    <div style={{ ...zoneLabel, right: 30, top: TOP_CORNERS.bottom - 60 }}>SEARCH · PROFILE · MORE</div>
    <div style={{ ...zoneLabel, right: 30, top: RIGHT_RAIL.top + 20, width: RIGHT_RAIL.width - 40, textAlign: "right" }}>LIKE · COMMENT SHARE · SAVE</div>
    <div style={{ ...zoneLabel, left: 40, bottom: SAFE_ZONE.bottom - 80 }}>CHANNEL · TITLE · CAPTION (preview only)</div>
  </AbsoluteFill>
);
