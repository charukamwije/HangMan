import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { AUDIO, DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import type { Theme } from "../themes";
import { KenBurns } from "./KenBurns";
import { loopReset } from "../loop";

const SHELF_TOP = 0;
const SHELF_HEIGHT = 380;
/** Shelves fill the whole frame (10 × 380 = 3800 px + one bleeding off the bottom). */
const SHELF_COUNT = 11;

/** Deterministic book spines for the blurred library shelves. */
function useBooks(theme: Theme) {
  return useMemo(() => {
    const books: { x: number; y: number; w: number; h: number; color: string; tilt: number; band: boolean }[] = [];
    for (let s = 0; s < SHELF_COUNT; s++) {
      let x = -60 + random(`shelf-${s}`) * 40;
      let i = 0;
      while (x < DESIGN_WIDTH + 60) {
        const seed = `book-${s}-${i++}`;
        const w = 55 + random(seed + "w") * 70;
        const h = 230 + random(seed + "h") * 110;
        const tilt = random(seed + "t") > 0.93 ? -8 + random(seed + "tt") * 16 : 0;
        books.push({
          x,
          y: SHELF_TOP + s * SHELF_HEIGHT + (SHELF_HEIGHT - 34 - h),
          w,
          h,
          color: theme.books[Math.floor(random(seed + "c") * theme.books.length)],
          tilt,
          band: random(seed + "b") > 0.55,
        });
        x += w + 4 + (random(seed + "g") > 0.9 ? 60 : 0);
      }
    }
    return books;
  }, [theme]);
}

/**
 * Mahogany library scene: a full-height wall of blurred bookshelves, lamp glow, dust.
 * Fully opaque on frame 0 (no fade-in) and wrapped in a Ken Burns push-in.
 * The vignette lives in <StressVignette> so it can react to the countdown.
 */
export const Background: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const books = useBooks(theme);

  // Audio-reactive lamp flicker driven by the ambient bed (@remotion/media-utils).
  const audioData = useAudioData(staticFile(AUDIO.ambient));
  let energy = 0;
  if (audioData) {
    const bins = visualizeAudio({ fps, frame, audioData, numberOfSamples: 16, smoothing: true });
    energy = (bins[0] + bins[1] + bins[2]) / 3;
  }
  const flicker = 0.9 + 0.06 * Math.sin(t * 8.6) + 0.04 * Math.sin(t * 26 + 1) + Math.min(0.25, energy * 0.6);

  // Loop reset: zoom, drift and dust ease back to their frame-0 state.
  const back = loopReset(frame, durationInFrames, fps);
  // Parallax inside the zoom: shelves drift sideways.
  const drift = interpolate(frame, [0, durationInFrames], [-20, 20]) * (1 - back) + -20 * back;

  const particles = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: random(`p${i}x`) * DESIGN_WIDTH,
        y: random(`p${i}y`) * DESIGN_HEIGHT,
        r: 3 + random(`p${i}r`) * 7,
        speed: 30 + random(`p${i}s`) * 72, // px / s upward
        phase: random(`p${i}ph`) * Math.PI * 2,
        alpha: 0.15 + random(`p${i}a`) * 0.35,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${theme.wood[0]} 0%, ${theme.wood[1]} 55%, ${theme.wood[2]} 100%)` }}>
      <KenBurns reset={back}>
        {/* --- Library shelves (depth-of-field blurred) --- */}
        <AbsoluteFill style={{ transform: `scale(1.04) translateX(${drift}px)`, transformOrigin: "50% 48%" }}>
          <div style={{ position: "absolute", inset: 0, filter: "blur(7px) saturate(0.85)", opacity: 0.62 }}>
            {Array.from({ length: SHELF_COUNT }, (_, s) => (
              <div
                key={`plank-${s}`}
                style={{
                  position: "absolute",
                  left: -100,
                  width: DESIGN_WIDTH + 200,
                  top: SHELF_TOP + s * SHELF_HEIGHT + SHELF_HEIGHT - 34,
                  height: 34,
                  background: "linear-gradient(180deg, #4a2c17 0%, #2a170b 60%, #120904 100%)",
                  boxShadow: "0 18px 30px rgba(0,0,0,0.7)",
                }}
              />
            ))}
            {books.map((b, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y,
                  width: b.w,
                  height: b.h,
                  background: `linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.08) 35%, rgba(0,0,0,0.35)), ${b.color}`,
                  transform: b.tilt ? `rotate(${b.tilt}deg)` : undefined,
                  transformOrigin: "bottom center",
                  borderRadius: 4,
                }}
              >
                {b.band && (
                  <>
                    <div style={{ position: "absolute", left: 0, right: 0, top: b.h * 0.14, height: 8, background: "rgba(214,170,96,0.45)" }} />
                    <div style={{ position: "absolute", left: 0, right: 0, top: b.h * 0.78, height: 8, background: "rgba(214,170,96,0.35)" }} />
                  </>
                )}
              </div>
            ))}
          </div>
          {/* darken the shelves where text sits: lightest behind the header, darkest under the keys */}
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 22%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.78) 75%, rgba(0,0,0,0.88) 100%)" }} />
        </AbsoluteFill>

        {/* --- Warm library lamp + rim light --- */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(900px 600px at 50% 2080px, ${theme.lamp}${alphaHex(0.34 * flicker)} 0%, transparent 70%), radial-gradient(1400px 1100px at 50% 1300px, ${theme.lamp}${alphaHex(0.12 * flicker)} 0%, transparent 70%)`,
            mixBlendMode: "screen",
          }}
        />
      </KenBurns>

      {/* --- Floating dust motes (outside the zoom: they drift past the lens) --- */}
      {/* During the loop reset the dust cross-fades into the copy that continues from frame 0. */}
      <Dust particles={particles} t={t} color={theme.lamp} opacity={1 - back} />
      {back > 0 && <Dust particles={particles} t={(frame - durationInFrames) / fps} color={theme.lamp} opacity={back} />}
    </AbsoluteFill>
  );
};

const alphaHex = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");

type Particle = { x: number; y: number; r: number; speed: number; phase: number; alpha: number };

const Dust: React.FC<{ particles: Particle[]; t: number; color: string; opacity: number }> = ({ particles, t, color, opacity }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", opacity }}>
    {particles.map((p, i) => {
      const y = (((p.y - t * p.speed) % DESIGN_HEIGHT) + DESIGN_HEIGHT) % DESIGN_HEIGHT;
      const x = p.x + Math.sin(t + p.phase) * 30;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: p.r * 2,
            height: p.r * 2,
            borderRadius: "50%",
            background: color,
            opacity: p.alpha * (0.6 + 0.4 * Math.sin(t * 2.4 + p.phase)),
            filter: "blur(2px)",
          }}
        />
      );
    })}
  </AbsoluteFill>
);
