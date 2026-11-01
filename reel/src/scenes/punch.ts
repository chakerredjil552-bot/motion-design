// Scene 8 — punchline: glitch-flash, the Claude Code logo pops in as a character (squash & stretch), holds one
// awkward beat, glances sideways, speech bubble, end tag; the outro glitches back into frame 0 for a clean loop.
// The supplied logo is used as given: nearest-neighbour upscale only (pixel art); nothing is redrawn.
import {CX, E, H, M, P, TL, W, clamp, rnd, spring} from '../lib/core';
import {Ctx, FONT, ctxOf, glow, off, roundRect, text, withA} from '../lib/draw';
import {LOGO} from '../lib/assets';
import logoManifest from '../data/logo.json';
import {chromatic, glitch} from '../lib/post';
import {drawImpactFrame} from './bullet';

const K = 4; // integer nearest-neighbour scale: 225 px -> 900 px
const FEET_Y = 1185;
const EYES = (logoManifest as {eyes: number[][]}).eyes;

/** the logo upscaled once with nearest-neighbour; later transforms only animate this crisp bitmap */
const logoBig = () => {
  const img = LOGO.img;
  if (!img) return null;
  const c = off('logo-big', img.naturalWidth * K, img.naturalHeight * K);
  if (!(c as any)._ok) {
    const x = ctxOf(c);
    x.clearRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0, c.width, c.height);
    (c as any)._ok = true;
  }
  return c;
};

const pose = (t: number) => {
  const a = t - M.punch;
  // pop: hop up from nothing with stretch, land with squash, spring back with overshoot
  const s = E.outBack(clamp((a - 4) / 10), 2.6);
  const hop = a >= 4 && a < 18 ? -150 * Math.sin(Math.PI * ((a - 4) / 14)) : 0;
  let w = 0;
  if (a >= 4 && a < 18) w = 0.24 * Math.sin(Math.PI * ((a - 4) / 14)); // stretched in the air
  if (a >= 18) w = -0.26 * Math.exp(-(a - 18) / 7) * Math.cos((a - 18) * 0.42); // landing squash + follow-through
  if (Math.abs(w) < 0.003) w = 0;
  const sy = s * (1 + w);
  const sx = s * (1 - 0.65 * w);
  // glance: tilt + lean toward screen-left, snapped on 2s like a pixel character
  const g = a >= TL.marks.glance - M.punch ? E.outBack(clamp((t - TL.marks.glance) / 9), 2) : 0;
  const rot = -0.065 * g;
  const dx = -26 * g;
  return {sx, sy, hop, rot, dx, glance: g > 0.5, visible: a >= 4};
};

const drawLogo = (ctx: Ctx, t: number) => {
  const big = logoBig();
  const p = pose(t);
  if (!p.visible) return;
  // floor shadow
  ctx.save();
  const shW = 330 * p.sx * (1 - Math.min(0.5, -p.hop / 400));
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.ellipse(CX + p.dx, FEET_Y + 12, Math.max(0, shW), Math.max(0, 26 * p.sx), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!big) {
    text(ctx, 'LOGO MISSING', CX, 900, {size: 80, color: P.orange});
    return;
  }
  const w = big.width;
  const h = big.height;
  ctx.save();
  ctx.translate(CX + p.dx, FEET_Y + p.hop);
  ctx.rotate(p.rot);
  ctx.scale(p.sx, p.sy);
  ctx.translate(-w / 2, -186 * K); // feet (source row 186) on the floor line
  // eye whites live *behind* the logo and only show through its eye holes: looking left = white on the right
  if (p.glance) {
    ctx.fillStyle = P.cream;
    for (const [ex, ey, ew, eh] of EYES) ctx.fillRect((ex + ew / 2) * K, ey * K, (ew / 2) * K, eh * K);
  }
  const still = p.sx === 1 && p.sy === 1 && p.rot === 0 && p.hop === 0;
  ctx.imageSmoothingEnabled = !still; // pixel-exact at rest, anti-aliased edges only while it moves
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(big, 0, 0);
  ctx.restore();
};

const drawBubble = (ctx: Ctx, t: number) => {
  const a = t - TL.marks.bubble;
  if (a < 0) return;
  const k = E.outBack(clamp(a / 9), 2.4);
  const squash = 1 + 0.1 * Math.exp(-a / 6) * Math.sin(a * 0.6);
  const bx = 120;
  const by = 330;
  const bw = 840;
  const bh = 240;
  const tip: [number, number] = [372, 640];
  ctx.save();
  ctx.translate(tip[0], tip[1]);
  ctx.scale(k * squash, k / squash);
  ctx.translate(-tip[0], -tip[1]);
  const shape = () => {
    roundRect(ctx, bx, by, bw, bh, 60);
    ctx.moveTo(330, by + bh - 4);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(440, by + bh - 4);
  };
  ctx.save();
  ctx.translate(10, 10);
  shape();
  ctx.fillStyle = P.orange;
  ctx.fill();
  ctx.restore();
  shape();
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#08070B';
  ctx.stroke();
  ctx.fillStyle = P.cream;
  ctx.fill();
  // cover the seam between bubble and tail
  ctx.fillRect(334, by + bh - 14, 102, 16);
  const words = TL.copy.bubble; // exact copy: "he forced me to say that"
  const split = words.indexOf(' to ');
  const l1 = words.slice(0, split);
  const l2 = words.slice(split + 1);
  text(ctx, l1, bx + bw / 2, by + 100, {size: 64, family: FONT.mono, weight: 800, color: '#08070B'});
  text(ctx, l2, bx + bw / 2, by + 182, {size: 64, family: FONT.mono, weight: 800, color: '#08070B'});
  ctx.restore();
};

const drawTag = (ctx: Ctx, t: number) => {
  const a = t - TL.marks.tag;
  if (a < 0) return;
  const k = E.outCubic(clamp(a / 14));
  ctx.save();
  ctx.globalAlpha = k;
  text(ctx, `[${TL.copy.tag}]`, CX, 1420 + (1 - k) * 20, {size: 34, family: FONT.mono, weight: 700, color: withA(P.cream, 0.85)});
  ctx.fillStyle = P.orange;
  const uw = 300 * E.outCubic(clamp((a - 4) / 16));
  ctx.fillRect(CX - uw / 2, 1446, uw, 5);
  ctx.restore();
};

export const drawPunch = (ctx: Ctx, t: number, f: number) => {
  ctx.fillStyle = '#0A090D';
  ctx.fillRect(0, 0, W, H);
  // pixel-grid floor + warm key light behind the character
  ctx.fillStyle = withA(P.cream, 0.05);
  for (let y = 300; y < H; y += 48) for (let x = 12; x < W; x += 48) ctx.fillRect(x, y, 4, 4);
  glow(ctx, CX, 900, 820, P.orange, 0.16);
  ctx.strokeStyle = withA(P.cream, 0.1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, FEET_Y + 14);
  ctx.lineTo(W - 60, FEET_Y + 14);
  ctx.stroke();
  drawLogo(ctx, t);
  drawBubble(ctx, t);
  drawTag(ctx, t);
  // outro: the loop point — slices of frame 0 (the inverted impact frame) take over the last frames
  const lo = f - (TL.totalFrames - 10);
  if (lo >= 0) {
    const src = off('loop-frame0');
    if (!(src as any)._ok) {
      const x = ctxOf(src);
      x.fillStyle = '#000';
      x.fillRect(0, 0, W, H);
      drawImpactFrame(x, M.snap, true);
      (src as any)._ok = true;
    }
    const cover = (lo + 1) / 10; // last frame shows frame 0 completely
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      if (rnd(4400 + i, 1) < cover || lo === 9) {
        const y = (i * H) / bands;
        ctx.drawImage(src, 0, y, W, H / bands + 1, 0, y, W, H / bands + 1);
      }
    }
  }
};

/** post-level glitch for the punchline: the entrance flash and the outro ramp */
export const punchPost = (ctx: Ctx, f: number) => {
  const a = f - M.punch;
  if (a >= 0 && a < 8) {
    glitch(ctx, 1, 9100 + a);
    chromatic(ctx, 24 * (1 - a / 8));
    if (a < 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
  const o = f - TL.marks.outro;
  if (o >= 0 && f < TL.totalFrames - 1) {
    const ramp = clamp(o / (TL.totalFrames - TL.marks.outro));
    if (o % 3 === 0 || ramp > 0.6) glitch(ctx, 0.3 + 0.7 * ramp, 9300 + o);
    chromatic(ctx, 4 + 18 * ramp * ramp);
  }
};
