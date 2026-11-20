import { NextResponse } from "next/server";
import { reelPropsSchema } from "@/lib/schema";
import { renderFramePng } from "@/lib/render-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/still { props, frame, fileName? } → that frame as a 1080×1920 PNG download. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = reelPropsSchema.safeParse(body?.props);
  const frame = Number(body?.frame);
  if (!parsed.success || !Number.isFinite(frame)) {
    return NextResponse.json({ error: "Invalid props or frame", issues: parsed.success ? [] : parsed.error.issues }, { status: 400 });
  }
  const name = (typeof body?.fileName === "string" ? body.fileName : "hangman-frame").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 80) || "hangman-frame";
  try {
    const png = await renderFramePng(parsed.data, frame);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${name}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Screenshot failed" }, { status: 500 });
  }
}
