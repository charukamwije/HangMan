import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { shadeA, type Theme } from "../themes";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";
import { loopReset } from "../loop";
import { HOOK_UI_TIMING, QUESTION_LINE } from "../hook";
import { TOP_ROW } from "../constants";
import { CLOCK } from "./CountdownTimer";

/** Words of the question line that take the accent. */
/** Words on the plate that take the accent (punctuation ignored). */
const QUESTION_EMPHASIS = /^(REAL|FANS|TRUE|ONLY|DESERVE|GENIUS|SECONDS|\d+%?)$/;

/** 0 → 1 across [a, b] seconds. */
const fadeIn = (frame: number, fps: number, [a, b]: readonly [number, number]) => ramp(frame / fps, [a, b], [0, 1]);

/**
 * 0 → 1 visibility of UI held back until `window` (seconds): the clock and pawns. It fades out
 * again over the second half of the loop reset, so the replay's frame 0 matches.
 */
export function stagedVisibility(frame: number, fps: number, durationInFrames: number, window: readonly [number, number]) {
  return fadeIn(frame, fps, window) * (1 - loopReset(frame, durationInFrames, fps, 0.5, 1));
}

/**
 * The question line covering the (frosted) hint card from frame 0. It slams
 * in, holds until 1.6 s, then lifts away before the first
 * guess so the clue takes over. It comes back over the loop reset, matching frame 0.
 * Rendered inside the hint card block: it covers the card and grows upward if needed.
 */
export const QuestionLine: React.FC<{ theme: Theme; minHeight: number; text?: string }> = ({ theme, minHeight, text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const [outFrom, outTo] = HOOK_UI_TIMING.questionOut;
  const out = ramp(frame / fps, [outFrom, outTo], [0, 1]);
  const back = loopReset(frame, durationInFrames, fps, 0.5, 1);
  const vis = Math.max(1 - out, back);
  if (vis <= 0.001) return null;
  const slam = 1 - spring({ frame, fps, config: { damping: 10, stiffness: 280, mass: 0.5 } });
  // Small slam: the plate already fills the safe width, so it must not grow past it.
  const scale = (1 + 0.04 * slam) * (1 - 0.08 * out * (1 - back));
  const words = ((text ?? "").trim() || QUESTION_LINE).toUpperCase().split(/\s+/);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        minHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 70px",
        boxSizing: "border-box",
        borderRadius: 48,
        // Opaque: the panel colours are glass, and the frosted clue must not show through.
        background: `linear-gradient(180deg, ${theme.panel[0]}, ${theme.panel[1]}), ${theme.mode === "dark" ? "#0a0a0a" : "#fff8ec"}`,
        border: `6px solid ${theme.accent}`,
        boxShadow: `0 0 60px ${theme.accent}88, 0 30px 60px ${shadeA(theme, 0.7)}`,
        opacity: vis,
        transform: `translateY(${(-60 * out * (1 - back)).toFixed(1)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: "50% 50%",
        zIndex: 5,
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 132,
          lineHeight: 1.05,
          letterSpacing: "0.03em",
          color: theme.text,
          textAlign: "center",
          textWrap: "balance",
          textShadow: `0 6px 0 ${shadeA(theme, 0.9)}, 0 0 30px ${theme.accent}55`,
        }}
      >
        {words.map((w, i) => (
          <React.Fragment key={i}>
            {i > 0 && " "}
            <span style={{ color: QUESTION_EMPHASIS.test(w.replace(/[^A-Z0-9%]/g, "")) ? theme.accent : undefined }}>{w}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/**
 * "COMMENT BEFORE 0:00" pill tucked under the clock (clock width, so it
 * stays clear of the banner and the right edge), 1.5 s → 6 s.
 */
export const CommentCta: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inFrame = Math.round(HOOK_UI_TIMING.ctaIn[0] * fps);
  const vis = fadeIn(frame, fps, HOOK_UI_TIMING.ctaIn) * (1 - fadeIn(frame, fps, HOOK_UI_TIMING.ctaOut));
  if (vis <= 0.001) return null;
  const pop = frame >= inFrame ? spring({ frame: frame - inFrame, fps, config: { damping: 9, stiffness: 260, mass: 0.5 } }) : 0;
  // A small nudge on every clock tick while it is up.
  const nudge = ramp(frame % fps, [0, 5], [1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: TOP_ROW.top + CLOCK.height + 24,
        left: TOP_ROW.right - CLOCK.width,
        width: CLOCK.width,
        boxSizing: "border-box",
        padding: "16px 10px 18px",
        borderRadius: 26,
        textAlign: "center",
        fontFamily: BODY_FONT,
        fontWeight: 800,
        fontSize: 46,
        lineHeight: 1.12,
        letterSpacing: "0.05em",
        color: theme.onAccent,
        background: theme.accent,
        boxShadow: `0 0 ${30 + 20 * nudge}px ${theme.accent}aa, 0 10px 20px ${shadeA(theme, 0.6)}`,
        opacity: vis,
        transform: `scale(${(0.6 + 0.4 * pop) * (1 + 0.04 * nudge)})`,
        transformOrigin: "50% 0%",
      }}
    >
      COMMENT
      <br />
      BEFORE 0:00
    </div>
  );
};
