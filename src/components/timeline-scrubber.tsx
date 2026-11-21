"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { Bell, Camera, Loader2, Pause, Play, SkipBack, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DURATION_FRAMES, DURATION_SECONDS, FPS } from "@/remotion/constants";
import { countdownAt, formatClock, resolveTimeline } from "@/remotion/timeline";
import type { ReelProps } from "@/remotion/types";
import { useReelStore, videoFileBase } from "@/store/reel-store";
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
  /** A/B test B: LIKE / SUBSCRIBE take beats of their own and the letters are auto-spaced around them. */
  const ctaBeats = timeline.ctaPops.length > 0;
  const [shooting, setShooting] = useState(false);
  const [shotError, setShotError] = useState<string | null>(null);

  /** Pause, then render the current frame on the server (same engine as the video) and download it as a PNG. */
  const screenshot = async () => {
    const p = playerRef.current;
    p?.pause();
    const f = p?.getCurrentFrame() ?? frame;
    const base = videoFileBase(useReelStore.getState()) || "hangman";
    const fileName = `${base}${inputProps.ctaStyle === "pops" ? "-B" : ""}-f${String(f).padStart(3, "0")}`;
    setShooting(true);
    setShotError(null);
    try {
      const res = await fetch("/api/still", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ props: { ...inputProps, showSafeZones: false }, frame: f, fileName }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `${fileName}.png` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setShotError(err instanceof Error ? err.message : "Screenshot failed");
    } finally {
      setShooting(false);
    }
  };

  // Attach to the player once it has mounted (it is loaded dynamically).
  useEffect(() => {
    let raf = 0;
    let frameRaf = 0;
    let pendingFrame = 0;
    let detach: (() => void) | undefined;
    const attach = () => {
      const p = playerRef.current;
      if (!p) {
        raf = requestAnimationFrame(attach);
        return;
      }
      // The Player emits "frameupdate" from inside its own useEffect. Calling setFrame there directly
      // is a setState-in-effect on every frame, which trips React's "Maximum update depth exceeded"
      // check after ~50 frames of playback. Defer to the next animation frame (coalesced) instead.
      const onFrame = (e: { detail: { frame: number } }) => {
        pendingFrame = e.detail.frame;
        if (!frameRaf) {
          frameRaf = requestAnimationFrame(() => {
            frameRaf = 0;
            setFrame(pendingFrame);
          });
        }
      };
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
      cancelAnimationFrame(frameRaf);
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
        <Button size="sm" variant="outline" className="ml-auto" disabled={shooting} onClick={screenshot} title="Download this frame as a 1080×1920 PNG">
          {shooting ? <Loader2 className="animate-spin" /> : <Camera />}
          {shooting ? "Rendering…" : "Screenshot"}
        </Button>
        <div className="rounded-md border border-primary/40 px-2 py-0.5 font-display text-sm tracking-wider text-primary">
          {formatClock(countdownAt(frame, FPS))}
        </div>
      </div>

      {shotError && <p className="mb-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">Screenshot failed: {shotError}</p>}
      <div ref={trackRef} onPointerDown={startScrub} className="relative h-14 cursor-pointer touch-none select-none rounded-md bg-muted/60">
        {/* second gridlines */}
        {Array.from({ length: DURATION_SECONDS + 1 }, (_, s) => (
          <div key={s} className={cn("absolute bottom-0 w-px bg-white/10", s % 5 === 0 ? "h-3" : "h-1.5")} style={{ left: `${(s / DURATION_SECONDS) * 100}%` }} />
        ))}

        {/* guess keyframes (A/B test B re-spaces them around the CTA beats, so they can't be dragged there) */}
        {timeline.guesses.map((g) => (
          <motion.button
            key={g.letter}
            layout
            type="button"
            title={ctaBeats ? `${g.letter} · ${g.time.toFixed(1)}s · ${g.kind} · auto-spaced around the CTA beats (test B)` : `${g.letter} · ${g.time.toFixed(1)}s · ${g.kind} — drag to re-time`}
            onPointerDown={(e) => {
              if (ctaBeats) return;
              const idx = guessIndex(g.letter);
              startMarkerDrag(e, (t) => setGuess(idx, { time: t }));
            }}
            className={cn(
              "absolute top-1.5 grid h-6 w-6 -translate-x-1/2 place-items-center rounded font-display text-xs",
              ctaBeats ? "cursor-pointer" : "cursor-ew-resize",
              g.kind === "correct" ? "bg-primary text-primary-foreground" : "bg-destructive text-white",
              g.frame >= timeline.finalRevealFrame && g.kind === "correct" && "opacity-40",
            )}
            style={{ left: `${(g.frame / (DURATION_FRAMES - 1)) * 100}%` }}
          >
            {g.letter}
          </motion.button>
        ))}

        {/* A/B test B: LIKE / SUBSCRIBE beats. Click to jump there (their timing is automatic). */}
        {timeline.ctaPops.map((p) => {
          const Icon = p.kind === "like" ? ThumbsUp : Bell;
          return (
            <button
              key={p.kind}
              type="button"
              title={`${p.kind.toUpperCase()} · ${(p.frame / FPS).toFixed(1)}s · CTA pop (automatic) — click to jump here`}
              onPointerDown={(e) => {
                e.stopPropagation();
                seekTo(p.frame / FPS);
              }}
              className={cn(
                "absolute top-1.5 grid h-6 w-7 -translate-x-1/2 cursor-pointer place-items-center rounded-full ring-2 ring-white/80 [&_svg]:size-3.5",
                p.kind === "subscribe" ? "bg-[#FF0000] text-white" : "bg-primary text-primary-foreground",
              )}
              style={{ left: `${(p.frame / (DURATION_FRAMES - 1)) * 100}%` }}
            >
              <Icon strokeWidth={2.75} />
            </button>
          );
        })}

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
        <span>
          {ctaBeats ? "Drag the track to scrub · test B spaces the letters around the CTA beats automatically" : "Drag the track to scrub · drag a letter to re-time it"}
        </span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-primary" /> correct</span>
          <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-destructive" /> wrong</span>
          {ctaBeats && (
            <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-[#FF0000] ring-1 ring-white/80" /> like · subscribe</span>
          )}
        </span>
      </div>
    </div>
  );
}
