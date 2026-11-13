import React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";
import { loopReset } from "../loop";
import { TOP_ROW } from "../constants";

import { CLOCK } from "./CountdownTimer";
import { crewState, Holders, MOUSE_W, PinnerAndPin } from "./BannerCrew";

/** Left end of TOP_ROW, 60 px clear of the clock, leaving room for a holder mouse at each end. */
const MAX_WIDTH = TOP_ROW.right - TOP_ROW.left - CLOCK.width - 60 - 2 * MOUSE_W;
const MAX_FONT = 66;
const fontSizeFor = (text: string) => Math.min(MAX_FONT, Math.floor((MAX_WIDTH - 150) / (Math.max(1, text.length) * 0.56)));

/** Hook-text word that gets a focus punch the moment the banner flip lands. */
const EMPHASIS = "SOLVE";

/** Marquee styling: gold trim/bulbs, plate corner radius and rim width. */
const GOLD = "#ffcf3a";
const RADIUS = 34;
const RIM = 6;
const BULB = 11;
const BULB_GAP = 34;

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Two rows of little marquee bulbs just inside the rim (top + bottom edge), lit in an
 * alternating chase that steps every 5 frames (period 10 frames: 90 per 30 s, seamless on the loop).
 */
const MarqueeBulbs: React.FC<{ width: number; frame: number }> = ({ width, frame }) => {
  const usable = width - 2 * RADIUS;
  const n = Math.max(2, Math.floor(usable / BULB_GAP) + 1);
  const step = usable / (n - 1);
  const phase = Math.floor(frame / 5) % 2;
  const bulb = (i: number, edge: "top" | "bottom") => {
    const on = (i + (edge === "top" ? 0 : 1) + phase) % 2 === 0;
    return (
      <span
        key={`${edge}-${i}`}
        style={{
          position: "absolute",
          left: RADIUS + i * step - BULB / 2,
          [edge]: 5,
          width: BULB,
          height: BULB,
          borderRadius: "50%",
          background: on ? `radial-gradient(circle at 40% 35%, #ffffff 0%, #fff1b0 35%, ${GOLD} 100%)` : "rgba(80,10,10,0.55)",
          boxShadow: on ? `0 0 10px ${GOLD}, 0 0 3px #ffffff` : "inset 0 1px 2px rgba(0,0,0,0.6)",
        }}
      />
    );
  };
  return (
    <span style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => bulb(i, "top"))}
      {Array.from({ length: n }, (_, i) => bulb(i, "bottom"))}
    </span>
  );
};

/**
 * Micro-zoom (1.25× → 1×) + chromatic-aberration split (cyan / yellow) that decays
 * over ~8 frames from the frame the hook text has fully landed (`frame` = 0).
 * Inline-block transform only, so the pill never re-lays out.
 */
const EmphasisWord: React.FC<{ word: string; frame: number; size: number; shadow: string }> = ({ word, frame, size, shadow }) => {
  const k = frame >= 0 ? ramp(frame, [0, 8], [1, 0]) : 0;
  const ease = k * k * (3 - 2 * k);
  const split = size * 0.08 * ease;
  return (
    <span
      style={{
        display: "inline-block",
        // grow the word's own box while it is zoomed, so it never overlaps its neighbours
        margin: `0 ${(size * 0.24 * ease).toFixed(1)}px`,
        transform: `scale(${1 + 0.16 * ease})`,
        transformOrigin: "50% 60%",
        // marquee gold, so the key word pops off the red plate
        color: GOLD,
        textShadow: split > 0.2 ? `${split}px 0 0 #3fd6ff, ${-split}px 0 0 #ffd400, 0 4px 0 rgba(0,0,0,0.35)` : shadow,
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
 * is sized by the longer label and never jumps. A red beacon and glow throb
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

  // "DECODING BOARD..." glitch: jitter + RGB split every ~2 frames, dots ticking 1 → 3.
  const glitching = frame > 0 && frame < a && random(`glitch-${frame}`) > 0.45;
  const jitterX = glitching ? (random(`gx-${frame}`) - 0.5) * fontSize * 0.18 : 0;
  const split = glitching ? fontSize * 0.06 : 0;
  const base = intro.replace(/\.+$/, "");
  const dots = intro.length - base.length;
  const dotsShown = dots ? (back > 0 ? 1 : 1 + (Math.floor(frame / 3) % dots)) : 0;

  // Fixed pill width (sized for the longer label), so the holders know exactly where the corners are.
  const bannerW = Math.min(MAX_WIDTH, Math.ceil(26 + 24 + 32 + 40 + 8 + Math.max(intro.length, label.length) * fontSize * 0.6));
  const crew = crewState(t, bannerW);
  const holderBlink = t % 4 < 0.1;
  // Sheen pass every 3.75 s (8 per 30 s, so it wraps cleanly on the loop).
  const sheen = interpolate((t % 3.75) / 3.75, [0, 0.35, 1], [-30, 120, 120]);
  // Chunky 3D letters: a stepped dark-red extrusion under white faces, then a soft shadow.
  const ex = shade(theme.wrong, -0.6);
  const textExtrude = `0 2px 0 ${ex}, 0 4px 0 ${ex}, 0 6px 0 ${ex}, 0 9px 6px rgba(0,0,0,0.45)`;

  const labelStyle: React.CSSProperties = {
    gridArea: "1 / 1",
    fontFamily: DISPLAY_FONT,
    fontSize,
    lineHeight: 1,
    letterSpacing: "0.06em",
    color: "#FFFFFF",
    textShadow: textExtrude,
    paddingTop: 6,
  };

  return (
    <div
      style={{
        position: "absolute",
        top: TOP_ROW.top + (CLOCK.height - (MAX_FONT + 72)) / 2, // vertically centred on the clock
        left: TOP_ROW.left + MOUSE_W,
        width: bannerW,
      }}
    >
      <PinnerAndPin crew={crew} bannerW={bannerW} />
      {/* the banner swings around whichever top corner is still held */}
      <div style={{ transform: crew.angle ? `rotate(${crew.angle.toFixed(2)}deg)` : undefined, transformOrigin: crew.origin }}>
    <div
      style={{
        position: "relative",
        width: bannerW,
        boxSizing: "border-box",
        justifyContent: "center",
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "22px 40px 22px 30px",
        borderRadius: RADIUS,
        // Marquee plate: glossy red face inside a bevelled gold rim (border-box layer).
        border: `${RIM}px solid transparent`,
        background: [
          `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.18) 100%) padding-box`,
          `linear-gradient(180deg, ${theme.wrong} 0%, ${shade(theme.wrong, -0.35)} 100%) padding-box`,
          `linear-gradient(180deg, #fff3b8 0%, ${GOLD} 30%, #b7781c 62%, #ffe08a 100%) border-box`,
        ].join(", "),
        boxShadow: [
          // extruded depth under the plate, then the red glow and a soft drop shadow
          `0 10px 0 ${shade(theme.wrong, -0.62)}`,
          `0 10px 0 2px rgba(0,0,0,0.35)`,
          `0 0 ${30 + 40 * beat}px ${theme.wrong}99`,
          "0 30px 50px rgba(0,0,0,0.6)",
          `inset 0 -6px 12px ${shade(theme.wrong, -0.55)}`,
        ].join(", "),
        transform: `scale(${scale}) rotate(-1.5deg)`,
        transformOrigin: "0% 50%",
        whiteSpace: "nowrap",
      }}
    >
      {/* chasing marquee bulbs along the top and bottom edges */}
      <MarqueeBulbs width={bannerW - 2 * RIM} frame={frame} />
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
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)",
          }}
        />
      </span>
      {/* beacon bulb */}
      <span
        style={{
          position: "relative",
          flex: "0 0 auto",
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${GOLD} 45%, #b7781c 100%)`,
          border: "3px solid rgba(70,10,10,0.55)",
          boxShadow: `0 0 ${10 + 24 * beat}px ${GOLD}, 0 0 ${4 + 8 * beat}px #ffffff`,
          opacity: 0.6 + 0.4 * beat,
        }}
      />
      <span style={{ display: "grid", overflow: "hidden" }}>
        {introOut < 1 && (
          <span
            style={{
              ...labelStyle,
              opacity: 1 - introOut,
              transform: `translate(${jitterX}px, ${introOut * slide}px)`,
              textShadow: split ? `${split}px 0 0 #3fd6ff, ${-split}px 0 0 #ffd400, 0 4px 0 rgba(0,0,0,0.35)` : labelStyle.textShadow,
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
              {word.replace(/[^A-Z]/g, "") === EMPHASIS ? <EmphasisWord word={word} frame={frame - b} size={fontSize} shadow={textExtrude} /> : word}
            </React.Fragment>
          ))}
        </span>
      </span>
    </div>
      </div>
      <Holders crew={crew} bannerW={bannerW} blink={holderBlink} />
    </div>
  );
};
