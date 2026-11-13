#!/usr/bin/env node
/**
 * Batch-render daily reels from HangmanPuzzleData JSON files.
 *
 *   npm run batch                                   # every *.json in ./puzzles
 *   npm run batch -- puzzles/2026-11-11.json        # specific files or folders
 *   npm run batch -- puzzles --resolution=1080p     # 1080×1920 instead of 4K
 *
 * Each file holds one puzzle, an array of puzzles, or { "puzzles": [...] }.
 * The Remotion bundle is built once; every puzzle then renders through the
 * HangmanPuzzle composition, which validates it (zod) and computes its
 * 900-frame timeline with the same code as POST /api/render-reel.
 * Output: renders/<id or date-word>-<resolution>.mp4. A failed puzzle is
 * reported and skipped; the exit code is 1 if any failed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const resolution = flag("resolution", "4k");
if (!["4k", "1080p"].includes(resolution)) throw new Error(`--resolution must be 4k or 1080p, got ${resolution}`);
const compositionId = resolution === "1080p" ? "HangmanPuzzle1080" : "HangmanPuzzle";

// ---- collect puzzles ------------------------------------------------------
const targets = args.filter((a) => !a.startsWith("--"));
const files = (targets.length ? targets : [path.join(ROOT, "puzzles")]).flatMap((t) => {
  const p = path.resolve(t);
  if (!fs.existsSync(p)) throw new Error(`Not found: ${t}`);
  return fs.statSync(p).isDirectory()
    ? fs.readdirSync(p).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(p, f))
    : [p];
});

const jobs = files.flatMap((file) => {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(json) ? json : Array.isArray(json?.puzzles) ? json.puzzles : [json];
  return list.map((puzzle, i) => ({ file, index: i, puzzle }));
});
if (!jobs.length) {
  console.log("No puzzles found.");
  process.exit(0);
}

const slug = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
const nameFor = (p) => slug(p.id ?? `${new Date().toISOString().slice(0, 10)}-${p.secretWord ?? "puzzle"}`);

// ---- render ---------------------------------------------------------------
console.log(`Bundling Remotion project… (${jobs.length} puzzle${jobs.length === 1 ? "" : "s"}, ${resolution})`);
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "remotion", "index.ts"), publicDir: path.join(ROOT, "public") });
const outDir = path.join(ROOT, "renders");
// Keep off the Next dev port (3000) so this works while `npm run dev` is running.
const port = Number(process.env.REMOTION_RENDER_PORT) || 3123;
fs.mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const [n, { file, index, puzzle }] of jobs.entries()) {
  const label = `[${n + 1}/${jobs.length}] ${path.basename(file)}${index ? `#${index}` : ""}`;
  const outputLocation = path.join(outDir, `${nameFor(puzzle)}-${resolution}.mp4`);
  try {
    // Throws a readable "Invalid HangmanPuzzleData" error before any frame renders.
    const composition = await selectComposition({ serveUrl, id: compositionId, inputProps: puzzle, port });
    let last = -1;
    await renderMedia({
      serveUrl,
      port,
      composition,
      inputProps: puzzle,
      outputLocation,
      // Same master settings as remotion.config.ts and src/lib/render-jobs.ts.
      codec: "h264",
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      videoBitrate: resolution === "4k" ? "50M" : "16M",
      audioCodec: "aac",
      audioBitrate: "320k",
      imageFormat: "jpeg",
      jpegQuality: 95,
      concurrency: "50%",
      chromiumOptions: { gl: "angle" },
      overwrite: true,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== last) process.stdout.write(`\r${label} ${String((last = pct)).padStart(3)}%`);
      },
    });
    console.log(`\r${label} ✓ ${path.relative(ROOT, outputLocation)} (${composition.durationInFrames} frames)`);
  } catch (err) {
    failed++;
    console.error(`\r${label} ✗ ${err instanceof Error ? err.message.split("\n").slice(0, 8).join("\n    ") : err}`);
  }
}
console.log(`Done: ${jobs.length - failed} rendered, ${failed} failed.`);
process.exit(failed ? 1 : 0);
