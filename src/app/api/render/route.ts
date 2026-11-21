import { NextResponse } from "next/server";
import { reelPropsSchema } from "@/lib/schema";
import { createRenderJob, toPublic } from "@/lib/render-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/render — validate props, enqueue a 4K 30 fps render, return the job. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = reelPropsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reel props", issues: parsed.error.issues }, { status: 400 });
  }
  // Optional file name (e.g. "video-007-TYRION" from the library); a short job id is added by createRenderJob.
  const fileName = typeof body?.fileName === "string" && body.fileName.trim() ? body.fileName.slice(0, 60) : undefined;
  const job = createRenderJob(parsed.data, { fileName });
  return NextResponse.json(toPublic(job), { status: 202 });
}
