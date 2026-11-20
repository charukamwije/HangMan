import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";
import { framesSinceLast, ramp } from "../motion";
import { loopReset } from "../loop";
import { TOP_ROW } from "../constants";

import { CLOCK } from "./CountdownTimer";
import { BalloonCluster, BANNER_GUTTER, bannerFloat } from "./BannerBalloons";

/** Left end of TOP_ROW, 60 px clear of the clock, leaving a gutter at each end under the balloon strings. */
const MAX_WIDTH = TOP_ROW.right - TOP_ROW.left - CLOCK.width - 60 - 2 * BANNER_GUTTER;
const MAX_FONT = 66;
/** Vertical plate padding around the letters. */
const PAD_Y = 22;
/** Banner sits this far below the clock-centred position, giving the balloons more headroom. */
const LOWER = 160;
const fontSizeFor = (longest: number, wrapped = false) =>
  // Wrapped banners leave ~12 % of the row free, so the frame-0 slam (and its balloons) stays clear of the clock.
  Math.min(MAX_FONT, Math.floor(((wrapped ? MAX_WIDTH * 0.88 : MAX_WIDTH) - 150) / (Math.max(1, longest) * 0.56)));
/** Longer banners wrap onto two balanced lines instead of shrinking the type to fit one. */
const WRAP_AT = 26;
function bannerLines(label: string): string[] {
  const words = label.split(" ");
  if (label.length <= WRAP_AT || words.length < 2) return [label];
  let best = [label];
  let bestMax = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const m = Math.max(a.length, b.length);
    if (m < bestMax) [best, bestMax] = [[a, b], m];
  }
  return best;
}

/** Power words (and "99%"-style stats) that take the accent and punch on every banner slam. */
const EMPHASIS = /^(SOLVE|FAIL|FAILS|IMPOSSIBLE|GENIUS|GENIUSES|HARDEST|NOBODY|ONLY|\d+%)$/;
/** Frame-0 slam: the pill opens this much oversized (capped so it never reaches the clock). */
const SLAM_MAX = 0.22;
/** Re-slam on the pattern-interrupt frame. */
const RESLAM = 0.1;

/** Plate corner radius and rim width (colours come from the theme, like the hint card). */
const RADIUS = 34;
const RIM = 6;

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Micro-zoom (1.16× → 1×) that decays over ~8 frames from the latest banner slam
 * (`frame` = frames since it). `hold` (loop reset) pins it zoomed, matching frame 0.
 * Inline-block transform only, so the pill never re-lays out.
 */
const EmphasisWord: React.FC<{ word: string; frame: number; hold: number; size: number; shadow: string; color: string }> = ({ word, frame, hold, size, shadow, color }) => {
  const k = Math.max(hold, frame >= 0 ? ramp(frame, [0, 8], [1, 0]) : 0);
  const ease = k * k * (3 - 2 * k);
  return (
    <span
      style={{
        display: "inline-block",
        // grow the word's own box while it is zoomed, so it never overlaps its neighbours
        margin: `0 ${(size * 0.24 * ease).toFixed(1)}px`,
        transform: `scale(${1 + 0.16 * ease})`,
        transformOrigin: "50% 60%",
        // theme accent, so the key word pops off the dark plate
        color,
        textShadow: shadow,
      }}
    >
      {word}
    </span>
  );
};

/**
 * Top-left banner. The challenge text is up and legible on frame 0 (no preamble):
 * the pill slams in oversized (spring back to 1×) with its power words punching,
 * then re-slams on `pulseFrame` (the 1 s pattern interrupt). The rim glow throbs
 * about once a second throughout.
 */
export const HookBanner: React.FC<{
  theme: Theme;
  text: string;
  pulseFrame: number;
  /** 0–1 opacity of the balloon clusters (hook test 4 holds them back until 2 s). Default 1. */
  balloons?: number;
}> = ({ theme, text, pulseFrame, balloons = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const label = (text.trim() || "GUESS THE WORD").toUpperCase();
  const lines = bannerLines(label);
  const longest = Math.max(...lines.map((l) => l.length));
  const fontSize = fontSizeFor(longest, lines.length > 1);
  // The second line grows the plate; lift it by most of that so it stays clear of the hint card below.
  const lift = (lines.length - 1) * fontSize * 1.1 * 0.7;

  // Fixed pill width, so the balloon strings know exactly where the corners are.
  const bannerW = Math.min(MAX_WIDTH, Math.ceil(2 * RIM + 28 + 28 + 8 + longest * fontSize * 0.52));
  // Slam size: as big as SLAM_MAX, but never grown (from its left edge) past the 60 px gap to the clock.
  const slamAmp = Math.max(0.08, Math.min(SLAM_MAX, (MAX_WIDTH - bannerW + 60) / bannerW));
  const SPRING = { damping: 9, stiffness: 260, mass: 0.5 };
  const slam = 1 - spring({ frame, fps, config: SPRING });
  const reslam = frame >= pulseFrame ? 1 - spring({ frame: frame - pulseFrame, fps, config: SPRING }) : 0;
  // Loop reset (last ~45 %): the pill grows back to the frame-0 slam size, so the replay continues seamlessly.
  const back = loopReset(frame, durationInFrames, fps, 0.55, 1);
  const scale = (1 + slamAmp * slam) * (1 + RESLAM * reslam) * (1 + slamAmp * back);
  const beat = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 1.1); // ~1.1 Hz, peaks on frame 0
  // Rim flares white-hot on each slam.
  const flare = Math.max(ramp(frame, [0, 6], [1, 0]), frame >= pulseFrame ? ramp(frame - pulseFrame, [0, 6], [1, 0]) : 0, back);
  const sinceSlam = framesSinceLast([0, pulseFrame], frame);

  const float = bannerFloat(t, bannerW);
  // Sheen pass every 3.75 s (8 per 30 s, so it wraps cleanly on the loop).
  const sheen = interpolate((t % 3.75) / 3.75, [0, 0.35, 1], [-30, 120, 120]);
  // Clean, legible letters: a thin dark outline plus one crisp drop shadow (no smeared extrusion).
  const ex = theme.mode === "dark" ? "#050505" : "#fff8ec";
  const textExtrude = `0 4px 0 ${ex}, 0 0 18px ${theme.accent}40, 0 6px 10px rgba(0,0,0,0.35)`;

  const labelStyle: React.CSSProperties = {
    fontFamily: DISPLAY_FONT,
    fontSize,
    lineHeight: 1.1,
    letterSpacing: "0.05em",
    color: theme.text,
    WebkitTextStroke: `${Math.max(2, Math.round(fontSize * 0.035))}px ${ex}`,
    paintOrder: "stroke fill",
    textShadow: textExtrude,
    paddingBottom: 4,
  };

  return (
    <div
      style={{
        position: "absolute",
        top: -lift + TOP_ROW.top + (CLOCK.height - (MAX_FONT * 1.1 + 4 + 2 * PAD_Y + 2 * RIM)) / 2 + LOWER, // clock-centred, then lowered
        left: TOP_ROW.left + BANNER_GUTTER,
        width: bannerW,
      }}
    >
      {/* the banner hangs from its two balloon clusters: rides their lift a beat late, tilts with uneven lift, swings below them */}
      <div style={{ transform: `translate(${float.dx.toFixed(2)}px, ${float.dy.toFixed(2)}px) rotate(${float.tilt.toFixed(3)}deg)`, transformOrigin: "50% 0%" }}>
    <div
      style={{
        position: "relative",
        width: bannerW,
        boxSizing: "border-box",
        justifyContent: "center",
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: `${PAD_Y}px 28px`,
        borderRadius: RADIUS,
        // Marquee plate: the hint card's dark glass face inside a bevelled accent rim (border-box layer).
        border: `${RIM}px solid transparent`,
        background: [
          `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 100%) padding-box`,
          `linear-gradient(180deg, ${theme.panel[0]} 0%, ${theme.panel[1]} 100%) padding-box`,
          `linear-gradient(180deg, ${shade(theme.accent, 0.5)} 0%, ${theme.accent} 35%, ${shade(theme.accent, -0.45)} 70%, ${shade(theme.accent, 0.2)} 100%) border-box`,
        ].join(", "),
        boxShadow: [
          // extruded depth under the plate, then the red glow and a soft drop shadow
          `0 10px 0 ${shade(theme.accent, -0.75)}`,
          `0 10px 0 2px rgba(0,0,0,0.35)`,
          `0 0 ${30 + 30 * beat + 50 * flare}px ${theme.accent}${flare > 0.3 ? "cc" : "66"}`,
          "0 30px 50px rgba(0,0,0,0.6)",
          `inset 0 0 40px ${theme.accent}14`,
        ].join(", "),
        transform: `scale(${scale}) rotate(-1.5deg)`,
        transformOrigin: "0% 50%",
        whiteSpace: "nowrap",
      }}
    >
      {/* balloon clusters tied to the top corners: blue "Like" (left), red "Subscribe" (right) */}
      {balloons > 0.001 && (
        <>
          <div style={{ position: "absolute", left: 22, top: -RIM, opacity: balloons }}>
            <BalloonCluster side="left" t={t} lead={float.lead.left} />
          </div>
          <div style={{ position: "absolute", right: 22, top: -RIM, opacity: balloons }}>
            <BalloonCluster side="right" t={t} lead={float.lead.right} />
          </div>
        </>
      )}
      {/* light sheen sweeping across the plate */}
      <span style={{ position: "absolute", inset: 0, borderRadius: RADIUS - RIM, overflow: "hidden", pointerEvents: "none" }}>
        <span
          style={{
            position: "absolute",
            top: -20,
            bottom: -20,
            left: `${sheen}%`,
            width: 90,
            transform: "skewX(-20deg)",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
          }}
        />
      </span>
      <span style={{ ...labelStyle, textAlign: "center" }}>
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {line.split(" ").map((word, i) => (
              <React.Fragment key={i}>
                {i > 0 && " "}
                {EMPHASIS.test(word.replace(/[^A-Z0-9%]/g, "")) ? (
                  <EmphasisWord word={word} frame={sinceSlam} hold={back} size={fontSize} shadow={textExtrude} color={theme.accent} />
                ) : (
                  word
                )}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </span>
    </div>
      </div>
    </div>
  );
};
