/**
 * Frame-accurate sound design for The Dark Board. Pure function: gameplay
 * timeline in → flat list of cues out, each pinned to an integer frame. The
 * <AudioTrack> component only maps this list to <Sequence>/<Audio>, so what
 * you hear in the Player is exactly what `npx remotion render` muxes.
 */
import { AUDIO, AUDIO_SECONDS, COUNTDOWN_FROM, DURATION_SECONDS, FINAL_TICK_SECONDS, LOOP_RESET_SECONDS, SWELL_LEAD_SECONDS } from "./constants";

export const LOOP_REWIND_CUE_ID = "loop-rewind";
import type { Timeline } from "./timeline";
import type { ReelAudioSettings } from "./types";

export type AudioCue = {
  /** Stable React key + Studio timeline label. */
  id: string;
  /** Path inside public/ (passed to staticFile). */
  src: string;
  /** First frame the sound plays on. */
  from: number;
  durationInFrames: number;
  /** Static gain 0–1, or a per-frame envelope (frame is relative to `from`). */
  volume: number | ((frame: number) => number);
};

const seconds = (s: number, fps: number) => Math.max(1, Math.ceil(s * fps));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function buildAudioCues(timeline: Timeline, audio: ReelAudioSettings, fps: number): AudioCue[] {
  if (!audio.enabled) return [];
  const { sfx } = audio;
  const cues: AudioCue[] = [];

  // 1. Frame-0 impact: heavy hardwood gavel + sub drop. The hook lands with a hit, not silence.
  cues.push({ id: "gavel", src: AUDIO.gavel, from: 0, durationInFrames: seconds(AUDIO_SECONDS.gavel, fps), volume: clamp01(sfx) });

  // 1b. Machine-gun hook (frames 0–30): a sharp click on every decoy pop, click + thud on its ✖,
  //     then a metallic lock on the frame the last hint slot snaps in (36).
  const { hook } = timeline;
  // All decoy clicks / strikes / thuds are pre-mixed into ONE file on the fixed pop schedule
  // (decoyPopFrames30): ~40 separate <Audio> tags mounting in the first second overflowed
  // React's nested-update limit in the Remotion Player.
  if (hook.decoys.length) {
    cues.push({ id: "hook-decode", src: AUDIO.hookDecode, from: 0, durationInFrames: Math.min(hook.clearFrame + 2, seconds(AUDIO_SECONDS.hookDecode, fps)), volume: clamp01(sfx) });
  }
  // Tape rewind of the music bed under the whole decode, speeding up with the decoy cadence.
  // Its Sequence hard-stops it on the clear frame (30); the same music then plays forward from the lock.
  cues.push({ id: "hook-rewind", src: AUDIO.rewind, from: 0, durationInFrames: hook.clearFrame, volume: clamp01(Math.max(audio.music, 0.2) * 2) });
  if (timeline.hintLetter) {
    cues.push({ id: "hook-lock", src: AUDIO.lock, from: hook.lockFrame, durationInFrames: seconds(AUDIO_SECONDS.lock, fps), volume: clamp01(sfx * 0.9) });
  }

  // 2. Clock ticks on every digit change (exactly every `fps` frames with the 1 Hz clock).
  //    The last FINAL_TICK_SECONDS rise in pitch (separate pitched assets) and in volume.
  timeline.tickFrames.forEach((frame, i) => {
    const secondsLeft = COUNTDOWN_FROM - (i + 1);
    if (secondsLeft <= 0) return; // 00:00 belongs to the reveal sting
    const final = secondsLeft <= FINAL_TICK_SECONDS;
    const urgency = final ? (FINAL_TICK_SECONDS + 1 - secondsLeft) / FINAL_TICK_SECONDS : 0; // 0.2 → 1
    cues.push({
      id: `tick-${secondsLeft}`,
      src: final ? AUDIO.tickFinal(secondsLeft) : i % 2 === 0 ? AUDIO.tick : AUDIO.tock,
      from: frame,
      durationInFrames: seconds(AUDIO_SECONDS.tick, fps),
      volume: clamp01(audio.tick * (final ? 1.15 + 0.85 * urgency : 0.7)),
    });
  });

  // 3. Correct reveal: typewriter key strike + subtle metallic chime, on the reveal frame.
  // 4. Wrong strike: deep mahogany thud on the frame the key turns red.
  for (const g of timeline.guesses) {
    // Anticipation: a whoosh that ends exactly on the impact frame.
    if (g.frame < timeline.finalRevealFrame) {
      const len = seconds(AUDIO_SECONDS.whoosh, fps);
      cues.push({ id: `whoosh-${g.letter}`, src: AUDIO.whoosh, from: Math.max(0, g.frame - len), durationInFrames: len, volume: clamp01(sfx * 0.55) });
    }
    if (g.kind === "correct" && g.frame < timeline.finalRevealFrame) {
      cues.push({ id: `correct-${g.letter}`, src: AUDIO.correct, from: g.frame, durationInFrames: seconds(AUDIO_SECONDS.correct, fps), volume: clamp01(sfx * 0.85) });
      cues.push({ id: `type-${g.letter}`, src: AUDIO.typewriter, from: g.frame, durationInFrames: seconds(AUDIO_SECONDS.typewriter, fps), volume: clamp01(sfx * 0.9) });
      cues.push({ id: `chime-${g.letter}`, src: AUDIO.chime, from: g.frame, durationInFrames: seconds(AUDIO_SECONDS.chime, fps), volume: clamp01(sfx * 0.4) });
    }
    if (g.kind === "wrong") {
      cues.push({ id: `wrong-${g.letter}`, src: AUDIO.wrong, from: g.frame, durationInFrames: seconds(AUDIO_SECONDS.wrong, fps), volume: clamp01(sfx * 0.75) });
      cues.push({ id: `thud-${g.letter}`, src: AUDIO.thud, from: g.frame, durationInFrames: seconds(AUDIO_SECONDS.thud, fps), volume: clamp01(sfx * 0.95) });
    }
  }

  // Letters popping in at the final reveal get a rapid typewriter run (one click per letter).
  const finalFrames = [...new Set(timeline.charRevealFrames.filter((f) => Number.isFinite(f) && f >= timeline.finalRevealFrame))].sort((a, b) => a - b);
  finalFrames.forEach((frame, k) => {
    cues.push({ id: `type-final-${k}`, src: AUDIO.typewriter, from: frame, durationInFrames: seconds(AUDIO_SECONDS.typewriter, fps), volume: clamp01(sfx * 0.75) });
  });

  // 5. Victory: dark brass swell 00:25 → peak 00:28, then the reveal sting at the reveal frame.
  const swellFrom = Math.max(0, timeline.finalRevealFrame - Math.round(SWELL_LEAD_SECONDS * fps));
  cues.push({ id: "brass-swell", src: AUDIO.swell, from: swellFrom, durationInFrames: seconds(AUDIO_SECONDS.swell, fps), volume: clamp01(sfx * 0.85) });
  cues.push({ id: "reveal-sting", src: AUDIO.reveal, from: timeline.finalRevealFrame, durationInFrames: seconds(AUDIO_SECONDS.reveal, fps), volume: clamp01(sfx) });

  // 6. Loop point: the end of the song rewinds over the last LOOP_RESET_SECONDS and hard-stops
  //    right as frame 0's gavel hits on the replay (everything else ducks under it, see AudioTrack).
  const loopLen = Math.round(LOOP_RESET_SECONDS * fps);
  const durationFrames = Math.round(DURATION_SECONDS * fps);
  cues.push({ id: LOOP_REWIND_CUE_ID, src: AUDIO.loopRewind, from: durationFrames - loopLen, durationInFrames: loopLen, volume: clamp01(Math.max(audio.music, 0.2) * 2.2) });

  return cues.sort((a, b) => a.from - b.from || a.id.localeCompare(b.id));
}
