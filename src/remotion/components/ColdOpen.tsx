import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COUNTDOWN_FROM, DESIGN_HEIGHT, DESIGN_WIDTH, SAFE_CENTER_X, SAFE_WIDTH, TOP_ROW } from "../constants";
import { DISPLAY_FONT } from "../fonts";
import { COLD_OPEN_FRAMES_30, hookFrame } from "../hook";
import { loopReset } from "../loop";
import type { Theme } from "../themes";
import { BANNER_GUTTER } from "./BannerBalloons";

/**
 * Cold open: a full-screen title card over the first second — the scroll-stopper.
 *
 *   0        stage dimmed except a spotlight on the scrambling board; the challenge
 *            ("99% FAIL THIS") giant and centre-screen, legible on frame 0, slamming
 *            down from 1.15×
 *   12       stakes stamp punches in: "9 LETTERS · 24 SECONDS" (+ thud SFX, audioCues)
 *   24 → 31  the card flies up and shrinks into the banner (top-left) while the dim
 *            lifts; the banner fades in under it and re-slams on the 1 s pulse (30)
 *   loop     over the last part of the loop reset the card + dim come back, so the
 *            replay's frame 0 matches the reel's last frame
 *
 * Frames authored @ 30 fps, scaled with hookFrame().
 */

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Centre of the title block (design px): the frosted hint-card band, above the board. */
const CARD_Y = 1080;
/** Where the card flies to: roughly the banner's centre. */
const BANNER_TARGET = { x: TOP_ROW.left + BANNER_GUTTER + 300, y: TOP_ROW.top + 120 };
const SLAM_FROM = 1.15;

/** 0..1: how much the cold open covers the stage (1 = card fully up). The banner hides under it. */
export function coldOpenCover(frame: number, fps: number, durationInFrames: number) {
  const [a, b] = COLD_OPEN_FRAMES_30.exit;
  const out = interpolate(frame, [hookFrame(a, fps), hookFrame(b, fps)], [1, 0], CLAMP);
  return Math.max(out, loopReset(frame, durationInFrames, fps, 0.5, 1));
}

const POWER = /^(\d+%?|%|FAIL|FAILS|ONLY|IMPOSSIBLE|GENIUS|NOBODY|NO ONE|STOP|CAN'T|CANNOT)$/;

export const ColdOpen: React.FC<{ theme: Theme; hookText: string; word: string; spotlightY: number }> = ({ theme, hookText, word, spotlightY }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cover = coldOpenCover(frame, fps, durationInFrames);
  if (cover <= 0.001) return null;

  const label = (hookText.trim() || "CAN YOU SOLVE IT?").toUpperCase();
  const letters = word.replace(/[^A-Z]/gi, "").length;
  const stakes = `${letters} LETTERS · ${COUNTDOWN_FROM} SECONDS`;

  // Giant headline, sized to fit the safe width even at the slam scale.
  const headSize = Math.min(330, Math.floor((SAFE_WIDTH - 80) / (SLAM_FROM * label.length * 0.5)));
  const stakesSize = Math.min(120, Math.floor((SAFE_WIDTH - 200) / (stakes.length * 0.52)));

  const [exitA, exitB] = COLD_OPEN_FRAMES_30.exit.map((f) => hookFrame(f, fps));
  const stampAt = hookFrame(COLD_OPEN_FRAMES_30.stamp, fps);
  const inLoop = frame >= exitB; // past the exit, only the loop reset can bring it back
  // Frame 0 slam: 1.15× → 1× over 4 frames (the loop reset hands over at 1.15× too).
  const slam = inLoop ? 1 : interpolate(frame, [0, hookFrame(4, fps)], [SLAM_FROM, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  // Exit flight toward the banner.
  const fly = inLoop ? 1 - cover : interpolate(frame, [exitA, exitB], [0, 1], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  const dx = (BANNER_TARGET.x - SAFE_CENTER_X) * fly;
  const dy = (BANNER_TARGET.y - CARD_Y) * fly;
  const scale = slam * interpolate(fly, [0, 1], [1, 0.3]);
  // Stakes stamp: punches in from 1.7× with a tiny rotation settle; already up during the loop reset.
  const sinceStamp = frame - stampAt;
  const stampIn = inLoop ? 1 : sinceStamp < 0 ? 0 : interpolate(sinceStamp, [0, hookFrame(5, fps)], [0, 1], { ...CLAMP, easing: Easing.out(Easing.back(2)) });
  const stampFlash = !inLoop && sinceStamp >= 0 ? interpolate(sinceStamp, [0, hookFrame(6, fps)], [1, 0], CLAMP) : 0;

  const stroke = Math.max(4, Math.round(headSize * 0.04));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, pointerEvents: "none" }}>
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
            lineHeight: 1,
            letterSpacing: "0.02em",
            color: "#ffffff",
            WebkitTextStroke: `${stroke}px #050505`,
            paintOrder: "stroke fill",
            textShadow: `0 ${stroke * 2}px 0 #050505, 0 0 80px ${theme.accent}66, 0 24px 60px rgba(0,0,0,0.8)`,
          }}
        >
          {label.split(" ").map((w, i) => (
            <React.Fragment key={i}>
              {i > 0 && " "}
              <span style={{ color: POWER.test(w.replace(/[^A-Z0-9%']/g, "")) ? theme.accent : undefined }}>{w}</span>
            </React.Fragment>
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
