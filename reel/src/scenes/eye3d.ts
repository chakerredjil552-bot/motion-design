// W3 CHARACTER DESIGN — a 3D anime eyeball. It opens out of the D's black (the pupil) on cream (the sclera),
// pulls back to an anime eye framed by lash lines, darts on the beat with the pupil pumping on kicks, sheds its
// lids and spins free inside a rotating construction sphere, then shrinks and drops as the 2D animation ball.
import {CX, E, FPB, H, P, TAU, TL, W, clamp, envAt, last, lerp, noise1, ring, rnd, rndr, onTwos, boilSeed} from '../lib/core';
import {Ctx, FONT, circle, glow, text, withA} from '../lib/draw';
import type {World} from './worlds';

const EC: [number, number] = [540, 940];
const R = 330; // eyeball radius
const OUT = 44;
type V3 = [number, number, number];

const lb = (lt: number) => lt / FPB;
const dur = () => TL.portals[3] - TL.portals[2];

/** gaze yaw/pitch: saccades snap on every beat, a full 3D spin on beat 2 -> 3 */
const gazeAt = (lt: number) => {
  const keys: [number, number][] = [
    [0, 0],
    [-0.42, 0.06],
    [0.36, -0.2],
    [0, 0],
    [0.12, 0.08],
  ];
  const b = Math.max(0, lb(lt));
  const k = Math.min(keys.length - 1, Math.floor(b));
  const prev = keys[Math.max(0, k - 1)];
  const cur = keys[k];
  const snap = E.outExpo(clamp((lt - k * FPB) / 8));
  let yaw = lerp(prev[0], cur[0], k === 0 ? 1 : snap);
  let pitch = lerp(prev[1], cur[1], k === 0 ? 1 : snap);
  // micro tremor
  yaw += 0.012 * noise1(lt * 0.21, 301);
  pitch += 0.012 * noise1(lt * 0.19, 303);
  // the free spin
  const sp = clamp((b - 2.0) / 0.95);
  if (sp > 0 && sp < 1) {
    yaw += TAU * E.inOutCubic(sp);
    pitch += 0.35 * Math.sin(sp * Math.PI);
  }
  // outro: the iris rolls up out of view as the eye turns into the ball
  const ok = clamp((lt - (dur() - OUT)) / OUT);
  if (ok > 0) pitch -= 2.1 * E.inCubic(ok);
  return {yaw, pitch};
};

const gazeVec = (yaw: number, pitch: number): V3 => [
  Math.sin(yaw) * Math.cos(pitch),
  Math.sin(pitch),
  Math.cos(yaw) * Math.cos(pitch),
];

const pupilAlpha = (lt: number, t: number) => {
  const k = last('kick', t);
  const pump = clamp(k.s * 1.3) * Math.max(0, ring(k.age, 6, 0.05));
  const down = Math.max(0, ring(lt - Math.round(lt / (4 * FPB)) * 4 * FPB, 10, 0.03));
  return 0.17 + 0.05 * pump + 0.02 * Math.sin(lt * 0.05) + 0.02 * down;
};

// ------------------------------------------------------------------------------------------ pieces
const background = (ctx: Ctx, lt: number, t: number) => {
  const g = ctx.createRadialGradient(EC[0], EC[1], 100, EC[0], EC[1], 1500);
  g.addColorStop(0, '#16233A');
  g.addColorStop(0.5, '#0B1222');
  g.addColorStop(1, '#05070D');
  ctx.fillStyle = g;
  ctx.fillRect(-2000, -2000, W + 4000, H + 4000);
  // bokeh drifting
  for (let i = 0; i < 26; i++) {
    const x = ((rnd(311, i) * W + lt * rndr(312, i, -0.4, 0.4)) % (W + 200)) - 100;
    const y = rnd(313, i) * H;
    glow(ctx, x, y, rndr(314, i, 30, 110), i % 3 ? P.neon : P.orange, 0.1 + 0.08 * envAt('high', t));
  }
};

/** rotating construction sphere (wireframe) behind/in front of the eyeball */
const wire = (ctx: Ctx, lt: number, front: boolean, alpha: number) => {
  if (alpha <= 0) return;
  const rr = R * 1.32;
  const rot = lt * 0.012 + (lb(lt) > 2 && lb(lt) < 3 ? E.inOutCubic(clamp(lb(lt) - 2)) * TAU * 0.5 : 0);
  const tilt = 0.42;
  ctx.save();
  ctx.lineWidth = 2;
  // meridians
  for (let m = 0; m < 10; m++) {
    const th = (m / 10) * Math.PI + rot;
    const rx = rr * Math.abs(Math.cos(th));
    const isFront = Math.sin(th) > 0;
    ctx.strokeStyle = withA(P.neon, alpha * (isFront ? 0.34 : 0.12));
    ctx.beginPath();
    ctx.ellipse(EC[0], EC[1], Math.max(0.5, rx), rr, 0, front ? -Math.PI / 2 : Math.PI / 2, front ? Math.PI / 2 : (3 * Math.PI) / 2);
    if (isFront === front) ctx.stroke();
  }
  // parallels (tilted circles)
  for (let p = -2; p <= 2; p++) {
    const lat = (p / 3) * (Math.PI / 2);
    const cy = EC[1] + rr * Math.sin(lat) * Math.cos(tilt);
    const r = rr * Math.cos(lat);
    ctx.strokeStyle = withA(p === 0 ? P.orange : P.neon, alpha * (front ? 0.36 : 0.14));
    ctx.beginPath();
    ctx.ellipse(EC[0], cy, r, Math.max(0.5, r * Math.sin(tilt)), 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.stroke();
  }
  // orbiting construction nodes
  for (let i = 0; i < 6; i++) {
    const a = rot * 2 + (i / 6) * TAU;
    const z = Math.sin(a);
    if (z > 0 !== front) continue;
    const x = EC[0] + Math.cos(a) * rr * 1.08;
    const y = EC[1] + Math.sin(a) * rr * 0.38 + (i - 3) * 14;
    ctx.fillStyle = withA(i % 2 ? P.orange : P.cream, alpha * (0.5 + 0.5 * z));
    circle(ctx, x, y, 7 + 4 * z);
    ctx.fill();
  }
  ctx.restore();
};

/** the eyeball: shaded sclera, refractive anime iris, cornea highlights. clipPath optional (lid aperture) */
const eyeball = (ctx: Ctx, lt: number, t: number, ballMix: number) => {
  const {yaw, pitch} = gazeAt(lt);
  const g = gazeVec(yaw, pitch);
  const [cx0, cy0] = EC;
  // sclera
  ctx.save();
  circle(ctx, cx0, cy0, R);
  ctx.clip();
  const sg = ctx.createRadialGradient(cx0 - R * 0.35, cy0 - R * 0.4, R * 0.1, cx0, cy0, R * 1.02);
  sg.addColorStop(0, '#FFFDF8');
  sg.addColorStop(0.38, P.cream);
  sg.addColorStop(0.78, '#D9CCBE');
  sg.addColorStop(1, '#8E8077');
  ctx.fillStyle = sg;
  ctx.fillRect(cx0 - R, cy0 - R, R * 2, R * 2);
  // capillaries (subtle, they rotate with the eye)
  ctx.strokeStyle = withA('#C0583C', 0.16 * (1 - ballMix));
  ctx.lineWidth = 2;
  for (let v = 0; v < 9; v++) {
    const a0 = (v / 9) * TAU + yaw * 0.9;
    ctx.beginPath();
    let x = cx0 + Math.cos(a0) * R * 0.98;
    let y = cy0 + Math.sin(a0) * R * 0.98;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      const a = a0 + Math.PI + noise1(v * 7 + s, 321) * 0.5;
      x += Math.cos(a) * 26;
      y += Math.sin(a) * 26;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // iris on the sphere (orthographic projection of a circle of angular radius alpha around g)
  if (g[2] > 0.0) {
    const fade = clamp(g[2] / 0.18);
    const bloom = E.outExpo(clamp(lt / 36));
    const ap = pupilAlpha(lt, t);
    const ai = lerp(ap, 0.62, bloom);
    const rho = R * Math.sin(ai);
    const rhoP = R * Math.sin(ap);
    const cx = cx0 + R * Math.cos(ai) * g[0];
    const cy = cy0 + R * Math.cos(ai) * g[1];
    const cpx = cx0 + R * Math.cos(ap) * g[0];
    const cpy = cy0 + R * Math.cos(ap) * g[1];
    const phi = Math.atan2(g[1], g[0]);
    const sq = Math.max(0.02, g[2]);
    ctx.save();
    ctx.globalAlpha = fade;
    // iris disc in its own frame (x along the gaze projection is foreshortened by g.z)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(phi);
    ctx.scale(sq, 1);
    const ig = ctx.createRadialGradient(0, 0, rhoP * 0.6, 0, 0, rho);
    ig.addColorStop(0, '#9CFBFF');
    ig.addColorStop(0.42, '#2CC4D2');
    ig.addColorStop(0.78, '#0B5D6E');
    ig.addColorStop(0.93, '#07303C');
    ig.addColorStop(1, '#03141B');
    ctx.fillStyle = ig;
    circle(ctx, 0, 0, rho);
    ctx.fill();
    // fibres (swirl slowly, boil on 2s)
    const bs = boilSeed(t, 10);
    for (let i = 0; i < 110; i++) {
      const a = (i / 110) * TAU + lt * 0.004;
      const w0 = rhoP * (1.05 + 0.1 * rnd(331 + bs, i));
      const w1 = rho * (0.86 + 0.12 * rnd(332, i));
      const bend = 0.18 * noise1(i * 0.7 + lt * 0.01, 333);
      ctx.strokeStyle =
        i % 9 === 0 ? withA(P.orange, 0.5) : i % 2 ? withA('#D9FFFF', 0.22) : withA('#03323D', 0.32);
      ctx.lineWidth = i % 9 === 0 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * w0, Math.sin(a) * w0);
      ctx.quadraticCurveTo(
        Math.cos(a + bend) * (w0 + w1) * 0.5,
        Math.sin(a + bend) * (w0 + w1) * 0.5,
        Math.cos(a + bend * 0.5) * w1,
        Math.sin(a + bend * 0.5) * w1,
      );
      ctx.stroke();
    }
    // collarette zig-zag (Claude orange) and brand ring
    ctx.strokeStyle = withA(P.orange, 0.85);
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU + lt * 0.01;
      const r = rhoP * (1.55 + (i % 2 ? 0.12 : -0.05));
      if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = rho * 0.07;
    ctx.strokeStyle = '#020C10';
    circle(ctx, 0, 0, rho - rho * 0.035);
    ctx.stroke();
    ctx.restore();
    // pupil (on its own plane, slightly deeper)
    ctx.save();
    ctx.translate(cpx, cpy);
    ctx.rotate(phi);
    ctx.scale(sq, 1);
    const pg = ctx.createRadialGradient(0, 0, rhoP * 0.7, 0, 0, rhoP * 1.15);
    pg.addColorStop(0, '#000000');
    pg.addColorStop(0.85, '#020608');
    pg.addColorStop(1, 'rgba(2,6,8,0)');
    ctx.fillStyle = pg;
    circle(ctx, 0, 0, rhoP * 1.15);
    ctx.fill();
    ctx.restore();
    // light pooling in the lower iris (anime): screen-space crescent clipped to the iris ellipse
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rho * sq, rho, phi, 0, TAU);
    ctx.clip();
    const lg = ctx.createRadialGradient(cx, cy + rho * 0.75, rho * 0.1, cx, cy + rho * 0.6, rho * 0.85);
    lg.addColorStop(0, 'rgba(180,255,255,0.75)');
    lg.addColorStop(1, 'rgba(180,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(cx - rho, cy - rho, rho * 2, rho * 2);
    ctx.restore();
    // cornea highlights: fixed to the light (top-left), riding on the cornea
    const hl = 1 - ballMix;
    if (hl > 0) {
      ctx.save();
      ctx.globalAlpha = fade * hl;
      ctx.fillStyle = '#FFFFFF';
      ctx.translate(cx - rho * 0.38 * sq - rho * 0.1, cy - rho * 0.42);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.roundRect(-rho * 0.26, -rho * 0.15, rho * 0.52, rho * 0.3, rho * 0.12);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = fade * hl * 0.9;
      ctx.fillStyle = '#FFFFFF';
      circle(ctx, cx + rho * 0.36 * sq, cy + rho * 0.34, rho * 0.075);
      ctx.fill();
      // beat glint: 4-point star
      const kb = last('kick', t);
      const gl = Math.max(0, ring(kb.age, 9, 0.04)) * clamp(kb.s * 1.4);
      if (gl > 0.05) {
        const sx = cx - rho * 0.55;
        const sy = cy - rho * 0.62;
        const sz = rho * 0.5 * gl;
        ctx.globalAlpha = hl * gl;
        ctx.beginPath();
        ctx.moveTo(sx, sy - sz);
        ctx.lineTo(sx + sz * 0.12, sy - sz * 0.12);
        ctx.lineTo(sx + sz, sy);
        ctx.lineTo(sx + sz * 0.12, sy + sz * 0.12);
        ctx.lineTo(sx, sy + sz);
        ctx.lineTo(sx - sz * 0.12, sy + sz * 0.12);
        ctx.lineTo(sx - sz, sy);
        ctx.lineTo(sx - sz * 0.12, sy - sz * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  // window reflection on the sclera + cyan rim + ambient occlusion at the limb
  ctx.save();
  ctx.globalAlpha = 0.28 * (1 - ballMix);
  ctx.fillStyle = '#FFFFFF';
  ctx.translate(cx0 - R * 0.42, cy0 - R * 0.5);
  ctx.rotate(-0.5);
  for (const [dx, dy] of [[0, 0], [R * 0.13, 0], [0, R * 0.11], [R * 0.13, R * 0.11]]) {
    ctx.fillRect(dx, dy, R * 0.11, R * 0.09);
  }
  ctx.restore();
  const ao = ctx.createRadialGradient(cx0, cy0, R * 0.72, cx0, cy0, R);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(10,12,24,0.55)');
  ctx.fillStyle = ao;
  ctx.fillRect(cx0 - R, cy0 - R, R * 2, R * 2);
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 10;
  ctx.strokeStyle = withA(P.neon, 0.55 * (1 - ballMix));
  ctx.beginPath();
  ctx.arc(cx0, cy0, R - 4, -0.9, 0.9);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = withA(P.orange, 0.45 * (1 - ballMix));
  ctx.beginPath();
  ctx.arc(cx0, cy0, R - 4, 1.9, 2.8);
  ctx.stroke();
  ctx.restore();
  // ball transformation: the eye turns into the orange cel-shaded ball
  if (ballMix > 0) {
    ctx.save();
    circle(ctx, cx0, cy0, R);
    ctx.clip();
    ctx.globalAlpha = ballMix;
    ctx.fillStyle = P.orange;
    ctx.fillRect(cx0 - R, cy0 - R, R * 2, R * 2);
    ctx.fillStyle = P.orangeDk;
    circle(ctx, cx0 + R * 0.19, cy0 + R * 0.23, R);
    ctx.fill();
    ctx.fillStyle = P.cream;
    circle(ctx, cx0 - R * 0.23, cy0 - R * 0.25, R * 0.15);
    ctx.fill();
    ctx.restore();
  }
};

/** anime lid aperture: upper lash line + lower lid; open = 1 (normal), 0 (closed), >1 (peeled away) */
const lidPath = (ctx: Ctx, open: number) => {
  const [cx, cy] = EC;
  const up = cy - R * 0.9 * open + R * 0.2 * (1 - open);
  const lo = cy + R * 0.72 * Math.min(1, open) + R * 0.1 * (1 - Math.min(1, open)) + R * 0.4 * Math.max(0, open - 1);
  ctx.beginPath();
  ctx.moveTo(cx - R * 1.25, cy + R * 0.05);
  ctx.bezierCurveTo(cx - R * 0.8, up - R * 0.1, cx + R * 0.7, up - R * 0.18, cx + R * 1.3, cy - R * 0.12);
  ctx.bezierCurveTo(cx + R * 0.8, lo + R * 0.05, cx - R * 0.7, lo + R * 0.08, cx - R * 1.25, cy + R * 0.05);
  ctx.closePath();
  return {up, lo};
};

const lashes = (ctx: Ctx, open: number, t: number, alpha: number) => {
  if (alpha <= 0) return;
  const [cx, cy] = EC;
  const up = cy - R * 0.9 * open + R * 0.2 * (1 - open);
  const bs = boilSeed(t, 10);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // thick upper lash line with an orange rim light
  for (const [lw, col, oy] of [
    [46, '#05060B', 0],
    [10, P.orange, -14],
  ] as const) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.25, cy + R * 0.05 + oy);
    ctx.bezierCurveTo(cx - R * 0.8, up - R * 0.1 + oy, cx + R * 0.7, up - R * 0.18 + oy, cx + R * 1.3, cy - R * 0.12 + oy);
    ctx.stroke();
  }
  // lashes flicking out at the corner (boil on 2s)
  ctx.fillStyle = '#05060B';
  for (let i = 0; i < 6; i++) {
    const u = 0.62 + i * 0.07;
    const x = lerp(cx - R * 1.25, cx + R * 1.3, u);
    const y = up - R * 0.12 + (u - 0.5) * R * 0.5 + noise1(i + bs, 341) * 3;
    const len = R * (0.24 + 0.06 * i);
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + len * 0.55, y - len * 0.85);
    ctx.lineTo(x + 12, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  // lower lid line
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#05060B';
  const lo = cy + R * 0.72 * Math.min(1, open) + R * 0.1 * (1 - Math.min(1, open));
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.95, cy + R * 0.25);
  ctx.bezierCurveTo(cx - R * 0.6, lo + R * 0.08, cx + R * 0.6, lo + R * 0.05, cx + R * 1.05, cy + R * 0.12);
  ctx.stroke();
  ctx.restore();
};

export const makeEyeWorld = (drawNextFirst: (ctx: Ctx) => void): World => ({
  id: 'character',
  title: ['CHARACTER DESIGN'],
  P: EC,
  bg: '#0B1222',
  back: (ctx, lt, t) => {
    const D = dur();
    const ok = clamp((lt - (D - OUT)) / OUT);
    // intro: start as an extreme close-up of the pupil on cream, pull back to the eye
    const pull = E.inOutCubic(clamp(lt / 64));
    const ap0 = pupilAlpha(0, TL.portals[2]);
    const z0 = 260 / (R * Math.sin(ap0));
    let zoom = lerp(z0, 1, pull);
    // beat breathing + the free-spin push
    zoom *= 1 + 0.035 * Math.sin(clamp((lb(lt) - 2) / 1) * Math.PI);
    // outro: shrink into the ball and drop onto the page (ends where the 2D animation ball starts)
    const ballX = 230;
    const ballY = 1338;
    const ballR = 96;
    let ex = EC[0];
    let ey = EC[1];
    if (ok > 0) {
      const k = E.inOutCubic(ok);
      zoom = lerp(zoom, ballR / R, k);
      ex = lerp(EC[0], ballX, k);
      ey = lerp(EC[1], ballY, E.inQuad(ok)) - 260 * Math.sin(Math.PI * Math.min(1, ok * 1.15)) * (1 - ok);
    }
    background(ctx, lt, t);
    // desk + page arrive during the outro
    if (ok > 0) {
      ctx.save();
      ctx.globalAlpha = E.inCubic(ok);
      ctx.fillStyle = '#0E0C0A';
      ctx.fillRect(-2000, -2000, W + 4000, H + 4000);
      ctx.restore();
      const py = lerp(H + 100, 380, E.outCubic(clamp((ok - 0.25) / 0.6)));
      ctx.fillStyle = '#F4EEE3';
      ctx.fillRect(120, py, 840, 1240);
    }
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(zoom, zoom);
    ctx.translate(-EC[0], -EC[1]);
    const wireA = clamp((lt - 40) / 30) * (1 - ok);
    wire(ctx, lt, false, wireA);
    // lids: open on arrival, blink on beat 1, peel away for the spin, gone for the outro
    const b = lb(lt);
    let open = 1;
    if (b > 0.95 && b < 1.25) open = 1 - Math.sin(clamp((b - 0.95) / 0.3) * Math.PI);
    const peel = E.inCubic(clamp((b - 1.8) / 0.3));
    const lidA = clamp((lt - 30) / 20) * (1 - peel);
    open = lerp(open, 2.4, peel);
    const glowA = 0.35 + 0.25 * envAt('low', t);
    glow(ctx, EC[0], EC[1], R * 1.9, P.neon, 0.22 * glowA * (1 - ok));
    ctx.save();
    if (lidA > 0.02 && peel < 1) {
      lidPath(ctx, open);
      ctx.clip();
    }
    eyeball(ctx, lt, t, ok > 0 ? E.inCubic(clamp(ok / 0.7)) : 0);
    ctx.restore();
    lashes(ctx, open, t, lidA);
    wire(ctx, lt, true, wireA);
    // first frames: still the D's last frame (flat paper + a black pupil), dissolving into the real eye
    const creamOut = 1 - clamp((lt - 4) / 24);
    if (creamOut > 0) {
      const rp = R * Math.sin(pupilAlpha(lt, t));
      ctx.save();
      ctx.globalAlpha = creamOut;
      ctx.beginPath();
      ctx.rect(-4000, -4000, 9000, 9000);
      ctx.arc(EC[0], EC[1], rp, 0, TAU, true);
      ctx.fillStyle = P.cream;
      ctx.fill('evenodd');
      ctx.fillStyle = P.bg;
      circle(ctx, EC[0], EC[1], rp);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // last frames: settle exactly onto the first frame of the 2D animation
    const xf = clamp((lt - (D - 10)) / 10);
    if (xf > 0) {
      ctx.save();
      ctx.globalAlpha = E.inQuad(xf);
      drawNextFirst(ctx);
      ctx.restore();
    }
    void onTwos;
    void text;
    void FONT;
    void CX;
  },
  portal: (ctx) => ctx.beginPath(),
});
