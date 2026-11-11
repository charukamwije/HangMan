import React from "react";
import { random, Sequence, useCurrentFrame } from "remotion";
import { HOOK_FONT } from "../fonts";
import type { HookDecoy } from "../hook";
import { ramp } from "../motion";

/** Crimson strike mark, kept distinct from the theme's neon `wrong` red. */
export const HOOK_RED = "#D32F2F";
/** Aged-parchment ink for the decoy glyphs. */
const PARCHMENT = "#E9DCC4";
/** Cipher glyphs flashed while a slot is "decoding" — no letters, so the scramble can never leak the answer. */
const CIPHER = "0123456789#%&?§†‡¥";

type TileProps = {
  letter: string;
  tile: number;
  /** Strike frame, relative to the pop. */
  strikeAt: number;
  /** Clear frame, relative to the pop (fully gone on this frame). */
  clearAt: number;
};

/**
 * One noise slot: scrambles through cipher glyphs, locks on its decoy letter
 * and is slammed with a crimson ✖. Every value is a pure function of the
 * Sequence-local frame (glyphs come from remotion's seeded random()).
 */
export const DecoyTile: React.FC<TileProps> = ({ letter, tile, strikeAt, clearAt }) => {
  const f = useCurrentFrame();
  // Pop 0 → 1.2 → 1.0 over 3 frames, read one frame ahead so the pop frame
  // already shows the glyph mid-punch (frame 0 is never blank).
  const scale = ramp(f + 1, [0, 1.5, 3], [0, 1.2, 1]);
  const s = f - strikeAt;
  const struck = s >= 0;
  const glyph = struck ? letter : CIPHER[Math.floor(random(`cipher-${letter}-${f}`) * CIPHER.length)];
  const jitterY = struck ? 0 : (random(`jit-${letter}-${f}`) - 0.5) * tile * 0.16;
  // Strike: ✖ lands oversized and slams down; the letter gets a white impact flash.
  const strikeScale = ramp(s, [0, 2], [2.2, 1]);
  const strikeOpacity = ramp(s, [0, 1], [0.5, 1]);
  const impact = struck ? ramp(s, [0, 3], [1, 0]) : 0;
  // Wipe: half-faded on the last frame, unmounted (gone) on the clear frame.
  const fade = ramp(f, [clearAt - 2, clearAt], [1, 0]);
  const thick = Math.max(8, tile * 0.085);
  const bar = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: tile * 0.95,
    height: thick,
    marginLeft: -tile * 0.475,
    marginTop: -thick / 2,
    borderRadius: 99,
    background: HOOK_RED,
    boxShadow: `0 0 0 ${Math.max(2, thick * 0.25)}px rgba(0,0,0,0.75), 0 0 ${tile * (0.15 + 0.35 * impact)}px ${HOOK_RED}`,
  } as const;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade, pointerEvents: "none" }}>
      {/* crimson wash inside the slot plate on impact */}
      {impact > 0 && <div style={{ position: "absolute", inset: `${tile * 0.06}px 0 ${tile * 0.16}px`, borderRadius: tile * 0.14, background: HOOK_RED, opacity: 0.45 * impact }} />}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: tile * 0.3,
          textAlign: "center",
          fontFamily: HOOK_FONT,
          fontWeight: 900,
          fontSize: tile * 0.92,
          lineHeight: 1,
          color: struck ? PARCHMENT : "#f6efe0",
          opacity: struck ? 0.9 : 0.75,
          // cipher frames get an RGB split so the slot reads as "decoding"
          textShadow: struck
            ? `0 4px 0 rgba(0,0,0,0.55), 0 0 ${18 + 40 * impact}px rgba(255,255,255,${0.6 * impact})`
            : `${tile * 0.04}px 0 0 ${HOOK_RED}cc, ${-tile * 0.04}px 0 0 #3fd6ffaa, 0 0 18px rgba(0,0,0,0.6)`,
          transform: `translateY(${jitterY}px) scale(${scale})`,
        }}
      >
        {glyph}
      </div>
      {/* ✖ drawn as two bars — no dependency on the font having the glyph. */}
      {struck && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: tile * 0.2, opacity: strikeOpacity, transform: `scale(${strikeScale})` }}>
          <div style={{ ...bar, transform: "rotate(45deg)" }} />
          <div style={{ ...bar, transform: "rotate(-45deg)" }} />
        </div>
      )}
    </div>
  );
};

/**
 * Frame mapping for one slot's decoys: each lives in its own <Sequence>,
 * mounted from its pop frame until the next decoy takes the slot (or the clear).
 */
export const HookDecoys: React.FC<{ decoys: HookDecoy[]; tile: number }> = ({ decoys, tile }) => (
  <>
    {decoys
      .filter((d) => d.endFrame > d.popFrame)
      .map((d) => (
        <Sequence key={d.id} name={`decoy-${d.id}-${d.letter}`} from={d.popFrame} durationInFrames={d.endFrame - d.popFrame} layout="none">
          <DecoyTile letter={d.letter} tile={tile} strikeAt={d.strikeFrame - d.popFrame} clearAt={d.endFrame - d.popFrame} />
        </Sequence>
      ))}
  </>
);

/**
 * Decoder scan over the whole word board during phase 1: CRT scanlines plus a
 * crimson beam that ping-pongs across it (one pass per SWEEP frames), cut on clear.
 */
const SWEEP = 10;
export const DecodeScan: React.FC<{ clearFrame: number; tile: number }> = ({ clearFrame, tile }) => {
  const frame = useCurrentFrame();
  if (frame >= clearFrame) return null;
  const pass = Math.floor(frame / SWEEP);
  const p = (frame % SWEEP) / SWEEP;
  const x = pass % 2 === 0 ? -10 + 120 * p : 110 - 120 * p;
  const flicker = 0.75 + 0.25 * random(`scan-${frame}`);
  const fade = ramp(frame, [clearFrame - 2, clearFrame], [1, 0]);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: -tile * 0.15, bottom: -tile * 0.1, pointerEvents: "none", opacity: fade, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.3 * flicker,
          background: `repeating-linear-gradient(180deg, rgba(0,0,0,0.9) 0 4px, transparent 4px 10px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${x}%`,
          width: tile * 1.6,
          marginLeft: -tile * 0.8,
          background: `linear-gradient(90deg, transparent, ${HOOK_RED}55 35%, #ffd9d9cc 50%, ${HOOK_RED}55 65%, transparent)`,
          mixBlendMode: "screen",
          opacity: flicker,
        }}
      />
    </div>
  );
};
