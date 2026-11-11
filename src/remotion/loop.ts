/**
 * Seamless loop. Over the last LOOP_RESET_SECONDS every element animates from
 * its end state back to its frame-0 state (staggered: keys → pawns → timer →
 * answer → banner), so the platform's auto-replay continues with no cut.
 * Each component asks for its own sub-window of the reset with loopReset().
 */
import { Easing, interpolate } from "remotion";
import { LOOP_RESET_SECONDS } from "./constants";

/** First frame of the loop reset. */
export const loopResetStart = (durationInFrames: number, fps: number) => durationInFrames - Math.round(LOOP_RESET_SECONDS * fps);

/**
 * Eased 0 → 1 progress of the loop reset inside the sub-window [a, b]
 * (fractions of the reset). 0 before it, exactly 1 on the reel's last frame.
 */
export function loopReset(frame: number, durationInFrames: number, fps: number, a = 0, b = 1) {
  const start = loopResetStart(durationInFrames, fps);
  if (frame < start) return 0;
  const raw = (frame - start + 1) / (durationInFrames - start);
  return interpolate(raw, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
}
