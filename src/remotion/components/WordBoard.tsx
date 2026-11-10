import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import { DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";

const MAX_LINE = 12;
const AVAILABLE_WIDTH = 1920;

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
 * length) is on screen from frame 0, and the hint letter is already settled
 * there (its reveal frame is negative). Later letters "pop" in with a spring
 * and a luminescent flash that settles into a soft neon glow.
 */
export const WordBoard: React.FC<{ theme: Theme; word: string; revealFrames: number[]; finalRevealFrame: number; top: number }> = ({
  theme,
  word,
  revealFrames,
  finalRevealFrame,
  top,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { lines, tile, gap, lineHeight } = useMemo(() => measureWordBoard(word), [word]);

  const solved = frame >= finalRevealFrame;
  const sinceSolved = (frame - finalRevealFrame) / fps;
  const celebrate = solved ? spring({ frame: frame - finalRevealFrame - Math.round(0.17 * fps), fps, config: { damping: 8, stiffness: 90 } }) : 0;

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", flexDirection: "column", alignItems: "center", gap: tile * 0.25 }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", gap, height: lineHeight, alignItems: "flex-end" }}>
          {line.text.split("").map((ch, ci) => {
            const idx = line.start + ci;
            if (ch === " ") return <div key={ci} style={{ width: tile * 0.5 }} />;

            const at = revealFrames[idx];
            const since = frame - at;
            const shown = since >= 0;
            const pop = shown ? spring({ frame: since, fps, config: { damping: 9, stiffness: 160, mass: 0.8 } }) : 0;
            const flash = shown ? ramp(since / fps, [0, 0.1, 0.67], [0, 1, 0]) : 0;
            const wave = solved ? Math.max(0, Math.sin(sinceSolved * 6.7 - idx * 0.5)) * 0.25 : 0;
            const glow = 18 + 60 * flash + 30 * wave;

            return (
              <div key={ci} style={{ position: "relative", width: tile, height: lineHeight, transform: `scale(${1 + celebrate * 0.04})` }}>
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
                      transform: `translateY(${interpolate(pop, [0, 1], [tile * 0.5, 0])}px) scale(${interpolate(pop, [0, 1], [1.6, 1])})`,
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
    </div>
  );
};
