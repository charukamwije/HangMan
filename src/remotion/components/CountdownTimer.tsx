import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { countdownAt, formatClock } from "../timeline";
import { framesSinceLast, ramp, type Stress } from "../motion";
import { loopReset, loopResetStart } from "../loop";
import { COUNTDOWN_FROM } from "../constants";
import type { Theme } from "../themes";
import { BODY_FONT } from "../fonts";
import { DESIGN_WIDTH, TOP_ROW } from "../constants";

/** Compact clock at the right end of TOP_ROW (just below the platform's search/profile/more icons). */
export const CLOCK = { width: 400, height: 222, padding: "18px 0 22px", radius: 30, label: 30 } as const;

/**
 * Seven-segment LED clock "00:29" → "00:00" (1 Hz): the theme's neon accent for the first 20 s, red after. Visible from frame 0. Below 00:08 it
 * enters stress mode: every tick it punches (scale + glow) on the exact frames
 * the vignette throbs, because both read the same `Stress` value.
 */
export const CountdownTimer: React.FC<{ theme: Theme; tickFrames: number[]; stress: Stress }> = ({ theme, tickFrames, stress }) => {
  const S = CLOCK;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // Loop reset: the clock counts smoothly back up from where the video ends (00:00 for the full 30 s,
  // e.g. 00:10 for a 20 s cut) to 00:29 (each new digit pops), so the replay starts on 00:29.
  const reset = loopReset(frame, durationInFrames, fps, 0.2, 0.95);
  const atCut = countdownAt(loopResetStart(durationInFrames, fps), fps);
  const remaining = reset > 0 ? Math.round(atCut + (COUNTDOWN_FROM - atCut) * reset) : countdownAt(frame, fps);
  const text = formatClock(remaining);
  const rollPop = reset > 0 && reset < 1 ? 0.06 : 0;

  const sinceTick = framesSinceLast(tickFrames, frame) / fps;
  const flash = ramp(sinceTick, [0, 0.33], [1, 0]);
  const { pulse, level, active } = stress;

  const scale = 1 + 0.14 * pulse * Math.max(0.5, level);
  const glow = 26 + 18 * flash + (40 + 70 * pulse) * level;
  const borderW = 5 + 5 * level;
  const done = remaining === 0 && reset === 0;
  const doneBlink = done ? 0.65 + 0.35 * Math.cos(sinceTick * 10) : 1;

  // LED brightness: a small flicker on every tick, brighter + throbbing under stress, blinking at 00:00.
  const led = Math.min(1, (0.88 + 0.12 * flash + 0.12 * pulse * level) * doneBlink);

  const light = theme.mode === "light";
  // The theme's neon accent for the first GREEN_SECONDS of the reel (00:29 → 00:10), red from then on. The loop
  // reset counts back up past 00:10, so the replay opens green again.
  const green = remaining > COUNTDOWN_FROM - GREEN_SECONDS;
  const c = green ? rgbOf(theme.accent) : RED; // "r,g,b" of the LED colour
  const ledOn = green ? theme.accent : light ? LED_ON_LIGHT : LED_ON;
  const ledOff = light ? `rgba(${c},0.08)` : `rgba(${c},0.07)`;
  // Light themes: cream glass panel (same as the header card) with a soft warm shadow; red ring/glow only under stress.
  const panelStyle: React.CSSProperties = light
    ? {
        background: `radial-gradient(120% 90% at 50% 40%, rgba(${c},${(0.1 * pulse * level).toFixed(3)}), transparent 70%), linear-gradient(180deg, ${theme.panel[0]}, ${theme.panel[1]})`,
        border: `${borderW}px solid ${theme.panelBorder}`,
        boxShadow: [
          `0 0 0 3px rgba(${c},${(0.12 + 0.4 * level).toFixed(3)})`,
          `0 0 ${glow * level}px rgba(${c},${(0.35 * level).toFixed(3)})`,
          `inset 0 0 ${30 + 40 * pulse}px rgba(${c},${(0.12 * pulse * level).toFixed(3)})`,
          "inset 0 3px 0 rgba(255,255,255,0.8)",
          `0 24px 48px rgba(${theme.shade},0.22)`,
        ].join(", "),
      }
    : {
        // Smoked-glass LED panel in a dark bezel.
        background: green
          ? `radial-gradient(120% 90% at 50% 40%, rgba(${c},${0.12 + 0.06 * pulse * level}), rgba(4,5,0,0.95) 70%), #030400`
          : `radial-gradient(120% 90% at 50% 40%, rgba(60,0,0,${0.55 + 0.25 * pulse * level}), rgba(8,0,0,0.95) 70%), #050000`,
        border: `${borderW}px solid ${green ? "#121405" : "#1a0505"}`,
        boxShadow: [
          `0 0 0 3px rgba(${c},${0.25 + 0.35 * level})`,
          `0 0 ${glow}px rgba(${c},${0.35 + 0.35 * level})`,
          `0 0 ${glow * 2.2 * level}px rgba(${c},0.35)`,
          `inset 0 0 ${40 + 60 * pulse}px rgba(${c},${(0.12 + 0.3 * pulse * level).toFixed(3)})`,
          "inset 0 3px 0 rgba(255,255,255,0.06)",
          "0 30px 60px rgba(0,0,0,0.6)",
        ].join(", "),
      };
  const ledGlow = light ? 2 + 6 * flash + 10 * pulse * level : 10 + 14 * flash;

  return (
    <div
      style={{
        position: "absolute",
        top: TOP_ROW.top,
        right: DESIGN_WIDTH - TOP_ROW.right,
        width: S.width,
        padding: S.padding,
        borderRadius: S.radius,
        ...panelStyle,
        transform: `scale(${scale + rollPop})`,
        transformOrigin: "100% 0%",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: BODY_FONT,
          fontWeight: 800,
          fontSize: S.label,
          letterSpacing: "0.32em",
          color: ledOn,
          textShadow: light ? "none" : `0 0 12px ${ledOn}`,
          opacity: (0.75 + 0.25 * level) * (done ? doneBlink : 1),
          marginBottom: 10,
          paddingLeft: "0.32em",
        }}
      >
        {done ? "TIME'S UP" : active ? "HURRY UP" : "TIME LEFT"}
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, filter: `drop-shadow(0 0 ${ledGlow}px ${ledOn}${light ? "66" : "aa"})` }}>
        {/* fixed-width seven-segment digits so the clock never jitters */}
        {text.split("").map((c, i) =>
          c === ":" ? (
            <LedColon key={i} height={DIGIT_H} brightness={led} on={ledOn} />
          ) : (
            <LedDigit key={i} digit={Number(c)} height={DIGIT_H} brightness={led} on={ledOn} off={ledOff} />
          ),
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------ seven-segment
const LED_ON = "#ff2a1f";
/** Light themes: a deeper red reads better on cream. */
const LED_ON_LIGHT = "#e01b12";
/** Seconds the clock shows the theme's neon accent before turning red. */
const GREEN_SECONDS = 20;
/** "r,g,b" for the red phase's panel rings / glows. */
const RED = "255,40,30";
/** "#rrggbb" → "r,g,b". */
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
const DIGIT_H = 124;

/** Segment polygons on a 60×100 grid (classic hexagonal LED segments, slight italic via skew). */
const SEG: Record<string, string> = {
  a: "10,4 50,4 44,11 16,11",
  b: "51,6 55,10 55,46 51,50 45,45 45,13",
  c: "51,52 55,56 55,90 51,94 45,87 45,57",
  d: "16,89 44,89 50,96 10,96",
  e: "9,52 15,57 15,87 9,94 5,90 5,56",
  f: "9,6 15,13 15,45 9,50 5,46 5,10",
  g: "11,50 16,46 44,46 49,50 44,54 16,54",
};
const DIGIT_SEGMENTS = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"];

const LedDigit: React.FC<{ digit: number; height: number; brightness: number; on: string; off: string }> = ({ digit, height, brightness, on: onColor, off }) => {
  const on = DIGIT_SEGMENTS[digit] ?? "";
  return (
    <svg viewBox="0 0 60 100" width={height * 0.6} height={height} style={{ overflow: "visible", transform: "skewX(-6deg)" }}>
      {Object.entries(SEG).map(([k, pts]) => (
        <polygon key={k} points={pts} fill={on.includes(k) ? onColor : off} opacity={on.includes(k) ? brightness : 1} />
      ))}
    </svg>
  );
};

const LedColon: React.FC<{ height: number; brightness: number; on: string }> = ({ height, brightness, on }) => (
  <svg viewBox="0 0 16 100" width={height * 0.16} height={height} style={{ overflow: "visible" }}>
    <rect x="3" y="28" width="10" height="10" rx="2" fill={on} opacity={brightness} />
    <rect x="3" y="62" width="10" height="10" rx="2" fill={on} opacity={brightness} />
  </svg>
);

const hex2 = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
