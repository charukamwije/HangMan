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
 *   0.4–1.6 s    drips run down the card, beads glisten, sheen fades; owl squints (laughs)
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
const PIVOT = { x: 74, y: 156 };

const G = 3200; // px/s² on the 4K stage
const EMIT = [0.22, 0.34] as const;
const FLIGHT = 0.16; // seconds from rim to text
const PARCELS = 30;
const WATER_DEEP = "rgba(96,168,230,0.78)";
const WATER_MID = "rgba(170,215,250,0.85)";

const deg = (d: number) => (d * Math.PI) / 180;
const rot = (x: number, y: number, a: number) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

/** Bucket swing angle (deg, clockwise) s seconds into a throw. */
const bucketAngle = (s: number) =>
  interpolate(s, [0, 0.14, 0.3, 0.5, 0.95], [0, -34, 132, 132, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

type Parcel = { te: number; T: number; m: { x: number; y: number }; v: { x: number; y: number }; hit: { x: number; y: number } };

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
        return [{ i, x: p.m.x + p.v.x * a, y: p.m.y + p.v.y * a + 0.5 * G * a * a, w: 8 + 30 * env * (1 - 0.45 * (a / p.T)) }];
      })
    : [];

  const splashT = active ? s - (EMIT[0] + FLIGHT - 0.015) : -1;

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
        </defs>
        {splashT >= 0 && <SplashLayer t={splashT} s={s} target={target} cardW={cardW} cardH={cardH} seed={throwSeed} parcels={parcels} />}
        {live.length > 1 && <Stream pts={live} />}
      </svg>

      {/* the owl + bucket on the card's top-right corner */}
      <div style={{ position: "absolute", left: boxLeft, top: boxTop + bob, width: BOX.w, height: BOX.h, pointerEvents: "none" }}>
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} width={BOX.w} height={BOX.h} style={{ overflow: "visible", filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.6))" }}>
          <OwlDefs />
          <Owl look={look} blink={Math.max(blink, 0.55 * laugh)} laugh={laugh} breathe={breathe} />
          <g transform={`translate(${PIVOT.x} ${PIVOT.y}) rotate(${angle.toFixed(1)})`}>
            <Bucket fill={active ? 1 - ramp(s, [0.2, 0.34], [0, 1]) : 1} />
          </g>
          <HoldingWing />
        </svg>
      </div>
    </>
  );
};

/* ---------------------------------------------------------------- water */

/** The pour: a tapered ribbon through the live parcels, in three layers + breakup droplets. */
const Stream: React.FC<{ pts: { i: number; x: number; y: number; w: number }[] }> = ({ pts }) => {
  const seg = (layer: "deep" | "mid" | "hi") =>
    pts.slice(1).map((p, k) => {
      const q = pts[k];
      const w = (p.w + q.w) / 2;
      const width = layer === "deep" ? w : layer === "mid" ? w * 0.55 : Math.max(2, w * 0.16);
      const off = layer === "hi" ? -w * 0.22 : 0;
      return (
        <line
          key={`${layer}-${p.i}`}
          x1={q.x}
          y1={q.y + off}
          x2={p.x}
          y2={p.y + off}
          stroke={layer === "deep" ? WATER_DEEP : layer === "mid" ? WATER_MID : "rgba(255,255,255,0.9)"}
          strokeWidth={width}
          strokeLinecap="round"
        />
      );
    });
  const head = pts[pts.length - 1];
  return (
    <g>
      {seg("deep")}
      {seg("mid")}
      {seg("hi")}
      {/* leading bulb + breakup droplets peeling off the sheet */}
      <circle cx={head.x} cy={head.y} r={head.w * 0.62} fill={WATER_MID} />
      {pts
        .filter((p) => p.i % 3 === 1)
        .map((p) => (
          <Drop
            key={`bd-${p.i}`}
            x={p.x + (random(`bd-x-${p.i}`) - 0.5) * 70}
            y={p.y + (random(`bd-y-${p.i}`) - 0.3) * 50}
            r={3 + 6 * random(`bd-r-${p.i}`)}
          />
        ))}
    </g>
  );
};

/** A water drop with a refraction highlight and a darker lower rim. */
const Drop: React.FC<{ x: number; y: number; r: number; o?: number }> = ({ x, y, r, o = 1 }) => (
  <g opacity={o}>
    <circle cx={x} cy={y} r={r} fill="rgba(140,200,245,0.75)" />
    <path
      d={`M ${x - r * 0.8} ${y + r * 0.2} A ${r * 0.85} ${r * 0.85} 0 0 0 ${x + r * 0.8} ${y + r * 0.2}`}
      stroke="rgba(20,60,100,0.5)"
      strokeWidth={Math.max(1, r * 0.22)}
      fill="none"
    />
    <circle cx={x - r * 0.32} cy={y - r * 0.35} r={r * 0.3} fill="#ffffff" opacity={0.9} />
  </g>
);

/** Impact: wet sheen, spreading ring, splash crown + spray, then drips and beads on the card. */
const SplashLayer: React.FC<{
  t: number;
  s: number;
  target: { x: number; y: number };
  cardW: number;
  cardH: number;
  seed: number;
  parcels: Parcel[];
}> = ({ t, s, target, cardW, cardH, seed, parcels }) => {
  const sheen = ramp(t, [0, 0.06, 1.3], [0, 1, 0]);
  const ring = ramp(t, [0, 0.35], [0, 1]);
  const R = (k: string) => random(`${seed}-${k}`);

  // spray from every parcel that has landed: short-lived ballistic droplets
  const spray = parcels.flatMap((p, i) => {
    const since = s - (p.te + p.T);
    if (since < 0 || since > 0.45) return [];
    return Array.from({ length: 3 }, (_, k) => {
      const ang = -Math.PI * (0.12 + 0.76 * R(`sa-${i}-${k}`));
      const v = 420 + 900 * R(`sv-${i}-${k}`);
      return (
        <Drop
          key={`sp-${i}-${k}`}
          x={p.hit.x + Math.cos(ang) * v * since}
          y={p.hit.y + Math.sin(ang) * v * since + 0.5 * G * since * since}
          r={3 + 7 * R(`sr-${i}-${k}`)}
          o={1 - since / 0.45}
        />
      );
    });
  });

  // drips running down the card from the impact line, slowing like real water
  const drips = Array.from({ length: 7 }, (_, k) => {
    const x0 = target.x - 240 + 480 * (k / 6) + (R(`dx-${k}`) - 0.5) * 50;
    const dt = t - (0.05 + 0.18 * R(`ds-${k}`));
    if (dt <= 0) return null;
    const len = cardH - target.y + 10;
    const y = target.y + len * Easing.out(Easing.quad)(Math.min(1, dt / (0.7 + 0.5 * R(`dd-${k}`))));
    const w = 5 + 5 * R(`dw-${k}`);
    return (
      <g key={`dr-${k}`} opacity={1 - ramp(t, [1.0, 1.6], [0, 1])}>
        <path d={`M ${x0} ${target.y - 10} L ${x0 + 2} ${y}`} stroke="url(#owlDrip)" strokeWidth={w} strokeLinecap="round" />
        <Drop x={x0 + 2} y={y + w * 0.3} r={w * 0.95} />
      </g>
    );
  });

  // beads left on the card surface, catching the light
  const beads = Array.from({ length: 22 }, (_, k) => {
    const o = ramp(t, [0.08 + 0.1 * R(`bt-${k}`), 0.2, 1.1, 1.6], [0, 1, 1, 0]);
    if (o <= 0) return null;
    return (
      <Drop
        key={`b-${k}`}
        x={target.x + (R(`bx-${k}`) - 0.5) * cardW * 0.8}
        y={target.y + (R(`by-${k}`) - 0.5) * cardH * 0.9}
        r={3 + 6 * R(`br-${k}`)}
        o={o * 0.85}
      />
    );
  });

  return (
    <g>
      <rect x={0} y={0} width={cardW} height={cardH} rx={44} fill="url(#owlWetSheen)" opacity={sheen} />
      {/* soft specular glints where the film of water is thickest */}
      <ellipse cx={target.x - 120} cy={target.y - 30} rx={220} ry={26} fill="url(#owlGlint)" opacity={0.55 * sheen} />
      <ellipse cx={target.x + 160} cy={target.y + 34} rx={160} ry={18} fill="url(#owlGlint)" opacity={0.4 * sheen} />
      <ellipse
        cx={target.x}
        cy={target.y}
        rx={80 + 520 * ring}
        ry={26 + 110 * ring}
        fill="none"
        stroke="rgba(200,235,255,0.8)"
        strokeWidth={10 * (1 - ring) + 1}
        opacity={1 - ring}
      />
      {/* splash crown: sheets thrown up from the impact line */}
      {Array.from({ length: 9 }, (_, k) => {
        const life = ramp(t, [0, 0.08, 0.3], [0, 1, 0]);
        if (life <= 0) return null;
        const x = target.x - 260 + 520 * (k / 8);
        const h = (60 + 90 * R(`ch-${k}`)) * life;
        const lean = (k - 4) * 6;
        return (
          <path
            key={`cr-${k}`}
            d={`M ${x - 12} ${target.y} Q ${x + lean} ${target.y - h * 0.6} ${x + lean * 1.4} ${target.y - h} Q ${x + lean * 0.8} ${target.y - h * 0.5} ${x + 12} ${target.y} Z`}
            fill={WATER_MID}
          />
        );
      })}
      {drips}
      {beads}
      {spray}
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

const Owl: React.FC<{ look: number; blink: number; laugh: number; breathe: number }> = ({ look, blink, laugh, breathe }) => {
  const headTurn = -9 * look;
  const pdx = -5 * look;
  const pdy = 4 * look;
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
          <g key={x}>
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
        <path d="M 124 86 Q 144 74 162 86" stroke="#f6ead2" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.85} />
        <path d="M 178 86 Q 196 74 216 86" stroke="#f6ead2" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.85} />
        {eye(145)}
        {eye(195)}
        {/* hooked beak; lower mandible drops when laughing */}
        <path d={`M 164 126 Q 170 ${150 + 6 * laugh} 176 126 Z`} fill="#3a3632" opacity={laugh} />
        <path d="M 162 112 C 162 124 166 136 170 142 C 174 136 178 124 178 112 C 174 107 166 107 162 112 Z" fill="url(#owlBeak)" />
        <path d="M 166 114 Q 168 122 170 128" stroke="#cfc8bf" strokeWidth={1.6} fill="none" opacity={0.7} />
      </g>
    </g>
  );
};

/** The near wing reaching out to the bucket handle; primaries curl around it. */
const HoldingWing: React.FC = () => (
  <g>
    <path
      d={`M 128 146 C 112 150 96 152 ${PIVOT.x + 6} ${PIVOT.y - 6} C 98 166 116 170 132 172 Z`}
      fill="url(#owlWing)"
      stroke="#2a1a0b"
      strokeWidth={2}
    />
    {[0, 1, 2, 3].map((k) => (
      <path key={k} d={`M ${PIVOT.x + 6 + k * 9} ${PIVOT.y - 4 + k * 2} q -10 4 -8 12`} stroke="#2a1a0b" strokeWidth={6} strokeLinecap="round" fill="none" />
    ))}
    {[0, 1, 2].map((k) => (
      <path key={`b${k}`} d={`M ${100 + k * 10} ${154 + k * 3} q 6 4 12 0`} stroke="#c9a676" strokeWidth={2} fill="none" opacity={0.6} />
    ))}
  </g>
);

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
