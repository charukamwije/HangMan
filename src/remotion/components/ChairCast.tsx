import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { YT_FONT } from "../fonts";
import { ramp } from "../motion";
import { KEYBOARD_HEIGHT } from "./Keyboard";

/**
 * A little library chair (3/4 front view) in the gap left of the keyboard's two
 * short bottom rows. Once per video one animal character (picked from the
 * answer, so a puzzle always gets the same one) waddles in, hops onto the
 * chair, blows up two balloons (blue "LIKE", then red "SUBSCRIBE"), holds each
 * up on its string, lets it float away, then waddles off.
 *
 * Characters are original, front-facing animal mascots built from a few clean,
 * sphere-shaded shapes (key light top-left). Every transition is eased.
 * The 15 s visit runs 6.0 s → 21.0 s: frame 0 and the loop point always show the
 * empty chair, and it is over before stress mode (00:07 left, 22 s).
 */
export const CAST_VISIT = { at: 6.0, walkIn: 2.2, sit: 0.7, talk: 9.7, stand: 0.6, walkOut: 1.8 } as const;

type CastId = "biscuit" | "marigold" | "pip";
/** Where each character's lips are in its 160×260 box (balloons are blown from here). */
const MOUTH_Y: Record<CastId, number> = { biscuit: 92, marigold: 80, pip: 95 };
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
const WALK_FULL_SPEED = 170;

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
      ? interpolate(time, [v.at, tIn], [offX, CHAIR_CX], { ...CLAMP, easing: Easing.inOut(Easing.sin) })
      : time < tUp
        ? CHAIR_CX
        : interpolate(time, [tUp, tGone], [CHAIR_CX, offX], { ...CLAMP, easing: Easing.inOut(Easing.sin) });
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

  // Balloon call-to-action while seated: a blue "LIKE" balloon, then a red "SUBSCRIBE" one. Each is
  // blown up at the lips, tied and raised on its string in the character's hand, held up (bobbing),
  // then let go (`release`) to float all the way up and out of the top of the frame, which takes
  // FLOAT seconds and carries on after the character has left.
  const b1 = tSat + 0.2;
  const b2 = b1 + 4.75;
  const balloons = [
    { start: b1, release: b1 + 3.5, ...BALLOON.like },
    { start: b2, release: tTalkEnd - 1.2, ...BALLOON.subscribe },
  ];
  const locals = balloons.map((b) => ({ b, u: t - b.start, rel: b.release - b.start }));
  const blowing = visiting && locals.some(({ u }) => u >= 0 && u < BLOW);
  const blink = (t % 3.2) < 0.12 ? 1 : 0;
  // arm raised holding the string from tie-off until it's let go
  const holding = Math.max(0, ...locals.map(({ u, rel }) => ramp(u, [BLOW, BLOW + 0.3, rel, rel + 0.3], [0, 1, 1, 0])));
  // lips puckered while blowing; a happy open mouth while showing the balloon off
  const mouth = blowing ? 0.1 : 0.35 * holding;
  const gesture = holding * (0.9 + 0.1 * Math.sin(t * 3));

  const boxLeft = x - BOX.cx;
  const boxTop = floorY - BOX.floor;
  const bodyTop = boxTop + bob + hop;
  // blown from the corner of the mouth (towards the keyboard), so both eyes stay visible
  const mouthAt = { x: x + 22, y: bodyTop + MOUTH_Y[id] };
  // the raised hand (same arm maths as the characters' gesturing arm)
  const raise = 24 * gesture;
  const handAt = { x: boxLeft + 120 + raise * 0.4, y: bodyTop + 168 - raise * 1.6 };
  // where a held balloon's knot hovers: up and to the right of the hand
  const hoverAt = { x: CHAIR_CX + 150, y: boxTop + 10 };
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
      {locals.map(({ b, u, rel }) =>
        u >= 0 && u < rel + FLOAT ? <Balloon key={b.label} mouth={mouthAt} hand={handAt} hover={hoverAt} local={u} t={t} {...b} release={rel} /> : null,
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

/* ------------------------------------------------------------ balloon call-to-action */

/** Balloon phases (s): blow up at the lips, rise to the hover spot, and once let go, float up out of frame. */
const BLOW = 1.7;
const RISE = 0.8;
const FLOAT = 4.2;
/** Float-away: time to pick up speed after the hand lets go (s), and the clearance above the frame top (px). */
const FLOAT_ACCEL = 0.7;
const FLOAT_CLEAR = 450;
/** r: half-width of the balloon (design px); font: label size in balloon units (1 = r). */
const BALLOON = {
  // YouTube's own button wording and face: sentence case, Roboto Medium
  // motif: the badge printed all over the balloon (like / play-button), textHalf/band: label area kept clear
  like: { label: "Like", base: "#1e88ff", r: 150, font: 0.66, motif: "like", textHalf: 0.72, band: 0.3 },
  subscribe: { label: "Subscribe", base: "#ff2433", r: 175, font: 0.35, motif: "subscribe", textHalf: 0.92, band: 0.22 },
} as const;
type Motif = "like" | "subscribe";

/** Thumbs-up glyph on a 24×24 grid (Material "thumb_up" shape). */
const THUMB_PATH =
  "M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z";

/**
 * Where the printed badges sit on the unit balloon: a staggered grid over the round part,
 * skipping the label row. Each badge is smaller and squashed toward the rim, so the print
 * reads as wrapping around the curved surface.
 */
const motifSpots = (textHalf: number, band: number) => {
  const spots: { x: number; y: number; s: number; sx: number; sy: number }[] = [];
  for (let row = 0, y = -2.02; y < -0.35; row++, y += 0.3) {
    for (let x = -1 + (row % 2 ? 0.17 : 0); x <= 1.001; x += 0.34) {
      const nx = x / 0.98;
      const ny = (y + 1.25) / 0.98;
      const d = Math.hypot(nx, ny);
      if (d > 0.97) continue;
      if (Math.abs(y - LABEL_Y) < band && Math.abs(x) < textHalf) continue;
      const depth = Math.sqrt(Math.max(0, 1 - d * d));
      spots.push({
        x,
        y,
        s: 0.24 * (0.45 + 0.55 * depth),
        sx: 0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - nx * nx)),
        sy: 0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - ny * ny)),
      });
    }
  }
  return spots;
};

/** One printed badge, centred on (0,0), `s` wide: a like badge or a play-button badge. */
const MotifBadge: React.FC<{ motif: Motif; s: number; color: string }> = ({ motif, s, color }) =>
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
const BODY_PATH =
  "M 0 -2.2 C 0.62 -2.2 1 -1.77 1 -1.25 C 1 -0.67 0.45 -0.19 0.07 -0.05 L -0.07 -0.05 C -0.45 -0.19 -1 -0.67 -1 -1.25 C -1 -1.77 -0.62 -2.2 0 -2.2 Z";
const KNOT_PATH = "M -0.07 -0.06 L 0.07 -0.06 L 0.13 0.09 Q 0 0.04 -0.13 0.09 Z";
/** Centre of the round part, where the label sits (unit coords). */
const LABEL_Y = -1.22;

/**
 * A glossy latex balloon. Blown up at the lips in a few puffs (lying on its side, neck at the
 * mouth), it is tied off and rises upright to hover above the character's raised hand on a
 * string, bobbing and swaying; finally the hand lets go and it floats all the way up and out
 * of the top of the frame (no fade), swaying and trailing its string.
 */
const Balloon: React.FC<{
  mouth: { x: number; y: number };
  hand: { x: number; y: number };
  hover: { x: number; y: number };
  local: number;
  /** seconds after `start` when the hand lets go */
  release: number;
  t: number;
  label: string;
  base: string;
  r: number;
  font: number;
  motif: Motif;
  textHalf: number;
  band: number;
}> = ({ mouth, hand, hover, local: u, release: releaseAt, t, label, base, r: R, font, motif, textHalf, band }) => {
  // --- size: inflated in a few puffs (each breath swells it a little more)
  const blowK = Math.min(1, u / BLOW);
  const breath = Math.sin(blowK * Math.PI * 4) * 0.035 * (1 - blowK);
  const grow = 0.08 + 0.92 * Easing.inOut(Easing.cubic)(blowK) + breath;
  // stretchy "boing" as it lifts off once tied
  const settle = u > BLOW ? Math.sin((u - BLOW) * 18) * 0.05 * Math.max(0, 1 - (u - BLOW) / 0.6) : 0;
  const r = R * Math.max(0.08, grow);

  // --- knot position + orientation
  const rise = interpolate(u, [BLOW, BLOW + RISE], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  // Float-away: picks up speed smoothly, then rises at a steady pace, sized so that exactly
  // FLOAT s after release the balloon (and its trailing string) have cleared the frame top.
  const tau = Math.max(0, u - releaseAt);
  const freed = tau > 0;
  const climb = (s: number) => s - FLOAT_ACCEL * (1 - Math.exp(-s / FLOAT_ACCEL)); // smooth accel → constant speed
  const floatDist = hover.y + FLOAT_CLEAR;
  const up = (floatDist * climb(tau)) / climb(FLOAT);
  const drift = 90 * Math.min(1, tau / FLOAT) + Math.sin(tau * 1.7) * 22 * Math.min(1, tau);
  const bobY = Math.sin(t * 2.2) * 10 * rise;
  const swayX = Math.sin(t * 1.4 + 0.6) * 8 * rise;
  const knot = {
    x: mouth.x + (hover.x - mouth.x) * rise + swayX + drift,
    y: mouth.y + (hover.y - mouth.y) * rise + bobY - up,
  };
  // blowing: on its side pointing away from the lips (slightly up); held/floating: upright, swaying
  const angle = 80 * (1 - rise) + (Math.sin(t * 1.4) * 5 + swayX * 0.4) * rise + Math.sin(tau * 1.7 + 1) * 6 * Math.min(1, tau);
  const opacity = 1;

  // --- string: tied on after blowing; runs to the hand while held, trails below once let go
  const end = freed ? { x: knot.x - 24 + Math.sin(tau * 2.4) * 18, y: knot.y + 200 } : hand;
  const midX = (knot.x + end.x) / 2 + Math.sin(t * 2.6) * 14;
  const midY = (knot.y + end.y) / 2;
  const stringOpacity = ramp(u, [BLOW, BLOW + 0.15], [0, 1]);

  const textIn = ramp(u, [BLOW + RISE * 0.3, BLOW + RISE], [0, 1]);
  const light = shade(base, 0.6);
  const dark = shade(base, -0.45);
  const gid = `balloon-${motif}`;
  const spots = motifSpots(textHalf, band);

  return (
    <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", zIndex: 6, opacity }}>
      <defs>
        <radialGradient id={`${gid}-fill`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor={light} />
          <stop offset="0.45" stopColor={base} />
          <stop offset="0.9" stopColor={dark} />
          <stop offset="1" stopColor={shade(base, -0.25)} />
        </radialGradient>
        <filter id={`${gid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={0.04} />
        </filter>
        <filter id={`${gid}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx={0} dy={0.08} stdDeviation={0.07} floodColor="#000" floodOpacity={0.45} />
        </filter>
        <clipPath id={`${gid}-clip`}>
          <path d={BODY_PATH} />
        </clipPath>
        {/* curvature shading laid over the print: lit top-left, darker toward the rim */}
        <radialGradient id={`${gid}-curve`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#000" stopOpacity={0} />
          <stop offset="0.6" stopColor="#000" stopOpacity={0.06} />
          <stop offset="1" stopColor="#000" stopOpacity={0.4} />
        </radialGradient>
      </defs>
      {u >= BLOW && (
        <path
          d={`M ${knot.x.toFixed(1)} ${knot.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
          stroke="#f4f1ea"
          strokeWidth={3}
          fill="none"
          opacity={stringOpacity}
        />
      )}
      <g transform={`translate(${knot.x.toFixed(1)} ${knot.y.toFixed(1)}) rotate(${angle.toFixed(2)}) scale(${(r * (1 + settle)).toFixed(2)} ${(r * (1 - settle)).toFixed(2)})`}>
        <path d={BODY_PATH} fill={`url(#${gid}-fill)`} filter={`url(#${gid}-shadow)`} />
        {/* badges printed all over the latex, then the same curvature shading on top of them */}
        <g clipPath={`url(#${gid}-clip)`}>
          <g opacity={0.92}>
            {spots.map((p, i) => (
              <g key={i} transform={`translate(${p.x.toFixed(3)} ${p.y.toFixed(3)}) scale(${p.sx.toFixed(3)} ${p.sy.toFixed(3)})`}>
                <MotifBadge motif={motif} s={p.s} color={base} />
              </g>
            ))}
          </g>
          <path d={BODY_PATH} fill={`url(#${gid}-curve)`} />
        </g>
        {/* rim, then glossy highlights (big soft one top-left, a sharp glint, faint bounce light) */}
        <path d={BODY_PATH} fill="none" stroke={shade(base, -0.55)} strokeWidth={0.04} opacity={0.5} />
        <ellipse cx={-0.42} cy={-1.72} rx={0.26} ry={0.14} fill="#ffffff" opacity={0.8} transform="rotate(-35 -0.42 -1.72)" filter={`url(#${gid}-soft)`} />
        <ellipse cx={-0.68} cy={-1.36} rx={0.06} ry={0.06} fill="#ffffff" opacity={0.7} />
        <ellipse cx={0.5} cy={-0.62} rx={0.22} ry={0.07} fill="#ffffff" opacity={0.18} transform="rotate(-50 0.5 -0.62)" />
        <path d={KNOT_PATH} fill={dark} />
        {textIn > 0 && (
          <text
            x={0}
            y={LABEL_Y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={YT_FONT}
            fontWeight={500}
            fontSize={font}
            fill="#ffffff"
            stroke={dark}
            strokeWidth={0.05}
            paintOrder="stroke"
            opacity={textIn}
            // stays (nearly) upright whatever the balloon does, keeping just a hint of its sway
            transform={`rotate(${(-angle * 0.8).toFixed(2)} 0 ${LABEL_Y})`}
          >
            {label}
          </text>
        )}
      </g>
    </svg>
  );
};
