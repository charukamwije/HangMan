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

/** Chess-piece click on wood + bright bell chime. */
function correct() {
  const out = buf(1.4), rnd = mulberry32(7);
  const [l, r] = out;
  const partials = [[1318.5, 1, 0.55], [1975.5, 0.6, 0.45], [2637, 0.35, 0.3], [3951, 0.15, 0.18]];
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const click = (rnd() * 2 - 1) * env(t, 0.0002, 0.003) * 0.9 + Math.sin(TAU * 3400 * t) * env(t, 0.0002, 0.012) * 0.4;
    let bell = 0;
    for (const [f, a, d] of partials) bell += Math.sin(TAU * f * t + Math.sin(TAU * 5 * t) * 0.02) * a * env(t - 0.012, 0.004, d);
    l[i] = click + bell * 0.55;
    r[i] = click + bell * 0.55 * (1 + 0.04 * Math.sin(TAU * 3 * t)); // gentle stereo shimmer
  }
  normalize(out, 0.9);
  return out;
}

/** Low buzzer + sharp wooden thud. */
function wrong() {
  const out = buf(0.75), rnd = mulberry32(13);
  const [l, r] = out;
  let thudPhase = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const f = 150 * Math.exp(-t * 18) + 55;
    thudPhase += (TAU * f) / SR;
    const thud = Math.sin(thudPhase) * env(t, 0.001, 0.09) * 1.0 + (rnd() * 2 - 1) * env(t, 0.0005, 0.012) * 0.5;
    let buzz = 0;
    for (let h = 1; h <= 9; h += 2) buzz += Math.sin(TAU * 98 * h * t) / h; // square-ish
    const buzzEnv = t < 0.02 ? 0 : t < 0.03 ? (t - 0.02) / 0.01 : t < 0.42 ? 1 : Math.exp(-(t - 0.42) / 0.06);
    l[i] = thud + buzz * buzzEnv * 0.32;
    r[i] = thud + buzz * buzzEnv * 0.3;
  }
  lowpass(l, 2600); lowpass(r, 2600);
  normalize(out, 0.9);
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

/** Filtered-noise whoosh for the intro. */
function whoosh() {
  const out = buf(1.1), rnd = mulberry32(3);
  const [l, r] = out;
  let yl = 0, yr = 0;
  for (let i = 0; i < l.length; i++) {
    const t = i / SR, p = t / 1.1;
    const cutoff = 300 + 5200 * Math.sin(Math.PI * p) ** 2;
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    const g = Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 2;
    yl += a * (rnd() * 2 - 1 - yl);
    yr += a * (rnd() * 2 - 1 - yr);
    l[i] = yl * g * (1 - p * 0.5);
    r[i] = yr * g * (0.5 + p * 0.5); // pans left → right
  }
  normalize(out, 0.8);
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
writeWav("tick.wav", clock(2100, 1));
writeWav("tock.wav", clock(1250, 2));
writeWav("correct.wav", correct());
writeWav("wrong.wav", wrong());
writeWav("reveal.wav", reveal());
writeWav("whoosh.wav", whoosh());
writeWav("ambient.wav", ambient());
