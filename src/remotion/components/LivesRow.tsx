import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { BODY_FONT } from "../fonts";
import { MAX_LIVES } from "../constants";
import { Pawn } from "./ChessPieces";

/**
 * The "hangman" counter, told in chess: one pawn per allowed mistake.
 * Each wrong guess knocks a pawn over and stains it red. At the final reveal
 * the row hands over to a call-to-action. Visible from frame 0.
 */
export const LivesRow: React.FC<{ theme: Theme; wrongFrames: number[]; finalRevealFrame: number; top: number }> = ({
  theme,
  wrongFrames,
  finalRevealFrame,
  top,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lives = Math.max(MAX_LIVES, wrongFrames.length);
  const used = wrongFrames.filter((f) => f <= frame).length;
  const outro = spring({ frame: frame - finalRevealFrame - Math.round(0.33 * fps), fps, config: { damping: 14 } });

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, height: 200 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
          opacity: 1 - outro,
          transform: `translateY(${-outro * 40}px)`,
        }}
      >
        <span style={{ fontFamily: BODY_FONT, fontWeight: 900, fontSize: 50, letterSpacing: "0.2em", color: theme.text, opacity: 0.85, marginRight: 20 }}>
          MISTAKES <span style={{ color: used ? theme.wrong : theme.text }}>{used}</span>/{lives}
        </span>
        {Array.from({ length: lives }, (_, i) => {
          const hitAt = wrongFrames[i];
          const hit = hitAt !== undefined && frame >= hitAt;
          const fall = hit ? spring({ frame: frame - hitAt, fps, config: { damping: 11, stiffness: 140 } }) : 0;
          return (
            <div
              key={i}
              style={{
                transform: `rotate(${fall * 26}deg) translateY(${fall * 8}px) scale(${1 - fall * 0.08})`,
                transformOrigin: "50% 100%",
                filter: hit ? `drop-shadow(0 0 18px ${theme.wrong}aa)` : "drop-shadow(0 10px 14px rgba(0,0,0,0.7))",
                opacity: hit ? 0.95 : 0.92,
              }}
            >
              <Pawn color={hit ? theme.wrong : theme.piece} size={74} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: BODY_FONT,
          fontWeight: 900,
          fontSize: 86,
          letterSpacing: "0.12em",
          color: theme.text,
          textShadow: `0 0 30px ${theme.accent}66, 0 8px 30px rgba(0,0,0,0.9)`,
          opacity: outro,
          transform: `scale(${interpolate(outro, [0, 1], [0.7, 1])})`,
        }}
      >
        DID YOU GET IT?
      </div>
    </div>
  );
};
