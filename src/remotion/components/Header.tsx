import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import type { Stress } from "../motion";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { HookBanner } from "./HookBanner";
import { CLOCK, CountdownTimer } from "./CountdownTimer";
import { DESIGN_HEIGHT, DESIGN_WIDTH, SAFE_ZONE, TOP_ROW } from "../constants";
import { HOOK_INTRO_TEXT } from "../hook";
import { HintOwl, OWL_ABOVE, THROW_HIT_SECONDS } from "./HintOwl";
import { ramp } from "../motion";
import { loopReset, loopResetStart } from "../loop";

/** Same 60px margin inside the safe band on both sides, so the header centres on the safe area. */
const HEADER_INSET = { left: SAFE_ZONE.left + 60, right: SAFE_ZONE.right + 60 };
const HEADER_WIDTH = DESIGN_WIDTH - HEADER_INSET.left - HEADER_INSET.right; // 1760

/** Hint block must stay this far below the banner/clock row. */
const ROW_CLEARANCE = 50;
/** The hint text is the hero of the header: big, bright, inside a glowing card. */
const SUBTITLE_SIZE = 84;
/** Small neon tab on the card's top edge. */
const HINT_LABEL = "HINT";
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
 * No entrance animation: everything is on screen, at full opacity, on frame 0.
 * The banner opens on "DECODING BOARD..." and flips to `hookText` during `bannerFlip`.
 */
export const Header: React.FC<{
  theme: Theme;
  hookText: string;
  /** Hint 1: shown from the start until `hint2At`. */
  subtitle: string;
  /** Hint 2: replaces hint 1 at `hint2At` (blur out → chip flip → word-by-word reveal). Empty = keep hint 1. */
  hint2?: string;
  hint2At: number;
  bannerFlip: readonly [number, number];
  /** Hint text is blurred before this window and un-blurs word by word across it. */
  hintReveal: readonly [number, number];
  /** Every wrong guess re-blurs the hint, which then reveals word by word again. */
  wrongFrames: readonly number[];
  /** y of the word board's top edge. */
  boardTop: number;
  tickFrames: number[];
  stress: Stress;
}> = ({ theme, hookText, subtitle, hint2 = "", hint2At, bannerFlip, hintReveal, wrongFrames, boardTop, tickFrames, stress }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const wrongBlurIn = Math.max(2, Math.round(fps * 0.1));
  // Hint 2 switch: hint 1 blurs out from hint2At like a wrong-guess hit, the text swaps once it is
  // fully blurred, then hint 2 reveals word by word with the same timing.
  const hasHint2 = hint2.trim() !== "";
  const current = hasHint2 && frame >= hint2At + wrongBlurIn ? hint2 : subtitle;
  // On a wrong guess the owl throws water: the hint blurs when the splash lands, not on the guess.
  const splashFrames = wrongFrames.map((f) => f + Math.round(THROW_HIT_SECONDS * fps));
  const blurEvents = hasHint2 ? [...splashFrames, hint2At] : splashFrames;
  // Water on the card: ripple distortion + running ink, strongest right after the splash.
  const lastSplash = splashFrames.reduce((acc, f) => (f <= frame && f > acc ? f : acc), -Infinity);
  const wet = Number.isFinite(lastSplash) ? ramp((frame - lastSplash) / fps, [0, 0.05, 1.4], [0, 1, 0]) : 0;
  // Word-by-word reveal; each word takes WORD_FRAMES to sharpen, starts spread across the window.
  const words = current.trim().split(/\s+/).filter(Boolean);
  const [revealFrom, revealTo] = hintReveal;
  const WORD_FRAMES = Math.max(3, Math.round(fps * 0.2));
  const stagger = words.length > 1 ? Math.max(1, (revealTo - revealFrom - WORD_FRAMES) / (words.length - 1)) : 0;
  // Loop reset: words blur back out (last word first) so the replay opens blurred, like frame 0.
  // Wrong guess: all words blur in ~0.1 s on the strike, then re-reveal word by word from +0.2 s to +1.0 s.
  const lastWrong = blurEvents.reduce((last, f) => (f <= frame && f > last ? f : last), -Infinity);
  const wrongFrom = Math.round(fps * 0.2);
  const wrongStagger = words.length > 1 ? Math.max(1, (Math.round(fps * 1.0) - wrongFrom - WORD_FRAMES) / (words.length - 1)) : 0;
  const wrongHidden = (i: number) => {
    if (!Number.isFinite(lastWrong)) return 0;
    const start = lastWrong + wrongFrom + i * wrongStagger;
    return ramp(frame, [lastWrong, lastWrong + wrongBlurIn], [0, 1]) * (1 - ramp(frame, [start, start + WORD_FRAMES], [0, 1]));
  };
  // "HINT" chip does a full 3D flip whenever the hint blurs: on every wrong guess and as the
  // loop reset starts (that flip ends before the last frame, so the replay starts on a still chip).
  const FLIP = Math.round(fps / 3);
  const loopStart = loopResetStart(durationInFrames, fps);
  const flipFrom = [...blurEvents, loopStart].reduce((last, f) => (f <= frame && f > last ? f : last), -Infinity);
  const flip = Number.isFinite(flipFrom) ? interpolate(frame - flipFrom, [0, FLIP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }) : 1;
  const flipping = flip > 0 && flip < 1;
  const reblur = (i: number) => {
    const k = (words.length - 1 - i) / Math.max(1, words.length - 1); // 0 for the last word
    return loopReset(frame, durationInFrames, fps, 0.35 + 0.3 * k, 0.65 + 0.3 * k);
  };
  const t = frame / fps;
  // Travelling sheen across the tab, one pass every 3.75 s (8 passes per 30 s, so it wraps on the loop).
  const shimmer = interpolate((t % 3.75) / 3.75, [0, 1], [-30, 130]);
  // Card glow breathes at 1.1 Hz (33 cycles per 30 s: seamless on the loop).
  const breathe = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 1.1);

  // Space between the banner row and the board: label + hint + gap must fit in it.
  const room = boardTop - (TOP_ROW.top + CLOCK.height + ROW_CLEARANCE);
  // Sized for the longer hint, so the card never changes size at the 15 s switch.
  const textH = estimateHeaderTextHeight(subtitle, hint2);
  const textMinHeight = Math.max(hintLines(subtitle), hintLines(hint2)) * SUBTITLE_SIZE * 1.2;
  const gap = Math.max(MIN_HINT_GAP, Math.min(HINT_GAP, room - textH));
  // Block is scaled from its bottom edge; the gap below it stays unscaled.
  const fit = Math.min(1, (room - gap) / textH);
  const bottom = boardTop - gap;

  return (
    <>
      <HookBanner theme={theme} text={hookText} introText={HOOK_INTRO_TEXT} flip={bannerFlip} />
      <CountdownTimer theme={theme} tickFrames={tickFrames} stress={stress} />

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
              background: "linear-gradient(180deg, rgba(12,11,8,0.78), rgba(4,4,3,0.86))",
              border: `${CARD_BORDER}px solid ${theme.accent}${hex2(0.45 + 0.25 * breathe)}`,
              boxShadow: `0 0 ${40 + 30 * breathe}px ${theme.accent}${hex2(0.22 + 0.12 * breathe)}, inset 0 0 60px ${theme.accent}14, 0 30px 60px rgba(0,0,0,0.7)`,
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
                padding: "0 46px 0 calc(46px + 0.3em)",
                fontWeight: 400,
                borderRadius: 999,
                fontFamily: DISPLAY_FONT,
                fontSize: LABEL_SIZE,
                lineHeight: 1,
                letterSpacing: "0.3em",
                color: "#0b0b05",
                background: `linear-gradient(100deg, ${theme.accent} ${shimmer - 12}%, #ffffff ${shimmer}%, ${theme.accent} ${shimmer + 12}%)`,
                boxShadow: `0 0 30px ${theme.accent}88, 0 8px 18px rgba(0,0,0,0.6)`,
              }}
            >
              {HINT_LABEL}
            </div>
            {wet > 0.01 && (
              <svg width={0} height={0} style={{ position: "absolute" }}>
                <filter id="hintWater" x="-10%" y="-20%" width="120%" height="160%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves={1} seed={Math.floor(frame / 4) % 97} result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale={(34 * wet).toFixed(1)} xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </svg>
            )}
            <div style={{ minHeight: textMinHeight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                filter: wet > 0.01 ? "url(#hintWater)" : undefined,
                fontFamily: BODY_FONT,
                fontWeight: 800,
                fontSize: SUBTITLE_SIZE,
                lineHeight: 1.2,
                letterSpacing: "0.06em",
                color: "#FFFFFF",
                textTransform: "uppercase",
                textShadow: `0 0 28px ${theme.accent}40, 0 6px 24px rgba(0,0,0,0.9)`,
                textWrap: "balance",
              }}
            >
              {words.map((w, i) => {
                const start = revealFrom + i * stagger;
                const p = Math.max(ramp(frame, [start, start + WORD_FRAMES], [0, 1]) * (1 - wrongHidden(i)) * (1 - reblur(i)), 0);
                return (
                  <React.Fragment key={i}>
                    {i > 0 && " "}
                    <span
                      style={{
                        display: "inline-block",
                        filter: p < 1 ? `blur(${(1 - p) * 26}px)` : undefined,
                        opacity: 0.45 + 0.55 * p,
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
      </div>
    </>
  );
};

const hex2 = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
