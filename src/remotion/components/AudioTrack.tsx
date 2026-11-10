import React, { useMemo } from "react";
import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { AUDIO } from "../constants";
import { buildAudioCues } from "../audioCues";
import type { Timeline } from "../timeline";
import type { ReelAudioSettings } from "../types";

/**
 * Sound layer. Every cue from buildAudioCues() becomes a <Sequence> that starts
 * on its exact frame, wrapping a @remotion/media <Audio>. Nothing here reads
 * wall-clock time, so headless renders are sample-locked to the visuals.
 */
export const AudioTrack: React.FC<{ timeline: Timeline; audio: ReelAudioSettings }> = ({ timeline, audio }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const cues = useMemo(() => buildAudioCues(timeline, audio, fps), [timeline, audio, fps]);
  if (!audio.enabled) return null;

  const fadeIn = Math.round(fps * 0.25);
  return (
    <>
      {/* Ambient bed under everything: quick 0.25 s fade in, 1 s fade out. */}
      <Audio
        src={staticFile(AUDIO.ambient)}
        volume={(f) =>
          interpolate(f, [0, fadeIn, durationInFrames - fps, durationInFrames], [0, audio.music, audio.music, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {cues.map((cue) => (
        <Sequence key={cue.id} name={cue.id} from={cue.from} durationInFrames={cue.durationInFrames} premountFor={Math.round(fps * 0.5)}>
          <Audio src={staticFile(cue.src)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};
