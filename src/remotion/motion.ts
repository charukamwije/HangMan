/**
 * Frame-driven motion helpers. Everything here is a pure function of the
 * current frame (no setInterval / requestAnimationFrame), so the Player,
 * Studio and every render produce identical frames.
 *
 * Durations are written in seconds and converted with `fps`, so pacing stays
 * the same if the composition fps ever changes.
 */
import { Easing, interpolate, spring } from "remotion";
import { COUNTDOWN_FROM, STRESS_BELOW_SECONDS } from "./constants";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Sentinel "long ago" value: finite, so it is safe to feed into interpolate(). */
export const NEVER = 1e9;

/** Frames since the most recent event at or before `frame` (NEVER if none yet). */
export const framesSinceLast = (events: readonly number[], frame: number) => {
  let last = -Infinity;
  for (const e of events) if (e <= frame && e > last) last = e;
  return last === -Infinity ? NEVER : frame - last;
};

/**
 * Spring-physics impact shake: the box is kicked to +amplitude on the strike
 * frame and an underdamped spring pulls it back, overshooting a few times
 * (+1 → −0.45 → +0.2 …) and settling in ~0.35 s. Horizontal only.
 */
export const strikeShake = (sinceStrike: number, fps: number, amplitude: number) => {
  if (!(sinceStrike >= 0) || sinceStrike > fps) return 0;
  const settle = spring({ frame: sinceStrike, fps, config: { mass: 0.4, stiffness: 600, damping: 8 } });
  return amplitude * (1 - settle);
};

export type Stress = {
  /** 0 → 1 tension ramp across the final seconds; releases after 00:00. */
  level: number;
  /** 1 on every countdown tick inside the stress window, decaying to 0 (heartbeat). */
  pulse: number;
  active: boolean;
};

/**
 * Shared stress clock for the countdown + vignette, so both beat on exactly
 * the same frames. Starts when the clock first reads below STRESS_BELOW_SECONDS.
 */
export function stressAt(frame: number, fps: number, tickFrames: readonly number[]): Stress {
  const startIdx = COUNTDOWN_FROM - STRESS_BELOW_SECONDS; // tick that shows 00:07
  const start = tickFrames[startIdx];
  const end = tickFrames[tickFrames.length - 1]; // 00:00
  if (start === undefined || end === undefined || frame < start) return { level: 0, pulse: 0, active: false };

  const level = interpolate(frame, [start, start + 0.3 * fps, end, end + 0.6 * fps], [0, 0.45, 1, 0], {
    ...CLAMP,
    easing: Easing.inOut(Easing.quad),
  });
  const since = framesSinceLast(tickFrames, frame);
  const inWindow = frame < end; // the 00:00 tick hands over to the final reveal
  const pulse = inWindow ? interpolate(since, [0, 0.5 * fps], [1, 0], { ...CLAMP, easing: Easing.out(Easing.cubic) }) : 0;
  return { level, pulse, active: inWindow };
}

/** interpolate() with clamping on both sides — the default for one-shot UI flashes. */
export const ramp = (value: number, input: number[], output: number[]) => interpolate(value, input, output, CLAMP);
