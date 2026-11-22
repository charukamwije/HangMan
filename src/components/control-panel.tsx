"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, FlaskConical, Loader2, Music2, Palette, Plus, RotateCcw, Sparkles, Timer, Trash2, Type, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ExportPanel } from "@/components/export-panel";
import { FPS } from "@/remotion/constants";
import { LIBRARIES, getLibrary, type LibraryId } from "@/data/library";
import { THEMES, type ThemeId } from "@/remotion/themes";
import { normalizeWord, parseLetters, resolveHintLetter, resolveTimeline, uniqueLetters } from "@/remotion/timeline";
import type { OpeningStyle, ReelProps } from "@/remotion/types";
import { useReelStore } from "@/store/reel-store";
import { cn } from "@/lib/utils";

export function ControlPanel({ inputProps, playerRef }: { inputProps: ReelProps; playerRef: RefObject<PlayerRef | null> }) {
  const s = useReelStore();
  const word = normalizeWord(s.word);
  const wordLetters = useMemo(() => new Set(uniqueLetters(s.word)), [s.word]);
  // The second letter actually on the board at frame 0 (same resolver as the render).
  const second = useMemo(() => resolveTimeline(inputProps, FPS).hook.prefilled[0] ?? "", [inputProps]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!word) w.push("Enter a target word.");
    const clash = parseLetters(s.wrongLetters).filter((l) => wordLetters.has(l));
    if (clash.length) w.push(`${clash.join(", ")} ${clash.length > 1 ? "are" : "is"} in "${word}" — treated as correct, not wrong.`);
    if (word.replace(/ /g, "").length > 24) w.push("Very long answers shrink the tiles — keep it under ~24 letters.");
    const late = s.guesses.filter((g) => wordLetters.has(g.letter) && g.time >= s.finalRevealAt).map((g) => g.letter);
    const hint = resolveHintLetter(word, s.hintLetter);
    if (s.hintLetter && hint !== s.hintLetter) w.push(`${s.hintLetter} is not in "${word}" — using ${hint || "nothing"} as the hint letter.`);
    if (hint && s.guesses.some((g) => g.letter === hint)) w.push(`${hint} is pre-filled on frame 0, so its guess is skipped.`);
    const typed2 = s.secondLetter.toUpperCase();
    if (typed2 && (!wordLetters.has(typed2) || typed2 === hint)) w.push(`2nd letter ${typed2} is ${typed2 === hint ? "already the hint letter" : `not in "${word}"`}, so the first correct guess is used.`);
    if (second && second !== s.autoSecondLetter && s.guesses.some((g) => g.letter === second)) w.push(`${second} is pre-filled on frame 0, so its guess is skipped (re-time to close the gap).`);
    if (late.length) w.push(`${late.join(", ")} fall after the final reveal and will show up at the reveal instead.`);
    return w;
  }, [s.wrongLetters, s.guesses, s.finalRevealAt, s.hintLetter, s.secondLetter, s.autoSecondLetter, second, word, wordLetters]);

  const sorted = s.guesses.map((g, i) => ({ ...g, i })).sort((a, b) => a.time - b.time);

  return (
    <div className="flex flex-col gap-1 p-3">
      <LibrarySection />

      <Section icon={<FlaskConical />} title="A/B Test">
        <Field label="Frame 1 hook">
          <NativeSelect value={s.openingStyle ?? "standard"} onChange={(e) => s.update({ openingStyle: e.target.value as OpeningStyle })}>
            <option value="standard">A · Current opening</option>
            <option value="giant">B · Giant spelling hook (thumbnail frame)</option>
          </NativeSelect>
        </Field>
        {s.openingStyle === "giant" && (
          <Field label={`Thumbnail frame on screen · ${(s.giantHookSeconds ?? 0.25).toFixed(2)}s`}>
            <Slider min={0.1} max={3} step={0.05} value={s.giantHookSeconds ?? 0.25} onValueChange={(v) => s.update({ giantHookSeconds: v })} />
          </Field>
        )}
        {s.openingStyle === "giant" && <ColdOpenBackgroundField />}
        <p className="text-xs text-muted-foreground">
          {s.openingStyle === "giant"
            ? "Frame 1 is the plain thumbnail (category, giant headline, board, “N LETTERS · 30 SECONDS”); it fades into the reel after the time above, so the Short opens exactly like its thumbnail. Renders are named …-B."
            : "The current opening: banner, question line and scrambling board from frame 0."}{" "}
          Metric: viewed vs swiped. Target ≥55% → keep B as the new standard.
        </p>
      </Section>

      <Section icon={<Type />} title="Content">
        <Field label="Hook banner (frame 0)">
          <Input value={s.hookText} maxLength={60} placeholder="99% FAIL THIS" className="uppercase" onChange={(e) => s.update({ hookText: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Hint 1 (0–15 s)">
          <Input
            value={s.subtitle}
            maxLength={120}
            placeholder="e.g. A TRICKY US & UK CHALLENGE WORD"
            onChange={(e) => s.update({ subtitle: e.target.value })}
          />
          <HintLengthGuide length={s.subtitle.trim().length} />
        </Field>
        <Field label="Hint 2 (15–30 s, optional)">
          <Input
            value={s.hint2 ?? ""}
            maxLength={120}
            placeholder="e.g. FAMOUS PLACES PEOPLE TRAVEL TO SEE (empty = keep hint 1)"
            onChange={(e) => s.update({ hint2: e.target.value })}
          />
          <HintLengthGuide length={(s.hint2 ?? "").trim().length} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Secret Answer">
            <Input
              value={s.word}
              maxLength={36}
              className="font-display tracking-widest text-primary uppercase"
              onChange={(e) => s.update({ word: e.target.value.toUpperCase().replace(/[^A-Z ]/g, "") })}
            />
          </Field>
          <Field label={`Hint letter · ${resolveHintLetter(word, s.hintLetter) || "—"} on frame 0`}>
            <Input
              value={s.hintLetter}
              maxLength={1}
              placeholder="auto (1st letter)"
              className="font-display tracking-widest uppercase"
              onChange={(e) => s.update({ hintLetter: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(-1) })}
            />
          </Field>
          <Field label={`2nd letter · ${second || "—"} on frame 0`}>
            <Input
              value={s.secondLetter}
              maxLength={1}
              placeholder="auto (1st correct guess)"
              className="font-display tracking-widest uppercase"
              onChange={(e) => s.update({ secondLetter: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(-1) })}
            />
          </Field>
          <Field label="Wrong Guesses">
            <Input value={s.wrongLetters} placeholder="B, M, W, X" className="uppercase" onChange={(e) => s.update({ wrongLetters: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <AnimatePresence initial={false}>
          {warnings.map((w) => (
            <motion.p
              key={w}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 overflow-hidden rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
            </motion.p>
          ))}
        </AnimatePresence>
      </Section>

      <Section icon={<Palette />} title="Aesthetic Theme">
        <NativeSelect value={s.themeId} onChange={(e) => s.update({ themeId: e.target.value as ThemeId })}>
          {(["dark", "light"] as const).map((mode) => (
            <optgroup key={mode} label={mode === "dark" ? "Dark" : "Light"}>
              {Object.values(THEMES)
                .filter((t) => t.mode === mode)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
        <div className="flex gap-1.5">
          {[THEMES[s.themeId].accent, THEMES[s.themeId].wrong, THEMES[s.themeId].lamp, ...THEMES[s.themeId].wood].map((c, i) => (
            <span key={i} className="h-5 flex-1 rounded ring-1 ring-white/10" style={{ background: c }} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Label>Show platform safe zones (preview)</Label>
          <Switch checked={s.showSafeZones} onCheckedChange={(v) => s.update({ showSafeZones: v })} />
        </div>
      </Section>

      <Section icon={<Timer />} title="Pacing & Keyframes">
        <Field label="Video length">
          <NativeSelect value={s.durationSeconds ?? 30} onChange={(e) => s.update({ durationSeconds: Number(e.target.value) })}>
            {Array.from({ length: 21 }, (_, i) => 30 - i).map((sec) => (
              <option key={sec} value={sec}>
                {sec} s{sec === 30 ? " · full" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {(s.durationSeconds ?? 30) < 30 && (
          <p className="text-xs text-muted-foreground">
            The video ends at {s.durationSeconds} s and loops back to 0. The letter pattern is unchanged: anything after {s.durationSeconds} s
            (later guesses, the comment prompt, the final reveal) is cut. Renders are named …-{s.durationSeconds}s.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Final reveal · ${s.finalRevealAt.toFixed(1)}s`}>
            <Slider min={10} max={29.5} step={0.5} value={s.finalRevealAt} onValueChange={(v) => s.update({ finalRevealAt: v })} />
          </Field>
          <Field label={`Hold back · ${s.holdBack} letter${s.holdBack === 1 ? "" : "s"}`}>
            <Slider min={0} max={Math.max(0, wordLetters.size - 1)} step={1} value={Math.min(s.holdBack, Math.max(0, wordLetters.size - 1))} onValueChange={(v) => s.update({ holdBack: v })} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={s.autoTiming} onCheckedChange={(v) => (v ? s.autoDistribute() : s.update({ autoTiming: false }))} />
            <Label className="normal-case tracking-normal">Auto beat grid (2–2.5 s)</Label>
          </div>
          <Button size="sm" variant="outline" onClick={s.autoDistribute}>
            <Sparkles /> Re-time
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4rem_2rem] items-center gap-2 bg-muted/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Key</span>
            <span>Time (s)</span>
            <span>Frame</span>
            <span>Type</span>
            <span />
          </div>
          <AnimatePresence initial={false}>
            {sorted.map((g) => {
              const correct = wordLetters.has(g.letter);
              return (
                <motion.div
                  key={g.i}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-[2.5rem_1fr_4.5rem_4rem_2rem] items-center gap-2 border-t border-border px-2 py-1"
                >
                  <Input
                    aria-label="Letter"
                    value={g.letter}
                    className={cn("h-7 px-0 text-center font-display text-base", correct ? "text-primary" : "text-destructive")}
                    onChange={(e) => s.setGuess(g.i, { letter: e.target.value })}
                  />
                  <Input
                    aria-label="Time in seconds"
                    type="number"
                    step={0.1}
                    min={0}
                    max={29.9}
                    value={g.time}
                    className="h-7 font-mono text-xs"
                    onChange={(e) => s.setGuess(g.i, { time: Number(e.target.value) })}
                    onFocus={() => playerRef.current?.seekTo(Math.round(g.time * FPS))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">{Math.round(g.time * FPS)}</span>
                  <Badge variant={correct ? "default" : "destructive"}>{correct ? "correct" : "wrong"}</Badge>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${g.letter}`} onClick={() => s.removeGuess(g.i)}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <Button size="sm" variant="secondary" onClick={s.addGuess}>
          <Plus /> Add guess
        </Button>
      </Section>

      <Section icon={<Music2 />} title="Audio & SFX">
        <div className="flex items-center justify-between">
          <Label>Audio enabled</Label>
          <Switch checked={s.audio.enabled} onCheckedChange={(v) => s.updateAudio({ enabled: v })} />
        </div>
        {(
          [
            ["music", "Ambient dark-synth bed"],
            ["tick", "Clock tick-tock"],
            ["sfx", "Chime / buzzer / reveal"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={`${label} · ${Math.round(s.audio[key] * 100)}%`}>
            <Slider value={s.audio[key]} onValueChange={(v) => s.updateAudio({ [key]: v })} disabled={!s.audio.enabled} />
          </Field>
        ))}
      </Section>

      <ExportPanel inputProps={inputProps} />

      <Button variant="ghost" size="sm" className="mt-2 self-start text-muted-foreground" onClick={s.reset}>
        <RotateCcw /> Reset to defaults
      </Button>
    </div>
  );
}

function Section({ icon, title, children, defaultOpen = true }: { icon: ReactNode; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-border bg-background/40">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold [&_svg]:size-4">
        <span className="text-primary">{icon}</span>
        {title}
        <ChevronDown className={cn("ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Readability guide for the hint card (≈ 24 characters per line on screen):
 *   ≤ 50  two lines, ideal for a one-glance read
 *   ≤ 70  three lines, always full size even with a two-line answer
 *   > 70  the card shrinks when the answer wraps onto two lines
 */
const HINT_IDEAL = 50;
const HINT_MAX = 70;

function HintLengthGuide({ length }: { length: number }) {
  const tone = length > HINT_MAX ? "text-red-400" : length > HINT_IDEAL ? "text-amber-300" : "text-muted-foreground";
  const bar = length > HINT_MAX ? "bg-red-400" : length > HINT_IDEAL ? "bg-amber-300" : "bg-emerald-400";
  const message =
    length > HINT_MAX
      ? "Too long: the hint card shrinks when the answer wraps. Keep it under 70."
      : length > HINT_IDEAL
        ? "OK (3 lines). Under 50 reads best in one glance."
        : "Ideal length: best 50 or less, max 70.";
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full transition-all ${bar}`} style={{ width: `${Math.min(100, (length / HINT_MAX) * 100)}%` }} />
      </div>
      <div className={`flex justify-between text-[11px] ${tone}`}>
        <span>{message}</span>
        <span className="font-mono tabular-nums">
          {length}/{HINT_MAX}
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Test B: upload a picture for the frame-1 card's background (saved under public/backgrounds/uploads/). */
function ColdOpenBackgroundField() {
  const image = useReelStore((s) => s.coldOpenBackground);
  const update = useReelStore((s) => s.update);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-background", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      update({ coldOpenBackground: body.path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label="Thumbnail frame background">
      <div className="flex items-center gap-3">
        <div className="relative grid h-24 w-[54px] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted/60 text-[10px] text-muted-foreground">
          {image ? <img src={`/${image}`} alt="" className="absolute inset-0 h-full w-full object-cover" /> : "Shelves"}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} asChild>
              <label className="cursor-pointer">
                {busy ? <Loader2 className="animate-spin" /> : <Upload />}
                {busy ? "Uploading…" : image ? "Replace" : "Upload picture"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </Button>
            {image && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => update({ coldOpenBackground: "" })}>
                <X /> Remove
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 15 MB. Shown full-bleed and dimmed behind the card; kept for every video.</span>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>
    </Field>
  );
}

/**
 * Video library (puzzles/*.csv → src/data/library*.ts): the dropdown picks the list (K-Drama /
 * Other, which also selects that list's theme), Back / Next steps through its videos, and the
 * number box jumps straight to one (Enter or Go).
 */
function LibrarySection() {
  const videoNumber = useReelStore((s) => s.videoNumber);
  const loadVideo = useReelStore((s) => s.loadVideo);
  const libraryId = useReelStore((s) => s.libraryId);
  const setLibrary = useReelStore((s) => s.setLibrary);
  const LIBRARY = getLibrary(libraryId).entries;
  const first = LIBRARY[0].n;
  const last = LIBRARY[LIBRARY.length - 1].n;
  const [draft, setDraft] = useState(videoNumber ? String(videoNumber) : "");
  useEffect(() => setDraft(videoNumber ? String(videoNumber) : ""), [videoNumber]);
  const current = LIBRARY.find((v) => v.n === videoNumber);
  const target = Number(draft);
  const valid = Number.isInteger(target) && LIBRARY.some((v) => v.n === target);
  const go = () => valid && loadVideo(target);

  return (
    <Section icon={<Clapperboard />} title={`Video Library · ${LIBRARY.length} words`}>
      <Field label="List">
        <NativeSelect value={libraryId} onChange={(e) => setLibrary(e.target.value as LibraryId)}>
          {LIBRARIES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label} · {l.entries.length} words
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={videoNumber !== null && videoNumber <= first} onClick={() => loadVideo(videoNumber === null ? first : videoNumber - 1)}>
          <ChevronLeft /> Back
        </Button>
        <Input
          aria-label="Video number"
          type="number"
          min={first}
          max={last}
          value={draft}
          placeholder={`${first}–${last}`}
          className={cn("h-8 w-20 text-center font-mono", draft && !valid && "border-destructive text-destructive")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
        <Button size="sm" variant="secondary" disabled={!valid || target === videoNumber} onClick={go}>
          Go
        </Button>
        <Button size="sm" variant="outline" className="ml-auto" disabled={videoNumber !== null && videoNumber >= last} onClick={() => loadVideo(videoNumber === null ? first : videoNumber + 1)}>
          Next <ChevronRight />
        </Button>
      </div>
      {current ? (
        <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{current.n}</span>
            <span className="font-display tracking-widest text-primary">{current.word}</span>
            <Badge variant="outline" className="ml-auto">{current.category}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{current.source}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Custom content. Press Next, or type a number ({first}–{last}) and press Enter.
        </p>
      )}
    </Section>
  );
}
