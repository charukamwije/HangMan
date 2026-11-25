import React, { useMemo } from "react";
import { random } from "remotion";
import { DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";

/**
 * Opening: a pre-filled letter trapped behind a pane of glass in its card. On frame 0 the pane is intact
 * (the letter shows through, dimmed); cracks run out from an impact point (`cracked`), then the pane
 * shatters (`shatter` 0 → 1): shards fly outward from the impact, spin, fall and fade while the real
 * letter breaks out underneath (WordBoard). Everything is a pure function of its props + a seed.
 */

type Pt = { x: number; y: number };
type Shard = { pts: Pt[]; c: Pt; dir: Pt; dist: number; spin: number; lift: number };

const SHARDS = 9;

/** Point at distance `t` along the rectangle's perimeter (clockwise from the top-left corner). */
function perimeterPoint(t: number, w: number, h: number): Pt {
  const p = 2 * (w + h);
  const u = ((t % p) + p) % p;
  if (u < w) return { x: u, y: 0 };
  if (u < w + h) return { x: w, y: u - w };
  if (u < 2 * w + h) return { x: w - (u - w - h), y: h };
  return { x: 0, y: h - (u - 2 * w - h) };
}

/** Radial shards: triangles (plus any corners in between) from the impact point to the edge. */
function makeShards(w: number, h: number, seed: string): { impact: Pt; edge: Pt[]; shards: Shard[] } {
  const impact = { x: w * (0.32 + 0.36 * random(`${seed}-ix`)), y: h * (0.3 + 0.3 * random(`${seed}-iy`)) };
  const per = 2 * (w + h);
  const offset = random(`${seed}-off`) * per;
  const ts = Array.from({ length: SHARDS }, (_, k) => offset + ((k + 0.25 + 0.5 * random(`${seed}-t${k}`)) * per) / SHARDS);
  const corners = [0, w, w + h, 2 * w + h];
  const edge = ts.map((t) => perimeterPoint(t, w, h));
  const shards = ts.map((t0, k) => {
    const t1 = k + 1 < ts.length ? ts[k + 1] : ts[0] + per;
    const between = corners
      .flatMap((c) => [c, c + per, c + 2 * per])
      .filter((c) => c > t0 && c < t1)
      .sort((a, b) => a - b)
      .map((c) => perimeterPoint(c, w, h));
    const pts = [impact, perimeterPoint(t0, w, h), ...between, perimeterPoint(t1, w, h)];
    const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    const dx = c.x - impact.x, dy = c.y - impact.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    return {
      pts,
      c,
      dir: { x: dx / len, y: dy / len },
      dist: (0.9 + 0.9 * random(`${seed}-d${k}`)) * w,
      spin: (random(`${seed}-r${k}`) - 0.5) * 520,
      lift: (0.2 + 0.5 * random(`${seed}-l${k}`)) * w,
    };
  });
  return { impact, edge, shards };
}

const GLASS_FILL = "rgba(205,232,255,0.30)";
const GLASS_EDGE = "rgba(255,255,255,0.9)";

export const GlassPane: React.FC<{
  /** Pane size (the card plate). */
  width: number;
  height: number;
  /** Top-left of the pane inside the card. */
  left: number;
  top: number;
  letter: string;
  /** Font size / baseline of the card letter, so the trapped letter sits exactly where the real one lands. */
  fontSize: number;
  bottom: number;
  accent: string;
  /** 0..1: intact pane (frame 0, and as it re-forms over the loop reset). */
  intact: number;
  /** Cracks showing on the intact pane. */
  cracked: boolean;
  /** null = not shattering; 0 → 1 = shards flying. */
  shatter: number | null;
  seed: string;
}> = ({ width: w, height: h, left, top, letter, fontSize, bottom, accent, intact, cracked, shatter, seed }) => {
  const { impact, edge, shards } = useMemo(() => makeShards(w, h, seed), [w, h, seed]);
  const r = Math.min(w, h) * 0.12;
  const stroke = Math.max(2, w * 0.018);

  return (
    <>
      {intact > 0.001 && (
        <>
          {/* the letter, trapped: dim behind the glass */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom,
              textAlign: "center",
              fontFamily: DISPLAY_FONT,
              fontSize,
              lineHeight: 1,
              color: accent,
              opacity: 0.55 * intact,
              textShadow: `0 0 ${fontSize * 0.08}px ${accent}66`,
              pointerEvents: "none",
            }}
          >
            {letter}
          </div>
          <svg width={w} height={h} style={{ position: "absolute", left, top, overflow: "visible", opacity: intact, pointerEvents: "none" }}>
            <defs>
              <linearGradient id={`glass-${seed}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="rgba(235,246,255,0.42)" />
                <stop offset="0.5" stopColor="rgba(190,222,255,0.16)" />
                <stop offset="1" stopColor="rgba(235,246,255,0.30)" />
              </linearGradient>
            </defs>
            <rect x={0} y={0} width={w} height={h} rx={r} fill={`url(#glass-${seed})`} stroke={GLASS_EDGE} strokeWidth={stroke} />
            {/* sheen */}
            <polygon points={`${w * 0.08},${h} ${w * 0.32},${h} ${w * 0.92},0 ${w * 0.68},0`} fill="rgba(255,255,255,0.22)" />
            <polygon points={`${w * 0.42},${h} ${w * 0.5},${h} ${w},${h * 0.18} ${w},${h * 0.02}`} fill="rgba(255,255,255,0.14)" />
            {cracked &&
              edge.map((p, k) => (
                <polyline
                  key={k}
                  points={`${impact.x},${impact.y} ${(impact.x + p.x) / 2 + (random(`${seed}-cj${k}`) - 0.5) * w * 0.08},${(impact.y + p.y) / 2 + (random(`${seed}-ck${k}`) - 0.5) * h * 0.06} ${p.x},${p.y}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={stroke * 0.8}
                  strokeLinejoin="round"
                />
              ))}
            {cracked && <circle cx={impact.x} cy={impact.y} r={w * 0.07} fill="rgba(255,255,255,0.85)" />}
          </svg>
        </>
      )}
      {shatter !== null && shatter < 1 && (
        <svg width={w} height={h} style={{ position: "absolute", left, top, overflow: "visible", pointerEvents: "none" }}>
          {/* white flash where the pane was */}
          <rect x={0} y={0} width={w} height={h} rx={r} fill="#ffffff" opacity={ramp(shatter, [0, 0.12], [0.85, 0])} />
          {shards.map((s, k) => {
            const p = shatter;
            const out = 1 - Math.pow(1 - p, 2); // fast burst, then slowing
            const tx = s.dir.x * s.dist * out;
            const ty = s.dir.y * s.dist * out - s.lift * out + w * 1.6 * p * p; // up a little, then gravity
            const rot = s.spin * p;
            const sc = 1 - 0.35 * p;
            return (
              <polygon
                key={k}
                points={s.pts.map((q) => `${q.x},${q.y}`).join(" ")}
                fill={GLASS_FILL}
                stroke={GLASS_EDGE}
                strokeWidth={stroke}
                strokeLinejoin="round"
                opacity={1 - ramp(p, [0.45, 1], [0, 1])}
                transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${rot.toFixed(1)} ${s.c.x.toFixed(1)} ${s.c.y.toFixed(1)}) translate(${(s.c.x * (1 - sc)).toFixed(1)} ${(s.c.y * (1 - sc)).toFixed(1)}) scale(${sc.toFixed(3)})`}
              />
            );
          })}
        </svg>
      )}
    </>
  );
};
