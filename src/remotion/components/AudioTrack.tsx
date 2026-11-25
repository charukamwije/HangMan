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
/** Music bed gain over the opening (0 → first guess): ×2 ≈ +6 dB. */
const OPENING_MUSIC_BOOST = 2;

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
  // Stress mode (00:07): the music drops out over 2 frames, leaving ticks + heartbeat.
  const musicCut = stressStartFrame(timeline.tickFrames) ?? loopFrom;

  const cues = useMemo(() => {
    // Cues still sounding at the loop point are cut there (the loud loop-rewind starts on that
    // exact frame and masks the cut), so the replay's frame-0 gavel has nothing hanging over it.
    // Deliberately NOT a volume function: see the note above.
    return buildAudioCues(timeline, audio, fps, durationInFrames).flatMap((cue) => {
      if (cue.id === LOOP_REWIND_CUE_ID || cue.from + cue.durationInFrames <= loopFrom) return [cue];
      const durationInFrames = loopFrom - cue.from;
      return durationInFrames > 0 ? [{ ...cue, durationInFrames }] : [];
    });
  }, [timeline, audio, fps, loopFrom, durationInFrames]);

  // Opening (0 → first guess, while viewers decide): the bed plays ~6 dB hotter so there is no
  // near-silence, easing back to the normal level by 2.4 s once the first guess has landed.
  const hookEnd = timeline.hook.endFrame;
  // Eases off around the first guess (from 0.2 s before it), so its impact never stacks on the boosted bed.
  const boostFrom = hookEnd - Math.round(0.2 * fps);
  const boostOff = hookEnd + Math.round(0.3 * fps);
  const musicVolume = useCallback(
    (f: number) =>
      Math.min(
        1, // a high music setting × the opening boost must not exceed full volume
        interpolate(f, [0, xfadeTo - xfadeFrom, musicFrames - fps], [0, audio.music, audio.music], CLAMP) *
          interpolate(xfadeFrom + f, [boostFrom, boostOff], [OPENING_MUSIC_BOOST, 1], CLAMP) *
          // the song itself is "rewound" by loop-rewind.wav, so it drops out as the rewind starts
          interpolate(xfadeFrom + f, [Math.min(musicCut, loopFrom), Math.min(musicCut, loopFrom) + 2], [1, 0], CLAMP),
      ),
    [xfadeFrom, xfadeTo, musicFrames, fps, audio.music, loopFrom, musicCut, boostFrom, boostOff],
  );

  if (!audio.enabled) return null;

  return (
    <>
      {/* 120 BPM staccato cello + woodblock, playing forward from frame 0 (no silent gap while viewers decide).
          music.wav is gridded so its downbeats land on the clock ticks. */}
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
