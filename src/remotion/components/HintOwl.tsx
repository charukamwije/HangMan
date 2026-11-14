import React, { useMemo } from "react";
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ramp } from "../motion";

/**
 * Tawny owl perched on the hint card's top-right corner with a wooden water
 * bucket. On every wrong guess it hurls the water at the hint text:
 *
 *   0.00–0.14 s  wind-up: head turns to the hint, bucket swings back
 *   0.14–0.30 s  throw: bucket swings forward and tips
 *   0.22–0.34 s  water leaves the moving rim as a continuous, ballistic stream
 *   ≈0.38 s      first impact = THROW_HIT_SECONDS: hint distorts + blurs, splash crown, spray
 *   0.4–1.0 s    the crown collapses, spray rains down and the sheen fades;
 *                owl squints (laughs)
 *
 * The stream is a particle simulation: each parcel of water has its own launch
 * time from the moving bucket rim, a velocity solved to land on the text, and
 * gravity — drawn as a tapered, layered ribbon so it bends and thins like a real
 * pour. Idle: blinks every 3 s, breathes on a 1.5 s cycle (both loop-safe).
 */
export const THROW_HIT_SECONDS = 0.38;

/** Owl box (px), anchored to the card's top-right corner. */
const BOX = { w: 300, h: 270 };
/** Where the owl's feet grip the card's top edge, inside BOX. */
const SEAT_Y = 238;
/** How far the owl rises above the card's top edge (Header reserves this headroom). */
export const OWL_ABOVE = SEAT_Y;
/** Bucket handle pivot, inside BOX. */
const PIVOT = { x: 266, y: 156 }; // on the owl's right (viewer's right); the throw swings it across in front of the owl
/** The owl is drawn symmetric about this x; the holding wing is mirrored across it to reach the right-hand bucket. */
const OWL_MID_X = 170;

const G = 3200; // px/s² on the 4K stage
const EMIT = [0.22, 0.34] as const;
const FLIGHT = 0.16; // seconds from rim to text
const PARCELS = 30;

const deg = (d: number) => (d * Math.PI) / 180;
const rot = (x: number, y: number, a: number) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

/** Bucket swing angle (deg, clockwise) s seconds into a throw. */
const bucketAngle = (s: number) =>
  interpolate(s, [0, 0.14, 0.3, 0.5, 0.95], [0, -34, 132, 132, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

/**
 * Refill (seconds into a throw, after the bucket has swung back to rest at 0.95 s):
 * the wall tap's lever opens, a stream pours into the bucket and fills it, the lever closes.
 */
const REFILL = { open: [0.95, 1.05], pour: [1.02, 1.55], fill: [1.08, 1.58], close: [1.55, 1.65] } as const;
/** Tap spout outlet in BOX coordinates: high enough that the swinging bucket clears the tap. */
const SPOUT = { x: PIVOT.x + 10, y: 50 };
/** Where the pour meets the water surface (BOX coordinates, bucket at rest). */
const surfaceY = (fill: number) => PIVOT.y + 34 + 10 * (1 - fill);

type Parcel ={ te: number; T: number; m: { x: number; y: number }; v: { x: number; y: number }; hit: { x: number; y: number } };

export const HintOwl: React.FC<{
  throwFrames: readonly number[];
  cardW: number;
  cardH: number;
}> = ({ throwFrames, cardW, cardH }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const last = throwFrames.reduce((acc, f) => (f <= frame && f > acc ? f : acc), -Infinity);
  const s = Number.isFinite(last) ? (frame - last) / fps : Infinity;
  const active = s < 1.7;
  const throwSeed = Number.isFinite(last) ? last : 0;

  const angle = active ? bucketAngle(s) : 0;
  const look = active ? ramp(s, [0, 0.1, 0.7, 1.0], [0, 1, 1, 0]) : 0;
  const laugh = active ? ramp(s, [0.45, 0.55, 0.95, 1.1], [0, 1, 1, 0]) : 0;
  const breathe = Math.sin((t / 1.5) * Math.PI * 2);
  const bob = breathe * 3 + (active ? laugh * Math.abs(Math.sin(s * 28)) * -5 : 0);
  const blink = !active ? ramp(t % 3, [0, 0.05, 0.1], [0, 1, 0]) : 0;
  // Idle life between throws, eased out around each throw so the throw itself is untouched.
  const idleAmt = Number.isFinite(s) ? Math.min(ramp(s, [1.7, 2.2], [0, 1]), 1) : 1;
  const nextThrow = throwFrames.find((f) => f > frame);
  const idle = idleLife(t, idleAmt * (nextThrow !== undefined ? ramp((nextThrow - frame) / fps, [0, 0.35], [0, 1]) : 1));

  const boxLeft = cardW - BOX.w + 16;
  const boxTop = -SEAT_Y;
  const target = { x: cardW * 0.44, y: cardH * 0.5 };

  const parcels: Parcel[] = useMemo(() => {
    /** Bucket rim centre in card coordinates at throw time `time`. */
    const rim = (time: number) => {
      const r = rot(-4, 32, deg(bucketAngle(time)));
      return { x: boxLeft + PIVOT.x + r.x, y: boxTop + PIVOT.y + r.y };
    };
    return Array.from({ length: PARCELS }, (_, i) => {
      const te = EMIT[0] + ((EMIT[1] - EMIT[0]) * i) / (PARCELS - 1);
      const m = rim(te);
      // later parcels land further along the text: the pour sweeps across the hint
      // smooth sweep (no per-parcel jitter, so the ribbon stays a clean, continuous pour)
      const tx = target.x - 260 + 520 * (i / (PARCELS - 1));
      const ty = target.y + 18 * Math.sin((i / (PARCELS - 1)) * Math.PI);
      const T = FLIGHT;
      return { te, T, m, v: { x: (tx - m.x) / T, y: (ty - m.y - 0.5 * G * T * T) / T }, hit: { x: tx, y: ty } };
    });
  }, [boxLeft, boxTop, target.x, target.y]);

  const live = active
    ? parcels.flatMap((p, i) => {
        const a = s - p.te;
        if (a < 0 || a > p.T) return [];
        const env = Math.sin(Math.PI * (i / (PARCELS - 1))); // thin at both ends of the pour
        return [{ i, x: p.m.x + p.v.x * a, y: p.m.y + p.v.y * a + 0.5 * G * a * a, w: 14 + 46 * env * (1 - 0.4 * (a / p.T)) }];
      })
    : [];

  const splashT = active ? s - (EMIT[0] + FLIGHT - 0.015) : -1;

  // Bucket level: empties during the throw, then refills from the tap once it is back at rest.
  const fill = !active ? 1 : s < REFILL.open[0] ? 1 - ramp(s, [0.2, 0.34], [0, 1]) : ramp(s, [...REFILL.fill], [0, 1]);
  const tapOpen = active ? Math.min(ramp(s, [...REFILL.open], [0, 1]), 1 - ramp(s, [...REFILL.close], [0, 1])) : 0;
  // Pour: the head falls from the spout when the tap opens, the tail follows once it closes.
  const fallY = (dt: number) => (dt <= 0 ? 0 : 420 * dt + 2400 * dt * dt);
  const pourEnd = Math.min(surfaceY(fill) + bob, PIVOT.y + 36 + bob); // never past the bucket's front lip
  const pourHead = active ? Math.min(SPOUT.y + fallY(s - REFILL.pour[0]), pourEnd) : SPOUT.y;
  const pourTail = active ? SPOUT.y + fallY(s - REFILL.pour[1]) : SPOUT.y;
  const pouring = active && s >= REFILL.pour[0] && pourTail < pourEnd;
  const splashing = pouring && pourHead >= pourEnd - 0.5;

  return (
    <>
      <svg width={cardW} height={cardH} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        <defs>
          <radialGradient id="owlWetSheen" cx="0.44" cy="0.5" r="0.6">
            <stop offset="0" stopColor="#bfe3ff" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#7fb8e8" stopOpacity="0.18" />
            <stop offset="1" stopColor="#7fb8e8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="owlGlint" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="owlDrip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cfe9ff" stopOpacity="0" />
            <stop offset="1" stopColor="#cfe9ff" stopOpacity="0.75" />
          </linearGradient>
          <WaterDefs />
        </defs>
        {splashT >= 0 && <SplashLayer t={splashT} target={target} cardW={cardW} cardH={cardH} seed={throwSeed} />}
        {live.length > 1 && <Stream pts={live} s={s} />}
      </svg>

      {/* wall tap above the bucket (fixed to the wall: it doesn't bob with the owl) */}
      <div style={{ position: "absolute", left: boxLeft, top: boxTop, width: BOX.w, height: BOX.h, pointerEvents: "none" }}>
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} width={BOX.w} height={BOX.h} style={{ overflow: "visible", filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.55))" }}>
          <Tap open={tapOpen} />
        </svg>
      </div>

      {/* the owl + bucket on the card's top-right corner */}
      <div style={{ position: "absolute", left: boxLeft, top: boxTop + bob, width: BOX.w, height: BOX.h, pointerEvents: "none" }}>
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} width={BOX.w} height={BOX.h} style={{ overflow: "visible", filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.6))" }}>
          <OwlDefs />
          <g transform={`rotate(${idle.sway.toFixed(2)} 170 240)`}>
            <Owl look={look} blink={Math.max(blink, 0.55 * laugh, idle.squint)} laugh={laugh} breathe={breathe} idle={idle} />
          </g>
          <g transform={`translate(${PIVOT.x} ${PIVOT.y}) rotate(${angle.toFixed(1)})`}>
            <Bucket fill={fill} />
          </g>
          <HoldingWing />
        </svg>
      </div>

      {/* the refill pour, on top so it reaches the water surface inside the bucket's mouth */}
      {pouring && (
        <svg width={BOX.w} height={BOX.h} viewBox={`0 0 ${BOX.w} ${BOX.h}`} style={{ position: "absolute", left: boxLeft, top: boxTop, overflow: "visible", pointerEvents: "none" }}>
          <TapPour top={Math.max(SPOUT.y, pourTail)} bottom={pourHead} t={s} splash={splashing} />
        </svg>
      )}
    </>
  );
};

/* ---------------------------------------------------------------- water */
/*
 * Look: clear, glassy water. Every water body (stream, crown sheet, fingers, drops)
 * is a pale-blue translucent volume with a darker refracting blue edge, a white
 * specular rim and faint inner caustic ripples, so it reads as liquid against the dark card.
 */

type Pt = { x: number; y: number };
const f1 = (n: number) => n.toFixed(1);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const easeOut3 = (x: number) => 1 - (1 - clamp01(x)) ** 3;

/** Catmull-Rom spline through `p` as cubic Bézier segments; `move` starts a new subpath. */
function curve(p: Pt[], move = true) {
  if (!p.length) return "";
  let d = move ? `M ${f1(p[0].x)} ${f1(p[0].y)}` : `L ${f1(p[0].x)} ${f1(p[0].y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    d += ` C ${f1(p1.x + (p2.x - p0.x) / 6)} ${f1(p1.y + (p2.y - p0.y) / 6)} ${f1(p2.x - (p3.x - p1.x) / 6)} ${f1(p2.y - (p3.y - p1.y) / 6)} ${f1(p2.x)} ${f1(p2.y)}`;
  }
  return d;
}

/** Closed tapered tube around a centreline: half-width `w[i]` at each point. */
function tube(c: Pt[], w: number[]) {
  const side = (sign: 1 | -1) =>
    c.map((p, i) => {
      const a = c[Math.max(0, i - 1)];
      const b = c[Math.min(c.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: p.x + (sign * -(b.y - a.y) * w[i]) / len, y: p.y + (sign * (b.x - a.x) * w[i]) / len };
    });
  return `${curve(side(1))} ${curve(side(-1).reverse(), false)} Z`;
}

/** Gradients shared by every water shape (one owl per reel, so fixed ids are safe). */
const WaterDefs: React.FC = () => (
  <>
    {/* glass sphere: bright off-centre core, saturated body, dark refracting rim */}
    <radialGradient id="owlDropFill" cx="0.5" cy="0.5" r="0.5" fx="0.38" fy="0.32">
      <stop offset="0" stopColor="#f2fbff" stopOpacity="0.95" />
      <stop offset="0.45" stopColor="#a6d6f5" stopOpacity="0.82" />
      <stop offset="0.85" stopColor="#4a92cf" stopOpacity="0.88" />
      <stop offset="1" stopColor="#1f5f9e" stopOpacity="0.95" />
    </radialGradient>
    {/* crown sheet: lighter, thinner water up top, denser blue at the base */}
    <linearGradient id="owlSheetFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#d9f0ff" stopOpacity="0.62" />
      <stop offset="0.5" stopColor="#9fd0f2" stopOpacity="0.5" />
      <stop offset="1" stopColor="#5c9fd6" stopOpacity="0.7" />
    </linearGradient>
    {/* cylinder shading for the stream and fingers: dark edges, bright core */}
    <linearGradient id="owlTubeFill" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#3f86c6" stopOpacity="0.9" />
      <stop offset="0.45" stopColor="#d6efff" stopOpacity="0.8" />
      <stop offset="1" stopColor="#3f86c6" stopOpacity="0.9" />
    </linearGradient>
  </>
);

const EDGE = "rgba(32,96,160,0.85)";

/**
 * A water drop: glass-sphere fill, dark refracting rim, white specular top-left and
 * a faint caustic bottom-right. Moving drops stretch along their velocity (vx, vy).
 */
const Drop: React.FC<{ x: number; y: number; r: number; o?: number; vx?: number; vy?: number }> = ({ x, y, r, o = 1, vx = 0, vy = 0 }) => {
  const speed = Math.hypot(vx, vy);
  const stretch = 1 + Math.min(0.9, speed / 1800);
  const ang = speed > 1 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0;
  return (
    <g opacity={o}>
      <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${stretch.toFixed(3)} ${(1 / Math.sqrt(stretch)).toFixed(3)})`}>
        <circle r={r} fill="url(#owlDropFill)" stroke={EDGE} strokeWidth={Math.max(0.8, r * 0.1)} />
      </g>
      {/* highlights stay screen-aligned (lit from the top-left lamp) */}
      <ellipse cx={x - r * 0.32} cy={y - r * 0.36} rx={r * 0.3} ry={r * 0.2} fill="#ffffff" opacity={0.95} transform={`rotate(-30 ${f1(x - r * 0.32)} ${f1(y - r * 0.36)})`} />
      {r > 5 && <circle cx={x + r * 0.36} cy={y + r * 0.4} r={r * 0.14} fill="#ffffff" opacity={0.45} />}
    </g>
  );
};

/**
 * The pour in flight: a thick, translucent tube through the live parcels whose edges
 * wobble like real moving water, with a bright core, a white specular streak, a bulbous
 * leading head and drops peeling off its edges.
 */
const Stream: React.FC<{ pts: { i: number; x: number; y: number; w: number }[]; s: number }> = ({ pts, s }) => {
  const c = pts.map((p) => ({ x: p.x, y: p.y }));
  const wob = pts.map((p) => p.w * 0.5 * (1 + 0.22 * Math.sin(p.i * 1.9 + s * 55)));
  const head = pts[pts.length - 1];
  return (
    <g>
      <path d={tube(c, wob)} fill="url(#owlTubeFill)" stroke={EDGE} strokeWidth={3} strokeLinejoin="round" />
      <path d={tube(c, wob.map((w) => w * 0.45))} fill="rgba(225,244,255,0.45)" />
      <path d={curve(c.map((p, k) => ({ x: p.x, y: p.y - wob[k] * 0.45 })))} stroke="rgba(255,255,255,0.9)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Drop x={head.x} y={head.y} r={head.w * 0.62} />
      {pts
        .filter((p) => p.i % 3 === 1)
        .map((p) => (
          <Drop
            key={`bd-${p.i}`}
            x={p.x + (random(`bd-x-${p.i}`) - 0.5) * 90}
            y={p.y + (random(`bd-y-${p.i}`) - 0.3) * 60}
            r={3 + 8 * random(`bd-r-${p.i}`)}
          />
        ))}
    </g>
  );
};

/* ------------------------------------------------------------ crown splash */

/** Crown size on the 4K stage; it rises from the lower half of the hint text. */
const CROWN = { w: 780, h: 280, n: 40 };
/**
 * Rim height profile across the crown (u 0 → 1, height 0 → 1), shaped after a
 * classic side-swept crown splash: a lobe on the left, a low bowl, a tall crest
 * right of centre, then a shoulder and a spur on the right.
 */
const PROFILE: [number, number][] = [
  [0, 0.04], [0.05, 0.5], [0.11, 0.72], [0.18, 0.46], [0.3, 0.2], [0.42, 0.26], [0.52, 0.55],
  [0.6, 0.9], [0.68, 1], [0.76, 0.78], [0.84, 0.58], [0.92, 0.68], [0.97, 0.3], [1, 0.04],
];
const profileAt = (u: number) => {
  for (let k = 1; k < PROFILE.length; k++) {
    const [u1, h1] = PROFILE[k];
    if (u <= u1) {
      const [u0, h0] = PROFILE[k - 1];
      return h0 + ((h1 - h0) * (u - u0)) / (u1 - u0);
    }
  }
  return 0;
};
/** Fingers jetting off the rim: position, length (px) and outward lean (deg). */
const FINGERS = [
  { u: 0.04, len: 95, lean: -52 },
  { u: 0.11, len: 160, lean: -26 },
  { u: 0.5, len: 85, lean: -12 },
  { u: 0.62, len: 200, lean: -6 },
  { u: 0.7, len: 150, lean: 16 },
  { u: 0.84, len: 110, lean: 32 },
  { u: 0.93, len: 175, lean: 50 },
];
/** Impact timing (seconds after first contact). */
const CROWN_T = { rise: 0.13, sweep: 0.09, collapse: [0.3, 0.58], fade: [0.42, 0.62] } as const;

/**
 * Impact: the poured water bursts into a translucent crown sheet across the hint text.
 * The rim rises left → right with the pour's sweep, fingers jet off it and pinch off
 * into drops, a spray of glass drops (big near the sheet, fine mist at the sides) flies
 * out ballistically, then the sheet collapses under gravity and fades.
 */
const CrownSplash: React.FC<{ t: number; target: Pt; seed: number }> = ({ t, target, seed }) => {
  const R = (k: string) => random(`${seed}-crown-${k}`);
  const x0 = target.x + 20 - CROWN.w / 2;
  const y0 = target.y + 44;
  const collapse = ramp(t, [...CROWN_T.collapse], [0, 1]);
  const sheetO = 1 - ramp(t, [...CROWN_T.fade], [0, 1]);

  /** Rim point i at time `time` (heights grow with the left → right sweep, then fall). */
  const rimAt = (i: number, time: number) => {
    const u = i / (CROWN.n - 1);
    const g = easeOut3((time - CROWN_T.sweep * u) / CROWN_T.rise);
    const fall = ramp(time, [...CROWN_T.collapse], [0, 1]);
    const noise = 1 + 0.18 * (R(`n${i}`) - 0.5) + 0.05 * Math.sin(time * 38 + i * 1.3);
    const h = CROWN.h * profileAt(u) * noise * g * (1 - fall * fall);
    const base = y0 + 22 * Math.sin(Math.PI * u);
    return { x: x0 + CROWN.w * u + (R(`x${i}`) - 0.5) * 8, y: base - h, base, h, u, g };
  };
  const rim = Array.from({ length: CROWN.n }, (_, i) => rimAt(i, t));

  /** Finger centreline at time `time` (bends outward toward its tip). */
  const fingerLine = (f: (typeof FINGERS)[number], k: number, time: number, shrink: number) => {
    const p = rimAt(Math.round(f.u * (CROWN.n - 1)), time);
    const L = f.len * (0.85 + 0.3 * R(`fl${k}`)) * p.g * (1 - ramp(time, [...CROWN_T.collapse], [0, 1])) * (1 - shrink);
    const a0 = deg(f.lean);
    const a1 = deg(f.lean * 1.7);
    const P1 = { x: p.x + Math.sin(a0) * L * 0.55, y: p.y - Math.cos(a0) * L * 0.55 };
    const P2 = { x: p.x + Math.sin(a1) * L, y: p.y - Math.cos(a1) * L };
    return Array.from({ length: 7 }, (_, j) => {
      const v = j / 6;
      return { x: (1 - v) ** 2 * p.x + 2 * (1 - v) * v * P1.x + v * v * P2.x, y: (1 - v) ** 2 * p.y + 2 * (1 - v) * v * P1.y + v * v * P2.y };
    });
  };

  const fingers = FINGERS.map((f, k) => {
    const detachAt = 0.17 + 0.09 * R(`fd${k}`);
    const shrink = ramp(t, [detachAt, detachAt + 0.14], [0, 0.65]);
    const line = fingerLine(f, k, t, shrink);
    const len = Math.hypot(line[6].x - line[0].x, line[6].y - line[0].y);
    const r = 7 + 6 * R(`fr${k}`);
    // tip bulb: rides the tip, then pinches off and flies on ballistically
    let bulb: { x: number; y: number; vx: number; vy: number } | null = null;
    if (t < detachAt) {
      if (len > 12) bulb = { x: line[6].x, y: line[6].y, vx: 0, vy: 0 };
    } else {
      const tip = fingerLine(f, k, detachAt, 0)[6];
      const a = deg(f.lean * 1.7);
      const sp = 520 + 320 * R(`fv${k}`);
      const dt = t - detachAt;
      const vx = Math.sin(a) * sp;
      const vy = -Math.cos(a) * sp + G * dt;
      if (dt < 0.7) bulb = { x: tip.x + Math.sin(a) * sp * dt, y: tip.y - Math.cos(a) * sp * dt + 0.5 * G * dt * dt, vx, vy };
    }
    return { line, len, r, bulb, o: 1 - ramp(t, [detachAt + 0.5, detachAt + 0.7], [0, 1]) };
  });

  // spray: drops thrown off the rim; ~70 % fine mist, the rest big glassy drops
  const spray = Array.from({ length: 48 }, (_, k) => {
    const t0 = 0.03 + 0.2 * R(`st${k}`);
    const dt = t - t0;
    if (dt < 0 || dt > 0.75) return null;
    const u = R(`su${k}`);
    const src = rimAt(Math.round(u * (CROWN.n - 1)), t0);
    const ang = deg(-90 + (u - 0.5) * 120 + (R(`sa${k}`) - 0.5) * 70);
    const sp = 380 + 820 * R(`sv${k}`);
    const big = R(`sb${k}`) > 0.7;
    const r = big ? 8 + 7 * R(`sr${k}`) : 2.5 + 4 * R(`sr${k}`);
    const vx = Math.cos(ang) * sp;
    const vy0 = Math.sin(ang) * sp;
    return (
      <Drop
        key={`sp${k}`}
        x={src.x + vx * dt}
        y={src.y + vy0 * dt + 0.5 * G * dt * dt}
        r={r}
        vx={vx}
        vy={vy0 + G * dt}
        o={1 - ramp(dt, [0.5, 0.75], [0, 1])}
      />
    );
  });

  const sheet =
    `M ${f1(rim[0].x)} ${f1(rim[0].base)} ${curve(rim, false)} ` +
    `L ${f1(rim[CROWN.n - 1].x)} ${f1(rim[CROWN.n - 1].base)} ` +
    curve(rim.filter((_, i) => i % 4 === 0 || i === CROWN.n - 1).reverse().map((p) => ({ x: p.x, y: p.base + 6 })), false) +
    " Z";

  return (
    <g>
      {sheetO > 0.01 && (
        <g opacity={sheetO}>
          <defs>
            <clipPath id="owlSheetClip">
              <path d={sheet} />
            </clipPath>
          </defs>
          {/* translucent body with a dark refracting edge */}
          <path d={sheet} fill="url(#owlSheetFill)" stroke={EDGE} strokeWidth={4} strokeLinejoin="round" />
          {/* inner caustic ripples following the crown's shape */}
          <g clipPath="url(#owlSheetClip)" fill="none" strokeLinecap="round">
            {[0.22, 0.42, 0.62, 0.8].map((frac, k) => (
              <path
                key={k}
                d={curve(rim.filter((_, i) => i % 3 === 0).map((p) => ({ x: p.x, y: p.base - p.h * frac + 8 * Math.sin(p.u * 14 + frac * 9 + t * 20) })))}
                stroke={k % 2 ? "rgba(40,110,175,0.28)" : "rgba(255,255,255,0.4)"}
                strokeWidth={k % 2 ? 5 : 3}
              />
            ))}
          </g>
          {/* specular highlight just inside the rim */}
          <path d={curve(rim.map((p) => ({ x: p.x, y: p.y + 8 })))} stroke="rgba(255,255,255,0.75)" strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      )}
      {fingers.map((f, k) => (
        <g key={`f${k}`} opacity={f.o}>
          {f.len > 6 && (
            <path d={tube(f.line, f.line.map((_, j) => (9 - 6 * (j / 6)) * Math.min(1, f.len / 40)))} fill="url(#owlTubeFill)" stroke={EDGE} strokeWidth={2.5} strokeLinejoin="round" />
          )}
          {f.bulb && <Drop x={f.bulb.x} y={f.bulb.y} r={f.r} vx={f.bulb.vx} vy={f.bulb.vy} />}
        </g>
      ))}
      {spray}
    </g>
  );
};

/** Impact: wet sheen on the card, then the crown splash. */
const SplashLayer: React.FC<{ t: number; target: Pt; cardW: number; cardH: number; seed: number }> = ({ t, target, cardW, cardH, seed }) => {
  const sheen = ramp(t, [0, 0.06, 1.3], [0, 1, 0]);
  return (
    <g>
      <rect x={0} y={0} width={cardW} height={cardH} rx={44} fill="url(#owlWetSheen)" opacity={sheen} />
      {t < 1 && <CrownSplash t={t} target={target} seed={seed} />}
    </g>
  );
};

/* ---------------------------------------------------------------- owl art */

const OwlDefs: React.FC = () => (
  <defs>
    <radialGradient id="owlBody" cx="0.45" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#a8784a" />
      <stop offset="0.55" stopColor="#6e4a2a" />
      <stop offset="1" stopColor="#36230f" />
    </radialGradient>
    <radialGradient id="owlChest" cx="0.5" cy="0.25" r="0.85">
      <stop offset="0" stopColor="#efdcb6" />
      <stop offset="0.7" stopColor="#c8a571" />
      <stop offset="1" stopColor="#8c6a3f" />
    </radialGradient>
    <radialGradient id="owlHead" cx="0.45" cy="0.3" r="0.75">
      <stop offset="0" stopColor="#a17447" />
      <stop offset="0.7" stopColor="#6a4626" />
      <stop offset="1" stopColor="#3a2511" />
    </radialGradient>
    <radialGradient id="owlDisc" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stopColor="#f1e2c3" />
      <stop offset="0.6" stopColor="#d4b07c" />
      <stop offset="1" stopColor="#9a7444" />
    </radialGradient>
    <radialGradient id="owlIris" cx="0.45" cy="0.4" r="0.6">
      <stop offset="0" stopColor="#ffe36a" />
      <stop offset="0.55" stopColor="#f5a417" />
      <stop offset="1" stopColor="#9a4a00" />
    </radialGradient>
    <linearGradient id="owlBeak" x1="0" x2="1">
      <stop offset="0" stopColor="#5d5852" />
      <stop offset="0.4" stopColor="#8e877e" />
      <stop offset="1" stopColor="#2a2724" />
    </linearGradient>
    <linearGradient id="owlWing" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#7d5532" />
      <stop offset="1" stopColor="#3b2611" />
    </linearGradient>
    <linearGradient id="bucketWood" x1="0" x2="1">
      <stop offset="0" stopColor="#3d2410" />
      <stop offset="0.25" stopColor="#7c4f25" />
      <stop offset="0.45" stopColor="#a8723a" />
      <stop offset="0.7" stopColor="#6e4220" />
      <stop offset="1" stopColor="#2e1a0a" />
    </linearGradient>
    <linearGradient id="bucketHoop" x1="0" x2="1">
      <stop offset="0" stopColor="#4c535b" />
      <stop offset="0.4" stopColor="#d4d9de" />
      <stop offset="0.6" stopColor="#9aa2aa" />
      <stop offset="1" stopColor="#3e444b" />
    </linearGradient>
    <linearGradient id="bucketWater" x1="0" x2="1">
      <stop offset="0" stopColor="#4f8fc4" />
      <stop offset="0.5" stopColor="#a9d6f7" />
      <stop offset="1" stopColor="#3f7bb0" />
    </linearGradient>
  </defs>
);

/** Deterministic feather marks (built once). */
const CHEST_STREAKS = Array.from({ length: 26 }, (_, k) => ({
  x: 140 + 60 * random(`cs-x-${k}`),
  y: 152 + 82 * random(`cs-y-${k}`),
  h: 8 + 10 * random(`cs-h-${k}`),
}));
const SCALLOPS = Array.from({ length: 30 }, (_, k) => ({
  x: 112 + 116 * random(`sc-x-${k}`),
  y: 128 + 100 * random(`sc-y-${k}`),
}));

type IdleLife = { faceX: number; headRot: number; pupilX: number; pupilY: number; browL: number; browR: number; squint: number; hoot: number; tuft: number; sway: number };

/**
 * Small, owl-like idle behaviour on a 7.5 s cycle (4 per 30 s, so it loops seamlessly):
 * snappy head turns (toward the hint, hold, toward the viewer, back), a curious head tilt with one
 * brow raised, darting pupils (saccades every 0.75 s), a suspicious squint, a little "hoot",
 * ear-tuft twitches and a slow weight shift. `amt` (0..1) fades it all in/out around throws.
 */
const idleLife = (t: number, amt: number): IdleLife => {
  const u = t % 7.5;
  // owls turn their heads in quick snaps and then hold
  const lookX = ramp(u, [0, 1.2, 1.38, 2.8, 2.98, 4.6, 4.78, 6.4, 6.58, 7.5], [0, 0, -1, -1, 0, 0, 1, 1, 0, 0]);
  const tilt = ramp(u, [3.15, 3.4, 4.15, 4.4], [0, 1, 1, 0]);
  const k = Math.floor(t / 0.75) % 40;
  const sacX = (random(`owl-sx-${k}`) - 0.5) * 5;
  const sacY = (random(`owl-sy-${k}`) - 0.5) * 3;
  const interested = ramp(u, [1.38, 1.6, 2.6, 2.8], [0, 1, 1, 0]);
  const tuftTwitch = Math.max(ramp(u, [0.5, 0.58, 0.7], [0, 1, 0]), ramp(u, [5.4, 5.48, 5.6, 5.68, 5.8], [0, 1, 0, 1, 0]));
  return {
    faceX: 7 * lookX * amt,
    headRot: (-3 * lookX + 11 * tilt) * amt,
    pupilX: (4 * lookX + sacX) * amt,
    pupilY: sacY * amt,
    browL: (-5 * interested) * amt,
    browR: (-5 * interested - 7 * tilt) * amt,
    squint: 0.38 * ramp(u, [5.0, 5.25, 5.9, 6.1], [0, 1, 1, 0]) * amt,
    hoot: ramp(u, [2.05, 2.15, 2.35, 2.45], [0, 1, 1, 0]) * amt,
    tuft: 7 * tuftTwitch * amt,
    sway: 1.6 * Math.sin((t / 5) * Math.PI * 2) * amt,
  };
};

const Owl: React.FC<{ look: number; blink: number; laugh: number; breathe: number; idle: IdleLife }> = ({ look, blink, laugh, breathe, idle }) => {
  const headTurn = -9 * look + idle.headRot;
  const pdx = -5 * look + idle.pupilX;
  const pdy = 4 * look + idle.pupilY;
  const beakOpen = Math.max(laugh, 0.6 * idle.hoot);
  const chestScale = 1 + 0.015 * breathe;
  const eye = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy={104} r={22} fill="#1d1208" />
      <circle cx={cx} cy={104} r={18.5} fill="url(#owlIris)" />
      <circle cx={cx + pdx} cy={105 + pdy} r={9.5} fill="#050403" />
      <circle cx={cx + pdx - 5} cy={99 + pdy} r={3.6} fill="#ffffff" opacity={0.95} />
      <circle cx={cx + pdx + 4} cy={109 + pdy} r={1.6} fill="#ffffff" opacity={0.6} />
      <path d={`M ${cx - 20} 98 Q ${cx} 84 ${cx + 20} 98`} stroke="#2a1a0b" strokeWidth={4} fill="none" opacity={0.7} />
      {/* eyelid: closes for blinks, half-closes when laughing */}
      {blink > 0.02 && (
        <path
          d={`M ${cx - 23} 104 A 23 23 0 0 1 ${cx + 23} 104 L ${cx + 23} ${82 + 44 * blink} Q ${cx} ${88 + 44 * blink} ${cx - 23} ${82 + 44 * blink} Z`}
          fill="#c89d68"
          stroke="#4a2e15"
          strokeWidth={2}
        />
      )}
    </g>
  );
  return (
    <g>
      {/* far wing + body */}
      <path d="M 222 142 C 248 172 246 214 214 240 C 222 206 226 170 216 142 Z" fill="url(#owlWing)" />
      <g transform={`translate(170 200) scale(${chestScale}) translate(-170 -200)`}>
        <path d="M 110 150 C 100 212 132 246 170 246 C 208 246 240 212 230 150 C 222 112 118 112 110 150 Z" fill="url(#owlBody)" />
        <path d="M 132 150 C 126 200 146 238 170 238 C 194 238 214 200 208 150 C 200 128 140 128 132 150 Z" fill="url(#owlChest)" />
        {CHEST_STREAKS.map((c, k) => (
          <path key={k} d={`M ${c.x} ${c.y} q -3 ${c.h / 2} 0 ${c.h} q 3 -${c.h / 2} 0 -${c.h}`} fill="#5a3a1c" opacity={0.6} />
        ))}
        {SCALLOPS.map((c, k) => (
          <path key={`s${k}`} d={`M ${c.x - 6} ${c.y} q 6 6 12 0`} stroke="#e8d3ab" strokeWidth={1.6} fill="none" opacity={0.35} />
        ))}
      </g>

      {/* talons gripping the card edge */}
      {[150, 190].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={234} rx={17} ry={9} fill="#c9a676" />
          {[-9, 0, 9].map((d) => (
            <path key={d} d={`M ${x + d} 238 q 2 9 -3 16`} stroke="#1a120c" strokeWidth={4} strokeLinecap="round" fill="none" />
          ))}
        </g>
      ))}

      {/* head (turns toward the hint during a throw) */}
      <g transform={`rotate(${headTurn.toFixed(1)} 170 130)`}>
        {/* ear tufts: layered feather strands */}
        {([
          [124, 66, -1],
          [216, 66, 1],
        ] as const).map(([x, y, side]) => (
          <g key={x} transform={`rotate(${(side * idle.tuft).toFixed(2)} ${x} ${y + 12})`}>
            {[0, 1, 2].map((k) => (
              <path
                key={k}
                d={`M ${x - 10 * side + k * 6 * side} ${y + 12} Q ${x + side * (4 + k * 4)} ${y - 14 - k * 6} ${x + side * (12 + k * 4)} ${y - 34 + k * 6} Q ${x + side * (6 + k * 3)} ${y - 6} ${x + 4 * side + k * 6 * side} ${y + 14} Z`}
                fill={k === 1 ? "#4a3018" : "#6b4626"}
              />
            ))}
          </g>
        ))}
        <ellipse cx={170} cy={104} rx={68} ry={58} fill="url(#owlHead)" />
        {/* the face slides inside the head as it turns, which reads as the head swivelling */}
        <g transform={`translate(${idle.faceX.toFixed(2)} 0)`}>
        {/* facial disc with a ruffled rim */}
        <path
          d="M 170 70 C 138 54 100 70 102 104 C 104 140 140 150 170 142 C 200 150 236 140 238 104 C 240 70 202 54 170 70 Z"
          fill="url(#owlDisc)"
          stroke="#4a2e15"
          strokeWidth={6}
          strokeDasharray="3 2"
        />
        {/* fine radiating disc feathers */}
        {Array.from({ length: 16 }, (_, k) => {
          const a = (k / 8) * Math.PI * 2;
          const cx = k < 8 ? 145 : 195;
          return (
            <line
              key={k}
              x1={cx + Math.cos(a) * 25}
              y1={104 + Math.sin(a) * 25}
              x2={cx + Math.cos(a) * 34}
              y2={104 + Math.sin(a) * 34}
              stroke="#fff6e4"
              strokeWidth={1.4}
              opacity={0.35}
            />
          );
        })}
        {/* dark brow wedge + pale "eyebrows" */}
        <path d="M 158 80 L 170 116 L 182 80 Q 170 74 158 80 Z" fill="#6b4626" opacity={0.75} />
        <path d="M 124 86 Q 144 74 162 86" stroke="#f6ead2" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.85} transform={`translate(0 ${idle.browL.toFixed(2)})`} />
        <path d="M 178 86 Q 196 74 216 86" stroke="#f6ead2" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.85} transform={`translate(0 ${idle.browR.toFixed(2)})`} />
        {eye(145)}
        {eye(195)}
        {/* hooked beak; lower mandible drops when laughing (and a little for an idle "hoot") */}
        <path d={`M 164 126 Q 170 ${150 + 6 * beakOpen} 176 126 Z`} fill="#3a3632" opacity={beakOpen} />
        <path d="M 162 112 C 162 124 166 136 170 142 C 174 136 178 124 178 112 C 174 107 166 107 162 112 Z" fill="url(#owlBeak)" />
        <path d="M 166 114 Q 168 122 170 128" stroke="#cfc8bf" strokeWidth={1.6} fill="none" opacity={0.7} />
        </g>
      </g>
    </g>
  );
};

/** The near wing reaching out to the bucket handle (mirrored to the owl's right); primaries curl around it. */
/** Wing art is authored for a left-hand bucket; this is the pivot x in that unmirrored space. */
const WX = 2 * OWL_MID_X - PIVOT.x;
const HoldingWing: React.FC = () => (
  <g transform={`translate(${2 * OWL_MID_X} 0) scale(-1 1)`}>
    <path
      d={`M 128 146 C 112 150 96 152 ${WX + 6} ${PIVOT.y - 6} C 98 166 116 170 132 172 Z`}
      fill="url(#owlWing)"
      stroke="#2a1a0b"
      strokeWidth={2}
    />
    {[0, 1, 2, 3].map((k) => (
      <path key={k} d={`M ${WX + 6 + k * 9} ${PIVOT.y - 4 + k * 2} q -10 4 -8 12`} stroke="#2a1a0b" strokeWidth={6} strokeLinecap="round" fill="none" />
    ))}
    {[0, 1, 2].map((k) => (
      <path key={`b${k}`} d={`M ${100 + k * 10} ${154 + k * 3} q 6 4 12 0`} stroke="#c9a676" strokeWidth={2} fill="none" opacity={0.6} />
    ))}
  </g>
);

/** Supply pipe (BOX coordinates): riser x, overhead run height (clear of the owl's ear tufts
 * and the open lever), and how far right it runs (well past the screen edge). */
const RISER_X = 330;
const RUN_Y = -62;
const RUN_END = 1400;
const COUPLINGS = [410];
const CLAMPS = [372, 470];

/**
 * Brass tap (BOX coordinates) fed by a supply pipe that runs off the right of the screen,
 * a curved spout ending at SPOUT,
 * and a red-knobbed lever on the valve that swings up as `open` goes 0 → 1.
 */
const Tap: React.FC<{ open: number }> = ({ open }) => {
  const pipeY = SPOUT.y - 22; // tap body centreline
  const valveX = (SPOUT.x + RISER_X) / 2;
  // riser up from the tap, rounded elbow, then the long run to the right
  const supply = `M ${RISER_X} ${pipeY} L ${RISER_X} ${RUN_Y + 16} Q ${RISER_X} ${RUN_Y} ${RISER_X + 16} ${RUN_Y} L ${RUN_END} ${RUN_Y}`;
  return (
    <g>
      <defs>
        <linearGradient id="tapBrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4a12" />
          <stop offset="0.3" stopColor="#f3d27a" />
          <stop offset="0.55" stopColor="#c8952f" />
          <stop offset="1" stopColor="#4f360c" />
        </linearGradient>
        <radialGradient id="tapFlange" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#f6dc8e" />
          <stop offset="0.6" stopColor="#b8862b" />
          <stop offset="1" stopColor="#5a3d0e" />
        </radialGradient>
      </defs>
      {/* supply pipe: rises from the valve body, then runs right above the owl's head and off the edge of the screen */}
      <path d={supply} stroke="#3d2a08" strokeWidth={17} fill="none" strokeLinejoin="round" />
      <path d={supply} stroke="#c8952f" strokeWidth={13} fill="none" strokeLinejoin="round" />
      <path d={`M ${RISER_X + 18} ${RUN_Y - 3.5} L ${RUN_END} ${RUN_Y - 3.5}`} stroke="#fff4c8" strokeWidth={2.2} opacity={0.75} />
      <path d={`M ${RISER_X + 18} ${RUN_Y + 4} L ${RUN_END} ${RUN_Y + 4}`} stroke="#6b4a12" strokeWidth={3} opacity={0.8} />
      <path d={`M ${RISER_X - 3.5} ${RUN_Y + 18} L ${RISER_X - 3.5} ${pipeY - 18}`} stroke="#fff4c8" strokeWidth={2.2} opacity={0.75} />
      <path d={`M ${RISER_X + 4} ${RUN_Y + 18} L ${RISER_X + 4} ${pipeY - 18}`} stroke="#6b4a12" strokeWidth={3} opacity={0.8} />
      {/* couplings along the run and the riser, and wall clamps holding it up */}
      {COUPLINGS.map((x) => (
        <rect key={x} x={x - 5} y={RUN_Y - 10.5} width={10} height={21} rx={2} fill="url(#tapBrass)" stroke="#3d2a08" strokeWidth={2} />
      ))}
      <rect x={RISER_X - 10.5} y={(RUN_Y + pipeY) / 2 - 5} width={21} height={10} rx={2} fill="url(#tapBrass)" stroke="#3d2a08" strokeWidth={2} />
      {CLAMPS.map((x) => (
        <g key={x}>
          <rect x={x - 4} y={RUN_Y - 22} width={8} height={14} fill="#2a2a2e" />
          <path d={`M ${x - 9} ${RUN_Y - 8} Q ${x} ${RUN_Y + 16} ${x + 9} ${RUN_Y - 8}`} stroke="#2a2a2e" strokeWidth={4} fill="none" />
          <circle cx={x} cy={RUN_Y - 18} r={2.2} fill="#8a8a92" />
        </g>
      ))}
      {/* tap body: short stub from the riser to the curved spout */}
      <path d={`M ${RISER_X - 6} ${pipeY} L ${SPOUT.x + 14} ${pipeY} Q ${SPOUT.x} ${pipeY} ${SPOUT.x} ${pipeY + 14} L ${SPOUT.x} ${SPOUT.y - 3}`} stroke="#3d2a08" strokeWidth={17} fill="none" strokeLinecap="butt" />
      <path d={`M ${RISER_X - 6} ${pipeY} L ${SPOUT.x + 14} ${pipeY} Q ${SPOUT.x} ${pipeY} ${SPOUT.x} ${pipeY + 14} L ${SPOUT.x} ${SPOUT.y - 3}`} stroke="url(#tapBrass)" strokeWidth={13} fill="none" strokeLinecap="butt" />
      <path d={`M ${RISER_X - 8} ${pipeY - 3} L ${SPOUT.x + 16} ${pipeY - 3}`} stroke="#fff4c8" strokeWidth={2} opacity={0.7} strokeLinecap="round" />
      {/* elbow fitting where the riser meets the tap */}
      <circle cx={RISER_X} cy={pipeY} r={10} fill="url(#tapFlange)" stroke="#3d2a08" strokeWidth={2} />
      {/* spout mouth */}
      <rect x={SPOUT.x - 9} y={SPOUT.y - 6} width={18} height={7} rx={2} fill="url(#tapBrass)" stroke="#3d2a08" strokeWidth={2} />
      <ellipse cx={SPOUT.x} cy={SPOUT.y + 1} rx={6} ry={1.8} fill="#1d1404" />
      {/* valve bonnet + lever (closed: lying along the pipe; open: swung up) */}
      <rect x={valveX - 8} y={pipeY - 20} width={16} height={14} rx={3} fill="url(#tapBrass)" stroke="#3d2a08" strokeWidth={2} />
      <g transform={`rotate(${(75 * open).toFixed(1)} ${valveX} ${pipeY - 20})`}>
        <path d={`M ${valveX} ${pipeY - 20} L ${valveX - 30} ${pipeY - 24}`} stroke="#3d2a08" strokeWidth={7} strokeLinecap="round" />
        <path d={`M ${valveX} ${pipeY - 20} L ${valveX - 30} ${pipeY - 24}`} stroke="url(#tapBrass)" strokeWidth={4.5} strokeLinecap="round" />
        <circle cx={valveX - 33} cy={pipeY - 24} r={7} fill="#d23a2e" stroke="#5a1410" strokeWidth={2} />
        <circle cx={valveX - 35} cy={pipeY - 26.5} r={2.2} fill="#ffffff" opacity={0.7} />
      </g>
      <circle cx={valveX} cy={pipeY - 20} r={3.5} fill="#f3d27a" stroke="#3d2a08" strokeWidth={1.5} />
    </g>
  );
};

/** The refill stream from the tap: a glassy column between `top` and `bottom`, with a little splash at the surface. */
const TapPour: React.FC<{ top: number; bottom: number; t: number; splash: boolean }> = ({ top, bottom, t, splash }) => {
  if (bottom - top < 1) return null;
  const x = SPOUT.x;
  const wob = (y: number) => Math.sin(y * 0.12 - t * 40) * 0.9;
  const w0 = 7; // at the spout
  const w1 = 4.5; // thinner as it speeds up
  const n = 8;
  const pts = Array.from({ length: n + 1 }, (_, k) => {
    const y = top + ((bottom - top) * k) / n;
    const w = w0 + (w1 - w0) * ((y - SPOUT.y) / Math.max(1, bottom - SPOUT.y));
    return { y, w, dx: wob(y) };
  });
  const body =
    `M ${pts.map((p) => `${x - p.w + p.dx} ${p.y}`).join(" L ")} ` +
    `L ${[...pts].reverse().map((p) => `${x + p.w + p.dx} ${p.y}`).join(" L ")} Z`;
  return (
    <g>
      <path d={body} fill="url(#bucketWater)" opacity={0.9} />
      <path d={body} fill="none" stroke="rgba(32,96,160,0.8)" strokeWidth={1.2} />
      <path d={`M ${pts.map((p) => `${x - p.w * 0.35 + p.dx} ${p.y}`).join(" L ")}`} stroke="#ffffff" strokeWidth={1.6} opacity={0.75} fill="none" />
      {splash && (
        <g>
          <ellipse cx={x} cy={bottom} rx={13 + 3 * Math.sin(t * 50)} ry={3} fill="none" stroke="#e6f5ff" strokeWidth={1.8} opacity={0.8} />
          {[-1, 1].map((d) => (
            <circle key={d} cx={x + d * (8 + 3 * Math.abs(Math.sin(t * 37 + d)))} cy={bottom - 4 - 4 * Math.abs(Math.sin(t * 31 + d))} r={1.8} fill="#e6f5ff" opacity={0.85} />
          ))}
        </g>
      )}
    </g>
  );
};

/** Wooden bucket hanging from its handle; local origin = the handle pivot. `fill` 1 = full. */
const Bucket: React.FC<{ fill: number }> = ({ fill }) => (
  <g>
    <path d="M -32 34 Q 0 -10 32 34" stroke="url(#bucketHoop)" strokeWidth={5} fill="none" />
    <ellipse cx={0} cy={34} rx={36} ry={8} fill="#24150a" />
    {fill > 0.05 && <ellipse cx={0} cy={34 + 10 * (1 - fill)} rx={32 - 6 * (1 - fill)} ry={6} fill="url(#bucketWater)" opacity={0.95} />}
    <path d="M -36 34 Q 0 44 36 34 L 28 100 Q 0 108 -28 100 Z" fill="url(#bucketWood)" stroke="#24150a" strokeWidth={3} strokeLinejoin="round" />
    {[-18, -6, 6, 18].map((x) => (
      <path key={x} d={`M ${x} 40 L ${x * 0.82} 102`} stroke="#2e1a0a" strokeWidth={2} opacity={0.6} />
    ))}
    {[48, 86].map((y) => (
      <path key={y} d={`M ${-35 + (y - 34) * 0.12} ${y} Q 0 ${y + 9} ${35 - (y - 34) * 0.12} ${y}`} stroke="url(#bucketHoop)" strokeWidth={7} fill="none" />
    ))}
    <ellipse cx={0} cy={34} rx={36} ry={8} fill="none" stroke="#5a3415" strokeWidth={3} />
  </g>
);
