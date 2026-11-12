import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT } from "../fonts";
import { ramp } from "../motion";
import { KEYBOARD_HEIGHT } from "./Keyboard";

/**
 * A little library chair in the gap left of the keyboard's two short bottom rows.
 * Once per video one character (picked from the answer, so a puzzle always gets
 * the same one) walks in, sits, says a line in a speech bubble, then leaves.
 *
 * All three characters are ORIGINAL designs (no third-party cartoon characters).
 * The visit sits between 8.0 s and 14.6 s, so frame 0 and the loop point always
 * show the empty chair, and it finishes before the 15 s hint switch.
 */
export const CAST_VISIT = { at: 8.0, walkIn: 0.9, sit: 0.35, talk: 4.4, stand: 0.3, walkOut: 0.75 } as const;

type CastId = "biscuit" | "marigold" | "pip";
const CAST: Record<CastId, { line: string }> = {
  biscuit: { line: "Can't guess this? How will you ever fetch my snacks? Subscribe & learn something!" },
  marigold: { line: "You don't know this?! Less time bothering the neighbours — subscribe and learn something!" },
  pip: { line: "I subscribed, that's why I know everything. Want to learn? Subscribe!" },
};
const IDS: CastId[] = ["biscuit", "marigold", "pip"];
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
export const castFor = (word: string): CastId => IDS[hash(word) % IDS.length];

// Geometry (design px). The floor is the bottom of the keyboard's last key row.
const KB_PAD = 44;
const CHAIR_X = 150; // chair seat spans 150 → 270, back on the left
const SEAT_W = 120;
const SEAT_H = 78; // seat height above the floor (= the characters' leg length)
const HIP_X = CHAIR_X + SEAT_W / 2 + 6;
/** Character box (viewBox 0 0 160 260): hips at (70, 180), floor at y 258. */
const BOX = { w: 160, h: 260, hipX: 70, hipY: 180, floor: 258 };

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

  // position (hip x on the stage) and pose
  const offX = -260;
  const hipX = !visiting
    ? offX
    : t < tIn
      ? interpolate(t, [v.at, tIn], [offX, HIP_X], { easing: Easing.out(Easing.cubic) })
      : t < tUp
        ? HIP_X
        : interpolate(t, [tUp, tGone], [HIP_X, offX], { easing: Easing.in(Easing.cubic) });
  const walking = (t >= v.at && t < tIn) || (t >= tUp && t < tGone);
  const sit = visiting ? ramp(t, [tIn, tSat, tTalkEnd, tUp], [0, 1, 1, 0]) : 0;
  const stepPhase = (hipX / 40) * Math.PI;
  const facing = t >= tUp ? -1 : 1; // turns around to leave
  const talking = t >= tSat && t < tTalkEnd;
  const mouth = talking ? Math.abs(Math.sin(t * 16)) : 0;

  // speech bubble: pops in after sitting, types the line out, pops away before standing
  const line = CAST[id].line;
  const bubbleT = t - (tSat + 0.05);
  const pop = bubbleT >= 0 ? spring({ frame: Math.round(bubbleT * fps), fps, config: { damping: 10, stiffness: 220, mass: 0.6 } }) : 0;
  const typed = Math.floor(line.length * ramp(bubbleT, [0.15, 2.2], [0, 1]));
  const bubbleOut = ramp(t, [tTalkEnd - 0.2, tTalkEnd], [1, 0]);

  const boxLeft = hipX - BOX.hipX;
  const boxTop = floorY - BOX.floor;

  return (
    <>
      <Chair x={CHAIR_X} floorY={floorY} />
      {visiting && (
        <div
          style={{
            position: "absolute",
            left: boxLeft,
            top: boxTop + (walking ? -Math.abs(Math.sin(stepPhase)) * 5 : 0),
            width: BOX.w,
            height: BOX.h,
            transform: facing < 0 ? "scaleX(-1)" : undefined,
            transformOrigin: `${BOX.hipX}px 50%`,
            filter: "drop-shadow(0 10px 10px rgba(0,0,0,0.55))",
          }}
        >
          <Character id={id} sit={sit} step={walking ? stepPhase : 0} mouth={mouth} />
        </div>
      )}
      {visiting && pop > 0.01 && bubbleOut > 0 && (
        <Bubble x={HIP_X + 40} y={boxTop + 40} pop={pop} opacity={bubbleOut} line={line} typed={typed} />
      )}
    </>
  );
};

/* ------------------------------------------------------------ chair */

const Chair: React.FC<{ x: number; floorY: number }> = ({ x, floorY }) => {
  const seatY = floorY - SEAT_H;
  return (
    <svg
      width={SEAT_W + 40}
      height={SEAT_H + 160}
      viewBox={`0 0 ${SEAT_W + 40} ${SEAT_H + 160}`}
      style={{ position: "absolute", left: x - 20, top: seatY - 150, overflow: "visible", filter: "drop-shadow(0 8px 8px rgba(0,0,0,0.6))" }}
    >
      <defs>
        <linearGradient id="chairWood" x1="0" x2="1">
          <stop offset="0" stopColor="#4a2b14" />
          <stop offset="0.5" stopColor="#8a5a2c" />
          <stop offset="1" stopColor="#4a2b14" />
        </linearGradient>
      </defs>
      {/* back legs + back rest (on the left) */}
      <rect x={20} y={20} width={14} height={SEAT_H + 140} rx={4} fill="url(#chairWood)" />
      <rect x={14} y={14} width={26} height={12} rx={5} fill="#5a3518" />
      {[50, 82].map((y) => (
        <rect key={y} x={24} y={y} width={8} height={26} rx={3} fill="#3a2210" />
      ))}
      <rect x={26} y={40} width={34} height={10} rx={4} fill="url(#chairWood)" transform="rotate(8 26 40)" />
      {/* seat */}
      <path d={`M 18 150 L ${SEAT_W + 26} 150 L ${SEAT_W + 18} 166 L 22 166 Z`} fill="#a06a35" stroke="#3a2210" strokeWidth={3} />
      <rect x={18} y={166} width={SEAT_W + 6} height={10} fill="#5a3518" />
      {/* front legs */}
      <rect x={SEAT_W + 6} y={170} width={12} height={SEAT_H - 18} rx={4} fill="url(#chairWood)" />
      <rect x={34} y={170} width={10} height={SEAT_H - 20} rx={4} fill="#4a2b14" opacity={0.8} />
      <rect x={30} y={SEAT_H + 116} width={SEAT_W - 8} height={6} rx={3} fill="#3a2210" opacity={0.8} />
    </svg>
  );
};

/* ------------------------------------------------------------ characters */

/**
 * Shared rig in viewBox 0 0 160 260: hips at (70,180), floor at 258.
 * `sit` 0 = standing legs straight down, 1 = thighs forward on the seat, shins down.
 */
const Legs: React.FC<{ sit: number; step: number; color: string; shoe: string; width?: number }> = ({ sit, step, color, shoe, width = 16 }) => {
  const leg = (dx: number, swing: number, key: string) => {
    const hip = { x: 70 + dx, y: 180 };
    // standing: knee straight below (swinging with the step); sitting: knee forward on the seat
    const kneeStand = { x: hip.x + Math.sin(swing) * 14, y: 219 };
    const kneeSit = { x: hip.x + 40, y: 184 };
    const knee = { x: kneeStand.x + (kneeSit.x - kneeStand.x) * sit, y: kneeStand.y + (kneeSit.y - kneeStand.y) * sit };
    const foot = { x: knee.x + Math.sin(swing) * 6 * (1 - sit) + 4 * sit, y: 252 };
    return (
      <g key={key}>
        <path d={`M ${hip.x} ${hip.y} L ${knee.x} ${knee.y} L ${foot.x} ${foot.y}`} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx={foot.x + 7} cy={254} rx={13} ry={6} fill={shoe} />
      </g>
    );
  };
  return (
    <g>
      {leg(-8, -step, "back")}
      {leg(8, step, "front")}
    </g>
  );
};

const Character: React.FC<{ id: CastId; sit: number; step: number; mouth: number }> = ({ id, sit, step, mouth }) => {
  const swingArm = Math.sin(step) * 10 * (1 - sit);
  return (
    <svg viewBox="0 0 160 260" width={BOX.w} height={BOX.h} style={{ overflow: "visible" }}>
      {id === "biscuit" && <Biscuit sit={sit} step={step} mouth={mouth} arm={swingArm} />}
      {id === "marigold" && <Marigold sit={sit} step={step} mouth={mouth} arm={swingArm} />}
      {id === "pip" && <Pip sit={sit} step={step} mouth={mouth} arm={swingArm} />}
    </svg>
  );
};

type PartProps = { sit: number; step: number; mouth: number; arm: number };

/** Biscuit: a round grey cat with a knitted red-and-cream scarf and sleepy eyes. */
const Biscuit: React.FC<PartProps> = ({ sit, step, mouth, arm }) => (
  <g>
    <path d="M 38 176 C 4 170 6 128 24 120" stroke="#7d828c" strokeWidth={12} fill="none" strokeLinecap="round" />
    <Legs sit={sit} step={step} color="#8d929c" shoe="#e9e4ea" width={18} />
    <ellipse cx={72} cy={150} rx={44} ry={42} fill="#9aa0aa" stroke="#4d5058" strokeWidth={3} />
    <ellipse cx={78} cy={158} rx={26} ry={28} fill="#d9dbe0" />
    <path d={`M 104 136 Q ${120 + arm} 150 ${114 + arm} 170`} stroke="#8d929c" strokeWidth={14} fill="none" strokeLinecap="round" />
    {/* scarf */}
    <path d="M 40 106 Q 74 124 108 104 L 110 118 Q 74 136 40 120 Z" fill="#c43a35" />
    {[50, 66, 82, 98].map((x) => (
      <rect key={x} x={x} y={110} width={6} height={12} fill="#f1e3c8" opacity={0.85} />
    ))}
    <path d="M 52 118 L 46 150 L 60 150 L 62 122 Z" fill="#c43a35" />
    {/* head */}
    <path d="M 40 50 L 46 18 L 66 40 Z" fill="#9aa0aa" stroke="#4d5058" strokeWidth={3} />
    <path d="M 104 50 L 100 18 L 80 40 Z" fill="#9aa0aa" stroke="#4d5058" strokeWidth={3} />
    <path d="M 48 44 L 50 28 L 60 40 Z M 96 44 L 94 28 L 86 40 Z" fill="#e8a5b0" />
    <ellipse cx={74} cy={70} rx={40} ry={36} fill="#9aa0aa" stroke="#4d5058" strokeWidth={3} />
    <path d="M 58 44 L 62 54 M 74 40 L 74 52 M 90 44 L 86 54" stroke="#6f747e" strokeWidth={3} strokeLinecap="round" />
    {/* sleepy, unimpressed eyes */}
    <ellipse cx={60} cy={68} rx={9} ry={7} fill="#f6f0c8" />
    <ellipse cx={90} cy={68} rx={9} ry={7} fill="#f6f0c8" />
    <circle cx={62} cy={70} r={4} fill="#20232a" />
    <circle cx={92} cy={70} r={4} fill="#20232a" />
    <path d="M 50 64 L 70 64 M 80 64 L 100 64" stroke="#4d5058" strokeWidth={4} strokeLinecap="round" />
    <path d="M 72 80 L 78 80 L 75 84 Z" fill="#e2708a" />
    <ellipse cx={75} cy={90} rx={6} ry={2 + 5 * mouth} fill="#5a1a22" />
    <g stroke="#3d4048" strokeWidth={1.6}>
      <path d="M 54 84 L 30 80 M 54 88 L 30 92 M 96 84 L 120 80 M 96 88 L 120 92" />
    </g>
  </g>
);

/** Mrs. Marigold: a mum with a chestnut bun, blue dress, polka-dot apron and a wooden spoon. */
const Marigold: React.FC<PartProps> = ({ sit, step, mouth, arm }) => (
  <g>
    <Legs sit={sit} step={step} color="#f0c8a6" shoe="#7a3b2a" width={13} />
    <path d="M 40 120 L 104 120 L 116 190 L 28 190 Z" fill="#3f6fb5" stroke="#23406b" strokeWidth={3} />
    <path d="M 52 128 L 94 128 L 102 188 L 44 188 Z" fill="#fff6ea" stroke="#d9c4a5" strokeWidth={2} />
    {[
      [62, 145],
      [82, 140],
      [72, 165],
      [90, 172],
      [56, 178],
    ].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill="#e46a8a" />
    ))}
    {/* spoon arm */}
    <path d={`M 104 128 Q ${126 + arm} 138 ${124 + arm} 156`} stroke="#3f6fb5" strokeWidth={12} fill="none" strokeLinecap="round" />
    <circle cx={124 + arm} cy={158} r={7} fill="#f0c8a6" />
    <g transform={`translate(${124 + arm} 158) rotate(-30)`}>
      <rect x={-3} y={-58} width={6} height={56} rx={3} fill="#b07a42" />
      <ellipse cx={0} cy={-64} rx={9} ry={12} fill="#c48a4e" />
    </g>
    {/* head */}
    <circle cx={72} cy={22} r={18} fill="#7a3f22" />
    <ellipse cx={72} cy={68} rx={34} ry={38} fill="#f3cfaf" stroke="#b07a5a" strokeWidth={2} />
    <path d="M 38 66 Q 40 30 72 30 Q 104 30 106 66 Q 96 46 72 46 Q 48 46 38 66 Z" fill="#8a4626" />
    <circle cx={60} cy={70} r={4.5} fill="#2a1a12" />
    <circle cx={86} cy={70} r={4.5} fill="#2a1a12" />
    <path d="M 52 60 Q 60 56 68 60 M 78 60 Q 86 56 94 60" stroke="#6a3418" strokeWidth={3} fill="none" strokeLinecap="round" />
    <circle cx={52} cy={84} r={6} fill="#f0a0a0" opacity={0.6} />
    <circle cx={94} cy={84} r={6} fill="#f0a0a0" opacity={0.6} />
    <ellipse cx={73} cy={90} rx={7} ry={2 + 5 * mouth} fill="#8a2a2a" />
  </g>
);

/** Pip: a bookworm with two braids, round glasses, a teal cardigan and a stack of books. */
const Pip: React.FC<PartProps> = ({ sit, step, mouth, arm }) => (
  <g>
    <Legs sit={sit} step={step} color="#3a3550" shoe="#2a2420" width={13} />
    <path d="M 44 160 L 100 160 L 110 192 L 34 192 Z" fill="#6d4c8f" />
    <path d="M 44 112 L 100 112 L 104 166 L 40 166 Z" fill="#2f9c8f" stroke="#1d6a61" strokeWidth={3} />
    <path d="M 72 112 L 72 166" stroke="#1d6a61" strokeWidth={2} />
    {[124, 138, 152].map((y) => (
      <circle key={y} cx={76} cy={y} r={2.5} fill="#f2e6c9" />
    ))}
    {/* books in the arm */}
    <g transform={`translate(${112 + arm * 0.5} 132)`}>
      <rect x={-6} y={0} width={34} height={10} fill="#c0392b" />
      <rect x={-4} y={10} width={30} height={10} fill="#2c6fb0" />
      <rect x={-6} y={20} width={34} height={10} fill="#d9a62e" />
    </g>
    <path d="M 100 120 Q 120 126 118 146" stroke="#2f9c8f" strokeWidth={12} fill="none" strokeLinecap="round" />
    {/* braids */}
    <path d="M 40 64 Q 30 100 34 126" stroke="#6b3f1f" strokeWidth={11} fill="none" strokeLinecap="round" strokeDasharray="7 3" />
    <path d="M 104 64 Q 114 100 110 126" stroke="#6b3f1f" strokeWidth={11} fill="none" strokeLinecap="round" strokeDasharray="7 3" />
    <circle cx={34} cy={128} r={5} fill="#e05a7a" />
    <circle cx={110} cy={128} r={5} fill="#e05a7a" />
    {/* head */}
    <ellipse cx={72} cy={66} rx={32} ry={36} fill="#f0c9a4" stroke="#b07a5a" strokeWidth={2} />
    <path d="M 40 62 Q 42 28 72 28 Q 102 28 104 62 Q 90 40 72 44 Q 56 40 40 62 Z" fill="#7a4722" />
    <circle cx={60} cy={70} r={11} fill="#ffffff" fillOpacity={0.25} stroke="#3a2a20" strokeWidth={3} />
    <circle cx={86} cy={70} r={11} fill="#ffffff" fillOpacity={0.25} stroke="#3a2a20" strokeWidth={3} />
    <path d="M 71 70 L 75 70" stroke="#3a2a20" strokeWidth={3} />
    <circle cx={61} cy={71} r={3.5} fill="#2a1a12" />
    <circle cx={87} cy={71} r={3.5} fill="#2a1a12" />
    <path d="M 54 86 Q 56 84 58 86 M 86 86 Q 88 84 90 86" stroke="#c98a6a" strokeWidth={2} fill="none" />
    <path d={`M 64 92 Q 73 ${96 + 5 * mouth} 82 92`} stroke="#8a2a2a" strokeWidth={3} fill={mouth > 0.3 ? "#8a2a2a" : "none"} strokeLinecap="round" />
  </g>
);

/* ------------------------------------------------------------ bubble */

/** Speech bubble whose tail points down-left at (x, y); the line types itself out. */
const Bubble: React.FC<{ x: number; y: number; pop: number; opacity: number; line: string; typed: number }> = ({ x, y, pop, opacity, line, typed }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `translateY(-100%) scale(${(0.3 + 0.7 * pop).toFixed(3)})`,
      transformOrigin: "0% 100%",
      opacity,
      pointerEvents: "none",
      zIndex: 6,
    }}
  >
    <div
      style={{
        position: "relative",
        width: 560,
        marginLeft: 24,
        marginBottom: 34,
        padding: "22px 30px 24px",
        borderRadius: 36,
        background: "#ffffff",
        border: "5px solid #141414",
        boxShadow: "0 12px 26px rgba(0,0,0,0.55)",
        fontFamily: BODY_FONT,
        fontWeight: 800,
        fontSize: 40,
        lineHeight: 1.22,
        color: "#1b1b1b",
      }}
    >
      {/* full line laid out invisibly, typed part drawn on top: the bubble never resizes */}
      <span style={{ visibility: "hidden" }}>{line}</span>
      <span style={{ position: "absolute", left: 30, right: 30, top: 22 }}>
        {line.slice(0, typed)}
      </span>
      <svg width={52} height={44} viewBox="0 0 52 44" style={{ position: "absolute", left: 14, bottom: -40, overflow: "visible" }}>
        <path d="M 6 0 L 2 42 L 36 0 Z" fill="#ffffff" stroke="#141414" strokeWidth={5} strokeLinejoin="round" />
        <rect x={4} y={-8} width={36} height={11} fill="#ffffff" />
      </svg>
    </div>
  </div>
);
