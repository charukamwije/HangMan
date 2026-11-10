import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getJob } from "@/lib/render-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/render/:id/download — stream the finished MP4. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job || job.status !== "done" || !fs.existsSync(job.outputPath)) {
    return NextResponse.json({ error: "Render not ready" }, { status: 404 });
  }
  const stat = fs.statSync(job.outputPath);
  const stream = Readable.toWeb(fs.createReadStream(job.outputPath)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${path.basename(job.outputPath)}"`,
    },
  });
}
