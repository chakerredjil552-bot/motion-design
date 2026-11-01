// The eight one-take worlds. Each is drawn in its own "home" coordinates (1080x1920) and exposes a portal
// path whose interior shows the next world. Portals always contain the next world's home frame scaled by 1/Z
// (135x240 for Z = 8) once the camera dives in, so the nested zoom is seamless.
import {CX, CY, E, ENV, FPB, H, P, TAU, W, clamp, envAt, invLerp, last, lerp, noise1, onTwos, boilSeed, ring, rnd, rndr, spring, BEATS} from '../lib/core';
import {Ctx, FONT, circle, fillBg, glow, halftone, measure, mixHex, poly, roundRect, text, withA} from '../lib/draw';
import {POSE_PUNCH, drawFigure, figurePath, standPose} from '../lib/figure';

export const Z = 8;
export type World = {
  id: string;
  title: string[];
  P: [number, number];
  bg: string;
  titleInk?: string;
  back: (ctx: Ctx, lt: number, t: number) => void;
  portal: (ctx: Ctx, lt: number, t: number) => void; // builds the clip path (beginPath ... ) in home coords
  front?: (ctx: Ctx, lt: number, t: number) => void;
};

const lbOf = (lt: number) => lt / FPB; // local beats

// ================================================================================================ W1 MOTION DESIGN
const W1P: [number, number] = [540, 930];
const shapeR = (kind: number, th: number, R: number) => {
  switch (kind) {
    case 0: {
      // square
      const a = ((th % (TAU / 4)) + TAU / 4) % (TAU / 4) - TAU / 8;
      return (R * 0.82) / Math.cos(a);
    }
    case 1: {
      // triangle
      const a = (((th + Math.PI / 2) % (TAU / 3)) + TAU / 3) % (TAU / 3) - Math.PI / 3;
      return (R * 0.58) / Math.cos(a);
    }
    case 2: {
      // 5-point star (piecewise linear in polar approx)
      const seg = TAU / 10;
      const a = (((th + Math.PI / 2) % seg) + seg) % seg;
      const k = Math.floor(((((th + Math.PI / 2) % TAU) + TAU) % TAU) / seg) % 2;
      const r0 = k === 0 ? R : R * 0.48;
      const r1 = k === 0 ? R * 0.48 : R;
      return lerp(r0, r1, a / seg);
    }
    default:
      return 150; // circle portal (contains the 135x240 frame)
  }
};
const morphState = (lt: number) => {
  // square until the drop, then triangle -> star -> circle (the portal), each step springs with overshoot
  const lb = lbOf(lt);
  const T = [0.0, 0.22, 0.44];
  let from = 0;
  let to = 0;
  let k = 1;
  for (let i = 0; i < T.length; i++) {
    if (lb >= T[i]) {
      from = i;
      to = i + 1;
      k = E.outBack(clamp((lb - T[i]) / 0.16), 2.0);
    }
  }
  const rot = lb * 0.9 + (to * Math.PI) / 5;
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
const W1: World = {
  id: 'motion',
  title: ['MOTION DESIGN'],
  P: W1P,
  bg: '#0B0A10',
  back: (ctx, lt, t) => {
    fillBg(ctx, '#0B0A10');
    // artboard dot grid
    ctx.fillStyle = withA(P.cream, 0.07);
    for (let y = 100; y < H; y += 60) for (let x = 30; x < W; x += 60) ctx.fillRect(x, y, 3, 3);
    glow(ctx, W1P[0], W1P[1], 700, P.orange, 0.22 + 0.15 * envAt('low', t));
    // graph-editor ease curve with handles, dot riding it
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
    ctx.strokeStyle = withA(P.orange, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    ctx.lineTo(gx0 + 420, gy0);
    ctx.moveTo(gx1, gy1);
    ctx.lineTo(gx1 - 300, gy1);
    ctx.stroke();
    for (const [x, y] of [[gx0 + 420, gy0], [gx1 - 300, gy1]]) {
      ctx.fillStyle = P.orange;
      circle(ctx, x, y, 9);
      ctx.fill();
    }
    const u = (((lt / 60) % 1) + 1) % 1;
    const e = E.inOutCubic(u);
    const bx = lerp(gx0, gx1, u);
    const by = lerp(gy0, gy1, e);
    ctx.fillStyle = P.cream;
    circle(ctx, bx, by, 12);
    ctx.fill();
    ctx.restore();
    // orbiters behind
    orbiters(ctx, lt, false);
  },
  portal: (ctx, lt) => shapePath(ctx, lt),
  front: (ctx, lt) => {
    // echo trails
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      shapePath(ctx, lt - i * 5);
      ctx.lineWidth = 4;
      ctx.strokeStyle = withA(i % 2 ? P.neon : P.orange, 0.35 / i);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    shapePath(ctx, lt);
    ctx.lineWidth = 16;
    ctx.strokeStyle = P.orange;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = P.cream;
    ctx.stroke();
    ctx.restore();
    orbiters(ctx, lt, true);
    // keyframe diamonds
    const lb = lbOf(lt);
    for (let i = 0; i < 8; i++) {
      const x = 220 + i * 92;
      const on = lb * 8 > i - 2;
      ctx.save();
      ctx.translate(x, 1480);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = on ? P.orange : withA(P.cream, 0.25);
      ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();
    }
  },
};
function orbiters(ctx: Ctx, lt: number, front: boolean) {
  for (let i = 0; i < 7; i++) {
    const sp = 0.035 + i * 0.006;
    const a = lt * sp + i * 0.9;
    const z = Math.sin(a);
    if (front !== z > 0) continue;
    const rx = 280 + i * 30;
    const ry = 120 + i * 18;
    const x = W1P[0] + Math.cos(a) * rx;
    const y = W1P[1] + Math.sin(a) * ry + (i - 3) * 40;
    const vx = -Math.sin(a) * rx * sp;
    const vy = Math.cos(a) * ry * sp;
    const v = Math.hypot(vx, vy);
    const stretch = 1 + v * 0.05;
    const s = (18 + i * 4) * (0.8 + 0.3 * z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.scale(stretch, 1 / stretch);
    ctx.fillStyle = [P.orange, P.neon, P.cream][i % 3];
    if (i % 3 === 0) {
      circle(ctx, 0, 0, s);
      ctx.fill();
    } else if (i % 3 === 1) {
      ctx.fillRect(-s, -s, s * 2, s * 2);
    } else {
      poly(ctx, [[s, 0], [-s, -s], [-s, s]]);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ================================================================================================ W2 GRAPHIC DESIGN
const W2P: [number, number] = [560, 1010];
const Dpath = (ctx: Ctx, counterOnly = false) => {
  const [px, py] = W2P;
  const sx = px - 175;
  const ix = px - 88;
  if (!counterOnly) {
    ctx.moveTo(sx, py - 290);
    ctx.lineTo(px + 10, py - 290);
    ctx.bezierCurveTo(px + 400, py - 290, px + 400, py + 290, px + 10, py + 290);
    ctx.lineTo(sx, py + 290);
    ctx.closePath();
  }
  ctx.moveTo(ix, py - 190);
  ctx.lineTo(px + 10, py - 190);
  ctx.bezierCurveTo(px + 240, py - 190, px + 240, py + 190, px + 10, py + 190);
  ctx.lineTo(ix, py + 190);
  ctx.closePath();
};
const slideIn = (lt: number, start: number, dx: number, dy: number) => {
  const k = E.outBack(clamp((onTwos(lt) - start) / 16), 1.8);
  return [dx * (1 - k), dy * (1 - k), clamp((lt - start) / 4)];
};
const W2: World = {
  id: 'graphic',
  title: ['GRAPHIC DESIGN'],
  P: W2P,
  bg: P.cream,
  titleInk: P.bg,
  back: (ctx, lt) => {
    fillBg(ctx, P.cream);
    // paper fibres
    ctx.fillStyle = withA('#B9AE9F', 0.25);
    for (let i = 0; i < 160; i++) ctx.fillRect(rnd(5, i) * W, rnd(6, i) * H, rndr(7, i, 8, 40), 1.5);
    const drift = (k: number) => Math.sin(lt * 0.02 + k) * 6;
    // orange block with halftone
    let [dx, dy] = slideIn(lt, -60, -500, 0);
    ctx.save();
    ctx.translate(260 + dx, 560 + dy + drift(1));
    ctx.rotate(-0.14);
    ctx.fillStyle = P.orange;
    ctx.fillRect(-250, -340, 500, 680);
    ctx.fillStyle = halftone(ctx, withA(P.orangeDk, 0.7), 16, 0.32);
    ctx.fillRect(-250, -340, 500, 680);
    text(ctx, 'BOLD.', -230, 300, {size: 190, color: P.bg, align: 'left'});
    ctx.restore();
    // cyan disc
    [dx, dy] = slideIn(lt, -50, 400, -300);
    ctx.save();
    ctx.translate(860 + dx, 520 + dy + drift(2));
    ctx.fillStyle = P.neon;
    circle(ctx, 0, 0, 220);
    ctx.fill();
    ctx.fillStyle = halftone(ctx, withA('#06606B', 0.55), 12, 0.36);
    circle(ctx, 0, 0, 220);
    ctx.fill();
    ctx.restore();
    // black slab with swiss type
    [dx, dy] = slideIn(lt, -40, 300, 500);
    ctx.save();
    ctx.translate(800 + dx, 1480 + dy + drift(3));
    ctx.rotate(0.1);
    ctx.fillStyle = P.bg;
    ctx.fillRect(-320, -260, 640, 520);
    text(ctx, 'GRID', -290, -60, {size: 170, color: P.cream, align: 'left'});
    text(ctx, '12 COL / 24 PT / NO. 02', -286, 10, {size: 30, family: FONT.mono, color: P.orange, align: 'left'});
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = withA(P.cream, 0.18);
      ctx.fillRect(-290 + i * 48, 40, 30, 180);
    }
    ctx.restore();
    // stripes
    [dx, dy] = slideIn(lt, -30, -400, 300);
    ctx.save();
    ctx.translate(190 + dx, 1460 + dy);
    ctx.rotate(-0.06);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? P.bg : P.orange;
      ctx.fillRect(-170, -150 + i * 34, 340, 18);
    }
    ctx.restore();
    // registration marks
    for (const [x, y] of [[90, 330], [990, 330], [90, 1790], [990, 1790]]) {
      ctx.save();
      ctx.strokeStyle = P.bg;
      ctx.lineWidth = 3;
      circle(ctx, x, y, 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 36, y);
      ctx.lineTo(x + 36, y);
      ctx.moveTo(x, y - 36);
      ctx.lineTo(x, y + 36);
      ctx.stroke();
      ctx.restore();
    }
    // vertical type
    ctx.save();
    ctx.translate(70, 1300);
    ctx.rotate(-Math.PI / 2);
    text(ctx, 'SWISS / 1957 / HELVETICA IS A FEELING', 0, 0, {size: 34, family: FONT.mono, weight: 700, color: P.bg, align: 'left'});
    ctx.restore();
  },
  portal: (ctx) => {
    ctx.beginPath();
    Dpath(ctx, true);
  },
  front: (ctx, lt) => {
    const k = E.outBack(clamp((onTwos(lt) + 70) / 18), 2.2);
    ctx.save();
    ctx.translate(W2P[0], W2P[1]);
    ctx.scale(k, k);
    ctx.translate(-W2P[0], -W2P[1]);
    // misregistered print: orange plate offset, then black plate
    ctx.save();
    ctx.translate(14, 10);
    ctx.beginPath();
    Dpath(ctx);
    ctx.fillStyle = P.orange;
    ctx.fill('evenodd');
    ctx.restore();
    ctx.beginPath();
    Dpath(ctx);
    ctx.fillStyle = P.bg;
    ctx.fill('evenodd');
    ctx.fillStyle = halftone(ctx, withA(P.cream, 0.08), 10, 0.3);
    ctx.fill('evenodd');
    ctx.restore();
    // tape over the corner
    ctx.save();
    ctx.translate(W2P[0] + 250, W2P[1] - 300);
    ctx.rotate(0.5);
    ctx.fillStyle = withA('#FFF8EC', 0.75);
    ctx.fillRect(-80, -24, 160, 48);
    ctx.restore();
  },
};

// ================================================================================================ W3 CHARACTER DESIGN
const W3P: [number, number] = [610, 1110];
const W3: World = {
  id: 'character',
  title: ['CHARACTER DESIGN'],
  P: W3P,
  bg: '#0C0F17',
  back: (ctx, lt, t) => {
    fillBg(ctx, '#0C0F17');
    // model-sheet grid
    ctx.strokeStyle = withA(P.neon, 0.07);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 54) {
      ctx.moveTo(x, -200);
      ctx.lineTo(x, H + 200);
    }
    for (let y = 0; y <= H; y += 54) {
      ctx.moveTo(-200, y);
      ctx.lineTo(W + 200, y);
    }
    ctx.stroke();
    // turnaround lineup
    const names = ['FRONT', '3/4', 'SIDE', 'BACK'];
    const bs = boilSeed(t);
    names.forEach((nm, i) => {
      const x = 170 + i * 247;
      const pop = E.outBack(clamp((onTwos(lt) + 60 - i * 10) / 14), 2.4);
      if (pop <= 0) return;
      const yaw = [0, Math.PI / 4, Math.PI / 2, Math.PI][i];
      const pose = standPose(yaw);
      const path = figurePath(pose, {facing: 1, hair: 'spike', t: onTwos(t), boilSeed: bs + i, wind: 0.4, ribbon: i === 3 ? undefined : 'scarf'});
      ctx.save();
      ctx.translate(x, 590);
      ctx.scale(0.36 * pop, 0.36 * pop);
      drawFigure(ctx, path, {rim: i % 2 ? P.neon : P.orange, light: [-0.7, -0.7], lw: 6, rimW: 16});
      ctx.restore();
      text(ctx, nm, x, 690, {size: 24, family: FONT.mono, weight: 700, color: withA(P.cream, 0.7)});
      ctx.strokeStyle = withA(P.neon, 0.25);
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(x - 110, 457);
      ctx.lineTo(x + 110, 457);
      ctx.moveTo(x - 110, 710);
      ctx.lineTo(x + 110, 710);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    drawFace(ctx, lt, t, false);
  },
  portal: (ctx, lt) => {
    ctx.beginPath();
    ctx.arc(W3P[0], W3P[1], 146 + 4 * Math.sin(lt * 0.05), 0, TAU);
  },
  front: (ctx, lt, t) => drawFace(ctx, lt, t, true),
};
const FACE_S = 1.42;
function drawFace(ctx: Ctx, lt: number, t: number, front: boolean) {
  ctx.save();
  ctx.translate(W3P[0], W3P[1]);
  ctx.scale(FACE_S, FACE_S);
  ctx.translate(-W3P[0], -W3P[1]);
  drawFaceInner(ctx, lt, t, front);
  ctx.restore();
}
function drawFaceInner(ctx: Ctx, lt: number, t: number, front: boolean) {
  const [px, py] = W3P;
  const bs = boilSeed(t, 10);
  const j = (i: number, a = 2.5) => noise1(i * 1.7 + bs * 2.3, 31) * a;
  const LINE = '#06070B';
  const draw = (k: number) => clamp((lt + 90 - k * 8) / 16); // staged "draw on"
  if (!front) {
    // construction lines (blue pencil)
    ctx.save();
    ctx.strokeStyle = withA(P.neon, 0.32);
    ctx.lineWidth = 3;
    const cl = draw(0);
    ctx.setLineDash([2400 * cl, 4000]);
    circle(ctx, px - 60, py + 40, 470);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - 600, py);
    ctx.lineTo(px + 600, py - 40);
    ctx.moveTo(px - 140, py - 560);
    ctx.lineTo(px - 40, py + 640);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // face (cream, cel shade)
    const fa = draw(1);
    ctx.save();
    ctx.globalAlpha = fa;
    ctx.beginPath();
    ctx.moveTo(px - 520 + j(1), py - 180);
    ctx.bezierCurveTo(px - 540, py + 300, px - 280, py + 640 + j(2), px - 20, py + 700);
    ctx.bezierCurveTo(px + 200, py + 640, px + 470 + j(3), py + 380, px + 520, py + 40);
    ctx.lineTo(px + 520, py - 400);
    ctx.lineTo(px - 520, py - 420);
    ctx.closePath();
    ctx.fillStyle = P.cream;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = withA(P.orange, 0.32);
    ctx.beginPath();
    ctx.moveTo(px + 160, py + 260);
    ctx.bezierCurveTo(px + 300, py + 300, px + 400, py + 200, px + 560, py + 60);
    ctx.lineTo(px + 600, py + 800);
    ctx.lineTo(px + 60, py + 800);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 9;
    ctx.strokeStyle = LINE;
    ctx.stroke();
    // nose + mouth
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - 210 + j(4), py + 250);
    ctx.lineTo(px - 238, py + 310);
    ctx.lineTo(px - 200, py + 318);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(px - 300, py + 470);
    ctx.quadraticCurveTo(px - 200, py + 500 + j(5, 4), px - 90, py + 450);
    ctx.stroke();
    // eye white + iris
    ctx.beginPath();
    ctx.moveTo(px - 230, py - 60);
    ctx.bezierCurveTo(px - 140, py - 230, px + 220, py - 240, px + 300, py - 40);
    ctx.bezierCurveTo(px + 230, py + 170, px - 120, py + 190, px - 230, py - 60);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const ig = ctx.createRadialGradient(px, py - 40, 40, px, py, 210);
    ig.addColorStop(0, P.neon);
    ig.addColorStop(0.6, P.neonDk);
    ig.addColorStop(1, '#052A33');
    ctx.fillStyle = ig;
    circle(ctx, px, py, 205);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = P.orange;
    circle(ctx, px, py, 160);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // brow
    ctx.save();
    ctx.globalAlpha = fa;
    ctx.fillStyle = mixHex(P.orange, P.orangeDk, 0.4);
    ctx.beginPath();
    ctx.moveTo(px - 280, py - 290);
    ctx.quadraticCurveTo(px + 20, py - 400, px + 330, py - 300);
    ctx.lineTo(px + 320, py - 270);
    ctx.quadraticCurveTo(px + 20, py - 350, px - 270, py - 255);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // hair mass
    const ha = draw(2);
    ctx.save();
    ctx.globalAlpha = ha;
    const spikes = 11;
    ctx.beginPath();
    ctx.moveTo(-200, py - 260);
    for (let i = 0; i <= spikes; i++) {
      const x = -120 + (i / spikes) * 1320;
      const tipY = py - 700 - 160 * Math.sin(i * 1.7) + noise1(onTwos(t) * 0.03 + i, 41) * 30;
      const baseY = py - 380 + 60 * Math.sin(i * 2.3);
      ctx.lineTo(x - 50, baseY);
      ctx.lineTo(x + 30 + j(i + 10, 6), tipY);
    }
    ctx.lineTo(1300, py - 200);
    ctx.lineTo(1300, -400);
    ctx.lineTo(-200, -400);
    ctx.closePath();
    ctx.fillStyle = P.orange;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = P.orangeDk;
    ctx.beginPath();
    ctx.moveTo(-200, py - 500);
    ctx.bezierCurveTo(300, py - 380, 700, py - 640, 1300, py - 420);
    ctx.lineTo(1300, py - 200);
    ctx.lineTo(-200, py - 200);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.neon;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let i = 0; i <= spikes; i++) {
      const x = -120 + (i / spikes) * 1320;
      const tipY = py - 700 - 160 * Math.sin(i * 1.7) + noise1(onTwos(t) * 0.03 + i, 41) * 30;
      ctx.moveTo(x + 30 + j(i + 10, 6) - 6, tipY + 14);
      ctx.lineTo(x - 30, tipY + 140);
    }
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 9;
    ctx.strokeStyle = LINE;
    ctx.stroke();
    ctx.restore();
  } else {
    const fa = draw(1);
    ctx.save();
    ctx.globalAlpha = fa;
    // pupil rim
    ctx.lineWidth = 10;
    ctx.strokeStyle = LINE;
    circle(ctx, px, py, (146 + 4 * Math.sin(lt * 0.05)) / FACE_S);
    ctx.stroke();
    // lids + lashes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(px - 260, py - 40);
    ctx.bezierCurveTo(px - 150, py - 260, px + 230, py - 270, px + 330, py - 50);
    ctx.lineTo(px + 380, py - 90);
    ctx.lineTo(px + 300, py - 10);
    ctx.bezierCurveTo(px + 220, py - 220, px - 140, py - 210, px - 230, py - 30);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(px - 180, py + 110);
    ctx.bezierCurveTo(px - 60, py + 190, px + 160, py + 180, px + 260, py + 60);
    ctx.stroke();
    // highlights (fade out before the camera dives through the pupil)
    const hl = 1 - clamp((lt - 50) / 25);
    if (hl > 0) {
      ctx.globalAlpha = fa * hl;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(px + 70, py - 90, 46, 32, -0.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px - 80, py + 70, 18, 12, -0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ================================================================================================ W4 2D ANIMATION
const W4P: [number, number] = [540, 1040];
const PAGE = {x: 120, y: 380, w: 840, h: 1240};
const ballAt = (k: number) => {
  // drawing k of a 3-bounce ball across the page (12 fps drawings)
  const u = (((k % 24) + 24) % 24) / 24;
  const x = PAGE.x + 110 + u * (PAGE.w - 220);
  const bounces = 3;
  const ph = u * bounces;
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
const pageBallLayer = (ctx: Ctx, idx: number, seed: number) => {
  // paper
  ctx.fillStyle = '#F4EEE3';
  ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);
  ctx.fillStyle = '#0E0C0A';
  for (let i = 0; i < 3; i++) {
    circle(ctx, PAGE.x + PAGE.w / 2 - 120 + i * 120, PAGE.y + 46, i === 1 ? 18 : 12);
    ctx.fill();
  }
  // arc guide (pencil)
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
  // ground
  ctx.strokeStyle = '#2A241E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(PAGE.x + 60, PAGE.y + PAGE.h - 186);
  ctx.lineTo(PAGE.x + PAGE.w - 60, PAGE.y + PAGE.h - 186);
  ctx.stroke();
  ctx.restore();
  for (let o = 3; o >= 1; o--) drawBall(ctx, idx - o, 'onion-prev', 0.55 - o * 0.13);
  for (let o = 2; o >= 1; o--) drawBall(ctx, idx + o, 'onion-next', 0.45 - o * 0.15);
  drawBall(ctx, idx, 'ink', 1);
  text(ctx, `FR ${String(((idx % 24) + 24) % 24 + 1).padStart(2, '0')}`, PAGE.x + PAGE.w - 50, PAGE.y + 110, {size: 40, family: FONT.mono, weight: 800, color: '#2A241E', align: 'right'});
  // timing chart
  const tx = PAGE.x + 70;
  const ty = PAGE.y + PAGE.h - 90;
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
  void seed;
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
/** page with a curl: c=0 flat, c=1 fully turned away. drawPage draws the page content in page coords. */
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
const W4: World = {
  id: 'anim2d',
  title: ['2D ANIMATION'],
  P: W4P,
  bg: '#0E0C0A',
  back: (ctx, lt) => {
    fillBg(ctx, '#0E0C0A');
    glow(ctx, CX, 1000, 1100, '#FFB98F', 0.22);
    // light table frame
    roundRect(ctx, PAGE.x - 50, PAGE.y - 60, PAGE.w + 100, PAGE.h + 120, 28);
    ctx.fillStyle = '#1A1612';
    ctx.fill();
    // portal page (bottom of the stack): paper with a pencil panel
    ctx.fillStyle = '#F4EEE3';
    ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);
    void lt;
  },
  portal: (ctx) => {
    ctx.beginPath();
    ctx.rect(W4P[0] - 130, W4P[1] - 210, 260, 420);
  },
  front: (ctx, lt, t) => {
    // sketchy panel border around the portal
    ctx.save();
    ctx.strokeStyle = '#1C1814';
    ctx.lineWidth = 6;
    const bs = boilSeed(t);
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      const pts = [[-130, -210], [130, -210], [130, 210], [-130, 210]];
      pts.forEach((p, i) => {
        const x = W4P[0] + p[0] + noise1(i * 3 + bs + pass * 7, 51) * 5;
        const y = W4P[1] + p[1] + noise1(i * 5 + bs + pass * 9, 53) * 5;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    text(ctx, 'NEXT SCENE →', W4P[0] - 130, W4P[1] - 232, {size: 30, family: FONT.mono, weight: 700, color: '#1C1814', align: 'left'});
    ctx.restore();
    // flipbook stack on top: flips at local beats -0.25, 0.1, 0.35, final at 0.55
    const flips = [-0.5, -0.2, 0.1, 0.32, 0.52];
    const lb = lbOf(lt);
    let top = 0;
    for (let i = 0; i < flips.length; i++) if (lb > flips[i] + 0.16) top = i + 1;
    const drawIdx = Math.floor(onTwos(t) / 10);
    if (top < flips.length) {
      const c = clamp((lb - flips[top]) / 0.16);
      // page under the flipping one (if it's still a drawing page)
      if (top + 1 < flips.length) pageBallLayer(ctx, drawIdx + 3, top + 1);
      curlPage(ctx, c, () => pageBallLayer(ctx, drawIdx, top));
    }
  },
};

// ================================================================================================ W5 ANIME DESIGN
const W5P: [number, number] = [740, 1080];
const skyline = (ctx: Ctx, seed: number, base: number, minH: number, maxH: number, color: string, winA: number, t: number, wmin = 70, wmax = 150) => {
  let x = -300;
  let i = 0;
  while (x < W + 300) {
    const w = rndr(seed, i, wmin, wmax);
    const h = rndr(seed, i + 500, minH, maxH);
    ctx.fillStyle = color;
    ctx.fillRect(x, base - h, w + 2, h + 2000);
    if (rnd(seed, i + 900) > 0.6) ctx.fillRect(x + w * 0.4, base - h - 40, 6, 40);
    // windows
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
const W5: World = {
  id: 'anime',
  title: ['ANIME DESIGN'],
  P: W5P,
  bg: '#0B0B1E',
  back: (ctx, lt, t) => {
    const g = ctx.createLinearGradient(0, -400, 0, 1500);
    g.addColorStop(0, '#07071A');
    g.addColorStop(0.45, '#1C1236');
    g.addColorStop(0.75, '#4A2240');
    g.addColorStop(1, '#B85A45');
    ctx.fillStyle = g;
    ctx.fillRect(-4000, -4000, 9000, 9000);
    // stars
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = withA(P.cream, 0.3 + 0.5 * rnd(3, i));
      ctx.fillRect(rnd(1, i) * W, rnd(2, i) * 900 + 80, 2.5, 2.5);
    }
    // moon
    glow(ctx, 300, 560, 420, '#FFE6D2', 0.35);
    ctx.fillStyle = '#F8EADB';
    circle(ctx, 300, 560, 150);
    ctx.fill();
    ctx.fillStyle = withA('#D9C3AE', 0.6);
    circle(ctx, 250, 520, 30);
    ctx.fill();
    circle(ctx, 350, 610, 20);
    ctx.fill();
    // cloud streaks across the moon (parallax drift)
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = withA('#120C24', 0.8);
      const y = 520 + i * 46;
      const x = -200 + ((lt * (0.6 + i * 0.2) + i * 300) % 1500);
      roundRect(ctx, x, y, 420 - i * 40, 16, 8);
      ctx.fill();
    }
    skyline(ctx, 11, 1380, 180, 420, '#2A1C3E', 0.5, t, 60, 120);
    skyline(ctx, 22, 1480, 260, 620, '#170F28', 0.75, t, 90, 170);
    // near building with the portal window
    ctx.fillStyle = '#0A0814';
    ctx.fillRect(560, 640, 2000, 4000);
    ctx.fillStyle = '#0F0C1C';
    ctx.fillRect(560, 640, 30, 4000);
    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 610 + c * 130 + (c >= 1 ? 0 : 0);
        const y = 700 + r * 250;
        if (Math.abs(x + 50 - W5P[0]) < 150 && Math.abs(y + 85 - W5P[1]) < 260) continue;
        const lit = rnd(55, r * 7 + c) > 0.55;
        ctx.fillStyle = lit ? withA(P.orange, 0.85) : '#15112A';
        ctx.fillRect(x, y, 100, 170);
      }
    }
    // the lit window frame glow
    glow(ctx, W5P[0], W5P[1], 340, P.orange, 0.5 + 0.3 * envAt('mid', t));
  },
  portal: (ctx) => {
    ctx.beginPath();
    ctx.rect(W5P[0] - 86, W5P[1] - 150, 172, 300);
  },
  front: (ctx, lt, t) => {
    // window frame + mullion
    ctx.save();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#05040A';
    ctx.strokeRect(W5P[0] - 86, W5P[1] - 150, 172, 300);
    ctx.restore();
    // rooftop + character on the left (rim light from the moon)
    ctx.fillStyle = '#05040A';
    ctx.fillRect(-300, 1540, 920, 2000);
    ctx.fillRect(40, 1440, 90, 100);
    ctx.fillRect(70, 1360, 8, 80);
    const pose = standPose(Math.PI / 2 - 0.25);
    const path = figurePath(pose, {facing: 1, hair: 'long', ribbon: 'scarf', wind: 1.6, t: onTwos(t), boilSeed: boilSeed(t)});
    ctx.save();
    ctx.translate(330, 1215);
    ctx.scale(0.95, 0.95);
    drawFigure(ctx, path, {rim: P.neon, light: [-0.85, -0.5], lw: 5, rimW: 15});
    ctx.restore();
    // speed lines converging on the window
    const bs = boilSeed(t, 6);
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const a = rnd(bs * 13 + 1, i) * TAU;
      const r0 = 420 + rnd(bs * 13 + 2, i) * 600;
      const len = 300 + rnd(bs * 13 + 3, i) * 700;
      ctx.strokeStyle = withA(P.cream, 0.08 + 0.18 * rnd(bs, i));
      ctx.lineWidth = 1 + 3 * rnd(bs + 9, i);
      ctx.beginPath();
      ctx.moveTo(W5P[0] + Math.cos(a) * r0, W5P[1] + Math.sin(a) * r0);
      ctx.lineTo(W5P[0] + Math.cos(a) * (r0 + len), W5P[1] + Math.sin(a) * (r0 + len));
      ctx.stroke();
    }
    // rain
    ctx.strokeStyle = withA(P.cream, 0.12);
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
    void lt;
  },
};

// ================================================================================================ W6 KINETIC TYPOGRAPHY
const W6P: [number, number] = [540, 1010];
const WORDS = [
  {w: 'WORDS', at: -1.5, c: P.cream},
  {w: 'THAT', at: -1.0, c: P.orange},
  {w: 'HIT', at: -0.5, c: P.neon},
  {w: 'LIKE', at: 0.0, c: P.cream},
  {w: 'KICKS', at: 0.2, c: P.orange},
];
const zeroPath = (ctx: Ctx, counter = false) => {
  const [px, py] = W6P;
  if (!counter) ctx.ellipse(px, py, 265, 420, 0, 0, TAU);
  ctx.moveTo(px + 100, py);
  ctx.ellipse(px, py, 100, 176, 0, 0, TAU);
};
const W6: World = {
  id: 'kinetic',
  title: ['KINETIC TYPOGRAPHY'],
  P: W6P,
  bg: '#0A090D',
  back: (ctx, lt, t) => {
    fillBg(ctx, '#0A090D');
    // marquee rows of outlined type
    ctx.save();
    for (let r = 0; r < 9; r++) {
      const y = 300 + r * 180;
      const dir = r % 2 ? 1 : -1;
      const off = ((lt * 6 * dir + r * 210) % 1200) - 1200;
      ctx.font = `400 150px "${FONT.display}"`;
      ctx.lineWidth = 2;
      ctx.strokeStyle = withA(r % 3 === 0 ? P.orange : P.cream, 0.1);
      for (let k = 0; k < 4; k++) ctx.strokeText('TYPE THAT MOVES ', off + k * 1200, y);
    }
    ctx.restore();
    const lb = lbOf(lt);
    // word slams (each replaces the last, stacked depth)
    let cur = -1;
    WORDS.forEach((w, i) => {
      if (lb >= w.at) cur = i;
    });
    const zeroAt = 0.4;
    if (cur >= 0 && lb < zeroAt) {
      const w = WORDS[cur];
      const age = lt - w.at * FPB;
      const k = spring(age, 3.6, 0.42, 22);
      const size = Math.min(520, (980 / measure(ctx, w.w, 100)) * 100);
      const sc = 2.4 - 1.4 * k;
      const squash = 1 + 0.18 * ring(age, 5, 0.1);
      ctx.save();
      ctx.translate(W6P[0], W6P[1] + size * 0.35);
      ctx.scale(sc * squash, sc / squash);
      ctx.rotate(-0.05 * (cur % 2 ? 1 : -1) * (1 - k));
      if (cur === 2) {
        ctx.font = `400 ${size}px "${FONT.display}"`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 14;
        ctx.strokeStyle = P.neon;
        ctx.strokeText(w.w, 0, 0);
      } else {
        text(ctx, w.w, 10, 10, {size, color: cur % 2 ? P.cream : P.orange});
        text(ctx, w.w, 0, 0, {size, color: w.c});
      }
      ctx.restore();
      // previous word ghost shoots up
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
    void t;
  },
  portal: (ctx, lt) => {
    ctx.beginPath();
    if (lbOf(lt) < 0.4) return;
    const k = E.outBack(clamp((lt - 0.4 * FPB) / 12), 2);
    ctx.save();
    ctx.translate(W6P[0], W6P[1]);
    ctx.scale(k, k);
    ctx.translate(-W6P[0], -W6P[1]);
    zeroPath(ctx, true);
    ctx.restore();
  },
  front: (ctx, lt) => {
    const lb = lbOf(lt);
    if (lb < 0.4) return;
    const age = lt - 0.4 * FPB;
    const k = E.outBack(clamp(age / 12), 2);
    ctx.save();
    ctx.translate(W6P[0], W6P[1]);
    ctx.scale(k, k);
    ctx.translate(-W6P[0], -W6P[1]);
    ctx.save();
    ctx.translate(18, 14);
    ctx.beginPath();
    zeroPath(ctx);
    ctx.fillStyle = P.neon;
    ctx.fill('evenodd');
    ctx.restore();
    ctx.beginPath();
    zeroPath(ctx);
    ctx.fillStyle = P.orange;
    ctx.fill('evenodd');
    ctx.lineWidth = 8;
    ctx.strokeStyle = P.cream;
    ctx.stroke();
    ctx.restore();
    const kb = spring(age, 3, 0.4, 24);
    text(ctx, 'BUGS:', W6P[0], W6P[1] - 470 + (1 - kb) * -200, {size: 150, color: P.cream, track: 6});
  },
};

// ================================================================================================ W7 VFX + GRADING
const W7P: [number, number] = [540, 990];
const W7: World = {
  id: 'vfx',
  title: ['VFX & COMPOSITING', '+ COLOR GRADING'],
  P: W7P,
  bg: '#08070B',
  back: (ctx, lt, t) => {
    fillBg(ctx, '#08070B');
    const env = envAt('full', t);
    // comp layer cards (exploded)
    const sep = E.outCubic(clamp((lt + 60) / 50));
    ['BG PLATE', 'FX PASS', 'GRADE'].forEach((nm, i) => {
      ctx.save();
      ctx.translate(540 + (i - 1) * 120 * sep, 470 - i * 34 * sep);
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
    // energy rays
    ctx.save();
    ctx.translate(W7P[0], W7P[1]);
    const rot = lt * 0.006;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU + rot;
      const len = 700 + 500 * rnd(8, i) * (0.6 + env);
      ctx.fillStyle = withA(i % 2 ? P.orange : P.neon, 0.16 + 0.1 * rnd(9, i));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.02) * 380, Math.sin(a - 0.02) * 380);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + 0.02) * 380, Math.sin(a + 0.02) * 380);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    glow(ctx, W7P[0], W7P[1], 760, P.orange, 0.35 + 0.3 * env);
    // particles bursting out
    for (let i = 0; i < 220; i++) {
      const sp = rndr(4, i, 2, 9);
      const a = rnd(5, i) * TAU;
      const life = ((lt * sp + rnd(6, i) * 900) % 900) + 320;
      const x = W7P[0] + Math.cos(a) * life;
      const y = W7P[1] + Math.sin(a) * life;
      ctx.strokeStyle = withA(i % 3 ? P.orangeHi : P.neon, 0.7 * (1 - (life - 320) / 900));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a) * sp * 6, y - Math.sin(a) * sp * 6);
      ctx.stroke();
    }
    // lightning on 2s
    const bs = boilSeed(t, 10);
    ctx.save();
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
    // colour wheel
    const wr = 380;
    const g = ctx.createConicGradient(lt * 0.01, W7P[0], W7P[1]);
    ['#FF4D4D', '#FFB13D', '#F6F05A', '#5BFF8A', '#38F2FF', '#4D6BFF', '#C34DFF', '#FF4D4D'].forEach((c, i, a) =>
      g.addColorStop(i / (a.length - 1), c),
    );
    ctx.fillStyle = g;
    circle(ctx, W7P[0], W7P[1], wr);
    ctx.fill();
    const sg = ctx.createRadialGradient(W7P[0], W7P[1], 140, W7P[0], W7P[1], wr);
    sg.addColorStop(0, 'rgba(255,255,255,0.95)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    circle(ctx, W7P[0], W7P[1], wr);
    ctx.fill();
    // lift / gamma / gain
    ['LIFT', 'GAMMA', 'GAIN'].forEach((nm, i) => {
      const x = 230 + i * 310;
      const y = 1560;
      ctx.save();
      const gg = ctx.createConicGradient(0, x, y);
      ['#FF4D4D', '#F6F05A', '#5BFF8A', '#38F2FF', '#4D6BFF', '#FF4D4D'].forEach((c, k, a) => gg.addColorStop(k / (a.length - 1), c));
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = gg;
      circle(ctx, x, y, 90);
      ctx.fill();
      ctx.globalAlpha = 1;
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
      text(ctx, nm, x, y + 140, {size: 26, family: FONT.mono, weight: 800, color: withA(P.cream, 0.8)});
      ctx.restore();
    });
  },
  portal: (ctx) => {
    ctx.beginPath();
    ctx.arc(W7P[0], W7P[1], 150, 0, TAU);
  },
  front: (ctx, lt) => {
    ctx.save();
    ctx.lineWidth = 10;
    ctx.strokeStyle = P.cream;
    circle(ctx, W7P[0], W7P[1], 150);
    ctx.stroke();
    ctx.lineWidth = 4;
    circle(ctx, W7P[0], W7P[1], 380);
    ctx.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      ctx.beginPath();
      ctx.moveTo(W7P[0] + Math.cos(a) * 380, W7P[1] + Math.sin(a) * 380);
      ctx.lineTo(W7P[0] + Math.cos(a) * (i % 3 ? 398 : 416), W7P[1] + Math.sin(a) * (i % 3 ? 398 : 416));
      ctx.stroke();
    }
    // grading puck orbiting the wheel
    const pa = lt * 0.025;
    ctx.fillStyle = P.bg;
    ctx.lineWidth = 6;
    circle(ctx, W7P[0] + Math.cos(pa) * 270, W7P[1] + Math.sin(pa) * 270, 24);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
};

// ================================================================================================ W8 SOUND + BEAT EDIT
const W8P: [number, number] = [540, 1070];
const pumpOf = (lt: number, t: number) => {
  const k = last('kick', t);
  const fade = 1 - clamp((lt - 90) / 30);
  return 1 + 0.07 * clamp(k.s * 1.3) * Math.max(0, ring(k.age, 6, 0.06)) * fade;
};
const W8: World = {
  id: 'sound',
  title: ['SOUND DESIGN', '+ BEAT-SYNCED EDITING'],
  P: W8P,
  bg: '#0A090D',
  back: (ctx, lt, t) => {
    fillBg(ctx, '#0A090D');
    // NLE timeline (scrolls so the playhead stays centred)
    const pxPerFrame = 3.2;
    const x0 = CX - t * pxPerFrame;
    const top = 330;
    roundRect(ctx, 30, top, W - 60, 420, 18);
    ctx.fillStyle = '#121017';
    ctx.fill();
    ctx.save();
    roundRect(ctx, 30, top, W - 60, 420, 18);
    ctx.clip();
    // ruler + beat ticks
    for (let b = 0; b < 60; b++) {
      const x = x0 + b * FPB * pxPerFrame;
      if (x < -50 || x > W + 50) continue;
      ctx.fillStyle = withA(P.cream, b % 4 === 0 ? 0.7 : 0.3);
      ctx.fillRect(x, top + 10, 2, b % 4 === 0 ? 30 : 16);
      if (b % 4 === 0) text(ctx, `${b / 4 + 1}`, x + 6, top + 36, {size: 22, family: FONT.mono, weight: 700, color: withA(P.cream, 0.6), align: 'left'});
    }
    // kick markers from beats.json
    for (const e of BEATS.events.kick) {
      const x = x0 + e.f * pxPerFrame;
      if (x < -20 || x > W + 20) continue;
      ctx.fillStyle = P.orange;
      poly(ctx, [[x - 8, top + 50], [x + 8, top + 50], [x, top + 64]]);
      ctx.fill();
    }
    // tracks
    const tracks = ['V2', 'V1', 'A1', 'A2'];
    tracks.forEach((nm, i) => {
      const y = top + 80 + i * 82;
      ctx.fillStyle = withA(P.cream, 0.05);
      ctx.fillRect(30, y, W - 60, 70);
      if (i < 2) {
        // clips cut on the beat
        for (let b = 0; b < 30; b++) {
          const len = (i === 0 ? 2 : 1) * FPB;
          const x = x0 + b * len * pxPerFrame;
          if (x > W + 50 || x + len * pxPerFrame < -50) continue;
          roundRect(ctx, x + 3, y + 6, len * pxPerFrame - 6, 58, 8);
          ctx.fillStyle = withA(i === 0 ? P.neon : P.orange, 0.75 - 0.2 * (b % 2));
          ctx.fill();
        }
      } else {
        // real waveform from the envelope
        ctx.fillStyle = withA(i === 2 ? P.orange : P.neon, 0.85);
        for (let x = 30; x < W - 30; x += 4) {
          const fr = Math.floor((x - x0) / pxPerFrame);
          const v = fr >= 0 && fr < ENV.full.length ? ENV[i === 2 ? 'low' : 'high'][fr] : 0;
          const hh = 4 + 30 * v;
          ctx.fillRect(x, y + 35 - hh, 3, hh * 2);
        }
      }
      text(ctx, nm, 44, y + 44, {size: 22, family: FONT.mono, weight: 800, color: withA(P.cream, 0.6), align: 'left'});
    });
    ctx.restore();
    // playhead
    ctx.fillStyle = P.orange;
    ctx.fillRect(CX - 2, top - 10, 4, 440);
    poly(ctx, [[CX - 14, top - 18], [CX + 14, top - 18], [CX, top - 2]]);
    ctx.fill();
    // speaker
    const pump = pumpOf(lt, t);
    ctx.save();
    roundRect(ctx, W8P[0] - 430, W8P[1] - 430, 860, 860, 50);
    ctx.fillStyle = '#121017';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = withA(P.cream, 0.12);
    ctx.stroke();
    for (const [sx, sy] of [[-380, -380], [380, -380], [-380, 380], [380, 380]]) {
      ctx.fillStyle = '#2A2632';
      circle(ctx, W8P[0] + sx, W8P[1] + sy, 16);
      ctx.fill();
    }
    ctx.translate(W8P[0], W8P[1]);
    ctx.scale(pump, pump);
    // surround
    const sg = ctx.createRadialGradient(0, 0, 330, 0, 0, 400);
    sg.addColorStop(0, '#2B2733');
    sg.addColorStop(0.5, '#4A4454');
    sg.addColorStop(1, '#1A1720');
    ctx.fillStyle = sg;
    circle(ctx, 0, 0, 400);
    ctx.fill();
    // cone
    const cg = ctx.createRadialGradient(-60, -60, 40, 0, 0, 340);
    cg.addColorStop(0, '#3B3545');
    cg.addColorStop(1, '#0D0B11');
    ctx.fillStyle = cg;
    circle(ctx, 0, 0, 335);
    ctx.fill();
    ctx.strokeStyle = withA(P.cream, 0.08);
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 170, Math.sin(a) * 170);
      ctx.lineTo(Math.cos(a) * 330, Math.sin(a) * 330);
      ctx.stroke();
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = withA(P.orange, 0.5 + 0.5 * (pump - 1) / 0.07);
    circle(ctx, 0, 0, 345);
    ctx.stroke();
    ctx.restore();
    // EQ bars at the bottom
    for (let i = 0; i < 24; i++) {
      const band = i < 8 ? 'low' : i < 16 ? 'mid' : 'high';
      const v = envAt(band as 'low', t - i * 1.5) * (0.6 + 0.4 * rnd(77, i));
      const h = 20 + 160 * v;
      ctx.fillStyle = i % 2 ? P.orange : P.neon;
      ctx.fillRect(80 + i * 38, 1680 - h, 26, h);
    }
  },
  portal: (ctx, lt, t) => {
    ctx.beginPath();
    ctx.arc(W8P[0], W8P[1], 156 * pumpOf(lt, t), 0, TAU);
  },
  front: (ctx, lt, t) => {
    const pump = pumpOf(lt, t);
    ctx.save();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#2E2936';
    circle(ctx, W8P[0], W8P[1], 156 * pump + 6);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = withA(P.cream, 0.4);
    circle(ctx, W8P[0], W8P[1], 156 * pump);
    ctx.stroke();
    ctx.restore();
  },
};

export const WORLDS: World[] = [W1, W2, W3, W4, W5, W6, W7, W8];
void H;
void CY;
void invLerp;
void POSE_PUNCH;
