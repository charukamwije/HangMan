import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import type { Stress } from "../motion";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { HookBanner } from "./HookBanner";
import { CLOCK, CountdownTimer } from "./CountdownTimer";
import { DESIGN_HEIGHT, DESIGN_WIDTH, SAFE_ZONE, TOP_ROW } from "../constants";
import { HOOK_INTRO_TEXT } from "../hook";

/** Same 60px margin inside the safe band on both sides, so the header centres on the safe area. */
const HEADER_INSET = { left: SAFE_ZONE.left + 60, right: SAFE_ZONE.right + 60 };
const HEADER_WIDTH = DESIGN_WIDTH - HEADER_INSET.left - HEADER_INSET.right; // 1760

/** Category block must stay this far below the banner/clock row. */
const ROW_CLEARANCE = 50;
const SUBTITLE_SIZE = 72;
/**
 * Space above the hint (topic → hint) AND below it (hint → answer board; HangmanReel
 * uses it as the header-to-board gap), so the hint sits vertically centred between them.
 */
export const HINT_GAP = 130;
/** In a tight fit the two gaps close up to this before any text is scaled down. */
const MIN_HINT_GAP = 50;
/** Subtitle text column: header width minus the two 120 px rules and their 36 px gaps. */
const SUBTITLE_WIDTH = HEADER_WIDTH - 2 * (120 + 36);

const categorySize = (text: string) => {
  const longestWord = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  // Anton ≈ 0.46em per glyph; keep the longest word on one line within the header width.
  return Math.min(148, Math.floor(HEADER_WIDTH / (longestWord * 0.5)), text.length > 34 ? 128 : 148);
};

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
 * Conservative height of category + subtitle text (gaps excluded). Over-estimates glyph widths
 * (Anton 0.5em, Inter 800 caps + tracking 0.82em) so the fit check errs safe.
 */
export function estimateHeaderTextHeight(category: string, subtitle: string) {
  const cat = categorySize(category);
  const catLines = Math.max(1, lineCount(category, Math.floor(HEADER_WIDTH / (cat * 0.5))));
  const subLines = subtitle.trim() ? lineCount(subtitle, Math.floor(SUBTITLE_WIDTH / (SUBTITLE_SIZE * 0.82))) : 0;
  return { category: catLines * cat * 1.04, subtitle: subLines * SUBTITLE_SIZE * 1.25 };
}

/**
 * Banner (left) + compact clock (right) in a fixed row just below the
 * platform's search/profile/more icons (TOP_ROW), then the Category title
 * (neon) and Subtitle hint (white) as one block whose BOTTOM edge sits on
 * `boardTop - gap` (just above the word board), so it hugs the board and grows upward.
 * The hint sits centred between topic and board: the gap above and below it are equal
 * (HINT_GAP, closing to MIN_HINT_GAP when space is tight).
 * If a very long category/subtitle would reach the banner row, the block is
 * scaled down (from its bottom edge) until it fits.
 *
 * No entrance animation: everything is on screen, at full opacity, on frame 0.
 * The banner opens on "DECODING BOARD..." and flips to `hookText` during `bannerFlip`.
 */
export const Header: React.FC<{
  theme: Theme;
  hookText: string;
  category: string;
  subtitle: string;
  bannerFlip: readonly [number, number];
  /** y of the word board's top edge. */
  boardTop: number;
  tickFrames: number[];
  stress: Stress;
}> = ({ theme, hookText, category, subtitle, bannerFlip, boardTop, tickFrames, stress }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Travelling sheen across the category, one pass every 3.75 s (8 passes per 30 s, so it wraps on the loop).
  const shimmer = interpolate(((frame / fps) % 3.75) / 3.75, [0, 1], [-30, 130]);

  // Space between the banner row and the board: topic + gap + hint + gap must fit in it.
  const room = boardTop - (TOP_ROW.top + CLOCK.height + ROW_CLEARANCE);
  const est = estimateHeaderTextHeight(category, subtitle);
  const textH = est.category + est.subtitle;
  const gaps = est.subtitle ? 2 : 1;
  const gap = Math.max(MIN_HINT_GAP, Math.min(HINT_GAP, (room - textH) / gaps));
  // Block is scaled from its bottom edge; the gap below it stays unscaled.
  const fit = Math.min(1, (room - gap) / (textH + (gaps - 1) * gap));
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
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: categorySize(category),
            lineHeight: 1.04,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: theme.accent,
            textWrap: "balance",
            filter: `drop-shadow(0 0 22px ${theme.accent}99) drop-shadow(0 0 70px ${theme.accent}55) drop-shadow(0 10px 24px rgba(0,0,0,0.85))`,
            backgroundImage: `linear-gradient(100deg, ${theme.accent} ${shimmer - 12}%, #ffffff ${shimmer}%, ${theme.accent} ${shimmer + 12}%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {category}
        </div>
        {subtitle.trim() && (
          <div style={{ marginTop: gap, display: "flex", alignItems: "center", justifyContent: "center", gap: 36 }}>
            <span style={{ flex: "0 0 120px", height: 4, background: `linear-gradient(90deg, transparent, ${theme.text}aa)` }} />
            <span
              style={{
                fontFamily: BODY_FONT,
                fontWeight: 800,
                fontSize: SUBTITLE_SIZE,
                letterSpacing: "0.08em",
                color: theme.text,
                textTransform: "uppercase",
                textShadow: "0 6px 24px rgba(0,0,0,0.9)",
                textWrap: "balance",
              }}
            >
              {subtitle}
            </span>
            <span style={{ flex: "0 0 120px", height: 4, background: `linear-gradient(270deg, transparent, ${theme.text}aa)` }} />
          </div>
        )}
      </div>
    </>
  );
};
