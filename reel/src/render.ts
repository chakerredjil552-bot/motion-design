// Master frame renderer: pick the scene by integer frame, accumulate motion-blur sub-frames,
// then run the post stack and the HUD. Pure function of the frame number.
import {H, M, P, TL, TOTAL, W, hits} from './lib/core';
import {Ctx, FONT, ctxOf, off, text, withA} from './lib/draw';
import {bloom, camera, chromatic, flash, glitch, grain, lightLeak, scanlines, vignette} from './lib/post';
import {drawClosing, drawTerminal} from './scenes/terminal';
import {drawShatter} from './scenes/shatter';
import {drawOneTake} from './scenes/onetake';
import {drawBullet, drawImpactFrame, isImpactFrame} from './scenes/bullet';
import {drawGrid} from './scenes/grid';
import {drawPunch, punchPost} from './scenes/punch';

type Spec = {
  draw: (ctx: Ctx, t: number, f: number) => void;
  samples: number;
  shutter: number; // fraction of a frame
  hit: number; // hit-system intensity
  bloom: number;
  leak: number;
  grain: number;
  vignette: number;
  scan?: number;
};

const S = TL.scenes;

const black: Spec['draw'] = (ctx) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
};

/** frame 0..72: the inverted impact frame from the bullet-time snap, as a 1-beat teaser */
const drawTeaser: Spec['draw'] = (ctx, t, f) => {
  drawImpactFrame(ctx, M.snap, true);
  void t;
  void f;
};

export const specFor = (f: number): Spec => {
  if (f < M.teaserEnd) return {draw: drawTeaser, samples: 2, shutter: 0.5, hit: 0.2, bloom: 0.3, leak: 0, grain: 0.09, vignette: 0.35};
  if (f < S.terminal[1]) return {draw: drawTerminal, samples: 2, shutter: 0.5, hit: 0.35, bloom: 0.35, leak: 0, grain: 0.08, vignette: 0.6, scan: 0.1};
  if (f < S.shatter[1]) return {draw: drawShatter, samples: f >= M.burst && f < M.freeze ? 4 : 3, shutter: 0.75, hit: 0.7, bloom: 0.45, leak: 0.2, grain: 0.08, vignette: 0.55};
  if (f < S.onetake[1]) return {draw: drawOneTake, samples: 3, shutter: 0.7, hit: 1, bloom: 0.32, leak: 0.45, grain: 0.07, vignette: 0.45};
  if (f < S.bullet[1]) {
    const fast = f < M.contact + 6 || f >= M.snap;
    return {draw: drawBullet, samples: fast ? 4 : 2, shutter: fast ? 0.9 : 0.5, hit: 1, bloom: 0.55, leak: 0.25, grain: 0.07, vignette: 0.5};
  }
  if (f < S.grid[1]) return {draw: drawGrid, samples: 3, shutter: 0.7, hit: 1, bloom: 0.35, leak: 0.1, grain: 0.06, vignette: 0.3};
  if (f < S.hardcut[1]) return {draw: black, samples: 1, shutter: 0, hit: 0, bloom: 0, leak: 0, grain: 0, vignette: 0};
  if (f < S.closing[1]) return {draw: drawClosing, samples: 2, shutter: 0.5, hit: 0, bloom: 0.3, leak: 0, grain: 0.07, vignette: 0.55, scan: 0.08};
  return {draw: drawPunch, samples: 2, shutter: 0.6, hit: 0, bloom: 0.35, leak: 0.1, grain: 0.07, vignette: 0.45};
};

const drawHud = (ctx: Ctx, f: number) => {
  if (f >= TL.hudEnd) return;
  const shown = f - (f % 4); // steps on 4s so the 60/30 fps blends never ghost two numbers
  const s = `FRAME ${String(shown).padStart(5, '0')} / ${String(TOTAL).padStart(5, '0')} · 120 FPS · BUGS: 0`;
  ctx.save();
  ctx.fillStyle = 'rgba(8,7,11,0.42)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 350, 258, 700, 52, 10);
  ctx.fill();
  text(ctx, s, W / 2, 290, {size: 27, family: FONT.mono, weight: 700, color: withA(P.cream, 0.85), track: 1});
  ctx.fillStyle = withA(P.orange, 0.9);
  ctx.fillRect(W / 2 - 330, 302, 660 * ((f % 4 === 0 ? f : shown) / TOTAL), 3);
  ctx.restore();
};

export const renderFrame = (out: Ctx, f: number) => {
  const sp = specFor(f);
  const acc = off('acc');
  const a = ctxOf(acc);
  const sm = off('sample');
  const s = ctxOf(sm);
  const n = sp.samples;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? f : f + sp.shutter * ((i + 0.5) / n - 0.5);
    const target = i === 0 ? a : s;
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalAlpha = 1;
    target.globalCompositeOperation = 'source-over';
    target.filter = 'none';
    target.fillStyle = '#000';
    target.fillRect(0, 0, W, H);
    sp.draw(target, t, f);
    target.setTransform(1, 0, 0, 1, 0, 0);
    if (i > 0) {
      a.save();
      a.globalAlpha = 1 / (i + 1);
      a.drawImage(sm, 0, 0);
      a.restore();
    }
  }
  const h = hits(f, sp.hit);
  if (isImpactFrame(f)) {
    // the impact frame is its own flash: keep it crisp two-tone
    h.flash = 0;
    h.ca = 0;
    h.glitch = 0;
  }
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
  camera(out, acc, h);
  if (!isImpactFrame(f)) bloom(out, sp.bloom * (1 + h.flash));
  chromatic(out, h.ca);
  glitch(out, h.glitch, h.glitchSeed);
  lightLeak(out, f, sp.leak);
  if (f >= S.punch[0]) punchPost(out, f);
  flash(out, h.flash);
  if (sp.scan) scanlines(out, sp.scan);
  if (sp.grain) grain(out, f, sp.grain);
  if (sp.vignette) vignette(out, sp.vignette);
  drawHud(out, f);
};
