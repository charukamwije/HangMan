import React, { useCallback, useMemo } from "react";
import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { AUDIO } from "../constants";
import { buildAudioCues, LOOP_REWIND_CUE_ID } from "../audioCues";
import { loopResetStart } from "../loop";
import { stressStartFrame, type Timeline } from "../timeline";
import type { ReelAudioSettings } from "../types";

/**
 * Sound layer. Every cue from buildAudioCues() becomes a <Sequence> that starts
 * on its exact frame, wrapping a @remotion/media <Audio>. Nothing here reads
 * wall-clock time, so headless renders are sample-locked to the visuals.
 */
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * IMPORTANT: keep volume FUNCTIONS to a minimum. @remotion/media's <Audio> re-evaluates a
 * function volume and updates Player state on every frame; with several overlapping
 * function-volume cues that cascaded past React's limit ("Maximum update depth exceeded"
 * in the Remotion Player). Only the two beds below use (memoised) envelopes; every
 * cue uses a static number.
 */
export const AudioTrack: React.FC<{ timeline: Timeline; audio: ReelAudioSettings }> = ({ timeline, audio }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [xfadeFrom, xfadeTo] = timeline.hook.musicInFrames;
  const musicFrames = durationInFrames - xfadeFrom;
  const loopFrom = loopResetStart(durationInFrames, fps);
  const fadeIn = Math.round(fps * 0.1);
  // Stress mode (00:07): the music drops out over 2 frames, leaving ticks + heartbeat.
  const musicCut = stressStartFrame(timeline.tickFrames) ?? loopFrom;

  const cues = useMemo(() => {
    // Cues still sounding at the loop point are cut there (the loud loop-rewind starts on that
    // exact frame and masks the cut), so the replay's frame-0 gavel has nothing hanging over it.
    // Deliberately NOT a volume function: see the note above.
    return buildAudioCues(timeline, audio, fps).flatMap((cue) => {
      if (cue.id === LOOP_REWIND_CUE_ID || cue.from + cue.durationInFrames <= loopFrom) return [cue];
      const durationInFrames = loopFrom - cue.from;
      return durationInFrames > 0 ? [{ ...cue, durationInFrames }] : [];
    });
  }, [timeline, audio, fps, loopFrom]);

  const ambientVolume = useCallback(
    (f: number) => interpolate(f, [0, fadeIn, xfadeFrom, xfadeTo], [0, audio.music, audio.music, 0], CLAMP),
    [fadeIn, xfadeFrom, xfadeTo, audio.music],
  );
  const musicVolume = useCallback(
    (f: number) =>
      interpolate(f, [0, xfadeTo - xfadeFrom, musicFrames - fps], [0, audio.music, audio.music], CLAMP) *
      // the song itself is "rewound" by loop-rewind.wav, so it drops out as the rewind starts
      interpolate(xfadeFrom + f, [Math.min(musicCut, loopFrom), Math.min(musicCut, loopFrom) + 2], [1, 0], CLAMP),
    [xfadeFrom, xfadeTo, musicFrames, fps, audio.music, loopFrom, musicCut],
  );

  if (!audio.enabled) return null;

  return (
    <>
      {/* Dark drone under the hook (0.1 s fade in), crossfaded out as the music comes in after the lock. */}
      <Sequence name="ambient-hook-bed" durationInFrames={xfadeTo + 1}>
        <Audio src={staticFile(AUDIO.ambient)} volume={ambientVolume} />
      </Sequence>

      {/* 120 BPM staccato cello + woodblock, forward after the rewind. music.wav is gridded so its downbeats land on the clock ticks. */}
      <Sequence name="music-bed" from={xfadeFrom} durationInFrames={musicFrames} premountFor={fps}>
        <Audio src={staticFile(AUDIO.music)} volume={musicVolume} />
      </Sequence>

      {cues.map((cue) => (
        <Sequence key={cue.id} name={cue.id} from={cue.from} durationInFrames={cue.durationInFrames} premountFor={Math.round(fps * 0.5)}>
          <Audio src={staticFile(cue.src)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};
