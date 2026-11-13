import React, { useMemo } from "react";
import { AbsoluteFill, random } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import type { Theme } from "../themes";

/* Layout (design px, 2160 × 3840). Windows sit behind the header + board; the bookcase behind the keys. */
const WIN_COUNT = 3;
const WIN_W = 520;
const WIN_GAP = 120;
const WIN_LEFT = (DESIGN_WIDTH - (WIN_COUNT * WIN_W + (WIN_COUNT - 1) * WIN_GAP)) / 2;
const WIN_TOP = 240;
const WIN_H = 2480;
const FRAME = 34;
const RAIL_Y = 2930;
const CASE_TOP = 3000;
const CASE_SHELF = 410;

/**
 * Daylight scene for light themes: a cream panelled wall with three tall arched
 * windows, soft sun shafts falling across the room, and a low painted bookcase.
 * `t` drives the slow beam shimmer; `back` (loop reset 0→1) eases it to its frame-0 state.
 */
export const LightRoom: React.FC<{ theme: Theme; t: number; back: number }> = ({ theme, t, back }) => {
  const room = theme.room;
  const books = useCaseBooks(theme);
  const shimmer = (phase: number) => {
    const live = 0.85 + 0.15 * Math.sin(t * 0.7 + phase);
    const start = 0.85 + 0.15 * Math.sin(phase);
    return live * (1 - back) + start * back;
  };

  return (
    <AbsoluteFill>
      {/* wall + vertical panelling */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(90deg, transparent 0 236px, rgba(${theme.shade},0.05) 236px 240px, rgba(255,255,255,0.35) 240px 243px), linear-gradient(180deg, ${theme.wood[0]} 0%, ${theme.wood[1]} 70%, ${theme.wood[2]} 100%)`,
        }}
      />

      {/* arched windows */}
      {Array.from({ length: WIN_COUNT }, (_, i) => {
        const x = WIN_LEFT + i * (WIN_W + WIN_GAP);
        const inner = WIN_W - FRAME * 2;
        const rect = WIN_H - FRAME * 2 - inner / 2; // straight part below the arch
        return (
          <React.Fragment key={i}>
            {/* reveal shadow + painted frame */}
            <div
              style={{
                position: "absolute",
                left: x,
                top: WIN_TOP,
                width: WIN_W,
                height: WIN_H,
                borderRadius: `${WIN_W / 2}px ${WIN_W / 2}px 6px 6px`,
                background: room.trim,
                boxShadow: `0 0 0 14px rgba(${theme.shade},0.06), 0 30px 60px rgba(${theme.shade},0.18)`,
              }}
            />
            {/* glass: sky, sun, foliage */}
            <div
              style={{
                position: "absolute",
                left: x + FRAME,
                top: WIN_TOP + FRAME,
                width: inner,
                height: WIN_H - FRAME * 2,
                borderRadius: `${inner / 2}px ${inner / 2}px 2px 2px`,
                overflow: "hidden",
                background: `radial-gradient(700px 600px at ${80 + i * 140}% 12%, ${theme.lamp}, transparent 70%), linear-gradient(180deg, ${room.sky[0]} 0%, ${room.sky[1]} 70%, ${room.sky[1]} 100%)`,
              }}
            >
              {[0, 1, 2, 3].map((k) => (
                <div
                  key={k}
                  style={{
                    position: "absolute",
                    left: -160 + k * 150 + random(`leaf-${i}-${k}`) * 60,
                    top: WIN_H * 0.62 + random(`leafy-${i}-${k}`) * 260,
                    width: 360,
                    height: 520,
                    borderRadius: "50%",
                    background: room.foliage,
                    opacity: 0.55,
                    filter: "blur(30px)",
                  }}
                />
              ))}
              {/* mullions: centre bar + three transoms */}
              <div style={{ position: "absolute", left: inner / 2 - 9, top: 0, bottom: 0, width: 18, background: room.trim }} />
              {[0, 1, 2].map((k) => (
                <div
                  key={k}
                  style={{ position: "absolute", left: 0, right: 0, top: inner / 2 + (rect / 3) * k, height: 16, background: room.trim }}
                />
              ))}
              {/* glass sheen */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.35) 0%, transparent 35%, rgba(255,255,255,0.12) 55%, transparent 70%)" }} />
            </div>
            {/* sill */}
            <div
              style={{
                position: "absolute",
                left: x - 40,
                top: WIN_TOP + WIN_H - 10,
                width: WIN_W + 80,
                height: 44,
                borderRadius: 6,
                background: room.trim,
                boxShadow: `0 18px 24px rgba(${theme.shade},0.2)`,
              }}
            />
          </React.Fragment>
        );
      })}

      {/* chair rail */}
      <div style={{ position: "absolute", left: 0, right: 0, top: RAIL_Y, height: 30, background: room.trim, boxShadow: `0 10px 18px rgba(${theme.shade},0.12)` }} />

      {/* low painted bookcase */}
      <div style={{ position: "absolute", left: 0, right: 0, top: CASE_TOP, bottom: 0, background: `linear-gradient(180deg, rgba(${theme.shade},0.10), rgba(${theme.shade},0.22))` }} />
      {books.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.h,
            borderRadius: 4,
            background: `linear-gradient(90deg, rgba(0,0,0,0.18), rgba(255,255,255,0.18) 35%, rgba(0,0,0,0.12)), ${b.color}`,
            transform: b.tilt ? `rotate(${b.tilt}deg)` : undefined,
            transformOrigin: "bottom center",
          }}
        />
      ))}
      {[0, 1, 2].map((s) => (
        <div
          key={s}
          style={{
            position: "absolute",
            left: -40,
            right: -40,
            top: CASE_TOP + s * CASE_SHELF + CASE_SHELF - 30,
            height: 34,
            background: room.trim,
            boxShadow: `0 12px 18px rgba(${theme.shade},0.18)`,
          }}
        />
      ))}

      {/* sun shafts slanting down-right from each window */}
      <AbsoluteFill style={{ filter: "blur(40px)" }}>
        {Array.from({ length: WIN_COUNT }, (_, i) => {
          const x = WIN_LEFT + i * (WIN_W + WIN_GAP);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                opacity: shimmer(i * 1.9),
                clipPath: `polygon(${x + 60}px ${WIN_TOP + 700}px, ${x + WIN_W - 60}px ${WIN_TOP + 700}px, ${x + WIN_W + 640}px ${DESIGN_HEIGHT}px, ${x + 520}px ${DESIGN_HEIGHT}px)`,
                background: `linear-gradient(180deg, rgba(255,250,232,0.55) 0%, rgba(255,246,220,0.25) 55%, transparent 100%)`,
              }}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function useCaseBooks(theme: Theme) {
  return useMemo(() => {
    const books: { x: number; y: number; w: number; h: number; color: string; tilt: number }[] = [];
    for (let s = 0; s < 3; s++) {
      let x = -40 + random(`lcase-${s}`) * 40;
      let i = 0;
      while (x < DESIGN_WIDTH + 40) {
        const seed = `lbook-${s}-${i++}`;
        // Gaps for ornaments keep it airy rather than packed like the dark library.
        if (random(seed + "gap") > 0.88) {
          x += 120 + random(seed + "gw") * 120;
          continue;
        }
        const w = 50 + random(seed + "w") * 60;
        const h = 240 + random(seed + "h") * 110;
        books.push({
          x,
          y: CASE_TOP + s * CASE_SHELF + CASE_SHELF - 30 - h,
          w,
          h,
          color: theme.books[Math.floor(random(seed + "c") * theme.books.length)],
          tilt: random(seed + "t") > 0.92 ? -7 + random(seed + "tt") * 14 : 0,
        });
        x += w + 4;
      }
    }
    return books;
  }, [theme]);
}
