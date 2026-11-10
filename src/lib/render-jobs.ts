import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { COMPOSITION_ID } from "@/remotion/constants";
import type { ReelProps } from "@/remotion/types";

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

type RenderJob = RenderJobPublic & { outputPath: string; inputProps: ReelProps };

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "renders");

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

export const toPublic = ({ outputPath: _o, inputProps: _i, ...rest }: RenderJob): RenderJobPublic => rest;

export function getJob(id: string) {
  return jobs.get(id);
}

export function createRenderJob(inputProps: ReelProps): RenderJob {
  const id = crypto.randomUUID();
  const job: RenderJob = {
    id,
    status: "queued",
    progress: 0,
    renderedFrames: 0,
    totalFrames: 0,
    createdAt: Date.now(),
    outputPath: path.join(OUT_DIR, `hangman-${id.slice(0, 8)}.mp4`),
    inputProps: { ...inputProps, showSafeZones: false },
  };
  jobs.set(id, job);
  // Serialize renders: a 4K render saturates the machine on its own.
  g.__reelQueue = (g.__reelQueue ?? Promise.resolve()).then(() => runJob(job));
  return job;
}

async function runJob(job: RenderJob) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    job.status = "bundling";
    const serveUrl = await getServeUrl();

    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: job.inputProps });
    job.totalFrames = composition.durationInFrames;
    job.status = "rendering";

    await renderMedia({
      serveUrl,
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
