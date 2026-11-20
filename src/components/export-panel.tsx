"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, FileJson, Film, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReelProps } from "@/remotion/types";
import type { RenderJobPublic } from "@/lib/render-jobs";
import { toPuzzleData, useReelStore } from "@/store/reel-store";

const CLI = `npx remotion render src/remotion/index.ts HangmanReel renders/hangman-reel-4k.mp4 --props=./reel-props.json`;

export function ExportPanel({ inputProps }: { inputProps: ReelProps }) {
  const [job, setJob] = useState<RenderJobPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const poll = (id: string) => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const res = await fetch(`/api/render/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as RenderJobPublic;
      setJob(j);
      if (j.status === "done" || j.status === "error") clearInterval(timer.current);
    }, 1000);
  };

  const start = async () => {
    setError(null);
    setJob(null);
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inputProps, showSafeZones: false, ...(videoFileName() ? { fileName: videoFileName() } : {}) }),
    });
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Render failed to start");
    setJob(body);
    poll(body.id);
  };

  /** "video-007-TYRION" while a library video is loaded, so renders can be matched to posts. */
  const videoFileName = () => {
    const { videoNumber, word } = useReelStore.getState();
    return videoNumber ? `video-${String(videoNumber).padStart(3, "0")}-${word.replace(/\s+/g, "-")}` : "";
  };

  const saveJson = (data: unknown, name: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const downloadProps = () => saveJson({ ...inputProps, showSafeZones: false }, "reel-props.json");
  const downloadPuzzle = () => saveJson(toPuzzleData(useReelStore.getState()), "puzzle.json");

  const fileInput = useRef<HTMLInputElement>(null);
  const importPuzzle = async (file: File | undefined) => {
    if (!file) return;
    try {
      useReelStore.getState().loadPuzzle(JSON.parse(await file.text()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read puzzle JSON");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const busy = job && (job.status === "queued" || job.status === "bundling" || job.status === "rendering");
  const pct = Math.round((job?.progress ?? 0) * 100);

  return (
    <section className="mt-1 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Film className="size-4 text-primary" /> 4K Export
        <span className="ml-auto text-[10px] font-normal uppercase tracking-wider text-muted-foreground">H.264 50 Mbps · AAC 320k</span>
      </div>

      <Button size="lg" onClick={start} disabled={!!busy || !inputProps.word}>
        {busy ? <Loader2 className="animate-spin" /> : <Film />}
        {busy ? "Rendering…" : "Render 4K MP4"}
      </Button>

      <AnimatePresence>
        {job && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="capitalize">
                {job.status}
                {job.status === "rendering" && ` · ${job.renderedFrames}/${job.totalFrames} frames`}
              </span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${pct}%` }} transition={{ ease: "easeOut" }} />
            </div>
            {job.status === "done" && (
              <Button asChild variant="secondary">
                <a href={`/api/render/${job.id}/download`}>
                  <Download /> Download MP4 {job.sizeBytes ? `(${(job.sizeBytes / 1024 / 1024).toFixed(1)} MB)` : ""}
                </a>
              </Button>
            )}
            {job.status === "error" && (
              <p className="flex gap-2 text-xs text-destructive">
                <XCircle className="size-4 shrink-0" /> {job.error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={downloadPuzzle} title="HangmanPuzzleData for /api/render-reel or npm run batch">
          <FileJson /> puzzle.json
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
          <Upload /> Import puzzle
        </Button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => importPuzzle(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={downloadProps}>
          <FileJson /> props.json
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(CLI);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} CLI command
        </Button>
      </div>
      <code className="block break-all rounded bg-black/40 p-2 text-[10px] leading-relaxed text-muted-foreground">{CLI}</code>
    </section>
  );
}
