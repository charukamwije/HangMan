import React from "react";
import { Easing, interpolate, random, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LOWER_SAFE_CENTER_X as SAFE_CENTER_X } from "../constants";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";
import { shadeA, type Theme } from "../themes";
import type { ResolvedGuess } from "../timeline";

const LETTER = 480;
/** How long each callout stays mounted. */
export const CALLOUT_SECONDS = 1.15;

/**
 * Big centre-screen callout for every guess. One <Sequence> per guess, starting
 * on the guess frame, so the slam is frame-locked to its SFX.
 *
 * The letter and its verdict tag are painted on a splat (accent = correct, red = wrong):
 * they spread in with the paint as it bursts out, and sag + fade away with it.
 * No separate entrance or exit.
 */
export const GuessCallouts: React.FC<{
  theme: Theme;
  guesses: ResolvedGuess[];
  finalRevealFrame: number;
  /** Vertical centre on the 4K design canvas (horizontal: the lower safe band's centre). */
  centerY: number;
}> = ({ theme, guesses, finalRevealFrame, centerY }) => {
  const { fps } = useVideoConfig();
  const len = Math.round(CALLOUT_SECONDS * fps);
  // Miss words: a per-puzzle starting point + stride through the list, so they look random but never repeat.
  const puzzleKey = guesses.map((g) => g.letter).join("");
  const missStart = Math.floor(random(`miss-${puzzleKey}`) * MISS.length);
  const missStride = [1, 3, 5, 7][Math.floor(random(`miss-stride-${puzzleKey}`) * 4)]; // coprime with 8: visits every word
  const missWord = (g: ResolvedGuess) => MISS[(missStart + missStride * guesses.filter((p) => p.kind === "wrong" && p.frame < g.frame).length) % MISS.length];
  return (
    <>
      {guesses
        .filter((g) => g.frame < finalRevealFrame)
        .map((g) => (
          <Sequence key={g.letter} name={`callout-${g.kind}-${g.letter}`} from={g.frame} durationInFrames={Math.min(len, finalRevealFrame - g.frame)} layout="none">
            <Callout
              theme={theme}
              letter={g.letter}
              correct={g.kind === "correct"}
              centerY={centerY}
              verdict={g.kind === "correct" ? PRAISE[guesses.filter((p) => p.kind === "correct" && p.frame < g.frame).length % PRAISE.length] : missWord(g)}
            />
          </Sequence>
        ))}
    </>
  );
};

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
};

/** The letter glyph sits above the callout centre; the splat is raised to frame it. */
const SPLAT_LIFT = -70;

/** Closed smooth path through points (quadratic curves via the midpoints). */
const smoothClosed = (pts: { x: number; y: number }[]) => {
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[pts.length - 1], pts[0]);
  let d = `M ${m0.x.toFixed(1)} ${m0.y.toFixed(1)}`;
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % pts.length]);
    d += ` Q ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)}`;
  });
  return `${d} Z`;
};

/**
 * A wet paint splat with liquid motion (all frame-derived, deterministic per `seed`):
 *  - impact: the body bursts out from the centre with an overshoot; the thrown arms keep
 *    shooting outward a few frames longer than the body;
 *  - wobble: the rim ripples like a liquid surface and settles (damped, per-point phase);
 *  - spatter: droplets fly out ballistically (fast, slowing, falling under gravity),
 *    stretched along their velocity, and stick where they land;
 *  - drips: start staggered, run quickly then slow as the paint thickens; the bead swells;
 *  - exit: the paint sags downward and stretches as it fades.
 */
/**
 * Shared motion of the splat and everything painted on it (letter + verdict tag):
 * `body` = spread (0 → ~1.06 → 1), `exit` = sag phase 0..1, `sag` px, `fade` opacity, `rot` deg.
 */
/** Splat radius (design px). */
const R = 360;
/** Dissolve: the eroding edge sweeps in from DISSOLVE_FROM_R to 0 over [DISSOLVE_AT, DISSOLVE_AT + DISSOLVE_SWEEP] s. */
const DISSOLVE_AT = 0.48;
const DISSOLVE_SWEEP = 0.32;
const DISSOLVE_FROM_R = R * 1.75;
/** How long a detached particle lives (s). */
const PARTICLE_LIFE = 0.34;

/**
 * Shared motion of the splat and everything painted on it (letter + verdict tag):
 * `body` = spread (0 → ~1.06 → 1), `edge` = radius of the eroding dissolve edge (px, Infinity
 * before it starts), `rot` deg.
 */
const splatMotion = (seed: string, f: number, fps: number) => {
  const t = f / fps;
  const k = interpolate(t, [DISSOLVE_AT, DISSOLVE_AT + DISSOLVE_SWEEP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  return {
    body: spring({ frame: f, fps, config: { damping: 12, stiffness: 420, mass: 0.5 } }), // a crisp burst, no bloat
    edge: t < DISSOLVE_AT ? Infinity : DISSOLVE_FROM_R * (1 - k),
    rot: (random(`rot-${seed}`) - 0.5) * 22,
  };
};

/** The splat's outline points at frame f (wobbly blob + thrown arms + damped rim ripple). */
const splatOutline = (seed: string, f: number, fps: number) => {
  const N = 30;
  const rnd = (k: string) => random(`${k}-${seed}`);
  const { body } = splatMotion(seed, f, fps);
  const armOut = interpolate(f, [1, 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const arms = new Set(Array.from({ length: 6 }, (_, i) => Math.floor(rnd(`arm-${i}`) * N)));
  return Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    const baseK = 0.86 + rnd(`r-${i}`) * 0.2;
    const armK = arms.has(i) ? 1.25 + rnd(`al-${i}`) * 0.3 : baseK;
    const k = baseK + (armK - baseK) * armOut;
    // liquid rim ripple: damped oscillation, a different phase per point
    const ripple = 1 + 0.07 * Math.sin(f * 1.25 + rnd(`ph-${i}`) * 6.28) * Math.exp(-f / 7);
    const r = R * k * (0.15 + 0.85 * body) * ripple;
    return { x: Math.cos(a) * r * 1.08, y: Math.sin(a) * r };
  });
};

const insidePolygon = (x: number, y: number, poly: { x: number; y: number }[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/**
 * The dissolve: the paint (and the letter on it) is sampled into small blobs. As the eroding edge
 * sweeps inward past a blob, that blob breaks off exactly where it was and drifts away — outward
 * with drag, a gentle swirl and a little gravity — shrinking and fading. Rim and arms go first.
 */
const PaintParticles: React.FC<{ seed: string; color: string; f: number; fps: number }> = ({ seed, color, f, fps }) => {
  const t = f / fps;
  const parts = React.useMemo(() => {
    const shape = splatOutline(seed, Math.round(DISSOLVE_AT * fps), fps);
    const STEP = 30;
    const out: { x: number; y: number; r: number; d: number; c: number; ph: number; v: number }[] = [];
    for (let y = -R * 1.7; y <= R * 1.7; y += STEP) {
      for (let x = -R * 1.9; x <= R * 1.9; x += STEP) {
        const jx = x + (random(`gx-${seed}-${x}-${y}`) - 0.5) * STEP * 0.8;
        const jy = y + (random(`gy-${seed}-${x}-${y}`) - 0.5) * STEP * 0.8;
        if (!insidePolygon(jx, jy, shape)) continue;
        out.push({ x: jx, y: jy, r: STEP * (0.5 + random(`gr-${seed}-${x}-${y}`) * 0.3), d: Math.hypot(jx, jy), c: random(`gc-${seed}-${x}-${y}`), ph: random(`gp-${seed}-${x}-${y}`) * 6.28, v: random(`gv-${seed}-${x}-${y}`) });
      }
    }
    return out;
  }, [seed, fps]);

  if (t < DISSOLVE_AT) return null;
  const sweepK = (d: number) => 1 - d / DISSOLVE_FROM_R; // 0 at the outer edge → 1 at the centre
  const lighter = shade(color, 0.25);
  const darker = shade(color, -0.25);
  return (
    <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {parts.map((p, i) => {
        // when the eroding edge reaches this blob (inverse of the eased sweep)
        const k = Math.min(1, Math.max(0, sweepK(p.d)));
        const td = DISSOLVE_AT + (Math.acos(1 - 2 * k) / Math.PI) * DISSOLVE_SWEEP;
        const tau = t - td;
        if (tau < 0 || tau > PARTICLE_LIFE) return null;
        const life = tau / PARTICLE_LIFE;
        const dirX = p.d > 1 ? p.x / p.d : Math.cos(p.ph);
        const dirY = p.d > 1 ? p.y / p.d : Math.sin(p.ph);
        // outward drift with drag, a perpendicular swirl, and a little gravity
        const speed = 260 + p.v * 420;
        const drag = 0.16;
        const travel = speed * drag * (1 - Math.exp(-tau / drag));
        const swirl = Math.sin(tau * 9 + p.ph) * 22 * Math.min(1, tau * 6);
        const x = p.x + dirX * travel - dirY * swirl;
        const y = p.y + dirY * travel + dirX * swirl + 0.5 * 900 * tau * tau;
        const r = p.r * (1 - life) ** 0.8;
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)} fill={p.c < 0.25 ? lighter : p.c > 0.8 ? darker : color} opacity={(1 - life * life).toFixed(3)} />;
      })}
    </svg>
  );
};

const PaintSplat: React.FC<{ seed: string; color: string; f: number; fps: number }> = ({ seed, color, f, fps }) => {
  const t = f / fps;
  const rnd = (k: string) => random(`${k}-${seed}`);
  const sag = 0;

  // --- body + arms
  const { body } = splatMotion(seed, f, fps);
  const pts = splatOutline(seed, f, fps);
  const blob = smoothClosed(pts);
  // wet sheen drifts a touch as the paint settles
  const settle = Math.exp(-f / 6);
  const sheen = smoothClosed(pts.map((p) => ({ x: p.x * 0.7 - 40 - 14 * settle, y: p.y * 0.62 - 60 - 10 * settle })));

  const dark = shade(color, -0.4);

  // --- spatter: ballistic droplets that stick where they land
  const G = 2600; // px/s² (design px)
  const drops = Array.from({ length: 18 }, (_, i) => {
    const a = rnd(`da-${i}`) * Math.PI * 2;
    const speed = 1700 + rnd(`ds-${i}`) * 1600; // px/s at launch
    const tau = 0.07 + rnd(`dt-${i}`) * 0.05; // drag time constant
    const land = 0.12 + rnd(`dl-${i}`) * 0.16; // when it hits and sticks (s)
    const tt = Math.min(t, land);
    const travel = speed * tau * (1 - Math.exp(-tt / tau));
    const fall = 0.5 * G * tt * tt;
    const x = Math.cos(a) * (R * 0.5 + travel) * 1.08;
    const y = Math.sin(a) * (R * 0.5 + travel) + fall;
    // velocity (for the stretch) while airborne
    const vx = Math.cos(a) * speed * Math.exp(-tt / tau) * 1.08;
    const vy = Math.sin(a) * speed * Math.exp(-tt / tau) + G * tt;
    const airborne = t < land;
    const v = Math.hypot(vx, vy);
    const r = (8 + rnd(`dr-${i}`) * 26) * (airborne ? 0.85 : 1);
    return { x, y, r, rx: airborne ? r * Math.min(3, 1 + v / 1400) : r * 1.08, ang: airborne ? (Math.atan2(vy, vx) * 180) / Math.PI : rnd(`dg-${i}`) * 180, show: f >= 1 };
  });

  // --- drips: staggered starts, fast then slowing (viscous), bead swelling at the tip
  const drips = Array.from({ length: 5 }, (_, i) => {
    const x = (-0.55 + 1.1 * (i / 4) + (rnd(`px-${i}`) - 0.5) * 0.15) * R;
    const t0 = 0.08 + rnd(`pt-${i}`) * 0.16;
    const run = Math.max(0, t - t0);
    const len = (70 + rnd(`pl-${i}`) * 190) * (1 - Math.exp(-run / 0.22)) + sag * 0.6;
    const w = 18 + rnd(`pw-${i}`) * 16;
    const wobbleX = Math.sin(run * 9 + i) * 3 * Math.min(1, run * 4);
    return { x: x + wobbleX, top: Math.sqrt(Math.max(0, 1 - (x / (R * 1.05)) ** 2)) * R * 0.86 * body, len, w, bead: w * (0.55 + 0.25 * Math.min(1, run / 0.4)) };
  });

  return (
    // positioned, tilted, sagged and faded by the shared wrapper in <Callout>
    <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <g filter="drop-shadow(0 18px 24px rgba(0,0,0,0.5))">
        {drips.map((d, i) =>
          d.len > 1 ? (
            <g key={`drip-${i}`}>
              <rect x={d.x - d.w / 2} y={d.top - 20} width={d.w} height={d.len + 20} rx={d.w / 2} fill={color} />
              <ellipse cx={d.x} cy={d.top + d.len} rx={d.bead} ry={d.bead * 1.15} fill={color} />
            </g>
          ) : null,
        )}
        {drops.map((d, i) =>
          d.show ? (
            <ellipse key={`drop-${i}`} cx={d.x} cy={d.y} rx={d.rx} ry={d.r} fill={color} stroke={dark} strokeWidth={3} transform={`rotate(${d.ang.toFixed(1)} ${d.x.toFixed(1)} ${d.y.toFixed(1)})`} />
          ) : null,
        )}
        {/* the body goes on top: droplets still inside it stay hidden until they fly clear */}
        <path d={blob} fill={color} stroke={dark} strokeWidth={6} />
      </g>
      {/* wet sheen + glints */}
      <path d={sheen} fill="#ffffff" opacity={0.16} />
      <ellipse cx={-R * 0.42} cy={-R * 0.5} rx={R * 0.2 * body} ry={R * 0.07 * body} fill="#ffffff" opacity={0.55} transform={`rotate(-30 ${-R * 0.42} ${-R * 0.5})`} />
      <circle cx={-R * 0.62} cy={-R * 0.28} r={R * 0.035 * body} fill="#ffffff" opacity={0.6} />
    </svg>
  );
};

/** Verdict pill text for correct guesses, cycled in guess order (deterministic). */
const PRAISE = ["NICE!", "SMART!", "YES!", "GENIUS!"] as const;
/** Verdict pill text for misses: shuffled per puzzle, no repeats within a video. */
const MISS = ["NOPE!", "OOPS!", "UH-OH!", "NOT IT!", "MISSED!", "SO CLOSE!", "YIKES!", "NAH!"] as const;

const Callout: React.FC<{ theme: Theme; letter: string; correct: boolean; centerY: number; verdict: string }> = ({ theme, letter, correct, centerY: CALLOUT_Y, verdict }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const color = correct ? theme.accent : theme.wrong;

  // The letter and tag are painted on the splat: they spread in with it, tilt with it, and sag +
  // fade away with it. No entrance or exit of their own.
  const seed = `${letter}-${correct ? "c" : "w"}`;
  const m = splatMotion(seed, f, fps);
  const spread = 0.15 + 0.85 * m.body;
  const inked = ramp(f, [0, 2], [0, 1]); // paint comes first, the letter shows as it spreads

  const backdrop = ramp(t, [0, 0.05, 0.6, 1.05], [0, 0.85, 0.6, 0]);
  const ink = correct ? theme.onAccent : "#ffffff";

  return (
    // zIndex 5: above the pawn row (3 while a pawn falls), its speech bubbles (4) and lit keys (2)
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
      {/* darken around the callout so it reads over everything */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: backdrop,
          background: `radial-gradient(900px 700px at ${SAFE_CENTER_X}px ${CALLOUT_Y}px, ${shadeA(theme, 0.85)}, transparent 75%)`,
        }}
      />
      <div style={{ position: "absolute", left: SAFE_CENTER_X, top: CALLOUT_Y, width: 0, height: 0 }}>
        {/* one wrapper for the paint and everything painted on it: same lift, tilt, sag, stretch and fade */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            transform: `translateY(${SPLAT_LIFT}px) rotate(${m.rot.toFixed(1)}deg)`,
          }}
        >
        {/* particles the paint (and letter) break into, drawn unclipped */}
        <PaintParticles seed={seed} color={color} f={f} fps={fps} />
        {/* everything still intact: eaten away from the outside in by the dissolve edge */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            clipPath: Number.isFinite(m.edge) ? `circle(${Math.max(0, m.edge).toFixed(1)}px at 0px 0px)` : undefined,
          }}
        >
        <PaintSplat seed={seed} color={color} f={f} fps={fps} />
        {/* letter + tag spread out from the splat's centre as the paint does */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transform: `scale(${spread.toFixed(4)})`, opacity: inked }}>
        {/* the letter */}
        <div
          style={{
            position: "absolute",
            left: -LETTER,
            width: LETTER * 2,
            top: -LETTER * 0.62 - SPLAT_LIFT,
            textAlign: "center",
            fontFamily: DISPLAY_FONT,
            fontSize: LETTER,
            lineHeight: 1,
            // Sits on the paint, so it takes the contrasting colour: dark-on-lime / white-on-red.
            color: ink,
            textShadow: `0 12px 0 ${shade(color, -0.5)}, 0 24px 40px rgba(0,0,0,0.45)`,
          }}
        >
          {letter}
        </div>
        {/* verdict tag */}
        <div
          style={{
            position: "absolute",
            left: -600,
            width: 1200,
            top: LETTER * 0.42 - SPLAT_LIFT,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              padding: "14px 44px 12px 56px",
              borderRadius: 999,
              background: color,
              border: "4px solid rgba(255,255,255,0.85)",
              boxShadow: `0 0 50px ${color}, 0 14px 30px ${shadeA(theme, 0.8)}`,
              fontFamily: BODY_FONT,
              fontWeight: 900,
              fontSize: 72,
              letterSpacing: "0.3em",
              color: correct ? theme.onAccent : "#ffffff",
            }}
          >
            {verdict}
          </span>
        </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};
