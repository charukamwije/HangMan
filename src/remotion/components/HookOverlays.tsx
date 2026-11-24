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

/** Text width inside the question plate (hint card width − padding − border, design px). */
const PLATE_TEXT_WIDTH = 1600;
/** Largest plate font. */
const PLATE_MAX_FONT = 176;
/** Plate letter-spacing (em), see the text style below. */
const PLATE_TRACKING = 0.03;

/** Approximate advance width (em) of a character in Anton (the display font), uppercase. */
function antonWidth(ch: string): number {
  if (/[MW]/.test(ch)) return ch === "W" ? 0.74 : 0.66;
  if (/[NHUDOQCG]/.test(ch)) return 0.52;
  if (/[ABRKPVXY0-9]/.test(ch)) return 0.5;
  if (/[EFLSTZ]/.test(ch)) return 0.44;
  if (ch === "I") return 0.25;
  if (ch === "J") return 0.33;
  if (ch === " ") return 0.2;
  if (/[?$%&#@]/.test(ch)) return 0.46;
  if (/[.,'’:;!\-"]/.test(ch)) return 0.26;
  if ((ch.codePointAt(0) ?? 0) > 0x2000) return 1.15; // emoji
  return 0.5;
}
const lineWidthEm = (line: string) => [...line].reduce((w, ch) => w + antonWidth(ch) + PLATE_TRACKING, 0);

/**
 * Plate font size: as big as possible while the line stays on at most TWO lines, so the plate never
 * grows up into the banner. Uses the widest line of the best two-line split (measured per character,
 * with a 6 % safety margin).
 */
function plateFontSize(words: string[]): number {
  const join = (a: string[]) => a.join(" ").replace(/️/g, "");
  let widest = lineWidthEm(join(words));
  for (let i = 1; i < words.length; i++) widest = Math.min(widest, Math.max(lineWidthEm(join(words.slice(0, i))), lineWidthEm(join(words.slice(i)))));
  return Math.min(PLATE_MAX_FONT, Math.floor((PLATE_TEXT_WIDTH * 0.94) / Math.max(1, widest)));
}

/** 0 → 1 across [a, b] seconds (a window ending at 0 s = already up on frame 0). */
const fadeIn = (frame: number, fps: number, [a, b]: readonly [number, number]) => (b <= 0 ? 1 : ramp(frame / fps, [a, b], [0, 1]));

/**
 * 0 → 1 visibility of UI held back until `window` (seconds): the clock and pawns. It fades out
 * again over the second half of the loop reset, so the replay's frame 0 matches.
 */
export function stagedVisibility(frame: number, fps: number, durationInFrames: number, window: readonly [number, number]) {
  // Up from frame 0 (e.g. the clock): always visible, nothing to hide over the loop reset.
  if (window[1] <= 0) return 1;
  return fadeIn(frame, fps, window) * (1 - loopReset(frame, durationInFrames, fps, 0.5, 1));
}

/**
 * The question line covering the (frosted) hint card from frame 0. It slams
 * in, holds until ~2.8 s (it is the hook, often the joke), then its text fades and the plate settles
 * into the card so the clue takes over. It comes back over the loop reset, matching frame 0.
 * Rendered inside the hint card block: it covers the card and grows upward if needed.
 */
export const QuestionLine: React.FC<{ theme: Theme; minHeight: number; text?: string }> = ({ theme, minHeight, text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const [outFrom, outTo] = HOOK_UI_TIMING.questionOut;
  const span = outTo - outFrom;
  // Sequential exit, never a crossfade with the clue: the text fades first (first 40 % of the window),
  // then the empty plate fades and settles into the hint card (from 30 %); hint 1 reveals after it (Header).
  const textOut = ramp(frame / fps, [outFrom, outFrom + 0.4 * span], [0, 1]);
  const boxOut = ramp(frame / fps, [outFrom + 0.3 * span, outTo], [0, 1]);
  const back = loopReset(frame, durationInFrames, fps, 0.5, 1);
  const vis = Math.max(1 - boxOut, back);
  if (vis <= 0.001) return null;
  const textVis = Math.max(1 - textOut, back);
  const slam = 1 - spring({ frame, fps, config: { damping: 10, stiffness: 280, mass: 0.5 } });
  // Small slam: the plate already fills the safe width, so it must not grow past it. On the way out it
  // shrinks a touch towards the card instead of lifting away.
  const scale = (1 + 0.04 * slam) * (1 - 0.04 * boxOut * (1 - back));
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
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: "50% 50%",
        zIndex: 5,
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          // Big: the question line is the hook (often the joke) and stays up for ~3 s; two lines at most.
          fontSize: plateFontSize(words),
          lineHeight: 1.05,
          letterSpacing: "0.03em",
          color: theme.text,
          textAlign: "center",
          textWrap: "balance",
          textShadow: `0 6px 0 ${shadeA(theme, 0.9)}, 0 0 30px ${theme.accent}55`,
          opacity: textVis,
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
 * stays clear of the banner and the right edge), from frame 0 to 6 s. When it starts on frame 0 it
 * fades back in over the loop reset, so the replay seam matches.
 */
export const CommentCta: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inFrame = Math.round(HOOK_UI_TIMING.ctaIn[0] * fps);
  const fromStart = HOOK_UI_TIMING.ctaIn[1] <= 0;
  const back = fromStart ? loopReset(frame, durationInFrames, fps, 0.5, 1) : 0;
  const vis = Math.max(fadeIn(frame, fps, HOOK_UI_TIMING.ctaIn) * (1 - fadeIn(frame, fps, HOOK_UI_TIMING.ctaOut)), back);
  if (vis <= 0.001) return null;
  // Up from frame 0: already settled (no pop-in); otherwise it springs in at ctaIn.
  const pop = fromStart ? 1 : frame >= inFrame ? spring({ frame: frame - inFrame, fps, config: { damping: 9, stiffness: 260, mass: 0.5 } }) : 0;
  // A small nudge on every clock tick while it is up (from the first tick at 1 s).
  const nudge = frame >= fps && back === 0 ? ramp(frame % fps, [0, 5], [1, 0]) : 0;

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
        // Above the hint owl (which perches on the question plate's corner while it is up) and the plate (5).
        zIndex: 6,
      }}
    >
      COMMENT
      <br />
      BEFORE 0:00
    </div>
  );
};
