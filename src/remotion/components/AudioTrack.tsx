import React from "react";
import { Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { AUDIO, COUNTDOWN_FROM, STRESS_BELOW_SECONDS } from "../constants";
import type { Timeline } from "../timeline";
import type { ReelAudioSettings } from "../types";

/**
 * Every SFX is a <Sequence> starting on the exact frame its visual fires, so
 * audio and animation are sample-locked in both the Player and the final MP4.
 */
export const AudioTrack: React.FC<{ timeline: Timeline; audio: ReelAudioSettings }> = ({ timeline, audio }) => {
  const { fps, durationInFrames } = useVideoConfig();
  if (!audio.enabled) return null;
  const sfx = audio.sfx;

  return (
    <>
      {/* Background bed: suspense drone, faded in/out at the edges. */}
      <Audio
        src={staticFile(AUDIO.ambient)}
        volume={(f) => interpolate(f, [0, Math.round(fps * 0.25), durationInFrames - fps, durationInFrames], [0, audio.music, audio.music, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />

      {/* Frame-0 whoosh: the hook lands with sound, not silence. */}
      <Sequence from={0} durationInFrames={Math.round(fps * 1.1)} name="whoosh">
        <Audio src={staticFile(AUDIO.whoosh)} volume={sfx * 0.5} />
      </Sequence>

      {/* Clock tick-tock on every countdown change; louder once stress mode starts (< 00:08). */}
      {timeline.tickFrames.map((f, i) => {
        const urgent = i >= COUNTDOWN_FROM - STRESS_BELOW_SECONDS;
        const final = i === timeline.tickFrames.length - 1;
        if (final) return null; // 00:00 is punctuated by the reveal sting instead
        return (
          <Sequence key={`tick-${f}`} from={f} durationInFrames={Math.round(fps * 0.15)} name={`tick ${30 - i - 1}`}>
            <Audio src={staticFile(i % 2 === 0 ? AUDIO.tick : AUDIO.tock)} volume={Math.min(1, audio.tick * (urgent ? 1.7 : 1))} />
          </Sequence>
        );
      })}

      {/* Guess reveals: chime for correct, buzzer + thud for wrong. */}
      {timeline.guesses
        .filter((g) => g.kind === "wrong" || g.frame < timeline.finalRevealFrame)
        .map((g) => (
          <Sequence key={`g-${g.letter}`} from={g.frame} durationInFrames={Math.round(fps * (g.kind === "correct" ? 1.4 : 0.75))} name={`${g.kind} ${g.letter}`}>
            <Audio src={staticFile(g.kind === "correct" ? AUDIO.correct : AUDIO.wrong)} volume={sfx * (g.kind === "correct" ? 0.85 : 0.8)} />
          </Sequence>
        ))}

      {/* Final answer sting at the reveal. */}
      <Sequence from={timeline.finalRevealFrame} durationInFrames={Math.round(fps * 3.2)} name="final reveal">
        <Audio src={staticFile(AUDIO.reveal)} volume={sfx} />
      </Sequence>
    </>
  );
};
