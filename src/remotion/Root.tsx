import React from "react";
import { Composition } from "remotion";
import { COMPOSITION_ID, COMPOSITION_ID_1080, DURATION_FRAMES, FPS, RESOLUTIONS } from "./constants";
import { DEFAULT_REEL_PROPS } from "./defaults";
import { HangmanReel } from "./HangmanReel";

/** Same component, two delivery sizes — the stage scales from its 4K design canvas. */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={COMPOSITION_ID}
      component={HangmanReel}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={RESOLUTIONS["4k"].width}
      height={RESOLUTIONS["4k"].height}
      defaultProps={DEFAULT_REEL_PROPS}
    />
    <Composition
      id={COMPOSITION_ID_1080}
      component={HangmanReel}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={RESOLUTIONS["1080p"].width}
      height={RESOLUTIONS["1080p"].height}
      defaultProps={DEFAULT_REEL_PROPS}
    />
  </>
);
