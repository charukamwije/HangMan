import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { HookBanner } from "./HookBanner";

const categorySize = (text: string) => {
  const longestWord = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  // Anton ≈ 0.46em per glyph; keep the longest word on one line within 1880px.
  return Math.min(176, Math.floor(1880 / (longestWord * 0.5)), text.length > 34 ? 150 : 176);
};

/**
 * Hook banner (top-left), Category title (neon) and Subtitle hint (white).
 * No entrance animation: everything is on screen, at full opacity, on frame 0.
 */
export const Header: React.FC<{ theme: Theme; hookText: string; category: string; subtitle: string }> = ({ theme, hookText, category, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Travelling sheen across the category, one pass every 4 s.
  const shimmer = interpolate(((frame / fps) % 4) / 4, [0, 1], [-30, 130]);

  return (
    <>
      <HookBanner theme={theme} text={hookText} />

      <div style={{ position: "absolute", top: 660, left: 140, right: 140, textAlign: "center" }}>
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: categorySize(category),
            lineHeight: 1.04,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: theme.accent,
            textWrap: "balance",
            filter: `drop-shadow(0 0 22px ${theme.accent}99) drop-shadow(0 0 70px ${theme.accent}55) drop-shadow(0 10px 24px rgba(0,0,0,0.85))`,
            backgroundImage: `linear-gradient(100deg, ${theme.accent} ${shimmer - 12}%, #ffffff ${shimmer}%, ${theme.accent} ${shimmer + 12}%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {category}
        </div>
        <div style={{ marginTop: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 36 }}>
          <span style={{ flex: "0 0 120px", height: 4, background: `linear-gradient(90deg, transparent, ${theme.text}aa)` }} />
          <span
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 800,
              fontSize: 72,
              letterSpacing: "0.08em",
              color: theme.text,
              textTransform: "uppercase",
              textShadow: "0 6px 24px rgba(0,0,0,0.9)",
              textWrap: "balance",
            }}
          >
            {subtitle}
          </span>
          <span style={{ flex: "0 0 120px", height: 4, background: `linear-gradient(270deg, transparent, ${theme.text}aa)` }} />
        </div>
      </div>
    </>
  );
};
