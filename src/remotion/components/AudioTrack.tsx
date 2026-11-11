import React, { useMemo } from "react";
import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { AUDIO } from "../constants";
import { buildAudioCues, LOOP_REWIND_CUE_ID } from "../audioCues";
import { loopResetStart } from "../loop";
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

  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const fadeIn = Math.round(fps * 0.1);
  const [xfadeFrom, xfadeTo] = timeline.hook.musicInFrames;
  const musicFrames = durationInFrames - xfadeFrom;
  const loopFrom = loopResetStart(durationInFrames, fps);
  return (
    <>
      {/* Dark drone under the hook (0.1 s fade in), crossfaded out as the music comes in after the lock. */}
      <Sequence name="ambient-hook-bed" durationInFrames={xfadeTo + 1}>
        <Audio
          src={staticFile(AUDIO.ambient)}
          volume={(f) => interpolate(f, [0, fadeIn, xfadeFrom, xfadeTo], [0, audio.music, audio.music, 0], clamp)}
        />
      </Sequence>

      {/* 120 BPM staccato cello + woodblock, forward after the rewind. music.wav is gridded so its downbeats land on the clock ticks. */}
      <Sequence name="music-bed" from={xfadeFrom} durationInFrames={musicFrames} premountFor={fps}>
        <Audio
          src={staticFile(AUDIO.music)}
          volume={(f) =>
            interpolate(f, [0, xfadeTo - xfadeFrom, musicFrames - fps], [0, audio.music, audio.music], clamp) *
            // the song itself is "rewound" by loop-rewind.wav, so it drops out as the rewind starts
            interpolate(xfadeFrom + f, [loopFrom, loopFrom + 2], [1, 0], clamp)
          }
        />
      </Sequence>

      {cues.map((cue) => {
        // Everything except the loop rewind ducks out over its first 3 frames, so the
        // replay's frame-0 gavel follows the rewind with nothing hanging over the cut.
        const ducked =
          cue.id === LOOP_REWIND_CUE_ID
            ? cue.volume
            : (f: number) => (typeof cue.volume === "number" ? cue.volume : cue.volume(f)) * interpolate(cue.from + f, [loopFrom, loopFrom + 3], [1, 0.1], clamp);
        return (
          <Sequence key={cue.id} name={cue.id} from={cue.from} durationInFrames={cue.durationInFrames} premountFor={Math.round(fps * 0.5)}>
            <Audio src={staticFile(cue.src)} volume={ducked} />
          </Sequence>
        );
      })}
    </>
  );
};
