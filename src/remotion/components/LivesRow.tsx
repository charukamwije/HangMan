import React from "react";
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ramp } from "../motion";
import { loopReset } from "../loop";
import type { Theme } from "../themes";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
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
    // Distance from this pawn's centre to just past the ledge's right end (where it jumps).
    const walkDist = ledgeWidth(lives) - LEDGE_PAD - (i * (PAWN + PAWN_GAP) + PAWN / 2) + 10;
    const presence = !hit ? 1 : Math.max(1 - ramp(since / fps, [ESCAPE.walkAt, ESCAPE.walkAt + 0.2], [0, 1]), restore);
    return { since, restore, presence, walkDist, seed: hitAt ?? i };
  });

  const falling = slots.some((sl) => sl.since >= 0 && sl.restore === 0 && sl.since / fps < escapeEnd(sl.walkDist));

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
          <LifePawn key={i} theme={theme} since={sl.since} fps={fps} restore={sl.restore} walkDist={sl.walkDist} seed={sl.seed} />
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
/** Ledge overhang beyond the first / last pawn. */
const LEDGE_PAD = 70;
const ledgeWidth = (lives: number) => lives * PAWN + (lives - 1) * PAWN_GAP + 2 * LEDGE_PAD;

/**
 * Dark-wood ledge the pawns stand on: a lit top surface deep enough for the
 * whole pawn foot, a brass-lipped front edge, the front face, a drop shadow,
 * and a contact shadow under each pawn.
 */
const Ledge: React.FC<{ lives: number; presence: number[] }> = ({ lives, presence }) => {
  const width = ledgeWidth(lives);
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
            left: LEDGE_PAD + i * (PAWN + PAWN_GAP) - 8,
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

/**
 * Wrong-guess escape (seconds after the guess): the pawn flashes red, sprouts arms
 * and legs, walks to the right end of the ledge, crouches, hops off and falls
 * tumbling off the bottom of the screen.
 */
const ESCAPE = {
  hit: 0.15, // red flash + shudder
  limbsAt: 0.12, // arms & legs pop out over 0.2 s
  walkAt: 0.34,
  minSpeed: 470, // average px/s; faster for long walks so it always leaves within ~1 s
  maxWalk: 1.0,
  crouch: 0.2, // anticipation squat before the jump
  hopUp: 760, // initial upward speed of the hop, px/s
  hopX: 300, // forward speed while airborne, px/s
  g: 3000, // a little floaty, so the arc reads clearly
  spin: 320, // deg/s once the tumble has fully built up
} as const;
const walkSpeed = (dist: number) => Math.max(ESCAPE.minSpeed, dist / ESCAPE.maxWalk);
const walkTime = (dist: number) => dist / walkSpeed(dist);
/** Seconds after the guess when the pawn is surely off screen. */
const escapeEnd = (dist: number) => ESCAPE.walkAt + walkTime(dist) + ESCAPE.crouch + 1.7;

/** Frustrated outbursts; one is picked per lost life (seeded by the guess frame). */
const FRUSTRATION = ["NOOO!", "UGH!", "WHY ME?!", "NOT FAIR!", "ARGH!", "I QUIT!", "SERIOUSLY?!", "COME ON!", "OH NO!", "GRRR!", "SO RUDE!", "UNBELIEVABLE!"];

/** Leg length below the base, in pawn viewBox units (100 × 160); the body is lifted by it. */
const LEG = 28;
const LIMB = "#f2ead8"; // light cartoon limbs…
const OUTLINE = "#140904"; // …with a dark outline so they pop on the dark backdrop

/**
 * Cartoon limbs on the 100 × 160 pawn grid. `walk` = stride phase (radians),
 * `pose` 0 = walking, 1 = airborne (arms up, legs tucked), `grow` 0 → 1 pops them out.
 * `part` draws the legs (behind the body) or the arms (in front of it).
 */
const Limbs: React.FC<{ walk: number; pose: number; grow: number; crouch: number; part: "legs" | "arms" }> = ({ walk, pose, grow, crouch, part }) => {
  const swing = Math.sin(walk) * (1 - pose);
  const legLen = (LEG - 6 * crouch) * grow;
  const armLen = 36 * grow;
  const leg = (x: number, deg: number, key: string) => {
    const r = (deg * Math.PI) / 180;
    const fx = x + Math.sin(r) * legLen;
    const fy = 150 + Math.cos(r) * legLen - 6 * pose;
    return (
      <g key={key}>
        <line x1={x} y1={146} x2={fx} y2={fy} stroke={OUTLINE} strokeWidth={15} strokeLinecap="round" />
        <line x1={x} y1={146} x2={fx} y2={fy} stroke={LIMB} strokeWidth={9} strokeLinecap="round" />
        <ellipse cx={fx + 6} cy={fy + 3} rx={14 * grow} ry={8 * grow} fill={LIMB} stroke={OUTLINE} strokeWidth={4} />
      </g>
    );
  };
  const arm = (x: number, side: 1 | -1, deg: number, key: string) => {
    // deg: 0 = hanging down; positive swings forward (to the right), pose raises both arms.
    const r = (deg * Math.PI) / 180;
    const hx = x + side * 6 * grow + Math.sin(r) * armLen;
    const hy = 86 + Math.cos(r) * armLen;
    return (
      <g key={key}>
        <line x1={x} y1={86} x2={hx} y2={hy} stroke={OUTLINE} strokeWidth={14} strokeLinecap="round" />
        <line x1={x} y1={86} x2={hx} y2={hy} stroke={LIMB} strokeWidth={8} strokeLinecap="round" />
        <circle cx={hx} cy={hy} r={10 * grow} fill="#ffffff" stroke={OUTLINE} strokeWidth={4} />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 100 160" width={PAWN} height={PAWN * 1.6} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {part === "legs"
        ? [leg(38, 26 * swing, "l"), leg(62, -26 * swing, "r")]
        : [arm(34, -1, -40 * swing - 150 * pose - 30, "al"), arm(66, 1, 40 * swing + 150 * pose + 30, "ar")]}
    </svg>
  );
};

/**
 * One life. `since` = frames since it was lost (-1 while alive).
 * `restore` 0 → 1 (loop reset): the cream pawn drops back onto the ledge from above.
 */
const LifePawn: React.FC<{ theme: Theme; since: number; fps: number; restore?: number; walkDist: number; seed: number }> = ({
  theme,
  since,
  fps,
  restore = 0,
  walkDist,
  seed,
}) => {
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
  const px = PAWN / 100; // viewBox unit → px
  const walkDur = walkTime(walkDist);
  const crouchAt = ESCAPE.walkAt + walkDur;
  const hopAt = crouchAt + ESCAPE.crouch;
  if (s > hopAt + 1.7) return <div style={{ width: PAWN, height: PAWN * 1.6 }} />; // long gone; keep its slot

  const punch = spring({ frame: since, fps, config: { damping: 12, stiffness: 420, mass: 0.6 } });
  const scale = interpolate(punch, [0, 1], [1.3, 1]);
  const shudder = s < ESCAPE.hit ? Math.sin(since * 2.4) * 9 * (1 - s / ESCAPE.hit) : 0;
  const redness = ramp(s, [0, 0.12, 0.5], [1, 1, 0.35]);
  const grow = ramp(s, [ESCAPE.limbsAt, ESCAPE.limbsAt + 0.2], [0, 1]);

  // Walk: eases in and out (sets off, strides, slows at the edge); steps follow the distance covered.
  const walkP = interpolate(s, [ESCAPE.walkAt, crouchAt], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const walkX = walkDist * walkP;
  const phase = (walkX / 34) * Math.PI; // one step every 34 px
  const stride = ramp(s, [ESCAPE.walkAt, ESCAPE.walkAt + 0.12, crouchAt - 0.1, crouchAt], [0, 1, 1, 0]);
  const bob = -Math.abs(Math.sin(phase)) * 7 * stride;
  const lean = 7 * stride;

  // Anticipation: squat down (eased), then spring up with a stretch.
  const crouchP = s >= crouchAt && s < hopAt ? (s - crouchAt) / ESCAPE.crouch : 0;
  const crouch = Math.sin(crouchP * Math.PI) ** 2;
  const air = Math.max(0, s - hopAt);
  const airborne = s >= hopAt;
  const stretch = airborne ? ramp(air, [0, 0.06, 0.22], [0, 1, 0]) : 0;
  const hopX = airborne ? ESCAPE.hopX * air : 0;
  const hopY = airborne ? -ESCAPE.hopUp * air + 0.5 * ESCAPE.g * air * air : 0;
  // Tumble builds up smoothly instead of snapping on: angle = rate · a²/(a + 0.3).
  const spin = airborne ? ESCAPE.spin * ((air * air) / (air + 0.3)) : 0;
  const takeoffLean = airborne ? 10 * ramp(air, [0, 0.15], [0, 1]) : 0;
  const pose = airborne ? Easing.out(Easing.cubic)(ramp(air, [0, 0.18], [0, 1])) : 0;

  const lift = -LEG * px * grow; // legs push the body up so the feet stand on the ledge
  const x = shudder + walkX + hopX;
  const y = lift + bob + hopY + 6 * crouch;
  const sy = 1 - 0.14 * crouch + 0.1 * stretch;
  const sx = 1 + 0.08 * crouch - 0.05 * stretch;

  // Speech bubble: pops up as it squats at the edge, stays put while the pawn falls, then fades.
  const word = FRUSTRATION[Math.floor(random(`frustration-${seed}`) * FRUSTRATION.length)];
  const bubbleIn = s >= crouchAt - 0.05 ? spring({ frame: Math.round((s - (crouchAt - 0.05)) * fps), fps, config: { damping: 9, stiffness: 260, mass: 0.6 } }) : 0;
  const bubbleOut = ramp(s, [hopAt + 0.75, hopAt + 0.95], [1, 0]);
  const bubbleO = Math.min(1, bubbleIn * 1.5) * bubbleOut;

  return (
    <div style={{ position: "relative", width: PAWN, height: PAWN * 1.6 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(lean + takeoffLean + spin).toFixed(1)}deg) scale(${(scale * sx).toFixed(3)}, ${(scale * sy).toFixed(3)})`,
          transformOrigin: "50% 95%",
          filter: `drop-shadow(0 0 ${(10 + 40 * redness).toFixed(1)}px ${theme.wrong}${redness > 0.5 ? "dd" : "88"}) drop-shadow(0 12px 16px rgba(0,0,0,0.6))`,
        }}
      >
        {grow > 0 && <Limbs walk={phase} pose={pose} grow={grow} crouch={crouch} part="legs" />}
        <Pawn color={redness > 0.6 ? theme.wrong : "#b8352a"} size={PAWN} style={{ position: "relative" }} />
        {grow > 0 && <Limbs walk={phase} pose={pose} grow={grow} crouch={crouch} part="arms" />}
      </div>
      {bubbleO > 0.01 && (
        <SpeechBubble text={word} x={walkDist + PAWN * 0.55} y={lift - 26} pop={bubbleIn} opacity={bubbleO} wobble={Math.sin(s * 22) * 2 * (1 - ramp(s, [crouchAt, crouchAt + 0.4], [0, 1]))} />
      )}
    </div>
  );
};

/** Comic speech bubble whose tail points down-left at (x, y) (the pawn's head). */
const SpeechBubble: React.FC<{ text: string; x: number; y: number; pop: number; opacity: number; wobble: number }> = ({ text, x, y, pop, opacity, wobble }) => {
  const size = text.length > 9 ? 40 : 48;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-6px, -100%) rotate(${(-4 + wobble).toFixed(2)}deg) scale(${(0.3 + 0.7 * pop).toFixed(3)})`,
        transformOrigin: "0% 100%",
        opacity,
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <div
        style={{
          position: "relative",
          marginLeft: 18,
          marginBottom: 30,
          padding: "14px 30px 10px",
          borderRadius: 34,
          background: "#ffffff",
          border: "5px solid #141414",
          boxShadow: "0 10px 20px rgba(0,0,0,0.55)",
          fontFamily: DISPLAY_FONT,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: "0.04em",
          color: "#c4161c",
          whiteSpace: "nowrap",
        }}
      >
        {text}
        {/* tail */}
        <svg width={48} height={42} viewBox="0 0 48 42" style={{ position: "absolute", left: 8, bottom: -38, overflow: "visible" }}>
          <path d="M 6 0 L 10 40 L 34 0 Z" fill="#ffffff" stroke="#141414" strokeWidth={5} strokeLinejoin="round" />
          <rect x={4} y={-8} width={34} height={11} fill="#ffffff" />
        </svg>
      </div>
    </div>
  );
};
