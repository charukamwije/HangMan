import React from "react";
import { YT_FONT } from "../fonts";

/* ------------------------------------------------------------ balloon art */

export type Motif = "like" | "subscribe";

/** Thumbs-up glyph on a 24×24 grid (Material "thumb_up" shape). */
export const THUMB_PATH =
  "M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z";

/** One printed badge, centred on (0,0), `s` wide: a like badge or a play-button badge. */
export const MotifBadge: React.FC<{ motif: Motif; s: number; color: string }> = ({ motif, s, color }) =>
  motif === "like" ? (
    // a filled white thumbs-up straight on the latex (no badge disc behind it)
    <path d={THUMB_PATH} fill="#ffffff" transform={`translate(${-s * 0.45} ${-s * 0.46}) scale(${(s * 0.9) / 24})`} />
  ) : (
    <g>
      <rect x={-s / 2} y={-s * 0.35} width={s} height={s * 0.7} rx={s * 0.2} fill="#ffffff" />
      <path d={`M ${-s * 0.13} ${-s * 0.17} L ${s * 0.2} 0 L ${-s * 0.13} ${s * 0.17} Z`} fill={color} />
    </g>
  );

/**
 * Unit balloon (half-width 1), knot at the origin, body pointing up (−y): fuller at the
 * top, tapering to a pinched neck, with a small tied knot below it.
 */
export const BODY_PATH =
  "M 0 -2.2 C 0.62 -2.2 1 -1.77 1 -1.25 C 1 -0.67 0.45 -0.19 0.07 -0.05 L -0.07 -0.05 C -0.45 -0.19 -1 -0.67 -1 -1.25 C -1 -1.77 -0.62 -2.2 0 -2.2 Z";
export const KNOT_PATH = "M -0.07 -0.06 L 0.07 -0.06 L 0.13 0.09 Q 0 0.04 -0.13 0.09 Z";
/** Centre of the round part, where the label sits (unit coords). */
export const LABEL_Y = -1.22;

/* ------------------------------------------------------------ clusters */

/** Horizontal gutter kept beside each end of the banner (where the old mouse holders stood). */
export const BANNER_GUTTER = 100;

/** Seconds of the reel; idle motions use whole cycles per loop so the replay seam is invisible. */
const LOOP = 30;
const wave = (t: number, cycles: number, phase = 0) => Math.sin((t / LOOP) * cycles * Math.PI * 2 + phase);

type Side = "left" | "right";

const SIDES = {
  left: { base: "#1e88ff", label: "Like", motif: "like" as Motif, font: 0.56 },
  right: { base: "#ff2433", label: "Subscribe", motif: "subscribe" as Motif, font: 0.36 },
} as const;

/**
 * The trio, relative to the tie point on the banner's top corner. `x` grows toward the
 * banner's centre (mirrored on the right side). Each cluster is centred over its corner, so the
 * two never collide over the (narrow) banner; the banner sits low enough that they clear the
 * platform's corner icons. The front balloon (last) is the big labelled one.
 */
const TRIO = [
  { x: -78, y: -46, r: 72, cycles: 9, phase: 0.4, label: false },
  { x: 92, y: -50, r: 72, cycles: 11, phase: 2.1, label: false },
  { x: 8, y: -66, r: 92, cycles: 7, phase: 1.2, label: true },
] as const;

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Three glossy balloons tied to one top corner of the hook banner: blue "Like" balloons on
 * the left, red "Subscribe" ones on the right. Each bobs and sways on its own string;
 * the front one carries the label, the two behind it are printed with the badge motif.
 * Rendered at the tie point (0,0); the parent positions it on the corner.
 */
export const BalloonCluster: React.FC<{ side: Side; t: number; lead?: { x: number; y: number } }> = ({ side, t, lead = { x: 0, y: 0 } }) => {
  const cfg = SIDES[side];
  const dir = side === "left" ? 1 : -1;
  const light = shade(cfg.base, 0.6);
  const dark = shade(cfg.base, -0.45);
  const gid = `bb-${side}`;

  return (
    <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <radialGradient id={`${gid}-fill`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor={light} />
          <stop offset="0.45" stopColor={cfg.base} />
          <stop offset="0.9" stopColor={dark} />
          <stop offset="1" stopColor={shade(cfg.base, -0.25)} />
        </radialGradient>
        <radialGradient id={`${gid}-curve`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#000" stopOpacity={0} />
          <stop offset="0.6" stopColor="#000" stopOpacity={0.06} />
          <stop offset="1" stopColor="#000" stopOpacity={0.4} />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <path d={BODY_PATH} />
        </clipPath>
        <filter id={`${gid}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx={0} dy={0.08} stdDeviation={0.07} floodColor="#000" floodOpacity={0.45} />
        </filter>
        <filter id={`${gid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={0.04} />
        </filter>
      </defs>
      {TRIO.map((b, i) => {
        const bobY = wave(t, b.cycles, b.phase) * 7;
        const swayX = wave(t, b.cycles + 2, b.phase + 1) * 6;
        // `lead`: how far the buoyant cluster is ahead of the banner it is carrying (the strings take up the slack)
        const knot = { x: dir * b.x + swayX + lead.x * (0.8 + 0.1 * i), y: b.y + bobY + lead.y * (0.85 + 0.1 * i) };
        // leans away from the tie point along its string, plus a little sway
        const angle = Math.atan2(knot.x, -knot.y) * (180 / Math.PI) * 0.6 + swayX * 0.5;
        const midX = knot.x * 0.5 + wave(t, b.cycles + 4, b.phase) * 6;
        return (
          <g key={i}>
            <path d={`M 0 0 Q ${midX.toFixed(1)} ${(knot.y * 0.5).toFixed(1)} ${knot.x.toFixed(1)} ${knot.y.toFixed(1)}`} stroke="#f4f1ea" strokeWidth={2.5} fill="none" opacity={0.9} />
            <g transform={`translate(${knot.x.toFixed(1)} ${knot.y.toFixed(1)}) rotate(${angle.toFixed(2)}) scale(${b.r})`}>
              <path d={BODY_PATH} fill={`url(#${gid}-fill)`} filter={`url(#${gid}-shadow)`} />
              <g clipPath={`url(#${gid}-clip)`}>
                {/* one icon per balloon: big and centred on the plain ones, above the word on the labelled one */}
                <g transform={`translate(0 ${(b.label ? LABEL_Y - 0.4 : LABEL_Y).toFixed(3)}) rotate(${(-angle * 0.8).toFixed(2)})`} opacity={0.95}>
                  <MotifBadge motif={cfg.motif} s={b.label ? 0.6 : 0.95} color={cfg.base} />
                </g>
                <path d={BODY_PATH} fill={`url(#${gid}-curve)`} />
              </g>
              <path d={BODY_PATH} fill="none" stroke={shade(cfg.base, -0.55)} strokeWidth={0.04} opacity={0.5} />
              <ellipse cx={-0.42} cy={-1.72} rx={0.26} ry={0.14} fill="#ffffff" opacity={0.8} transform="rotate(-35 -0.42 -1.72)" filter={`url(#${gid}-soft)`} />
              <ellipse cx={-0.68} cy={-1.36} rx={0.06} ry={0.06} fill="#ffffff" opacity={0.7} />
              <path d={KNOT_PATH} fill={dark} />
              {b.label && (
                <text
                  x={0}
                  y={LABEL_Y + 0.28}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={YT_FONT}
                  fontWeight={500}
                  fontSize={cfg.font}
                  fill="#ffffff"
                  stroke={dark}
                  strokeWidth={0.05}
                  paintOrder="stroke"
                  transform={`rotate(${(-angle * 0.8).toFixed(2)} 0 ${LABEL_Y + 0.28})`}
                >
                  {cfg.label}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Buoyancy vs gravity, loop-safe (whole cycles per 30 s). Each cluster drifts on its own slow
 * updraft (`lift`); the banner is the weight hanging below, so its corners follow the lift
 * LAG s late and a little damped. Uneven lift tilts the banner; it also swings like a pendulum,
 * trailing the balloons sideways. Returns the banner's motion plus each cluster's lead over it.
 */
const LAG = 0.35;
const lift = (side: Side, t: number) =>
  side === "left" ? 18 * wave(t, 4, 0.3) + 6 * wave(t, 9, 1.1) : 18 * wave(t, 4, 2.0) + 6 * wave(t, 10, 0.2);
const drift = (t: number) => 16 * wave(t, 3, 0.5) + 5 * wave(t, 7, 2.3);

export const bannerFloat = (t: number, bannerW: number) => {
  const cornerL = 0.85 * lift("left", t - LAG);
  const cornerR = 0.85 * lift("right", t - LAG);
  const dx = 0.8 * drift(t - LAG);
  return {
    dx,
    dy: (cornerL + cornerR) / 2,
    tilt: (Math.atan2(cornerR - cornerL, bannerW) * 180) / Math.PI,
    lead: {
      left: { x: drift(t) - dx, y: lift("left", t) - cornerL },
      right: { x: drift(t) - dx, y: lift("right", t) - cornerR },
    },
  };
};
