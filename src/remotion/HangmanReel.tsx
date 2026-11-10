import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH, KEYBOX_SHAKE_PX_AT_1080, SAFE_ZONE } from "./constants";
import { framesSinceLast, ramp, stressAt } from "./motion";
import { getTheme } from "./themes";
import { resolveTimeline } from "./timeline";
import type { ReelProps } from "./types";
import { AudioTrack } from "./components/AudioTrack";
import { Background } from "./components/Background";
import { CountdownTimer } from "./components/CountdownTimer";
import { Header } from "./components/Header";
import { Keyboard, KEYBOARD_HEIGHT } from "./components/Keyboard";
import { LivesRow } from "./components/LivesRow";
import { StressVignette } from "./components/StressVignette";
import { measureWordBoard, WordBoard } from "./components/WordBoard";

// Vertical layout on the 2160×3840 design canvas.
const WORD_CENTER_Y = 1500;
const KEYBOARD_BOTTOM = DESIGN_HEIGHT - SAFE_ZONE.bottom + 20; // bottom row clears platform captions
/** 5 px at 1080 wide → 10 design px; the stage scale turns it back into 5 px / 10 px on output. */
const KEYBOX_SHAKE = KEYBOX_SHAKE_PX_AT_1080 * (DESIGN_WIDTH / 1080);

/**
 * "The Dark Board" — 30 s · 9:16 · 30 fps Hangman reel (1080×1920 or 2160×3840).
 *
 * Retention structure:
 *  - Frame 0 is a complete frame: hook banner, category, every word slot, the
 *    pre-filled hint letter, clock and keys. No black frame, no fade-in.
 *  - Background pushes in 1.00 → 1.08 (Ken Burns) for the whole reel.
 *  - A reveal or strike lands every 2.0–2.5 s (see autoSchedule).
 *  - Strikes kick the key box sideways with a spring.
 *  - Below 00:08 the vignette closes in and throbs with the neon clock.
 *
 * All motion is derived from useCurrentFrame() (spring / interpolate), so every
 * render is deterministic. No setInterval / requestAnimationFrame.
 */
export const HangmanReel: React.FC<ReelProps> = (props) => {
  const { width, height } = useVideoConfig();
  // The layout is authored once at 4K; scale the stage to whatever size is rendering.
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
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
    [props.word, props.guesses, props.finalRevealAt, props.hintLetter, fps],
  );
}

const ReelStage: React.FC<ReelProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getTheme(props.themeId);
  const timeline = useReelTimeline(props);
  const stress = stressAt(frame, fps, timeline.tickFrames);

  const board = measureWordBoard(timeline.word || " ");
  const wordTop = Math.round(WORD_CENTER_Y - board.height / 2);
  const livesTop = Math.round(wordTop + board.height + 40);
  const keyboardTop = KEYBOARD_BOTTOM - KEYBOARD_HEIGHT;

  // Impact overlays: red edge flash on a strike, accent bloom on a correct reveal.
  const sinceWrong = framesSinceLast(timeline.wrongFrames, frame) / fps;
  const redFlash = ramp(sinceWrong, [0, 0.05, 0.43], [0, 0.55, 0]);
  const correctFrames = useMemo(
    () => timeline.guesses.filter((g) => g.kind === "correct" && g.frame < timeline.finalRevealFrame).map((g) => g.frame),
    [timeline],
  );
  const bloom = ramp(framesSinceLast(correctFrames, frame) / fps, [0, 0.067, 0.5], [0, 0.22, 0]);
  const finalBloom = ramp((frame - timeline.finalRevealFrame) / fps, [0, 0.1, 1], [0, 0.35, 0.08]);

  return (
    <AbsoluteFill style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <Background theme={theme} />
      <StressVignette stress={stress} />

      <Header theme={theme} hookText={props.hookText} category={props.category} subtitle={props.subtitle} />
      <CountdownTimer theme={theme} tickFrames={timeline.tickFrames} stress={stress} />
      <WordBoard theme={theme} word={timeline.word} revealFrames={timeline.charRevealFrames} finalRevealFrame={timeline.finalRevealFrame} top={wordTop} />
      <LivesRow theme={theme} wrongFrames={timeline.wrongFrames} finalRevealFrame={timeline.finalRevealFrame} top={livesTop} />
      <Keyboard
        theme={theme}
        top={keyboardTop}
        correctKeyFrames={timeline.correctKeyFrames}
        wrongKeyFrames={timeline.wrongKeyFrames}
        wrongFrames={timeline.wrongFrames}
        shakePx={KEYBOX_SHAKE}
      />

      {redFlash > 0.001 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: redFlash,
            background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, ${theme.wrong} 120%)`,
            mixBlendMode: "screen",
          }}
        />
      )}
      {Math.max(bloom, finalBloom) > 0.001 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: Math.max(bloom, finalBloom),
            background: `radial-gradient(ellipse 60% 25% at 50% ${WORD_CENTER_Y}px, ${theme.accent}, transparent 70%)`,
            mixBlendMode: "screen",
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

const hatch = "repeating-linear-gradient(45deg, rgba(255,0,180,0.22) 0 18px, rgba(255,0,180,0.08) 18px 36px)";
const SafeZones: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: SAFE_ZONE.top, background: hatch }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: SAFE_ZONE.bottom, background: hatch }} />
    <div style={{ position: "absolute", right: 0, top: SAFE_ZONE.top, bottom: SAFE_ZONE.bottom, width: SAFE_ZONE.right, background: hatch }} />
    <div style={{ position: "absolute", left: 40, bottom: SAFE_ZONE.bottom - 90, fontFamily: "sans-serif", fontSize: 54, color: "#ff4fd2", fontWeight: 700 }}>
      PLATFORM UI SAFE ZONE (preview only)
    </div>
  </AbsoluteFill>
);
