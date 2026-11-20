import React from "react";
import { Composition } from "remotion";
import {
  COMPOSITION_ID,
  COMPOSITION_ID_1080,
  DURATION_FRAMES,
  FPS,
  PUZZLE_COMPOSITION_ID,
  PUZZLE_COMPOSITION_ID_1080,
  RESOLUTIONS,
  THUMBNAIL_COMPOSITION_ID,
} from "./constants";
import { DEFAULT_REEL_PROPS } from "./defaults";
import { HangmanReel } from "./HangmanReel";
import { HangmanPuzzleReel, validatePuzzleMetadata } from "./HangmanPuzzleReel";
import { EXAMPLE_PUZZLE } from "./puzzle";
import { HangmanThumbnail, type ThumbnailProps } from "./HangmanThumbnail";

const DEFAULT_THUMBNAIL_PROPS: ThumbnailProps = {
  hookText: DEFAULT_REEL_PROPS.hookText,
  word: DEFAULT_REEL_PROPS.word,
  hintLetter: DEFAULT_REEL_PROPS.hintLetter,
  themeId: DEFAULT_REEL_PROPS.themeId,
  category: "",
};

const common = { durationInFrames: DURATION_FRAMES, fps: FPS } as const;

/**
 * HangmanReel*   take resolved ReelProps (studio / API).
 * HangmanPuzzle* take raw HangmanPuzzleData (batch JSON files).
 * Each in 4K (2160×3840) and 1080×1920; the stage scales from its 4K design canvas.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id={COMPOSITION_ID} component={HangmanReel} {...common} {...RESOLUTIONS["4k"]} defaultProps={DEFAULT_REEL_PROPS} />
    <Composition id={COMPOSITION_ID_1080} component={HangmanReel} {...common} {...RESOLUTIONS["1080p"]} defaultProps={DEFAULT_REEL_PROPS} />
    <Composition
      id={PUZZLE_COMPOSITION_ID}
      component={HangmanPuzzleReel}
      {...common}
      {...RESOLUTIONS["4k"]}
      defaultProps={EXAMPLE_PUZZLE}
      calculateMetadata={validatePuzzleMetadata}
    />
    <Composition
      id={PUZZLE_COMPOSITION_ID_1080}
      component={HangmanPuzzleReel}
      {...common}
      {...RESOLUTIONS["1080p"]}
      defaultProps={EXAMPLE_PUZZLE}
      calculateMetadata={validatePuzzleMetadata}
    />
    <Composition
      id={THUMBNAIL_COMPOSITION_ID}
      component={HangmanThumbnail}
      durationInFrames={1}
      fps={FPS}
      {...RESOLUTIONS["1080p"]}
      defaultProps={DEFAULT_THUMBNAIL_PROPS}
    />
  </>
);
