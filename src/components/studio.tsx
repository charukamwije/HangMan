"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { PlayerRef } from "@remotion/player";
import { Clapperboard } from "lucide-react";
import { toReelProps, useReelStore } from "@/store/reel-store";
import { ControlPanel } from "@/components/control-panel";
import { TimelineScrubber } from "@/components/timeline-scrubber";

// The Player touches window/AudioContext — client only.
const PreviewPlayer = dynamic(() => import("@/components/preview-player").then((m) => m.PreviewPlayer), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] h-full animate-pulse rounded-xl bg-card" />,
});

// Client only as well (renders the thumbnail composition in the browser).
const ThumbnailPanel = dynamic(() => import("@/components/thumbnail-panel").then((m) => m.ThumbnailPanel), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-[240px] animate-pulse rounded-xl bg-card" />,
});

export function Studio() {
  const playerRef = useRef<PlayerRef>(null);
  const state = useReelStore();

  useEffect(() => {
    void useReelStore.persist.rehydrate();
  }, []);

  const inputProps = useMemo(
    () => toReelProps(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.hookText, state.hintLetter, state.subtitle, state.hint2, state.word, state.guesses, state.finalRevealAt, state.themeId, state.audio, state.showSafeZones, state.secondLetter, state.autoSecondLetter, state.durationSeconds, state.openingStyle, state.giantHookSeconds, state.videoNumber, state.libraryId, state.coldOpenBackground],
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <aside className="scrollbar-thin flex w-full shrink-0 flex-col overflow-y-auto border-b border-border bg-card/60 lg:h-full lg:w-[440px] lg:border-b-0 lg:border-r">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Clapperboard className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl leading-none tracking-wide">HANGMAN REEL STUDIO</h1>
            <p className="mt-1 text-xs text-muted-foreground">2160×3840 / 1080×1920 · 30 fps · 30 s · AAC stereo</p>
          </div>
        </header>
        <ControlPanel inputProps={inputProps} playerRef={playerRef} />
      </aside>

      <main className="relative flex min-h-[70vh] flex-1 flex-col items-center gap-4 overflow-hidden bg-[radial-gradient(ellipse_at_top,_oklch(0.22_0.02_70)_0%,_transparent_60%)] p-4 lg:p-6">
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 xl:flex-row xl:items-start">
          <div className="h-full max-h-[calc(100dvh-180px)] aspect-[9/16] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            <PreviewPlayer ref={playerRef} inputProps={inputProps} />
          </div>
          <ThumbnailPanel inputProps={inputProps} />
        </div>
        <TimelineScrubber playerRef={playerRef} inputProps={inputProps} />
      </main>
    </div>
  );
}
