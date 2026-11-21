# The First Two Seconds, Frame by Frame

This document records everything that happens on screen and in the audio during frames **0 – 60** of the reel. At 30 fps that is 0.000 s – 2.000 s; frame 60 is included because it's the first guess, which ends the opening.

The numbers were **computed by running the reel's own code** (springs, ramps and schedules from `src/remotion`), not estimated. They describe the default props in [defaults.ts](../src/remotion/defaults.ts):

| Prop | Value |
| --- | --- |
| Word | `LANDMARKS` (9 slots, tile = 175 design px) |
| Hint letter | `L` (resolved: the word's first letter) |
| Hint 1 | "A TRICKY US & UK CHALLENGE WORD" |
| Hook text | "CAN YOU SOLVE IT?" |
| First guess | `A` at 2.0 s = frame 60 (correct) |
| Theme | `dark-academia` |
| Audio | music 0.32 · tick 0.45 · sfx 0.9 |

All positions and sizes are in **design px** on the 2160 × 3840 canvas. The 1080p render is the same frame scaled by 0.5.

---

## 1. The opening at a glance

| Frames | Time | Phase | What the viewer gets |
| --- | --- | --- | --- |
| 0 | 0.000 s | **Scroll-stopper** | The full layout is already on screen. The whole stage starts zoomed to 1.05× and snaps back. Gavel, digital slap-pop, decode clicks and the tape-rewind all start together |
| 0 – 29 | 0.00 – 0.97 s | **Phase 1: Decoding** | 13 "decoy" letters machine-gun into the empty slots, scrambling then locking crimson, with accelerating gaps (4 → 1 frame). Every lock kicks the board and flashes the screen edges red. A scan beam sweeps the board. A giant faint "?" sits behind the slots |
| 16 | 0.533 s | **Hint lock** | The real `L` snaps into slot 0 and its key lights up. Metallic lock SFX, white exposure pop, accent bloom and a 3.5 % camera punch-in |
| 26 – 29 | 0.87 – 0.97 s | **Wipe** | The "?" fades out (26 → 30). Every decoy and the scan beam fade to 50 % on frame 29 |
| 30 | 1.000 s | **Clean board** | Decoys gone and the board shows only `L`. The rewind hard-stops, the first clock tick sounds and the clock changes 00:29 → 00:28 |
| 30 – 35 | 1.00 – 1.17 s | **Phase 2: Banner flip** | "DECODING BOARD..." drops out and "CAN YOU SOLVE IT?" drops in, then **SOLVE** punches from 1.16× back to 1× |
| 36 – 42 | 1.20 – 1.40 s | **Music handover** | The music bed fades in forward while the ambient drone fades out. Frame 42 is the first frame a guess is allowed on |
| 42 – 59 | 1.40 – 1.97 s | **Calm** | Nothing scripted moves. Only the idle loops run (owl, balloons, card glow, lamp, dust, Ken Burns) |
| 51 | 1.700 s | **Anticipation** | A whoosh starts, landing exactly on frame 60 |
| 60 | 2.000 s | **First guess** | `A` slams into slots 1 and 5, its key pops and the A callout appears. The clock reads 00:27 |

---

## 2. What is on screen from frame 0, before anything animates

Nothing fades in. [Header.tsx](../src/remotion/components/Header.tsx) is explicit about this: *"No entrance animation: everything is on screen, at full opacity, on frame 0."*

| Element | State on frame 0 | Source |
| --- | --- | --- |
| Background | Blurred mahogany library shelves, lamp glow and dust motes. The light themes show the sunlit window wall instead | [Background.tsx](../src/remotion/components/Background.tsx) |
| Ken Burns | Scale 1.000, growing linearly to 1.08 over the whole reel (≈ 1.0053 by frame 60) | [KenBurns.tsx](../src/remotion/components/KenBurns.tsx) |
| Vignette | Base cinematic vignette only. The stress layer is off until 00:07 | [StressVignette.tsx](../src/remotion/components/StressVignette.tsx) |
| Banner (top left) | "DECODING BOARD." on the marquee plate at 1.1× scale, hung from the blue "Like" and red "Subscribe" balloon clusters | [HookBanner.tsx](../src/remotion/components/HookBanner.tsx) |
| Clock (top right) | LED **00:29** in the theme accent (green phase), label "TIME LEFT" | [CountdownTimer.tsx](../src/remotion/components/CountdownTimer.tsx) |
| Hint card | "HINT" chip plus hint 1, **fully sharp** with no reveal. Glow breathes at 1.1 Hz and peaks on frame 0 | [Header.tsx](../src/remotion/components/Header.tsx) |
| Owl | Sitting on the card's top-right corner with its bucket, in idle mode | [HintOwl.tsx](../src/remotion/components/HintOwl.tsx) |
| Word board | 9 empty slots with light outlines, and a giant accent "?" behind them at 26 % opacity | [WordBoard.tsx](../src/remotion/components/WordBoard.tsx) |
| Lives row | 6 pawns standing on their shelf (none lost) | [LivesRow.tsx](../src/remotion/components/LivesRow.tsx) |
| Keyboard | A–Z in 4 rows (7/7/6/6), all idle | [Keyboard.tsx](../src/remotion/components/Keyboard.tsx) |
| Not present yet | Pigeons (first at 5 s), guess callouts (first at frame 60), "comment the word" note (after the last guess) | |

---

## 3. Master table: frames 0 – 60

### How to read the cells

| Notation | Meaning |
| --- | --- |
| **Camera** | Scale of the whole stage, centred on the word board. Combines the frame-0 slap (1.05× → 1×, ease-out cubic over 0.17 s) with the correct-reveal punch (+3.5 %) |
| **Banner** | Label text (the dots tick 1 → 3 every 3 frames), then the plate's spring scale (1.1 → 1, slight overshoot) |
| **Slots 0–8** | One cell per letter of L A N D M A R K S |
| `·` | Empty slot |
| `~Q×0.8` | Decoy **scrambling**: shows cipher glyph Q (parchment, 70 % opacity, RGB split, vertical jitter) at that scale. It pops 0 → 1.2 → 1 |
| `🟥M×1.35` | Decoy **locked**: crimson letter M punching 1.35 → 1, with a 45 % crimson wash inside the slot that fades over 3 frames |
| `α0.5` | That decoy is half faded: it is replaced or cleared on the next frame |
| `**L**↑30%` | Hint letter snapping **up** into place (stiff spring, rising from +0.5 tile at 1.6×). A % is shown only while the spring is below 99.5 % |
| `**A**⇣0%` | Guess letter slamming **down** from above at 2.6× |
| **"?"** | Opacity of the giant "?" behind the slots |
| **Scan** | Horizontal position of the crimson scan beam across the board (one pass every 10 frames, ping-pong). CRT scanlines sit under it |
| **Board FX** | `kick` = board shove from a decoy lock (px, scale). `red edge` = crimson vignette flash. `white` = full-frame exposure pop. `bloom` = accent glow over the board |
| **Keys** | Lit keys: pop scale (1.45 → 1 spring), then `dim %` = fade into the quiet "used" state |
| **Clock** | Display. `✦` = brightness flash after a tick |
| **Audio** | Cues that **start** on this frame |

| F | Time (s) | Camera | Banner | Slots 0–8 (L A N D M A R K S) | "?" | Scan | Board FX | Keys | Clock | Audio starts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0.000 | 1.05 | DECODING BOARD. · ×1.1 | · ~Z×0.8 · · · · · · · | 0.26 | -10%→ | – | – | 00:29 | gavel, hook-decode, hook-rewind, slap-pop, ambient bed (fade in 0→3) |
| 1 | 0.033 | 1.026 | DECODING BOARD. · ×1.086 | · ~K×1.13 · · · · · · · | 0.26 | 2%→ | – | – | 00:29 | – |
| 2 | 0.067 | 1.011 | DECODING BOARD. · ×1.056 | · 🟥L×1.35 · · · · · · · | 0.26 | 14%→ | kick 21px ×0.975; red edge 0.4 | – | 00:29 | – |
| 3 | 0.100 | 1.003 | DECODING BOARD.. · ×1.023 | · 🟥L×1.18 · · · · · · · | 0.26 | 26%→ | kick 8.6px ×0.981; red edge 0.2 | – | 00:29 | – |
| 4 | 0.133 | 1.001 | DECODING BOARD.. · ×0.997 | · 🟥L · · · · · · ~N×0.8 | 0.26 | 38%→ | kick -6.86px ×0.988 | – | 00:29 | – |
| 5 | 0.167 | 1 | DECODING BOARD.. · ×0.982 | · 🟥L · · · · · · ~G×1.13 | 0.26 | 50%→ | kick -7.54px ×0.994 | – | 00:29 | – |
| 6 | 0.200 | 1 | DECODING BOARD... · ×0.978 | · 🟥L · · · · · · 🟥M×1.35 | 0.26 | 62%→ | kick 21px ×0.975; red edge 0.4 | – | 00:29 | – |
| 7 | 0.233 | 1 | DECODING BOARD... · ×0.981 | · 🟥L · · · · · · 🟥M×1.18 | 0.26 | 74%→ | kick 8.6px ×0.981; red edge 0.2 | – | 00:29 | – |
| 8 | 0.267 | 1 | DECODING BOARD... · ×0.987 | · 🟥L ~B×0.8 · · · · · 🟥M | 0.26 | 86%→ | kick -6.86px ×0.988 | – | 00:29 | – |
| 9 | 0.300 | 1 | DECODING BOARD. · ×0.995 | · 🟥L ~Q×1.13 · · · · · 🟥M | 0.26 | 98%→ | kick -7.54px ×0.994 | – | 00:29 | – |
| 10 | 0.333 | 1 | DECODING BOARD. · ×1 | · 🟥L 🟥A×1.35 · · · · · 🟥M | 0.26 | 110%← | kick 21px ×0.975; red edge 0.4 | – | 00:29 | – |
| 11 | 0.367 | 1 | DECODING BOARD. · ×1.004 | · 🟥L 🟥A×1.18 · · · · ~Z×0.8 🟥M | 0.26 | 98%← | kick 8.6px ×0.981; red edge 0.2 | – | 00:29 | – |
| 12 | 0.400 | 1 | DECODING BOARD.. · ×1.005 | · 🟥L 🟥A · · · · ~K×1.13 🟥M | 0.26 | 86%← | kick -6.86px ×0.988 | – | 00:29 | – |
| 13 | 0.433 | 1 | DECODING BOARD.. · ×1.004 | · 🟥L 🟥A · · · · 🟥L×1.35 🟥M | 0.26 | 74%← | kick 21px ×0.975; red edge 0.4 | – | 00:29 | – |
| 14 | 0.467 | 1 | DECODING BOARD.. · ×1.003 | · 🟥L 🟥A ~Z×0.8 · · · 🟥L×1.18 🟥M | 0.26 | 62%← | kick 8.6px ×0.981; red edge 0.2 | – | 00:29 | – |
| 15 | 0.500 | 1 | DECODING BOARD... · ×1.001 | · 🟥L 🟥A ~K×1.13 · · · 🟥L 🟥M | 0.26 | 50%← | kick -6.86px ×0.988 | – | 00:29 | – |
| 16 | 0.533 | 1 | DECODING BOARD... · ×1 | **L**↑0% 🟥L 🟥A 🟥L×1.35 · · ~Z×0.8 🟥L 🟥M | 0.26 | 38%← | kick 21px ×0.975; red edge 0.4; white 0.18 | L ×1.45 | 00:29 | hook-lock |
| 17 | 0.567 | 1.023 | DECODING BOARD... · ×0.999 | **L**↑30.24% 🟥L 🟥A 🟥L×1.18 · · ~K×1.13 🟥L 🟥M | 0.26 | 26%← | kick 8.6px ×0.981; red edge 0.2; bloom 0.3; white 0.09 | L ×1.39 | 00:29 | – |
| 18 | 0.600 | 1.033 | DECODING BOARD. · ×0.999 | **L**↑74.47% 🟥L 🟥A 🟥L ~K×0.8 · 🟥L×1.35 🟥L 🟥M | 0.26 | 14%← | kick 21px ×0.975; red edge 0.4; bloom 0.44 | L ×1.25 | 00:29 | – |
| 19 | 0.633 | 1.03 | DECODING BOARD. · ×0.999 | **L** 🟥L 🟥A 🟥L ~S×1.13 · 🟥L×1.18 🟥L 🟥M | 0.26 | 2%← | kick 8.6px ×0.981; red edge 0.2; bloom 0.41 | L ×1.09 | 00:29 | – |
| 20 | 0.667 | 1.027 | DECODING BOARD. · ×0.999 | **L** 🟥L 🟥A 🟥L 🟥D×1.35 ~N×0.8 🟥L 🟥L 🟥M | 0.26 | -10%→ | kick 21px ×0.975; red edge 0.4; bloom 0.38 | L ×0.95 | 00:29 | – |
| 21 | 0.700 | 1.023 | DECODING BOARD.. · ×1 | **L** 🟥L α0.5 🟥A 🟥L 🟥D×1.18 ~G×1.13 🟥L 🟥L 🟥M | 0.26 | 2%→ | kick 8.6px ×0.981; red edge 0.2; bloom 0.35 | L ×0.85 | 00:29 | – |
| 22 | 0.733 | 1.02 | DECODING BOARD.. · ×1 | **L** ~N×0.8 🟥A 🟥L 🟥D 🟥M×1.35 🟥L 🟥L 🟥M α0.5 | 0.26 | 14%→ | kick 21px ×0.975; red edge 0.4; bloom 0.33 | L ×0.82 | 00:29 | – |
| 23 | 0.767 | 1.017 | DECODING BOARD.. · ×1 | **L** ~G×1.13 🟥A α0.5 🟥L 🟥D 🟥M×1.18 🟥L 🟥L ~G×0.8 | 0.26 | 26%→ | kick 8.6px ×0.981; red edge 0.2; bloom 0.3 | L ×0.84 | 00:29 | – |
| 24 | 0.800 | 1.013 | DECODING BOARD... · ×1 | **L**↑99.34% 🟥M×1.35 ~B×0.8 🟥L 🟥D 🟥M 🟥L 🟥L α0.5 ~L×1.13 | 0.26 | 38%→ | kick 21px ×0.975; red edge 0.4; bloom 0.27 | L ×0.89 | 00:29 | – |
| 25 | 0.833 | 1.01 | DECODING BOARD... · ×1 | **L**↑99.43% 🟥M×1.18 ~D×1.13 🟥L α0.5 🟥D 🟥M 🟥L ~N×0.8 🟥N×1.35 | 0.26 | 50%→ | kick 21px ×0.975; red edge 0.4; bloom 0.25 | L ×0.96 | 00:29 | – |
| 26 | 0.867 | 1.007 | DECODING BOARD... · ×1 | **L** 🟥M 🟥K×1.35 ~N×0.8 🟥D 🟥M 🟥L ~G×1.13 🟥N×1.18 | 0.26 | 62%→ | kick 21px ×0.975; red edge 0.4; bloom 0.22 | L ×1.02 | 00:29 | – |
| 27 | 0.900 | 1.003 | DECODING BOARD. · ×1 | **L** 🟥M 🟥K×1.18 ~G×1.13 🟥D 🟥M 🟥L 🟥M×1.35 🟥N | 0.2 | 74%→ | kick 21px ×0.975; red edge 0.4; bloom 0.19 | L ×1.06 | 00:29 | – |
| 28 | 0.933 | 1 | DECODING BOARD. · ×1 | **L** 🟥M 🟥K 🟥M×1.35 🟥D 🟥M 🟥L 🟥M×1.18 🟥N | 0.13 | 86%→ | kick 21px ×0.975; red edge 0.4; bloom 0.16 | L ×1.07 | 00:29 | – |
| 29 | 0.967 | 1 | DECODING BOARD. · ×1 | **L** 🟥M α0.5 🟥K α0.5 🟥M×1.18 α0.5 🟥D α0.5 🟥M α0.5 🟥L α0.5 🟥M α0.5 🟥N α0.5 | 0.07 | 98%→ α0.5 | kick 8.6px ×0.981; red edge 0.2; bloom 0.14 | L ×1.07 | 00:29 | – |
| 30 | 1.000 | 1 | DECODING BOARD.. · ×1 | **L** · · · · · · · · | 0 | – | bloom 0.11 | L ×1.05 | 00:28 ✦1 | tick-28, rewind hard-stop |
| 31 | 1.033 | 1 | intro out 50%↓ · ×1 | **L** · · · · · · · · | 0 | – | bloom 0.08 | L ×1.02 | 00:28 ✦0.9 | – |
| 32 | 1.067 | 1 | CAN YOU SOLVE IT? in 0% · ×1 | **L** · · · · · · · · | 0 | – | bloom 0.05 | L ×0.99 | 00:28 ✦0.8 | – |
| 33 | 1.100 | 1 | CAN YOU SOLVE IT? in 33.33% · ×1 | **L** · · · · · · · · | 0 | – | bloom 0.03 | L ×0.98 | 00:28 ✦0.7 | – |
| 34 | 1.133 | 1 | CAN YOU SOLVE IT? in 66.67% · ×1 | **L** · · · · · · · · | 0 | – | – | L ×0.97 | 00:28 ✦0.6 | – |
| 35 | 1.167 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.16 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×0.97 dim 8.33% | 00:28 ✦0.49 | – |
| 36 | 1.200 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.15 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×0.98 dim 16.67% | 00:28 ✦0.39 | music-bed (fade in) |
| 37 | 1.233 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.14 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×0.99 dim 25% | 00:28 ✦0.29 | – |
| 38 | 1.267 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.11 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 33.33% | 00:28 ✦0.19 | – |
| 39 | 1.300 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.08 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1.01 dim 41.67% | 00:28 ✦0.09 | – |
| 40 | 1.333 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.05 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1.01 dim 50% | 00:28 | – |
| 41 | 1.367 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.02 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1.01 dim 58.33% | 00:28 | – |
| 42 | 1.400 | 1 | CAN YOU SOLVE IT? · SOLVE ×1.01 · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1.01 dim 66.67% | 00:28 | music full · ambient out |
| 43 | 1.433 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 75% | 00:28 | – |
| 44 | 1.467 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 83.33% | 00:28 | – |
| 45 | 1.500 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 91.67% | 00:28 | – |
| 46 | 1.533 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 47 | 1.567 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 48 | 1.600 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 49 | 1.633 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 50 | 1.667 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 51 | 1.700 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | whoosh-A |
| 52 | 1.733 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 53 | 1.767 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 54 | 1.800 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 55 | 1.833 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 56 | 1.867 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 57 | 1.900 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 58 | 1.933 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 59 | 1.967 | 1 | CAN YOU SOLVE IT? · ×1 | **L** · · · · · · · · | 0 | – | – | L ×1 dim 100% | 00:28 | – |
| 60 | 2.000 | 1 | CAN YOU SOLVE IT? · ×1 | **L** **A**⇣0% · · · **A**⇣0% · · · | 0 | – | white 0.18 | L ×1 dim 100%, A ×1.45 | 00:27 ✦1 | chime-A, correct-A, tick-27, type-A |

---

## 4. The decoy schedule

The pop schedule is **fixed for every word**, from `decoyPopFrames30()` in [hook.ts](../src/remotion/hook.ts). Each pop is followed 2 frames later by a lock (the crimson "strike").

| # | Pop | Lock | Gone | Slot | Real letter | Decoy shown |
| --- | --- | --- | --- | --- | --- | --- |
| d0 | 0 | 2 | 22 | 1 | A | L |
| d1 | 4 | 6 | 23 | 8 | S | M |
| d2 | 8 | 10 | 24 | 2 | N | A |
| d3 | 11 | 13 | 25 | 7 | K | L |
| d4 | 14 | 16 | 26 | 3 | D | L |
| d5 | 16 | 18 | 30 | 6 | R | L |
| d6 | 18 | 20 | 30 | 4 | M | D |
| d7 | 20 | 22 | 30 | 5 | A | M |
| d8 | 22 | 24 | 30 | 1 | A | M |
| d9 | 23 | 25 | 30 | 8 | S | N |
| d10 | 24 | 26 | 30 | 2 | N | K |
| d11 | 25 | 27 | 30 | 7 | K | M |
| d12 | 26 | 28 | 30 | 3 | D | M |

How the schedule is built:

- **Gaps shrink 4 → 1 frame:** pops land on 0, 4, 8, 11, 14, 16, 18, 20, 22, 23, 24, 25, 26. This is the "machine gun" acceleration, and it matches the rewind audio speeding up.
- **Slot order zig-zags across the board** (1, 8, 2, 7, 3, 6, 4, 5, then again) so the eye is pulled side to side. The hint slot (0) is never used.
- **Decoys are the answer's own letters, but never the slot's correct one.** The scramble teases the answer without giving any position away.
- **Slots are revisited.** When a second decoy lands in a slot, the first one is unmounted on that same frame (for example, d0 in slot 1 is replaced by d8 on frame 22).
- **Lock frames** (2, 6, 10, 13, 16, 18, 20, 22, 24, 25, 26, 27, 28) each kick the board sideways by 21 px. The kick is an underdamped spring, so it swings +21 → +8.6 → −6.9 → −7.5 px, and the board also dips to 0.975×. Each lock fires a 0.4-opacity red edge flash that is gone 2 frames later. From frame 24 the locks are 1–2 frames apart, so the board never settles and the shake becomes a continuous rattle.

---

## 5. Audio, frame by frame

| Frame | Cue | Length | Volume | Notes |
| --- | --- | --- | --- | --- |
| 0 | `gavel` | 39 f (1.3 s) | 0.90 | Hardwood gavel + sub drop: the hook lands with a hit, not silence |
| 0 | `slap-pop` | 8 f | 0.90 | Crisp digital pop paired with the 1.05× zoom slap |
| 0 | `hook-decode` | 32 f | 0.90 | One pre-mixed file: a click on every decoy pop, click + thud on every lock (the schedule in §4) |
| 0 | `hook-rewind` | 30 f | 0.64 | The music bed played **reversed and accelerating 3× → 14×**. Its Sequence hard-stops it on frame 30 |
| 0 | ambient drone | runs to 42 | 0 → 0.32 by frame 3 | Dark drone bed under the hook |
| 16 | `hook-lock` | 15 f | 0.81 | Metallic lock as the hint `L` lands |
| 30 | `tick-28` | 4 f | 0.315 | First clock tick (00:29 → 00:28). The rewind cuts on the same frame |
| 36 | music bed | to the end | 0 → 0.32 over 36 → 42 | The same music, now **forward**. It is gridded so its downbeats land on the clock ticks |
| 36 – 42 | ambient drone | — | 0.32 → 0 | Crossfades out under the music |
| 51 | `whoosh-A` | 9 f | 0.495 | Rising whoosh ending exactly on frame 60 |
| 60 | `correct-A`, `type-A`, `chime-A`, `tick-27` | — | 0.765 / 0.81 / 0.36 / 0.315 | First guess impact + second tick |

The hook's audio is built from the same frame numbers as the visuals. The rewind's timing is mirrored in `scripts/generate-sfx.mjs` (`REWIND_SECONDS`, `MUSIC_START_FRAME_30`, `hookDecode()`), so **changing a hook frame in `hook.ts` also needs the SFX to be regenerated**.

---

## 6. Element notes

### Camera ([HangmanReel.tsx](../src/remotion/HangmanReel.tsx))
- **Frame 0 slap:** `slap = interpolate(t, [0, 0.17], [1, 0], ease-out cubic)` and `scale = 1 + 0.05·slap`. That gives 1.05 → 1.026 → 1.011 → 1.003 → 1.001 → 1 by frame 5.
- **Hint-lock punch:** the lock frame (16) counts as a "correct" event, so the stage punches in to +3.5 %, peaking at **1.033 on frame 18** and easing back by frame 28.
- The transform origin is the horizontal centre at the word board's vertical centre, so the board stays put while everything else moves.

### Banner ([HookBanner.tsx](../src/remotion/components/HookBanner.tsx))
- **Plate punch:** `spring(damping 9, stiffness 180, mass 0.6)` mapped 1.1 → 1. It overshoots to **0.978 on frame 6**, rebounds to 1.005 on frame 12 and settles by about frame 20.
- **Dots:** "DECODING BOARD" + 1, 2 or 3 dots, cycling every 3 frames (`1 + floor(f/3) % 3`).
- **Flip (30 → 35):** the intro slides down and fades over frames 30 → 32, then the hook text slides down into place over 32 → 35. The two are never legible at the same time.
- **SOLVE emphasis:** from frame 35 the word "SOLVE" (in the accent colour) zooms 1.16× → 1× with a smoothstep over 8 frames. Its letter spacing widens while it is zoomed, so it never overlaps its neighbours.
- **Always on:** the rim glow throbs at ~1.1 Hz (peak on frame 0), a sheen sweeps the plate every 3.75 s, and the balloons bob with the banner riding their lift a beat late.

### Word board ([WordBoard.tsx](../src/remotion/components/WordBoard.tsx), [OpeningHook.tsx](../src/remotion/components/OpeningHook.tsx))
- **Decoy tile life:** it pops at 0 → 1.2 → 1 over 3 frames, and the glyph is already visible mid-punch on its pop frame. Each scramble frame shows a seeded random A–Z glyph with an RGB split and vertical jitter of up to ±14 px. On the lock frame the glyph becomes the decoy letter in crimson `#D32F2F`, punching 1.35 → 1 over 2 frames with a crimson wash in the slot.
- **Hint `L` snap (frame 16):** `spring(damping 18, stiffness 420, mass 0.5)`. It rises from +0.5 tile below at 1.6× scale: 0 % → 30 % → 74 % → settled by frame 19, with a small overshoot. Its flash peaks within 1 frame and fades over 0.4 s.
- **Scan beam:** a crimson-to-pink gradient bar 1.6 tiles wide. It sweeps left to right on frames 0–9, right to left on 10–19 and left to right on 20–29, with random flicker. Under it, CRT scanlines sit at 30 % opacity.
- **Giant "?":** accent colour at 26 % opacity, breathing ±4 % at 1 Hz. It fades out over frames 26 → 30 (0.26 → 0.20 → 0.13 → 0.07 → 0).

### Keyboard ([Keyboard.tsx](../src/remotion/components/Keyboard.tsx))
- **`L` lights on frame 16:** accent fill with dark text, popping **up** to 1.45× and springing back (it dips under 1 to about 0.82 on frame 22). It glows brightest around frame 18.
- After 0.6 s it settles into the quiet "used" state over 0.4 s (frames 34 → 46), so the bright colour only pulls the eye at the moment of the lock.

### Clock ([CountdownTimer.tsx](../src/remotion/components/CountdownTimer.tsx))
- It reads **00:29 for frames 0–29**, **00:28 for frames 30–59** and **00:27 from frame 60**. That is a true 1 Hz clock whose ticks are the reel's beat grid.
- On each tick the LED brightness flashes and decays over 0.33 s (✦ 1 → 0 across frames 30 → 39).

### Idle motion that is always running
| Element | Behaviour in the first 2 s |
| --- | --- |
| Owl | **Blinks on frames 1–2** (eyelids ≈ 67 % closed; a blink every 3 s from t = 0), ear tufts twitch on frames 15–21, the head **snaps toward the hint on frames 36–41** and holds, brows rise on frames 41–48. It also breathes on a 1.5 s cycle and saccades its pupils every 0.75 s |
| Hint card | Border and glow breathe at 1.1 Hz, and the HINT chip sheen sweeps every 3.75 s |
| Balloons | Each balloon bobs and sways on its own string, and the banner follows their lift |
| Lamp + dust | Lamp flicker = sine flicker + ambient-audio energy. Dust motes drift upward at 30–102 px/s |
| Ken Burns | Steady linear push-in, about 0.009 % per frame (1.0000 → 1.0053 by frame 60) |

---

## 7. What changes for another word or theme

- **Fixed for every reel:** the frame numbers (pops 0–26, locks +2, hint lock 16, clear 30, banner flip 30–35, music 36–42, guesses ≥ 42), the camera slap, the banner animation, the clock and all the audio timings.
- **Depends on the word:** which slots get decoys (up to 8 non-hint slots spread across the word, zig-zag order), which decoy letters appear (shuffled per word), the scramble glyphs (seeded by letter + frame), and the tile size.
- **Depends on the hint letter:** if it appears several times, its slots snap **one frame apart, ending on frame 16** (for example, 3 copies snap on 14, 15 and 16).
- **Depends on the theme:** colours only. The accent drives the "?", the hint `L`, the key, the bloom and the clock, and `wrong` drives the red edge flash. On light themes the flashes and blooms use `multiply` instead of `screen`, and the red edge is scaled to 60 %. Decoy crimson `#D32F2F` is the same in every theme.
- **Depends on the first guess time:** with the default schedule it is 2.0 s. A guess is never placed before frame 42, even if requested earlier.

### Regenerating these numbers
The table comes from evaluating `resolveTimeline()`, `buildAudioCues()` and the components' spring/ramp formulas for each frame. To check a different word, run the composition in Remotion Studio (`npm run studio`) and scrub frames 0–60, or render single frames:

```bash
npx remotion still src/remotion/index.ts HangmanReel1080 out.png --frame=16
```
