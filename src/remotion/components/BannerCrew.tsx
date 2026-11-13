import React from "react";
import { Easing, interpolate } from "remotion";
import { ramp } from "../motion";

/**
 * The banner crew: two mice hold the hook banner's top corners; now and then
 * one loses its grip and that end swings down. The mouse stays put, pulls out a
 * crook stick, hooks it over the fallen corner, leans back and hauls it up to
 * level, then tucks the stick away. Heads turn and nod to follow the action. A third mouse abseils in, pins a thread to
 * the wall above the banner and climbs away — until the pin pops out.
 *
 * Everything is a pure function of time on a fixed schedule (seconds), so the
 * Player, every render and every loop of the reel look identical. All events
 * sit between 2 s and 26 s: frame 0 and the loop point show the resting pose.
 */
export const CREW_SCHEDULE = {
  drops: [
    { at: 6.5, side: "left" as const },
    { at: 12.0, side: "right" as const },
    { at: 23.5, side: "right" as const }, // the pin pops out and this side goes with it
  ],
  pinner: { at: 16.0, duration: 3.8 },
  pinPopAt: 23.5,
};
const DROP_SECONDS = 2.1;

export const MOUSE_W = 100;
const MOUSE_H = 150;
/** Hand target that grips the banner's top corner, in (unmirrored) mouse coords. */
const HOLD = { x: 106, y: 32 };
/** Mouse box top, relative to the banner's top edge. */
const MOUSE_TOP = -26;

type Side = "left" | "right";

/** Banner tilt (deg) s seconds into a drop: slip, swing, settle, hang while the stick is fetched, haul back up. */
const dropAngle = (s: number) =>
  interpolate(s, [0, 0.28, 0.4, 0.52, 0.65, 1.0, 1.75, DROP_SECONDS], [0, 15, 11.5, 13.5, 13, 13, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

export type CrewState = {
  /** Rotation for the banner (deg) and its pivot (the corner still held). */
  angle: number;
  origin: string;
  /** Idle follow: the banner rides the holders' hands (lift in px, tilt in deg about its top centre). */
  idleDy: number;
  idleTilt: number;
  left: MousePose;
  right: MousePose;
  pinner: { s: number } | null;
  /** Pin + thread: seconds since pinned (null = no pin), and seconds since it popped. */
  pin: { since: number; popped: number | null } | null;
};

/** Idle life: tail swish (deg), ear twitch (0..1), head look (-1 left … 1 right), nose wiggle (px), body sway (deg). */
export type MouseIdle = { tail: number; ear: number; look: number; nose: number; sway: number };
type Pt = { x: number; y: number };
/** Head on the neck: rotation (deg, + = nod down toward the front) and gaze offset for the pupil. */
export type MouseHead = { rot: number; gx: number; gy: number };
/** Crook stick held in both hands: grip point, the hook's attachment point, and visibility 0..1. */
export type MouseStick = { grip: Pt; tip: Pt; vis: number };
export type MousePose = { dx: number; dy: number; hand: Pt; surprise: number; lean: number; idle?: MouseIdle; head?: MouseHead; stick?: MouseStick };

/** Neck pivot (head rotates around it) and head centre, in mouse coords. */
const NECK = { x: 50, y: 78 };
const HEAD_C = { x: 54, y: 60 };
/** Where the hands hold the crook stick, in mouse coords. */
const GRIP = { x: 60, y: 82 };

/** Natural head aim at a target point: the head turns/nods part of the way, the eyes do the rest. */
const aimHead = (target: Pt, amt: number): MouseHead => {
  const dx = target.x - HEAD_C.x;
  const dy = target.y - HEAD_C.y;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI; // 0 = straight ahead (the banner), + = down
  const d = Math.hypot(dx, dy) || 1;
  return { rot: Math.max(-14, Math.min(30, ang * 0.5)) * amt, gx: (dx / d) * 1.8 * amt, gy: (dy / d) * 1.8 * amt };
};

/** Rotate a point about a pivot (deg). */
const rotAbout = (p: Pt, c: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  const x = p.x - c.x;
  const y = p.y - c.y;
  return { x: c.x + x * Math.cos(r) - y * Math.sin(r), y: c.y + x * Math.sin(r) + y * Math.cos(r) };
};
const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

const REST: MousePose = { dx: 0, dy: 0, hand: HOLD, surprise: 0, lean: 0 };

/**
 * One holder's idle loop (all periods divide 30 s, so the reel loops seamlessly): a gentle bob,
 * an occasional heave to re-adjust the grip, looking around, ear twitches, tail swish and a
 * sniffing nose. `ph` offsets each mouse so they never move in lockstep; `amt` fades it out.
 */
const mouseIdle = (t: number, ph: number, amt: number): { dy: number; idle: MouseIdle } => {
  const u = (t + ph) % 6;
  const heave = ramp(u, [2.0, 2.25, 2.55, 2.9], [0, 1, 1, 0]); // hitch the corner up a little
  const v = (t + ph * 1.7) % 7.5;
  const look = ramp(v, [0.8, 1.0, 2.2, 2.4, 4.6, 4.8, 5.8, 6.0], [0, 1, 1, 0, 0, -0.8, -0.8, 0]);
  const ear = Math.max(ramp(u, [0.6, 0.7, 0.85], [0, 1, 0]), ramp(u, [4.1, 4.2, 4.35], [0, 1, 0]));
  const sniff = ramp(v, [3.0, 3.1, 3.9, 4.0], [0, 1, 1, 0]);
  return {
    dy: (3 * Math.sin(((t + ph) / 2.5) * Math.PI * 2) - 9 * heave) * amt,
    idle: {
      tail: 14 * Math.sin(((t + ph) / 1.5) * Math.PI * 2) * amt,
      ear: ear * amt,
      look: look * amt,
      nose: 1.6 * Math.sin(t * 30) * sniff * amt,
      sway: 2 * Math.sin(((t + ph) / 3) * Math.PI * 2) * amt,
    },
  };
};

/** Crew state at time t (seconds). `bannerW` = banner width in px (for the swing geometry). */
export function crewState(t: number, bannerW: number): CrewState {
  const drop = CREW_SCHEDULE.drops.find((d) => t >= d.at && t < d.at + DROP_SECONDS);
  // Idle life fades out around each drop (and back in after), so the gags play exactly as before.
  const busy = Math.max(0, ...CREW_SCHEDULE.drops.map((d) => ramp(t, [d.at - 0.35, d.at, d.at + DROP_SECONDS, d.at + DROP_SECONDS + 0.5], [0, 1, 1, 0])));
  const amt = 1 - busy;
  const li = mouseIdle(t, 0, amt);
  const ri = mouseIdle(t, 2.3, amt);
  const state: CrewState = {
    angle: 0,
    origin: "0% 0%",
    // each corner sits exactly in its mouse's hands: lift = average, tilt = difference across the banner
    idleDy: (li.dy + ri.dy) / 2,
    idleTilt: (Math.atan2(ri.dy - li.dy, bannerW) * 180) / Math.PI,
    left: { ...REST, dy: li.dy, idle: li.idle },
    right: { ...REST, dy: ri.dy, idle: ri.idle },
    pinner: null,
    pin: null,
  };

  if (drop) {
    const s = t - drop.at;
    const a = dropAngle(s);
    const rad = (a * Math.PI) / 180;
    const cornerDy = bannerW * Math.sin(rad); // how far the free corner has fallen
    const cornerDx = bannerW * (Math.cos(rad) - 1); // and how far it has swung inward
    // The mouse stays put. It pulls out a crook stick, hooks it over the fallen corner's top edge,
    // leans back and hauls the corner up to level, then tucks the stick away and grips the corner again.
    const lean = ramp(s, [1.0, 1.15, 1.6, 1.8], [0, 0.8, 0.8, 0]);
    // The mouse box leans (rotates about its feet) while pulling; work in its leaned frame so the
    // hook lands exactly on the corner on screen.
    const FEET = { x: 50, y: 135 };
    // (cornerDx < 0 = the corner swings inward, toward the banner = +x in either mouse's own frame)
    const corner = rotAbout({ x: HOLD.x - cornerDx, y: HOLD.y + cornerDy }, FEET, 6 * lean);
    const hookAt = { x: corner.x - 10, y: corner.y - 10 }; // the crook curls over the top edge from here
    const stickRest = { x: GRIP.x + 34, y: GRIP.y + 22 }; // stick held short, pointing down-forward
    const reachK = Easing.inOut(Easing.cubic)(ramp(s, [0.42, 0.9], [0, 1]));
    const awayK = Easing.inOut(Easing.cubic)(ramp(s, [1.78, 2.02], [0, 1]));
    const tip = lerpPt(lerpPt(stickRest, hookAt, reachK), stickRest, awayK);
    const vis = Math.min(ramp(s, [0.3, 0.42], [0, 1]), 1 - ramp(s, [1.96, 2.08], [0, 1]));
    // Hands: flail while it slips, grab the stick, and after it's put away, take the corner again.
    const flail = { x: HOLD.x - 18 + 10 * Math.sin(s * 40), y: HOLD.y - 26 + 6 * Math.cos(s * 37) };
    const toStick = ramp(s, [0.26, 0.4], [0, 1]);
    const backToHold = ramp(s, [1.9, 2.08], [0, 1]);
    const hand = lerpPt(lerpPt(flail, GRIP, toStick), HOLD, backToHold);
    // Head: watches the corner fall, then follows the hook down and back up.
    const watch = s < 0.45 ? corner : tip;
    const lookAmt = ramp(s, [0, 0.12, 1.88, 2.06], [0, 1, 1, 0]);
    const freePose: MousePose = {
      dx: 0,
      dy: 0,
      hand,
      surprise: ramp(s, [0, 0.08, 0.5, 0.7], [0, 1, 1, 0]),
      lean,
      head: aimHead(watch, lookAmt),
      stick: vis > 0.01 ? { grip: GRIP, tip, vis } : undefined,
    };
    const braceLean = ramp(s, [0, 0.2, 1.6, DROP_SECONDS], [0, 1, 1, 0]);
    // The other mouse braces, and glances along the banner at the drama.
    const bracePose: MousePose = { ...REST, lean: braceLean, head: aimHead({ x: HOLD.x + 200, y: HOLD.y + 60 }, braceLean) };
    state.idleDy = 0;
    state.idleTilt = 0;
    if (drop.side === "right") {
      state.angle = a;
      state.origin = "0% 0%";
      state.right = freePose;
      state.left = bracePose;
    } else {
      state.angle = -a;
      state.origin = "100% 0%";
      state.left = freePose;
      state.right = bracePose;
    }
  }

  const p = CREW_SCHEDULE.pinner;
  if (t >= p.at && t < p.at + p.duration) state.pinner = { s: t - p.at };
  const pinnedAt = p.at + 1.25;
  if (t >= pinnedAt && t < CREW_SCHEDULE.pinPopAt + 1.2) {
    state.pin = { since: t - pinnedAt, popped: t >= CREW_SCHEDULE.pinPopAt ? t - CREW_SCHEDULE.pinPopAt : null };
  }
  return state;
}

/* ------------------------------------------------------------ rendering */

/** Two holders, positioned in the banner wrapper's coordinates (banner top-left = 0,0). */
export const Holders: React.FC<{ crew: CrewState; bannerW: number; blink: boolean }> = ({ crew, bannerW, blink }) => (
  <>
    <div style={{ position: "absolute", left: -MOUSE_W + crew.left.dx, top: MOUSE_TOP + crew.left.dy, width: MOUSE_W, height: MOUSE_H, transform: `rotate(${(-6 * crew.left.lean + (crew.left.idle?.sway ?? 0)).toFixed(2)}deg)`, transformOrigin: "50% 90%" }}>
      <Mouse pose={crew.left} blink={blink} />
    </div>
    <div
      style={{
        position: "absolute",
        left: bannerW - crew.right.dx,
        top: MOUSE_TOP + crew.right.dy,
        width: MOUSE_W,
        height: MOUSE_H,
        transform: `scaleX(-1) rotate(${(-6 * crew.right.lean + (crew.right.idle?.sway ?? 0)).toFixed(2)}deg)`,
        transformOrigin: "50% 90%",
      }}
    >
      <Mouse pose={crew.right} blink={blink} />
    </div>
  </>
);

const shadeHex = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/** Volumetric fill: key light top-left, core shadow toward the rim, faint bounce light on the far edge. */
const MVol: React.FC<{ id: string; base: string; light?: number }> = ({ id, base, light = 0.5 }) => (
  <radialGradient id={id} cx="0.4" cy="0.36" r="0.72" fx="0.3" fy="0.24">
    <stop offset="0" stopColor={shadeHex(base, light)} />
    <stop offset="0.3" stopColor={shadeHex(base, light * 0.25)} />
    <stop offset="0.68" stopColor={base} />
    <stop offset="0.9" stopColor={shadeHex(base, -0.4)} />
    <stop offset="1" stopColor={shadeHex(base, -0.2)} />
  </radialGradient>
);

/** Tube-shaded limb along a path (dark edge → base → highlight streak). */
const MLimb: React.FC<{ d: string; color: string; w: number }> = ({ d, color, w }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={shadeHex(color, -0.5)} strokeWidth={w + 2.5} />
    <path d={d} stroke={shadeHex(color, -0.12)} strokeWidth={w} />
    <path d={d} stroke={color} strokeWidth={w * 0.6} transform={`translate(${-w * 0.12} ${-w * 0.08})`} />
    <path d={d} stroke={shadeHex(color, 0.55)} strokeWidth={Math.max(1.2, w * 0.18)} transform={`translate(${-w * 0.22} ${-w * 0.16})`} opacity={0.8} />
  </g>
);

/**
 * Wooden crook stick (a shepherd's crook in mouse size): a straight, tube-shaded shaft from just
 * behind the grip to `tip`, then a fixed J-hook that curls up, over and down to the right, so at
 * `tip` it hangs over the banner's top edge. Grows out from the grip as `vis` goes 0 → 1.
 */
const CrookStick: React.FC<{ stick: MouseStick }> = ({ stick }) => {
  const { grip, vis } = stick;
  const tip = lerpPt(grip, stick.tip, vis);
  const len = Math.hypot(tip.x - grip.x, tip.y - grip.y) || 1;
  const ux = (tip.x - grip.x) / len;
  const uy = (tip.y - grip.y) / len;
  const butt = { x: grip.x - ux * 14 * vis, y: grip.y - uy * 14 * vis };
  const k = vis; // the hook scales in with the stick
  const hook = `M ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} C ${(tip.x + 2 * k).toFixed(1)} ${(tip.y - 18 * k).toFixed(1)} ${(tip.x + 26 * k).toFixed(1)} ${(tip.y - 18 * k).toFixed(1)} ${(tip.x + 25 * k).toFixed(1)} ${(tip.y + 4 * k).toFixed(1)} L ${(tip.x + 22 * k).toFixed(1)} ${(tip.y + 12 * k).toFixed(1)}`;
  const WOOD = "#9a6230";
  return (
    <g>
      <MLimb d={`M ${butt.x.toFixed(1)} ${butt.y.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`} color={WOOD} w={5} />
      <MLimb d={hook} color={WOOD} w={5} />
      {/* brass ferrule where the hook meets the shaft */}
      <circle cx={tip.x} cy={tip.y} r={3.6 * k} fill="#d6a645" stroke="#6a4a14" strokeWidth={1} />
    </g>
  );
};

/**
 * 3D-shaded cartoon mouse facing right (viewBox 100 × 150). Hands reach `pose.hand`.
 * Every part is lit the same way (key light top-left): volumetric gradients, tube-shaded
 * arms + tail, soft contact shadows where parts meet, and glossy glints on eyes and nose.
 */
const Mouse: React.FC<{ pose: MousePose; blink?: boolean; tint?: string }> = ({ pose, blink, tint = "#a3a3ad" }) => {
  const sh = { x: 54, y: 78 };
  const eyeR = 4 + 2.5 * pose.surprise;
  const idle = pose.idle ?? { tail: 0, ear: 0, look: 0, nose: 0, sway: 0 };
  // head looks around: pivots on the neck (turn/nod) and shifts a touch; the eyes lead the head
  const aim = pose.head ?? { rot: 0, gx: 0, gy: 0 };
  const headX = 3 * idle.look;
  const headY = -1.5 * Math.abs(idle.look);
  const headRot = aim.rot + 6 * idle.look;
  const pupil = 1.6 * idle.look + aim.gx;
  const pupilY = aim.gy;
  const k = tint.slice(1); // per-tint gradient ids (the pinner is a different colour)
  const line = shadeHex(tint, -0.55);
  const PINK = "#f2a7b4";
  const armPath = (off: number) => `M ${sh.x + off} ${sh.y} Q ${(sh.x + pose.hand.x) / 2 + 6} ${(sh.y + pose.hand.y) / 2 + 10} ${pose.hand.x} ${pose.hand.y + off}`;
  const arm = (off: number) => (
    <g>
      <MLimb d={armPath(off)} color={tint} w={7} />
      <circle cx={pose.hand.x} cy={pose.hand.y + off} r={6} fill={`url(#mPaw-${k})`} stroke={shadeHex(PINK, -0.5)} strokeWidth={1.2} />
      <circle cx={pose.hand.x - 2} cy={pose.hand.y + off - 2} r={1.8} fill="#ffffff" opacity={0.7} />
    </g>
  );
  return (
    <svg viewBox="0 0 100 150" width={MOUSE_W} height={MOUSE_H} style={{ overflow: "visible", filter: "drop-shadow(0 8px 8px rgba(0,0,0,0.55))" }}>
      <defs>
        <MVol id={`mFur-${k}`} base={tint} />
        <MVol id={`mHead-${k}`} base={tint} light={0.6} />
        <MVol id={`mBelly-${k}`} base="#ece6ec" light={0.6} />
        <MVol id={`mEar-${k}`} base={tint} light={0.45} />
        <MVol id={`mEarIn-${k}`} base={PINK} light={0.4} />
        <MVol id={`mPaw-${k}`} base={PINK} light={0.5} />
        <MVol id={`mNose-${k}`} base="#e2708a" light={0.7} />
        <linearGradient id={`mTail-${k}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shadeHex(PINK, -0.1)} />
          <stop offset="1" stopColor={shadeHex(PINK, -0.35)} />
        </linearGradient>
        <filter id="mSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.2} />
        </filter>
        <filter id="mGlint" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={0.8} />
        </filter>
      </defs>
      {/* tail (tube-shaded) */}
      <g transform={`rotate(${idle.tail.toFixed(2)} 30 128)`}>
        <path d="M 30 128 C 6 132 4 108 16 100 C 26 94 22 84 12 82" stroke={shadeHex(PINK, -0.5)} strokeWidth={5.5} fill="none" strokeLinecap="round" />
        <path d="M 30 128 C 6 132 4 108 16 100 C 26 94 22 84 12 82" stroke={`url(#mTail-${k})`} strokeWidth={3.6} fill="none" strokeLinecap="round" />
        <path d="M 29 126.6 C 7 130 5.6 108 16.6 100.8" stroke="#ffffff" strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.45} />
      </g>
      {arm(-4)}
      {/* body + belly */}
      <ellipse cx={46} cy={108} rx={26} ry={32} fill={`url(#mFur-${k})`} stroke={line} strokeWidth={1.6} />
      <ellipse cx={50} cy={114} rx={15} ry={20} fill={`url(#mBelly-${k})`} />
      <ellipse cx={36} cy={92} rx={7} ry={4} fill="#ffffff" opacity={0.35} filter="url(#mGlint)" transform="rotate(-30 36 92)" />
      {/* feet (contact shadow first) */}
      <ellipse cx={47} cy={143} rx={24} ry={4} fill="#000" opacity={0.35} filter="url(#mSoft)" />
      <ellipse cx={36} cy={140} rx={11} ry={5} fill={`url(#mPaw-${k})`} stroke={shadeHex(PINK, -0.5)} strokeWidth={1.2} />
      <ellipse cx={58} cy={140} rx={11} ry={5} fill={`url(#mPaw-${k})`} stroke={shadeHex(PINK, -0.5)} strokeWidth={1.2} />
      {/* shadow the head casts on the body */}
      <ellipse cx={50} cy={82} rx={20} ry={6} fill="#000" opacity={0.35} filter="url(#mSoft)" />
      <g transform={`translate(${headX.toFixed(2)} ${headY.toFixed(2)}) rotate(${headRot.toFixed(2)} ${NECK.x} ${NECK.y})`}>
        {/* ears (flick outward on a twitch): cupped, darker inside toward the base */}
        <g transform={`rotate(${(-14 * idle.ear).toFixed(2)} 40 50)`}>
          <circle cx={30} cy={40} r={15} fill={`url(#mEar-${k})`} stroke={line} strokeWidth={1.6} />
          <circle cx={30.5} cy={40.5} r={9.5} fill={`url(#mEarIn-${k})`} />
          <ellipse cx={33} cy={45} rx={6} ry={3.5} fill="#000" opacity={0.18} filter="url(#mSoft)" />
        </g>
        <g transform={`rotate(${(10 * idle.ear).toFixed(2)} 60 46)`}>
          <circle cx={66} cy={36} r={15} fill={`url(#mEar-${k})`} stroke={line} strokeWidth={1.6} />
          <circle cx={66.5} cy={36.5} r={9.5} fill={`url(#mEarIn-${k})`} />
          <ellipse cx={64} cy={42} rx={6} ry={3.5} fill="#000" opacity={0.18} filter="url(#mSoft)" />
        </g>
        {/* head + snout */}
        <ellipse cx={52} cy={60} rx={24} ry={21} fill={`url(#mHead-${k})`} stroke={line} strokeWidth={1.6} />
        <path d="M 70 58 Q 84 62 78 70 Q 70 72 66 68 Z" fill={`url(#mHead-${k})`} stroke={line} strokeWidth={1.4} />
        <ellipse cx={42} cy={50} rx={8} ry={4.5} fill="#ffffff" opacity={0.4} filter="url(#mGlint)" transform="rotate(-25 42 50)" />
        {/* glossy nose */}
        <circle cx={80} cy={66 + idle.nose} r={4.2} fill={`url(#mNose-${k})`} />
        <circle cx={78.8} cy={64.6 + idle.nose} r={1.3} fill="#ffffff" opacity={0.85} />
        {/* whiskers */}
        <g stroke="#4a4a52" strokeWidth={1.2} opacity={0.85}>
          <path d="M 76 68 L 96 64" />
          <path d="M 76 70 L 96 72" />
        </g>
        {/* eye: glossy, with a socket shadow */}
        {blink && !pose.surprise ? (
          <path d="M 56 56 Q 61 59 66 56" stroke="#1a1a1e" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        ) : (
          <g>
            <circle cx={61} cy={56} r={eyeR + 2.6} fill="#000" opacity={0.18} filter="url(#mGlint)" />
            {pose.surprise > 0.05 && <circle cx={61} cy={55} r={eyeR + 2.5} fill="#ffffff" />}
            <circle cx={61 + pupil} cy={55 + pupilY} r={eyeR} fill="#141418" />
            <circle cx={62.5 + pupil} cy={53.3 + pupilY} r={1.6} fill="#ffffff" />
            <circle cx={59.6 + pupil} cy={57 + pupilY} r={0.7} fill="#ffffff" opacity={0.7} />
          </g>
        )}
        {/* "O" mouth when surprised */}
        {pose.surprise > 0.05 && <ellipse cx={70} cy={74} rx={2.5 * pose.surprise} ry={3.5 * pose.surprise} fill="#5a1a22" />}
      </g>
      {pose.stick && <CrookStick stick={pose.stick} />}
      {arm(4)}
    </svg>
  );
};

/**
 * The pinner: abseils down a rope to above the banner's centre, pushes a red pin
 * into the wall, ties a thread from the pin to the banner, and climbs back up.
 * Then the pin + thread stay until CREW_SCHEDULE.pinPopAt, when the pin pops out.
 */
export const PinnerAndPin: React.FC<{ crew: CrewState; bannerW: number }> = ({ crew, bannerW }) => {
  const cx = bannerW / 2;
  const PIN = { x: cx + 58, y: -112 };
  const knot = { x: cx, y: 6 };
  const out: React.ReactNode[] = [];

  if (crew.pinner) {
    const s = crew.pinner.s;
    // descend, work, climb away (top of the mouse box, relative to the banner top)
    // right paw: pushes the pin in (1.0–1.4 s), then slides down the rope to tie the thread on (1.45–2.5 s)
    const push = ramp(s, [1.0, 1.15, 1.3, 1.4], [0, 1, 1, 0]);
    const tie = ramp(s, [1.45, 1.7, 2.3, 2.5], [0, 1, 1, 0]);
    const y =
      s < 1.0
        ? interpolate(s, [0, 1.0], [-980, -236], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
        : s < 2.6
          ? -236 + 120 * tie + Math.sin((s - 1.0) * 6) * 3
          : interpolate(s, [2.6, CREW_SCHEDULE.pinner.duration], [-236, -980], { extrapolateLeft: "clamp", easing: Easing.in(Easing.cubic) });
    const sway = Math.sin(s * 2.4) * 4 * (s < 1.0 || s > 2.6 ? 1 : 0.3);
    // targets in the mouse's own coordinates (box left = cx - 50, box top = y)
    const rest = { x: 78, y: 100 };
    const pinLocal = { x: PIN.x - (cx - 50), y: PIN.y - y };
    const knotLocal = { x: knot.x - (cx - 50), y: knot.y - y };
    const mid = { x: rest.x + (pinLocal.x - rest.x) * push, y: rest.y + (pinLocal.y - rest.y) * push };
    const hand = { x: mid.x + (knotLocal.x - mid.x) * tie, y: mid.y + (knotLocal.y - mid.y) * tie };
    out.push(
      <div key="rope" style={{ position: "absolute", left: cx + sway - 1.5, top: -1400, width: 3, height: 1400 + y + 30, background: "linear-gradient(90deg,#6b5233,#c9a46a,#6b5233)" }} />,
      <div key="pinner" style={{ position: "absolute", left: cx - 50 + sway, top: y, width: MOUSE_W, height: MOUSE_H }}>
        <Mouse pose={{ dx: 0, dy: 0, hand, surprise: 0, lean: 0 }} tint="#b8a48e" />
        {/* the other paw holds the rope above its head */}
        <svg viewBox="0 0 100 150" width={MOUSE_W} height={MOUSE_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d="M 46 78 Q 44 50 50 20" stroke="#5d5d66" strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d="M 46 78 Q 44 50 50 20" stroke="#b8a48e" strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={50} cy={20} r={6} fill="#f4b3bd" stroke="#5d5d66" strokeWidth={2} />
          {/* thread spool under the arm until it is used */}
          {s < 1.5 && (
            <g>
              <rect x={20} y={100} width={16} height={20} rx={3} fill="#e8d6b0" stroke="#6b5233" strokeWidth={2} />
              <rect x={22} y={104} width={12} height={12} fill="#d23a3a" />
            </g>
          )}
        </svg>
      </div>,
    );
  }

  if (crew.pin) {
    const { since, popped } = crew.pin;
    // pin: pushed in with a squash, or flying out after the pop
    const inScale = ramp(since, [0, 0.12, 0.22], [0, 1.25, 1]);
    let px = PIN.x;
    let py = PIN.y;
    let rotDeg = -20;
    let pinO = 1;
    if (popped !== null) {
      px += 260 * popped;
      py += -500 * popped + 0.5 * 3400 * popped * popped;
      rotDeg += 540 * popped;
      pinO = 1 - ramp(popped, [0.7, 1.1], [0, 1]);
    }
    // thread: drawn out from the pin to the banner while being tied, slack + falling after the pop
    const tieP = ramp(since, [0.25, 1.05], [0, 1]);
    const end = { x: PIN.x + (knot.x - PIN.x) * tieP, y: PIN.y + 10 + (knot.y - PIN.y - 10) * tieP };
    const threadO = popped === null ? 1 : 1 - ramp(popped, [0.05, 0.4], [0, 1]);
    const sag = popped === null ? 0 : 60 * ramp(popped, [0, 0.3], [0, 1]);
    out.push(
      <svg key="pin" width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        {threadO > 0 && (
          <path
            d={`M ${popped === null ? PIN.x : px} ${(popped === null ? PIN.y : py) + 10} Q ${(PIN.x + end.x) / 2} ${(PIN.y + end.y) / 2 + 20 + sag} ${end.x} ${end.y}`}
            stroke="#e9e1cf"
            strokeWidth={3}
            fill="none"
            opacity={threadO}
          />
        )}
        {pinO > 0 && (
          <g transform={`translate(${px} ${py}) rotate(${rotDeg}) scale(${popped === null ? inScale : 1})`} opacity={pinO}>
            <line x1={0} y1={0} x2={0} y2={22} stroke="#b9bec4" strokeWidth={3} strokeLinecap="round" />
            <ellipse cx={0} cy={-2} rx={10} ry={4} fill="#9c1c1c" />
            <circle cx={0} cy={-10} r={11} fill="#d6282b" />
            <circle cx={-4} cy={-14} r={3.5} fill="#ff9a9a" />
          </g>
        )}
      </svg>,
    );
  }
  return <>{out}</>;
};
