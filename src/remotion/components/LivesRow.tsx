import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ramp } from "../motion";
import { loopReset } from "../loop";
import type { Theme } from "../themes";
import { BODY_FONT } from "../fonts";
import { MAX_LIVES, RIGHT_RAIL, SAFE_ZONE } from "../constants";
import { Pawn } from "./ChessPieces";

/**
 * The "hangman" counter, told in chess: one pawn per allowed mistake (no label), centred on the keyboard.
 * Each wrong guess "captures" a pawn: it takes a red hit, then settles as a dim
 * silhouette under a crimson ✖ (upright, so the row stays tidy). At the final reveal
 * the row hands over to a call-to-action. Visible from frame 0.
 */
export const LivesRow: React.FC<{ theme: Theme; wrongFrames: number[]; finalRevealFrame: number; top: number }> = ({
  theme,
  wrongFrames,
  finalRevealFrame,
  top,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const lives = Math.max(MAX_LIVES, wrongFrames.length);
  // Loop reset: "DID YOU GET IT?" hands back to the pawn row in the first 35 % of the reset.
  const outro =
    spring({ frame: frame - finalRevealFrame - Math.round(0.33 * fps), fps, config: { damping: 14 } }) * (1 - loopReset(frame, durationInFrames, fps, 0.05, 0.35));

  return (
    // Same horizontal band as the keyboard (left crop → action rail), so the pawns centre on the keys.
    <div style={{ position: "absolute", left: SAFE_ZONE.left, right: RIGHT_RAIL.width, top, height: 200 }}>
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
        {Array.from({ length: lives }, (_, i) => {
          const hitAt = wrongFrames[i];
          const hit = hitAt !== undefined && frame >= hitAt;
          // Loop reset: captured pawns come back to life one after another (left → right).
          const restore = hit ? loopReset(frame, durationInFrames, fps, 0.15 + 0.07 * i, 0.5 + 0.07 * i) : 0;
          return <LifePawn key={i} theme={theme} since={hit ? frame - hitAt : -1} fps={fps} restore={restore} />;
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

const PAWN = 74;
const DEAD_FILL = "#2a2421";

/**
 * One life. `since` = frames since it was lost (-1 while alive).
 * `restore` 0 → 1 (loop reset): the ✖ retracts and the cream pawn fades back in.
 *  0 → 0.1 s   red flash + punch (1.3× → 1×) + shudder
 *  0.05 → 0.3  fill fades to a dark silhouette, ✖ strokes draw on one after the other
 *  settled     dim pawn, crimson ✖, faint red glow
 */
const LifePawn: React.FC<{ theme: Theme; since: number; fps: number; restore?: number }> = ({ theme, since, fps, restore = 0 }) => {
  if (since < 0 || restore >= 1) {
    return (
      <div style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.7))", opacity: 0.95 }}>
        <Pawn color={theme.piece} size={PAWN} />
      </div>
    );
  }
  const s = since / fps;
  const punch = spring({ frame: since, fps, config: { damping: 12, stiffness: 420, mass: 0.6 } });
  const scale = interpolate(punch, [0, 1], [1.3, 1]);
  const shudder = since < fps * 0.25 ? Math.sin(since * 2.4) * 9 * (1 - since / (fps * 0.25)) : 0;
  const redness = ramp(s, [0, 0.08, 0.3], [1, 1, 0]); // red flash → dark silhouette
  // On restore the strokes retract in reverse order (second stroke first).
  const stroke1 = ramp(s, [0.05, 0.15], [0, 1]) * (1 - ramp(restore, [0.3, 0.8], [0, 1]));
  const stroke2 = ramp(s, [0.12, 0.22], [0, 1]) * (1 - ramp(restore, [0, 0.5], [0, 1]));
  const glow = 10 + 40 * redness;
  const LEN = 132; // ≈ length of each ✖ diagonal in viewBox units

  return (
    <div
      style={{
        position: "relative",
        transform: `translateX(${shudder.toFixed(2)}px) scale(${scale})`,
        transformOrigin: "50% 100%",
        filter: `drop-shadow(0 0 ${(glow * (1 - restore)).toFixed(1)}px ${theme.wrong}${redness > 0.2 ? "dd" : "88"}) drop-shadow(0 10px 14px rgba(0,0,0,${(0.7 * restore).toFixed(2)}))`,
      }}
    >
      <div style={{ opacity: (0.55 + 0.45 * redness) * (1 - restore) }}>
        <Pawn color={redness > 0.5 ? theme.wrong : DEAD_FILL} size={PAWN} />
      </div>
      {restore > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: restore * 0.95 }}>
          <Pawn color={theme.piece} size={PAWN} />
        </div>
      )}
      <svg viewBox="0 0 100 160" width={PAWN} height={PAWN * 1.6} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1="8" y1="38" x2="92" y2="138" stroke={theme.wrong} strokeWidth="12" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - stroke1)} />
        <line x1="92" y1="38" x2="8" y2="138" stroke={theme.wrong} strokeWidth="12" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - stroke2)} />
      </svg>
    </div>
  );
};
