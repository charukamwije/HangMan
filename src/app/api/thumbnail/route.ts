import { NextResponse } from "next/server";
import { z } from "zod";
import { renderThumbnailPng } from "@/lib/render-jobs";
import { THEME_IDS, type ThemeId } from "@/remotion/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const thumbnailSchema = z.object({
  hookText: z.string().max(60),
  word: z.string().min(1).max(36).regex(/^[A-Za-z ]+$/, "Only letters and spaces"),
  hintLetter: z.string().regex(/^[A-Za-z]?$/).default(""),
  secondLetter: z.string().regex(/^[A-Za-z]{0,2}$/).optional(),
  themeId: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]),
  category: z.string().max(40).optional(),
  backgroundImage: z.string().regex(/^[A-Za-z0-9_\-/.]*$/).refine((p) => !p.includes(".."), "Invalid path").optional(),
});

/** POST /api/thumbnail { props, fileName? } → the custom thumbnail as a 1080×1920 PNG download. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = thumbnailSchema.safeParse(body?.props);
  if (!parsed.success) return NextResponse.json({ error: "Invalid thumbnail props", issues: parsed.error.issues }, { status: 400 });
  const name = (typeof body?.fileName === "string" ? body.fileName : "hangman-thumbnail").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 80) || "hangman-thumbnail";
  try {
    const png = await renderThumbnailPng(parsed.data);
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}.png"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Thumbnail failed" }, { status: 500 });
  }
}
