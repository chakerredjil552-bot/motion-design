// Scene 3 — the one-take: one global exponential-zoom camera through nested worlds.
// u = (videoBeat - 12) / 2 ; world i occupies u in [i, i+1). Within a world the zoom is Z^ease(x), so every
// portal crossing lands exactly on a 2-beat line. Fixed point F makes the portal centre arrive at screen centre.
import {CX, CY, E, M, P, TAU, TL, W, beatOf, clamp, hits, spring} from '../lib/core';
import {Ctx, FONT, fitSize, font, withA} from '../lib/draw';
import {WORLDS, Z} from './worlds';
import {drawBulletHome} from './bullet';
import {drawShardBlast} from './shatter';

// Speed profile per world: a burst through the portal, a long readable dwell, then an accelerating dive.
// v(x) = vmin + A (e^{-x/t1} + e^{-(1-x)/t2}); entry and exit speeds match (within 0.5 %), so the camera is
// C1-continuous across every crossing. e(x) is its integral, normalised to e(1) = 1.
const VMIN = 0.22;
const T1 = 0.045;
const T2 = 0.2;
const A_V = (1 - VMIN) / (T1 * (1 - Math.exp(-1 / T1)) + T2 * (1 - Math.exp(-1 / T2)));
const ease = (x: number) =>
  VMIN * x + A_V * (T1 * (1 - Math.exp(-x / T1)) + T2 * (Math.exp(-(1 - x) / T2) - Math.exp(-1 / T2)));

export const camU = (t: number) => clamp((beatOf(t) - TL.portalBeats[0]) / 2, 0, WORLDS.length);

export const drawWorldNested = (ctx: Ctx, idx: number, t: number, depth: number) => {
  if (idx >= WORLDS.length) {
    drawBulletHome(ctx, t);
    return;
  }
  const w = WORLDS[idx];
  const lt = t - TL.portals[idx];
  ctx.save();
  w.back(ctx, lt, t);
  if (depth > 0) {
    ctx.save();
    w.portal(ctx, lt, t);
    ctx.clip();
    ctx.translate(w.P[0], w.P[1]);
    ctx.scale(1 / Z, 1 / Z);
    ctx.translate(-CX, -CY);
    drawWorldNested(ctx, idx + 1, t, depth - 1);
    ctx.restore();
  }
  w.front?.(ctx, lt, t);
  ctx.restore();
};

export const drawOneTake = (ctx: Ctx, t: number, f: number) => {
  const u = camU(t);
  let i = Math.floor(u);
  let x = u - i;
  if (i >= WORLDS.length) {
    i = WORLDS.length - 1;
    x = 1;
  }
  const s = Math.pow(Z, ease(x));
  const w = WORLDS[i];
  const Fx = (Z * w.P[0] - CX) / (Z - 1);
  const Fy = (Z * w.P[1] - CY) / (Z - 1);
  ctx.save();
  ctx.translate(Fx, Fy);
  ctx.scale(s, s);
  ctx.translate(-Fx, -Fy);
  drawWorldNested(ctx, i, t, 2);
  ctx.restore();
  drawTitle(ctx, t, f, i);
  if (t < M.drop + 30) drawShardBlast(ctx, t);
};

// ------------------------------------------------------------------------------------------ titles
export const drawSkillTitle = (
  ctx: Ctx,
  lines: string[],
  label: string,
  age: number,
  exitIn: number,
  bounce: number,
  yBase = 1470,
) => {
  const two = lines.length > 1;
  const sizes = lines.map((ln, k) => fitSize(ctx, ln, 940, k === 0 ? 168 : 112, FONT.display, 2));
  const ys = two ? [yBase - 120, yBase] : [yBase];
  const labelY = (two ? ys[0] - sizes[0] : ys[0] - sizes[0]) - 22;
  const exitK = clamp(1 - exitIn / 14);
  // label
  const la = clamp(age / 6) * (1 - exitK);
  if (la > 0) {
    ctx.save();
    ctx.globalAlpha = la;
    ctx.fillStyle = P.orange;
    ctx.fillRect(70, labelY - 26, 10 + 40 * E.outCubic(clamp(age / 10)), 8);
    font(ctx, 30, FONT.mono, 800);
    ctx.textAlign = 'left';
    ctx.fillStyle = P.orange;
    ctx.fillText(label, 70 + 60, labelY - 14);
    ctx.restore();
  }
  let j = 0;
  lines.forEach((ln, k) => {
    const size = sizes[k];
    font(ctx, size, FONT.display, 400);
    (ctx as any).letterSpacing = '0px';
    const widths = [...ln].map((c) => ctx.measureText(c).width + 2);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = 70;
    void total;
    [...ln].forEach((c, ci) => {
      const la2 = age - 1 - j * 0.9;
      const sp = spring(la2, 3.4, 0.36, 26);
      const ex = clamp((exitK * 1.6) - j * 0.03);
      const yOff = (1 - sp) * size * 0.9 - E.inCubic(ex) * 220;
      const sc = (1 + 0.5 * (1 - clamp(sp))) * (1 + 0.6 * E.inCubic(ex)) * (1 + 0.04 * bounce);
      const alpha = clamp(la2 / 3) * (1 - E.inQuad(ex));
      if (alpha > 0.01 && c !== ' ') {
        ctx.save();
        // mask so letters rise out from under the baseline
        ctx.beginPath();
        ctx.rect(0, ys[k] - size * 1.25 - 400 * ex, W, size * 1.45 + 400 * ex);
        ctx.clip();
        ctx.globalAlpha = alpha;
        ctx.translate(x + widths[ci] / 2, ys[k] + yOff);
        ctx.scale(sc, sc);
        ctx.transform(1, 0, -0.08, 1, 0, 0);
        font(ctx, size, FONT.display, 400);
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.fillStyle = k === 0 ? P.orange : P.neon;
        ctx.fillText(c, 7, 7);
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#08070B';
        ctx.strokeText(c, 0, 0);
        ctx.fillStyle = P.cream;
        ctx.fillText(c, 0, 0);
        ctx.restore();
      }
      x += widths[ci];
      j++;
    });
  });
  void withA;
};

const drawTitle = (ctx: Ctx, t: number, f: number, i: number) => {
  const w = WORLDS[i];
  const age = t - TL.portals[i];
  const exitIn = TL.portals[i + 1] - t;
  const h = hits(f);
  drawSkillTitle(ctx, w.title, `SKILL ${String(i + 1).padStart(2, '0')} / 09`, age, exitIn, h.bounce);
};
