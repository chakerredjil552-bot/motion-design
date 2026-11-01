// The eight skill worlds of the montage. Each lives in "home" coordinates (1080x1920) and gets a full bar
// (the two quick ones half a bar). The end of every world transforms into the start of the next one:
// shards -> shape; circle -> the D; the D -> the pupil (eye3d); eyeball -> the ball; ball -> the moon;
// lit window -> the type scene; the zero -> the colour wheel; the wheel -> the speaker cone (speaker3d);
// the cone blows open -> the clash (bullet). Every world ends by settling exactly onto the next first frame.
import {CX, E, FPB, H, P, TAU, TL, W, clamp, envAt, last, lerp, onTwos, boilSeed, ring, rnd, rndr, spring} from '../lib/core';
import {Ctx, FONT, circle, fillBg, glow, halftone, measure, mixHex, poly, roundRect, text, withA} from '../lib/draw';
import {drawFigure, figurePath, standPose} from '../lib/figure';
import {makeEyeWorld} from './eye3d';
import {makeSpeakerWorld} from './speaker3d';
import {drawBulletHome} from './bullet';

export const Z = 8;
export type World = {
  id: string;
  title: string[];
  P: [number, number];
  bg: string;
  titleInk?: string;
  back: (ctx: Ctx, lt: number, t: number) => void;
  portal: (ctx: Ctx, lt: number, t: number) => void;
  front?: (ctx: Ctx, lt: number, t: number) => void;
};

const lbOf = (lt: number) => lt / FPB; // local beats
export const OUT = 44; // frames of transformation at the end of a world
const DUR = (i: number) => TL.portals[i + 1] - TL.portals[i];
const outK = (i: number, lt: number) => clamp((lt - (DUR(i) - OUT)) / OUT);
const xfadeK = (i: number, lt: number) => clamp((lt - (DUR(i) - 10)) / 10);
/** a beat-placed entrance: 0 before `beat`, springs to 1 (on 2s) */
const enter = (lt: number, beat: number, len = 16, over = 1.8) => E.outBack(clamp((onTwos(lt) - beat * FPB) / len), over);
const kickBump = (t: number, amt = 0.03) => {
  const k = last('kick', t);
  return 1 + amt * clamp(k.s * 1.3) * Math.max(0, ring(k.age, 6, 0.06));
};

// ------------------------------------------------------------------------------------------ polygon tools
type Pt = [number, number];
const circlePts = (cx: number, cy: number, r: number, n = 160, start = (-3 * Math.PI) / 4): Pt[] =>
  Array.from({length: n}, (_, i) => {
    const a = start + (i / n) * TAU;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
const lerpPts = (a: Pt[], b: Pt[], k: number): Pt[] => a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)] as Pt);
const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] =>
  Array.from({length: n}, (_, i) => {
    const t = (i + 1) / n;
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ] as Pt;
  });
const line = (a: Pt, b: Pt, n: number): Pt[] => Array.from({length: n}, (_, i) => [lerp(a[0], b[0], (i + 1) / n), lerp(a[1], b[1], (i + 1) / n)] as Pt);
/** arc-length resample of a closed polyline */
const resample = (pts: Pt[], n: number): Pt[] => {
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(d);
    total += d;
  }
  const out: Pt[] = [];
  let i = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (acc + seg[i] < target && i < pts.length - 1) {
      acc += seg[i];
      i++;
    }
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const f = seg[i] ? (target - acc) / seg[i] : 0;
    out.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
  }
  return out;
};
const ringPath = (ctx: Ctx, outer: Pt[], inner: Pt[]) => {
  ctx.beginPath();
  outer.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  inner.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
};

// ================================================================================================ W1 MOTION DESIGN
const W1P: [number, number] = [540, 930];
const shapeR = (kind: number, th: number, R: number) => {
  switch (kind) {
    case 0: {
      const a = ((th % (TAU / 4)) + TAU / 4) % (TAU / 4) - TAU / 8;
      return (R * 0.82) / Math.cos(a);
    }
    case 1: {
      const a = (((th + Math.PI / 2) % (TAU / 3)) + TAU / 3) % (TAU / 3) - Math.PI / 3;
      return (R * 0.58) / Math.cos(a);
    }
    case 2: {
      const seg = TAU / 10;
      const a = (((th + Math.PI / 2) % seg) + seg) % seg;
      const k = Math.floor(((((th + Math.PI / 2) % TAU) + TAU) % TAU) / seg) % 2;
      return lerp(k === 0 ? R : R * 0.48, k === 0 ? R * 0.48 : R, a / seg);
    }
    default:
      return 150;
  }
};
const morphState = (lt: number) => {
  // square (the shards' shape) -> triangle on the drop -> star on beat 0.5 -> circle on beat 1
  const lb = lbOf(lt);
  const T = [0.0, 0.5, 1.0];
  let from = 0;
  let to = 0;
  let k = 1;
  for (let i = 0; i < T.length; i++) {
    if (lb >= T[i]) {
      from = i;
      to = i + 1;
      k = E.outBack(clamp((lb - T[i]) / 0.2), 2.0);
    }
  }
  const settle = 1 - clamp((lb - 1.0) / 0.3);
  const rot = (lb * 0.9 + (to * Math.PI) / 5) * settle;
  return {from, to, k, rot};
};
const shapePath = (ctx: Ctx, lt: number, R = 240) => {
  const {from, to, k, rot} = morphState(lt);
  const n = 120;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * TAU;
    const r = lerp(shapeR(from, th - rot, R), shapeR(to, th - rot, R), k);
    const x = W1P[0] + Math.cos(th) * r;
    const y = W1P[1] + Math.sin(th) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
};
function orbiters(ctx: Ctx, lt: number, front: boolean, alpha = 1) {
  for (let i = 0; i < 9; i++) {
    const sp = 0.035 + i * 0.006;
    const a = lt * sp + i * 0.9;
    const z = Math.sin(a);
    if (front !== z > 0) continue;
    const rx = 280 + i * 30;
    const ry = 120 + i * 18;
    const x = W1P[0] + Math.cos(a) * rx;
    const y = W1P[1] + Math.sin(a) * ry + (i - 4) * 36;
    const vx = -Math.sin(a) * rx * sp;
    const vy = Math.cos(a) * ry * sp;
    const stretch = 1 + Math.hypot(vx, vy) * 0.05;
    const s = (18 + i * 4) * (0.8 + 0.3 * z);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.scale(stretch, 1 / stretch);
    ctx.fillStyle = [P.orange, P.neon, P.cream][i % 3];
    if (i % 3 === 0) {
      circle(ctx, 0, 0, s);
      ctx.fill();
    } else if (i % 3 === 1) ctx.fillRect(-s, -s, s * 2, s * 2);
    else {
      poly(ctx, [[s, 0], [-s, -s], [-s, s]]);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ================================================================================================ the D
const W2P: [number, number] = [560, 1010];
const D_N = 160;
const D_OUTER: Pt[] = (() => {
  const [px, py] = W2P;
  const sx = px - 175;
  const a: Pt = [sx, py - 290];
  const b: Pt = [px + 10, py - 290];
  const c: Pt = [px + 10, py + 290];
  const d: Pt = [sx, py + 290];
  const pts: Pt[] = [a, ...line(a, b, 20), ...cubic(b, [px + 400, py - 290], [px + 400, py + 290], c, 80), ...line(c, d, 20), ...line(d, a, 40).slice(0, -1)];
  return resample(pts, D_N);
})();
const D_COUNTER: Pt[] = (() => {
  const [px, py] = W2P;
  const ix = px - 88;
  const a: Pt = [ix, py - 190];
  const b: Pt = [px + 10, py - 190];
  const c: Pt = [px + 10, py + 190];
  const d: Pt = [ix, py + 190];
  const pts: Pt[] = [a, ...line(a, b, 14), ...cubic(b, [px + 240, py - 190], [px + 240, py + 190], c, 60), ...line(c, d, 14), ...line(d, a, 30).slice(0, -1)];
  return resample(pts, D_N);
})();
/** where W3 starts: a black pupil of radius 260 at the eye centre, on cream */
const PUPIL: Pt[] = circlePts(540, 940, 260, D_N);
const PUPIL_HOLE: Pt[] = circlePts(540, 940, 0.5, D_N);

const drawD = (ctx: Ctx, outer: Pt[], inner: Pt[], plate: number, ink: string) => {
  if (plate > 0) {
    ctx.save();
    ctx.globalAlpha = plate;
    ctx.translate(14, 10);
    ringPath(ctx, outer, inner);
    ctx.fillStyle = P.orange;
    ctx.fill('evenodd');
    ctx.restore();
  }
  ringPath(ctx, outer, inner);
  ctx.fillStyle = ink;
  ctx.fill('evenodd');
};

const W1: World = {
  id: 'motion',
  title: ['MOTION DESIGN'],
  P: W1P,
  bg: '#0B0A10',
  back: (ctx, lt, t) => {
    fillBg(ctx, '#0B0A10');
    ctx.fillStyle = withA(P.cream, 0.07);
    for (let y = 100; y < H; y += 60) for (let x = 30; x < W; x += 60) ctx.fillRect(x, y, 3, 3);
    glow(ctx, W1P[0], W1P[1], 700, P.orange, 0.22 + 0.2 * envAt('low', t));
    // graph-editor ease curve, a dot riding it once per beat
    const gx0 = 110;
    const gx1 = 970;
    const gy0 = 1720;
    const gy1 = 1560;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = withA(P.cream, 0.18);
    ctx.strokeRect(gx0 - 20, gy1 - 40, gx1 - gx0 + 40, gy0 - gy1 + 80);
    ctx.strokeStyle = P.neon;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    ctx.bezierCurveTo(gx0 + 420, gy0, gx1 - 300, gy1, gx1, gy1);
    ctx.stroke();
    const u = (((lt / FPB) % 1) + 1) % 1;
    ctx.fillStyle = P.cream;
    circle(ctx, lerp(gx0, gx1, u), lerp(gy0, gy1, E.inOutCubic(u)), 12);
    ctx.fill();
    ctx.restore();
    orbiters(ctx, lt, false, 1 - outK(0, lt));
  },
  portal: (ctx) => ctx.beginPath(),
  front: (ctx, lt) => {
    const ok = outK(0, lt);
    if (ok <= 0) {
      for (let i = 3; i >= 1; i--) {
        ctx.save();
        shapePath(ctx, lt - i * 5);
        ctx.lineWidth = 4;
        ctx.strokeStyle = withA(i % 2 ? P.neon : P.orange, 0.35 / i);
        ctx.stroke();
        ctx.restore();
      }
      // the paper of the next world shows through the shape
      ctx.save();
      shapePath(ctx, lt);
      ctx.fillStyle = P.cream;
      ctx.fill();
      ctx.lineWidth = 16;
      ctx.strokeStyle = P.orange;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
      orbiters(ctx, lt, true);
      const lb = lbOf(lt);
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(220 + i * 92, 1480);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = lb * 4 > i ? P.orange : withA(P.cream, 0.25);
        ctx.fillRect(-11, -11, 22, 22);
        ctx.restore();
      }
    } else {
      // the circle floods the frame with paper while the ring becomes the D
      const k = E.inOutCubic(ok);
      orbiters(ctx, lt, true, 1 - k);
      ctx.fillStyle = P.cream;
      circle(ctx, W1P[0], W1P[1], lerp(150, 2300, E.inCubic(ok)));
      ctx.fill();
      const outer = lerpPts(circlePts(W1P[0], W1P[1], 158, D_N), D_OUTER, k);
      const inner = lerpPts(circlePts(W1P[0], W1P[1], 142, D_N), D_COUNTER, k);
      drawD(ctx, outer, inner, k, mixHex(P.orange, P.bg, k));
    }
    const xf = xfadeK(0, lt);
    if (xf > 0) {
      ctx.save();
      ctx.globalAlpha = xf;
      drawWorldAt(ctx, 1, 0);
      ctx.restore();
    }
  },
};

// ================================================================================================ W2 GRAPHIC DESIGN
const slide = (lt: number, beat: number, dx: number, dy: number, ok: number, fx: number, fy: number) => {
  const k = enter(lt, beat);
  const out = E.inCubic(ok);
  return {x: dx * (1 - k) + fx * 900 * out, y: dy * (1 - k) + fy * 900 * out, a: clamp(k * 3) * (1 - out), s: 1 + 0.5 * out};
};
const W2: World = {
  id: 'graphic',
  title: ['GRAPHIC DESIGN'],
  P: W2P,
  bg: P.cream,
  titleInk: P.bg,
  back: (ctx, lt, t) => {
    const ok = outK(1, lt);
    fillBg(ctx, P.cream);
    ctx.fillStyle = withA('#B9AE9F', 0.25 * (1 - ok));
    for (let i = 0; i < 160; i++) ctx.fillRect(rnd(5, i) * W, rnd(6, i) * H, rndr(7, i, 8, 40), 1.5);
    const drift = (k: number) => Math.sin(lt * 0.02 + k) * 6;
    const bump = kickBump(t, 0.04);
    // orange block with halftone (beat 0.25)
    let s = slide(lt, 0.25, -700, 0, ok, -1, -0.6);
    if (s.a > 0) {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.translate(260 + s.x, 560 + s.y + drift(1));
      ctx.rotate(-0.14);
      ctx.scale(s.s * bump, s.s * bump);
      ctx.fillStyle = P.orange;
      ctx.fillRect(-250, -340, 500, 680);
      ctx.fillStyle = halftone(ctx, withA(P.orangeDk, 0.7), 16, 0.32);
      ctx.fillRect(-250, -340, 500, 680);
      text(ctx, 'BOLD.', -230, 300, {size: 190, color: P.bg, align: 'left'});
      ctx.restore();
    }
    // cyan disc (beat 0.5)
    s = slide(lt, 0.5, 500, -400, ok, 1, -0.8);
    if (s.a > 0) {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.translate(860 + s.x, 520 + s.y + drift(2));
      ctx.scale(s.s * bump, s.s * bump);
      ctx.fillStyle = P.neon;
      circle(ctx, 0, 0, 220);
      ctx.fill();
      ctx.fillStyle = halftone(ctx, withA('#06606B', 0.55), 12, 0.36);
      circle(ctx, 0, 0, 220);
      ctx.fill();
      ctx.restore();
    }
    // black slab with swiss type (beat 0.75); the grid columns light up on 16ths
    s = slide(lt, 0.75, 400, 700, ok, 1, 0.8);
    if (s.a > 0) {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.translate(800 + s.x, 1480 + s.y + drift(3));
      ctx.rotate(0.1);
      ctx.scale(s.s, s.s);
      ctx.fillStyle = P.bg;
      ctx.fillRect(-320, -260, 640, 520);
      text(ctx, 'GRID', -290, -60, {size: 170, color: P.cream, align: 'left'});
      text(ctx, '12 COL / 24 PT / NO. 02', -286, 10, {size: 30, family: FONT.mono, color: P.orange, align: 'left'});
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = withA(i === Math.floor(lt / (FPB / 4)) % 12 ? P.orange : P.cream, i === Math.floor(lt / (FPB / 4)) % 12 ? 0.9 : 0.18);
        ctx.fillRect(-290 + i * 48, 40, 30, 180);
      }
      ctx.restore();
    }
    // stripes wipe in (beat 1)
    s = slide(lt, 1.0, -500, 400, ok, -1, 0.7);
    if (s.a > 0) {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.translate(190 + s.x, 1460 + s.y);
      ctx.rotate(-0.06);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? P.bg : P.orange;
        ctx.fillRect(-170, -150 + i * 34, 340 * clamp((lt - FPB - i * 2) / 10), 18);
      }
      ctx.restore();
    }
    // registration marks spin in + vertical type (beat 1.25)
    const rk = enter(lt, 1.25) * (1 - ok);
    if (rk > 0) {
      for (const [x, y] of [[90, 330], [990, 330], [90, 1790], [990, 1790]]) {
        ctx.save();
        ctx.globalAlpha = clamp(rk);
        ctx.translate(x, y);
        ctx.rotate((1 - rk) * 2);
        ctx.strokeStyle = P.bg;
        ctx.lineWidth = 3;
        circle(ctx, 0, 0, 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-36, 0);
        ctx.lineTo(36, 0);
        ctx.moveTo(0, -36);
        ctx.lineTo(0, 36);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = clamp(rk);
      ctx.translate(70, 1300);
      ctx.rotate(-Math.PI / 2);
      text(ctx, 'SWISS / 1957 / HELVETICA IS A FEELING', 0, 0, {size: 34, family: FONT.mono, weight: 700, color: P.bg, align: 'left'});
      ctx.restore();
    }
  },
  portal: (ctx) => ctx.beginPath(),
  front: (ctx, lt, t) => {
    const ok = outK(1, lt);
    if (ok <= 0) {
      const b = kickBump(t, 0.035);
      ctx.save();
      ctx.translate(W2P[0], W2P[1]);
      ctx.scale(b, b);
      ctx.translate(-W2P[0], -W2P[1]);
      drawD(ctx, D_OUTER, D_COUNTER, 1, P.bg);
      ringPath(ctx, D_OUTER, D_COUNTER);
      ctx.fillStyle = halftone(ctx, withA(P.cream, 0.08), 10, 0.3);
      ctx.fill('evenodd');
      ctx.restore();
      const tk = enter(lt, 1.5);
      if (tk > 0) {
        ctx.save();
        ctx.translate(W2P[0] + 250, W2P[1] - 300);
        ctx.rotate(0.5 + (1 - tk) * 0.6);
        ctx.scale(tk, tk);
        ctx.fillStyle = withA('#FFF8EC', 0.75);
        ctx.fillRect(-80, -24, 160, 48);
        ctx.restore();
      }
    } else {
      // the D closes into the pupil of the next world's eye
      const k = E.inOutCubic(ok);
      drawD(ctx, lerpPts(D_OUTER, PUPIL, k), lerpPts(D_COUNTER, PUPIL_HOLE, k), 1 - k, P.bg);
    }
  },
};

// ================================================================================================ W4 2D ANIMATION
const PAGE = {x: 120, y: 380, w: 840, h: 1240};
const ballAt = (k: number) => {
  const u = (((k % 24) + 24) % 24) / 24;
  const x = PAGE.x + 110 + u * (PAGE.w - 220);
  const ph = u * 3;
  const fr = ph - Math.floor(ph);
  const hgt = 640 * Math.pow(0.6, Math.floor(ph));
  const y = PAGE.y + PAGE.h - 282 - 4 * hgt * fr * (1 - fr);
  const contact = Math.min(fr, 1 - fr) < 0.06;
  const vy = 4 * hgt * (1 - 2 * fr);
  const sq = contact ? 0.62 : 1 + Math.min(0.35, Math.abs(vy) / 2200);
  return {x, y, sq, contact};
};
const drawBall = (ctx: Ctx, k: number, style: 'ink' | 'onion-prev' | 'onion-next', alpha: number) => {
  const b = ballAt(k);
  const r = 96;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(b.x, b.y + (b.contact ? r * (1 - b.sq) * 0.5 : 0));
  ctx.scale(1 / Math.sqrt(b.sq), b.sq);
  circle(ctx, 0, 0, r);
  if (style === 'ink') {
    ctx.fillStyle = P.orange;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = P.orangeDk;
    circle(ctx, 18, 22, r);
    ctx.fill();
    ctx.fillStyle = P.cream;
    circle(ctx, -22, -24, 14);
    ctx.fill();
    ctx.restore();
    circle(ctx, 0, 0, r);
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#120E0A';
    ctx.stroke();
  } else {
    ctx.fillStyle = withA(style === 'onion-prev' ? P.orange : P.neon, 0.18);
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = style === 'onion-prev' ? P.orange : P.neonDk;
    ctx.stroke();
  }
  ctx.restore();
};
const pageBallLayer = (ctx: Ctx, idx: number, withBall = true) => {
  ctx.fillStyle = '#F4EEE3';
  ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);
  ctx.fillStyle = '#0E0C0A';
  for (let i = 0; i < 3; i++) {
    circle(ctx, PAGE.x + PAGE.w / 2 - 120 + i * 120, PAGE.y + 46, i === 1 ? 18 : 12);
    ctx.fill();
  }
  ctx.save();
  ctx.strokeStyle = withA('#6E8FA0', 0.55);
  ctx.setLineDash([10, 12]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k <= 48; k++) {
    const b = ballAt(k / 2);
    if (k) ctx.lineTo(b.x, b.y);
    else ctx.moveTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#2A241E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(PAGE.x + 60, PAGE.y + PAGE.h - 186);
  ctx.lineTo(PAGE.x + PAGE.w - 60, PAGE.y + PAGE.h - 186);
  ctx.stroke();
  ctx.restore();
  for (let o = 3; o >= 1; o--) drawBall(ctx, idx - o, 'onion-prev', 0.55 - o * 0.13);
  for (let o = 2; o >= 1; o--) drawBall(ctx, idx + o, 'onion-next', 0.45 - o * 0.15);
  if (withBall) drawBall(ctx, idx, 'ink', 1);
  text(ctx, `FR ${String(((idx % 24) + 24) % 24 + 1).padStart(2, '0')}`, PAGE.x + PAGE.w - 50, PAGE.y + 110, {size: 40, family: FONT.mono, weight: 800, color: '#2A241E', align: 'right'});
  const tx = PAGE.x + 70;
  const ty = PAGE.y + 150;
  ctx.strokeStyle = '#2A241E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + 420, ty);
  for (let i = 0; i <= 12; i++) {
    const x = tx + Math.pow(i / 12, 1.6) * 420;
    ctx.moveTo(x, ty - (i % 4 === 0 ? 26 : 14));
    ctx.lineTo(x, ty);
  }
  ctx.stroke();
  text(ctx, 'EASE OUT  ·  ON 2s', tx, ty + 44, {size: 24, family: FONT.mono, weight: 700, color: '#2A241E', align: 'left'});
};
const clipHalf = (pts: number[][], q: number[], n: number[], keepNeg: boolean) => {
  const out: number[][] = [];
  const side = (p: number[]) => ((p[0] - q[0]) * n[0] + (p[1] - q[1]) * n[1]) * (keepNeg ? -1 : 1);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const k = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
};
const curlPage = (ctx: Ctx, c: number, drawPage: () => void) => {
  const rect = [[PAGE.x, PAGE.y], [PAGE.x + PAGE.w, PAGE.y], [PAGE.x + PAGE.w, PAGE.y + PAGE.h], [PAGE.x, PAGE.y + PAGE.h]];
  if (c <= 0) {
    drawPage();
    return;
  }
  const corner = [PAGE.x + PAGE.w, PAGE.y + PAGE.h];
  const far = [PAGE.x - 200, PAGE.y - 500];
  const d = Math.hypot(corner[0] - far[0], corner[1] - far[1]);
  const n = [(corner[0] - far[0]) / d, (corner[1] - far[1]) / d];
  const s = E.inOutCubic(c) * d;
  const q = [corner[0] - n[0] * s * 0.5, corner[1] - n[1] * s * 0.5];
  const keep = clipHalf(rect, q, n, true);
  const flap = clipHalf(rect, q, n, false).map((p) => {
    const dd = (p[0] - q[0]) * n[0] + (p[1] - q[1]) * n[1];
    return [p[0] - 2 * dd * n[0], p[1] - 2 * dd * n[1]];
  });
  if (keep.length > 2) {
    ctx.save();
    poly(ctx, keep);
    ctx.clip();
    drawPage();
    ctx.restore();
  }
  if (flap.length > 2) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 40;
    poly(ctx, flap);
    const g = ctx.createLinearGradient(q[0], q[1], q[0] - n[0] * 300, q[1] - n[1] * 300);
    g.addColorStop(0, '#CFC6B8');
    g.addColorStop(1, '#F7F2EA');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
};
const MOON: [number, number, number] = [300, 560, 150];
const nightSky = (ctx: Ctx, alpha = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, -400, 0, 1500);
  g.addColorStop(0, '#07071A');
  g.addColorStop(0.45, '#1C1236');
  g.addColorStop(0.75, '#4A2240');
  g.addColorStop(1, '#B85A45');
  ctx.fillStyle = g;
  ctx.fillRect(-4000, -4000, 9000, 9000);
  ctx.restore();
};
const W4: World = {
  id: 'anim2d',
  title: ['2D ANIMATION'],
  P: [540, 1040],
  bg: '#0E0C0A',
  back: (ctx, lt) => {
    const ok = outK(3, lt);
    fillBg(ctx, '#0E0C0A');
    glow(ctx, CX, 1000, 1100, '#FFB98F', 0.22);
    roundRect(ctx, PAGE.x - 50, PAGE.y - 60, PAGE.w + 100, PAGE.h + 120, 28);
    ctx.fillStyle = '#1A1612';
    ctx.fill();
    if (ok > 0) nightSky(ctx, E.inCubic(ok));
  },
  portal: (ctx) => ctx.beginPath(),
  front: (ctx, lt) => {
    const D = DUR(3);
    const ok = outK(3, lt);
    const idx = Math.floor(onTwos(Math.max(0, lt)) / 10);
    if (ok <= 0) {
      // flipbook: a page turns on every beat, the drawing keeps animating on 2s underneath
      const lb = lbOf(lt);
      const flipAt = Math.floor(lb);
      const c = lb >= 1 ? clamp((lb - flipAt) / 0.22) : 0;
      if (c > 0 && c < 1) {
        pageBallLayer(ctx, idx + 2);
        curlPage(ctx, c, () => pageBallLayer(ctx, idx));
      } else pageBallLayer(ctx, idx);
    } else {
      // the ball's last bounce launches it into the sky as the moon; the page drops away
      const i0 = Math.floor(onTwos(D - OUT) / 10);
      const k = E.inOutCubic(ok);
      ctx.save();
      ctx.translate(0, E.inCubic(ok) * 1600);
      ctx.translate(540, 1000);
      ctx.rotate(0.35 * E.inCubic(ok));
      ctx.translate(-540, -1000);
      pageBallLayer(ctx, i0, false);
      ctx.restore();
      const b0 = ballAt(i0);
      const x = lerp(b0.x, MOON[0], k);
      const y = lerp(b0.y, MOON[1], E.outCubic(ok)) - 220 * Math.sin(Math.PI * ok) * (1 - ok);
      const r = lerp(96, MOON[2], k);
      glow(ctx, x, y, r * 2.8, '#FFE6D2', 0.35 * k);
      ctx.fillStyle = mixHex(P.orange, '#F8EADB', k);
      circle(ctx, x, y, r);
      ctx.fill();
      ctx.save();
      circle(ctx, x, y, r);
      ctx.clip();
      ctx.fillStyle = withA(P.orangeDk, 1 - k);
      circle(ctx, x + r * 0.19, y + r * 0.23, r);
      ctx.fill();
      ctx.restore();
    }
    const xf = xfadeK(3, lt);
    if (xf > 0) {
      ctx.save();
      ctx.globalAlpha = xf;
      drawWorldAt(ctx, 4, 0);
      ctx.restore();
    }
  },
};

// ================================================================================================ W5 ANIME DESIGN
const W5P: [number, number] = [740, 1080];
const WIN = {x: W5P[0] - 86, y: W5P[1] - 150, w: 172, h: 300};
const skyline = (ctx: Ctx, seed: number, base: number, minH: number, maxH: number, color: string, winA: number, t: number, wmin = 70, wmax = 150) => {
  let x = -300;
  let i = 0;
  while (x < W + 300) {
    const w = rndr(seed, i, wmin, wmax);
    const h = rndr(seed, i + 500, minH, maxH);
    ctx.fillStyle = color;
    ctx.fillRect(x, base - h, w + 2, h + 2000);
    if (rnd(seed, i + 900) > 0.6) ctx.fillRect(x + w * 0.4, base - h - 40, 6, 40);
    for (let wy = base - h + 20; wy < base - 20; wy += 26) {
      for (let wx = x + 12; wx < x + w - 14; wx += 22) {
        const r = rnd(seed * 31 + i, Math.floor(wx * 7 + wy));
        const tw = rnd(seed + Math.floor(onTwos(t, 30) / 30), Math.floor(wx + wy * 3));
        if (r > 0.82 && tw > 0.08) {
          ctx.fillStyle = withA(r > 0.95 ? P.cream : P.orange, winA);
          ctx.fillRect(wx, wy, 9, 12);
        }
      }
    }
    x += w + rndr(seed, i + 77, 4, 30);
    i++;
  }
};
const rise = (lt: number, beat: number) => (1 - enter(lt, beat, 18, 1.4)) * 1100;
const W5: World = {
  id: 'anime',
  title: ['ANIME DESIGN'],
  P: W5P,
  bg: '#0B0B1E',
  back: (ctx, lt, t) => {
    nightSky(ctx);
    for (let i = 0; i < 90; i++) {
      const tw = 0.5 + 0.5 * Math.sin(lt * 0.08 + i * 1.7);
      ctx.fillStyle = withA(P.cream, (0.25 + 0.5 * rnd(3, i)) * (0.6 + 0.4 * tw));
      ctx.fillRect(rnd(1, i) * W, rnd(2, i) * 900 + 80, 2.5, 2.5);
    }
    // the moon (the ball that flew up), glowing harder on the low end
    glow(ctx, MOON[0], MOON[1], 420, '#FFE6D2', 0.3 + 0.15 * envAt('low', t));
    ctx.fillStyle = '#F8EADB';
    circle(ctx, MOON[0], MOON[1], MOON[2]);
    ctx.fill();
    ctx.fillStyle = withA('#D9C3AE', 0.6);
    circle(ctx, 250, 520, 30);
    ctx.fill();
    circle(ctx, 350, 610, 20);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = withA('#120C24', 0.8 * clamp(lt / 30));
      const y = 520 + i * 46;
      const x = -200 + ((lt * (0.9 + i * 0.3) + i * 300) % 1500);
      roundRect(ctx, x, y, 420 - i * 40, 16, 8);
      ctx.fill();
    }
    // the city rises on the beat, each layer drifting at its own depth (parallax)
    ctx.save();
    ctx.translate(-lt * 0.12, rise(lt, 0.25));
    skyline(ctx, 11, 1380, 180, 420, '#2A1C3E', 0.5, t, 60, 120);
    ctx.restore();
    ctx.save();
    ctx.translate(-lt * 0.25, rise(lt, 0.5));
    skyline(ctx, 22, 1480, 260, 620, '#170F28', 0.75, t, 90, 170);
    ctx.restore();
    const nb = rise(lt, 0.75);
    ctx.save();
    ctx.translate(0, nb);
    ctx.fillStyle = '#0A0814';
    ctx.fillRect(560, 640, 2000, 4000);
    ctx.fillStyle = '#0F0C1C';
    ctx.fillRect(560, 640, 30, 4000);
    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 610 + c * 130;
        const y = 700 + r * 250;
        if (Math.abs(x + 50 - W5P[0]) < 150 && Math.abs(y + 85 - W5P[1]) < 260) continue;
        const lit = rnd(55, r * 7 + c) > 0.55 && lt > 0.75 * FPB + (r + c) * 2;
        ctx.fillStyle = lit ? withA(P.orange, 0.85) : '#15112A';
        ctx.fillRect(x, y, 100, 170);
      }
    }
    glow(ctx, W5P[0], W5P[1], 340, P.orange, (0.5 + 0.3 * envAt('mid', t)) * clamp((lt - 0.75 * FPB) / 20));
    ctx.fillStyle = mixHex('#15112A', '#FFB98F', clamp((lt - 0.9 * FPB) / 12));
    ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.restore();
  },
  portal: (ctx) => ctx.beginPath(),
  front: (ctx, lt, t) => {
    const D = DUR(4);
    const ok = outK(4, lt);
    const nb = rise(lt, 0.75);
    ctx.save();
    ctx.translate(0, nb);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#05040A';
    ctx.strokeRect(WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.restore();
    // rooftop rises on beat 1, the character drops in on beat 1.25 and lands with dust
    const rb = rise(lt, 1.0);
    ctx.save();
    ctx.translate(0, rb);
    ctx.fillStyle = '#05040A';
    ctx.fillRect(-300, 1540, 920, 2000);
    ctx.fillRect(40, 1440, 90, 100);
    ctx.fillRect(70, 1360, 8, 80);
    ctx.restore();
    const land = 1.25 * FPB + 14;
    const fall = clamp((lt - 1.25 * FPB) / 14);
    if (fall > 0) {
      const dropY = (1 - E.inQuad(fall)) * -1500;
      const sq = lt > land ? 1 - 0.18 * Math.max(0, ring(lt - land, 6, 0.08)) : 1.1;
      const pose = standPose(Math.PI / 2 - 0.25);
      const path = figurePath(pose, {facing: 1, hair: 'long', ribbon: 'scarf', wind: 1.6, t: onTwos(t), boilSeed: boilSeed(t)});
      ctx.save();
      ctx.translate(330, 1215 + dropY + 320 * (1 - sq) * 0.5);
      ctx.scale(0.95 / Math.sqrt(sq), 0.95 * sq);
      drawFigure(ctx, path, {rim: P.neon, light: [-0.85, -0.5], lw: 5, rimW: 15});
      ctx.restore();
      if (lt > land && lt < land + 30) {
        const a = (lt - land) / 30;
        for (let i = 0; i < 14; i++) {
          const dir = i % 2 ? 1 : -1;
          ctx.fillStyle = withA(P.cream, 0.35 * (1 - a));
          circle(ctx, 330 + dir * (40 + a * 220 * rnd(201, i)), 1530 - a * 60 * rnd(202, i), 10 + 20 * a);
          ctx.fill();
        }
      }
    }
    if (lt > 1.5 * FPB) {
      const bs = boilSeed(t, 6);
      const sa = clamp((lt - 1.5 * FPB) / 20);
      ctx.save();
      for (let i = 0; i < 70; i++) {
        const a = rnd(bs * 13 + 1, i) * TAU;
        const r0 = 420 + rnd(bs * 13 + 2, i) * 600;
        const len = 300 + rnd(bs * 13 + 3, i) * 700;
        ctx.strokeStyle = withA(P.cream, (0.08 + 0.18 * rnd(bs, i)) * sa);
        ctx.lineWidth = 1 + 3 * rnd(bs + 9, i);
        ctx.beginPath();
        ctx.moveTo(W5P[0] + Math.cos(a) * r0, W5P[1] + Math.sin(a) * r0);
        ctx.lineTo(W5P[0] + Math.cos(a) * (r0 + len), W5P[1] + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
      ctx.strokeStyle = withA(P.cream, 0.12 * sa);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 120; i++) {
        const x = rnd(bs * 7 + 5, i) * (W + 400) - 200;
        const y = rnd(bs * 7 + 6, i) * H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 30, y + 90);
      }
      ctx.stroke();
      ctx.restore();
    }
    // the lit window opens over the whole frame: inside, the type is already slamming
    if (ok > 0) {
      const k = E.inExpo(ok) * 0.92 + ok * 0.08;
      const x0 = lerp(WIN.x, -60, k);
      const y0 = lerp(WIN.y, -60, k);
      const x1 = lerp(WIN.x + WIN.w, W + 60, k);
      const y1 = lerp(WIN.y + WIN.h, H + 60, k);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      drawWorldAt(ctx, 5, lt - D);
      ctx.restore();
      ctx.save();
      ctx.lineWidth = 14;
      ctx.strokeStyle = withA('#FFB98F', 1 - ok);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
  },
};

// ================================================================================================ W6 KINETIC TYPOGRAPHY
const W6P: [number, number] = [540, 1010];
const W7P: [number, number] = [540, 990];
const WORDS = [
  {w: 'WORDS', at: -0.5, c: P.cream},
  {w: 'THAT', at: 0.0, c: P.orange},
  {w: 'HIT', at: 0.25, c: P.neon},
  {w: 'LIKE', at: 0.5, c: P.cream},
  {w: 'KICKS', at: 0.75, c: P.orange},
];
const ZERO_AT = 1.0;
const ZERO_OUT: Pt[] = circlePts(0, 0, 1, D_N).map(([x, y]) => [W6P[0] + x * 265, W6P[1] + y * 420] as Pt);
const ZERO_IN: Pt[] = circlePts(0, 0, 1, D_N).map(([x, y]) => [W6P[0] + x * 100, W6P[1] + y * 176] as Pt);
const WHEEL_OUT: Pt[] = circlePts(W7P[0], W7P[1], 380, D_N);
const WHEEL_IN: Pt[] = circlePts(W7P[0], W7P[1], 150, D_N);
const hueWheel = (ctx: Ctx, rot: number) => {
  const g = ctx.createConicGradient(rot, W7P[0], W7P[1]);
  ['#FF4D4D', '#FFB13D', '#F6F05A', '#5BFF8A', '#38F2FF', '#4D6BFF', '#C34DFF', '#FF4D4D'].forEach((c, i, a) =>
    g.addColorStop(i / (a.length - 1), c),
  );
  return g;
};
const W6: World = {
  id: 'kinetic',
  title: ['KINETIC TYPOGRAPHY'],
  P: W6P,
  bg: '#0A090D',
  back: (ctx, lt) => {
    fillBg(ctx, '#0A090D');
    ctx.save();
    for (let r = 0; r < 7; r++) {
      const y = 560 + r * 160;
      const dir = r % 2 ? 1 : -1;
      const off = (((lt + 60) * 9 * dir + r * 210) % 1200) - 1200;
      const col = withA(r % 3 === 0 ? P.orange : P.cream, 0.1);
      for (let k = 0; k < 4; k++) text(ctx, 'TYPE THAT MOVES ', off + k * 1200, y, {size: 140, align: 'left', stroke: col, lineWidth: 2, strokeOnly: true});
    }
    ctx.restore();
    const lb = lbOf(lt);
    let cur = -1;
    WORDS.forEach((w, i) => {
      if (lb >= w.at) cur = i;
    });
    if (cur >= 0 && lb < ZERO_AT) {
      const w = WORDS[cur];
      const age = lt - w.at * FPB;
      const k = spring(age, 3.6, 0.42, 18);
      const size = Math.min(520, (980 / measure(ctx, w.w, 100)) * 100);
      const sc = 2.6 - 1.6 * k;
      const squash = 1 + 0.2 * ring(age, 5, 0.1);
      ctx.save();
      ctx.translate(W6P[0], W6P[1] + size * 0.35);
      ctx.scale(sc * squash, sc / squash);
      ctx.rotate(-0.06 * (cur % 2 ? 1 : -1) * (1 - k));
      if (cur === 2) text(ctx, w.w, 0, 0, {size, stroke: P.neon, lineWidth: 14, strokeOnly: true});
      else {
        text(ctx, w.w, 12, 12, {size, color: cur % 2 ? P.cream : P.orange});
        text(ctx, w.w, 0, 0, {size, color: w.c});
      }
      ctx.restore();
      if (cur > 0 && age < 12) {
        const pw = WORDS[cur - 1];
        const ps = Math.min(520, (980 / measure(ctx, pw.w, 100)) * 100);
        ctx.save();
        ctx.globalAlpha = 1 - age / 12;
        ctx.translate(W6P[0], W6P[1] + ps * 0.35 - E.outCubic(age / 12) * 900);
        text(ctx, pw.w, 0, 0, {size: ps, color: withA(pw.c, 0.6)});
        ctx.restore();
      }
    }
  },
  portal: (ctx) => ctx.beginPath(),
  front: (ctx, lt) => {
    const lb = lbOf(lt);
    if (lb < ZERO_AT) return;
    const ok = outK(5, lt);
    const age = lt - ZERO_AT * FPB;
    const pop = E.outBack(clamp(age / 10), 2);
    if (ok <= 0) {
      ctx.save();
      ctx.translate(W6P[0], W6P[1]);
      ctx.scale(pop, pop);
      ctx.translate(-W6P[0], -W6P[1]);
      ctx.save();
      ctx.translate(18, 14);
      ringPath(ctx, ZERO_OUT, ZERO_IN);
      ctx.fillStyle = P.neon;
      ctx.fill('evenodd');
      ctx.restore();
      ringPath(ctx, ZERO_OUT, ZERO_IN);
      ctx.fillStyle = P.orange;
      ctx.fill('evenodd');
      ctx.lineWidth = 8;
      ctx.strokeStyle = P.cream;
      ctx.stroke();
      ctx.restore();
    } else {
      // the zero spins open into the colour wheel
      const k = E.inOutCubic(ok);
      const outer = lerpPts(ZERO_OUT, WHEEL_OUT, k);
      const inner = lerpPts(ZERO_IN, WHEEL_IN, k);
      ringPath(ctx, outer, inner);
      ctx.fillStyle = P.orange;
      ctx.fill('evenodd');
      ctx.save();
      ctx.globalAlpha = k;
      ringPath(ctx, outer, inner);
      ctx.fillStyle = hueWheel(ctx, k * 3);
      ctx.fill('evenodd');
      ctx.restore();
      ctx.lineWidth = 8;
      ctx.strokeStyle = P.cream;
      ringPath(ctx, outer, inner);
      ctx.stroke();
    }
    const kb = spring(age, 3, 0.4, 20);
    const bugsA = 1 - E.inCubic(ok);
    if (bugsA > 0) {
      ctx.save();
      ctx.globalAlpha = bugsA;
      text(ctx, 'BUGS:', W6P[0], W6P[1] - 250 + (1 - kb) * -160 - 600 * E.inCubic(ok), {size: 132, color: P.cream, track: 6, stroke: '#08070B', lineWidth: 12});
      ctx.restore();
    }
    const xf = xfadeK(5, lt);
    if (xf > 0) {
      ctx.save();
      ctx.globalAlpha = xf;
      drawWorldAt(ctx, 6, 0);
      ctx.restore();
    }
  },
};

// ================================================================================================ W7 VFX + GRADING
const cone = (ctx: Ctx, k: number) => {
  // the speaker cone (head-on) that the wheel drains into
  ctx.save();
  ctx.globalAlpha = k;
  const g = ctx.createRadialGradient(W7P[0] - 60, W7P[1] - 60, 60, W7P[0], W7P[1], 380);
  g.addColorStop(0, '#3B3545');
  g.addColorStop(1, '#0D0B11');
  ctx.fillStyle = g;
  circle(ctx, W7P[0], W7P[1], 380);
  ctx.fill();
  ctx.fillStyle = '#16141B';
  circle(ctx, W7P[0], W7P[1], 150);
  ctx.fill();
  ctx.restore();
};
const W7: World = {
  id: 'vfx',
  title: ['VFX & COMPOSITING', '+ COLOR GRADING'],
  P: W7P,
  bg: '#08070B',
  back: (ctx, lt, t) => {
    const ok = outK(6, lt);
    const fade = 1 - E.inCubic(ok);
    fillBg(ctx, '#08070B');
    const env = envAt('full', t);
    // comp layer cards fly in on beat 1 and explode apart
    const ck = enter(lt, 1.0, 18) * fade;
    if (ck > 0) {
      const sep = E.outCubic(clamp((lt - FPB) / 40));
      ['BG PLATE', 'FX PASS', 'GRADE'].forEach((nm, i) => {
        ctx.save();
        ctx.globalAlpha = clamp(ck);
        ctx.translate(540 + (i - 1) * 120 * sep, 470 - i * 34 * sep - (1 - ck) * 400);
        ctx.transform(1, -0.12, 0.35, 0.7, 0, 0);
        roundRect(ctx, -260, -120, 520, 240, 18);
        ctx.fillStyle = withA([P.orange, P.neon, P.cream][i], 0.13);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = withA([P.orange, P.neon, P.cream][i], 0.7);
        ctx.stroke();
        text(ctx, nm, -230, -76, {size: 30, family: FONT.mono, weight: 800, color: [P.orange, P.neon, P.cream][i], align: 'left'});
        ctx.restore();
      });
    }
    // energy rays burst on beat 0.25
    const rk = enter(lt, 0.25, 14, 1.2) * fade;
    if (rk > 0) {
      ctx.save();
      ctx.translate(W7P[0], W7P[1]);
      const rot = lt * 0.006;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU + rot;
        const len = 380 + (320 + 500 * rnd(8, i) * (0.6 + env)) * rk;
        ctx.fillStyle = withA(i % 2 ? P.orange : P.neon, (0.16 + 0.1 * rnd(9, i)) * clamp(rk));
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.02) * 380, Math.sin(a - 0.02) * 380);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.lineTo(Math.cos(a + 0.02) * 380, Math.sin(a + 0.02) * 380);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    glow(ctx, W7P[0], W7P[1], 760, P.orange, (0.25 + 0.3 * env) * fade);
    // particles from beat 0.5
    if (lt > 0.5 * FPB) {
      for (let i = 0; i < 220; i++) {
        const sp = rndr(4, i, 2, 9);
        const a = rnd(5, i) * TAU;
        const life = (((lt - 0.5 * FPB) * sp + rnd(6, i) * 900) % 900) + 320;
        const x = W7P[0] + Math.cos(a) * life;
        const y = W7P[1] + Math.sin(a) * life;
        ctx.strokeStyle = withA(i % 3 ? P.orangeHi : P.neon, 0.7 * (1 - (life - 320) / 900) * fade);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(a) * sp * 6, y - Math.sin(a) * sp * 6);
        ctx.stroke();
      }
    }
    // lightning on 2s from beat 0.75
    if (lt > 0.75 * FPB && fade > 0) {
      const bs = boilSeed(t, 10);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.lineJoin = 'round';
      for (let b = 0; b < 4; b++) {
        let a = rnd(bs * 3 + b, 1) * TAU;
        let r = 390;
        ctx.beginPath();
        ctx.moveTo(W7P[0] + Math.cos(a) * r, W7P[1] + Math.sin(a) * r);
        for (let s = 0; s < 9; s++) {
          r += rndr(bs + b, s, 50, 110);
          a += rndr(bs + b, s + 30, -0.18, 0.18);
          ctx.lineTo(W7P[0] + Math.cos(a) * r, W7P[1] + Math.sin(a) * r);
        }
        ctx.lineWidth = 10;
        ctx.strokeStyle = withA(P.neon, 0.35);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = P.cream;
        ctx.stroke();
      }
      ctx.restore();
    }
    // colour wheel: the grade snaps to a new hue on every beat
    const beatRot = Math.floor(lt / FPB) * 0.9 + E.outExpo(clamp((lt % FPB) / 10)) * 0.9;
    ctx.fillStyle = hueWheel(ctx, 3 + beatRot + lt * 0.004);
    circle(ctx, W7P[0], W7P[1], 380);
    ctx.fill();
    const sg = ctx.createRadialGradient(W7P[0], W7P[1], 140, W7P[0], W7P[1], 380);
    sg.addColorStop(0, `rgba(255,255,255,${0.95 * clamp(lt / 20)})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    circle(ctx, W7P[0], W7P[1], 380);
    ctx.fill();
    ctx.fillStyle = '#08070B';
    circle(ctx, W7P[0], W7P[1], 150);
    ctx.fill();
    // lift / gamma / gain on beat 1.5
    const gk = enter(lt, 1.5) * fade;
    if (gk > 0) {
      [0, 1, 2].forEach((i) => {
        const x = 230 + i * 310;
        const y = 1560 + (1 - gk) * 400;
        ctx.save();
        ctx.globalAlpha = clamp(gk);
        const gg = ctx.createConicGradient(0, x, y);
        ['#FF4D4D', '#F6F05A', '#5BFF8A', '#38F2FF', '#4D6BFF', '#FF4D4D'].forEach((c, k2, a) => gg.addColorStop(k2 / (a.length - 1), c));
        ctx.fillStyle = gg;
        circle(ctx, x, y, 90);
        ctx.fill();
        const sg2 = ctx.createRadialGradient(x, y, 0, x, y, 90);
        sg2.addColorStop(0, 'rgba(20,18,24,0.95)');
        sg2.addColorStop(1, 'rgba(20,18,24,0.1)');
        ctx.fillStyle = sg2;
        circle(ctx, x, y, 90);
        ctx.fill();
        const pa = lt * 0.03 + i * 2;
        ctx.fillStyle = P.cream;
        circle(ctx, x + Math.cos(pa) * 40 * (0.5 + 0.5 * Math.sin(lt * 0.02 + i)), y + Math.sin(pa) * 40, 11);
        ctx.fill();
        ctx.restore();
      });
    }
  },
  portal: (ctx) => ctx.beginPath(),
  front: (ctx, lt) => {
    const ok = outK(6, lt);
    const fade = 1 - E.inCubic(ok);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineWidth = 10;
    ctx.strokeStyle = P.cream;
    circle(ctx, W7P[0], W7P[1], 150);
    ctx.stroke();
    ctx.lineWidth = 4;
    circle(ctx, W7P[0], W7P[1], 380);
    ctx.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU + lt * 0.003;
      ctx.beginPath();
      ctx.moveTo(W7P[0] + Math.cos(a) * 380, W7P[1] + Math.sin(a) * 380);
      ctx.lineTo(W7P[0] + Math.cos(a) * (i % 3 ? 398 : 416), W7P[1] + Math.sin(a) * (i % 3 ? 398 : 416));
      ctx.stroke();
    }
    const pa = lt * 0.025;
    ctx.fillStyle = P.bg;
    ctx.lineWidth = 6;
    circle(ctx, W7P[0] + Math.cos(pa) * 270, W7P[1] + Math.sin(pa) * 270, 24);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // the wheel drains into the speaker cone
    if (ok > 0) cone(ctx, E.inOutCubic(ok));
    const xf = xfadeK(6, lt);
    if (xf > 0) {
      ctx.save();
      ctx.globalAlpha = xf;
      drawWorldAt(ctx, 7, 0);
      ctx.restore();
    }
  },
};

// ================================================================================================ assembly
const W3 = makeEyeWorld((ctx) => drawWorldAt(ctx, 3, 0));
const W8 = makeSpeakerWorld((ctx, t) => drawBulletHome(ctx, t));

export const WORLDS: World[] = [W1, W2, W3, W4, W5, W6, W7, W8];

/** draw world j standalone at its local time lt (used to settle each transformation onto the next first frame) */
export function drawWorldAt(ctx: Ctx, j: number, lt: number) {
  const w = WORLDS[j];
  const t = TL.portals[j] + lt;
  ctx.save();
  w.back(ctx, lt, t);
  w.front?.(ctx, lt, t);
  ctx.restore();
}
