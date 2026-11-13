import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LOWER_SAFE_CENTER_X, LOWER_SAFE_WIDTH } from "../constants";
import { BODY_FONT } from "../fonts";
import { loopReset } from "../loop";
import type { Theme } from "../themes";

/**
 * Small one-line nudge just below the keyboard, inviting viewers to comment their guess.
 * Visible from frame 0 through the countdown; it fades out as the end-of-video comment prompt
 * comes in (same spring as <LivesRow>'s outro) and fades back in during the loop reset, so the
 * replay opens with it showing.
 */
export const CommentNote: React.FC<{ theme: Theme; top: number; promptFrame: number }> = ({ theme, top, promptFrame }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const outro =
    spring({ frame: frame - promptFrame, fps, config: { damping: 14 } }) * (1 - loopReset(frame, durationInFrames, fps, 0.05, 0.35));

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: LOWER_SAFE_CENTER_X - LOWER_SAFE_WIDTH / 2,
        width: LOWER_SAFE_WIDTH,
        textAlign: "center",
        fontFamily: BODY_FONT,
        fontWeight: 600,
        fontSize: 44,
        lineHeight: 1.2,
        letterSpacing: "0.02em",
        color: theme.text,
        opacity: 0.82 * (1 - outro),
        textShadow: theme.mode === "light" ? "none" : "0 2px 8px rgba(0,0,0,0.8)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 900, color: theme.mode === "light" ? theme.wrong : theme.accent }}>Note:</span> Think you know it? Comment your guess before time's up!
    </div>
  );
};
