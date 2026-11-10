import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { KEN_BURNS } from "../constants";

/**
 * Slow, constant-velocity camera push-in across the whole composition
 * (1.00 → 1.08 by default). Linear on purpose: a steady drift keeps peripheral
 * vision engaged without ever "settling", which an eased zoom would do.
 */
export const KenBurns: React.FC<{
  children: React.ReactNode;
  from?: number;
  to?: number;
  /** transform-origin; slightly above centre keeps the focal lamp/board in frame. */
  origin?: string;
}> = ({ children, from = KEN_BURNS.from, to = KEN_BURNS.to, origin = "50% 46%" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: origin, willChange: "transform" }}>{children}</AbsoluteFill>;
};
