# Video Generator Blueprint (based on Hangman Reel Studio)

Use this to build another short-form puzzle-video generator with the same architecture: a countdown timer, a hook in the first second, frame-synced sound, a seamless loop, a web control panel with live preview, and an API plus batch renderer that turn JSON into MP4s.

The reference implementation is this repo. Every file path below points into it.

---

## 1. What it produces

| Property | Value |
| --- | --- |
| Format | Vertical 9:16 MP4 for Reels, Shorts and TikTok |
| Length | 25 s = 750 frames at 30 fps. Pacing is authored on the original 30 s grid and cut at 25 s, so the word is never fully revealed |
| Resolutions | 2160×3840 master and 1080×1920 delivery (same design, scaled) |
| Video | H.264, yuv420p, bt709, 50 Mbps, JPEG 95 frames |
| Audio | AAC 320k, every sound starting on an exact frame |
| Input | One JSON object per video (validated with zod) |
| Outputs | Live preview in the browser, MP4 via API, MP4s via batch CLI |

---

## 2. Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Video engine | **Remotion 4** (`remotion`, `@remotion/player`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/cli`, `@remotion/media`, `@remotion/google-fonts`) | React components rendered frame by frame in headless Chrome, then muxed with ffmpeg |
| Web app | **Next.js 15** (App Router) + React 19 | Control panel, preview and render API in one server |
| Styling | Tailwind v4 + shadcn-style UI (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`) | Control-panel UI only; the video itself uses inline styles and SVG |
| State | **Zustand** (persisted to localStorage) | Control-panel state that maps to video props |
| Validation | **zod 4** | One schema for the API, the CLI and the composition |
| Audio assets | A procedural synth script (Node, no dependencies) writing WAVs | Reproducible, license-free SFX that any licensed file can replace |

Pin every `@remotion/*` package to the **same exact version**. Mismatched versions break the bundler and renderer.

---

## 3. Core principles

These rules are what make the output deterministic and loop cleanly. Follow them in the new project.

1. **Everything is a pure function of the frame.** Use no `setTimeout`, no `requestAnimationFrame`, no `Math.random()` and no wall-clock time. Use `useCurrentFrame()`, `interpolate`, `spring`, and Remotion's seeded `random(seed)`. The Player, Studio and every render then produce identical frames.
2. **Author in seconds, convert with `fps`.** Write durations as seconds and multiply by `fps`, so pacing survives an fps change. Opening-hook frames are written at 30 fps and scaled with `hookFrame()`.
3. **One design canvas.** Lay everything out on a fixed 2160×3840 stage (`DESIGN_WIDTH`/`DESIGN_HEIGHT`). The root component scales the whole stage to the composition's real size, so 4K and 1080p are identical in proportion.
4. **Timeline first, visuals second.** A pure "timeline engine" turns input JSON into frame numbers: guess frames, tick frames, reveal frame, hook plan. Every component and the audio-cue builder read that one timeline, so sound and picture can't drift apart.
5. **Frame 0 is a finished frame.** Nothing fades in, so frame 0 also works as the thumbnail and the hook. Effects can start at full strength on frame 0, like the zero-frame 1.08× camera punch-in.
6. **Seamless loop.** Over the last 0.6 s every element animates back to its frame-0 state (`loop.ts` → `loopReset()`). Idle motions use whole cycles per reel (25 s), for example `sin(t/25 · k · 2π)` with integer `k`, so there's no jump at the replay.
7. **Respect platform safe zones.** Keep essential UI out of the status bar, the side crops, the top-corner icons, the right action rail and the bottom caption area. The values are in `constants.ts` → `SAFE_ZONE`, `TOP_CORNERS`, `RIGHT_RAIL`, measured from real phone screenshots. A preview-only overlay (`showSafeZones`) draws them. Full map and placement rules in §15.
8. **The composition folder is self-contained.** `src/remotion/` uses relative imports only, so Remotion's own webpack bundler can build it outside Next.js.

---

## 4. Folder structure

```
project/
├─ package.json            scripts: dev, build, start, typecheck, sfx, postinstall, studio, render, still, batch
├─ next.config.mjs         serverExternalPackages: all @remotion/* + compositor binaries + esbuild
├─ remotion.config.ts      CLI render defaults (codec, bitrate, jpeg, concurrency, gl=angle)
├─ tsconfig.json           "@/*" → src/*
├─ scripts/
│  ├─ generate-sfx.mjs     Procedural SFX synth → public/audio/*.wav (postinstall runs it with --if-missing)
│  └─ batch-render.mjs     Bundle once, render every puzzle JSON in ./puzzles
├─ puzzles/*.json          Sample inputs (one video per object)
├─ public/audio/*.wav      Generated (or licensed replacement) sounds
├─ renders/                Output MP4s (gitignored except .gitkeep)
└─ src/
   ├─ remotion/            ← THE VIDEO (self-contained)
   │  ├─ index.ts          registerRoot(RemotionRoot)
   │  ├─ Root.tsx          <Composition>s: props-driven + raw-JSON-driven, each in 4K and 1080p
   │  ├─ <Game>Reel.tsx    Root component: scales the design stage, layers everything, camera shake/punch, flashes
   │  ├─ <Game>PuzzleReel.tsx  Same reel but takes raw puzzle JSON (calculateMetadata validates it)
   │  ├─ constants.ts      FPS, duration, canvas, countdown, pacing, safe zones, AUDIO paths + lengths
   │  ├─ types.ts          Serializable input props (ReelProps)
   │  ├─ defaults.ts       Default props for Studio and Player
   │  ├─ timeline.ts       Pacing engine (pure): schedule, resolveTimeline, countdown math
   │  ├─ hook.ts           Opening-hook plan (pure, no React): decoys, snap/lock frames, pulse, rattle, clue reveal
   │  ├─ audioCues.ts      buildAudioCues(timeline) → [{id, src, from, durationInFrames, volume}]
   │  ├─ motion.ts         ramp(), framesSinceLast(), strikeShake() spring, stressAt()
   │  ├─ loop.ts           loopReset(frame, duration, fps, a, b) for the replay seam
   │  ├─ themes.ts         Theme presets (dark + light surfaces, accent, wrong, panel, glow, …)
   │  ├─ fonts.ts          @remotion/google-fonts loaded at module scope
   │  ├─ puzzle/           Input JSON type, zod schema + JSON Schema, calculateFrameTimeline(), example
   │  └─ components/       One file per on-screen element (see §6)
   ├─ lib/
   │  ├─ schema.ts         zod schema for ReelProps (API + CLI props)
   │  ├─ render-jobs.ts    In-process render queue: bundle() → selectComposition() → renderMedia()
   │  └─ utils.ts          cn() helper
   ├─ app/
   │  ├─ page.tsx, layout.tsx, globals.css   Studio shell
   │  └─ api/
   │     ├─ render/route.ts               POST props → 202 job
   │     ├─ render/[id]/route.ts          GET job status / progress
   │     ├─ render/[id]/download/route.ts GET stream the MP4
   │     └─ render-reel/route.ts          POST puzzle JSON (one, array, or {puzzles}) → jobs | ?wait=1 MP4 | ?dryRun=1
   ├─ store/reel-store.ts  Zustand store + toReelProps()
   └─ components/          Studio UI: studio, control-panel, preview-player, timeline-scrubber, export-panel, ui/*
```

---

## 5. Data flow

```
puzzle JSON ──zod──▶ calculateFrameTimeline() ──▶ ReelProps
                                                      │
Control panel (Zustand) ── toReelProps() ─────────────┤
                                                      ▼
                                   resolveTimeline(props, fps)   (pure)
                                   ├─ guesses[] with frames + kind
                                   ├─ tickFrames[] (1 Hz clock)
                                   ├─ charRevealFrames[], finalRevealFrame
                                   └─ hook plan (decoys, snapFrames, lockFrame, pulse, rattle, clueReveal)
                                                      │
                        ┌─────────────────────────────┼──────────────────────────┐
                        ▼                             ▼                          ▼
              visual components            buildAudioCues(timeline)      camera / flashes
              (read frame + timeline)      → <Sequence><Audio>           (framesSinceLast)
                        └─────────────────────────────┴──────────────────────────┘
                                                      │
              Player (preview)  ·  remotion render (CLI)  ·  renderMedia (API / batch)
```

---

## 6. Component catalogue (reuse or adapt)

Layering, from back to front inside a camera layer that shakes and punches as one: background → stress vignette → header (banner, timer, hint card) → game board → lives row → keyboard → note → callouts. After that come full-frame overlays: red edge flash, red hit, white hit, accent bloom.

| Component | What it does | Reuse notes |
| --- | --- | --- |
| `Background.tsx` / `LightRoom.tsx` | Blurred library shelves (dark themes) or a sunlit room (light themes), lamp glow, dust particles | Seeded `random()` for book sizes and colours |
| `KenBurns.tsx` | 1.00 → 1.08 slow push-in across the whole reel | Generic |
| `StressVignette.tsx` | Vignette that tightens and throbs on each tick in the last seconds | Reads the shared `stressAt()` value |
| **`CountdownTimer.tsx`** | Seven-segment LED clock, 00:24 → 00:00 at 1 Hz. Theme accent colour for the first 20 s, then red. Below 00:08 "HURRY UP" and it punches on each tick. Counts back up during the loop reset | SVG segments (fixed-width digits, so no jitter). See §7 |
| `HookBanner.tsx` | Dark-glass banner with accent rim. The challenge text ("99% FAIL THIS") is legible on frame 0: the pill slams in oversized and springs back, then re-slams on the 1 s pulse. Power words (FAIL, SOLVE, IMPOSSIBLE, "99%", …) take the accent and zoom on each slam | Width from text length; slam size capped so it never reaches the clock |
| `BannerBalloons.tsx` | Two clusters of three balloons (blue "Like", red "Subscribe"), one icon each, carrying the banner. Buoyancy plus lag: the banner follows the lift 0.35 s late, tilts with uneven lift, swings like a pendulum | `bannerFloat(t, w)` returns banner motion + each cluster's lead |
| `Header.tsx` | Banner + timer row and the hint card: "HINT" chip, clue text (frosted through the hook, unlocks word by word at 2.1–3.1 s), hint 2 swap at 15 s, blur on wrong guess. When a hint 2 is set, a "NEXT HINT IN 15s" chip on the card's top-left edge counts down to it, turns accent in the last 3 s and pops out on the swap | The owl owns the top-right corner, so the teaser chip sits top-left |
| `HintOwl.tsx` | Owl on the hint card. On each wrong guess it throws a bucket of water (particle stream + splash crown); a piped brass tap then refills the bucket | Example of a "reaction character" driven by event frames |
| `OpeningHook.tsx` + `hook.ts` | First 2 s: accelerating decoy letters scramble in empty slots, the first correct letter locks on frame 4 among them, scan beam, wipe at 1 s, then a ghost-glyph rattle in the empty slots until the first guess | Plan is pure data; components only render it. See §14 |
| `WordBoard.tsx` | Letter slots; spring/slam reveals with flash and shockwave ring; celebration wave at the end | The "game board": replace for a new game |
| `LivesRow.tsx` | Mistake counter as chess pawns. A lost pawn grows limbs, walks to the ledge, hops off, freefalls, then parachutes down under a rainbow canopy | Physics: ballistic, then exponential approach to terminal speed |
| `Keyboard.tsx` | A–Z keys: correct = accent fill, wrong = red + X; the key box springs sideways on each strike | |
| `GuessCallout.tsx` | Paint-splat "SMART!" / miss words at each guess | |
| `CommentNote.tsx` | "Comment your guess" prompt after the last guess | |
| `Pigeons.tsx`, `ChessPieces.tsx` | Decorative / shared art | |
| `AudioTrack.tsx` | Maps every cue to `<Sequence from>` + `@remotion/media <Audio>`; ambient and music beds with envelopes | See §8 |

---

## 7. Countdown timer recipe

```ts
// constants.ts
export const FPS = 30;
export const DURATION_SECONDS = 25;   // rendered length: the cut, then loop to frame 0
export const PACING_SECONDS = 30;     // beat grid guesses + final reveal are authored on
export const DEFAULT_REVEAL_AT = 29;  // virtual reveal that sets the pace (past the cut)
export const COUNTDOWN_FROM = 24;      // 00:24 on frame 0
export const COUNTDOWN_ENDS_AT = 24;   // hits 00:00 at 24 s (FROM === ENDS_AT → ticks land on digit changes)
export const STRESS_BELOW_SECONDS = 8;

// timeline.ts
countdownAt(frame, fps)  = max(0, COUNTDOWN_FROM - floor(frame / fps))
tickFrames               = [fps, 2*fps, …]   // one per digit change; drives the tick SFX, flash and stress pulse
formatClock(n)           = "00:" + pad2(n)
```

Rendering rules:
- Draw digits as seven-segment SVG polygons with dim unlit segments, at a fixed width per digit, slightly skewed.
- Flash on each tick: `ramp(secondsSinceTick, [0, 0.33], [1, 0])` adds glow.
- **Colour phases:** `green = remaining > COUNTDOWN_FROM - 20` gives the theme accent for the first 20 s and red after. Every glow and ring takes `rgba(${rgb}, a)`, so one switch recolours the whole panel.
- **Stress mode:** `stressAt(frame)` returns `{level, pulse}`, shared with the vignette so both throb on the same frames. Scale up to 1.14×, bigger glow, label "HURRY UP".
- **00:00:** "TIME'S UP" blink.
- **Loop reset:** count back up to 00:24 over the last 0.6 s, so the replay starts right.
- **Audio:** tick/tock on each `tickFrames` entry; the final 5 ticks use pitched assets that rise 2 semitones each and get louder; a heartbeat 0.5 s after each tick in stress mode; the music cuts at stress start.

---

## 8. Audio system

- **Synthesize, don't download.** `scripts/generate-sfx.mjs` writes 48 kHz/16-bit stereo WAVs from oscillators, filtered seeded noise and envelopes. It covers the gavel, tick/tock, typewriter, chime, thud, whoosh, lock, slap-pop, heartbeat, brass swell, reveal sting, a music bed, and a "rewind" of it. It's deterministic. A licensed file with the same name replaces any sound.
- **`constants.ts`** holds `AUDIO` (paths) and `AUDIO_SECONDS` (lengths, used to size each `<Sequence>`).
- **`buildAudioCues(timeline, audio, fps)`** is a pure function: timeline in, sorted list of `{id, src, from, durationInFrames, volume}` out. All game sounds live there: frame-0 impact plus pop, hook decode, ticks, heartbeat, guess whoosh/correct/wrong, final typewriter run, swell, reveal, loop rewind.
- **Pre-mix dense bursts.** About 40 `<Audio>` tags mounting in the first second overflowed React's update limit in the Player. The hook's clicks were pre-mixed into one `hook-decode.wav` instead.
- **Use static volumes on cues.** A function volume re-runs every frame and updates Player state. Use functions only for one or two memoised beds (ambient, music).
- **Loop seam.** Cut every cue at the loop-reset frame. A loud rewind sound starts there and hard-stops exactly on the replay's frame-0 gavel.

---

## 9. Pacing engine (timeline.ts)

`autoSchedule()` puts events on a beat grid:
- The first event is at `AUTO_START` (2.0 s). The hook owns frames 0–59, so no event may land before frame 60 (`HOOK_FRAMES_30.end`); earlier hand-set times are clamped to it. One event every `BEAT_MIN`–`BEAT_MAX` (1.8–2.0 s), snapped to 0.1 s so it lands on whole frames. The last event comes by `AUTO_END` (22 s) and ≥ 2.5 s before the final reveal.
- **Too sparse:** release held-back answers, then add plausible decoy misses (up to `MAX_LIVES`).
- **Too dense:** push the rarest answers to the final reveal, then drop surplus misses.
- Common letters come first, because they reveal the most. Wrong guesses are spread evenly.
- **Manual mode:** hand-set times or frames, clamped and re-validated, with warnings returned.
- **Camera shots (`camera.ts`):** every impact hard-cuts to a close-up (the word board ×1.15 on a correct letter, the pawns + keys ×1.08 on a miss, +4 % in stress mode) and eases back to the wide shot ~1 s later. Close-ups are capped so the board never passes the side crop, and the camera is wide from 0.3 s before the loop reset.
- **Thinking beat (`thinking.ts`):** before each guess a cursor hops over 2 idle keys near the target, then lands on the guessed letter 0.4 s before impact (soft click per hop). For the first guess the hops run on hook frames 36 / 43 / 50, so the gap before frame 60 has a clear lead-in.
- **The cut:** the grid still spans 30 s with the reveal at 29 s, but the reel ends at 25 s. Guesses at or after 25 s are dropped (with a warning), the final reveal never renders, and the "COMMENT THE WORD" prompt is pulled in to ≥ 3 s before the end.

For a new game, keep the shape: **input → ordered events → beat grid → frames**, plus a final reveal at 00:00.

---

## 10. Rendering

**`src/lib/render-jobs.ts`** (long-lived Node server only; serverless kills background work):
1. `bundle({ entryPoint: src/remotion/index.ts, publicDir })`. Cache it in production; re-bundle per job in dev so edits apply.
2. `selectComposition({ serveUrl, id, inputProps, port })`.
3. `renderMedia({ codec: "h264", pixelFormat: "yuv420p", colorSpace: "bt709", videoBitrate: "50M", audioCodec: "aac", audioBitrate: "320k", imageFormat: "jpeg", jpegQuality: 95, concurrency: "50%", chromiumOptions: { gl: "angle" }, onProgress })`.
4. Run one render at a time (a promise-chain queue), and keep jobs on `globalThis` so they survive dev hot reloads.

**Other entry points:**
- CLI: `npm run render`, `npm run still`, `npm run studio`.
- Batch: `npm run batch`. Bundles once, renders every JSON, continues past a failed puzzle and exits 1 if any failed.
- API: `POST /api/render-reel` (`?resolution=4k|1080p`, `?wait=1` returns the MP4, `?dryRun=1` returns timelines only); `GET` returns the JSON Schema.

---

## 11. Gotchas learned here

| Problem | Fix |
| --- | --- |
| Remotion render server landed on Next's port 3000 (Windows: Next listens on IPv6), so Chrome got a 404 | Fixed render port: `REMOTION_RENDER_PORT` or 3123 |
| Next tried to bundle Remotion's native binaries | `serverExternalPackages` in `next.config.mjs` (every compositor package + esbuild) |
| `write EOF` mid-render | ffmpeg died. Usually a dev-server reload from editing files during a render, or low memory. Don't edit during long renders |
| `PackFileCacheStrategy … Expected end of object` warnings | Corrupted `.next` cache: stop the server, delete `.next`, restart |
| "Maximum update depth exceeded" in the Player | Too many `<Audio>` tags or function volumes; pre-mix and use static volumes |
| SVG gradient missing on a straight horizontal or vertical line | An `objectBoundingBox` gradient fails on a zero-height bbox; use solid strokes or `userSpaceOnUse` |
| Duplicate SVG ids across instances | Suffix ids with a per-instance seed (`chute-${seed}`) |
| Random-looking variety that must stay stable | `random(\`key-${seed}\`)` from remotion; never `Math.random()` |
| Loop jump at replay | Integer cycles per 30 s for idle motion, and `loopReset()` for state |

---

## 12. Recreating for a new game: step by step

1. **Scaffold:** `npx create-next-app` (TS, App Router, Tailwind). Add Remotion packages at one pinned version, plus zod, zustand, the shadcn utilities and framer-motion.
2. **Configs:** copy `next.config.mjs` (`serverExternalPackages`), `remotion.config.ts` and the `package.json` scripts.
3. **Constants and canvas:** `constants.ts` with FPS, duration, the 2160×3840 design canvas, the countdown, pacing values and safe zones. Keep the safe-zone numbers; they're platform facts.
4. **Input contract:** define the puzzle JSON type, its zod schema (+ JSON Schema export) and `ReelProps`.
5. **Timeline engine:** write `timeline.ts` as pure functions: puzzle → event frames, tick frames, final reveal frame. Unit-test it.
6. **Root and stage:** `Root.tsx` with 4K and 1080p compositions; the root component scales the design stage and layers the components.
7. **Reusable pieces first:** copy `motion.ts`, `loop.ts`, `themes.ts`, `fonts.ts`, `CountdownTimer.tsx`, `StressVignette.tsx`, `Background.tsx`, `KenBurns.tsx`, `HookBanner.tsx` + `BannerBalloons.tsx` and `AudioTrack.tsx`. These are game-agnostic.
8. **Game-specific pieces:** replace `WordBoard`, `Keyboard`, `LivesRow` and `OpeningHook` with the new game's board, input and failure counter. Drive them from the timeline only.
9. **Sound:** adapt `generate-sfx.mjs` and `buildAudioCues()` to the new events. Keep the frame-0 impact, ticks, final-5 rising ticks, stress heartbeat, reveal sting and loop rewind.
10. **Hook and loop:** script all of the first 2 s (§14): frame 0 complete with the challenge text already readable, an early win inside 0.2 s, a pattern interrupt at 1 s, no idle frames before the first event at 2 s. Make every element return to its frame-0 state over the last 0.6 s.
11. **Studio UI:** Zustand store → `toReelProps()` → `@remotion/player` preview, a timeline scrubber, and an export panel calling `/api/render`.
12. **Render paths:** `render-jobs.ts`, the API routes and `batch-render.mjs`.
13. **Verify:** `npm run typecheck`; render stills at key frames (0, hook end, each event, stress, reveal, last frame) and one full render before shipping.

---

## 13. Default timing map (25 s reel)

| Time | Event |
| --- | --- |
| 0.0 s | Full frame: zero-frame 1.08× punch-in + digital pop + gavel; banner "99% FAIL THIS" slams in; clue frosted; clock 00:24 (accent); "NEXT HINT IN 15s" chip |
| 0.0–1.0 s | **Cold open** (`ColdOpen.tsx`): stage dimmed except a spotlight on the board, the challenge giant and centre-screen (slams from 1.15×); 0.4 s: "9 LETTERS · 24 SECONDS" stamp + thud; 0.8–1.0 s: the card flies into the banner, which then re-slams on the 1 s pulse |
| 0.13 s | Hint letter locks (frame 4): lock SFX, key lights, white pop + bloom; it glows through the hook |
| 0.0–1.0 s | Decoys scramble at an accelerating cadence; scan beam; wipe at 1.0 s |
| 1.0 s | Pattern interrupt on the first tick: camera kick, white flash, banner re-slam, hint re-flash, pop SFX |
| 1.0–1.9 s | Ghost-glyph rattle in the empty slots under a tension push-in; music fades in (1.2–1.4 s); cut at 1.9 s |
| 1.2–1.7 s | Thinking cursor hops over the keys and lands on the first letter |
| 2.0 s | First guess, then one every 1.8–2.0 s (last by 22 s). Each one cuts to a close-up, eases back to wide ~1 s later, then the cursor hops toward the next letter |
| 2.1–3.1 s | Clue text unlocks word by word |
| 15 s | Hint 2 replaces hint 1 |
| 17 s | Stress mode (00:07): vignette and clock throb, music cuts, heartbeat |
| 19 s | Final 5 ticks rise in pitch |
| 20 s | Clock turns red (00:04) |
| ≤ 22 s | "COMMENT THE WORD YOU GUESSED!" prompt (after the last guess, at least 3 s before the end) |
| 24 s | 00:00 — time's up, word still unsolved (no reveal) |
| 24.4–25 s | Loop reset back to the frame-0 state; rewind SFX hard-stops into the replay |

---

## 14. Opening hook (frames 0–60)

Retention rule: every frame of the first 2 s carries scripted motion, and the viewer has one thing to read at a time (banner → board → clue). All numbers are authored at 30 fps in `HOOK_FRAMES_30` (`hook.ts`) and scaled with `hookFrame()`.

| Frames | Beat | Where |
| --- | --- | --- |
| 0 | Camera opens at 1.08× (no ramp), holds 3 frames, released by frame 9. Banner challenge text slams in. Gavel + slap pop | `HangmanReel.tsx`, `HookBanner.tsx`, `audioCues.ts` |
| 0–26 | Decoy pops, gaps easing 4 → 1 frame; each locks crimson 2 frames later with a board kick and red edge flash | `hook.ts` `decoyPopFrames30()`, `OpeningHook.tsx` |
| 4 | Hint lock (`snapEnd`). Its spring starts 2 frames in, so the lock frame already shows it ~75 % seated. Neon halo until frame 60 | `WordBoard.tsx` |
| 30 | `pulse`: decoys wiped, rewind hard-stops, camera kick (+4 %), white flash, board dip, banner re-slam, hint re-flash, pop SFX | `HangmanReel.tsx`, `WordBoard.tsx`, `HookBanner.tsx` |
| 30–57 | `rattle`: faint cipher glyphs in the empty slots, cadence 3 → 1 frame, growing jitter and board tremor, tension push-in (+2.5 %); the giant "?" fades out at its end | `OpeningHook.tsx` `HookRattle`, `HangmanReel.tsx` |
| 36–42 | Music bed fades in forward, downbeats on the clock ticks | `AudioTrack.tsx` |
| 60 | `end`: first guess slams down; no guess may land earlier | `timeline.ts` |
| 64–94 | `clueReveal`: HINT chip flips, clue words sharpen one by one (frosted again over the loop reset) | `Header.tsx` |

The decode/rewind audio is pre-rendered on the fixed pop schedule: if `lastPop`, the gaps, `clear` or `musicIn` change, update `scripts/generate-sfx.mjs` (`hookDecode()`, `REWIND_SECONDS`, `MUSIC_START_FRAME_30`) and run `npm run sfx`.

---

## 15. Safe screen area

Reels and Shorts draw their own UI over the video, and both apps crop the sides on tall phones. Anything the viewer must read or see (banner, clock, clue, board, keys) stays inside the safe area; only decoration (balloons, background, pigeons, bloom) may cross into the hatched zones.

The numbers were measured from real phone screenshots of the reel on Instagram Reels and YouTube Shorts and live in `constants.ts`. Both apps show the video about 815 px wide on a 738 px screen, so roughly 105 design px are cropped off **each** side before any overlay is drawn.

### Zone map (2160 × 3840 design canvas)

```
x: 0   140 290                         1600   1780 2020 2160
y:0 ┌──────────────────────────────────────────────────────┐
    │ STATUS BAR · APP HEADER (full width)                 │
300 ├────────┬──────────────────────────────┬──────────────┤
    │ back / │                              │ search ·     │
    │ "Reels"│                              │ profile · ⋯  │
520 ├──┬─────┴──────────────────────────────┴──────────┬───┤
540 │  │ TOP_ROW: banner (left) ········ clock (right) │   │
    │s │                                               │ s │
    │i │   UPPER / MIDDLE BAND                         │ i │
    │d │   side crop only · SAFE_WIDTH 1880            │ d │
    │e │   centre on SAFE_CENTER_X = 1080              │ e │
1980│  │                                     ┌─────────┴───┤
    │c │   LOWER BAND                        │ RIGHT RAIL  │
    │r │   LOWER_SAFE_WIDTH 1640             │ like ·      │
    │o │   centre on LOWER_SAFE_CENTER_X 960 │ comment ·   │
    │p │                                     │ share · ⋯   │
3040├──┴─────────────────────────────────────┴─────────────┤
    │ CHANNEL · TITLE · CAPTION (YouTube ≈ 3080, IG ≈ 3420)│
3840└──────────────────────────────────────────────────────┘
```

### Values

| Zone | Constant | Design px (4K) | 1080p px | Covers |
| --- | --- | --- | --- | --- |
| Top strip | `SAFE_ZONE.top` | y < 300 | y < 150 | Status bar, app header |
| Top-left corner | `TOP_CORNERS.leftWidth` / `.bottom` | x < 290, y < 520 | x < 145, y < 260 | Instagram back arrow, "Reels" title |
| Top-right corner | `TOP_CORNERS.rightWidth` / `.bottom` | x > 1600, y < 520 | x > 800, y < 260 | Search, profile, ⋯ (both apps) |
| Side crop | `SAFE_ZONE.left` / `.right` | 140 each side | 70 each side | Tall-phone crop + margin |
| Right action rail | `RIGHT_RAIL` | x > 1780, y > 1980 | x > 890, y > 990 | Like, comment, share, save, remix (Shorts from ≈ 2050, Reels from ≈ 2430) |
| Bottom strip | `SAFE_ZONE.bottom` | y > 3040 | y > 1520 | Channel name, title, caption |

Derived helpers:

| Helper | Value | Use for |
| --- | --- | --- |
| `SAFE_WIDTH` / `SAFE_CENTER_X` | 1880 / 1080 | Anything in the upper and middle band (header, hint card, word board) |
| `LOWER_SAFE_WIDTH` / `LOWER_SAFE_CENTER_X` | 1640 / 960 | Anything below y 1980 (keyboard, lives row, callouts): sits left of the rail, so centre it on 960, not 1080 |
| `TOP_ROW` | x 200 → 1960, y 540 | The banner + clock row, just under the corner icons |

### How this reel uses it

| Element | Placement |
| --- | --- |
| Banner + clock | `TOP_ROW` (y ≥ 540). The banner's frame-0 slam is capped so it never grows into the clock |
| Hint card + "NEXT HINT" chip | Header inset 60 px inside the side crop; chip on the card's top-left edge, owl on the top-right |
| Word board | Tiles + gaps fit `SAFE_WIDTH − 80` (40 px margin each side); wraps to more lines rather than shrinking below that |
| Keyboard | Bottom edge at `3840 − SAFE_ZONE.bottom − 20` = 3020, just above YouTube's title (≈ 3080); box stays left of the rail |
| Lives row, guess callouts | Stacked up from the keyboard, inside the lower band |
| "Comment your guess" note | Directly under the keyboard (y ≈ 3036). It brushes the top of the caption zone, so it is a soft prompt only, never essential |

### Rules

1. **Essential vs decorative.** Text, the clock, the board and the keys must be fully inside the safe area. Decoration may bleed into any zone.
2. **Account for camera moves.** The stage scales around the word board's centre (punch-ins, the 1.08× frame-0 hook, shakes with overscan). Check that essential elements stay clear at the largest scale: at 1.08× the banner moves up about 120 px and still clears the corner icons (y 520).
3. **Two bands, two centres.** Above y 1980 centre on 1080; below it centre on 960 so nothing slides under the action rail.
4. **Preview it.** Turn on `showSafeZones` in the control panel (or pass it as a prop) to draw the hatched zones with labels over the Player. It is preview-only and never rendered into an MP4.
5. **Re-measure when platforms change.** These are platform facts, not design choices: when an app redesigns its overlay, take a fresh screenshot on a phone, measure in design px (screen px × 2160 / visible width), and update `constants.ts` only.
