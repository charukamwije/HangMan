import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";
import { framesSinceLast, NEVER, ramp, strikeShake } from "../motion";
import { SAFE_WIDTH, SAFE_ZONE } from "../constants";
import type { HookPlan } from "../hook";
import { DecodeScan, HookDecoys } from "./OpeningHook";

const MAX_LINE = 12;
/** Tiles + gaps must fit inside the platform safe area with a 40px margin each side. */
const AVAILABLE_WIDTH = SAFE_WIDTH - 80;

/** Greedy word-wrap of the answer into lines of ≤ MAX_LINE characters. */
function layoutLines(word: string) {
  const lines: { text: string; start: number }[] = [];
  let cursor = 0;
  let current = "";
  let currentStart = 0;
  for (const w of word.split(" ")) {
    const candidate = current ? `${current} ${w}` : w;
    if (current && candidate.length > MAX_LINE) {
      lines.push({ text: current, start: currentStart });
      current = w;
      currentStart = cursor;
    } else {
      current = candidate;
    }
    cursor += w.length + 1;
  }
  if (current) lines.push({ text: current, start: currentStart });
  return lines;
}

export function measureWordBoard(word: string) {
  const lines = layoutLines(word);
  const longest = Math.max(...lines.map((l) => l.text.length), 1);
  const tile = Math.min(200, Math.floor(AVAILABLE_WIDTH / (longest * 1.14)));
  const lineHeight = tile * 1.55;
  return { lines, tile, gap: Math.round(tile * 0.14), lineHeight, height: lines.length * lineHeight + (lines.length - 1) * tile * 0.25 };
}

/**
 * Word slots with progressive letter reveals. Every slot (= the full word
 * length) is on screen from frame 0. During the opening hook, decoy letters
 * are struck out in empty slots and the hint letter snaps in with a stiff
 * spring (settled by frame 30). Later letters "pop" in with a softer spring
 * and a luminescent flash that settles into a soft neon glow.
 */
export const WordBoard: React.FC<{ theme: Theme; word: string; revealFrames: number[]; finalRevealFrame: number; top: number; hook: HookPlan }> = ({
  theme,
  word,
  revealFrames,
  finalRevealFrame,
  top,
  hook,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { lines, tile, gap, lineHeight } = useMemo(() => measureWordBoard(word), [word]);
  const decoysBySlot = useMemo(() => {
    const bySlot = new Map<number, HookPlan["decoys"]>();
    for (const d of hook.decoys) bySlot.set(d.slot, [...(bySlot.get(d.slot) ?? []), d]);
    return bySlot;
  }, [hook]);

  // Each hook ✖ kicks the whole board sideways and punches it down a touch.
  const sinceStrike = frame < hook.clearFrame ? framesSinceLast(hook.strikeFrames, frame) : NEVER;
  const kickX = strikeShake(sinceStrike, fps, tile * 0.12);
  const kickScale = 1 - 0.025 * ramp(sinceStrike, [0, 4], [1, 0]);

  const solved = frame >= finalRevealFrame;
  const sinceSolved = (frame - finalRevealFrame) / fps;
  const celebrate = solved ? spring({ frame: frame - finalRevealFrame - Math.round(0.17 * fps), fps, config: { damping: 8, stiffness: 90 } }) : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_ZONE.left,
        right: SAFE_ZONE.right,
        top,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tile * 0.25,
        transform: kickX || kickScale !== 1 ? `translateX(${kickX.toFixed(2)}px) scale(${kickScale})` : undefined,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", gap, height: lineHeight, alignItems: "flex-end" }}>
          {line.text.split("").map((ch, ci) => {
            const idx = line.start + ci;
            if (ch === " ") return <div key={ci} style={{ width: tile * 0.5 }} />;

            const at = revealFrames[idx];
            const since = frame - at;
            const shown = since >= 0;
            // Hook snaps are mechanical (stiff, ≤ 5 frames to settle); guesses keep the floaty pop.
            const snap = hook.snapFrames.has(idx);
            const pop = shown ? spring({ frame: since, fps, config: snap ? { damping: 18, stiffness: 420, mass: 0.5 } : { damping: 11, stiffness: 300, mass: 0.7 } }) : 0;
            // Guess reveals slam DOWN from above and oversized; a shockwave ring leaves the slot.
            const slamFrom = snap ? { y: tile * 0.5, s: 1.6 } : { y: -tile * 0.9, s: 2.6 };
            const ring = shown && !snap ? ramp(since / fps, [0, 0.45], [0, 1]) : 1;
            const flash = shown ? ramp(since / fps, snap ? [0, 0.03, 0.4] : [0, 0.1, 0.67], [0, 1, 0]) : 0;
            const decoys = decoysBySlot.get(idx);
            const wave = solved ? Math.max(0, Math.sin(sinceSolved * 6.7 - idx * 0.5)) * 0.25 : 0;
            const glow = 18 + 60 * flash + 30 * wave;

            return (
              <div key={ci} style={{ position: "relative", width: tile, height: lineHeight, transform: `scale(${1 + celebrate * 0.04})` }}>
                {ring < 1 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: `${tile * 0.06}px 0 ${tile * 0.16}px`,
                      borderRadius: tile * 0.14,
                      border: `${Math.max(4, tile * 0.08 * (1 - ring))}px solid ${theme.accent}`,
                      boxShadow: `0 0 ${tile * 0.4}px ${theme.accent}`,
                      transform: `scale(${1 + ring * 1.1})`,
                      opacity: 1 - ring,
                    }}
                  />
                )}
                {/* slot plate */}
                <div
                  style={{
                    position: "absolute",
                    inset: `${tile * 0.06}px 0 ${tile * 0.16}px`,
                    borderRadius: tile * 0.14,
                    background: `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55))`,
                    border: `2px solid rgba(255,255,255,${0.06 + flash * 0.3})`,
                    boxShadow: flash ? `0 0 ${80 * flash}px ${theme.accent}66, inset 0 0 ${60 * flash}px ${theme.accent}55` : undefined,
                  }}
                />
                {decoys && frame < hook.clearFrame && <HookDecoys decoys={decoys} tile={tile} />}
                {/* letter */}
                {shown && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: tile * 0.26,
                      textAlign: "center",
                      fontFamily: DISPLAY_FONT,
                      fontSize: tile * 1.08,
                      lineHeight: 1,
                      color: flash > 0.5 ? "#ffffff" : theme.accent,
                      textShadow: `0 0 ${glow * 0.4}px ${theme.accent}, 0 0 ${glow}px ${theme.accent}aa, 0 0 ${glow * 2}px ${theme.accent}55`,
                      transform: `translateY(${interpolate(pop, [0, 1], [slamFrom.y, 0])}px) scale(${interpolate(pop, [0, 1], [slamFrom.s, 1])})`,
                      opacity: Math.min(1, pop * 1.5),
                    }}
                  >
                    {ch}
                  </div>
                )}
                {/* neon underscore */}
                <div
                  style={{
                    position: "absolute",
                    left: tile * 0.06,
                    right: tile * 0.06,
                    bottom: tile * 0.06,
                    height: Math.max(10, tile * 0.075),
                    borderRadius: 99,
                    background: theme.accent,
                    boxShadow: `0 0 ${16 + 40 * flash}px ${theme.accent}, 0 0 ${50 + 60 * flash}px ${theme.accent}77`,
                    opacity: shown ? 1 : 0.72 + 0.18 * Math.sin(t * 4.3 + idx),
                  }}
                />
              </div>
            );
          })}
        </div>
      ))}
      <DecodeScan clearFrame={hook.clearFrame} tile={tile} />
    </div>
  );
};
