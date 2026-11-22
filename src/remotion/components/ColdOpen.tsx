import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COUNTDOWN_FROM, DESIGN_HEIGHT, DESIGN_WIDTH, SAFE_CENTER_X, SAFE_WIDTH, TOP_ROW } from "../constants";
import { DISPLAY_FONT } from "../fonts";
import { loopReset } from "../loop";
import type { Theme } from "../themes";
import { BANNER_GUTTER } from "./BannerBalloons";

/**
 * A/B test B ("giant" opening): frame 1 is a giant spelling-challenge title card, the scroll-stopper.
 *
 *   0          stage dimmed except a spotlight on the board; the video's banner text giant and
 *              centre-screen, legible on frame 0, slamming down from 1.15×, with the stakes stamp
 *              ("13 LETTERS · 29 SECONDS") under it
 *   hold       (giantHookSeconds, default 0.25 s) the card flies up and shrinks into the banner
 *              (top-left) over COLD_OPEN_EXIT_SECONDS while the dim lifts and the banner fades in
 *   loop       over the last part of the loop reset the card + dim come back, so the replay's
 *              frame 0 matches the reel's last frame
 *
 * When the hold is long enough (≥ STAMP_LATE_FROM) the stamp punches in 0.4 s after the slam;
 * on a short hold it is up from frame 0 with the headline.
 */

export const DEFAULT_GIANT_HOOK_SECONDS = 0.25;
/** Flight from the card up into the banner (s). */
export const COLD_OPEN_EXIT_SECONDS = 0.25;
/** Holds at least this long (s) get the stamp punching in later, at STAMP_AT. */
const STAMP_LATE_FROM = 0.6;
const STAMP_AT = 0.4;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Centre of the title block (design px): the hint-card band, above the board. */
const CARD_Y = 1080;
/** Where the card flies to: roughly the banner's centre. */
const BANNER_TARGET = { x: TOP_ROW.left + BANNER_GUTTER + 300, y: TOP_ROW.top + 120 };
const SLAM_FROM = 1.15;

/** Frames of the cold open for a hold (s): exit flight [from, to] and the stamp frame. */
export function coldOpenFrames(holdSeconds: number, fps: number) {
  const hold = Math.max(0.05, holdSeconds);
  const exitFrom = Math.round(hold * fps);
  return {
    exit: [exitFrom, exitFrom + Math.max(1, Math.round(COLD_OPEN_EXIT_SECONDS * fps))] as const,
    stamp: hold >= STAMP_LATE_FROM ? Math.round(STAMP_AT * fps) : 0,
  };
}

/** 0..1: how much the cold open covers the stage (1 = card fully up). The banner hides under it. */
export function coldOpenCover(frame: number, fps: number, durationInFrames: number, holdSeconds: number) {
  const [a, b] = coldOpenFrames(holdSeconds, fps).exit;
  const out = interpolate(frame, [a, b], [1, 0], CLAMP);
  return Math.max(out, loopReset(frame, durationInFrames, fps, 0.5, 1));
}

const POWER = /^(\d+%?|%|FAIL|FAILS|ONLY|IMPOSSIBLE|GENIUS|NOBODY|NO ONE|STOP|CAN'T|CANNOT|SPELL)$/;

/** Splits a headline into 1–3 lines with the shortest possible longest line, so it can stay giant. */
function headlineLines(label: string): string[] {
  const words = label.split(" ");
  const lineCount = Math.min(words.length, label.length <= 14 ? 1 : label.length <= 30 ? 2 : 3);
  if (lineCount <= 1) return [label];
  let best: string[] = [label];
  let bestMax = Infinity;
  // Try every split of the words into `lineCount` lines (headlines are short, so this is tiny).
  const walk = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const lines = [...acc, words.slice(start).join(" ")];
      const m = Math.max(...lines.map((l) => l.length));
      if (m < bestMax) [best, bestMax] = [lines, m];
      return;
    }
    for (let end = start + 1; end <= words.length - (left - 1); end++) walk(end, left - 1, [...acc, words.slice(start, end).join(" ")]);
  };
  walk(0, lineCount, []);
  return best;
}

export const ColdOpen: React.FC<{ theme: Theme; hookText: string; word: string; spotlightY: number; holdSeconds: number }> = ({
  theme,
  hookText,
  word,
  spotlightY,
  holdSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cover = coldOpenCover(frame, fps, durationInFrames, holdSeconds);
  if (cover <= 0.001) return null;

  const label = (hookText.trim() || "CAN YOU SPELL THIS?").toUpperCase();
  const lines = headlineLines(label);
  const longest = Math.max(...lines.map((l) => l.length));
  const letters = word.replace(/[^A-Z]/gi, "").length;
  const stakes = `${letters} LETTERS · ${COUNTDOWN_FROM} SECONDS`;

  // Giant headline, sized to fit the safe width even at the slam scale.
  const headSize = Math.min(330, Math.floor((SAFE_WIDTH - 80) / (SLAM_FROM * longest * 0.5)));
  const stakesSize = Math.min(120, Math.floor((SAFE_WIDTH - 200) / (stakes.length * 0.52)));

  const { exit, stamp: stampAt } = coldOpenFrames(holdSeconds, fps);
  const [exitA, exitB] = exit;
  const inLoop = frame >= exitB; // past the exit, only the loop reset can bring it back
  const F = (f: number) => Math.round((f * fps) / 30);
  // Frame 0 slam: 1.15× → 1× over 4 frames (the loop reset hands over at 1.15× too).
  const slam = inLoop ? 1 : interpolate(frame, [0, F(4)], [SLAM_FROM, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  // Exit flight toward the banner.
  const fly = inLoop ? 1 - cover : interpolate(frame, [exitA, exitB], [0, 1], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  const dx = (BANNER_TARGET.x - SAFE_CENTER_X) * fly;
  const dy = (BANNER_TARGET.y - CARD_Y) * fly;
  const scale = slam * interpolate(fly, [0, 1], [1, 0.3]);
  // Stakes stamp: up with the headline on a short hold; on a long hold it punches in from 1.7× at 0.4 s.
  const sinceStamp = frame - stampAt;
  const stampIn = inLoop || stampAt === 0 ? 1 : sinceStamp < 0 ? 0 : interpolate(sinceStamp, [0, F(5)], [0, 1], { ...CLAMP, easing: Easing.out(Easing.back(2)) });
  const stampFlash = !inLoop && sinceStamp >= 0 ? interpolate(sinceStamp, [0, F(6)], [1, 0], CLAMP) : 0;

  const stroke = Math.max(4, Math.round(headSize * 0.04));
  return (
    // zIndex 10: above the question plate (zIndex 5), which escapes the camera layer whenever the camera is still.
    <div style={{ position: "absolute", left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, pointerEvents: "none", zIndex: 10 }}>
      {/* dim everything except a spotlight on the board, so the eye goes: headline → board */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: cover,
          background: `radial-gradient(ellipse 62% 9% at 50% ${spotlightY}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.9) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SAFE_CENTER_X,
          top: CARD_Y,
          transform: `translate(-50%, -50%) translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)}) rotate(-2deg)`,
          opacity: Math.min(1, cover * 1.6),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: headSize,
            lineHeight: 1.02,
            letterSpacing: "0.02em",
            textAlign: "center",
            color: "#ffffff",
            WebkitTextStroke: `${stroke}px #050505`,
            paintOrder: "stroke fill",
            textShadow: `0 ${stroke * 2}px 0 #050505, 0 0 80px ${theme.accent}66, 0 24px 60px rgba(0,0,0,0.8)`,
          }}
        >
          {lines.map((line, li) => (
            <div key={li}>
              {line.split(" ").map((w, i) => (
                <React.Fragment key={i}>
                  {i > 0 && " "}
                  <span style={{ color: POWER.test(w.replace(/[^A-Z0-9%']/g, "")) ? theme.accent : undefined }}>{w}</span>
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: stakesSize,
            lineHeight: 1,
            letterSpacing: "0.06em",
            color: "#ffffff",
            padding: "26px 54px 22px",
            borderRadius: 28,
            background: theme.wrong,
            border: "6px solid #ffffff",
            boxShadow: `0 0 ${40 + 120 * stampFlash}px ${theme.wrong}, 0 18px 40px rgba(0,0,0,0.6)`,
            transform: `scale(${interpolate(stampIn, [0, 1], [1.7, 1])}) rotate(${interpolate(stampIn, [0, 1], [-9, 2])}deg)`,
            opacity: stampIn > 0 ? 1 : 0,
          }}
        >
          {stakes}
        </div>
      </div>
    </div>
  );
};
