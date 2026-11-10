"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { Pause, Play, SkipBack } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DURATION_FRAMES, DURATION_SECONDS, FPS } from "@/remotion/constants";
import { countdownAt, formatClock, resolveTimeline } from "@/remotion/timeline";
import type { ReelProps } from "@/remotion/types";
import { useReelStore } from "@/store/reel-store";
import { cn } from "@/lib/utils";

/**
 * Custom timeline under the player: scrub by click/drag, and drag the
 * keyframe markers themselves to re-time individual guesses.
 */
export function TimelineScrubber({ playerRef, inputProps }: { playerRef: RefObject<PlayerRef | null>; inputProps: ReelProps }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const setGuess = useReelStore((s) => s.setGuess);
  const update = useReelStore((s) => s.update);
  const timeline = useMemo(() => resolveTimeline(inputProps, FPS), [inputProps]);

  // Attach to the player once it has mounted (it is loaded dynamically).
  useEffect(() => {
    let raf = 0;
    let detach: (() => void) | undefined;
    const attach = () => {
      const p = playerRef.current;
      if (!p) {
        raf = requestAnimationFrame(attach);
        return;
      }
      const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
      const onPlay = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      p.addEventListener("frameupdate", onFrame);
      p.addEventListener("seeked", onFrame);
      p.addEventListener("play", onPlay);
      p.addEventListener("pause", onPause);
      detach = () => {
        p.removeEventListener("frameupdate", onFrame);
        p.removeEventListener("seeked", onFrame);
        p.removeEventListener("play", onPlay);
        p.removeEventListener("pause", onPause);
      };
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      detach?.();
    };
  }, [playerRef]);

  const timeFromPointer = useCallback((clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * DURATION_SECONDS;
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      const f = Math.min(DURATION_FRAMES - 1, Math.round(seconds * FPS));
      playerRef.current?.seekTo(f);
      setFrame(f);
    },
    [playerRef],
  );

  const startScrub = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekTo(timeFromPointer(e.clientX));
    const move = (ev: PointerEvent) => seekTo(timeFromPointer(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Drag a keyframe marker → re-time that guess (or the final reveal). */
  const startMarkerDrag = (e: React.PointerEvent, onTime: (t: number) => void) => {
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const t = Math.round(timeFromPointer(ev.clientX) * 10) / 10;
      onTime(t);
      seekTo(t);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pct = (frame / (DURATION_FRAMES - 1)) * 100;
  const guessIndex = (letter: string) => inputProps.guesses.findIndex((g) => g.letter.toUpperCase() === letter);

  return (
    <div className="w-full max-w-3xl rounded-xl border border-border bg-card/80 p-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Button size="icon" variant="ghost" aria-label="Restart" onClick={() => seekTo(0)}>
          <SkipBack />
        </Button>
        <Button size="icon" variant="secondary" aria-label={playing ? "Pause" : "Play"} onClick={() => playerRef.current?.toggle()}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <div className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
          {(frame / FPS).toFixed(2)}s / {DURATION_SECONDS}.00s · frame {frame}
        </div>
        <div className="ml-auto rounded-md border border-primary/40 px-2 py-0.5 font-display text-sm tracking-wider text-primary">
          {formatClock(countdownAt(frame, FPS))}
        </div>
      </div>

      <div ref={trackRef} onPointerDown={startScrub} className="relative h-14 cursor-pointer touch-none select-none rounded-md bg-muted/60">
        {/* second gridlines */}
        {Array.from({ length: DURATION_SECONDS + 1 }, (_, s) => (
          <div key={s} className={cn("absolute bottom-0 w-px bg-white/10", s % 5 === 0 ? "h-3" : "h-1.5")} style={{ left: `${(s / DURATION_SECONDS) * 100}%` }} />
        ))}

        {/* guess keyframes */}
        {timeline.guesses.map((g) => (
          <motion.button
            key={g.letter}
            layout
            type="button"
            title={`${g.letter} · ${g.time.toFixed(1)}s · ${g.kind} — drag to re-time`}
            onPointerDown={(e) => {
              const idx = guessIndex(g.letter);
              startMarkerDrag(e, (t) => setGuess(idx, { time: t }));
            }}
            className={cn(
              "absolute top-1.5 grid h-6 w-6 -translate-x-1/2 cursor-ew-resize place-items-center rounded font-display text-xs",
              g.kind === "correct" ? "bg-primary text-primary-foreground" : "bg-destructive text-white",
              g.frame >= timeline.finalRevealFrame && g.kind === "correct" && "opacity-40",
            )}
            style={{ left: `${(g.frame / (DURATION_FRAMES - 1)) * 100}%` }}
          >
            {g.letter}
          </motion.button>
        ))}

        {/* final reveal marker */}
        <button
          type="button"
          title="Final reveal — drag to re-time"
          onPointerDown={(e) => startMarkerDrag(e, (t) => update({ finalRevealAt: Math.max(3, Math.min(29.5, t)) }))}
          className="absolute top-0 h-full w-1.5 -translate-x-1/2 cursor-ew-resize rounded bg-white/80"
          style={{ left: `${(timeline.finalRevealFrame / (DURATION_FRAMES - 1)) * 100}%` }}
        >
          <span className="absolute -top-0.5 left-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-white/80">reveal</span>
        </button>

        {/* playhead */}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_white]" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>Drag the track to scrub · drag a letter to re-time it</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-primary" /> correct</span>
          <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-destructive" /> wrong</span>
        </span>
      </div>
    </div>
  );
}
