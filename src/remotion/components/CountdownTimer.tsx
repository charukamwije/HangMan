import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { countdownAt, formatClock } from "../timeline";
import { framesSinceLast, ramp, type Stress } from "../motion";
import { loopReset } from "../loop";
import { COUNTDOWN_FROM } from "../constants";
import type { Theme } from "../themes";
import { BODY_FONT } from "../fonts";
import { DESIGN_WIDTH, TOP_ROW } from "../constants";

/** Compact clock at the right end of TOP_ROW (just below the platform's search/profile/more icons). */
export const CLOCK = { width: 400, height: 222, padding: "18px 0 22px", radius: 30, label: 30 } as const;

/**
 * Red seven-segment LED clock "00:29" → "00:00" (1 Hz). Visible from frame 0. Below 00:08 it
 * enters stress mode: every tick it punches (scale + glow) on the exact frames
 * the vignette throbs, because both read the same `Stress` value.
 */
export const CountdownTimer: React.FC<{ theme: Theme; tickFrames: number[]; stress: Stress }> = ({ theme, tickFrames, stress }) => {
  const S = CLOCK;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // Loop reset: 00:00 counts smoothly back up to 00:29 (each new digit pops), so the replay starts on 00:29.
  const reset = loopReset(frame, durationInFrames, fps, 0.2, 0.95);
  const remaining = reset > 0 ? Math.round(COUNTDOWN_FROM * reset) : countdownAt(frame, fps);
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
  const ledOn = light ? LED_ON_LIGHT : LED_ON;
  const ledOff = light ? LED_OFF_LIGHT : LED_OFF;
  // Light themes: cream glass panel (same as the header card) with a soft warm shadow; red ring/glow only under stress.
  const panelStyle: React.CSSProperties = light
    ? {
        background: `radial-gradient(120% 90% at 50% 40%, rgba(255,60,40,${(0.1 * pulse * level).toFixed(3)}), transparent 70%), linear-gradient(180deg, ${theme.panel[0]}, ${theme.panel[1]})`,
        border: `${borderW}px solid ${theme.panelBorder}`,
        boxShadow: [
          `0 0 0 3px rgba(220,40,30,${(0.12 + 0.4 * level).toFixed(3)})`,
          `0 0 ${glow * level}px rgba(255,40,30,${(0.35 * level).toFixed(3)})`,
          `inset 0 0 ${30 + 40 * pulse}px rgba(255,40,30,${(0.12 * pulse * level).toFixed(3)})`,
          "inset 0 3px 0 rgba(255,255,255,0.8)",
          `0 24px 48px rgba(${theme.shade},0.22)`,
        ].join(", "),
      }
    : {
        // Smoked-glass LED panel in a dark bezel.
        background: `radial-gradient(120% 90% at 50% 40%, rgba(60,0,0,${0.55 + 0.25 * pulse * level}), rgba(8,0,0,0.95) 70%), #050000`,
        border: `${borderW}px solid #1a0505`,
        boxShadow: [
          `0 0 0 3px rgba(255,40,30,${0.25 + 0.35 * level})`,
          `0 0 ${glow}px rgba(255,30,20,${0.35 + 0.35 * level})`,
          `0 0 ${glow * 2.2 * level}px rgba(255,30,20,0.35)`,
          `inset 0 0 ${40 + 60 * pulse}px rgba(255,30,20,${(0.12 + 0.3 * pulse * level).toFixed(3)})`,
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
          textShadow: light ? "none" : `0 0 12px ${LED_ON}`,
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
const LED_OFF = "rgba(255,40,30,0.07)";
/** Light themes: a deeper red reads better on cream; unlit segments are a faint warm ghost. */
const LED_ON_LIGHT = "#e01b12";
const LED_OFF_LIGHT = "rgba(150,40,25,0.07)";
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
