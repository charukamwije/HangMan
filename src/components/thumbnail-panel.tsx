"use client";

import { useMemo, useState } from "react";
import { Thumbnail } from "@remotion/player";
import { Download, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FPS, RESOLUTIONS } from "@/remotion/constants";
import { HangmanThumbnail, thumbnailPictureFor, type ThumbnailProps } from "@/remotion/HangmanThumbnail";
import type { ReelProps } from "@/remotion/types";
import { getLibrary } from "@/data/library";
import { resolveTimeline } from "@/remotion/timeline";
import { DEFAULT_BACKGROUND_IMAGE, useReelStore, videoFileBase } from "@/store/reel-store";
import { cn } from "@/lib/utils";

/**
 * Side panel next to the player: a live preview of the custom thumbnail (HangmanThumbnail),
 * a With picture / Plain toggle (the characters picture vs the theme's shelf scene), and
 * downloads rendered on the server as 1080×1920 PNGs: the version shown, or both.
 */
export function ThumbnailPanel({ inputProps }: { inputProps: ReelProps }) {
  const videoNumber = useReelStore((s) => s.videoNumber);
  const libraryId = useReelStore((s) => s.libraryId);
  const backgroundImage = useReelStore((s) => s.backgroundImage);
  const update = useReelStore((s) => s.update);
  const withPicture = !!backgroundImage;
  // Which picture "With picture" uses depends on the theme (K-Drama scene for Seoul Cherry Blossom Night).
  const picture = thumbnailPictureFor(inputProps.themeId);
  const [busy, setBusy] = useState<"one" | "both" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The reel's second pre-filled letter, resolved by the same engine, so the board matches frame 0.
  // (hook.prefilled starts with the hint letter, so take the others.)
  const secondLetter = useMemo(() => {
    const t = resolveTimeline(inputProps, FPS);
    return t.hook.prefilled.filter((l) => l !== t.hintLetter).join("");
  }, [inputProps]);

  const props: ThumbnailProps = useMemo(
    () => ({
      hookText: inputProps.hookText,
      word: inputProps.word,
      hintLetter: inputProps.hintLetter,
      secondLetter,
      themeId: inputProps.themeId,
      category: getLibrary(libraryId).entries.find((v) => v.n === videoNumber)?.category ?? "",
      backgroundImage: withPicture ? picture : "",
    }),
    [inputProps.hookText, inputProps.word, inputProps.hintLetter, secondLetter, inputProps.themeId, withPicture, picture, videoNumber, libraryId],
  );

  /** Renders one version on the server and downloads it: "…-thumbnail.png" / "…-thumbnail-plain.png". */
  const fetchAndSave = async (picture: boolean) => {
    const base = videoFileBase({ ...useReelStore.getState(), durationSeconds: 30 }) || "hangman";
    const fileName = `${base}-thumbnail${picture ? "" : "-plain"}`;
    const body = { props: { ...props, backgroundImage: picture ? thumbnailPictureFor(props.themeId) : "" }, fileName };
    const res = await fetch("/api/thumbnail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement("a"), { href: url, download: `${fileName}.png` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = async (which: "one" | "both") => {
    setBusy(which);
    setError(null);
    try {
      // One at a time: the server renders thumbnails sequentially anyway.
      for (const picture of which === "both" ? [true, false] : [withPicture]) await fetchAndSave(picture);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thumbnail failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex w-full max-w-[240px] flex-col gap-2 rounded-xl border border-border bg-card/80 p-3 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">
        <ImageIcon className="text-primary" /> Thumbnail
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/60 p-0.5 text-xs font-medium" role="radiogroup" aria-label="Thumbnail background">
        {([
          [true, "With picture"],
          [false, "Plain"],
        ] as const).map(([picture, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={withPicture === picture}
            onClick={() => update({ backgroundImage: picture ? DEFAULT_BACKGROUND_IMAGE : "" })}
            className={cn("rounded px-2 py-1 transition-colors", withPicture === picture ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
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
      <Button size="sm" disabled={!!busy} onClick={() => download("one")}>
        {busy === "one" ? <Loader2 className="animate-spin" /> : <Download />}
        {busy === "one" ? "Rendering…" : `Download ${withPicture ? "with picture" : "plain"}`}
      </Button>
      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => download("both")}>
        {busy === "both" ? <Loader2 className="animate-spin" /> : <Download />}
        {busy === "both" ? "Rendering both…" : "Download both"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        1080×1920 PNG. Upload it as the Short&apos;s custom thumbnail.
      </p>
      {error && <p className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
