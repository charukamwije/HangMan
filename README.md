# Hangman Reel Studio

Generates 30-second, 9:16 @ 30 fps Hangman reels (2160×3840 master or 1080×1920) with synced audio for Reels, Shorts and TikTok.
It's built with Next.js 15 (App Router), Remotion 4, Tailwind v4, shadcn-style UI, Zustand and Framer Motion.

```bash
npm install          # also generates the SFX WAVs in public/audio (postinstall)
npm run dev          # http://localhost:3000 — control panel + live 9:16 preview
```

## Project structure

```
scripts/generate-sfx.mjs      Procedural 48 kHz stereo SFX synth (ambient, gavel, tick/tock + 5 rising final ticks, typewriter, chime, thud, brass swell, reveal)
public/audio/*.wav            Generated audio. Drop in your own licensed files with the same names to replace them
remotion.config.ts            CLI render defaults (H.264 50M, AAC 320k, bt709, JPEG 95)
src/remotion/                 Self-contained composition (relative imports only, so Remotion's bundler can build it)
  index.ts / Root.tsx         registerRoot + HangmanReel (2160x3840) and HangmanReel1080 (1080x1920), 30 fps, 900 frames
  HangmanReel.tsx             Scales the 4K design stage to the output size; layers, red flash, bloom, safe-zone overlay
  timeline.ts                 Pacing engine: autoSchedule() beat grid, resolveTimeline() (+ hint letter), countdown math
  puzzle/                     HangmanPuzzleData types, zod + JSON Schema, calculateFrameTimeline()
  HangmanPuzzleReel.tsx       HangmanPuzzle(1080) compositions: raw puzzle JSON as input props
  audioCues.ts                buildAudioCues(): gameplay timeline → frame-pinned sound cues (pure, testable)
  motion.ts                   Frame-driven helpers: strikeShake() spring, stressAt() (< 00:08 tension + tick pulse)
  types.ts / defaults.ts      ReelProps (serializable input props) + defaults
  themes.ts / fonts.ts        3 preset themes; Anton + Inter via @remotion/google-fonts
  components/
    Background.tsx            Library shelves, perspective chess board, audio-reactive lamp, dust (no fade-in)
    KenBurns.tsx              1.00 → 1.08 linear push-in on the background across the full reel
    StressVignette.tsx        Base vignette + stress layer that closes in and throbs on each tick below 00:08
    CountdownTimer.tsx        00:29 → 00:00 1 Hz neon clock; below 00:08 it pulses in sync with the vignette
    HookBanner.tsx            Urgent "95% FAIL THIS" banner, fully visible on frame 0
    Header.tsx                Hook banner, category (neon) and subtitle (white)
    WordBoard.tsx             Underscores + spring/glow letter reveals, wraps long answers onto more lines
    LivesRow.tsx              Mistake counter: one pawn per mistake, knocked over in red
    Keyboard.tsx              4-row A–Z grid; correct = neon fill, wrong = red + X; key box springs sideways on each strike
    AudioTrack.tsx            Maps each cue to a <Sequence> + @remotion/media <Audio>, starting on its exact frame
scripts/batch-render.mjs      Bundle once, render every puzzle JSON (npm run batch)
puzzles/*.json                Sample daily puzzles (auto timing and hand-set frames)
src/app/
  page.tsx, layout.tsx        Studio shell
  api/render-reel/route.ts    POST puzzle(s) → validate → frame timeline → render job(s) / ?wait=1 MP4; GET → JSON Schema
  api/render/route.ts         POST  → validate (zod) → queue a render job
  api/render/[id]/route.ts    GET   → status / progress
  api/render/[id]/download    GET   → streams the MP4
src/lib/render-jobs.ts        bundle() + selectComposition() + renderMedia(), one render at a time
src/store/reel-store.ts       Zustand store (saved to localStorage) + toReelProps()
src/components/               Studio, ControlPanel, PreviewPlayer, TimelineScrubber, ExportPanel, ui/*
```

## Retention hook (first 5 seconds)

- **Frame 0 is a full frame**: hook banner, category, every word slot, one pre-filled **hint letter** (first letter by default), the clock and the keys. Nothing fades in, so frame 0 also works as the thumbnail.
- **First beats**: a correct reveal at 2.0 s and usually a strike around 4.4 s, so viewers see both outcomes before 5 s.
- **Strike feedback**: the key box is kicked 5 px sideways (at 1080p; 10 px at 4K) by an underdamped spring that settles in about 0.35 s.
- **Stress mode**: from 00:07 the vignette closes in and throbs on every tick, exactly in sync with the neon clock. It releases at 00:00 for the reveal.

## Sound design

All cues come from `buildAudioCues()` and start on whole frames, so the Player and `npx remotion render` sound the same.

| When | Sound |
| --- | --- |
| Frame 0 | Heavy hardwood gavel impact |
| Every second (every 30 frames) | Mechanical tick/tock on each clock change; 00:05 → 00:01 rise 2 semitones per tick and get louder |
| Correct reveal frame | Typewriter key strike + subtle metallic chime; a typewriter run as the remaining letters pop in at the reveal |
| Wrong strike frame | Deep mahogany wood thud as the key turns red |
| 00:25 → 00:28 | Dark brass swell (starts 4 s before the reveal, peaks 1 s before), then the reveal sting at 00:29 |

Run `npm run sfx` to regenerate the WAVs. To use your own sounds, replace any file in `public/audio` with one of the same name.

## Pacing engine

- **Auto mode** puts guesses on a beat grid: the first at 2.0 s, then one every 2.0–2.5 s (snapped to 0.1 s, so 60–75 frames at 30 fps), ending 2.5 s or more before the final reveal.
  - Too few guesses to fill the grid: held-back letters are released first (one is always kept for the reveal), then plausible decoy misses (E, T, A, O…) are added, up to 6 mistakes. Very short words can still end early.
  - Too many guesses: the rarest correct letters move to the final reveal and surplus misses are dropped.
  - Common letters come first, because each one reveals more tiles.
  - The rarest `holdBack` letters stay hidden until the final reveal.
  - Wrong guesses are spread evenly between the correct ones.
- **Manual mode**: turns on as soon as you edit a time. You can set times in the keyframe table, or drag the letter markers on the timeline under the player.
- **Final reveal**: any letters still hidden pop in one after another (0.1 s apart) at `finalRevealAt`. The default is 29 s, which is when the 1 Hz clock (00:29 on frame 0) reaches 00:00. The reveal sting plays at the same moment.
- **Wrong letters that are in the answer**: if a "wrong" letter actually appears in the answer (for example M in LANDMARKS), it's treated as correct and the panel shows a warning.

## Daily automation (puzzle JSON → MP4)

One `HangmanPuzzleData` object makes one 30 s, 900-frame reel. The schema and timeline math are in `src/remotion/puzzle/`.

```json
{
  "id": "2026-11-11-landmarks",
  "topic": "GLOBAL LANDMARKS & GEOGRAPHY",
  "hint": "A TRICKY US & UK CHALLENGE WORD",
  "secretWord": "LANDMARKS",
  "wrongGuesses": ["B", "W", "X", "Q"],
  "revealSequence": [],
  "viralHookText": "95% FAIL THIS"
}
```

- Leave `revealSequence` empty and `calculateFrameTimeline()` builds one: the prefilled letter at frame 0, a guess every 60–75 frames from frame 60, and the reveal at frame 870. Every frame stays inside 0–899.
- To set the timing by hand, give `{ "frame", "letter", "status" }` entries. Only `correct` and `wrong` entries are read; their status is re-checked against the word, and frames are kept between 1 and 869. Any change made is returned in `warnings`.
- Optional fields: `prefilledLetter`, `holdBack`, `themeId` and `audio`.

**API** (needs `npm run dev` or `npm start`):

```bash
curl http://localhost:3000/api/render-reel                       # JSON Schema + example + its timeline
curl -X POST "http://localhost:3000/api/render-reel?dryRun=1" -H "Content-Type: application/json" -d @puzzles/2026-11-11-landmarks.json
curl -X POST  http://localhost:3000/api/render-reel -H "Content-Type: application/json" -d @puzzles/2026-11-11-landmarks.json   # 202 + job URLs
curl -X POST "http://localhost:3000/api/render-reel?wait=1" -H "Content-Type: application/json" -d @puzzles/2026-11-11-landmarks.json -o reel.mp4
```

- The body can be one puzzle, an array, or `{ "puzzles": [...] }`, up to 31.
- `?resolution=1080p` renders 1080×1920; the default is 4K.
- Without `?wait=1`, poll `GET /api/render/:id` and then fetch `/download`.
- Renders queue one at a time on the server.

**CLI batch** (no server needed): `npm run batch` renders every `puzzles/*.json` file to `renders/<id>-4k.mp4`. To render specific files or folders: `npm run batch -- path/to/day.json more-puzzles/ --resolution=1080p`. You can also render one file directly with `npx remotion render src/remotion/index.ts HangmanPuzzle out.mp4 --props=puzzles/day.json`.

**Studio:** the export panel can save the current reel as `puzzle.json` and import one.

## Rendering

**From the UI:** click **Render 4K MP4**, wait for the progress bar, then download. This needs a long-running Node server (`npm run build && npm start`, a VM or Docker). Serverless hosts stop background work after the response, so use `@remotion/lambda` or a worker queue there.

**From the CLI:**

```bash
npm run render                                   # default props
# Export props.json from the UI (saves reel-props.json), then:
npx remotion render src/remotion/index.ts HangmanReel renders/hangman-reel-4k.mp4 --props=./reel-props.json
# Explicit flags (same as remotion.config.ts):
npx remotion render src/remotion/index.ts HangmanReel out.mp4 --props=./reel-props.json \
  --codec=h264 --video-bitrate=50M --audio-codec=aac --audio-bitrate=320k \
  --pixel-format=yuv420p --color-space=bt709 --concurrency=50%
npm run still                                    # poster frame (PNG)
npx remotion render src/remotion/index.ts HangmanReel1080 out-1080.mp4   # 1080×1920
npm run studio                                   # Remotion Studio
```

The output is H.264 2160×3840 (or 1080×1920) at 30 fps (about 43–50 Mbps at 4K) with AAC stereo audio at 48 kHz / 320 kbps.

## Notes

- Motion inside the composition is driven by Remotion's `spring`/`interpolate` and the current frame, so every render comes out the same. Framer Motion is only used in the studio UI.
- Remotion has its own license. It's free for individuals and small companies, but larger companies need a company license (see remotion.dev/license).
