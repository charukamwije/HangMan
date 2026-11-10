import React from "react";
import { AbsoluteFill } from "remotion";
import type { Stress } from "../motion";

/**
 * Radial vignette. Always-on cinematic base, plus a stress layer that closes in
 * once the clock drops below 00:08 and throbs darker on every tick — driven by
 * the same `Stress` values as the countdown, so the two pulse in lockstep.
 * Sits between the background and the UI, so it never dims the clock or keys.
 */
export const StressVignette: React.FC<{ stress: Stress }> = ({ stress }) => {
  const { level, pulse } = stress;
  // Tunnel vision: the clear centre shrinks as tension builds, and snaps tighter on each beat.
  const clear = 44 - 14 * level - 6 * pulse * level;
  const opacity = Math.min(1, 0.7 * level + 0.3 * pulse * level);

  return (
    <>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "radial-gradient(ellipse 85% 70% at 50% 46%, transparent 45%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.92) 100%)",
        }}
      />
      {opacity > 0.001 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity,
            background: `radial-gradient(ellipse 80% 62% at 50% 44%, transparent ${clear}%, rgba(4,2,1,0.82) ${clear + 30}%, rgba(0,0,0,0.98) 100%)`,
          }}
        />
      )}
    </>
  );
};
