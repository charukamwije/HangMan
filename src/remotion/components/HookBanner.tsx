import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";
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
const fontSizeFor = (text: string) => Math.min(MAX_FONT, Math.floor((MAX_WIDTH - 150) / (Math.max(1, text.length) * 0.56)));

/** Hook-text word that gets a focus punch the moment the banner flip lands. */
const EMPHASIS = "SOLVE";

/** Plate corner radius and rim width (colours come from the theme, like the hint card). */
const RADIUS = 34;
const RIM = 6;

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Micro-zoom (1.16× → 1×) that decays over ~8 frames from the frame the hook text
 * has fully landed (`frame` = 0). Inline-block transform only, so the pill never re-lays out.
 */
const EmphasisWord: React.FC<{ word: string; frame: number; size: number; shadow: string; color: string }> = ({ word, frame, size, shadow, color }) => {
  const k = frame >= 0 ? ramp(frame, [0, 8], [1, 0]) : 0;
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
 * Top-left banner. Opens on `introText` ("DECODING BOARD...") with a frame-0
 * punch (scale 1.1 → 1), then over `flip` the intro slides down and out while
 * `text` slides down into place. Both labels share one grid cell, so the pill
 * is sized by the longer label and never jumps. The rim glow throbs
 * about once a second throughout.
 */
export const HookBanner: React.FC<{
  theme: Theme;
  text: string;
  introText: string;
  flip: readonly [number, number];
}> = ({ theme, text, introText, flip }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const label = (text.trim() || "GUESS THE WORD").toUpperCase();
  const intro = introText.toUpperCase();
  const fontSize = fontSizeFor(intro.length > label.length ? intro : label);

  const punch = spring({ frame, fps, config: { damping: 9, stiffness: 180, mass: 0.6 } });
  // Loop reset (last ~45 %): hook text slides back out, "DECODING BOARD." slides back in, and the
  // pill grows to 1.1× — exactly the frame-0 punch state, so the replay continues seamlessly.
  const back = loopReset(frame, durationInFrames, fps, 0.55, 1);
  const scale = interpolate(punch, [0, 1], [1.1, 1]) * (1 + 0.1 * back);
  const beat = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 1.1); // ~1.1 Hz, peaks on frame 0

  // Crisp sequential slide-down flip (never two labels legible at once):
  // intro drops out over the first 40 % of the window, hook text drops in over the rest.
  const [a, b] = flip;
  const mid = a + Math.round((b - a) * 0.4);
  const introOut = Math.min(ramp(frame, [a, mid], [0, 1]), 1 - ramp(back, [0.4, 1], [0, 1]));
  const labelIn = Math.min(ramp(frame, [mid, b], [0, 1]), 1 - ramp(back, [0, 0.45], [0, 1]));
  const slide = fontSize * 1.1;

  // "DECODING BOARD..." stays crisp (no glitch jitter / RGB split); only the dots tick 1 → 3.
  const base = intro.replace(/\.+$/, "");
  const dots = intro.length - base.length;
  const dotsShown = dots ? (back > 0 ? 1 : 1 + (Math.floor(frame / 3) % dots)) : 0;

  // Fixed pill width (sized for the longer label), so the balloon strings know exactly where the corners are.
  const bannerW = Math.min(MAX_WIDTH, Math.ceil(2 * RIM + 28 + 28 + 8 + Math.max(intro.length, label.length) * fontSize * 0.52));
  const float = bannerFloat(t, bannerW);
  // Sheen pass every 3.75 s (8 per 30 s, so it wraps cleanly on the loop).
  const sheen = interpolate((t % 3.75) / 3.75, [0, 0.35, 1], [-30, 120, 120]);
  // Clean, legible letters: a thin dark outline plus one crisp drop shadow (no smeared extrusion).
  const ex = theme.mode === "dark" ? "#050505" : "#fff8ec";
  const textExtrude = `0 4px 0 ${ex}, 0 0 18px ${theme.accent}40, 0 6px 10px rgba(0,0,0,0.35)`;

  const labelStyle: React.CSSProperties = {
    gridArea: "1 / 1",
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
        top: TOP_ROW.top + (CLOCK.height - (MAX_FONT * 1.1 + 4 + 2 * PAD_Y + 2 * RIM)) / 2 + LOWER, // clock-centred, then lowered
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
          `0 0 ${30 + 30 * beat}px ${theme.accent}66`,
          "0 30px 50px rgba(0,0,0,0.6)",
          `inset 0 0 40px ${theme.accent}14`,
        ].join(", "),
        transform: `scale(${scale}) rotate(-1.5deg)`,
        transformOrigin: "0% 50%",
        whiteSpace: "nowrap",
      }}
    >
      {/* balloon clusters tied to the top corners: blue "Like" (left), red "Subscribe" (right) */}
      <div style={{ position: "absolute", left: 22, top: -RIM }}>
        <BalloonCluster side="left" t={t} lead={float.lead.left} />
      </div>
      <div style={{ position: "absolute", right: 22, top: -RIM }}>
        <BalloonCluster side="right" t={t} lead={float.lead.right} />
      </div>
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
      <span style={{ display: "grid", overflow: "hidden" }}>
        {introOut < 1 && (
          <span
            style={{
              ...labelStyle,
              opacity: 1 - introOut,
              transform: `translateY(${introOut * slide}px)`,
            }}
          >
            {base}
            {Array.from({ length: dots }, (_, i) => (
              <span key={i} style={{ opacity: i < dotsShown ? 1 : 0 }}>
                .
              </span>
            ))}
          </span>
        )}
        <span style={{ ...labelStyle, opacity: labelIn, transform: `translateY(${(labelIn - 1) * slide}px)` }}>
          {label.split(" ").map((word, i) => (
            <React.Fragment key={i}>
              {i > 0 && " "}
              {word.replace(/[^A-Z]/g, "") === EMPHASIS ? <EmphasisWord word={word} frame={frame - b} size={fontSize} shadow={textExtrude} color={theme.accent} /> : word}
            </React.Fragment>
          ))}
        </span>
      </span>
    </div>
      </div>
    </div>
  );
};
