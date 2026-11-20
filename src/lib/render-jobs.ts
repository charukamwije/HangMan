import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { COMPOSITION_ID, COMPOSITION_ID_1080, THUMBNAIL_COMPOSITION_ID } from "@/remotion/constants";
import type { ThumbnailProps } from "@/remotion/HangmanThumbnail";
import type { ReelProps } from "@/remotion/types";
import { hookVariantTag } from "@/remotion/hookTests";

/**
 * In-process render queue for a long-lived Node server (`next start`, Docker,
 * a VM). Serverless hosts kill background work after the response — use
 * @remotion/lambda or a worker there instead.
 */

export type RenderStatus = "queued" | "bundling" | "rendering" | "done" | "error";

export type RenderJobPublic = {
  id: string;
  status: RenderStatus;
  progress: number; // 0–1
  renderedFrames: number;
  totalFrames: number;
  sizeBytes?: number;
  error?: string;
  createdAt: number;
  finishedAt?: number;
};

type RenderJob = RenderJobPublic & {
  outputPath: string;
  inputProps: ReelProps;
  compositionId: string;
  /** Resolves when the job finishes (done or error); never rejects. */
  finished: Promise<RenderJob>;
};

export type RenderJobOptions = {
  /** Composition to render (default: 4K HangmanReel). */
  compositionId?: string;
  /** Output file name without extension; sanitised. Default: hangman-<id>. */
  fileName?: string;
};

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "renders");
// Remotion's render server must not land on the Next dev port (3000): on Windows Next listens on
// IPv6 so Remotion thinks 3000 is free, then Chromium's "localhost" hits Next and gets a 404.
const RENDER_PORT = Number(process.env.REMOTION_RENDER_PORT) || 3123;

// Survive Next.js dev hot-reloads.
const g = globalThis as unknown as { __reelJobs?: Map<string, RenderJob>; __reelBundle?: Promise<string>; __reelQueue?: Promise<void> };
const jobs = (g.__reelJobs ??= new Map());

/** Webpack-bundles src/remotion once per server process (re-bundles every job in dev so edits apply). */
function getServeUrl(): Promise<string> {
  if (process.env.NODE_ENV !== "production" || !g.__reelBundle) {
    g.__reelBundle = bundle({
      entryPoint: path.join(ROOT, "src", "remotion", "index.ts"),
      publicDir: path.join(ROOT, "public"),
      onProgress: () => undefined,
    }).catch((err) => {
      g.__reelBundle = undefined;
      throw err;
    });
  }
  return g.__reelBundle;
}

export const toPublic = ({ outputPath: _o, inputProps: _i, compositionId: _c, finished: _f, ...rest }: RenderJob): RenderJobPublic => rest;

const safeName = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "hangman";

export function getJob(id: string) {
  return jobs.get(id);
}

export function createRenderJob(inputProps: ReelProps, options: RenderJobOptions = {}): RenderJob {
  const id = crypto.randomUUID();
  // The hook-test variant ("control", "T1", …) goes in the name, so each Short can be logged against its variant.
  const variant = hookVariantTag(inputProps.hookTests);
  const base = options.fileName ? `${safeName(options.fileName)}-${variant}-${id.slice(0, 6)}` : `hangman-${variant}-${id.slice(0, 8)}`;
  let resolveFinished!: (job: RenderJob) => void;
  const finished = new Promise<RenderJob>((r) => (resolveFinished = r));
  const job: RenderJob = {
    id,
    status: "queued",
    progress: 0,
    renderedFrames: 0,
    totalFrames: 0,
    createdAt: Date.now(),
    outputPath: path.join(OUT_DIR, `${base}.mp4`),
    inputProps: { ...inputProps, showSafeZones: false },
    compositionId: options.compositionId ?? COMPOSITION_ID,
    finished,
  };
  jobs.set(id, job);
  // Serialize renders: a 4K render saturates the machine on its own.
  g.__reelQueue = (g.__reelQueue ?? Promise.resolve()).then(() => runJob(job)).then(() => resolveFinished(job));
  return job;
}

async function runJob(job: RenderJob) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    job.status = "bundling";
    const serveUrl = await getServeUrl();

    const composition = await selectComposition({ serveUrl, id: job.compositionId, inputProps: job.inputProps, port: RENDER_PORT });
    job.totalFrames = composition.durationInFrames;
    job.status = "rendering";

    await renderMedia({
      serveUrl,
      port: RENDER_PORT,
      composition,
      inputProps: job.inputProps,
      outputLocation: job.outputPath,
      codec: "h264",
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      videoBitrate: "50M",
      audioCodec: "aac",
      audioBitrate: "320k",
      imageFormat: "jpeg",
      jpegQuality: 95,
      concurrency: "50%",
      chromiumOptions: { gl: "angle" },
      overwrite: true,
      onProgress: ({ progress, renderedFrames }) => {
        job.progress = progress;
        job.renderedFrames = renderedFrames;
      },
    });

    job.status = "done";
    job.progress = 1;
    job.sizeBytes = fs.statSync(job.outputPath).size;
  } catch (err) {
    job.status = "error";
    job.error = err instanceof Error ? err.message : String(err);
    console.error("[render]", err);
  } finally {
    job.finishedAt = Date.now();
  }
}

/**
 * One frame as a 1080×1920 PNG, rendered by the same engine as the video (so blurs, glows and
 * blend modes match exactly). Uses its own port so it can run while a video render is going.
 */
export async function renderFramePng(inputProps: ReelProps, frame: number): Promise<Buffer> {
  const serveUrl = await getServeUrl();
  const props = { ...inputProps, showSafeZones: false };
  const port = RENDER_PORT + 1;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID_1080, inputProps: props, port });
  const f = Math.max(0, Math.min(composition.durationInFrames - 1, Math.round(frame)));
  const { buffer } = await renderStill({
    serveUrl,
    port,
    composition,
    inputProps: props,
    frame: f,
    imageFormat: "png",
    chromiumOptions: { gl: "angle" },
  });
  if (!buffer) throw new Error("Still render returned no image");
  return buffer;
}

/** The custom thumbnail (HangmanThumbnail) as a 1080×1920 PNG. */
export async function renderThumbnailPng(props: ThumbnailProps): Promise<Buffer> {
  const serveUrl = await getServeUrl();
  const port = RENDER_PORT + 1;
  const composition = await selectComposition({ serveUrl, id: THUMBNAIL_COMPOSITION_ID, inputProps: props, port });
  const { buffer } = await renderStill({ serveUrl, port, composition, inputProps: props, frame: 0, imageFormat: "png", chromiumOptions: { gl: "angle" } });
  if (!buffer) throw new Error("Thumbnail render returned no image");
  return buffer;
}
