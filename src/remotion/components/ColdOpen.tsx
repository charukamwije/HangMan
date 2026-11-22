import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import { loopReset } from "../loop";
import type { ThemeId } from "../themes";
import { ThumbnailCard } from "../HangmanThumbnail";

/**
 * A/B test B ("giant" opening): frame 1 is the plain thumbnail itself, the scroll-stopper, so the
 * Short opens exactly like its thumbnail: category tag, the hook as a giant headline, the board
 * with the two pre-filled letters (a faint "?" in every other slot) and "N LETTERS · 30 SECONDS".
 *
 * The card's background (the same shelves as the reel) and its text + board move separately, so
 * the two layouts never sit on top of each other as a half-transparent double exposure:
 *
 *   0          the card covers the whole frame
 *   hold       (giantHookSeconds, default 0.25 s) exit over COLD_OPEN_EXIT_SECONDS: the text zooms
 *              towards the viewer with a little blur and is gone in the first ~55 %, then the
 *              card's background dissolves into the reel
 *   loop end   the background fades in over the reel's loop reset (hiding its rewind), then the
 *              text drops in (1.2× → 1×) and lands exactly on the last frame, so the replay's
 *              frame 0 (the card at rest) follows without a jump
 */

export const DEFAULT_GIANT_HOOK_SECONDS = 0.25;
/** Text zoom-out + background dissolve from the card into the reel (s). */
export const COLD_OPEN_EXIT_SECONDS = 0.35;
/** Exit: the text has gone by this share of the exit ... */
const TEXT_OUT_BY = 0.45;
/** ... and the background only starts to dissolve here, so the two layouts barely overlap. */
const BG_OUT_FROM = 0.35;
/** Loop end (fractions of the loop reset): background fades in over BG_IN, then the text drops in over TEXT_IN. */
const BG_IN = [0.3, 0.75] as const;
const TEXT_IN = [0.55, 1] as const;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Exit frames [from, to] of the cold open for a hold (s). */
export function coldOpenFrames(holdSeconds: number, fps: number) {
  const exitFrom = Math.round(Math.max(0.05, holdSeconds) * fps);
  return { exit: [exitFrom, exitFrom + Math.max(2, Math.round(COLD_OPEN_EXIT_SECONDS * fps))] as const };
}

/** 0 → 1 progress of the exit (0 while the card holds, 1 once it has gone). */
const exitProgress = (frame: number, fps: number, holdSeconds: number) => {
  const [a, b] = coldOpenFrames(holdSeconds, fps).exit;
  return interpolate(frame, [a, b], [0, 1], CLAMP);
};

/**
 * 0..1: how much the card's background covers the stage (1 = fully up). The reel's banner hides
 * under it (HangmanReel passes 1 − cover to the header).
 */
export function coldOpenCover(frame: number, fps: number, durationInFrames: number, holdSeconds: number) {
  const out = 1 - interpolate(exitProgress(frame, fps, holdSeconds), [BG_OUT_FROM, 1], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  return Math.max(out, loopReset(frame, durationInFrames, fps, BG_IN[0], BG_IN[1]));
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
  const bg = coldOpenCover(frame, fps, durationInFrames, holdSeconds);
  if (bg <= 0.001) return null;

  // Text + board: zoom out (exit) or drop in (loop end). Whichever is further along wins.
  const p = exitProgress(frame, fps, holdSeconds);
  const out = interpolate(p, [0, TEXT_OUT_BY], [0, 1], CLAMP); // linear fade: the text clears early
  const zoom = Easing.in(Easing.quad)(out); // while the zoom accelerates away from the viewer
  const drop = loopReset(frame, durationInFrames, fps, TEXT_IN[0], TEXT_IN[1]); // eased 0 → 1, exactly 1 on the last frame
  const leaving = drop === 0;
  const textOpacity = leaving ? 1 - out : drop;
  const textScale = leaving ? 1 + 0.45 * zoom : 1.2 - 0.2 * drop;
  const textBlur = leaving ? 14 * zoom : 10 * (1 - drop);

  const card = { hookText, word, hintLetter, secondLetter, themeId, category };
  const layer: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
  return (
    // zIndex 10: above the question plate (zIndex 5), which escapes the camera layer whenever the camera is still.
    <div style={{ ...layer, pointerEvents: "none", zIndex: 10 }}>
      <div style={{ ...layer, opacity: bg }}>
        <ThumbnailCard {...card} layer="background" />
      </div>
      {textOpacity > 0.001 && (
        <div
          style={{
            ...layer,
            opacity: textOpacity,
            transform: textScale !== 1 ? `scale(${textScale.toFixed(4)})` : undefined,
            transformOrigin: "50% 48%",
            filter: textBlur > 0.05 ? `blur(${textBlur.toFixed(2)}px)` : undefined,
          }}
        >
          <ThumbnailCard {...card} layer="content" />
        </div>
      )}
    </div>
  );
};
