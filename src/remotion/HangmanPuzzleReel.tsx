import React, { useMemo } from "react";
import { useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { HangmanReel } from "./HangmanReel";
import { calculateFrameTimeline, parsePuzzle, type HangmanPuzzleData } from "./puzzle";
import { FPS, videoDurationFrames } from "./constants";

/**
 * Composition that takes raw HangmanPuzzleData as input props, so a puzzle
 * JSON file renders directly:
 *
 *   npx remotion render src/remotion/index.ts HangmanPuzzle out.mp4 --props=puzzles/day.json
 */
export const HangmanPuzzleReel: React.FC<HangmanPuzzleData> = (puzzle) => {
  const { fps } = useVideoConfig();
  const reelProps = useMemo(() => calculateFrameTimeline(parsePuzzle(puzzle), fps).reelProps, [puzzle, fps]);
  return <HangmanReel {...reelProps} />;
};

/** Validate before any frame renders, so a bad puzzle fails fast in selectComposition(). */
export const validatePuzzleMetadata: CalculateMetadataFunction<HangmanPuzzleData> = ({ props }) => {
  const puzzle = parsePuzzle(props);
  return { durationInFrames: videoDurationFrames(puzzle, FPS) };
};
