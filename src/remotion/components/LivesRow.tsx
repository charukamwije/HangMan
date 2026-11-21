import React from "react";
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ramp } from "../motion";
import { loopReset } from "../loop";
import { shadeA, type Theme } from "../themes";
import { BODY_FONT, HAND_FONT } from "../fonts";
import { MAX_LIVES, RIGHT_RAIL, SAFE_ZONE } from "../constants";
import { Pawn } from "./ChessPieces";

/**
 * The "hangman" counter, told in chess: one pawn per allowed mistake (no label), centred on the keyboard.
 * Each wrong guess "captures" a pawn: it takes a red hit, then settles as a dim
 * silhouette under a crimson ✖ (upright, so the row stays tidy). At the final reveal
 * the row hands over to a call-to-action. Visible from frame 0.
 */
/** `promptFrame`: when the lives row hands over to the "COMMENT THE WORD YOU GUESSED!" prompt (just after the last guess). */
export const LivesRow: React.FC<{ theme: Theme; wrongFrames: number[]; promptFrame: number; top: number }> = ({
  theme,
  wrongFrames,
  promptFrame,
  top,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const lives = Math.max(MAX_LIVES, wrongFrames.length);
  // Loop reset: "DID YOU GET IT?" hands back to the pawn row in the first 35 % of the reset.
  const outro =
    spring({ frame: frame - promptFrame, fps, config: { damping: 14 } }) * (1 - loopReset(frame, durationInFrames, fps, 0.05, 0.35));
  // The comment prompt slams in oversized (bouncy spring), then pulses with the clock while it is up.
  const slam = frame >= promptFrame ? spring({ frame: frame - promptFrame, fps, config: { damping: 8, stiffness: 220, mass: 0.6 } }) : 0;
  const promptPulse = frame >= promptFrame ? 0.5 + 0.5 * Math.cos(((frame - promptFrame) / fps) * Math.PI * 2 * 1.2) : 0;
  // A light sheen sweeps across the pill about once a second.
  const sheen = frame >= promptFrame ? (((frame - promptFrame) / fps) % 1.4) / 1.4 : -1;

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
      {/* Comment-bait CTA: a specific question gets more replies than a yes/no. A solid neon pill so it is
          the loudest thing on screen once the guessing is over. Drawn icon, no emoji glyph. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: outro,
          // Two lines are taller than the pawn row: lift into the empty gap above it, clear of the keyboard.
          transform: "translateY(-52px)",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 34,
            // Two big lines; sized so the pill (even at its pulse peak) stays inside the keyboard's safe band.
            padding: "26px 64px 26px 44px",
            borderRadius: 80,
            overflow: "hidden",
            whiteSpace: "nowrap",
            fontFamily: BODY_FONT,
            fontWeight: 900,
            fontSize: 96,
            lineHeight: 1.04,
            letterSpacing: "0.05em",
            color: theme.onAccent,
            background: theme.accent,
            border: "6px solid #ffffff",
            boxShadow: [
              `0 0 ${50 + 50 * promptPulse}px ${theme.accent}`,
              `0 0 0 ${8 + 6 * promptPulse}px ${theme.accent}55`,
              `0 18px 36px ${shadeA(theme, 0.85)}`,
            ].join(", "),
            transform: `scale(${(interpolate(slam, [0, 1], [1.35, 1]) * (1 + 0.035 * promptPulse)).toFixed(4)})`,
          }}
        >
          {sheen >= 0 && (
            <div
              style={{
                position: "absolute",
                top: -20,
                bottom: -20,
                left: `${-20 + 140 * sheen}%`,
                width: 120,
                transform: "skewX(-20deg)",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                pointerEvents: "none",
              }}
            />
          )}
          <ChatIcon color={theme.onAccent} size={170} fill={`${theme.onAccent}22`} glow={false} />
          <span style={{ position: "relative", textAlign: "left" }}>
            COMMENT THE WORD
            <br />
            YOU GUESSED!
          </span>
        </div>
      </div>
    </div>
  );
};

/** Speech-bubble "comment" icon (rounded bubble, tail bottom-left, three dots). */
const ChatIcon: React.FC<{ color: string; size: number; fill?: string; glow?: boolean }> = ({ color, size, fill = "rgba(0,0,0,0.55)", glow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={{ position: "relative", flex: "0 0 auto", filter: glow ? `drop-shadow(0 0 18px ${color}aa) drop-shadow(0 8px 16px rgba(0,0,0,0.8))` : undefined }}
  >
    <path
      d="M 20 14 H 80 Q 92 14 92 26 V 62 Q 92 74 80 74 H 42 L 22 90 L 26 74 H 20 Q 8 74 8 62 V 26 Q 8 14 20 14 Z"
      fill={fill}
      stroke={color}
      strokeWidth={7}
      strokeLinejoin="round"
    />
    {[32, 50, 68].map((cx) => (
      <circle key={cx} cx={cx} cy={44} r={6.5} fill={color} />
    ))}
  </svg>
);

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
  hopUp: 820, // initial upward speed of the hop, px/s
  hopX: 340, // forward launch speed, px/s (slowly reduced by air drag)
  g: 6400, // real-feeling gravity at this scale: a ~1.4k px drop takes ~0.7 s
  drag: 0.9, // horizontal air drag, 1/s
  spin: 260, // constant tumble rate set by the push-off, deg/s (angular momentum is conserved)
} as const;
/**
 * Parachute (seconds after the hop): a short tumbling freefall, then the canopy pops open,
 * the pawn brakes hard towards a slow terminal speed, swings upright under it and drifts
 * down-right, swaying, off the bottom of the screen.
 */
const CHUTE = {
  deployAt: 0.3, // freefall before the canopy opens
  open: 0.22, // canopy inflate time
  terminal: 640, // px/s descent under canopy
  brake: 6, // 1/s, how fast it slows from freefall to terminal speed
  driftX: 120, // px/s steady drift to the right under canopy
  sway: 9, // deg pendulum sway under canopy
  gone: 3.3, // off screen by now (≥ 1.7 k px below the ledge)
} as const;
const walkSpeed = (dist: number) => Math.max(ESCAPE.minSpeed, dist / ESCAPE.maxWalk);
const walkTime = (dist: number) => dist / walkSpeed(dist);
/** Seconds after the guess when the pawn is surely off screen. */
const escapeEnd = (dist: number) => ESCAPE.walkAt + walkTime(dist) + ESCAPE.crouch + CHUTE.gone;

/** Frustrated outbursts; one is picked per lost life (seeded by the guess frame). */
const FRUSTRATION = ["NOOO!", "UGH!", "WHY ME?!", "NOT FAIR!", "ARGH!", "I QUIT!", "SERIOUSLY?!", "COME ON!", "OH NO!", "GRRR!", "SO RUDE!", "UNBELIEVABLE!"];

/** Leg length below the base, in pawn viewBox units (100 × 160); the body is lifted by it. */
const LEG = 28;
/** Lighten (amt > 0) / darken (amt < 0) a #rrggbb colour. */
const tone = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/**
 * 3D limbs in the pawn's own colour, on the 100 × 160 pawn grid: tube-shaded
 * arms/legs (dark edge → base → highlight streak), sphere-lit hands and feet with
 * a specular glint. `walk` = stride phase, `pose` 0 = walking / 1 = airborne,
 * `grow` 0 → 1 pops them out. `part` draws the legs (behind) or arms (in front).
 */
const Limbs: React.FC<{ walk: number; pose: number; grow: number; crouch: number; part: "legs" | "arms"; color: string }> = ({ walk, pose, grow, crouch, part, color }) => {
  const swing = Math.sin(walk) * (1 - pose);
  const legLen = (LEG - 6 * crouch) * grow;
  const armLen = 34 * grow;
  const tube = (x1: number, y1: number, x2: number, y2: number, w: number) => (
    <g strokeLinecap="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tone(color, -0.55)} strokeWidth={w + 2.5} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tone(color, -0.18)} strokeWidth={w} />
      <line x1={x1 - w * 0.12} y1={y1} x2={x2 - w * 0.12} y2={y2} stroke={color} strokeWidth={w * 0.6} />
      <line x1={x1 - w * 0.22} y1={y1} x2={x2 - w * 0.22} y2={y2} stroke={tone(color, 0.6)} strokeWidth={Math.max(1.5, w * 0.18)} opacity={0.85} />
    </g>
  );
  const leg = (x: number, deg: number, key: string) => {
    const r = (deg * Math.PI) / 180;
    const kx = x + Math.sin(r) * legLen * 0.5 + 3 * grow; // knee pushed slightly forward
    const ky = 148 + Math.cos(r) * legLen * 0.5;
    const fx = x + Math.sin(r) * legLen;
    const fy = 150 + Math.cos(r) * legLen - 6 * pose;
    return (
      <g key={key}>
        {tube(x, 146, kx, ky, 9)}
        {tube(kx, ky, fx, fy, 8.5)}
        <circle cx={kx} cy={ky} r={5.2 * grow} fill="url(#limbBall)" />
        <ellipse cx={fx + 5} cy={fy + 3} rx={13 * grow} ry={7 * grow} fill="url(#limbBall)" />
        <ellipse cx={fx + 1} cy={fy} rx={4 * grow} ry={1.8 * grow} fill="#fff" opacity={0.6} />
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
        {tube(x, 86, hx, hy, 8)}
        <circle cx={hx} cy={hy} r={8.5 * grow} fill="url(#limbBall)" />
        <ellipse cx={hx - 3 * grow} cy={hy - 3 * grow} rx={2.6 * grow} ry={1.6 * grow} fill="#fff" opacity={0.7} />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 100 160" width={PAWN} height={PAWN * 1.6} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <radialGradient id="limbBall" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={tone(color, 0.6)} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={tone(color, -0.5)} />
        </radialGradient>
      </defs>
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
  if (s > hopAt + CHUTE.gone) return <div style={{ width: PAWN, height: PAWN * 1.6 }} />; // long gone; keep its slot

  const punch = spring({ frame: since, fps, config: { damping: 12, stiffness: 420, mass: 0.6 } });
  const scale = interpolate(punch, [0, 1], [1.3, 1]);
  const shudder = s < ESCAPE.hit ? Math.sin(since * 2.4) * 9 * (1 - s / ESCAPE.hit) : 0;
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
  // Ballistic flight: constant gravity (y), linear air drag on the forward speed (x).
  const fall = Math.min(air, CHUTE.deployAt); // freefall part
  const chuteT = Math.max(0, air - CHUTE.deployAt); // time under canopy
  const ballX = (t: number) => (ESCAPE.hopX / ESCAPE.drag) * (1 - Math.exp(-ESCAPE.drag * t));
  const ballY = (t: number) => -ESCAPE.hopUp * t + 0.5 * ESCAPE.g * t * t;
  const vDeploy = -ESCAPE.hopUp + ESCAPE.g * CHUTE.deployAt;
  // Under canopy: speed decays exponentially from the freefall speed to the terminal speed.
  const decay = (1 - Math.exp(-CHUTE.brake * chuteT)) / CHUTE.brake;
  const chuteY = CHUTE.terminal * chuteT + (vDeploy - CHUTE.terminal) * decay;
  const vxDeploy = ESCAPE.hopX * Math.exp(-ESCAPE.drag * CHUTE.deployAt);
  const chuteX = CHUTE.driftX * chuteT + (vxDeploy - CHUTE.driftX) * decay;
  const hopX = airborne ? ballX(fall) + chuteX : 0;
  const hopY = airborne ? ballY(fall) + chuteY : 0;
  const vy = !airborne ? 0 : chuteT > 0 ? CHUTE.terminal + (vDeploy - CHUTE.terminal) * Math.exp(-CHUTE.brake * chuteT) : -ESCAPE.hopUp + ESCAPE.g * air; // px/s, + = falling
  // Tumble: the push-off gives a constant spin about the centre of mass (eased in over the
  // first 0.08 s of the push so it doesn't snap), the same direction it is travelling.
  // Once the canopy bites, it swings back upright and settles into a gentle pendulum sway.
  const tumble = (t: number) => ESCAPE.spin * Math.max(0, t - 0.04 * (1 - Math.exp(-t / 0.04)));
  const spin0 = tumble(fall);
  const spin = !airborne
    ? 0
    : chuteT > 0
      ? spin0 * Math.exp(-4.5 * chuteT) * Math.cos(5 * chuteT) + CHUTE.sway * Math.sin(2.6 * chuteT) * (1 - Math.exp(-3 * chuteT))
      : spin0;
  const canopy = chuteT > 0 ? spring({ frame: Math.round(chuteT * fps), fps, config: { damping: 8, stiffness: 220, mass: 0.5 } }) : 0;
  // Motion blur + stretch along the fall direction once it is really moving.
  const speedBlur = Math.max(0, vy - 900) / 2600;
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
          transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(lean + spin).toFixed(1)}deg) scale(${(scale * sx).toFixed(3)}, ${(scale * sy).toFixed(3)})`,
          // on the ground it pivots at its feet; in the air it tumbles about its centre of mass
          transformOrigin: airborne ? "50% 62%" : "50% 95%",
          filter: `drop-shadow(0 12px 16px rgba(0,0,0,0.6))${speedBlur > 0.02 ? ` blur(${Math.min(2.5, speedBlur * 3).toFixed(2)}px)` : ""}`,
        }}
      >
        {grow > 0 && <Limbs walk={phase} pose={pose} grow={grow} crouch={crouch} part="legs" color={theme.piece} />}
        {canopy > 0.001 && <Parachute open={canopy} t={chuteT} id={`chute-${seed}`} />}
        <Pawn color={theme.piece} size={PAWN} style={{ position: "relative" }} />
        {grow > 0 && <Limbs walk={phase} pose={pose} grow={grow} crouch={crouch} part="arms" color={theme.piece} />}
      </div>
      {bubbleO > 0.01 && (
        <SpeechBubble text={word} x={walkDist + PAWN * 0.55} y={lift - 26} pop={bubbleIn} opacity={bubbleO} wobble={Math.sin(s * 22) * 2 * (1 - ramp(s, [crouchAt, crouchAt + 0.4], [0, 1]))} />
      )}
    </div>
  );
};

/** Rainbow canopy panels, left → right: [face, right-edge shade, underside band]. */
const PANELS = [
  ["#9cc63f", "#86b236", "#5f9a3e"],
  ["#f7c933", "#ecb928", "#e9a52a"],
  ["#f0542e", "#e6402a", "#d8322a"],
  ["#bf62a8", "#ad4f9f", "#973f98"],
  ["#5e5fa8", "#4f4f9c", "#3e3c8c"],
] as const;
/** Canopy geometry on the pawn's 100 × 160 grid. */
const RIM_L = -95;
const RIM_R = 195;
const RIM_Y = -50; // outer corners; inner seam points sit higher, following the dome
const RIM_LIFT = 32;
const APEX_Y = -195;
const SCALLOP = 30; // how far each panel's bottom edge arches up
const BAND = 22; // underside band thickness along each panel's bottom
/** Spreader bar held in the raised hands (arms fully up, `pose` = 1). */
const BAR = { l: 18, r: 82, y: 44 } as const;

/**
 * Rainbow parachute above the pawn (same 100 × 160 grid, so it rotates with it):
 * five rounded panels with a darker right edge and a deeper underside band along each
 * arched bottom, lines fanning down to a spreader bar the pawn holds overhead.
 * `open` 0 → 1 (overshooting spring) inflates it from a narrow bundle; `t` (seconds
 * under canopy) drives a gentle breathing ripple.
 */
const Parachute: React.FC<{ open: number; t: number; id: string }> = ({ open, t, id }) => {
  const breathe = 1 + 0.035 * Math.sin(t * 7.5);
  const sx = (0.18 + 0.82 * open) * breathe;
  const sy = Math.max(0.05, open) * (2 - breathe);
  const cx = (RIM_L + RIM_R) / 2;
  const n = PANELS.length;
  // Canopy points in grid units after the inflate scale (about the rim centre).
  const px = (x: number) => cx + (x - cx) * sx;
  const py = (y: number) => RIM_Y + (y - RIM_Y) * sy;
  // Seam points along the bottom: corners lowest, inner seams lifted with the dome.
  const seams = Array.from({ length: n + 1 }, (_, i) => [px(RIM_L + ((RIM_R - RIM_L) * i) / n), py(RIM_Y - RIM_LIFT * Math.sin((i / n) * Math.PI))] as const);
  const [x0, y0] = seams[0];
  const [xn, yn] = seams[n];
  const arc = (i: number) => {
    const [ax, ay] = seams[i];
    const [bx, by] = seams[i + 1];
    return `Q ${(ax + bx) / 2} ${(ay + by) / 2 - SCALLOP * sy} ${bx} ${by}`;
  };
  // Silhouette: a round dome over the top (near-vertical sides), arched panel bottoms back along the base.
  const dome =
    `M ${x0} ${y0} C ${px(RIM_L - 10)} ${py(APEX_Y + 40)}, ${px(cx - 120)} ${py(APEX_Y)}, ${px(cx)} ${py(APEX_Y)} ` +
    `C ${px(cx + 120)} ${py(APEX_Y)}, ${px(RIM_R + 10)} ${py(APEX_Y + 40)}, ${xn} ${yn} ` +
    Array.from({ length: n }, (_, k) => {
      const i = n - 1 - k;
      const [ax, ay] = seams[i];
      const [bx, by] = seams[i + 1];
      return `Q ${(ax + bx) / 2} ${(ay + by) / 2 - SCALLOP * sy} ${ax} ${ay}`;
    }).join(" ") +
    " Z";
  // Panel seams are rays fanning up from the bar: x of seam `f` (fractional index) at height y.
  const fanY = BAR.y + 300;
  const seamX = (f: number, y: number) => {
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const sxA = seams[i][0] + (seams[i + 1][0] - seams[i][0]) * k;
    const syA = seams[i][1] + (seams[i + 1][1] - seams[i][1]) * k;
    return cx + (sxA - cx) * ((fanY - y) / (fanY - syA));
  };
  const top = py(APEX_Y) - 60;
  const bottom = BAR.y;
  const strip = (f0: number, f1: number, edgeL: boolean, edgeR: boolean) =>
    [
      `${edgeL ? -2000 : seamX(f0, top)},${top}`,
      `${edgeR ? 2000 : seamX(f1, top)},${top}`,
      `${seamX(f1, bottom)},${bottom}`,
      `${seamX(f0, bottom)},${bottom}`,
    ].join(" ");
  const lineOpacity = 0.9 * Math.min(1, open * 2);

  return (
    <svg viewBox="0 0 100 160" width={PAWN} height={PAWN * 1.6} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={dome} />
        </clipPath>
      </defs>
      {/* suspension lines: each seam point fans down to the nearer end of the spreader bar */}
      <g stroke="#ece6da" strokeWidth={2.2} opacity={lineOpacity}>
        {seams.map(([x, y], i) => {
          const toLeft = i < n / 2;
          return <line key={i} x1={x} y1={y} x2={toLeft ? BAR.l + 3 : BAR.r - 3} y2={BAR.y} />;
        })}
      </g>
      {/* canopy */}
      <g clipPath={`url(#${id}-clip)`}>
        {PANELS.map(([face, edge], i) => (
          <React.Fragment key={i}>
            <polygon points={strip(i, i + 1, i === 0, i === n - 1)} fill={face} />
            {/* darker sliver down the right side of each panel */}
            <polygon points={strip(i + 0.84, i + 1, false, i === n - 1)} fill={edge} />
          </React.Fragment>
        ))}
        {/* underside band hugging each arched bottom edge */}
        {PANELS.map(([, , under], i) => (
          <path key={`u${i}`} d={`M ${seams[i][0]} ${seams[i][1]} ${arc(i)}`} fill="none" stroke={under} strokeWidth={BAND * 2 * sy} />
        ))}
        {/* soft top-left sheen */}
        <ellipse cx={px(cx - 60)} cy={py(APEX_Y + 40)} rx={110 * sx} ry={50 * sy} fill="#ffffff" opacity={0.12} />
      </g>
      {/* spreader bar */}
      <rect x={BAR.l} y={BAR.y - 4} width={BAR.r - BAR.l} height={8} rx={4} fill="#2b2b2f" stroke="#ece6da" strokeWidth={1.4} opacity={Math.min(1, open * 2)} />
    </svg>
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
          padding: "12px 30px 12px",
          borderRadius: 34,
          background: "#ffffff",
          border: "5px solid #141414",
          boxShadow: "0 10px 20px rgba(0,0,0,0.55)",
          // hand-lettered, like someone scrawled it in the bubble
          fontFamily: HAND_FONT,
          fontSize: size,
          lineHeight: 1.1,
          letterSpacing: "0.02em",
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
