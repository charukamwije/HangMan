import React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";
import { loopReset } from "../loop";
import { TOP_ROW } from "../constants";

import { CLOCK } from "./CountdownTimer";

/** Left end of TOP_ROW, 60 px clear of the clock. */
const MAX_WIDTH = TOP_ROW.right - TOP_ROW.left - CLOCK.width - 60;
const MAX_FONT = 66;
const fontSizeFor = (text: string) => Math.min(MAX_FONT, Math.floor((MAX_WIDTH - 150) / (Math.max(1, text.length) * 0.56)));

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

  const labelStyle: React.CSSProperties = {
    gridArea: "1 / 1",
    fontFamily: DISPLAY_FONT,
    fontSize,
    lineHeight: 1,
    letterSpacing: "0.06em",
    color: "#FFFFFF",
    textShadow: "0 4px 0 rgba(0,0,0,0.35), 0 0 24px rgba(0,0,0,0.4)",
    paddingTop: 6,
  };

  return (
    <div
      style={{
        position: "absolute",
        top: TOP_ROW.top + (CLOCK.height - (MAX_FONT + 52)) / 2, // vertically centred on the clock
        left: TOP_ROW.left,
        maxWidth: MAX_WIDTH,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "16px 40px 16px 32px",
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
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: theme.accent,
          boxShadow: `0 0 ${12 + 22 * beat}px ${theme.accent}`,
          opacity: 0.55 + 0.45 * beat,
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
        <span style={{ ...labelStyle, opacity: labelIn, transform: `translateY(${(labelIn - 1) * slide}px)` }}>{label}</span>
      </span>
    </div>
  );
};
