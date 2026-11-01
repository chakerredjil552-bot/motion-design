// W8 SOUND DESIGN + BEAT-SYNCED EDITING — a 3D loudspeaker. It starts head-on where the colour wheel became its
// cone, the camera orbits into 3D, the cone physically pumps on every kick, sand jumps off it, sound rings fly
// out and a ring of 3D EQ bars rides the envelope. On the last beat the dust cap blows open into the clash.
import {BEATS, E, ENV, FPB, H, M, P, TAU, TL, W, clamp, envAt, last, lerp, ring, rnd, rndr} from '../lib/core';
import {Ctx, FONT, poly, roundRect, text, withA} from '../lib/draw';
import type {World} from './worlds';

const SC: [number, number] = [540, 990];
const R = 380; // cone outer radius (= the colour wheel's outer radius)
const OUT = 44;
const dur = () => TL.portals[8] - TL.portals[7];

type V3 = [number, number, number];
type Cam = {yaw: number; pitch: number; zoom: number};

const camAt = (lt: number): Cam => {
  const D = dur();
  const into = E.inOutCubic(clamp(lt / (1.1 * FPB)));
  const ok = clamp((lt - (D - OUT)) / OUT);
  let yaw = into * (0.5 * Math.sin(lt * 0.011) + 0.12);
  let pitch = into * 0.52;
  let zoom = 1 + 0.06 * into;
  // last beat: swing back to face the cone as it blows
  const face = E.inOutCubic(ok);
  yaw = lerp(yaw, 0, face);
  pitch = lerp(pitch, 0, face);
  zoom = lerp(zoom, 1.25, face);
  return {yaw, pitch, zoom};
};

const DIST = R * 3.4;
const project = (c: Cam, p: V3) => {
  const cy = Math.cos(c.yaw);
  const sy = Math.sin(c.yaw);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  const y2 = p[1] * cp - z1 * sp;
  const z2 = p[1] * sp + z1 * cp;
  const k = (DIST / (DIST - z2)) * c.zoom;
  return {x: SC[0] + x1 * k, y: SC[1] + y2 * k, d: DIST - z2};
};

/** excursion: the cone moves toward the viewer on each kick */
const excursion = (lt: number, t: number) => {
  const k = last('kick', t);
  const e = 0.075 * R * clamp(k.s * 1.3) * Math.max(0, ring(k.age, 7, 0.06));
  const ok = clamp((lt - (dur() - OUT)) / OUT);
  return e + 0.35 * R * E.inExpo(ok);
};

// surface of revolution z(r): dust cap dome, recessed cone, rubber surround bulge, flat frame
const profile = (r: number, e: number) => {
  const rc = 0.4 * R;
  const rs = 0.86 * R;
  const depth = 0.3 * R;
  if (r <= rc) return -depth + e + 0.13 * R * Math.sqrt(Math.max(0, 1 - (r / rc) ** 2));
  if (r <= rs) return -depth * (1 - (r - rc) / (rs - rc)) + e * (1 - (r - rc) / (rs - rc)) * 0.9;
  if (r <= R) return 0.07 * R * Math.sin(Math.PI * ((r - rs) / (R - rs)));
  return 0;
};
const material = (r: number) => (r <= 0.4 * R ? 'cap' : r <= 0.86 * R ? 'cone' : r <= R ? 'surround' : 'frame');

const LIGHT: V3 = (() => {
  const v: V3 = [-0.45, -0.6, 0.66];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

const shade = (base: [number, number, number], n: V3, view: V3, spec: number, gloss: number) => {
  const diff = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const hx = LIGHT[0] + view[0];
  const hy = LIGHT[1] + view[1];
  const hz = LIGHT[2] + view[2];
  const hn = Math.hypot(hx, hy, hz) || 1;
  const sp = Math.pow(Math.max(0, (n[0] * hx + n[1] * hy + n[2] * hz) / hn), gloss) * spec;
  const amb = 0.28;
  const c = base.map((v) => Math.min(255, v * (amb + 0.85 * diff) + 255 * sp));
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
};

const COLORS: Record<string, [number, number, number]> = {
  cap: [26, 24, 32],
  cone: [58, 53, 70],
  surround: [30, 27, 36],
  frame: [24, 22, 30],
};

type Quad = {pts: {x: number; y: number}[]; d: number; fill: string; stroke?: string};

const RINGS = 34;
const SEGS = 56;

const speakerQuads = (c: Cam, lt: number, t: number): Quad[] => {
  const e = excursion(lt, t);
  const quads: Quad[] = [];
  // view direction in model space (camera looks along -z of the camera; model->camera rotation inverse)
  const view: V3 = [Math.sin(c.yaw) * Math.cos(c.pitch), -Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch)];
  const radii: number[] = [];
  for (let i = 0; i <= RINGS; i++) radii.push((i / RINGS) * R);
  for (let i = 0; i < RINGS; i++) {
    const r0 = radii[i];
    const r1 = radii[i + 1];
    const rm = (r0 + r1) / 2;
    const z0 = profile(r0, e);
    const z1 = profile(r1, e);
    const dzdr = (z1 - z0) / (r1 - r0);
    const mat = material(rm);
    for (let s = 0; s < SEGS; s++) {
      const a0 = (s / SEGS) * TAU;
      const a1 = ((s + 1) / SEGS) * TAU;
      const am = (a0 + a1) / 2;
      const p = [
        project(c, [Math.cos(a0) * r0, Math.sin(a0) * r0, z0]),
        project(c, [Math.cos(a1) * r0, Math.sin(a1) * r0, z0]),
        project(c, [Math.cos(a1) * r1, Math.sin(a1) * r1, z1]),
        project(c, [Math.cos(a0) * r1, Math.sin(a0) * r1, z1]),
      ];
      const nn = Math.hypot(dzdr, 1);
      const n: V3 = [(-dzdr * Math.cos(am)) / nn, (-dzdr * Math.sin(am)) / nn, 1 / nn];
      let base = COLORS[mat];
      // ribs on the cone, an orange accent ring at the cone/surround joint
      if (mat === 'cone' && s % 7 === 0) base = [40, 36, 50];
      if (i === Math.round(0.86 * RINGS) - 1) base = [217, 119, 87];
      const fill = shade(base, n, view, mat === 'cap' ? 0.9 : mat === 'cone' ? 0.35 : 0.25, mat === 'cap' ? 40 : 18);
      quads.push({pts: p, d: (p[0].d + p[1].d + p[2].d + p[3].d) / 4, fill});
    }
  }
  // square frame plate with bevelled edge
  const F = R * 1.22;
  const plate = [
    project(c, [-F, -F, -2]),
    project(c, [F, -F, -2]),
    project(c, [F, F, -2]),
    project(c, [-F, F, -2]),
  ];
  quads.push({pts: plate, d: 1e9, fill: shade(COLORS.frame, [0, 0, 1], view, 0.18, 12), stroke: withA(P.cream, 0.12)});
  // 3D EQ bars standing on the plate, around the driver
  const NB = 40;
  for (let b = 0; b < NB; b++) {
    const a = (b / NB) * TAU;
    const band = b % 3 === 0 ? 'low' : b % 3 === 1 ? 'mid' : 'high';
    const hgt = R * (0.06 + 0.42 * envAt(band as 'low', t - (b % 5) * 2) * (0.7 + 0.3 * rnd(901, b)));
    const rr = R * 1.08;
    const w = 0.05;
    const base0: V3 = [Math.cos(a - w) * rr, Math.sin(a - w) * rr, 0];
    const base1: V3 = [Math.cos(a + w) * rr, Math.sin(a + w) * rr, 0];
    const top0: V3 = [base0[0], base0[1], hgt];
    const top1: V3 = [base1[0], base1[1], hgt];
    const pts = [project(c, base0), project(c, base1), project(c, top1), project(c, top0)];
    const col = b % 2 ? P.orange : P.neon;
    quads.push({pts, d: (pts[0].d + pts[2].d) / 2 - 1, fill: withA(col, 0.85)});
  }
  return quads;
};

// sand resting on the cone; every kick throws it up
const SAND = Array.from({length: 170}, (_, i) => ({
  r: R * (0.42 + 0.42 * Math.sqrt(rnd(911, i))),
  a: rnd(912, i) * TAU,
  v: rndr(913, i, 0.6, 1.4),
}));

const drawSand = (ctx: Ctx, c: Cam, lt: number, t: number) => {
  const k = last('kick', t);
  const age = Math.max(0, k.age);
  const e = excursion(lt, t);
  for (const s of SAND) {
    const v0 = 9 * s.v * clamp(k.s * 1.3);
    const g = 0.42;
    const hop = Math.max(0, v0 * age - 0.5 * g * age * age);
    const z = profile(s.r, e) + hop;
    const p = project(c, [Math.cos(s.a) * s.r, Math.sin(s.a) * s.r, z]);
    ctx.fillStyle = withA(P.cream, 0.85);
    ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
  }
};

const soundRings = (ctx: Ctx, c: Cam, t: number) => {
  const kicks = BEATS.events.kick;
  for (let i = kicks.length - 1; i >= 0; i--) {
    const age = t - kicks[i].f;
    if (age < 0) continue;
    if (age > 50) break;
    const rr = R * (1.0 + 2.2 * E.outCubic(age / 50));
    const a = (1 - age / 50) * clamp(kicks[i].s * 1.2);
    ctx.save();
    ctx.lineWidth = 6 * (1 - age / 50) + 1;
    ctx.strokeStyle = withA(i % 2 ? P.neon : P.orange, 0.7 * a);
    ctx.beginPath();
    for (let s = 0; s <= 72; s++) {
      const ang = (s / 72) * TAU;
      const p = project(c, [Math.cos(ang) * rr, Math.sin(ang) * rr, R * 0.1]);
      if (s) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
};

const timeline = (ctx: Ctx, t: number) => {
  // NLE strip: beat ruler, kick markers from beats.json, clips cut on the beat, the real waveform
  const pxPerFrame = 3.2;
  const x0 = W / 2 - t * pxPerFrame;
  const top = 330;
  roundRect(ctx, 30, top, W - 60, 250, 18);
  ctx.fillStyle = 'rgba(18,16,23,0.92)';
  ctx.fill();
  ctx.save();
  roundRect(ctx, 30, top, W - 60, 250, 18);
  ctx.clip();
  for (let b = 0; b < 70; b++) {
    const x = x0 + b * FPB * pxPerFrame;
    if (x < -50 || x > W + 50) continue;
    ctx.fillStyle = withA(P.cream, b % 4 === 0 ? 0.7 : 0.3);
    ctx.fillRect(x, top + 10, 2, b % 4 === 0 ? 26 : 14);
  }
  for (const ev of BEATS.events.kick) {
    const x = x0 + ev.f * pxPerFrame;
    if (x < -20 || x > W + 20) continue;
    ctx.fillStyle = P.orange;
    poly(ctx, [[x - 8, top + 42], [x + 8, top + 42], [x, top + 56]]);
    ctx.fill();
  }
  for (let tr = 0; tr < 2; tr++) {
    const y = top + 70 + tr * 86;
    if (tr === 0) {
      for (let b = 0; b < 40; b++) {
        const len = FPB;
        const x = x0 + b * len * pxPerFrame;
        if (x > W + 50 || x + len * pxPerFrame < -50) continue;
        roundRect(ctx, x + 3, y + 6, len * pxPerFrame - 6, 62, 8);
        ctx.fillStyle = withA(b % 2 ? P.neon : P.orange, 0.75);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = withA(P.orange, 0.9);
      for (let x = 30; x < W - 30; x += 4) {
        const fr = Math.floor((x - x0) / pxPerFrame);
        const v = fr >= 0 && fr < ENV.full.length ? ENV.low[fr] : 0;
        const hh = 4 + 32 * v;
        ctx.fillRect(x, y + 38 - hh, 3, hh * 2);
      }
    }
  }
  ctx.restore();
  ctx.fillStyle = P.orange;
  ctx.fillRect(W / 2 - 2, top - 8, 4, 266);
};

export const makeSpeakerWorld = (drawNextHome: (ctx: Ctx, t: number) => void): World => ({
  id: 'sound',
  title: ['SOUND DESIGN', '+ BEAT-SYNCED EDITING'],
  P: SC,
  bg: '#08070B',
  back: (ctx, lt, t) => {
    const D = dur();
    const ok = clamp((lt - (D - OUT)) / OUT);
    const g = ctx.createRadialGradient(SC[0], SC[1], 50, SC[0], SC[1], 1400);
    g.addColorStop(0, '#1A1622');
    g.addColorStop(1, '#060508');
    ctx.fillStyle = g;
    ctx.fillRect(-2000, -2000, W + 4000, H + 4000);
    const c = camAt(lt);
    // LED glow behind the driver pulsing with the low end
    const led = 0.25 + 0.55 * envAt('low', t);
    const lg = ctx.createRadialGradient(SC[0], SC[1], R * 0.9, SC[0], SC[1], R * 2.1);
    lg.addColorStop(0, withA(P.orange, 0.35 * led));
    lg.addColorStop(1, withA(P.orange, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(SC[0] - R * 2.2, SC[1] - R * 2.2, R * 4.4, R * 4.4);
    const quads = speakerQuads(c, lt, t);
    quads.sort((a, b) => b.d - a.d);
    for (const q of quads) {
      ctx.beginPath();
      q.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = q.fill;
      ctx.fill();
      ctx.strokeStyle = q.stroke ?? q.fill;
      ctx.lineWidth = q.stroke ? 3 : 1;
      ctx.stroke();
    }
    soundRings(ctx, c, t);
    drawSand(ctx, c, lt, t);
    // the dust cap blows open on the last beat: the clash is inside
    if (ok > 0.3) {
      const hk = E.inCubic(clamp((ok - 0.3) / 0.7));
      const centre = project(c, [0, 0, profile(0, excursion(lt, t))]);
      const rad = lerp(0, 1400, hk);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, rad, 0, TAU);
      ctx.clip();
      drawNextHome(ctx, t);
      ctx.restore();
      ctx.save();
      ctx.lineWidth = 28 * (1 - hk) + 6;
      ctx.strokeStyle = withA(P.cream, 0.9);
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, rad, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 10;
      ctx.strokeStyle = withA(P.orange, 0.8);
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, rad * 1.08 + 20, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    timeline(ctx, t);
    void M;
    void text;
    void FONT;
  },
  portal: (ctx) => ctx.beginPath(),
});
