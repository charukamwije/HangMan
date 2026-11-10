"use client";

import { forwardRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "@/remotion/constants";
import { HangmanReel } from "@/remotion/HangmanReel";
import type { ReelProps } from "@/remotion/types";

/**
 * Interactive 9:16 preview. The Player renders the exact same composition the
 * renderer uses, at 2160×3840 internally, scaled down to fit the viewport.
 */
export const PreviewPlayer = forwardRef<PlayerRef, { inputProps: ReelProps }>(function PreviewPlayer({ inputProps }, ref) {
  return (
    <Player
      ref={ref}
      component={HangmanReel}
      inputProps={inputProps}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      style={{ width: "100%", height: "100%" }}
      controls
      loop
      clickToPlay
      doubleClickToFullscreen
      spaceKeyToPlayOrPause
      allowFullscreen
      // Ticks + guess SFX mount on the fly; extra shared tags keep them audible after autoplay policies.
      numberOfSharedAudioTags={12}
    />
  );
});
