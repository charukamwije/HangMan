import React from "react";
import { interpolate, random, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LOWER_SAFE_CENTER_X as SAFE_CENTER_X } from "../constants";
import { BODY_FONT, DISPLAY_FONT } from "../fonts";
import { ramp } from "../motion";
import type { Theme } from "../themes";
import type { ResolvedGuess } from "../timeline";

const LETTER = 480;
/** How long each callout stays mounted. */
export const CALLOUT_SECONDS = 0.8;

/**
 * Big centre-screen callout for every guess. One <Sequence> per guess, starting
 * on the guess frame, so the slam is frame-locked to its SFX.
 *
 *  correct: slams in (3.2× → 1×), shockwave ring + spark burst, then flies up
 *           toward the board and dissolves.
 *  wrong:   slams in red with a jitter (no cross),
 *           then it drops away with gravity and a spin.
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
  return (
    <>
      {guesses
        .filter((g) => g.frame < finalRevealFrame)
        .map((g) => (
          <Sequence key={g.letter} name={`callout-${g.kind}-${g.letter}`} from={g.frame} durationInFrames={Math.min(len, finalRevealFrame - g.frame)} layout="none">
            <Callout theme={theme} letter={g.letter} correct={g.kind === "correct"} centerY={centerY} />
          </Sequence>
        ))}
    </>
  );
};

const Callout: React.FC<{ theme: Theme; letter: string; correct: boolean; centerY: number }> = ({ theme, letter, correct, centerY: CALLOUT_Y }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const color = correct ? theme.accent : theme.wrong;

  const slam = spring({ frame: f, fps, config: { damping: 13, stiffness: 520, mass: 0.6 } });
  const scale = interpolate(slam, [0, 1], [3.2, 1]);
  const appear = ramp(f, [0, 1], [0.4, 1]);
  // Exit: correct flies up to the board, wrong falls off the bottom.
  const exit = ramp(t, [0.45, 0.8], [0, 1]);
  const exitEase = exit * exit;
  const exitY = correct ? -620 * exitEase : 700 * exitEase;
  const exitScale = correct ? 1 - 0.55 * exit : 1 - 0.15 * exit;
  const exitRot = correct ? 0 : 28 * exitEase;
  const jitter = !correct && f < 8 ? (random(`cj-${letter}-${f}`) - 0.5) * 50 * (1 - f / 8) : 0;
  const opacity = appear * (1 - ramp(exit, [0.5, 1], [0, 1]));

  const backdrop = ramp(t, [0, 0.05, 0.55, 0.8], [0, 0.85, 0.6, 0]);
  const ring = ramp(t, [0, 0.4], [0, 1]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* darken around the callout so it reads over everything */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: backdrop,
          background: `radial-gradient(900px 700px at ${SAFE_CENTER_X}px ${CALLOUT_Y}px, rgba(0,0,0,0.85), transparent 75%)`,
        }}
      />
      <div style={{ position: "absolute", left: SAFE_CENTER_X, top: CALLOUT_Y, width: 0, height: 0 }}>
        {/* shockwave ring */}
        <div
          style={{
            position: "absolute",
            left: -300,
            top: -300,
            width: 600,
            height: 600,
            borderRadius: "50%",
            border: `${28 * (1 - ring) + 4}px solid ${color}`,
            boxShadow: `0 0 80px ${color}, inset 0 0 60px ${color}88`,
            transform: `scale(${0.3 + 2.1 * ring})`,
            opacity: (1 - ring) * 0.95,
          }}
        />
        {/* spark burst (correct) / shards (wrong) */}
        {Array.from({ length: 14 }, (_, i) => {
          const ang = (i / 14) * Math.PI * 2 + random(`sa-${letter}-${i}`) * 0.4;
          const dist = ramp(t, [0, 0.35], [120, 520 + 260 * random(`sd-${letter}-${i}`)]);
          const life = 1 - ramp(t, [0.08, 0.4], [0, 1]);
          const w = correct ? 90 : 46;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: Math.cos(ang) * dist - w / 2,
                top: Math.sin(ang) * dist - 7,
                width: w,
                height: correct ? 14 : 24,
                borderRadius: correct ? 99 : 3,
                background: correct ? `linear-gradient(90deg, transparent, #ffffff, ${color})` : color,
                transform: `rotate(${(ang * 180) / Math.PI + (correct ? 0 : 45 + 180 * t)}deg)`,
                boxShadow: `0 0 24px ${color}`,
                opacity: life,
              }}
            />
          );
        })}
        {/* the letter */}
        <div
          style={{
            position: "absolute",
            left: -LETTER,
            width: LETTER * 2,
            top: -LETTER * 0.62,
            textAlign: "center",
            fontFamily: DISPLAY_FONT,
            fontSize: LETTER,
            lineHeight: 1,
            // White impact flash for 2 frames, then the verdict colour (accent = correct, red = wrong).
            color: f < 2 ? "#ffffff" : color,
            textShadow: `0 0 40px ${color}, 0 0 120px ${color}aa, 0 24px 60px rgba(0,0,0,0.9)`,
            WebkitTextStroke: `10px rgba(0,0,0,0.55)`,
            paintOrder: "stroke fill",
            opacity,
            transform: `translate(${jitter}px, ${exitY}px) rotate(${exitRot}deg) scale(${scale * exitScale})`,
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
            top: LETTER * 0.42,
            display: "flex",
            justifyContent: "center",
            opacity: ramp(f, [2, 4], [0, 1]) * (1 - exit),
            transform: `translateY(${ramp(f, [2, 5], [40, 0]) + exitY * 0.6}px)`,
          }}
        >
          <span
            style={{
              padding: "14px 44px 12px 56px",
              borderRadius: 999,
              background: color,
              border: "4px solid rgba(255,255,255,0.85)",
              boxShadow: `0 0 50px ${color}, 0 14px 30px rgba(0,0,0,0.8)`,
              fontFamily: BODY_FONT,
              fontWeight: 900,
              fontSize: 72,
              letterSpacing: "0.3em",
              color: correct ? "#0b0b05" : "#ffffff",
            }}
          >
            {correct ? "CORRECT" : "WRONG"}
          </span>
        </div>
      </div>
    </div>
  );
};
