import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT } from "../fonts";
import { ramp } from "../motion";
import { KEYBOARD_HEIGHT } from "./Keyboard";

/**
 * A little library chair (3/4 front view) in the gap left of the keyboard's two
 * short bottom rows. Once per video one animal character (picked from the
 * answer, so a puzzle always gets the same one) waddles in, hops onto the
 * chair, says a line in a speech bubble, then waddles off.
 *
 * Characters are original, front-facing animal mascots built from a few clean,
 * sphere-shaded shapes (key light top-left). Every transition is eased.
 * The visit sits between 8.0 s and ~14.6 s, so frame 0 and the loop point always
 * show the empty chair, and it finishes before the 15 s hint switch.
 */
export const CAST_VISIT = { at: 8.0, walkIn: 1.0, sit: 0.45, talk: 4.2, stand: 0.35, walkOut: 0.8 } as const;

type CastId = "biscuit" | "marigold" | "pip";
const CAST: Record<CastId, { line: string }> = {
  biscuit: { line: "Can't guess this? How will you ever fetch my snacks? Subscribe & learn something!" },
  marigold: { line: "You don't know this?! Less time bothering the neighbours. Subscribe and learn something!" },
  pip: { line: "I subscribed, that's why I know everything. Want to learn? Subscribe!" },
};
const IDS: CastId[] = ["biscuit", "marigold", "pip"];
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
export const castFor = (word: string): CastId => IDS[hash(word) % IDS.length];

// Geometry (design px). The floor is the bottom of the keyboard's last key row.
const KB_PAD = 44;
const CHAIR_X = 150; // left edge of the chair model (before its 3D turn)
const SEAT_H = 78; // seat height above the floor (= the characters' leg length)
/** Character box (viewBox 0 0 160 260): centred at x 80, hips at y 180, floor at y 258. */
const BOX = { w: 160, h: 260, cx: 80, floor: 258 };

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Walking: max fore/aft foot reach from the hip (box px), and the speed at which steps reach full size. */
const STRIDE = 24;
const WALK_FULL_SPEED = 300;

export const ChairCast: React.FC<{ keyboardTop: number; word: string }> = ({ keyboardTop, word }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const floorY = keyboardTop + KEYBOARD_HEIGHT - KB_PAD;
  const id = castFor(word);

  const v = CAST_VISIT;
  const tIn = v.at + v.walkIn;
  const tSat = tIn + v.sit;
  const tTalkEnd = tSat + v.talk;
  const tUp = tTalkEnd + v.stand;
  const tGone = tUp + v.walkOut;
  const visiting = t >= v.at && t < tGone;

  const offX = -200;
  const xAt = (time: number) =>
    time < tIn
      ? interpolate(time, [v.at, tIn], [offX, CHAIR_CX], { ...CLAMP, easing: Easing.out(Easing.quad) })
      : time < tUp
        ? CHAIR_CX
        : interpolate(time, [tUp, tGone], [CHAIR_CX, offX], { ...CLAMP, easing: Easing.in(Easing.quad) });
  const x = xAt(t);
  const vel = (x - xAt(t - 1 / fps)) * fps; // px/s, signed
  const gaitFor = (speed: number) => Math.min(1, speed / WALK_FULL_SPEED);
  const gait = gaitFor(Math.abs(vel));
  // Step phase is integrated from the DISTANCE walked (not the x position), so it always runs
  // forward whichever way the character walks, and one half-cycle covers exactly one stride:
  // the planted foot stays put on the floor instead of sliding.
  let phase = 0;
  if (visiting) {
    for (let f = Math.ceil(v.at * fps) + 1; f <= frame; f++) {
      const d = Math.abs(xAt(f / fps) - xAt((f - 1) / fps));
      phase += (d * Math.PI) / (2 * Math.max(8, STRIDE * gaitFor(d * fps)));
    }
  }
  // Waddle: rock side to side, rise as the legs pass each other, lean into the direction of travel.
  const rock = Math.sin(phase) * 4 * gait;
  const lift = (0.5 + 0.5 * Math.cos(2 * phase)) * 4 * gait; // highest mid-stride, lowest with legs apart
  const bob = -lift;
  const lean = Math.sign(vel) * 4 * gait;

  // Sit: eased hop up onto the seat with a little squash on landing; stand: eased back down.
  const sitDown = interpolate(t, [tIn, tSat], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  const standUp = interpolate(t, [tTalkEnd, tUp], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  const sit = visiting ? sitDown * (1 - standUp) : 0;
  const hop = -Math.sin(sitDown * Math.PI) * 16 * (1 - standUp) - Math.sin(standUp * Math.PI) * 12;
  const land = t >= tSat && t < tSat + 0.35 ? Math.sin(((t - tSat) / 0.35) * Math.PI) * 0.05 : 0;
  const breathe = sit > 0.95 ? Math.sin(t * Math.PI * 2 * 0.8) * 0.012 : 0;

  const talkAmt = ramp(t, [tSat, tSat + 0.25, tTalkEnd - 0.3, tTalkEnd], [0, 1, 1, 0]);
  const mouth = Math.abs(Math.sin(t * 15)) * talkAmt;
  const blink = (t % 3.2) < 0.12 ? 1 : 0;
  const gesture = talkAmt * (0.75 + 0.25 * Math.sin(t * 5));

  // Speech bubble: springs in after sitting, types the line, then shrinks + fades out.
  // One sentence at a time: the talk time is split evenly; each sentence types in, holds, then
  // the bubble squashes and springs back with the next one.
  const sentences = CAST[id].line.split(/(?<=[.!?])\s+/).filter(Boolean);
  const bubbleT = t - (tSat + 0.05);
  const span = (tTalkEnd - 0.3 - (tSat + 0.05)) / sentences.length;
  const si = Math.max(0, Math.min(sentences.length - 1, Math.floor(bubbleT / span)));
  const local = bubbleT - si * span;
  const sentence = sentences[si];
  const typed = Math.floor(sentence.length * ramp(local, [0.12, 0.12 + Math.min(0.7, span * 0.45)], [0, 1]));
  // first sentence springs in from nothing; later ones get a quick squash-and-pop
  const pop =
    bubbleT < 0
      ? 0
      : si === 0
        ? spring({ frame: Math.round(bubbleT * fps), fps, config: { damping: 12, stiffness: 180, mass: 0.7 } })
        : interpolate(local, [0, 0.07, 0.22], [0.82, 0.82, 1], { ...CLAMP, easing: Easing.out(Easing.back(2)) });
  const swap = si > 0 ? ramp(local, [0, 0.06], [0.4, 1]) : 1;
  const bubbleOut = interpolate(t, [tTalkEnd - 0.3, tTalkEnd], [1, 0], { ...CLAMP, easing: Easing.in(Easing.cubic) });

  const boxLeft = x - BOX.cx;
  const boxTop = floorY - BOX.floor;
  const edgeFade = ramp(x, [offX + 30, offX + 140], [0, 1]);

  return (
    <>
      <Chair floorY={floorY} occupied={sit} />
      {visiting && (
        <>
          <div
            style={{
              position: "absolute",
              left: x - 50,
              top: floorY - 10,
              width: 100,
              height: 18,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.55)",
              filter: "blur(6px)",
              opacity: edgeFade * (1 - 0.6 * sit) * (1 + bob / 20),
            }}
          />
          <div
            style={{
              position: "absolute",
              left: boxLeft,
              top: boxTop + bob + hop,
              width: BOX.w,
              height: BOX.h,
              opacity: edgeFade,
              transform: `rotate(${(rock + lean).toFixed(2)}deg) scale(${(1 + land * 0.6).toFixed(4)}, ${(1 - land + breathe).toFixed(4)})`,
              transformOrigin: `${BOX.cx}px ${BOX.floor - 70 * sit}px`,
              filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.45))",
            }}
          >
            <Animal id={id} sit={sit} phase={phase} gait={gait} lift={lift} dir={vel < -1 ? -1 : 1} mouth={mouth} blink={blink} gesture={gesture} />
          </div>
        </>
      )}
      {visiting && pop > 0.01 && bubbleOut > 0.001 && (
        <Bubble x={CHAIR_CX + 46} y={boxTop + 30} pop={pop * (0.85 + 0.15 * bubbleOut)} opacity={bubbleOut * swap} line={sentence} typed={typed} />
      )}
    </>
  );
};

/* ------------------------------------------------------------ shading helpers */

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/** Sphere lighting: highlight top-left, base, core shadow bottom-right. */
const Sphere: React.FC<{ id: string; base: string; light?: number; dark?: number }> = ({ id, base, light = 0.4, dark = -0.4 }) => (
  <radialGradient id={id} cx="0.36" cy="0.3" r="0.8">
    <stop offset="0" stopColor={shade(base, light)} />
    <stop offset="0.5" stopColor={base} />
    <stop offset="1" stopColor={shade(base, dark)} />
  </radialGradient>
);

const Eye: React.FC<{ cx: number; cy: number; r: number; iris: string; lid?: number; blink?: number }> = ({ cx, cy, r, iris, lid = 0, blink = 0 }) => {
  const l = Math.max(lid, blink);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="url(#eyeWhite)" />
      <circle cx={cx + r * 0.08} cy={cy + r * 0.1} r={r * 0.66} fill={iris} />
      <circle cx={cx + r * 0.1} cy={cy + r * 0.12} r={r * 0.36} fill="#0b0b0e" />
      <circle cx={cx - r * 0.18} cy={cy - r * 0.22} r={r * 0.24} fill="#ffffff" />
      {l > 0 && (
        <path
          d={`M ${cx - r - 1} ${cy} A ${r + 1} ${r + 1} 0 0 1 ${cx + r + 1} ${cy} L ${cx + r + 1} ${cy - r + 2 * r * l} Q ${cx} ${cy - r + 2 * r * l + 3} ${cx - r - 1} ${cy - r + 2 * r * l} Z`}
          fill="url(#lid)"
        />
      )}
    </g>
  );
};

/* ------------------------------------------------------------ chair (true 3D, projected) */

/**
 * The chair is modelled as real boxes in 3D (x right, y up, z back), turned
 * CHAIR_YAW around the vertical axis so its front faces the viewer's right, seen
 * from slightly above (CHAIR_PITCH), and projected orthographically. Each box
 * draws only its faces that point at the viewer (top, front/back, left/right),
 * shaded top-lit / front-mid / side-dark, painted far-to-near. Because every
 * part comes from one consistent projection, nothing skews or distorts.
 */
const CHAIR_YAW = (-28 * Math.PI) / 180;
const CHAIR_PITCH = (22 * Math.PI) / 180;
const CH = { w: 112, d: 96, leg: 11, seatT: 10, backH: 132 };
/** Chair origin (front-centre of the seat, on the floor), stage x. */
const CHAIR_OX = CHAIR_X + 56;

type V3 = [number, number, number];
const rotY = ([x, y, z]: V3): V3 => [x * Math.cos(CHAIR_YAW) + z * Math.sin(CHAIR_YAW), y, -x * Math.sin(CHAIR_YAW) + z * Math.cos(CHAIR_YAW)];
/** Rotated point → stage px (z' = depth: further back appears higher). */
const proj = (p: V3, floorY: number) => {
  const [x, y, z] = rotY(p);
  return { x: CHAIR_OX + x, y: floorY - y * Math.cos(CHAIR_PITCH) - z * Math.sin(CHAIR_PITCH), depth: z };
};
/** Stage x of the seat centre (where the animals sit). */
const chairSeatCenterX = () => CHAIR_OX + rotY([0, SEAT_H, CH.d * 0.45])[0];

type BoxDef = { min: V3; max: V3; base: string; key: string };

const Box3: React.FC<{ b: BoxDef; floorY: number }> = ({ b, floorY }) => {
  const [x0, y0, z0] = b.min;
  const [x1, y1, z1] = b.max;
  const c = (x: number, y: number, z: number) => proj([x, y, z], floorY);
  const poly = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // face normals after the yaw: front (-z) → x' = -sin, z' = -cos; right (+x) → x' = cos, z' = -sin
  const frontVis = -Math.cos(CHAIR_YAW) < 0;
  const rightVis = -Math.sin(CHAIR_YAW) < 0;
  const faces: React.ReactNode[] = [];
  const stroke = { stroke: "#1f1006", strokeWidth: 1.2, strokeLinejoin: "round" as const };
  // vertical faces
  const zf = frontVis ? z0 : z1;
  faces.push(<polygon key="fb" points={poly([c(x0, y0, zf), c(x1, y0, zf), c(x1, y1, zf), c(x0, y1, zf)])} fill={shade(b.base, frontVis ? -0.05 : -0.35)} {...stroke} />);
  const xs = rightVis ? x1 : x0;
  faces.push(<polygon key="lr" points={poly([c(xs, y0, z0), c(xs, y0, z1), c(xs, y1, z1), c(xs, y1, z0)])} fill={shade(b.base, -0.38)} {...stroke} />);
  // top face (always visible from above)
  faces.push(<polygon key="t" points={poly([c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)])} fill={shade(b.base, 0.22)} {...stroke} />);
  return <g>{faces}</g>;
};

const Chair: React.FC<{ floorY: number; occupied: number }> = ({ floorY, occupied }) => {
  const { w, d, leg, seatT, backH } = CH;
  const hw = w / 2;
  const WOOD = "#9a6230";
  const RAIL = "#8a5328";
  const boxes: BoxDef[] = [
    // legs
    { key: "lfl", min: [-hw, 0, 0], max: [-hw + leg, SEAT_H - seatT, leg], base: WOOD },
    { key: "lfr", min: [hw - leg, 0, 0], max: [hw, SEAT_H - seatT, leg], base: WOOD },
    { key: "lbl", min: [-hw, 0, d - leg], max: [-hw + leg, SEAT_H - seatT, d], base: WOOD },
    { key: "lbr", min: [hw - leg, 0, d - leg], max: [hw, SEAT_H - seatT, d], base: WOOD },
    // stretchers
    { key: "sl", min: [-hw + 2, 22, leg], max: [-hw + leg - 2, 28, d - leg], base: RAIL },
    { key: "sr", min: [hw - leg + 2, 22, leg], max: [hw - 2, 28, d - leg], base: RAIL },
    { key: "sf", min: [-hw + leg, 30, 3], max: [hw - leg, 36, leg - 3], base: RAIL },
    // seat slab
    { key: "seat", min: [-hw - 4, SEAT_H - seatT, -4], max: [hw + 4, SEAT_H, d + 2], base: "#a96b35" },
    // cushion (squashes when sat on)
    { key: "cush", min: [-hw + 6, SEAT_H, 6], max: [hw - 6, SEAT_H + 7 - 3 * occupied, d - 8], base: "#a8323a" },
    // back posts rising from the back legs
    { key: "pl", min: [-hw, SEAT_H, d - leg], max: [-hw + leg, SEAT_H + backH, d], base: WOOD },
    { key: "pr", min: [hw - leg, SEAT_H, d - leg], max: [hw, SEAT_H + backH, d], base: WOOD },
    // top rail + mid rail
    { key: "rt", min: [-hw - 2, SEAT_H + backH - 22, d - leg + 1], max: [hw + 2, SEAT_H + backH + 4, d - 1], base: "#a8703a" },
    // slats
    ...[-0.5, 0, 0.5].map((k, i) => ({ key: `sl${i}`, min: [k * (w * 0.5) - 5, SEAT_H + 6, d - leg + 3] as V3, max: [k * (w * 0.5) + 5, SEAT_H + backH - 22, d - 3] as V3, base: RAIL })),
  ];
  // painter's order: far → near, then low → high for boxes at the same depth
  const depthOf = (b: BoxDef) => rotY([(b.min[0] + b.max[0]) / 2, 0, (b.min[2] + b.max[2]) / 2])[2];
  const sorted = [...boxes].sort((a, b) => {
    const da = depthOf(a);
    const db = depthOf(b);
    if (Math.abs(da - db) > 6) return db - da;
    return a.min[1] - b.min[1];
  });
  // seat/cushion must cover the leg tops and post bases they sit on: draw them after any box below SEAT_H
  const below = sorted.filter((b) => b.max[1] <= SEAT_H - seatT + 0.01 && !["pl", "pr"].includes(b.key));
  const rest = sorted.filter((b) => !below.includes(b));
  const backParts = rest.filter((b) => ["pl", "pr", "rt"].includes(b.key) || b.key.startsWith("sl") && b.min[1] >= SEAT_H);
  const seatParts = rest.filter((b) => b.key === "seat" || b.key === "cush");
  const frontLegs = below.filter((b) => b.key === "lfl" || b.key === "lfr" || b.key === "sf");
  const farBelow = below.filter((b) => !frontLegs.includes(b));

  const fl = proj([-hw, 0, 0], floorY);
  const br = proj([hw, 0, d], floorY);
  const minX = Math.min(fl.x, br.x, proj([hw, 0, 0], floorY).x, proj([-hw, 0, d], floorY).x);
  const maxX = Math.max(fl.x, br.x, proj([hw, 0, 0], floorY).x, proj([-hw, 0, d], floorY).x);
  return (
    <>
      <div style={{ position: "absolute", left: minX - 12, top: floorY - 30, width: maxX - minX + 24, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", filter: "blur(8px)" }} />
      <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {[...backParts, ...farBelow, ...seatParts, ...frontLegs].map((b) => (
          <Box3 key={b.key} b={b} floorY={floorY} />
        ))}
        {/* cushion sheen */}
        {(() => {
          const p = proj([-hw * 0.25, SEAT_H + 7 - 3 * occupied, d * 0.35], floorY);
          return <ellipse cx={p.x} cy={p.y} rx={22} ry={5} fill="#ffffff" opacity={0.18} />;
        })()}
      </svg>
    </>
  );
};

/** Seat centre (stage x), from the same projection. Used at render time only. */
const CHAIR_CX = chairSeatCenterX();

/* ------------------------------------------------------------ animal characters (3D-shaded) */

/**
 * 3D look, built from a few consistent lighting cues on every part:
 *  - Vol: volumetric radial gradient — key light top-left, core shadow, and a
 *    faint reflected-light rim on the lower right edge.
 *  - AO: soft blurred contact shadows where parts meet (under the head, under
 *    arms, at the ear bases, between the legs).
 *  - Spec: blurred specular glints on the curved surfaces facing the light.
 *  - Limbs are tube-shaded (dark edge → base → highlight streak).
 */
/** `lift`: how far the whole body is raised this frame while walking (box px); the feet cancel it so they stay on the floor. */
type Pose = { sit: number; phase: number; gait: number; lift: number; dir: number; mouth: number; blink: number; gesture: number };

const Vol: React.FC<{ id: string; base: string; light?: number }> = ({ id, base, light = 0.5 }) => (
  <radialGradient id={id} cx="0.4" cy="0.36" r="0.72" fx="0.3" fy="0.24">
    <stop offset="0" stopColor={shade(base, light)} />
    <stop offset="0.3" stopColor={shade(base, light * 0.25)} />
    <stop offset="0.68" stopColor={base} />
    <stop offset="0.9" stopColor={shade(base, -0.42)} />
    <stop offset="1" stopColor={shade(base, -0.22)} />
  </radialGradient>
);

const AO: React.FC<{ cx: number; cy: number; rx: number; ry: number; o?: number }> = ({ cx, cy, rx, ry, o = 0.4 }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity={o} filter="url(#soft)" />
);

const Spec: React.FC<{ cx: number; cy: number; rx: number; ry: number; o?: number; rot?: number }> = ({ cx, cy, rx, ry, o = 0.75, rot = -25 }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={o} filter="url(#glint)" transform={`rotate(${rot} ${cx} ${cy})`} />
);

/** Tube-shaded limb along a path. */
const Limb: React.FC<{ d: string; color: string; w: number }> = ({ d, color, w }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={shade(color, -0.55)} strokeWidth={w + 3} />
    <path d={d} stroke={shade(color, -0.15)} strokeWidth={w} />
    <path d={d} stroke={color} strokeWidth={w * 0.62} transform={`translate(${-w * 0.12} ${-w * 0.06})`} />
    <path d={d} stroke={shade(color, 0.5)} strokeWidth={Math.max(2, w * 0.2)} transform={`translate(${-w * 0.24} ${-w * 0.12})`} opacity={0.8} />
  </g>
);

/** Paw/hand ball. */
const Ball: React.FC<{ cx: number; cy: number; r: number; fill: string }> = ({ cx, cy, r, fill }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={fill} />
    <Spec cx={cx - r * 0.35} cy={cy - r * 0.35} rx={r * 0.3} ry={r * 0.18} o={0.6} />
  </g>
);

const Animal: React.FC<{ id: CastId } & Pose> = ({ id, ...p }) => (
  <svg viewBox="0 0 160 260" width={BOX.w} height={BOX.h} style={{ overflow: "visible" }}>
    <defs>
      <radialGradient id="eyeWhite" cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#c6cad4" />
      </radialGradient>
      <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a3a44" stopOpacity="0.85" />
        <stop offset="1" stopColor="#3a3a44" stopOpacity="0.6" />
      </linearGradient>
      <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id="glint" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>
    {id === "biscuit" && <Cat {...p} />}
    {id === "marigold" && <Hen {...p} />}
    {id === "pip" && <Fox {...p} />}
  </svg>
);

/**
 * Two-segment legs (thigh + shin) with a knee joint.
 *  Walking: 2-bone IK — each ankle follows a step cycle (swings forward with a lift,
 *  plants, pushes back), the knee bends toward the travel direction, toes lead.
 *  Seated (front view): thighs come toward the viewer (short, foreshortened), knees
 *  bend with a lit kneecap, shins hang straight down, feet face the viewer.
 */
const Legs: React.FC<{ p: Pose; color: string; foot: string; w?: number }> = ({ p, color, foot, w = 18 }) => {
  const HIP_Y = 172;
  // Slightly longer than the 76 px hip→floor drop, so a standing leg keeps a soft knee bend
  // and the full stride never over-stretches it.
  const L1 = 42; // thigh
  const L2 = 42; // shin
  const dir = p.dir || 1;
  const legs = [-1, 1].map((side) => {
    // Walking sideways the hips line up (body turns side-on), so the legs pass one behind the
    // other instead of scissoring across each other; standing/seated they sit 34 px apart.
    const hipSpread = 17 * (1 - 0.7 * p.gait * (1 - p.sit));
    const hip = { x: 80 + side * hipSpread, y: HIP_Y };
    // ---- walking: 2-bone IK. The ankle follows a step cycle; the knee bends forward (travel direction).
    // Stance (cos < 0): foot planted, sweeping back under the body. Swing (cos > 0): lifted, moving forward.
    const ph = p.phase + (side < 0 ? 0 : Math.PI);
    const ankleW = {
      x: hip.x + dir * Math.sin(ph) * STRIDE * p.gait,
      // + lift: cancels the body's walking bob, so planted feet stay on the floor
      y: 248 + p.lift * (1 - p.sit) - Math.max(0, Math.cos(ph)) * 14 * p.gait,
    };
    const dx = ankleW.x - hip.x;
    const dy = ankleW.y - hip.y;
    const D = Math.min(L1 + L2 - 0.5, Math.hypot(dx, dy));
    const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const ux = dx / D;
    const uy = dy / D;
    // perpendicular pointing toward the travel direction (knees bend forward, not bird-like backward)
    const px = uy * dir;
    const py = -ux * dir;
    const kneeW = { x: hip.x + ux * a + px * h, y: hip.y + uy * a + py * h };
    // ---- seated (front view): thighs come toward us (foreshortened), knees bent, shins hang down.
    const kneeS = { x: hip.x + side * 12, y: 204 }; // knees forward + apart, just below the belly
    const ankleS = { x: hip.x + side * 7, y: 240 };
    const mix = (A: { x: number; y: number }, B: { x: number; y: number }) => ({ x: A.x + (B.x - A.x) * p.sit, y: A.y + (B.y - A.y) * p.sit });
    const knee = mix(kneeW, kneeS);
    const ankle = mix(ankleW, ankleS);
    // foot: toes point the way it walks; seated, the foot faces us
    const toe = dir * 7 * (1 - p.sit);
    const lifted = Math.max(0, Math.cos(ph)) * 14 * p.gait;
    const footTilt = -dir * Math.min(18, lifted * 1.2) * (1 - p.sit);
    return { side, hip, knee, ankle, toe, footTilt };
  });
  // draw the leg on the far side of the travel direction first
  const order = dir > 0 ? legs : [...legs].reverse();
  return (
    <g>
      <defs>
        <Vol id="footVol" base={foot} />
        <Vol id="kneeVol" base={color} light={0.55} />
      </defs>
      <AO cx={80} cy={HIP_Y + 4 + 10 * p.sit} rx={28} ry={8} o={0.45} />
      {order.map(({ side, hip, knee, ankle, toe, footTilt }) => (
        <g key={side}>
          <Limb d={`M ${hip.x} ${hip.y} L ${knee.x.toFixed(1)} ${knee.y.toFixed(1)}`} color={color} w={w} />
          <Limb d={`M ${knee.x.toFixed(1)} ${knee.y.toFixed(1)} L ${ankle.x.toFixed(1)} ${ankle.y.toFixed(1)}`} color={shade(color, -0.06)} w={w * 0.9} />
          {/* rounded knee joint; reads as a kneecap when seated */}
          <circle cx={knee.x} cy={knee.y} r={w * (0.52 + 0.3 * p.sit)} fill="url(#kneeVol)" />
          {/* crease under the bent knee when seated */}
          {p.sit > 0.3 && <AO cx={knee.x} cy={knee.y + w * 0.75} rx={w * 0.6} ry={w * 0.22} o={0.4 * p.sit} />}
          <Spec cx={knee.x - w * 0.2} cy={knee.y - w * 0.22} rx={w * 0.2} ry={w * 0.12} o={0.5 * (0.4 + 0.6 * p.sit)} rot={0} />
          <g transform={`rotate(${footTilt.toFixed(1)} ${ankle.x.toFixed(1)} ${ankle.y.toFixed(1)})`}>
            <ellipse cx={ankle.x + toe} cy={ankle.y + 5} rx={14 + 1 * p.sit} ry={7 + 3 * p.sit} fill="url(#footVol)" />
            <Spec cx={ankle.x + toe - 5} cy={ankle.y + 2} rx={5} ry={2} o={0.55} rot={0} />
          </g>
        </g>
      ))}
    </g>
  );
};

/** Biscuit: a round grey tabby cat in a knitted red scarf, eyes half-lidded (unimpressed). */
const Cat: React.FC<Pose> = (p) => {
  const raise = 24 * p.gesture;
  const FUR = "#9aa1ad";
  return (
    <g>
      <defs>
        <Vol id="catFur" base={FUR} />
        <Vol id="catLight" base="#e3e6ec" light={0.7} />
        <Vol id="catScarf" base="#c8403a" />
        <Vol id="catEar" base="#e8a3ae" light={0.35} />
        <Vol id="catNose" base="#e2708a" light={0.6} />
      </defs>
      {/* tail curling up behind */}
      <Limb d="M 112 186 C 150 186 154 140 136 124" color={FUR} w={14} />
      <Legs p={p} color="#8f96a2" foot="#e3e6ec" />
      {/* body */}
      <path d="M 80 104 C 118 104 126 152 120 180 C 114 200 46 200 40 180 C 34 152 42 104 80 104 Z" fill="url(#catFur)" />
      <ellipse cx={80} cy={162} rx={24} ry={28} fill="url(#catLight)" />
      <Spec cx={60} cy={130} rx={10} ry={5} o={0.35} />
      {/* arms (AO where they meet the body) */}
      <AO cx={48} cy={140} rx={8} ry={18} o={0.3} />
      <Limb d="M 46 124 Q 36 146 42 166" color="#8f96a2" w={16} />
      <Ball cx={42} cy={168} r={9} fill="url(#catLight)" />
      <AO cx={112} cy={140} rx={8} ry={18} o={0.3} />
      <Limb d={`M 114 124 Q ${128 + raise * 0.3} ${144 - raise} ${120 + raise * 0.4} ${166 - raise * 1.6}`} color="#8f96a2" w={16} />
      <Ball cx={120 + raise * 0.4} cy={168 - raise * 1.6} r={9} fill="url(#catLight)" />
      {/* scarf with knit shading */}
      <AO cx={80} cy={128} rx={34} ry={7} o={0.35} />
      <path d="M 44 104 Q 80 124 116 104 L 118 120 Q 80 140 42 120 Z" fill="url(#catScarf)" />
      <path d="M 92 120 L 100 158 L 112 154 L 104 118 Z" fill="url(#catScarf)" />
      {[54, 68, 82, 96, 108].map((x) => (
        <path key={x} d={`M ${x} 113 l 0 9`} stroke="#f3e2c4" strokeWidth={3} opacity={0.75} strokeLinecap="round" />
      ))}
      {/* shadow the head casts on the scarf/body */}
      <AO cx={80} cy={106} rx={36} ry={8} o={0.45} />
      {/* head */}
      <path d="M 40 52 Q 38 18 50 12 Q 62 22 70 36 Z" fill="url(#catFur)" />
      <path d="M 120 52 Q 122 18 110 12 Q 98 22 90 36 Z" fill="url(#catFur)" />
      <path d="M 46 42 Q 46 24 52 20 Q 60 28 64 36 Z M 114 42 Q 114 24 108 20 Q 100 28 96 36 Z" fill="url(#catEar)" />
      <ellipse cx={80} cy={66} rx={46} ry={40} fill="url(#catFur)" />
      <AO cx={56} cy={34} rx={12} ry={5} o={0.25} />
      <AO cx={104} cy={34} rx={12} ry={5} o={0.25} />
      <path d="M 68 32 Q 70 40 70 46 M 80 30 L 80 44 M 92 32 Q 90 40 90 46" stroke={shade(FUR, -0.3)} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Spec cx={58} cy={44} rx={12} ry={6} o={0.45} />
      {/* muzzle */}
      <AO cx={80} cy={94} rx={26} ry={6} o={0.3} />
      <ellipse cx={70} cy={84} rx={14} ry={11} fill="url(#catLight)" />
      <ellipse cx={90} cy={84} rx={14} ry={11} fill="url(#catLight)" />
      <Eye cx={63} cy={64} r={9.5} iris="#c9b33a" lid={0.42} blink={p.blink} />
      <Eye cx={97} cy={64} r={9.5} iris="#c9b33a" lid={0.42} blink={p.blink} />
      <path d="M 74 75 Q 80 72 86 75 L 80 82 Z" fill="url(#catNose)" />
      <ellipse cx={80} cy={93} rx={6} ry={1 + 5 * p.mouth} fill="#4a141b" />
      <g stroke="#ffffff" strokeWidth={1.6} opacity={0.85}>
        <path d="M 60 84 L 34 80 M 60 88 L 34 92 M 100 84 L 126 80 M 100 88 L 126 92" />
      </g>
    </g>
  );
};

/** Marigold: a mother hen with a polka-dot apron and a wooden spoon. */
const Hen: React.FC<Pose> = (p) => {
  const raise = 20 * p.gesture;
  return (
    <g>
      <defs>
        <Vol id="henBody" base="#efe3d0" light={0.6} />
        <Vol id="henWing" base="#ddcbb0" light={0.4} />
        <Vol id="henRed" base="#d23238" />
        <Vol id="henBeak" base="#f0ad32" />
        <linearGradient id="henApron" x1="0" x2="1">
          <stop offset="0" stopColor="#cbbca2" />
          <stop offset="0.35" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c4b398" />
        </linearGradient>
        <linearGradient id="henSpoon" x1="0" x2="1">
          <stop offset="0" stopColor="#6a4220" />
          <stop offset="0.4" stopColor="#dca266" />
          <stop offset="1" stopColor="#6a4220" />
        </linearGradient>
      </defs>
      <Legs p={p} color="#e9a23a" foot="#e9a23a" w={9} />
      {/* tail feathers */}
      <path d="M 108 150 Q 140 120 136 96 Q 128 120 112 130 Z" fill="url(#henWing)" />
      {/* body */}
      <ellipse cx={80} cy={150} rx={46} ry={50} fill="url(#henBody)" />
      <Spec cx={58} cy={124} rx={12} ry={6} o={0.5} />
      {/* apron (wraps the round body: shaded at both sides) */}
      <path d="M 58 138 L 102 138 L 108 190 Q 80 198 52 190 Z" fill="url(#henApron)" />
      <path d="M 56 134 Q 80 140 104 134" stroke="#e05a7a" strokeWidth={5} fill="none" strokeLinecap="round" />
      {[
        [68, 154],
        [90, 150],
        [80, 170],
        [96, 178],
        [64, 182],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill="#e05a7a" />
      ))}
      {/* wings: left resting, right holding the spoon (raised while talking) */}
      <AO cx={44} cy={152} rx={8} ry={20} o={0.3} />
      <path d="M 38 128 Q 22 156 40 180 Q 50 156 46 130 Z" fill="url(#henWing)" />
      <g transform={`rotate(${-raise} 120 132)`}>
        <AO cx={116} cy={152} rx={8} ry={20} o={0.3} />
        <path d="M 122 128 Q 140 154 122 178 Q 112 156 114 130 Z" fill="url(#henWing)" />
        <g transform="translate(126 170) rotate(-24)">
          <rect x={-3.5} y={-62} width={7} height={62} rx={3.5} fill="url(#henSpoon)" />
          <ellipse cx={0} cy={-68} rx={10} ry={13} fill="url(#henSpoon)" />
          <Spec cx={-3} cy={-72} rx={3} ry={5} o={0.5} rot={0} />
        </g>
      </g>
      {/* head shadow on the body */}
      <AO cx={80} cy={104} rx={30} ry={8} o={0.4} />
      {/* comb + head */}
      <circle cx={68} cy={30} r={9} fill="url(#henRed)" />
      <circle cx={80} cy={24} r={11} fill="url(#henRed)" />
      <circle cx={92} cy={30} r={9} fill="url(#henRed)" />
      <circle cx={80} cy={66} r={36} fill="url(#henBody)" />
      <Spec cx={62} cy={46} rx={10} ry={6} o={0.55} />
      <Eye cx={66} cy={62} r={7.5} iris="#4a2f1a" blink={p.blink} />
      <Eye cx={94} cy={62} r={7.5} iris="#4a2f1a" blink={p.blink} />
      <path d="M 58 54 l -4 -4 M 62 52 l -2 -5 M 102 54 l 4 -4 M 98 52 l 2 -5" stroke="#3a2a20" strokeWidth={2} strokeLinecap="round" />
      <circle cx={58} cy={78} r={6} fill="#f0a0a0" opacity={0.45} filter="url(#glint)" />
      <circle cx={102} cy={78} r={6} fill="#f0a0a0" opacity={0.45} filter="url(#glint)" />
      {/* beak: lower half opens while talking */}
      <AO cx={80} cy={86} rx={10} ry={4} o={0.3} />
      <path d={`M 71 78 Q 80 ${86 + 7 * p.mouth} 89 78 Z`} fill={shade("#f0ad32", -0.35)} />
      <path d="M 70 78 Q 80 66 90 78 Q 80 82 70 78 Z" fill="url(#henBeak)" />
      <path d={`M 78 ${84 + 7 * p.mouth} Q 80 ${98 + 7 * p.mouth} 84 ${86 + 7 * p.mouth}`} fill="url(#henRed)" />
    </g>
  );
};

/** Pip: a clever fox with round glasses and a stack of books. */
const Fox: React.FC<Pose> = (p) => {
  const raise = 18 * p.gesture;
  const FUR = "#e07a2e";
  return (
    <g>
      <defs>
        <Vol id="foxFur" base={FUR} />
        <Vol id="foxWhite" base="#f4ece0" light={0.6} />
        <Vol id="foxDark" base="#3a2418" light={0.45} />
      </defs>
      {/* bushy tail with a white tip */}
      <path d="M 110 186 C 156 182 158 120 132 104 C 146 132 134 160 108 170 Z" fill="url(#foxFur)" />
      <path d="M 132 104 C 146 116 148 128 146 136 C 140 124 134 116 126 112 Z" fill="url(#foxWhite)" />
      <Legs p={p} color="#4a2e1e" foot="#2e1c12" w={14} />
      {/* body + bib */}
      <path d="M 80 104 C 116 104 124 152 118 180 C 112 198 48 198 42 180 C 36 152 44 104 80 104 Z" fill="url(#foxFur)" />
      <path d="M 80 108 C 98 118 100 160 80 186 C 60 160 62 118 80 108 Z" fill="url(#foxWhite)" />
      <Spec cx={60} cy={128} rx={9} ry={5} o={0.35} />
      {/* left arm holds the books against the body */}
      <AO cx={50} cy={150} rx={12} ry={20} o={0.35} />
      <Limb d="M 46 124 Q 40 150 54 168" color="#c4622a" w={14} />
      <g transform="translate(36 150)">
        {[
          [0, "#c0392b", 40],
          [11, "#2c6fb0", 36],
          [22, "#d9a62e", 40],
        ].map(([y, c, w]) => (
          <g key={String(y)}>
            <rect x={0} y={Number(y)} width={Number(w)} height={11} rx={2} fill={String(c)} />
            <rect x={0} y={Number(y)} width={Number(w)} height={3} fill="#ffffff" opacity={0.3} />
            <rect x={0} y={Number(y) + 8} width={Number(w)} height={3} fill="#000" opacity={0.25} />
            <rect x={Number(w) - 8} y={Number(y) + 2} width={4} height={7} fill="#f6efe0" />
          </g>
        ))}
      </g>
      <Ball cx={56} cy={170} r={7} fill="url(#foxDark)" />
      {/* right arm gestures while talking */}
      <AO cx={112} cy={140} rx={8} ry={18} o={0.3} />
      <Limb d={`M 114 124 Q ${126 + raise * 0.3} ${144 - raise} ${118 + raise * 0.4} ${166 - raise * 1.6}`} color="#c4622a" w={14} />
      <Ball cx={118 + raise * 0.4} cy={168 - raise * 1.6} r={7} fill="url(#foxDark)" />
      {/* head shadow on the body */}
      <AO cx={80} cy={104} rx={32} ry={8} o={0.45} />
      {/* head: pointed ears, wide cheeks, white muzzle */}
      <path d="M 36 54 L 30 10 L 66 34 Z" fill="url(#foxFur)" />
      <path d="M 124 54 L 130 10 L 94 34 Z" fill="url(#foxFur)" />
      <path d="M 40 44 L 36 20 L 58 36 Z M 120 44 L 124 20 L 102 36 Z" fill="url(#foxDark)" />
      <path d="M 80 104 C 58 104 30 86 28 62 C 28 40 52 30 80 30 C 108 30 132 40 132 62 C 130 86 102 104 80 104 Z" fill="url(#foxFur)" />
      <AO cx={56} cy={38} rx={12} ry={5} o={0.25} />
      <AO cx={104} cy={38} rx={12} ry={5} o={0.25} />
      <path d="M 80 104 C 64 104 40 92 34 72 C 52 74 66 82 80 82 C 94 82 108 74 126 72 C 120 92 96 104 80 104 Z" fill="url(#foxWhite)" />
      <Spec cx={56} cy={46} rx={12} ry={6} o={0.45} />
      <Eye cx={64} cy={62} r={8} iris="#3a6a2a" blink={p.blink} />
      <Eye cx={96} cy={62} r={8} iris="#3a6a2a" blink={p.blink} />
      {/* round glasses: rims cast a faint shadow, lenses catch a glint */}
      <circle cx={65} cy={64} r={13} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={3} filter="url(#glint)" />
      <circle cx={97} cy={64} r={13} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={3} filter="url(#glint)" />
      <circle cx={64} cy={62} r={13} fill="#ffffff" fillOpacity={0.1} stroke="#2a1a10" strokeWidth={3} />
      <circle cx={96} cy={62} r={13} fill="#ffffff" fillOpacity={0.1} stroke="#2a1a10" strokeWidth={3} />
      <path d="M 77 62 L 83 62" stroke="#2a1a10" strokeWidth={3} />
      <path d="M 56 55 L 61 52 M 88 55 L 93 52" stroke="#ffffff" strokeWidth={2} opacity={0.8} strokeLinecap="round" />
      <ellipse cx={80} cy={84} rx={7} ry={5} fill="url(#foxDark)" />
      <Spec cx={78} cy={82} rx={2.5} ry={1.5} o={0.8} rot={0} />
      <path d={`M 72 94 Q 80 ${96 + 7 * p.mouth} 88 94`} stroke="#3a2418" strokeWidth={3} fill={p.mouth > 0.25 ? "#6a2018" : "none"} strokeLinecap="round" />
    </g>
  );
};

/* ------------------------------------------------------------ bubble */

/**
 * 3D speech bubble: a glossy face on top of an extruded "slab" (offset darker layer),
 * slightly tilted in perspective, with a 3D tail. It sizes itself to the current
 * sentence (laid out invisibly, typed text drawn on top, so it never grows mid-typing).
 */
const Bubble: React.FC<{ x: number; y: number; pop: number; opacity: number; line: string; typed: number }> = ({ x, y, pop, opacity, line, typed }) => {
  const DEPTH = 12;
  const R = 38;
  const face: React.CSSProperties = {
    position: "relative",
    padding: "20px 32px 24px",
    borderRadius: R,
    border: "5px solid #121418",
    background: "linear-gradient(180deg, #ffffff 0%, #f4f6fa 55%, #dfe4ec 100%)",
    boxShadow: "inset 0 -8px 0 rgba(30,40,60,0.08), inset 0 3px 0 rgba(255,255,255,0.9)",
  };
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translateY(-100%) perspective(900px) rotateX(10deg) rotateY(-12deg) scale(${(0.3 + 0.7 * pop).toFixed(3)})`,
        transformOrigin: "0% 100%",
        opacity,
        pointerEvents: "none",
        zIndex: 6,
        filter: "drop-shadow(0 18px 18px rgba(0,0,0,0.55))",
      }}
    >
      <div style={{ position: "relative", display: "inline-block", maxWidth: 560, marginLeft: 24, marginBottom: 34 + DEPTH }}>
        {/* extruded slab below the face */}
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${DEPTH}px)`, borderRadius: R, background: "linear-gradient(180deg, #9aa4b6, #5e6878)", border: "5px solid #121418" }} />
        {/* tail: slab then face */}
        <svg width={60} height={56} viewBox="0 0 60 56" style={{ position: "absolute", left: 14, bottom: -44 - DEPTH, overflow: "visible" }}>
          <path d={`M 8 ${DEPTH - 4} L 2 ${50 + DEPTH * 0.4} L 40 ${DEPTH - 4} Z`} fill="#6e788a" stroke="#121418" strokeWidth={5} strokeLinejoin="round" />
          <path d="M 8 0 L 2 48 L 40 0 Z" fill="#e4e8ef" stroke="#121418" strokeWidth={5} strokeLinejoin="round" />
        </svg>
        <div style={face}>
          {/* covers the tail's top stroke where it joins the face */}
          <div style={{ position: "absolute", left: 18, bottom: -6, width: 34, height: 10, background: "#e0e5ec" }} />
          {/* glossy highlight band */}
          <div style={{ position: "absolute", left: 22, right: 22, top: 8, height: 14, borderRadius: 999, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))" }} />
          <div style={{ position: "relative", fontFamily: BODY_FONT, fontWeight: 800, fontSize: 44, lineHeight: 1.2, color: "#1b1d22", textShadow: "0 1px 0 #ffffff" }}>
            <span style={{ visibility: "hidden" }}>{line}</span>
            <span style={{ position: "absolute", left: 0, right: 0, top: 0 }}>{line.slice(0, typed)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
