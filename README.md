# Hangman Reel Studio

Generates 30-second, 9:16 @ 30 fps Hangman reels (2160×3840 master or 1080×1920) with synced audio for Reels, Shorts and TikTok.
It's built with Next.js 15 (App Router), Remotion 4, Tailwind v4, shadcn-style UI, Zustand and Framer Motion.

```bash
npm install          # also generates the SFX WAVs in public/audio (postinstall)
npm run dev          # http://localhost:3000 — control panel + live 9:16 preview
```

## Project structure

```
scripts/generate-sfx.mjs      Procedural 48 kHz stereo SFX synth (ambient, tick, tock, correct, wrong, reveal, whoosh)
public/audio/*.wav            Generated audio. Drop in your own licensed files with the same names to replace them
remotion.config.ts            CLI render defaults (H.264 50M, AAC 320k, bt709, JPEG 95)
src/remotion/                 Self-contained composition (relative imports only, so Remotion's bundler can build it)
  index.ts / Root.tsx         registerRoot + HangmanReel (2160x3840) and HangmanReel1080 (1080x1920), 30 fps, 900 frames
  HangmanReel.tsx             Scales the 4K design stage to the output size; layers, red flash, bloom, safe-zone overlay
  timeline.ts                 Pacing engine: autoSchedule() beat grid, resolveTimeline() (+ hint letter), countdown math
  motion.ts                   Frame-driven helpers: strikeShake() spring, stressAt() (< 00:08 tension + tick pulse)
  types.ts / defaults.ts      ReelProps (serializable input props) + defaults
  themes.ts / fonts.ts        3 preset themes; Anton + Inter via @remotion/google-fonts
  components/
    Background.tsx            Library shelves, perspective chess board, audio-reactive lamp, dust (no fade-in)
    KenBurns.tsx              1.00 → 1.08 linear push-in on the background across the full reel
    StressVignette.tsx        Base vignette + stress layer that closes in and throbs on each tick below 00:08
    CountdownTimer.tsx        00:30 → 00:00 neon clock; below 00:08 it pulses in sync with the vignette
    HookBanner.tsx            Urgent "95% FAIL THIS" banner, fully visible on frame 0
    Header.tsx                Hook banner, category (neon) and subtitle (white)
    WordBoard.tsx             Underscores + spring/glow letter reveals, wraps long answers onto more lines
    LivesRow.tsx              Mistake counter: one pawn per mistake, knocked over in red
    Keyboard.tsx              4-row A–Z grid; correct = neon fill, wrong = red + X; key box springs sideways on each strike
    AudioTrack.tsx            <Audio> in a <Sequence> for every tick and guess, each starting on its exact frame
src/app/
  page.tsx, layout.tsx        Studio shell
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

## Pacing engine

- **Auto mode** puts guesses on a beat grid: the first at 2.0 s, then one every 2.0–2.5 s (snapped to 0.1 s, so 60–75 frames at 30 fps), ending 2.5 s or more before the final reveal.
  - Too few guesses to fill the grid: held-back letters are released first (one is always kept for the reveal), then plausible decoy misses (E, T, A, O…) are added, up to 6 mistakes. Very short words can still end early.
  - Too many guesses: the rarest correct letters move to the final reveal and surplus misses are dropped.
  - Common letters come first, because each one reveals more tiles.
  - The rarest `holdBack` letters stay hidden until the final reveal.
  - Wrong guesses are spread evenly between the correct ones.
- **Manual mode**: turns on as soon as you edit a time. You can set times in the keyframe table, or drag the letter markers on the timeline under the player.
- **Final reveal**: any letters still hidden pop in one after another (0.1 s apart) at `finalRevealAt`. The default is 29 s, which is when the clock reaches 00:00. The reveal sting plays at the same moment.
- **Wrong letters that are in the answer**: if a "wrong" letter actually appears in the answer (for example M in LANDMARKS), it's treated as correct and the panel shows a warning.

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
