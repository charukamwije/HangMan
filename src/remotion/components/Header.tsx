import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { shadeA, type Theme } from "../themes";
import type { Stress } from "../motion";
import { BODY_FONT } from "../fonts";
import { HookBanner } from "./HookBanner";
import { CLOCK, CountdownTimer } from "./CountdownTimer";
import { DESIGN_HEIGHT, DESIGN_WIDTH, SAFE_ZONE, TOP_ROW, DEFAULT_CHALLENGE } from "../constants";
import { HintOwl, OWL_ABOVE } from "./HintOwl";
import { ramp } from "../motion";
import { loopReset, loopResetStart } from "../loop";
import { HOOK_UI_TIMING } from "../hook";
import { CommentCta, QuestionLine, stagedVisibility } from "./HookOverlays";

/** Same 60px margin inside the safe band on both sides, so the header centres on the safe area. */
const HEADER_INSET = { left: SAFE_ZONE.left + 60, right: SAFE_ZONE.right + 60 };
const HEADER_WIDTH = DESIGN_WIDTH - HEADER_INSET.left - HEADER_INSET.right; // 1760

/** Hint block must stay this far below the banner/clock row. */
const ROW_CLEARANCE = 50;
/** The hint text is the hero of the header: big, bright, inside a glowing card. */
const SUBTITLE_SIZE = 84;
/** Small neon tab on the card's top edge. */
const HINT_LABEL = "HINT";

/** Lightbulb drawn in the chip's text colour: filled glass, two base bands, three light rays. */
const BulbIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "0 0 auto", overflow: "visible" }}>
    {/* rays */}
    <g stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <path d="M 12 0.6 V 2.2" />
      <path d="M 3.6 3.8 L 4.8 5" />
      <path d="M 20.4 3.8 L 19.2 5" />
    </g>
    {/* glass + neck */}
    <path d="M 12 4.2 C 8.2 4.2 5.6 7 5.6 10.3 C 5.6 12.8 7 14.4 8.2 15.6 C 8.9 16.3 9.2 17 9.2 17.8 H 14.8 C 14.8 17 15.1 16.3 15.8 15.6 C 17 14.4 18.4 12.8 18.4 10.3 C 18.4 7 15.8 4.2 12 4.2 Z" fill={color} />
    {/* highlight on the glass, in the chip colour showing through */}
    <path d="M 9.3 7.6 C 8.4 8.3 8 9.3 8 10.3" stroke="rgba(255,255,255,0.55)" strokeWidth={1.4} strokeLinecap="round" fill="none" />
    {/* screw base */}
    <rect x={9.2} y={18.7} width={5.6} height={1.6} rx={0.8} fill={color} />
    <rect x={9.9} y={21} width={4.2} height={1.6} rx={0.8} fill={color} />
  </svg>
);
/**
 * "NEXT HINT IN 12s" teaser chip on the card's top-left edge (the owl owns the top-right):
 * counts down every second until hint 2 lands, nudging viewers to stay for it. Pops and
 * fades out on the switch; fades back in over the loop reset so the replay matches frame 0.
 */
const NextHintChip: React.FC<{ theme: Theme; frame: number; fps: number; hint2At: number; back: number }> = ({ theme, frame, fps, hint2At, back }) => {
  const left = Math.max(1, Math.ceil((hint2At - frame) / fps));
  const secs = back > 0 ? Math.ceil(hint2At / fps) : left;
  // Out: a quick pop (1 → 1.15) then shrink + fade over ~0.3 s from the switch frame.
  const out = frame >= hint2At ? (frame - hint2At) / fps : -1;
  const vis = out < 0 ? 1 : Math.max(back, 1 - ramp(out, [0.08, 0.3], [0, 1]));
  if (vis <= 0.001) return null;
  const pop = out < 0 ? 1 : interpolate(out, [0, 0.08, 0.3], [1, 1.15, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Tick nudge on every digit change; the last 3 s glow in the accent.
  // Frames since the digit last changed (it changes when hint2At - frame is a whole number of seconds).
  const sinceTick = out < 0 ? (fps - ((((hint2At - frame) % fps) + fps) % fps)) % fps : fps;
  const nudge = out < 0 ? ramp(sinceTick, [0, 4], [1, 0]) : 0;
  const hot = out < 0 && left <= 3;
  const scale = out < 0 ? 1 + 0.08 * nudge * (hot ? 1.6 : 1) : Math.max(pop, back);
  return (
    <div
      style={{
        position: "absolute",
        left: 30,
        top: -CHIP_H / 2 - CARD_BORDER / 2,
        height: CHIP_H,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 28px 0 22px",
        borderRadius: 999,
        fontFamily: BODY_FONT,
        fontWeight: 800,
        fontSize: CHIP_SIZE,
        lineHeight: 1,
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
        color: hot ? theme.onAccent : theme.text,
        background: hot ? theme.accent : `linear-gradient(180deg, ${theme.panel[0]}, ${theme.panel[1]})`,
        border: `3px solid ${theme.accent}`,
        boxShadow: `0 0 ${18 + 30 * nudge}px ${theme.accent}${hot ? "aa" : "55"}, 0 6px 14px ${shadeA(theme, 0.6)}`,
        opacity: vis,
        transform: `scale(${scale.toFixed(3)})`,
        transformOrigin: "0% 50%",
      }}
    >
      <HourglassIcon size={CHIP_SIZE} color={hot ? theme.onAccent : theme.accent} t={frame / fps} />
      <span>
        NEXT HINT IN <span style={{ display: "inline-block", minWidth: `${String(Math.ceil(hint2At / fps)).length}ch`, textAlign: "right", color: hot ? theme.onAccent : theme.accent }}>{secs}</span>s
      </span>
    </div>
  );
};
const CHIP_SIZE = 40;
const CHIP_H = CHIP_SIZE + 30;

/** Small hourglass that flips once a second (with the countdown). */
const HourglassIcon: React.FC<{ size: number; color: string; t: number }> = ({ size, color, t }) => {
  const k = t % 1;
  const turn = k < 0.15 ? 180 * (k / 0.15) : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "0 0 auto", transform: `rotate(${turn.toFixed(1)}deg)` }}>
      <path d="M 6 2 H 18 M 6 22 H 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M 7 3 C 7 8 11 10 12 12 C 13 10 17 8 17 3 Z M 7 21 C 7 16 11 14 12 12 C 13 14 17 16 17 21 Z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M 9.5 19.8 C 10 17.5 11.4 16.4 12 15.6 C 12.6 16.4 14 17.5 14.5 19.8 Z" fill={color} />
    </svg>
  );
};

const LABEL_SIZE = 66;
const TAB_HEIGHT = LABEL_SIZE + 34;
const CARD_PAD = { x: 80, top: 78, bottom: 56 };
const CARD_BORDER = 4;
/** Hint text → answer board. */
export const HINT_GAP = 130;
/** In a tight fit the board gap closes up to this before any text is scaled down. */
const MIN_HINT_GAP = 50;
/** Hint text column inside the card. */
const SUBTITLE_WIDTH = HEADER_WIDTH - 2 * (CARD_PAD.x + CARD_BORDER);

/** Greedy word-wrap line count for a column `maxChars` wide (balance-wrap never uses fewer lines). */
const lineCount = (text: string, maxChars: number) => {
  let lines = 0;
  let len = 0;
  for (const w of text.trim().split(/\s+/)) {
    if (!w) continue;
    if (len && len + 1 + w.length > maxChars) {
      lines++;
      len = w.length;
    } else len = len ? len + 1 + w.length : w.length;
  }
  return lines + (len ? 1 : 0);
};

/**
 * Conservative height of the hint card incl. the half of the "HINT" tab above it. Over-estimates glyph widths
 * (Inter 800 caps + tracking 0.82em) so the fit check errs safe.
 */
export const hintLines = (text: string) => (text.trim() ? lineCount(text, Math.floor(SUBTITLE_WIDTH / (SUBTITLE_SIZE * 0.82))) : 0);

export function estimateHeaderTextHeight(subtitle: string, hint2 = "") {
  const lines = Math.max(hintLines(subtitle), hintLines(hint2));
  if (!lines) return 0;
  // Headroom above the card: the owl sitting on its top-right corner (taller than the HINT tab).
  return Math.max(TAB_HEIGHT / 2, OWL_ABOVE) + CARD_BORDER * 2 + CARD_PAD.top + CARD_PAD.bottom + lines * SUBTITLE_SIZE * 1.2;
}

/**
 * Banner (left) + compact clock (right) in a fixed row just below the
 * platform's search/profile/more icons (TOP_ROW), then a fixed neon "HINT"
 * label over the hint text (white) as one block whose BOTTOM edge sits
 * HINT_GAP above the word board, so it hugs the board and grows upward.
 * If a very long hint would reach
 * the banner row, the board gap closes to MIN_HINT_GAP, then the block scales down.
 *
 * Opening: the banner shows `hookText` from frame 0 (slam) and re-slams on `bannerPulse`. The clue
 * is sharp from frame 0 but sits under the question line until ~1.6 s; the clock fades in at
 * 1.5 s with "COMMENT BEFORE 0:00" under it.
 */
export const Header: React.FC<{
  theme: Theme;
  hookText: string;
  /** Hint 1: shown from the start until `hint2At`. */
  subtitle: string;
  /** Hint 2: replaces hint 1 at `hint2At` (blur out → chip flip → word-by-word reveal). Empty = keep hint 1. */
  hint2?: string;
  hint2At: number;
  /** Pattern-interrupt frame: the banner re-slams. */
  bannerPulse: number;
  /** Wrong-guess frames: the owl throws water at the card (the hint text itself stays sharp). */
  wrongFrames: readonly number[];
  /** y of the word board's top edge. */
  boardTop: number;
  tickFrames: number[];
  stress: Stress;
  /** Opening plate text; "" = the default question line. */
  questionLine?: string;
  /** Short challenge on the top banner; "" = DEFAULT_CHALLENGE. */
  challenge?: string;
}> = ({ theme, hookText, subtitle, hint2 = "", hint2At, bannerPulse, wrongFrames, boardTop, tickFrames, stress, questionLine = "", challenge = "" }) => {
  // The top banner carries a SHORT challenge (one line), not the long hook: less to read before the puzzle.
  const bannerText = challenge.trim() || DEFAULT_CHALLENGE;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // The hints are never blurred: they stay sharp and readable. Wrong guesses (the owl's water throw)
  // leave the text alone. Text only changes by fading / sliding in, word by word.
  const fadeOut = Math.max(2, Math.round(fps * 0.1));
  // Hint 2 switch: hint 1 fades out from hint2At, the text swaps once it has gone, then hint 2 comes in
  // word by word (sharp) with the same timing.
  const hasHint2 = hint2.trim() !== "";
  const current = hasHint2 && frame >= hint2At + fadeOut ? hint2 : subtitle;
  const switchEvents = hasHint2 ? [hint2At] : [];
  const words = current.trim().split(/\s+/).filter(Boolean);
  const WORD_FRAMES = Math.max(3, Math.round(fps * 0.2));
  const lastSwitch = switchEvents.reduce((last, f) => (f <= frame && f > last ? f : last), -Infinity);
  const switchFrom = Math.round(fps * 0.2);
  const switchStagger = words.length > 1 ? Math.max(1, (Math.round(fps * 1.0) - switchFrom - WORD_FRAMES) / (words.length - 1)) : 0;
  // Opening: hint 1 stays hidden under the question line, then reveals word by word once the plate has
  // cleared (end of HOOK_UI_TIMING.questionOut), over ~0.6 s, so the two texts never overlap.
  const revealAt = Math.round(HOOK_UI_TIMING.questionOut[1] * fps);
  const openStagger = words.length > 1 ? Math.max(1, (Math.round(fps * 0.6) - WORD_FRAMES) / (words.length - 1)) : 0;
  const openingHidden = (i: number) => {
    if (frame >= hint2At) return 0;
    const start = revealAt + i * openStagger;
    return 1 - ramp(frame, [start, start + WORD_FRAMES], [0, 1]);
  };
  const switchHidden = (i: number) => {
    if (!Number.isFinite(lastSwitch)) return 0;
    const start = lastSwitch + switchFrom + i * switchStagger;
    return ramp(frame, [lastSwitch, lastSwitch + fadeOut], [0, 1]) * (1 - ramp(frame, [start, start + WORD_FRAMES], [0, 1]));
  };
  // "HINT" chip does a full 3D flip when the clue changes: as hint 1 comes in, at the hint-2 switch and as
  // the loop reset starts (that flip ends before the last frame, so the replay starts on a still chip).
  const FLIP = Math.round(fps / 3);
  const loopStart = loopResetStart(durationInFrames, fps);
  const flipFrom = [...switchEvents, revealAt, loopStart].reduce((last, f) => (f <= frame && f > last ? f : last), -Infinity);
  const flip = Number.isFinite(flipFrom) ? interpolate(frame - flipFrom, [0, FLIP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }) : 1;
  const flipping = flip > 0 && flip < 1;
  const t = frame / fps;
  // Travelling sheen across the tab, one pass every 3.75 s (8 passes per 30 s, so it wraps on the loop).
  const shimmer = interpolate((t % 3.75) / 3.75, [0, 1], [-30, 130]);
  // Card glow breathes at 1.1 Hz (33 cycles per 30 s: seamless on the loop).
  const breathe = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 1.1);

  // Space between the banner row and the board: label + hint + gap must fit in it.
  const room = boardTop - (TOP_ROW.top + CLOCK.height + ROW_CLEARANCE);
  // Sized for the longer hint, so the card never changes size at the hint-2 switch.
  const textH = estimateHeaderTextHeight(subtitle, hint2);
  const textMinHeight = Math.max(hintLines(subtitle), hintLines(hint2)) * SUBTITLE_SIZE * 1.2;
  const gap = Math.max(MIN_HINT_GAP, Math.min(HINT_GAP, room - textH));
  // Block is scaled from its bottom edge; the gap below it stays unscaled.
  const fit = Math.min(1, (room - gap) / textH);
  const bottom = boardTop - gap;

  return (
    <>
      {/* The banner is up from frame 0. */}
      <HookBanner theme={theme} text={bannerText} pulseFrame={bannerPulse} />
      {/* The clock is up and ticking from frame 0, with "COMMENT BEFORE 0:00" under it. */}
      <StagedClock>
        <CountdownTimer theme={theme} tickFrames={tickFrames} stress={stress} />
      </StagedClock>
      <CommentCta theme={theme} />

      <div
        style={{
          position: "absolute",
          bottom: DESIGN_HEIGHT - bottom,
          left: HEADER_INSET.left,
          right: HEADER_INSET.right,
          textAlign: "center",
          transform: fit < 1 ? `scale(${fit})` : undefined,
          transformOrigin: "50% 100%",
        }}
      >
        {(subtitle.trim() || hasHint2) && (
          <div
            style={{
              position: "relative",
              marginTop: TAB_HEIGHT / 2,
              padding: `${CARD_PAD.top}px ${CARD_PAD.x}px ${CARD_PAD.bottom}px`,
              borderRadius: 48,
              background: `linear-gradient(180deg, ${theme.panel[0]}, ${theme.panel[1]})`,
              border: `${CARD_BORDER}px solid ${theme.accent}${hex2(0.45 + 0.25 * breathe)}`,
              boxShadow: `0 0 ${40 + 30 * breathe}px ${theme.accent}${hex2(0.22 + 0.12 * breathe)}, inset 0 0 60px ${theme.accent}14, 0 30px 60px ${shadeA(theme, 0.7)}`,
            }}
          >
            {/* "HINT" tab on the top edge */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -TAB_HEIGHT / 2 - CARD_BORDER / 2,
                height: TAB_HEIGHT,
                transform: flipping ? `translateX(-50%) perspective(700px) rotateX(${(360 * flip).toFixed(1)}deg)` : "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "0 46px 0 40px",
                // same face as the hint text below (Inter ExtraBold)
                fontWeight: 800,
                borderRadius: 999,
                fontFamily: BODY_FONT,
                fontSize: LABEL_SIZE,
                lineHeight: 1,
                letterSpacing: "0.1em",
                color: theme.onAccent,
                background: `linear-gradient(100deg, ${theme.accent} ${shimmer - 12}%, #ffffff ${shimmer}%, ${theme.accent} ${shimmer + 12}%)`,
                boxShadow: `0 0 30px ${theme.accent}88, 0 8px 18px ${shadeA(theme, 0.6)}`,
              }}
            >
              <BulbIcon size={LABEL_SIZE * 0.95} color={theme.onAccent} />
              {HINT_LABEL}
            </div>
            {hasHint2 && <NextHintChip theme={theme} frame={frame} fps={fps} hint2At={hint2At} back={loopReset(frame, durationInFrames, fps, 0.4, 1)} />}
            <div style={{ minHeight: textMinHeight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                fontFamily: BODY_FONT,
                fontWeight: 800,
                fontSize: SUBTITLE_SIZE,
                lineHeight: 1.2,
                letterSpacing: "0.06em",
                color: theme.text,
                textTransform: "uppercase",
                textShadow: `0 0 28px ${theme.accent}40, 0 6px 24px ${shadeA(theme, 0.9)}`,
                textWrap: "balance",
              }}
            >
              {words.map((w, i) => {
                // Comes in word by word as the question line clears, and again at the hint-2 switch. Never blurred.
                const p = Math.max(Math.min(1 - switchHidden(i), 1 - openingHidden(i)), 0);
                return (
                  <React.Fragment key={i}>
                    {i > 0 && " "}
                    <span
                      style={{
                        display: "inline-block",
                        opacity: p,
                        transform: p < 1 ? `translateY(${(1 - p) * 14}px) scale(${1.06 - 0.06 * p})` : undefined,
                      }}
                    >
                      {w}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
            </div>
            <HintOwl
              throwFrames={wrongFrames}
              cardW={HEADER_WIDTH - CARD_BORDER * 2}
              cardH={CARD_PAD.top + CARD_PAD.bottom + textMinHeight}
            />
          </div>
        )}
        <QuestionLine theme={theme} text={questionLine} minHeight={Math.max(380, TAB_HEIGHT / 2 + CARD_PAD.top + CARD_PAD.bottom + textMinHeight + 2 * CARD_BORDER)} />
      </div>
    </>
  );
};

const hex2 = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");

/** Wraps the clock so it fades and scales in over HOOK_UI_TIMING.timerIn (now frame 0: always up). */
const StagedClock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const vis = stagedVisibility(frame, fps, durationInFrames, HOOK_UI_TIMING.timerIn);
  if (vis <= 0.001) return null;
  const cx = TOP_ROW.right - CLOCK.width / 2;
  const cy = TOP_ROW.top + CLOCK.height / 2;
  return (
    <AbsoluteFill style={{ opacity: vis, transform: vis < 1 ? `scale(${(0.85 + 0.15 * vis).toFixed(4)})` : undefined, transformOrigin: `${cx}px ${cy}px` }}>
      {children}
    </AbsoluteFill>
  );
};
