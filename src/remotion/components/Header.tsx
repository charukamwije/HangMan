import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { HookBanner } from "./HookBanner";
import { DESIGN_WIDTH, SAFE_ZONE } from "../constants";
import { HOOK_INTRO_TEXT } from "../hook";

/** Same 60px margin inside the safe band on both sides, so the header centres on the safe area. */
const HEADER_INSET = { left: SAFE_ZONE.left + 60, right: SAFE_ZONE.right + 60 };
const HEADER_WIDTH = DESIGN_WIDTH - HEADER_INSET.left - HEADER_INSET.right; // 1740

const categorySize = (text: string) => {
  const longestWord = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  // Anton ≈ 0.46em per glyph; keep the longest word on one line within the header width.
  return Math.min(176, Math.floor(HEADER_WIDTH / (longestWord * 0.5)), text.length > 34 ? 150 : 176);
};

/**
 * Hook banner (top-left), Category title (neon) and Subtitle hint (white).
 * No entrance animation: everything is on screen, at full opacity, on frame 0.
 * The banner opens on "DECODING BOARD..." and flips to `hookText` during `bannerFlip`.
 */
export const Header: React.FC<{ theme: Theme; hookText: string; category: string; subtitle: string; bannerFlip: readonly [number, number] }> = ({
  theme,
  hookText,
  category,
  subtitle,
  bannerFlip,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Travelling sheen across the category, one pass every 4 s.
  const shimmer = interpolate(((frame / fps) % 4) / 4, [0, 1], [-30, 130]);

  return (
    <>
      <HookBanner theme={theme} text={hookText} introText={HOOK_INTRO_TEXT} flip={bannerFlip} />

      <div style={{ position: "absolute", top: 660, left: HEADER_INSET.left, right: HEADER_INSET.right, textAlign: "center" }}>
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
