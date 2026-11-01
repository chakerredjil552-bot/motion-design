// Text as vector paths. Glyph outlines are parsed from the bundled WOFF fonts with opentype.js and cached as
// Path2D at 1000 units/em, so every piece of text rasterises bit-identically regardless of render order
// (Chrome's shared glyph cache made transformed fillText differ by 1-2 levels between sessions).
import opentype from 'opentype.js';
import {staticFile} from 'remotion';

type GFont = {unitsPerEm: number; charToGlyph: (c: string) => any; ascender: number; descender: number};
const fonts = new Map<string, GFont>();
const FILES: [string, number, string][] = [
  ['Anton', 400, 'fonts/anton-latin-400-normal.woff'],
  ['JetBrains Mono', 400, 'fonts/jetbrains-mono-latin-400-normal.woff'],
  ['JetBrains Mono', 700, 'fonts/jetbrains-mono-latin-700-normal.woff'],
  ['JetBrains Mono', 800, 'fonts/jetbrains-mono-latin-800-normal.woff'],
  ['Inter', 500, 'fonts/inter-latin-500-normal.woff'],
  ['Inter', 800, 'fonts/inter-latin-800-normal.woff'],
  ['Inter', 900, 'fonts/inter-latin-900-normal.woff'],
];

export const loadGlyphFonts = async () => {
  await Promise.all(
    FILES.map(async ([family, weight, file]) => {
      const buf = await (await fetch(staticFile(file))).arrayBuffer();
      fonts.set(`${family}:${weight}`, opentype.parse(buf) as unknown as GFont);
    }),
  );
};

const pickFont = (family: string, weight: number) => {
  const exact = fonts.get(`${family}:${weight}`);
  if (exact) return exact;
  // nearest available weight of the family
  let best: GFont | undefined;
  let bd = 1e9;
  for (const [k, f] of fonts) {
    const [fam, w] = k.split(':');
    if (fam === family && Math.abs(Number(w) - weight) < bd) {
      bd = Math.abs(Number(w) - weight);
      best = f;
    }
  }
  if (!best) throw new Error(`font not loaded: ${family} ${weight}`);
  return best;
};

type G = {path: Path2D; adv: number};
const cache = new Map<string, G>();
export const glyph = (family: string, weight: number, ch: string): G => {
  const key = `${family}:${weight}:${ch}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const f = pickFont(family, weight);
  const g = f.charToGlyph(ch);
  const op = g.getPath(0, 0, 1000);
  const p = new Path2D();
  for (const c of op.commands) {
    if (c.type === 'M') p.moveTo(c.x, c.y);
    else if (c.type === 'L') p.lineTo(c.x, c.y);
    else if (c.type === 'Q') p.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
    else if (c.type === 'C') p.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else if (c.type === 'Z') p.closePath();
  }
  const out = {path: p, adv: ((g.advanceWidth ?? 0) * 1000) / f.unitsPerEm};
  cache.set(key, out);
  return out;
};

export const capHeight = (family: string) => (family === 'Anton' ? 0.73 : 0.73);

/** width of a string at `size` px with `track` px extra spacing between characters */
export const textWidthP = (s: string, size: number, family: string, weight: number, track = 0) => {
  let w = 0;
  for (const ch of s) w += (glyph(family, weight, ch).adv * size) / 1000;
  return w + track * Math.max(0, [...s].length - 1);
};

/** per-character advances (px) */
export const advancesP = (s: string, size: number, family: string, weight: number, track = 0) =>
  [...s].map((ch) => (glyph(family, weight, ch).adv * size) / 1000 + track);

export type GlyphPaint = {fill?: string | CanvasPattern; stroke?: string; lineWidth?: number; lineJoin?: CanvasLineJoin};

/** draw one glyph with its origin (baseline-left) at the current transform's (0,0) */
export const paintGlyph = (ctx: CanvasRenderingContext2D, ch: string, size: number, family: string, weight: number, paint: GlyphPaint) => {
  const g = glyph(family, weight, ch);
  const k = size / 1000;
  ctx.save();
  ctx.scale(k, k);
  if (paint.stroke) {
    ctx.lineJoin = paint.lineJoin ?? 'round';
    ctx.lineWidth = (paint.lineWidth ?? 2) / k;
    ctx.strokeStyle = paint.stroke;
    ctx.stroke(g.path);
  }
  if (paint.fill) {
    ctx.fillStyle = paint.fill;
    ctx.fill(g.path);
  }
  ctx.restore();
  return (g.adv * size) / 1000;
};

/** draw a string; (x, y) is the baseline anchor according to align */
export const paintText = (
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  family: string,
  weight: number,
  paint: GlyphPaint,
  align: CanvasTextAlign = 'left',
  track = 0,
) => {
  const w = textWidthP(s, size, family, weight, track);
  let cx = align === 'center' ? x - w / 2 : align === 'right' || align === 'end' ? x - w : x;
  for (const ch of s) {
    ctx.save();
    ctx.translate(cx, y);
    const adv = paintGlyph(ctx, ch, size, family, weight, paint);
    ctx.restore();
    cx += adv + track;
  }
  return w;
};
