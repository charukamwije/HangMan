#!/usr/bin/env node
/**
 * Procedural SFX synthesizer — generates every audio asset the reel needs as
 * 48 kHz / 16-bit stereo WAV files in public/audio. Zero dependencies, fully
 * deterministic (seeded noise), so renders are reproducible.
 *
 *   node scripts/generate-sfx.mjs              # (re)generate all
 *   node scripts/generate-sfx.mjs --if-missing # only create missing files
 *   node scripts/generate-sfx.mjs --only music.wav,loop-rewind.wav  # just these files
 *
 * Replace any file in public/audio with your own licensed asset of the same
 * name and the composition will pick it up automatically.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000;
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
const IF_MISSING = process.argv.includes("--if-missing");
const ONLY_ARG = process.argv.indexOf("--only");
const ONLY = ONLY_ARG > 0 ? new Set((process.argv[ONLY_ARG + 1] ?? "").split(",").filter(Boolean)) : null;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- helpers
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const buf = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
const env = (t, attack, decay) => (t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** One-pole low-pass, in place. */
function lowpass(ch, cutoff) {
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < ch.length; i++) ch[i] = y += a * (ch[i] - y);
}
/** One-pole high-pass, in place. */
function highpass(ch, cutoff) {
  const a = Math.exp((-TAU * cutoff) / SR);
  let xPrev = 0, y = 0;
  for (let i = 0; i < ch.length; i++) {
    const x = ch[i];
    y = a * (y + x - xPrev);
    xPrev = x;
    ch[i] = y;
  }
}
function normalize([l, r], peak = 0.9) {
  let max = 1e-9;
  for (let i = 0; i < l.length; i++) max = Math.max(max, Math.abs(l[i]), Math.abs(r[i]));
  const g = peak / max;
  for (let i = 0; i < l.length; i++) { l[i] *= g; r[i] *= g; }
}
function fade([l, r], inSec, outSec) {
  const n = l.length, fi = inSec * SR, fo = outSec * SR;
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, fi ? i / fi : 1, fo ? (n - i) / fo : 1);
    l[i] *= g; r[i] *= g;
  }
}
function writeWav(name, [l, r]) {
  const file = path.join(OUT_DIR, name);
  if (IF_MISSING && fs.existsSync(file)) return;
  if (ONLY && !ONLY.has(name)) return;
  const n = l.length, data = Buffer.alloc(44 + n * 4);
  data.write("RIFF", 0); data.writeUInt32LE(36 + n * 4, 4); data.write("WAVE", 8);
  data.write("fmt ", 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, data);
  console.log(`  ✓ ${name.padEnd(14)} ${(data.length / 1024).toFixed(0).padStart(6)} KB`);
}

// ---------------------------------------------------------------- sounds
/** Mechanical clock tick (bright) / tock (woody). */
function clock(freq, seed) {
  const out = buf(0.12), rnd = mulberry32(seed);
  const [l, r] = out;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const click = (rnd() * 2 - 1) * env(t, 0.0003, 0.004);
    const body = Math.sin(TAU * freq * t) * env(t, 0.0005, 0.018) * 0.6
      + Math.sin(TAU * freq * 2.76 * t) * env(t, 0.0005, 0.008) * 0.25;
    l[i] = r[i] = click + body;
  }
  highpass(l, 300); highpass(r, 300);
  normalize(out, 0.85);
  return out;
}

/** Low-frequency hardwood gavel strike with a small rebound and a short room tail (frame-0 impact). */
function gavel() {
  const out = buf(1.3), rnd = mulberry32(31);
  const [l, r] = out;
  const modes = [[176, 0.55, 0.11], [409, 0.34, 0.055], [688, 0.2, 0.032], [1127, 0.12, 0.018]];
  const strike = (t, gain) => {
    if (t < 0) return 0;
    let wood = 0;
    for (const [f, a, d] of modes) wood += Math.sin(TAU * f * t) * a * env(t, 0.0004, d);
    const sub = Math.sin(TAU * (46 * t + (70 / 22) * (1 - Math.exp(-t * 22)))) * env(t, 0.0015, 0.2);
    return gain * (sub * 1.1 + wood);
  };
  let room = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const crack = (rnd() * 2 - 1) * env(t, 0.0002, 0.005) * 0.9;
    room += 0.02 * ((rnd() * 2 - 1) - room);
    const tail = room * env(t, 0.012, 0.28) * 0.9;
    const v = strike(t, 1) + strike(t - 0.092, 0.22) + crack;
    l[i] = v + tail;
    r[i] = v * 0.97 - tail;
  }
  lowpass(l, 5200); lowpass(r, 5200);
  fade(out, 0, 0.08);
  normalize(out, 0.95);
  return out;
}

/** Mechanical clock tick (bright) / tock (woody); `pitch` in semitones for the final-seconds ticks. */
function tick(freq, seed, pitch = 0, weight = 0) {
  const out = clock(freq * 2 ** (pitch / 12), seed);
  if (weight) {
    // Heavier escapement thunk under the urgent ticks.
    const [l, r] = out;
    for (let i = 0; i < l.length; i++) {
      const t = i / SR;
      const thunk = Math.sin(TAU * 160 * t) * env(t, 0.0008, 0.02) * weight;
      l[i] += thunk; r[i] += thunk;
    }
    normalize(out, 0.85);
  }
  return out;
}

/** Typewriter key: hard strike transient, metallic typebar ping, platen thunk, then the key return. */
function typewriter() {
  const out = buf(0.16), rnd = mulberry32(41);
  const [l, r] = out;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const hit = (rnd() * 2 - 1) * env(t, 0.0001, 0.0025);
    const ping = (Math.sin(TAU * 2870 * t) * 0.5 + Math.sin(TAU * 4130 * t) * 0.3) * env(t, 0.0002, 0.009);
    const body = Math.sin(TAU * 235 * t) * env(t, 0.0006, 0.014) * 0.6;
    const ret = (rnd() * 2 - 1) * env(t - 0.021, 0.0002, 0.003) * 0.45;
    l[i] = hit + ping + body + ret;
    r[i] = hit * 0.9 + ping * 1.05 + body + ret * 0.8;
  }
  highpass(l, 120); highpass(r, 120);
  normalize(out, 0.9);
  return out;
}

/** Subtle metallic chime: inharmonic bell partials with a soft attack. */
function chime() {
  const out = buf(1.3);
  const [l, r] = out;
  const partials = [[1760, 1, 0.5], [4083, 0.42, 0.26], [7480, 0.16, 0.12], [2640, 0.22, 0.38]];
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [f, a, d] of partials) v += Math.sin(TAU * f * t + 0.015 * Math.sin(TAU * 4.5 * t)) * a * env(t, 0.0025, d);
    l[i] = v;
    r[i] = v * (1 + 0.05 * Math.sin(TAU * 2.2 * t));
  }
  fade(out, 0, 0.1);
  normalize(out, 0.7);
  return out;
}

/** Deep mahogany thud: falling sub, low wood body modes, dull felt transient. */
function thud() {
  const out = buf(0.65), rnd = mulberry32(53);
  const [l, r] = out;
  const modes = [[138, 0.6, 0.07], [257, 0.35, 0.045], [391, 0.18, 0.03]];
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const sub = Math.sin(TAU * (52 * t + (60 / 16) * (1 - Math.exp(-t * 16)))) * env(t, 0.002, 0.16);
    let wood = 0;
    for (const [f, a, d] of modes) wood += Math.sin(TAU * f * t) * a * env(t, 0.0008, d);
    const felt = (rnd() * 2 - 1) * env(t, 0.0004, 0.008) * 0.5;
    l[i] = r[i] = sub * 1.1 + wood + felt;
  }
  lowpass(l, 1700); lowpass(r, 1700);
  fade(out, 0, 0.06);
  normalize(out, 0.92);
  return out;
}

/**
 * Stress-mode heartbeat: a low "lub" (55 Hz) then a softer "dub" (48 Hz) 0.16 s
 * later, each a pitch-dropping sine with a felt-soft attack, 0.45 s.
 */
function heartbeat() {
  const out = buf(0.45);
  const [l, r] = out;
  const beat = (t, f, a) => (t < 0 ? 0 : Math.sin(TAU * (f * t + (f * 0.35 / 18) * (1 - Math.exp(-t * 18)))) * env(t, 0.006, 0.075) * a);
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    l[i] = r[i] = beat(t, 55, 1) + beat(t - 0.16, 48, 0.7);
  }
  lowpass(l, 220); lowpass(r, 220);
  fade(out, 0, 0.08);
  normalize(out, 0.95);
  return out;
}

/**
 * Dark brass swell in D minor: detuned saw ensemble through an opening
 * two-pole filter. Crescendo over 3 s to a peak, then a 1.5 s tail.
 */
function swell() {
  const PEAK = 3, LEN = 4.5;
  const out = buf(LEN);
  const [l, r] = out;
  const voices = [73.42, 110, 146.83, 174.61, 220].flatMap((f, k) => [
    { f: f * 0.997, ph: k * 0.13, pan: 0.3 },
    { f: f * 1.003, ph: k * 0.29, pan: 0.7 },
  ]);
  let l1 = 0, l2 = 0, r1 = 0, r2 = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const vib = 1 + 0.004 * Math.min(1, t / PEAK) * Math.sin(TAU * 5.2 * t);
    let sl = 0, sr = 0;
    for (const v of voices) {
      v.ph = (v.ph + (v.f * vib) / SR) % 1;
      const s = v.ph * 2 - 1;
      sl += s * (1 - v.pan);
      sr += s * v.pan;
    }
    const rise = Math.min(1, t / PEAK);
    const amp = t < PEAK ? rise ** 2.2 : Math.exp(-(t - PEAK) / 0.55);
    const cutoff = 140 + 1700 * (t < PEAK ? rise ** 1.6 : Math.exp(-(t - PEAK) / 0.8));
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    l1 += a * (sl - l1); l2 += a * (l1 - l2);
    r1 += a * (sr - r1); r2 += a * (r1 - r2);
    const sub = Math.sin(TAU * 36.71 * t) * amp * 0.5;
    l[i] = l2 * amp + sub;
    r[i] = r2 * amp + sub;
  }
  fade(out, 0.05, 0.4);
  normalize(out, 0.85);
  return out;
}

/** Final-answer sting: low boom + rising major arpeggio with shimmer. */
function reveal() {
  const out = buf(3.2), rnd = mulberry32(21);
  const [l, r] = out;
  const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const boom = Math.sin(TAU * (45 + 40 * Math.exp(-t * 8)) * t) * env(t, 0.004, 0.5) * 0.9;
    let arp = 0;
    notes.forEach((f, k) => {
      const tk = t - k * 0.07;
      arp += (Math.sin(TAU * f * tk) + 0.3 * Math.sin(TAU * f * 2 * tk)) * env(tk, 0.006, 1.1) * 0.35;
    });
    const air = (rnd() * 2 - 1) * env(t, 0.3, 0.8) * 0.05;
    l[i] = boom + arp + air;
    r[i] = boom + arp * 0.92 + air;
  }
  normalize(out, 0.92);
  return out;
}

/** 30 s dark-synth mystery bed: detuned drone, breathing filter, eerie pad, sparse plucks. */
function ambient(seconds = 30) {
  const out = buf(seconds), rnd = mulberry32(99);
  const [l, r] = out;
  const drone = [[55, 0.5], [55.35, 0.5], [82.41, 0.3], [110.2, 0.18], [130.81, 0.14]];
  const pluckNotes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]; // A minor pentatonic-ish
  const plucks = [];
  for (let s = 1; s < seconds - 1; s += 1.5) plucks.push({ at: s + rnd() * 0.2, f: pluckNotes[Math.floor(rnd() * pluckNotes.length)], pan: rnd() });
  const phases = drone.map(() => [rnd(), rnd()]);
  let fl = 0, fr = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    let sl = 0, sr = 0;
    drone.forEach(([f, a], k) => {
      phases[k][0] = (phases[k][0] + (f * 1.0007) / SR) % 1;
      phases[k][1] = (phases[k][1] + (f * 0.9993) / SR) % 1;
      sl += (phases[k][0] * 2 - 1) * a; // saw
      sr += (phases[k][1] * 2 - 1) * a;
    });
    // breathing low-pass (LFO-modulated cutoff)
    const cutoff = 260 + 220 * (0.5 + 0.5 * Math.sin(TAU * 0.11 * t)) + 120 * (t / seconds);
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    fl += a * (sl - fl);
    fr += a * (sr - fr);
    // eerie high pad with slow vibrato
    const pad = Math.sin(TAU * 880 * t + 3 * Math.sin(TAU * 0.3 * t)) * 0.03 * (0.5 + 0.5 * Math.sin(TAU * 0.07 * t));
    // heartbeat-like sub pulse every second
    const beatT = t % 1;
    const pulse = Math.sin(TAU * 48 * beatT) * env(beatT, 0.005, 0.12) * 0.22 + Math.sin(TAU * 48 * (beatT - 0.22)) * env(beatT - 0.22, 0.005, 0.1) * 0.14;
    let pl = 0, pr = 0;
    for (const p of plucks) {
      const tp = t - p.at;
      if (tp < 0 || tp > 2.5) continue;
      const v = (Math.sin(TAU * p.f * tp) + 0.4 * Math.sin(TAU * p.f * 2.01 * tp)) * env(tp, 0.003, 0.6) * 0.07;
      pl += v * (1 - p.pan);
      pr += v * p.pan;
    }
    l[i] = fl * 0.9 + pad + pulse + pl;
    r[i] = fr * 0.9 + pad * 0.9 + pulse + pr;
  }
  fade(out, 0.15, 1.2); // short fade-in: the drone sits under the 1 s opening hook
  normalize(out, 0.8);
  return out;
}

/** Opening-hook click: geiger/typewriter tick — noise snap + bright ping, 50 ms. */
function click() {
  const out = buf(0.05), rnd = mulberry32(51);
  const [l, r] = out;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const snap = (rnd() * 2 - 1) * env(t, 0.00005, 0.0012);
    const ping = (Math.sin(TAU * 3500 * t) * 0.55 + Math.sin(TAU * 1800 * t) * 0.3) * env(t, 0.0001, 0.004);
    l[i] = snap + ping;
    r[i] = snap * 0.85 + ping * 1.05;
  }
  highpass(l, 300); highpass(r, 300);
  fade(out, 0, 0.01);
  normalize(out, 0.9);
  return out;
}

/** Metallic mechanical lock: two inharmonic latch strikes 40 ms apart, a low thunk and a short ring. */
function lock() {
  const out = buf(0.5), rnd = mulberry32(61);
  const [l, r] = out;
  const partials = [[1850, 0.5, 0.05], [2930, 0.35, 0.035], [4410, 0.22, 0.02], [6120, 0.12, 0.012]];
  const strike = (t, gain, detune) => {
    if (t < 0) return 0;
    let v = (rnd() * 2 - 1) * env(t, 0.00005, 0.002) * 0.8;
    for (const [f, a, d] of partials) v += Math.sin(TAU * f * detune * t) * a * env(t, 0.0001, d);
    return v * gain;
  };
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const thunk = Math.sin(TAU * (95 * t + 2 * (1 - Math.exp(-t * 40)))) * env(t, 0.0008, 0.05) * 0.9;
    const ring = Math.sin(TAU * 2450 * t) * env(t - 0.04, 0.002, 0.14) * 0.12;
    const v = strike(t, 0.7, 1) + strike(t - 0.04, 1, 1.06) + thunk;
    l[i] = v + ring;
    r[i] = v * 0.96 - ring * 0.8;
  }
  fade(out, 0, 0.1);
  normalize(out, 0.9);
  return out;
}

/**
 * Frame-0 "scroll-stopper" slap: a crisp digital pop — a 1-sample-sharp transient,
 * a fast downward pitch blip (2.4 kHz → 600 Hz in ~25 ms) and a tight sub kick.
 */
function slapPop() {
  const out = buf(0.25), rnd = mulberry32(71);
  const [l, r] = out;
  let phase = 0, subPhase = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const f = 600 + 1800 * Math.exp(-t / 0.008);
    phase += (TAU * f) / SR;
    const blip = Math.sin(phase) * env(t, 0.0002, 0.03);
    const tick = (rnd() * 2 - 1) * env(t, 0.00002, 0.0015) * 1.2;
    subPhase += (TAU * (60 + 140 * Math.exp(-t / 0.012))) / SR;
    const sub = Math.sin(subPhase) * env(t, 0.0008, 0.06) * 0.8;
    l[i] = blip + tick + sub;
    r[i] = blip * 0.98 + tick * 0.9 + sub;
  }
  fade(out, 0, 0.05);
  normalize(out, 0.95);
  return out;
}

// Keep in sync with HOOK_FRAMES_30 in src/remotion/hook.ts.
/** The decode (and so the rewind) lasts the whole first second: frames 0 → clear (30). */
const REWIND_SECONDS = 30 / 30;
/** music.wav is placed on this frame (musicIn[0]): frame 0, so the beat runs from the first frame. */
const MUSIC_START_FRAME_30 = 0;

/**
 * 120 BPM staccato pizzicato cello + woodblock bed (D minor: Dm · Bb · Gm · A).
 * The grid is anchored so that, placed on MUSIC_START_FRAME_30, every bar
 * downbeat lands on a clock tick (frame 0, 60, 120, …; 120 BPM = 2 beats per
 * tick). Placed on frame 0 the first downbeat is the very first sample, so the
 * beat runs from the first frame (no silent pickup). 30 s covers the whole reel.
 */
function music(seconds = 30) {
  const out = buf(seconds), rnd = mulberry32(71);
  const [l, r] = out;
  const EIGHTH = 0.25;
  const DOWNBEAT = (Math.ceil(MUSIC_START_FRAME_30 / 30) * 30 - MUSIC_START_FRAME_30) / 30; // 0.8 s
  const roots = [146.83, 116.54, 98.0, 110.0];
  const pattern = [1, 1, 1.5, 1, 2, 1.5, 1, 1.5]; // ratios over the root, one per 8th
  const mod = (a, m) => ((a % m) + m) % m;
  const cello = new Float32Array(l.length);
  const wood = new Float32Array(l.length);
  const notes = [];
  for (let n = -Math.floor(DOWNBEAT / EIGHTH); DOWNBEAT + n * EIGHTH < seconds; n++) {
    const at = DOWNBEAT + n * EIGHTH;
    if (at < 0) continue;
    const bar = Math.floor(n / 8);
    notes.push({ at, f: roots[mod(bar, 4)] * pattern[mod(n, 8)], accent: mod(n, 8) === 0 ? 1 : mod(n, 2) === 0 ? 0.75 : 0.55, n });
  }
  for (const note of notes) {
    const start = Math.floor(note.at * SR), len = Math.floor(0.22 * SR);
    let phase = rnd();
    for (let j = 0; j < len && start + j < cello.length; j++) {
      const t = j / SR;
      phase = (phase + note.f / SR) % 1;
      // Plucked: saw + body sine, fast decay (staccato), little bow-scrape noise on the attack.
      cello[start + j] += ((phase * 2 - 1) * 0.6 + Math.sin(TAU * note.f * t) * 0.5 + (rnd() * 2 - 1) * env(t, 0.0005, 0.004) * 0.3) * env(t, 0.004, 0.07) * note.accent;
    }
    // Woodblock on every 8th, brighter on the beat.
    const on = mod(note.n, 2) === 0;
    const wf = on ? 1180 : 900;
    for (let j = 0; j < 0.06 * SR && start + j < wood.length; j++) {
      const t = j / SR;
      wood[start + j] += (Math.sin(TAU * wf * t) + 0.4 * Math.sin(TAU * wf * 2.73 * t)) * env(t, 0.0002, 0.012) * (on ? 0.32 : 0.2);
    }
  }
  lowpass(cello, 1400);
  highpass(cello, 50);

  // Continuous floor under the staccato plucks (they decay in ~70 ms, which left near-silent gaps
  // between notes): a soft sustained pad on each bar's chord (root + fifth + octave, slow swell),
  // and a low kick on every beat so the pulse never drops out.
  const pad = new Float32Array(l.length);
  const kick = new Float32Array(l.length);
  const BAR = 8 * EIGHTH;
  for (let b = 0; DOWNBEAT + b * BAR < seconds; b++) {
    const at = DOWNBEAT + b * BAR;
    const root = roots[mod(b, 4)] / 2;
    const start = Math.floor(at * SR), len = Math.floor((BAR + 0.15) * SR);
    for (let j = 0; j < len && start + j < pad.length; j++) {
      const t = j / SR;
      const shape = Math.min(1, t / 0.06) * Math.min(1, (BAR + 0.15 - t) / 0.15); // quick swell, overlapping tail
      const breath = 0.85 + 0.15 * Math.sin(TAU * 2 * t); // gentle movement on the beat
      pad[start + j] += (Math.sin(TAU * root * t) + 0.55 * Math.sin(TAU * root * 1.5 * t) + 0.35 * Math.sin(TAU * root * 2 * t)) * shape * breath;
    }
  }
  for (let k = 0; DOWNBEAT + k * 2 * EIGHTH < seconds; k++) {
    const start = Math.floor((DOWNBEAT + k * 2 * EIGHTH) * SR);
    const accent = k % 4 === 0 ? 1 : 0.7;
    let ph = 0;
    for (let j = 0; j < 0.22 * SR && start + j < kick.length; j++) {
      const t = j / SR;
      ph += (45 + 75 * Math.exp(-t / 0.03)) / SR; // 120 → 45 Hz drop
      kick[start + j] += Math.sin(TAU * ph) * env(t, 0.002, 0.09) * accent;
    }
  }
  lowpass(pad, 700);
  for (let i = 0; i < l.length; i++) {
    l[i] = cello[i] * 0.9 + wood[i] * 0.8 + pad[i] * 0.16 + kick[i] * 0.55;
    r[i] = cello[i] * 0.8 + wood[i] * 1.0 + pad[i] * 0.16 + kick[i] * 0.55;
  }
  fade(out, 0.02, 1.2);
  normalize(out, 0.8);
  return out;
}

/**
 * Tape rewind of the music bed for the 1 s decode: the same cello/woodblock
 * track read BACKWARDS, accelerating 3× → 14× (the decoy cadence accelerates
 * 4 → 1 frame gaps on the same curve), with tape flutter, a motor whine that
 * tracks the speed and hiss. Hard-stops at REWIND_SECONDS (the board clear).
 */
function rewind(source, { seconds = REWIND_SECONDS, fromSec = 14, v0 = 3, v1 = 14, seed = 91 } = {}) {
  const [sl, sr] = source;
  const out = buf(seconds), rnd = mulberry32(seed);
  const [l, r] = out;
  const read = (ch, pos) => {
    const i = Math.floor(pos), f = pos - i;
    const a = ch[Math.max(0, Math.min(ch.length - 1, i))], b = ch[Math.max(0, Math.min(ch.length - 1, i + 1))];
    return a + (b - a) * f;
  };
  let pos = fromSec * SR; // hook: start 14 s in and run backwards (≈ 8.5 s of music in 1 s)
  let whine = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR, p = t / seconds;
    const speed = (v0 + (v1 - v0) * p ** 1.3) * (1 + 0.06 * Math.sin(TAU * 7 * t) + 0.03 * Math.sin(TAU * 23 * t));
    pos = Math.max(0, pos - speed);
    whine += (95 * speed) / SR;
    const hiss = (rnd() * 2 - 1) * 0.04;
    const motor = Math.sin(TAU * whine) * 0.07 + Math.sin(TAU * whine * 2) * 0.03;
    const g = 0.55 + 0.45 * p; // swells as it speeds up
    l[i] = (read(sl, pos) + motor + hiss) * g;
    r[i] = (read(sr, pos) + motor + hiss * 0.8) * g;
  }
  highpass(l, 140); highpass(r, 140);
  lowpass(l, 9000); lowpass(r, 9000);
  fade(out, 0.01, 0.004); // hard stop
  normalize(out, 0.85);
  return out;
}

/** Correct guess impact: sub drop + snare-ish crack, then a bright rising two-note pluck (E5 → B5) with shimmer. */
function correct() {
  const out = buf(0.9), rnd = mulberry32(101);
  const [l, r] = out;
  const pluck = (t, f) => (t < 0 ? 0 : (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 2 * t) + 0.15 * Math.sin(TAU * f * 3.01 * t)) * env(t, 0.002, 0.22));
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const sub = Math.sin(TAU * (55 * t + (90 / 18) * (1 - Math.exp(-t * 18)))) * env(t, 0.001, 0.16) * 1.1;
    const crack = (rnd() * 2 - 1) * env(t, 0.0002, 0.025) * 0.5;
    const notes = pluck(t - 0.01, 659.25) * 0.45 + pluck(t - 0.085, 987.77) * 0.5;
    const shimmer = (Math.sin(TAU * 2637 * t) * Math.sin(TAU * 9 * t)) * env(t - 0.085, 0.01, 0.25) * 0.12;
    l[i] = sub + crack + notes + shimmer;
    r[i] = sub + crack * 0.9 + notes * 0.95 - shimmer;
  }
  fade(out, 0, 0.15);
  normalize(out, 0.92);
  return out;
}

/** Wrong guess: distorted low buzzer falling 120 → 70 Hz with a crunchy noise hit. */
function wrong() {
  const out = buf(0.55), rnd = mulberry32(111);
  const [l, r] = out;
  let phase = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    phase += (120 - 50 * Math.min(1, t / 0.45)) / SR;
    const saw = (phase % 1) * 2 - 1;
    const sq = Math.sign(Math.sin(TAU * phase * 1.5));
    const buzz = Math.tanh((saw * 0.7 + sq * 0.3) * 3) * env(t, 0.003, 0.22) * 0.8;
    const hit = (rnd() * 2 - 1) * env(t, 0.0003, 0.04) * 0.7;
    const sub = Math.sin(TAU * 48 * t) * env(t, 0.002, 0.12) * 0.7;
    l[i] = buzz + hit + sub;
    r[i] = buzz * 0.95 + hit * 0.85 + sub;
  }
  lowpass(l, 3200); lowpass(r, 3200);
  fade(out, 0, 0.08);
  normalize(out, 0.92);
  return out;
}

/** Anticipation whoosh: 0.3 s rising filtered noise that peaks right at the end (placed so it lands on the guess). */
function whoosh() {
  const len = 0.3;
  const out = buf(len), rnd = mulberry32(121);
  const [l, r] = out;
  let yl = 0, yr = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR, p = t / len;
    const a = 1 - Math.exp((-TAU * (400 + 6000 * p * p)) / SR);
    yl += a * ((rnd() * 2 - 1) - yl);
    yr += a * ((rnd() * 2 - 1) - yr);
    const g = p ** 2.2;
    l[i] = yl * g * (1 - 0.4 * p);
    r[i] = yr * g * (0.6 + 0.4 * p);
  }
  fade(out, 0.02, 0.006);
  normalize(out, 0.7);
  return out;
}

/**
 * The whole 1 s "machine gun" decode pre-mixed into ONE file: a click on every
 * decoy pop, click + short faded thud on each strike (pop + 2 frames).
 * One <Audio> instead of ~40 keeps the Remotion Player from hitting React's
 * nested-update limit. Pop schedule mirrors decoyPopFrames30() in src/remotion/hook.ts
 * (keep in sync): gaps ease 4 → 1 frame across frames 0 → 26 @ 30 fps.
 */
function hookDecode() {
  const pops = [];
  for (let t = 0; t <= 26; ) {
    pops.push(t);
    t += Math.max(1, Math.round(4 + (1 - 4) * (t / 26)));
  }
  const clickBuf = click(), thudBuf = thud();
  const out = buf(1.05);
  const [l, r] = out;
  const mixIn = ([sl, sr], atSec, gain, maxSec = Infinity) => {
    const start = Math.round(atSec * SR), len = Math.min(sl.length, Math.round(maxSec * SR));
    for (let j = 0; j < len && start + j < l.length; j++) {
      const g = maxSec === Infinity ? gain : gain * (1 - j / len); // linear fade for clipped thuds
      l[start + j] += sl[j] * g;
      r[start + j] += sr[j] * g;
    }
  };
  for (const p of pops) {
    mixIn(clickBuf, p / 30, 0.7);
    mixIn(clickBuf, (p + 2) / 30, 0.5);
    mixIn(thudBuf, (p + 2) / 30, 0.45, 0.15);
  }
  let peak = 0;
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  if (peak > 0.95) normalize(out, 0.95);
  return out;
}

// ---------------------------------------------------------------- main
fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`Generating SFX → ${path.relative(process.cwd(), OUT_DIR)}`);
writeWav("gavel.wav", gavel());
writeWav("tick.wav", tick(2100, 1));
writeWav("tock.wav", tick(1250, 2));
// Final 5 seconds: each tick 2 semitones higher and a little heavier (00:05 → 00:01).
for (let r = 5; r >= 1; r--) writeWav(`tick-final-${r}.wav`, tick(2100, 10 + r, 2 * (6 - r), 0.15 * (6 - r)));
writeWav("typewriter.wav", typewriter());
writeWav("chime.wav", chime());
writeWav("thud.wav", thud());
writeWav("heartbeat.wav", heartbeat());
writeWav("swell.wav", swell());
writeWav("reveal.wav", reveal());
writeWav("ambient.wav", ambient());
writeWav("click.wav", click());
writeWav("correct.wav", correct());
writeWav("wrong.wav", wrong());
writeWav("whoosh.wav", whoosh());
writeWav("lock.wav", lock());
writeWav("slap-pop.wav", slapPop());
writeWav("hook-decode.wav", hookDecode());
const musicBed = music();
writeWav("music.wav", musicBed);
writeWav("rewind.wav", rewind(musicBed));
// Loop point: the last LOOP_RESET_SECONDS rewind the END of the song, faster still, and hard-stop
// exactly as frame 0's gavel lands (keep in sync with LOOP_RESET_SECONDS in src/remotion/constants.ts).
writeWav("loop-rewind.wav", rewind(musicBed, { seconds: 0.6, fromSec: 28.5, v0: 5, v1: 16, seed: 93 }));
