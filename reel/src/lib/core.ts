// Core timing, easing, deterministic randomness and the audio-reactive hit system.
// Every function here is a pure function of its inputs (frame numbers, seeds) — no timers, no Math.random.
import timelineJson from '../data/timeline.json';
import beatsJson from '../data/beats.json';
import envelopeJson from '../data/envelope.json';

export const W = 1080;
export const H = 1920;
export const CX = W / 2;
export const CY = H / 2;

export const TL = timelineJson as unknown as {
  fps: number;
  totalFrames: number;
  bpm: number;
  framesPerBeat: number;
  beats: number[];
  scenes: Record<string, [number, number]>;
  marks: Record<string, number>;
  portalBeats: number[];
  portals: number[];
  panels: number[];
  hudEnd: number;
  slow: {startV: number; endV: number; songBeats: number; rampW: number};
  typing: Record<string, {ch: string; f: number}[]>;
  stream: Record<string, {t: string; f: number}[]>;
  copy: Record<string, string>;
};

type Ev = {f: number; s: number; beat?: number};
export const BEATS = beatsJson as unknown as {
  events: Record<'kick' | 'snare' | 'cowbell' | 'hat' | 'impact' | 'slam', Ev[]>;
  musicEndFrame: number;
};
export const ENV = envelopeJson as unknown as {full: number[]; low: number[]; mid: number[]; high: number[]};

export const FPB = TL.framesPerBeat;
export const M = TL.marks;
export const TOTAL = TL.totalFrames;

/** continuous video-beat index of a (possibly fractional) frame */
export const beatOf = (t: number) => t / FPB;
export const frameOfBeat = (v: number) => Math.round(v * FPB);

// ------------------------------------------------------------------------------------------ math
export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const mix = lerp;
export const fract = (x: number) => x - Math.floor(x);
export const TAU = Math.PI * 2;

// ------------------------------------------------------------------------------------------ easing (never linear)
export const E = {
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inQuart: (t: number) => t * t * t * t,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t: number) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t: number, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  // anticipation -> overshoot
  anticipate: (t: number) => (t < 0.25 ? -0.12 * Math.sin((t / 0.25) * Math.PI) : E.outBack((t - 0.25) / 0.75, 2.2)),
};

/** damped spring step response, x(0)=0 -> 1 with overshoot; t in frames */
export const spring = (t: number, freq = 4.5, damp = 0.38, durFrames = 60) => {
  if (t <= 0) return 0;
  const tt = t / durFrames;
  const w = TAU * freq;
  return 1 - Math.exp(-damp * w * tt) * Math.cos(w * Math.sqrt(1 - damp * damp) * tt);
};

/** impulse that kicks to 1 then decays with a little ringing (follow-through) */
export const ring = (age: number, decay = 10, freq = 0.09) =>
  age < 0 ? 0 : Math.exp(-age / decay) * Math.cos(age * freq * TAU);

// ------------------------------------------------------------------------------------------ deterministic random
export const hash = (n: number) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
export const rnd = (seed: number, i = 0) => hash(seed * 7919 + i * 104729 + 17);
export const rndr = (seed: number, i: number, a: number, b: number) => a + (b - a) * rnd(seed, i);
/** smooth 1D value noise */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(rnd(seed, i) * 2 - 1, rnd(seed, i + 1) * 2 - 1, u);
};
/** time quantised for "animating on 2s/3s" at a 24 fps reference: on2 => 12 drawings/s => hold 10 master frames */
export const onTwos = (t: number, hold = 10) => Math.floor(t / hold) * hold;
export const boilSeed = (t: number, hold = 10) => Math.floor(t / hold);

// ------------------------------------------------------------------------------------------ events
const lastIdx = (list: Ev[], f: number) => {
  let lo = 0;
  let hi = list.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].f <= f) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
};
/** most recent event at or before frame f: {age, s} */
export const last = (name: keyof typeof BEATS.events, f: number) => {
  const list = BEATS.events[name];
  const i = lastIdx(list, Math.floor(f));
  if (i < 0) return {age: 1e9, s: 0, idx: -1};
  return {age: f - list[i].f, s: list[i].s, idx: i};
};
export const envAt = (band: 'full' | 'low' | 'mid' | 'high', f: number) => {
  const i = clamp(Math.floor(f), 0, TOTAL - 1);
  const j = Math.min(TOTAL - 1, i + 1);
  return lerp(ENV[band][i], ENV[band][j], f - Math.floor(f));
};

export type Hits = {
  flash: number; // 0..1 overlay
  punch: number; // zoom multiplier offset (0.04 = 4 %)
  ca: number; // chromatic aberration px
  shakeX: number;
  shakeY: number;
  shakeR: number;
  glitch: number; // 0..1 slice amount
  glitchSeed: number;
  bounce: number; // text bounce offset (-1..1)
};

/** the reusable hit system: kick = flash + 4 % punch + CA; snare = shake + glitch slice; cowbell = text bounce */
export const hits = (f: number, intensity = 1): Hits => {
  const k = last('kick', f);
  const sn = last('snare', f);
  const cb = last('cowbell', f);
  const im = last('impact', f);
  const sl = last('slam', f);
  const fi = Math.floor(f);
  const kickS = clamp(k.s * 1.2);
  // 2-frame flash on strong kicks; big flashes on impacts
  let flash = k.age >= 0 && k.age < 2 && kickS > 0.45 ? 0.16 * kickS : 0;
  if (im.age >= 0 && im.age < 2) flash = Math.max(flash, 0.85 * im.s);
  if (sl.age >= 0 && sl.age < 2) flash = Math.max(flash, 0.35);
  let punch = 0.04 * kickS * Math.max(0, ring(k.age, 7, 0.05));
  punch += 0.09 * im.s * Math.max(0, ring(im.age, 14, 0.03));
  punch += 0.05 * Math.max(0, ring(sl.age, 8, 0.05));
  let ca = 7 * kickS * Math.exp(-Math.max(0, k.age) / 5) + 26 * im.s * Math.exp(-Math.max(0, im.age) / 10);
  const snS = clamp(sn.s * 1.1);
  const sh = 16 * snS * Math.exp(-Math.max(0, sn.age) / 6) + 46 * im.s * Math.exp(-Math.max(0, im.age) / 16);
  const shakeX = sh * noise1(fi * 0.9, 11);
  const shakeY = sh * noise1(fi * 0.9, 29);
  const shakeR = 0.004 * sh * noise1(fi * 0.7, 47);
  const glitch = sn.age >= 0 && sn.age < 4 && sn.s > 0.75 ? (1 - sn.age / 4) * 0.55 * snS : 0;
  const bounce = cb.age >= 0 ? clamp(cb.s * 1.4) * ring(cb.age, 9, 0.07) : 0;
  return {
    flash: flash * intensity,
    punch: punch * intensity,
    ca: ca * intensity,
    shakeX: shakeX * intensity,
    shakeY: shakeY * intensity,
    shakeR: shakeR * intensity,
    glitch: glitch * intensity,
    glitchSeed: sn.idx * 31 + fi,
    bounce: bounce * intensity,
  };
};

// ------------------------------------------------------------------------------------------ palette
export const P = {
  bg: '#0A090D',
  bg2: '#121017',
  ink: '#16131B',
  orange: '#D97757',
  orangeHi: '#F2A07D',
  orangeDk: '#9C4129',
  cream: '#F3ECE2',
  creamDk: '#CFC5B8',
  neon: '#38F2FF',
  neonDk: '#0B8C9C',
  white: '#FFFFFF',
  black: '#000000',
};
