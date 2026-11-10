import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";

const MAX_WIDTH = 1200; // space left of the countdown clock
const fontSizeFor = (text: string) => Math.min(96, Math.floor((MAX_WIDTH - 170) / (Math.max(1, text.length) * 0.56)));

/**
 * Urgent top-left banner ("95% FAIL THIS"). Fully opaque and legible on
 * frame 0 — it only *punches* (scale 1.1 → 1) so the first frame doubles as the
 * thumbnail. Afterwards a red beacon and glow throb about once a second.
 */
export const HookBanner: React.FC<{ theme: Theme; text: string }> = ({ theme, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const label = (text.trim() || "GUESS THE WORD").toUpperCase();

  const punch = spring({ frame, fps, config: { damping: 9, stiffness: 180, mass: 0.6 } });
  const scale = interpolate(punch, [0, 1], [1.1, 1]);
  const beat = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 1.1); // ~1.1 Hz, peaks on frame 0

  return (
    <div
      style={{
        position: "absolute",
        top: 340,
        left: 150,
        maxWidth: MAX_WIDTH,
        display: "flex",
        alignItems: "center",
        gap: 30,
        padding: "22px 52px 22px 40px",
        borderRadius: 999,
        background: `linear-gradient(180deg, ${theme.wrong}, #a8141a)`,
        border: "4px solid rgba(255,255,255,0.85)",
        boxShadow: `0 0 ${30 + 40 * beat}px ${theme.wrong}aa, 0 24px 50px rgba(0,0,0,0.65), inset 0 3px 0 rgba(255,255,255,0.35)`,
        transform: `scale(${scale}) rotate(-1.5deg)`,
        transformOrigin: "0% 50%",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          flex: "0 0 auto",
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: theme.accent,
          boxShadow: `0 0 ${12 + 22 * beat}px ${theme.accent}`,
          opacity: 0.55 + 0.45 * beat,
        }}
      />
      <span
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: fontSizeFor(label),
          lineHeight: 1,
          letterSpacing: "0.06em",
          color: "#FFFFFF",
          textShadow: "0 4px 0 rgba(0,0,0,0.35), 0 0 24px rgba(0,0,0,0.4)",
          paddingTop: 6,
        }}
      >
        {label}
      </span>
    </div>
  );
};
