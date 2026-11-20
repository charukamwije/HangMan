"use client";

import { useMemo, useState } from "react";
import { Thumbnail } from "@remotion/player";
import { Download, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FPS, RESOLUTIONS } from "@/remotion/constants";
import { HangmanThumbnail, type ThumbnailProps } from "@/remotion/HangmanThumbnail";
import type { ReelProps } from "@/remotion/types";
import { LIBRARY } from "@/data/library";
import { useReelStore } from "@/store/reel-store";

/**
 * Side panel next to the player: a live preview of the custom thumbnail (HangmanThumbnail),
 * plus a button that renders it on the server as a 1080×1920 PNG and downloads it.
 */
export function ThumbnailPanel({ inputProps }: { inputProps: ReelProps }) {
  const videoNumber = useReelStore((s) => s.videoNumber);
  const backgroundImage = useReelStore((s) => s.backgroundImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const props: ThumbnailProps = useMemo(
    () => ({
      hookText: inputProps.hookText,
      word: inputProps.word,
      hintLetter: inputProps.hintLetter,
      themeId: inputProps.themeId,
      category: LIBRARY.find((v) => v.n === videoNumber)?.category ?? "",
      backgroundImage: backgroundImage ?? "",
    }),
    [inputProps.hookText, inputProps.word, inputProps.hintLetter, inputProps.themeId, backgroundImage, videoNumber],
  );

  const download = async () => {
    const base = videoNumber ? `video-${String(videoNumber).padStart(3, "0")}-${props.word.trim().replace(/\s+/g, "-")}` : "hangman";
    const fileName = `${base}-thumbnail`;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/thumbnail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ props, fileName }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `${fileName}.png` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thumbnail failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-[240px] flex-col gap-2 rounded-xl border border-border bg-card/80 p-3 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">
        <ImageIcon className="text-primary" /> Thumbnail
      </div>
      <div className="aspect-[9/16] w-full overflow-hidden rounded-lg ring-1 ring-white/10">
        <Thumbnail
          component={HangmanThumbnail}
          inputProps={props}
          compositionWidth={RESOLUTIONS["1080p"].width}
          compositionHeight={RESOLUTIONS["1080p"].height}
          frameToDisplay={0}
          durationInFrames={1}
          fps={FPS}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <Button size="sm" disabled={busy} onClick={download}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        {busy ? "Rendering…" : "Download PNG"}
      </Button>
      <p className="text-[11px] text-muted-foreground">1080×1920. Upload it as the Short&apos;s custom thumbnail.</p>
      {error && <p className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
