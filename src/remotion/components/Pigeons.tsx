import React from "react";
import { Easing, interpolate, random, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { DESIGN_WIDTH, TOP_ROW } from "../constants";
import { CLOCK } from "./CountdownTimer";

/** A pigeon leaves the timer every PIGEON_EVERY seconds (5, 10, 15, 20, 25 s). */
export const PIGEON_EVERY = 5;
/** Where pigeons take off: the centre of the countdown timer, in design px. */
const ORIGIN = { x: TOP_ROW.right - CLOCK.width / 2, y: TOP_ROW.top + CLOCK.height / 2 };

type Pt = { x: number; y: number };
type Flight = { seconds: number; c1: Pt; c2: Pt; end: Pt };

/** Alternating flights, lightly varied per pigeon (seeded, so renders are deterministic). */
function flightFor(k: number): Flight {
  const j = (key: string, amp: number) => (random(`pigeon-${k}-${key}`) - 0.5) * 2 * amp;
  if (k % 2 === 0) {
    // long sweep up-left, across the top of the frame
    return {
      seconds: 2.0,
      c1: { x: ORIGIN.x - 260 + j("c1x", 60), y: ORIGIN.y - 360 + j("c1y", 60) },
      c2: { x: 900 + j("c2x", 160), y: 120 + j("c2y", 80) },
      end: { x: -320, y: -60 + j("ey", 120) },
    };
  }
  // short climb out to the right
  return {
    seconds: 1.4,
    c1: { x: ORIGIN.x + 120 + j("c1x", 40), y: ORIGIN.y - 300 + j("c1y", 50) },
    c2: { x: DESIGN_WIDTH - 40 + j("c2x", 60), y: 80 + j("c2y", 60) },
    end: { x: DESIGN_WIDTH + 320, y: -180 + j("ey", 80) },
  };
}

const bezier = (p: number, a: Pt, b: Pt, c: Pt, d: Pt) => {
  const u = 1 - p;
  return {
    x: u * u * u * a.x + 3 * u * u * p * b.x + 3 * u * p * p * c.x + p * p * p * d.x,
    y: u * u * u * a.y + 3 * u * u * p * b.y + 3 * u * p * p * c.y + p * p * p * d.y,
  };
};

/**
 * Pigeons released from the countdown timer. Rendered BEHIND the header, so each
 * one starts tucked behind the timer and flutters out from it. One <Sequence> per pigeon.
 */
export const Pigeons: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const flights: { from: number; k: number; f: Flight }[] = [];
  for (let k = 0, t = PIGEON_EVERY; t * fps < durationInFrames; k++, t += PIGEON_EVERY) {
    const f = flightFor(k);
    const from = Math.round(t * fps);
    // never cross the loop point (the reel must end exactly as it began)
    if (from + Math.round(f.seconds * fps) <= durationInFrames - Math.round(fps * 0.6)) flights.push({ from, k, f });
  }
  return (
    <>
      {flights.map(({ from, k, f }) => (
        <Sequence key={k} name={`pigeon-${k}`} from={from} durationInFrames={Math.round(f.seconds * fps)} layout="none">
          <PigeonFlight flight={f} seed={k} />
        </Sequence>
      ))}
    </>
  );
};

const PigeonFlight: React.FC<{ flight: Flight; seed: number }> = ({ flight, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // Smooth take-off: gentle start, steady cruise, slight acceleration out of frame.
  const p = interpolate(t, [0, flight.seconds], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.35, 0, 0.75, 1) });
  const pos = bezier(p, ORIGIN, flight.c1, flight.c2, flight.end);
  const ahead = bezier(Math.min(1, p + 0.02), ORIGIN, flight.c1, flight.c2, flight.end);
  const dx = ahead.x - pos.x;
  const dy = ahead.y - pos.y;
  const dir = dx < 0 ? -1 : 1;
  // Bank along the path (bird is drawn facing right; flipped when flying left), clamped for a natural pose.
  const along = (Math.atan2(dy, dx * dir) * 180) / Math.PI;
  const bank = Math.max(-38, Math.min(28, along)) * dir;
  // Grows out from behind the timer during take-off.
  const scale = interpolate(t, [0, 0.35], [0.45, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  // Wingbeat: fast at take-off (9 Hz), settling to 6 Hz; per-pigeon phase offset.
  const hz = interpolate(t, [0, 0.5], [9, 6], { extrapolateRight: "clamp" });
  const flap = Math.sin((t * hz + random(`pg-ph-${seed}`)) * Math.PI * 2);
  const opacity = interpolate(t, [0, 0.08], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x - BIRD.w / 2,
        top: pos.y - BIRD.h / 2,
        width: BIRD.w,
        height: BIRD.h,
        opacity,
        transform: `rotate(${bank.toFixed(2)}deg) scale(${(scale * dir).toFixed(3)}, ${scale.toFixed(3)})`,
        filter: "drop-shadow(0 18px 14px rgba(0,0,0,0.45))",
        pointerEvents: "none",
      }}
    >
      <Pigeon flap={flap} />
    </div>
  );
};

const BIRD = { w: 240, h: 150 };

/** Side-view pigeon facing right (viewBox 200 × 125). `flap` -1 (wings down) … 1 (wings up). */
const Pigeon: React.FC<{ flap: number }> = ({ flap }) => {
  const near = -55 * Math.max(0, flap) + 40 * Math.max(0, -flap); // up-stroke higher than down-stroke
  const far = near * 0.85 - 8;
  return (
    <svg viewBox="0 0 200 125" width={BIRD.w} height={BIRD.h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="pgNeck" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fae7d" />
          <stop offset="0.55" stopColor="#7a5a9e" />
          <stop offset="1" stopColor="#8d96a1" />
        </linearGradient>
        <linearGradient id="pgBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9b2bc" />
          <stop offset="1" stopColor="#7c858f" />
        </linearGradient>
      </defs>

      {/* far wing (behind the body) */}
      <g transform={`translate(98 58) rotate(${far.toFixed(1)})`}>
        <Wing shade="#5d6670" />
      </g>

      {/* tail */}
      <path d="M 52 66 L 6 54 L 4 80 L 52 76 Z" fill="#6e7781" />
      <path d="M 20 58 L 6 54 L 4 80 L 18 78 Z" fill="#2d3238" />

      {/* body */}
      <ellipse cx={96} cy={68} rx={54} ry={25} fill="url(#pgBody)" />
      <ellipse cx={104} cy={78} rx={36} ry={13} fill="#c0c7cf" opacity={0.55} />

      {/* tucked feet */}
      <path d="M 92 90 l -6 9 M 100 90 l -4 10" stroke="#d26b6b" strokeWidth={4} strokeLinecap="round" />

      {/* iridescent neck + head */}
      <ellipse cx={138} cy={54} rx={20} ry={17} fill="url(#pgNeck)" />
      <circle cx={155} cy={40} r={15} fill="#8a939d" />
      <circle cx={160} cy={37} r={4} fill="#f08a2a" />
      <circle cx={161} cy={37} r={1.8} fill="#111" />
      {/* beak with white cere */}
      <path d="M 168 40 L 184 44 L 168 47 Z" fill="#3a3a3a" />
      <ellipse cx={168} cy={41} rx={3.5} ry={2.5} fill="#e8e8e8" />

      {/* near wing (in front of the body) */}
      <g transform={`translate(96 56) rotate(${near.toFixed(1)})`}>
        <Wing shade="#8b949e" bars />
      </g>
    </svg>
  );
};

/** Wing hinged at its local origin (the shoulder), sweeping back-and-up. */
const Wing: React.FC<{ shade: string; bars?: boolean }> = ({ shade, bars }) => (
  <g>
    <path d="M 0 0 C -18 -34 -62 -58 -108 -56 C -92 -40 -84 -30 -78 -22 C -60 -14 -36 -4 -6 10 Z" fill={shade} stroke="#4b535c" strokeWidth={2} />
    {/* dark primaries at the tip */}
    <path d="M -108 -56 C -92 -40 -84 -30 -78 -22 L -66 -30 C -74 -40 -86 -52 -108 -56 Z" fill="#2d3238" />
    {bars && (
      <g stroke="#2d3238" strokeWidth={4} strokeLinecap="round">
        <path d="M -24 -10 L -50 -26" />
        <path d="M -16 -2 L -42 -16" />
      </g>
    )}
  </g>
);
