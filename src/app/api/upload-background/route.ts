import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOADS_DIR } from "@/remotion/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST /api/upload-background (multipart, field "file") → { path: "backgrounds/uploads/<hash>.jpg" }.
 * Saves the picture under public/ so both the preview Player (staticFile) and the server renderer can
 * load it. Files are named by content hash, so uploading the same picture twice reuses one file.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG or WebP picture" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Picture is larger than 15 MB" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}${ext}`;
  const dir = path.join(process.cwd(), "public", ...UPLOADS_DIR.split("/").filter(Boolean));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);

  // The render bundle copies public/ when it is built: drop a cached one so renders see the new file.
  (globalThis as unknown as { __reelBundle?: Promise<string> }).__reelBundle = undefined;
  return NextResponse.json({ path: `${UPLOADS_DIR}${name}` });
}
