import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRenderJob, toPublic } from "@/lib/render-jobs";
import { COMPOSITION_ID, COMPOSITION_ID_1080, FPS } from "@/remotion/constants";
import { calculateFrameTimeline, EXAMPLE_PUZZLE, puzzleBatchSchema, puzzleJsonSchema, type HangmanPuzzleData } from "@/remotion/puzzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Only matters on hosts that enforce it; `?wait=1` holds the request for the whole render. */
export const maxDuration = 900;

const querySchema = z.object({
  /** Hold the request open and respond with the MP4 itself (single puzzle only). */
  wait: z.enum(["0", "1", "true", "false"]).optional().transform((v) => v === "1" || v === "true"),
  /** Validate + compute timelines without rendering. */
  dryRun: z.enum(["0", "1", "true", "false"]).optional().transform((v) => v === "1" || v === "true"),
  resolution: z.enum(["4k", "1080p"]).default("4k"),
});

const fileNameFor = (p: HangmanPuzzleData, word: string) => p.id ?? `${new Date().toISOString().slice(0, 10)}-${word.replace(/ /g, "-").toLowerCase()}`;

/**
 * POST /api/render-reel — HangmanPuzzleData → 30 s / 900-frame vertical MP4.
 *
 * Body: one puzzle, an array of puzzles, or { "puzzles": [...] } (max 31).
 * Query:
 *   ?resolution=4k|1080p   default 4k (2160×3840)
 *   ?wait=1                single puzzle: respond with the finished video/mp4
 *   ?dryRun=1              validate and return the computed frame timelines only
 *
 * Default response (202): one job per puzzle with its frame timeline and the
 * status / download URLs (GET /api/render/:id, GET /api/render/:id/download).
 * Renders run one at a time on this server process.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return NextResponse.json({ error: "Invalid query", details: z.prettifyError(query.error) }, { status: 400 });
  const { wait, dryRun, resolution } = query.data;

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  const parsed = puzzleBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid HangmanPuzzleData", details: z.prettifyError(parsed.error), issues: parsed.error.issues, schema: `${url.origin}/api/render-reel` },
      { status: 400 },
    );
  }
  const puzzles = parsed.data;
  if (wait && puzzles.length > 1) return NextResponse.json({ error: "?wait=1 accepts a single puzzle; omit it for batches" }, { status: 400 });

  // Timeline math happens here (not in the browser bundle) so errors return as 422s.
  const planned: { puzzle: HangmanPuzzleData; timeline: ReturnType<typeof calculateFrameTimeline> }[] = [];
  for (const [i, puzzle] of puzzles.entries()) {
    try {
      planned.push({ puzzle, timeline: calculateFrameTimeline(puzzle, FPS) });
    } catch (err) {
      return NextResponse.json({ error: `Puzzle ${i} (${puzzle.id ?? puzzle.secretWord}): ${(err as Error).message}` }, { status: 422 });
    }
  }

  const summary = (t: ReturnType<typeof calculateFrameTimeline>) => ({
    fps: t.fps,
    durationInFrames: t.durationInFrames,
    word: t.word,
    mode: t.mode,
    finalRevealFrame: t.finalRevealFrame,
    revealSequence: t.revealSequence,
    warnings: t.warnings,
  });

  if (dryRun) {
    return NextResponse.json({ puzzles: planned.map(({ puzzle, timeline }) => ({ id: puzzle.id ?? null, timeline: summary(timeline), inputProps: timeline.reelProps })) });
  }

  const compositionId = resolution === "1080p" ? COMPOSITION_ID_1080 : COMPOSITION_ID;
  const jobs = planned.map(({ puzzle, timeline }) => ({
    puzzle,
    timeline,
    job: createRenderJob(timeline.reelProps, { compositionId, fileName: `${fileNameFor(puzzle, timeline.word)}-${resolution}` }),
  }));

  if (wait) {
    const { job } = jobs[0];
    await job.finished;
    if (job.status !== "done" || !fs.existsSync(job.outputPath)) {
      return NextResponse.json({ error: "Render failed", job: toPublic(job) }, { status: 500 });
    }
    const stat = fs.statSync(job.outputPath);
    const stream = Readable.toWeb(fs.createReadStream(job.outputPath)) as ReadableStream<Uint8Array>;
    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${path.basename(job.outputPath)}"`,
        "X-Render-Job-Id": job.id,
      },
    });
  }

  return NextResponse.json(
    {
      jobs: jobs.map(({ puzzle, timeline, job }) => ({
        ...toPublic(job),
        puzzleId: puzzle.id ?? null,
        file: path.basename(job.outputPath),
        statusUrl: `${url.origin}/api/render/${job.id}`,
        downloadUrl: `${url.origin}/api/render/${job.id}/download`,
        timeline: summary(timeline),
      })),
    },
    { status: 202 },
  );
}

/** GET /api/render-reel — the payload contract: JSON Schema, an example, and its computed timeline. */
export async function GET() {
  const t = calculateFrameTimeline(EXAMPLE_PUZZLE, FPS);
  return NextResponse.json({
    schema: puzzleJsonSchema(),
    example: EXAMPLE_PUZZLE,
    exampleTimeline: { durationInFrames: t.durationInFrames, finalRevealFrame: t.finalRevealFrame, revealSequence: t.revealSequence, warnings: t.warnings },
  });
}
