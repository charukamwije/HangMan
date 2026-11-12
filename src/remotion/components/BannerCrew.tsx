import React from "react";
import { Easing, interpolate } from "remotion";
import { ramp } from "../motion";

/**
 * The banner crew: two mice hold the hook banner's top corners; now and then
 * one loses its grip, that end swings down, and the mouse leaps down, catches
 * the corner and hauls it back up. A third mouse abseils in, pins a thread to
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
const DROP_SECONDS = 1.5;

export const MOUSE_W = 100;
const MOUSE_H = 150;
/** Hand target that grips the banner's top corner, in (unmirrored) mouse coords. */
const HOLD = { x: 106, y: 32 };
/** Mouse box top, relative to the banner's top edge. */
const MOUSE_TOP = -26;

type Side = "left" | "right";

/** Banner tilt (deg) s seconds into a drop: slip, swing, settle, haul back up. */
const dropAngle = (s: number) =>
  interpolate(s, [0, 0.28, 0.4, 0.52, 0.65, DROP_SECONDS], [0, 15, 11.5, 13.5, 13, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

export type CrewState = {
  /** Rotation for the banner (deg) and its pivot (the corner still held). */
  angle: number;
  origin: string;
  left: MousePose;
  right: MousePose;
  pinner: { s: number } | null;
  /** Pin + thread: seconds since pinned (null = no pin), and seconds since it popped. */
  pin: { since: number; popped: number | null } | null;
};

export type MousePose = { dx: number; dy: number; hand: { x: number; y: number }; surprise: number; lean: number };

const REST: MousePose = { dx: 0, dy: 0, hand: HOLD, surprise: 0, lean: 0 };

/** Crew state at time t (seconds). `bannerW` = banner width in px (for the swing geometry). */
export function crewState(t: number, bannerW: number): CrewState {
  const drop = CREW_SCHEDULE.drops.find((d) => t >= d.at && t < d.at + DROP_SECONDS);
  const state: CrewState = { angle: 0, origin: "0% 0%", left: REST, right: REST, pinner: null, pin: null };

  if (drop) {
    const s = t - drop.at;
    const a = dropAngle(s);
    const rad = (a * Math.PI) / 180;
    const cornerDy = bannerW * Math.sin(rad); // how far the free corner has fallen
    const cornerDx = bannerW * (Math.cos(rad) - 1); // and how far it has swung inward
    // The mouse stays put while the corner slips away, then leaps down to it and rides it back up.
    const follow = s < 0.3 ? 0 : s < 0.62 ? Easing.out(Easing.cubic)(ramp(s, [0.3, 0.62], [0, 1])) : 1;
    const dy = cornerDy * follow;
    const dx = cornerDx * follow;
    // Hands: flail upward while slipping, then reach for (and keep) the corner.
    const reach = ramp(s, [0.3, 0.55], [0, 1]);
    const flail = { x: HOLD.x - 18 + 10 * Math.sin(s * 40), y: HOLD.y - 26 + 6 * Math.cos(s * 37) };
    const corner = { x: HOLD.x + (cornerDx - dx), y: HOLD.y + (cornerDy - dy) };
    const hand = s < 0.3 ? flail : { x: flail.x + (corner.x - flail.x) * reach, y: flail.y + (corner.y - flail.y) * reach };
    const freePose: MousePose = { dx, dy, hand, surprise: ramp(s, [0, 0.08, 0.6, 0.8], [0, 1, 1, 0]), lean: 0 };
    const bracePose: MousePose = { ...REST, lean: ramp(s, [0, 0.2, 1.2, DROP_SECONDS], [0, 1, 1, 0]) };
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
    <div style={{ position: "absolute", left: -MOUSE_W + crew.left.dx, top: MOUSE_TOP + crew.left.dy, width: MOUSE_W, height: MOUSE_H, transform: `rotate(${(-6 * crew.left.lean).toFixed(1)}deg)`, transformOrigin: "50% 90%" }}>
      <Mouse pose={crew.left} blink={blink} />
    </div>
    <div
      style={{
        position: "absolute",
        left: bannerW - crew.right.dx,
        top: MOUSE_TOP + crew.right.dy,
        width: MOUSE_W,
        height: MOUSE_H,
        transform: `scaleX(-1) rotate(${(-6 * crew.right.lean).toFixed(1)}deg)`,
        transformOrigin: "50% 90%",
      }}
    >
      <Mouse pose={crew.right} blink={blink} />
    </div>
  </>
);

/** Cartoon mouse facing right (viewBox 100 × 150). Hands reach `pose.hand`. */
const Mouse: React.FC<{ pose: MousePose; blink?: boolean; tint?: string }> = ({ pose, blink, tint = "#a3a3ad" }) => {
  const sh = { x: 54, y: 78 };
  const eyeR = 4 + 2.5 * pose.surprise;
  const arm = (off: number) => (
    <g>
      <path d={`M ${sh.x + off} ${sh.y} Q ${(sh.x + pose.hand.x) / 2 + 6} ${(sh.y + pose.hand.y) / 2 + 10} ${pose.hand.x} ${pose.hand.y + off}`} stroke="#5d5d66" strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d={`M ${sh.x + off} ${sh.y} Q ${(sh.x + pose.hand.x) / 2 + 6} ${(sh.y + pose.hand.y) / 2 + 10} ${pose.hand.x} ${pose.hand.y + off}`} stroke={tint} strokeWidth={5} fill="none" strokeLinecap="round" />
      <circle cx={pose.hand.x} cy={pose.hand.y + off} r={6} fill="#f4b3bd" stroke="#5d5d66" strokeWidth={2} />
    </g>
  );
  return (
    <svg viewBox="0 0 100 150" width={MOUSE_W} height={MOUSE_H} style={{ overflow: "visible", filter: "drop-shadow(0 8px 8px rgba(0,0,0,0.55))" }}>
      {/* tail */}
      <path d="M 30 128 C 6 132 4 108 16 100 C 26 94 22 84 12 82" stroke="#d99aa6" strokeWidth={4} fill="none" strokeLinecap="round" />
      {arm(-4)}
      {/* body */}
      <ellipse cx={46} cy={108} rx={26} ry={32} fill={tint} stroke="#5d5d66" strokeWidth={2.5} />
      <ellipse cx={50} cy={114} rx={15} ry={20} fill="#e6e1e6" />
      {/* feet */}
      <ellipse cx={36} cy={140} rx={11} ry={5} fill="#f4b3bd" stroke="#5d5d66" strokeWidth={2} />
      <ellipse cx={58} cy={140} rx={11} ry={5} fill="#f4b3bd" stroke="#5d5d66" strokeWidth={2} />
      {/* ears */}
      <circle cx={30} cy={40} r={15} fill={tint} stroke="#5d5d66" strokeWidth={2.5} />
      <circle cx={30} cy={40} r={9} fill="#f4b3bd" />
      <circle cx={66} cy={36} r={15} fill={tint} stroke="#5d5d66" strokeWidth={2.5} />
      <circle cx={66} cy={36} r={9} fill="#f4b3bd" />
      {/* head (looks toward the banner) */}
      <ellipse cx={52} cy={60} rx={24} ry={21} fill={tint} stroke="#5d5d66" strokeWidth={2.5} />
      <path d="M 70 58 Q 84 62 78 70 Q 70 72 66 68 Z" fill={tint} stroke="#5d5d66" strokeWidth={2} />
      <circle cx={80} cy={66} r={4} fill="#e2708a" />
      {/* whiskers */}
      <g stroke="#4a4a52" strokeWidth={1.4}>
        <path d="M 76 68 L 96 64" />
        <path d="M 76 70 L 96 72" />
      </g>
      {/* eye */}
      {blink && !pose.surprise ? (
        <path d="M 56 56 Q 61 59 66 56" stroke="#1a1a1e" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      ) : (
        <g>
          {pose.surprise > 0.05 && <circle cx={61} cy={55} r={eyeR + 2.5} fill="#ffffff" />}
          <circle cx={61} cy={55} r={eyeR} fill="#1a1a1e" />
          <circle cx={62.5} cy={53.5} r={1.4} fill="#ffffff" />
        </g>
      )}
      {/* "O" mouth when surprised */}
      {pose.surprise > 0.05 && <ellipse cx={70} cy={74} rx={2.5 * pose.surprise} ry={3.5 * pose.surprise} fill="#5a1a22" />}
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
