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

  // Lives are lost from the RIGHT end of the row toward the left; on the loop reset they
  // drop back in the order they were lost.
  const slots = Array.from({ length: lives }, (_, i) => {
    const order = lives - 1 - i;
    const hitAt = wrongFrames[order];
    const hit = hitAt !== undefined && frame >= hitAt;
    const since = hit ? frame - hitAt : -1;
    const restore = hit ? loopReset(frame, durationInFrames, fps, 0.1 + 0.08 * order, 0.55 + 0.08 * order) : 0;
    // 1 = pawn standing on the ledge (drives its contact shadow).
    const presence = !hit ? 1 : Math.max(1 - ramp(since / fps, [FALL.tipAt, FALL.tipAt + 0.15], [0, 1]), restore);
    return { since, restore, presence };
  });

  const falling = slots.some((sl) => sl.since >= 0 && sl.restore === 0 && sl.since / fps < FALL.tipAt + 1.2);

  return (
    // Same horizontal band as the keyboard (left crop → action rail), so the pawns centre on the keys.
    // While a pawn is falling, the row draws above the keyboard so the pawn drops in front of it.
    <div style={{ position: "absolute", left: SAFE_ZONE.left, right: RIGHT_RAIL.width, top, height: 200, zIndex: falling ? 3 : undefined }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: PAWN_GAP,
          opacity: 1 - outro,
          transform: `translateY(${-outro * 40}px)`,
        }}
      >
        <Ledge lives={lives} presence={slots.map((sl) => sl.presence)} />
        {slots.map((sl, i) => (
          <LifePawn key={i} theme={theme} since={sl.since} fps={fps} restore={sl.restore} />
        ))}
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
const PAWN_GAP = 34;
/** Pawn box is centred in the 200 px row; the base ellipse spans ~85–96 % of the SVG height. */
const PAWN_H = PAWN * 1.6;
const FOOT_TOP = 100 - PAWN_H / 2 + PAWN_H * 0.82; // top of the lower base ellipse
const FOOT_BOTTOM = 100 - PAWN_H / 2 + PAWN_H * 0.965;
/** Ledge top surface (seen from slightly above) holds the whole foot, front face below it. */
const TOP_FACE = { top: FOOT_TOP - 10, height: FOOT_BOTTOM - FOOT_TOP + 22 };
const FRONT_FACE = 26;

/**
 * Dark-wood ledge the pawns stand on: a lit top surface deep enough for the
 * whole pawn foot, a brass-lipped front edge, the front face, a drop shadow,
 * and a contact shadow under each pawn.
 */
const Ledge: React.FC<{ lives: number; presence: number[] }> = ({ lives, presence }) => {
  const width = lives * PAWN + (lives - 1) * PAWN_GAP + 2 * 70;
  const frontTop = TOP_FACE.top + TOP_FACE.height;
  return (
    <div style={{ position: "absolute", left: "50%", top: 0, width, marginLeft: -width / 2, height: 200, pointerEvents: "none" }}>
      {/* drop shadow under the ledge */}
      <div style={{ position: "absolute", left: 10, right: 10, top: frontTop + FRONT_FACE - 6, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.8)", filter: "blur(14px)" }} />
      {/* top surface: back edge darker (further from the lamp), front edge catches the light */}
      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          top: TOP_FACE.top,
          height: TOP_FACE.height,
          borderRadius: "14px 14px 0 0",
          background:
            "linear-gradient(180deg, #2a160a 0%, #4a2a14 45%, #6b4220 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 46px, rgba(0,0,0,0.06) 46px 104px)",
          boxShadow: "inset 0 6px 10px rgba(0,0,0,0.55)",
        }}
      />
      {/* contact shadows under each pawn, on the top surface */}
      {Array.from({ length: lives }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: FOOT_BOTTOM - 12,
            left: 70 + i * (PAWN + PAWN_GAP) - 8,
            width: PAWN + 16,
            height: 16,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.6)",
            filter: "blur(4px)",
            opacity: presence[i] ?? 1,
          }}
        />
      ))}
      {/* brass lip + front face */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: frontTop,
          height: FRONT_FACE,
          borderRadius: "4px 4px 12px 12px",
          background: "linear-gradient(180deg, #e6c27a 0px, #a8803f 3px, #4a2a12 6px, #2c170a 60%, #140904 100%)",
          boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
};

/** Fall timing (seconds after the wrong guess) and motion. */
const FALL = { tipAt: 0.18, g: 5200, spin: 260, drift: 140 } as const;

/**
 * One life. `since` = frames since it was lost (-1 while alive).
 *  0 → 0.18 s   red flash + punch (1.3× → 1×) + shudder, still on the ledge
 *  0.18 s →     tips forward off the ledge and drops off the bottom of the screen
 *               with gravity, spinning and drifting sideways (gone after ~0.9 s)
 * `restore` 0 → 1 (loop reset): the cream pawn drops back onto the ledge from above.
 */
const LifePawn: React.FC<{ theme: Theme; since: number; fps: number; restore?: number }> = ({ theme, since, fps, restore = 0 }) => {
  const alive = (
    <div style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.7))", opacity: 0.95 }}>
      <Pawn color={theme.piece} size={PAWN} />
    </div>
  );
  if (since < 0 || restore >= 1) return alive;

  // Loop reset: drop back in from above with a small settle.
  if (restore > 0) {
    const y = -520 * (1 - restore) ** 2;
    return <div style={{ transform: `translateY(${y.toFixed(1)}px)`, opacity: Math.min(1, restore * 3) }}>{alive}</div>;
  }

  const s = since / fps;
  const punch = spring({ frame: since, fps, config: { damping: 12, stiffness: 420, mass: 0.6 } });
  const scale = interpolate(punch, [0, 1], [1.3, 1]);
  const shudder = s < FALL.tipAt ? Math.sin(since * 2.4) * 9 * (1 - s / FALL.tipAt) : 0;
  const redness = ramp(s, [0, 0.12, 0.45], [1, 1, 0.35]);

  // Fall: tip forward over the front edge, then free-fall.
  const tf = Math.max(0, s - FALL.tipAt);
  if (tf > 1.1) return <div style={{ width: PAWN, height: PAWN * 1.6 }} />; // long gone; keep its slot
  const tip = ramp(tf, [0, 0.12], [0, 1]);
  const fallY = 0.5 * FALL.g * tf * tf + 30 * tip;
  const rot = 28 * tip + FALL.spin * tf;
  const driftX = FALL.drift * tf;

  return (
    <div
      style={{
        position: "relative",
        width: PAWN,
        height: PAWN * 1.6,
        transform: `translate(${(shudder + driftX).toFixed(2)}px, ${fallY.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${scale})`,
        transformOrigin: "50% 85%",
        filter: `drop-shadow(0 0 ${(10 + 40 * redness).toFixed(1)}px ${theme.wrong}${redness > 0.5 ? "dd" : "88"}) drop-shadow(0 12px 16px rgba(0,0,0,0.6))`,
      }}
    >
      <Pawn color={redness > 0.6 ? theme.wrong : redness > 0.45 ? "#b2382e" : "#5a3b30"} size={PAWN} />
    </div>
  );
};
