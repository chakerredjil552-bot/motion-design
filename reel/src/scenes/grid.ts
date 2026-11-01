// Scene 5 — skill grid: a manga page of 9 panels replaying the skills. Each panel slams in on the beat grid
// (1 beat, 1/2, 1/4), the camera cuts to the newest panel, cuts accelerate, then the page whites out.
import {CX, CY, E, H, M, P, TAU, TL, W, clamp, lerp, rnd} from '../lib/core';
import {Ctx, FONT, halftone, poly, text, withA} from '../lib/draw';
import {WORLDS} from './worlds';
import {drawWorldNested} from './onetake';
import {drawBulletScene} from './bullet';

type Pt = [number, number];

// page frame and slanted gutters (line equations): rows y = a + b*x, columns x = c + d*y
const ROWS: [number, number][] = [
  [232, 0],
  [720, -0.06],
  [1180, 0.05],
  [1690, 0],
];
const COLS: [number, number][][] = [
  // per row: column lines (x = c + d*y)
  [[40, 0], [430, 0.08], [760, -0.1], [1040, 0]],
  [[40, 0], [330, -0.07], [700, 0.06], [1040, 0]],
  [[40, 0], [420, 0.09], [740, -0.05], [1040, 0]],
];
const GUT = 11; // half gutter

const inter = (row: [number, number], col: [number, number]): Pt => {
  // y = a + b x ; x = c + d y  ->  x = c + d (a + b x)  ->  x (1 - d b) = c + d a
  const [a, b] = row;
  const [c, d] = col;
  const x = (c + d * a) / (1 - d * b);
  return [x, a + b * x];
};

const PANELS: Pt[][] = (() => {
  const out: Pt[][] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const top: [number, number] = [ROWS[r][0] + (r ? GUT : 0), ROWS[r][1]];
      const bot: [number, number] = [ROWS[r + 1][0] - (r < 2 ? GUT : 0), ROWS[r + 1][1]];
      const lft: [number, number] = [COLS[r][c][0] + (c ? GUT : 0), COLS[r][c][1]];
      const rgt: [number, number] = [COLS[r][c + 1][0] - (c < 2 ? GUT : 0), COLS[r][c + 1][1]];
      out.push([inter(top, lft), inter(top, rgt), inter(bot, rgt), inter(bot, lft)]);
    }
  }
  return out;
})();

const bbox = (q: Pt[]) => {
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  return {x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys)};
};

// panel order on the page follows the skill order; slam frames from the timeline
const NAMES = [
  'MOTION DESIGN',
  'GRAPHIC DESIGN',
  'CHARACTER DESIGN',
  '2D ANIMATION',
  'ANIME DESIGN',
  'KINETIC TYPE',
  'VFX + GRADING',
  'SOUND + BEAT EDIT',
  'FIGHT ANIMATION',
];

const drawPanelContent = (ctx: Ctx, k: number, t: number, slam: number) => {
  const q = PANELS[k];
  const b = bbox(q);
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  ctx.save();
  poly(ctx, q);
  ctx.clip();
  const age = t - slam;
  // push-in inside the panel (camera move per cut)
  const push = 1 + 0.12 * E.outCubic(clamp(age / 60));
  if (k < WORLDS.length) {
    const w = WORLDS[k];
    const s = Math.max(bw / W, bh / H) * 1.35 * push;
    ctx.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    ctx.scale(s, s);
    ctx.translate(-w.P[0], -w.P[1]);
    drawWorldNested(ctx, k, TL.portals[k] + 40 + age, 1);
  } else {
    const s = Math.max(bw / W, bh / H) * 1.25 * push;
    ctx.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    ctx.scale(s, s);
    ctx.translate(-CX, -1010);
    drawBulletScene(ctx, M.contact + 60 + age * 0.5);
  }
  ctx.restore();
  // screentone + ink
  ctx.save();
  poly(ctx, q);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = halftone(ctx, 'rgba(20,16,24,0.22)', 9, 0.3);
  ctx.fillRect(b.x0, b.y0, bw, bh);
  ctx.globalCompositeOperation = 'source-over';
  // slam flash inside the panel
  const fl = 0.7 * (1 - clamp(age / 4));
  if (fl > 0) {
    ctx.fillStyle = withA(P.cream, fl);
    ctx.fillRect(b.x0, b.y0, bw, bh);
  }
  ctx.restore();
  poly(ctx, q);
  ctx.lineJoin = 'miter';
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#0B090D';
  ctx.stroke();
  // caption box (only inside the text-safe band)
  const capY = k < 3 ? b.y1 - 70 : b.y0 + 24;
  const capH = 46;
  if (capY > 255 && capY + capH < 1515) {
    const name = NAMES[k];
    const tw = Math.min(bw - 40, 26 + name.length * 19);
    const cx = k % 3 === 2 ? b.x1 - tw - 26 : b.x0 + 26;
    const a = clamp((age - 2) / 4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = P.cream;
    ctx.fillRect(cx, capY, tw, capH);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0B090D';
    ctx.strokeRect(cx, capY, tw, capH);
    text(ctx, name, cx + tw / 2, capY + 35, {size: 32, color: '#0B090D', track: 1});
    ctx.restore();
  }
};

const burst = (ctx: Ctx, q: Pt[], age: number) => {
  if (age < 0 || age > 14) return;
  const b = bbox(q);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const a = 1 - age / 14;
  ctx.save();
  for (let i = 0; i < 44; i++) {
    const ang = rnd(1301, i) * TAU;
    const r0 = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.55;
    const r1 = r0 + 140 + rnd(1302, i) * 260;
    ctx.strokeStyle = withA('#0B090D', 0.85 * a);
    ctx.lineWidth = 2 + rnd(1303, i) * 5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.stroke();
  }
  ctx.restore();
};

export const drawGrid = (ctx: Ctx, t: number, f: number) => {
  const slams = TL.panels;
  // which panels are on the page (decided on the integer frame: cuts never blur across)
  let n = 0;
  for (let i = 0; i < slams.length; i++) if (f >= slams[i]) n = i + 1;
  const cur = Math.max(0, n - 1);
  // camera: cut to the newest panel, tighter for the slow cuts, then the full page
  const q = PANELS[cur];
  const b = bbox(q);
  const isLast = f >= M.whiteout - 18;
  const age = t - slams[cur];
  const tight = cur < 2 ? 1.75 : cur < 5 ? 1.45 : 1.18;
  const zoomTarget = isLast ? 1 : tight;
  const settle = E.outCubic(clamp(age / (cur < 2 ? 70 : 30)));
  const zoom = isLast ? lerp(tight, 1, E.inOutCubic(clamp((t - (M.whiteout - 18)) / 18))) : zoomTarget * (1.08 - 0.08 * settle);
  const fx = isLast ? CX : lerp(CX, (b.x0 + b.x1) / 2, 0.85);
  const fy = isLast ? 960 : lerp(960, (b.y0 + b.y1) / 2, 0.85);
  // paper
  ctx.fillStyle = P.cream;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(zoom, zoom);
  ctx.rotate(isLast ? 0 : (cur % 2 ? 1 : -1) * 0.015 * (1 - settle));
  ctx.translate(-fx, -fy);
  ctx.fillStyle = P.cream;
  ctx.fillRect(-400, -400, W + 800, H + 800);
  ctx.fillStyle = halftone(ctx, 'rgba(120,100,90,0.10)', 12, 0.25);
  ctx.fillRect(-400, -400, W + 800, H + 800);
  // page border
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0B090D';
  ctx.strokeRect(28, 220, W - 56, 1482);
  for (let i = 0; i < n; i++) {
    drawPanelContent(ctx, i, t, slams[i]);
  }
  burst(ctx, PANELS[cur], age);
  // manga SFX on the last slam
  if (n === 9) {
    const a9 = t - slams[8];
    const k = E.outBack(clamp(a9 / 8), 2.5);
    ctx.save();
    ctx.translate(820, 1360);
    ctx.rotate(-0.18);
    ctx.scale(k, k);
    text(ctx, 'DOOM', 0, 0, {size: 170, color: P.orange, stroke: '#0B090D', lineWidth: 14, track: 4});
    ctx.restore();
  }
  ctx.restore();
  // white-out into the hard cut
  const wo = E.inCubic(clamp((t - M.whiteout) / (M.hardcut - M.whiteout)));
  if (wo > 0) {
    ctx.fillStyle = withA('#FFFFFF', wo);
    ctx.fillRect(0, 0, W, H);
  }
  void FONT;
};
