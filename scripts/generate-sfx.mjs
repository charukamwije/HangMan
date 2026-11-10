#!/usr/bin/env node
/**
 * Procedural SFX synthesizer — generates every audio asset the reel needs as
 * 48 kHz / 16-bit stereo WAV files in public/audio. Zero dependencies, fully
 * deterministic (seeded noise), so renders are reproducible.
 *
 *   node scripts/generate-sfx.mjs              # (re)generate all
 *   node scripts/generate-sfx.mjs --if-missing # only create missing files
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
  fade(out, 1.5, 1.2);
  normalize(out, 0.8);
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
writeWav("swell.wav", swell());
writeWav("reveal.wav", reveal());
writeWav("ambient.wav", ambient());
