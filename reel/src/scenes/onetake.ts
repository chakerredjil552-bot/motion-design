// Scene 3 — the skill montage: eight worlds, a bar each (two get half a bar). Every change lands on a beat and
// the end of each world transforms into the start of the next (see worlds.ts); the hit system adds an
// earthquake on every beat and an impact on every change.
import {CUTS, CX, CY, E, M, P, TL, W, clamp, hits, lerp, spring} from '../lib/core';
import {Ctx, FONT, fitSize, text} from '../lib/draw';
import {advancesP, paintGlyph} from '../lib/glyphs';
import {WORLDS, Z} from './worlds';
import {drawBulletHome} from './bullet';
import {drawShardBlast} from './shatter';

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

/** which shot a frame belongs to (decided on the integer frame so a change never blends across sub-frames) */
export const shotIndex = (f: number) => {
  let i = 0;
  for (let k = 0; k < WORLDS.length; k++) if (f >= CUTS[k]) i = k;
  return i;
};

export const drawOneTake = (ctx: Ctx, t: number, f: number) => {
  const i = shotIndex(f);
  // keep the shot's own clock inside its range (sub-frames never leak across the change)
  const tt = clamp(t, CUTS[i], CUTS[i + 1] - 0.001);
  const w = WORLDS[i];
  const lt = tt - CUTS[i];
  const D = CUTS[i + 1] - CUTS[i];
  // a gentle push that is exactly 1.0 at both ends, so every transformation lands pixel-true
  const push = 1 + 0.05 * Math.sin(Math.PI * clamp(lt / D));
  const fx = lerp(CX, w.P[0], 0.5);
  const fy = lerp(CY, w.P[1], 0.5);
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(push, push);
  ctx.translate(-fx, -fy);
  ctx.fillStyle = w.bg;
  ctx.fillRect(-3000, -3000, W + 6000, 1920 + 6000);
  drawWorldNested(ctx, i, tt, 0);
  ctx.restore();
  drawTitle(ctx, tt, f, i);
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
  const sizes = lines.map((ln, k) => Math.round(fitSize(ctx, ln, 940, k === 0 ? 168 : 112, FONT.display, 2)));
  const ys = two ? [yBase - 120, yBase] : [yBase];
  const labelY = ys[0] - sizes[0] - 22;
  const exitK = clamp(1 - exitIn / 14);
  // label
  const la = clamp(age / 6) * (1 - exitK);
  if (la > 0) {
    ctx.save();
    ctx.globalAlpha = la;
    ctx.fillStyle = P.orange;
    ctx.fillRect(70, labelY - 26, 10 + 40 * E.outCubic(clamp(age / 10)), 8);
    text(ctx, label, 70 + 60, labelY - 14, {size: 30, family: FONT.mono, weight: 800, color: P.orange, align: 'left'});
    ctx.restore();
  }
  let j = 0;
  lines.forEach((ln, k) => {
    const size = sizes[k];
    const adv = advancesP(ln, size, FONT.display, 400, 2);
    let x = 70;
    [...ln].forEach((c, ci) => {
      // slam: each letter drops in big and snaps to size with RGB ghosts converging on it
      const la2 = age - 1 - j * 0.55;
      const k8 = E.outExpo(clamp(la2 / 8));
      const sp = spring(la2, 3.6, 0.42, 20);
      const ex = clamp((exitK - j * 0.012) / 0.66); // every letter is fully gone when exitIn reaches 0
      const yOff = (1 - k8) * -size * 0.35 - E.inCubic(ex) * 220;
      const sc = (1 + 1.4 * (1 - k8) + 0.06 * (sp - k8)) * (1 + 0.6 * E.inCubic(ex)) * (1 + 0.05 * bounce);
      const alpha = clamp(la2 / 2) * (1 - E.inQuad(ex));
      if (alpha > 0.01 && c !== ' ') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x + adv[ci] / 2, ys[k] + yOff);
        ctx.scale(sc, sc);
        ctx.transform(1, 0, -0.1, 1, 0, 0);
        ctx.translate(-adv[ci] / 2, 0);
        const g = (1 - k8) * 26 + 3;
        ctx.save();
        ctx.globalAlpha = alpha * (0.55 + 0.45 * (1 - k8));
        ctx.translate(-g, 0);
        paintGlyph(ctx, c, size, FONT.display, 400, {fill: P.neon});
        ctx.translate(2 * g, 4);
        paintGlyph(ctx, c, size, FONT.display, 400, {fill: P.orange});
        ctx.restore();
        paintGlyph(ctx, c, size, FONT.display, 400, {stroke: '#08070B', lineWidth: 12, fill: P.cream});
        // white-hot flash on landing
        const hot = 1 - clamp((la2 - 6) / 6);
        if (la2 > 5 && hot > 0) paintGlyph(ctx, c, size, FONT.display, 400, {fill: `rgba(255,255,255,${0.7 * hot})`});
        ctx.restore();
      }
      x += adv[ci];
      j++;
    });
  });
};

const drawTitle = (ctx: Ctx, t: number, f: number, i: number) => {
  const w = WORLDS[i];
  const age = t - TL.portals[i];
  const exitIn = TL.portals[i + 1] - t; // letters clear out before the transformation
  const h = hits(f);
  drawSkillTitle(ctx, w.title, `SKILL ${String(i + 1).padStart(2, '0')} / 09`, age, exitIn, h.bounce);
};
