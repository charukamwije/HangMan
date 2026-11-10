import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { countdownAt, formatClock } from "../timeline";
import { framesSinceLast, ramp, type Stress } from "../motion";
import type { Theme } from "../themes";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";

/**
 * Top-right neon clock "00:29" → "00:00" (1 Hz). Visible from frame 0. Below 00:08 it
 * enters stress mode: every tick it punches (scale + glow) on the exact frames
 * the vignette throbs, because both read the same `Stress` value.
 */
export const CountdownTimer: React.FC<{ theme: Theme; tickFrames: number[]; stress: Stress }> = ({ theme, tickFrames, stress }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const remaining = countdownAt(frame, fps);
  const text = formatClock(remaining);

  const sinceTick = framesSinceLast(tickFrames, frame) / fps;
  const flash = ramp(sinceTick, [0, 0.33], [1, 0]);
  const { pulse, level, active } = stress;

  const scale = 1 + 0.14 * pulse * Math.max(0.5, level);
  const glow = 26 + 18 * flash + (40 + 70 * pulse) * level;
  const borderW = 5 + 5 * level;
  const done = remaining === 0;
  const doneBlink = done ? 0.65 + 0.35 * Math.cos(sinceTick * 10) : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 270,
        right: 150,
        width: 620,
        padding: "28px 0 34px",
        borderRadius: 48,
        background: `linear-gradient(180deg, rgba(14,12,8,0.82), rgba(4,4,3,0.88)), ${theme.accent}${active ? hex2(0.18 * pulse) : "00"}`,
        border: `${borderW}px solid ${theme.accent}`,
        boxShadow: `0 0 ${glow}px ${theme.accent}${active ? "cc" : "88"}, 0 0 ${glow * 2.2 * level}px ${theme.accent}55, inset 0 0 ${40 + 60 * pulse}px ${theme.accent}${hex2(0.13 + 0.3 * pulse * level)}, 0 30px 60px rgba(0,0,0,0.6)`,
        transform: `scale(${scale})`,
        transformOrigin: "100% 0%",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: BODY_FONT,
          fontWeight: 800,
          fontSize: 46,
          letterSpacing: "0.32em",
          color: active ? theme.accent : theme.text,
          opacity: 0.8 + 0.2 * level,
          marginBottom: 2,
          paddingLeft: "0.32em",
        }}
      >
        {done ? "TIME'S UP" : active ? "HURRY UP" : "TIME LEFT"}
      </div>
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 190,
          lineHeight: 1,
          color: pulse > 0.75 ? "#FFFFFF" : theme.accent,
          opacity: doneBlink,
          textShadow: `0 0 18px ${theme.accent}, 0 0 ${glow * 1.6}px ${theme.accent}aa`,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* fixed-width digits so the clock never jitters */}
        {text.split("").map((c, i) => (
          <span key={i} style={{ display: "inline-block", width: c === ":" ? 52 : 104, textAlign: "center" }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
};

const hex2 = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
