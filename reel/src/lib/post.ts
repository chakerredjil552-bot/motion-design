// Post stack: camera punch/shake, bloom, radial chromatic aberration, glitch slices, light leaks,
// flash, invert, grain, vignette. All deterministic per frame.
import {CX, CY, H, Hits, P, W, clamp, rnd} from './core';
import {Ctx, ctxOf, grainTile, off, withA} from './draw';

export const camera = (dst: Ctx, src: HTMLCanvasElement, h: Hits, extraZoom = 0) => {
  // zoom slightly with the shake so the frame edge never shows
  const z = 1 + h.punch + extraZoom + (Math.abs(h.shakeX) + Math.abs(h.shakeY)) / CX + Math.abs(h.shakeR) * 1.2;
  dst.save();
  dst.fillStyle = P.black;
  dst.fillRect(0, 0, W, H);
  dst.translate(CX + h.shakeX, CY + h.shakeY);
  dst.rotate(h.shakeR);
  dst.scale(z, z);
  dst.translate(-CX, -CY);
  dst.drawImage(src, 0, 0);
  dst.restore();
};

export const bloom = (ctx: Ctx, strength: number) => {
  if (strength <= 0.01) return;
  const sw = W / 4;
  const sh = H / 4;
  const a = off('bloomA', sw, sh);
  const ac = ctxOf(a);
  ac.save();
  ac.clearRect(0, 0, sw, sh);
  ac.filter = 'brightness(0.6) contrast(4) saturate(1.3)';
  ac.drawImage(ctx.canvas, 0, 0, sw, sh);
  ac.restore();
  const b = off('bloomB', sw, sh);
  const bc = ctxOf(b);
  bc.save();
  bc.clearRect(0, 0, sw, sh);
  bc.filter = 'blur(9px)';
  bc.drawImage(a, 0, 0);
  bc.filter = 'blur(22px)';
  bc.globalAlpha = 0.8;
  bc.drawImage(a, 0, 0);
  bc.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = clamp(strength, 0, 1.5);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(b, 0, 0, W, H);
  ctx.restore();
};

const channel = (src: HTMLCanvasElement, name: string, color: string) => {
  const c = off(`ch-${name}`);
  const x = ctxOf(c);
  x.save();
  x.globalCompositeOperation = 'copy';
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = color;
  x.fillRect(0, 0, W, H);
  x.restore();
  return c;
};

/** radial RGB split: red scaled out, blue scaled in */
export const chromatic = (ctx: Ctx, px: number) => {
  if (px < 0.6) return;
  const src = off('caSrc');
  const s = ctxOf(src);
  s.globalCompositeOperation = 'copy';
  s.drawImage(ctx.canvas, 0, 0);
  s.globalCompositeOperation = 'source-over';
  const r = channel(src, 'r', '#FF0000');
  const g = channel(src, 'g', '#00FF00');
  const b = channel(src, 'b', '#0000FF');
  const k = px / CX;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const drawScaled = (c: HTMLCanvasElement, sc: number, dx: number) => {
    ctx.save();
    ctx.translate(CX + dx, CY);
    ctx.scale(sc, sc);
    ctx.translate(-CX, -CY);
    ctx.drawImage(c, 0, 0);
    ctx.restore();
  };
  // every channel scales >= 1 so the frame edge stays covered
  drawScaled(r, 1 + 2 * k, 0);
  drawScaled(g, 1 + k, 0);
  drawScaled(b, 1, 0);
  ctx.restore();
};

/** horizontal slice displacement with per-slice RGB offset */
export const glitch = (ctx: Ctx, amount: number, seed: number) => {
  if (amount <= 0.02) return;
  const src = off('glSrc');
  const s = ctxOf(src);
  s.globalCompositeOperation = 'copy';
  s.drawImage(ctx.canvas, 0, 0);
  s.globalCompositeOperation = 'source-over';
  const n = 5 + Math.floor(rnd(seed, 0) * 7);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(rnd(seed, i * 3 + 1) * H);
    const h = Math.floor(8 + rnd(seed, i * 3 + 2) * 120 * amount);
    const dx = (rnd(seed, i * 3 + 3) - 0.5) * 160 * amount;
    ctx.drawImage(src, 0, y, W, h, dx, y, W, h);
    if (rnd(seed, i * 5 + 7) > 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5 * amount;
      ctx.fillStyle = rnd(seed, i + 99) > 0.5 ? P.neon : P.orange;
      ctx.fillRect(0, y, W, Math.max(2, h * 0.15));
      ctx.restore();
    }
  }
};

export const lightLeak = (ctx: Ctx, f: number, amt: number, warm = P.orange, cool = P.neon) => {
  if (amt <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const t = f / 120;
  const blobs = [
    {x: W * (0.1 + 0.25 * Math.sin(t * 0.7)), y: H * (0.2 + 0.1 * Math.cos(t * 0.5)), r: 900, c: warm, a: 0.32},
    {x: W * (0.95 - 0.2 * Math.sin(t * 0.43)), y: H * (0.78 + 0.08 * Math.sin(t * 0.9)), r: 800, c: cool, a: 0.18},
    {x: W * (0.5 + 0.4 * Math.cos(t * 0.31)), y: H * (0.5 + 0.3 * Math.sin(t * 0.27)), r: 600, c: '#FFD2B8', a: 0.12},
  ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, withA(b.c, b.a * amt));
    g.addColorStop(1, withA(b.c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
};

export const flash = (ctx: Ctx, a: number, color = P.white) => {
  if (a <= 0.005) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = withA(color, a);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
};

export const invert = (ctx: Ctx) => {
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
};

export const grain = (ctx: Ctx, f: number, amt = 0.07) => {
  const fi = Math.floor(f / 2); // grain on 2s
  const tile = grainTile(fi);
  const ox = Math.floor(rnd(fi, 1) * 256);
  const oy = Math.floor(rnd(fi, 2) * 256);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amt;
  const pat = ctx.createPattern(tile, 'repeat') as CanvasPattern;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
};

export const vignette = (ctx: Ctx, amt = 0.55) => {
  ctx.save();
  const g = ctx.createRadialGradient(CX, CY, H * 0.25, CX, CY, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${amt})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
};

/** subtle scanlines for terminal scenes */
export const scanlines = (ctx: Ctx, amt = 0.12) => {
  ctx.save();
  ctx.globalAlpha = amt;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  ctx.restore();
};
