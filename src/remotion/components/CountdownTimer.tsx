import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { countdownAt, formatClock } from "../timeline";
import { framesSinceLast, ramp, type Stress } from "../motion";
import { loopReset } from "../loop";
import { COUNTDOWN_FROM } from "../constants";
import type { Theme } from "../themes";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { DESIGN_WIDTH, TOP_ROW } from "../constants";

/** Compact clock at the right end of TOP_ROW (just below the platform's search/profile/more icons). */
export const CLOCK = { width: 400, height: 222, padding: "16px 0 20px", radius: 38, label: 32, digits: 140, digitW: 76, colonW: 38 } as const;

/**
 * Neon clock "00:29" → "00:00" (1 Hz). Visible from frame 0. Below 00:08 it
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

  return (
    <div
      style={{
        position: "absolute",
        top: TOP_ROW.top,
        right: DESIGN_WIDTH - TOP_ROW.right,
        width: S.width,
        padding: S.padding,
        borderRadius: S.radius,
        background: `linear-gradient(180deg, rgba(14,12,8,0.82), rgba(4,4,3,0.88)), ${theme.accent}${active ? hex2(0.18 * pulse) : "00"}`,
        border: `${borderW}px solid ${theme.accent}`,
        boxShadow: `0 0 ${glow}px ${theme.accent}${active ? "cc" : "88"}, 0 0 ${glow * 2.2 * level}px ${theme.accent}55, inset 0 0 ${40 + 60 * pulse}px ${theme.accent}${hex2(0.13 + 0.3 * pulse * level)}, 0 30px 60px rgba(0,0,0,0.6)`,
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
          fontSize: S.digits,
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
          <span key={i} style={{ display: "inline-block", width: c === ":" ? S.colonW : S.digitW, textAlign: "center" }}>
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
