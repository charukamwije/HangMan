import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import { loopReset } from "../loop";
import type { ThemeId } from "../themes";
import { ThumbnailCard } from "../HangmanThumbnail";

/**
 * A/B test B ("giant" opening): frame 1 is the plain thumbnail itself, the scroll-stopper, so the
 * Short opens exactly like its thumbnail: category tag, the hook as a giant headline, the board
 * with the two pre-filled letters (a faint "?" in every other slot) and "N LETTERS · 30 SECONDS".
 *
 *   0          the card covers the whole frame (same layout as the plain thumbnail)
 *   hold       (giantHookSeconds, default 0.25 s) it fades out while zooming towards the viewer
 *              over COLD_OPEN_EXIT_SECONDS, revealing the reel underneath
 *   loop       over the last part of the loop reset the card fades back in, so the replay's
 *              frame 0 matches the reel's last frame
 */

export const DEFAULT_GIANT_HOOK_SECONDS = 0.25;
/** Fade + zoom from the card into the reel (s). */
export const COLD_OPEN_EXIT_SECONDS = 0.25;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Exit frames [from, to] of the cold open for a hold (s). */
export function coldOpenFrames(holdSeconds: number, fps: number) {
  const exitFrom = Math.round(Math.max(0.05, holdSeconds) * fps);
  return { exit: [exitFrom, exitFrom + Math.max(1, Math.round(COLD_OPEN_EXIT_SECONDS * fps))] as const };
}

/** 0..1: how much the cold open covers the stage (1 = card fully up). The banner hides under it. */
export function coldOpenCover(frame: number, fps: number, durationInFrames: number, holdSeconds: number) {
  const [a, b] = coldOpenFrames(holdSeconds, fps).exit;
  const out = interpolate(frame, [a, b], [1, 0], CLAMP);
  return Math.max(out, loopReset(frame, durationInFrames, fps, 0.5, 1));
}

export const ColdOpen: React.FC<{
  themeId: ThemeId;
  hookText: string;
  word: string;
  hintLetter: string;
  secondLetter: string;
  category: string;
  holdSeconds: number;
}> = ({ themeId, hookText, word, hintLetter, secondLetter, category, holdSeconds }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cover = coldOpenCover(frame, fps, durationInFrames, holdSeconds);
  if (cover <= 0.001) return null;
  // Eased so the card stays readable for most of the exit, then clears fast; it zooms past the viewer.
  const opacity = Math.pow(cover, 0.6);
  const zoom = 1 + 0.12 * (1 - cover);
  return (
    // zIndex 10: above the question plate (zIndex 5), which escapes the camera layer whenever the camera is still.
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        pointerEvents: "none",
        zIndex: 10,
        opacity,
        transform: zoom !== 1 ? `scale(${zoom.toFixed(4)})` : undefined,
        transformOrigin: "50% 50%",
      }}
    >
      <ThumbnailCard hookText={hookText} word={word} hintLetter={hintLetter} secondLetter={secondLetter} themeId={themeId} category={category} />
    </div>
  );
};
