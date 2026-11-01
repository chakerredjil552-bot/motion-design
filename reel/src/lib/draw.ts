// Canvas helpers: offscreen pool, type, shapes, halftone, grain, rim-lit silhouettes.
import {H, P, TAU, W, clamp, noise1, rnd} from './core';
import {GlyphPaint, capHeight, paintText, textWidthP} from './glyphs';

export type Ctx = CanvasRenderingContext2D;

const pool = new Map<string, HTMLCanvasElement>();
/** named offscreen canvas (created once per browser tab) */
export const off = (name: string, w = W, h = H) => {
  const key = `${name}:${w}x${h}`;
  let c = pool.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    pool.set(key, c);
  }
  return c;
};
export const ctxOf = (c: HTMLCanvasElement) => c.getContext('2d') as Ctx;

export const FONT = {
  display: 'Anton',
  mono: 'JetBrains Mono',
  sans: 'Inter',
};

export const font = (ctx: Ctx, size: number, family = FONT.display, weight = 400) => {
  ctx.font = `${weight} ${size}px "${family}"`;
};

/** text with tracking, alignment, optional outline and synthetic oblique — rendered as glyph paths */
export const text = (
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  o: {
    size: number;
    family?: string;
    weight?: number;
    color?: string;
    align?: CanvasTextAlign;
    track?: number;
    skew?: number;
    base?: 'alphabetic' | 'middle';
    stroke?: string;
    lineWidth?: number;
    strokeOnly?: boolean;
  },
) => {
  const family = o.family ?? FONT.display;
  const weight = o.weight ?? 400;
  ctx.save();
  ctx.translate(x, y + (o.base === 'middle' ? (o.size * capHeight(family)) / 2 : 0));
  if (o.skew) ctx.transform(1, 0, o.skew, 1, 0, 0);
  const paint: GlyphPaint = {fill: o.strokeOnly ? undefined : o.color ?? P.cream, stroke: o.stroke, lineWidth: o.lineWidth};
  const w = paintText(ctx, s, 0, 0, o.size, family, weight, paint, o.align ?? 'center', o.track ?? 0);
  ctx.restore();
  return w;
};

export const measure = (_ctx: Ctx, s: string, size: number, family = FONT.display, weight = 400, track = 0) =>
  textWidthP(s, size, family, weight, track);

/** fit font size so text spans maxW */
export const fitSize = (ctx: Ctx, s: string, maxW: number, maxSize: number, family = FONT.display, track = 0) => {
  const w = measure(ctx, s, 100, family, 400, track);
  return Math.min(maxSize, (maxW / w) * 100);
};

export const fillBg = (ctx: Ctx, color: string, pad = 4000) => {
  ctx.fillStyle = color;
  ctx.fillRect(-pad, -pad, W + pad * 2, H + pad * 2);
};

export const circle = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
};

export const poly = (ctx: Ctx, pts: number[][], close = true) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (close) ctx.closePath();
};

export const glow = (ctx: Ctx, x: number, y: number, r: number, color: string, a = 1) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withA(color, a));
  g.addColorStop(1, withA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
};

/** '#rrggbb' + alpha -> rgba() */
export const withA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(a)})`;
};

export const mixHex = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// ------------------------------------------------------------------------------------------ patterns
let halftoneCache: Record<string, CanvasPattern> = {};
export const halftone = (ctx: Ctx, color: string, cell = 14, dot = 0.38) => {
  const key = `${color}:${cell}:${dot}`;
  if (!halftoneCache[key]) {
    const c = off(`ht-${key}`, cell, cell);
    const x = ctxOf(c);
    x.clearRect(0, 0, cell, cell);
    x.fillStyle = color;
    circle(x, cell / 2, cell / 2, cell * dot);
    x.fill();
    halftoneCache[key] = ctx.createPattern(c, 'repeat') as CanvasPattern;
  }
  return halftoneCache[key];
};

/** seeded film-grain tiles */
export const grainTile = (i: number) => {
  const size = 256;
  const c = off(`grain-${i % 6}`, size, size);
  if (!(c as any)._done) {
    const x = ctxOf(c);
    const img = x.createImageData(size, size);
    for (let p = 0; p < size * size; p++) {
      const v = Math.floor(rnd(900 + (i % 6), p) * 255);
      img.data[p * 4] = v;
      img.data[p * 4 + 1] = v;
      img.data[p * 4 + 2] = v;
      img.data[p * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    (c as any)._done = true;
  }
  return c;
};

// ------------------------------------------------------------------------------------------ boil (line jitter on 2s)
export const boil = (seed: number, i: number, amt = 2.2) => [noise1(i * 1.37 + seed * 3.1, 5) * amt, noise1(i * 1.91 + seed * 2.3, 9) * amt];

/** draw a path builder twice: thick outline, then fill — gives union line art for multi-part silhouettes */
export const inkFill = (ctx: Ctx, parts: ((c: Ctx) => void)[], fill: string, line: string, lw: number) => {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = line;
  ctx.lineWidth = lw * 2;
  for (const p of parts) {
    p(ctx);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const p of parts) {
    p(ctx);
    ctx.fill();
  }
  ctx.restore();
};

export const capsule = (ctx: Ctx, x1: number, y1: number, x2: number, y2: number, r1: number, r2: number) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const n = a + Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(n) * r1, y1 + Math.sin(n) * r1);
  ctx.lineTo(x2 + Math.cos(n) * r2, y2 + Math.sin(n) * r2);
  ctx.arc(x2, y2, r2, n, n - Math.PI, true);
  ctx.lineTo(x1 - Math.cos(n) * r1, y1 - Math.sin(n) * r1);
  ctx.arc(x1, y1, r1, n + Math.PI, n, true);
  ctx.closePath();
};

export const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

export {H, W};
