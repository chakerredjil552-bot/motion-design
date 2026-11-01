// Scene 4 — bullet-time: two silhouettes clash fist-to-fist, the world freezes, the camera orbits through
// 3D parallax layers while time crawls (music at 0.5x), then everything snaps back with a huge hit.
import {CX, CY, E, H, M, P, TAU, W, clamp, envAt, lerp, onTwos, boilSeed, rnd, rndr} from '../lib/core';
import {Ctx, circle, glow, poly, withA} from '../lib/draw';
import {POSE_PUNCH, POSE_RECOIL, POSE_WIND, Pose, drawFigure, figurePath, lerpPose, mirror} from '../lib/figure';
import {drawSkillTitle} from './onetake';

const SLOW = 0.035; // world-time rate while frozen
const FOC = 1600;
const IMPACT = {x: 0, y: -40, z: 0};

export const isImpactFrame = (f: number) => f === M.snap || f === M.snap + 1;

/** scene time: real time before contact, crawling during the freeze, real time after the snap */
const tau = (t: number) => {
  if (t < M.contact) return t - M.contact;
  if (t < M.snap) return (t - M.contact) * SLOW;
  return (M.snap - M.contact) * SLOW + (t - M.snap);
};

type Cam = {yaw: number; pitch: number; zoom: number; dy: number};
const camAt = (t: number): Cam => {
  if (t < M.contact) return {yaw: 0, pitch: 0, zoom: 1, dy: 0};
  const p = clamp((t - M.contact) / (M.snap - M.contact));
  const e = E.inOutCubic(p);
  let yaw = 0.82 * e;
  let pitch = -0.1 * Math.sin(p * Math.PI);
  let zoom = 1 + 0.22 * e;
  if (t >= M.snap) {
    const k = E.outExpo(clamp((t - M.snap) / 8));
    yaw = lerp(0.82, -0.05, k);
    pitch = 0;
    zoom = lerp(1.22, 0.92, k);
  }
  return {yaw, pitch, zoom, dy: 0};
};

const project = (cam: Cam, X: number, Y: number, Z: number) => {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const x1 = X * cy - Z * sy;
  const z1 = X * sy + Z * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y2 = Y * cp - z1 * sp;
  const z2 = Y * sp + z1 * cp;
  const depth = FOC + z2;
  const k = (FOC / Math.max(80, depth)) * cam.zoom;
  return {x: CX + x1 * k, y: CY + y2 * k + 60, k, depth};
};

// ------------------------------------------------------------------------------------------ fighters
const fighterState = (t: number, side: -1 | 1) => {
  const ta = tau(t);
  let pose: Pose;
  let off = 0;
  let rot = 0;
  let lift = 0;
  if (ta < 0) {
    const appr = clamp(1 + ta / 80);
    off = (1 - E.inCubic(appr)) * 520;
    const k = E.outBack(clamp((ta + 16) / 16), 1.6);
    pose = lerpPose(POSE_WIND, POSE_PUNCH, k);
  } else if (t < M.snap) {
    pose = POSE_PUNCH;
    off = ta * 3;
  } else {
    const ts = t - M.snap;
    const k = E.outCubic(clamp(ts / 10));
    pose = lerpPose(POSE_PUNCH, POSE_RECOIL, k);
    off = (M.snap - M.contact) * SLOW * 3 + E.outCubic(clamp(ts / 60)) * 900;
    rot = -0.5 * E.outCubic(clamp(ts / 40));
    lift = -E.outCubic(clamp(ts / 50)) * 260;
  }
  if (side === 1) pose = mirror(pose);
  return {pose, off: off * side, rot: rot * side, lift};
};

const drawFighter = (ctx: Ctx, cam: Cam, t: number, side: -1 | 1, alpha = 1, stretch = 1) => {
  const st = fighterState(t, side);
  const baseX = 340 * side + st.off;
  const baseY = 140 + st.lift;
  const Zc = side * 55;
  const O = project(cam, baseX, baseY, Zc);
  const ex = project(cam, baseX + 100, baseY, Zc);
  const ey = project(cam, baseX, baseY + 100, Zc);
  const path = figurePath(st.pose, {
    facing: side === -1 ? 1 : -1,
    hair: side === -1 ? 'spike' : 'long',
    ribbon: side === -1 ? 'scarf' : 'band',
    wind: t >= M.contact && t < M.snap ? 0.25 : 1.6,
    t: t < M.contact || t >= M.snap ? onTwos(t) : M.contact + (t - M.contact) * SLOW,
    boilSeed: boilSeed(t, t >= M.contact && t < M.snap ? 20 : 10),
  });
  ctx.save();
  ctx.setTransform(
    ((ex.x - O.x) / 100) * stretch,
    (ex.y - O.y) / 100,
    (ey.x - O.x) / 100,
    (ey.y - O.y) / 100,
    O.x,
    O.y,
  );
  ctx.rotate(st.rot);
  drawFigure(ctx, path, {rim: side === -1 ? P.orange : P.neon, light: [0.75 * -side, -0.55], lw: 6, rimW: 18, alpha});
  ctx.restore();
};

// ------------------------------------------------------------------------------------------ layers
const SPARKS = Array.from({length: 280}, (_, i) => {
  const a = rnd(301, i) * TAU;
  const el = (rnd(302, i) - 0.5) * 2.2;
  const sp = rndr(303, i, 18, 95);
  return {dx: Math.cos(a), dy: Math.sin(a) * 0.8, dz: el, sp, hot: rnd(304, i), w: rndr(305, i, 2, 6)};
});
const DEBRIS = Array.from({length: 46}, (_, i) => {
  const r = rndr(401, i, 380, 1500);
  const a = rnd(402, i) * TAU;
  return {
    x: Math.cos(a) * r,
    y: rndr(403, i, -900, 900),
    z: Math.sin(a) * r * 1.2,
    s: rndr(404, i, 14, 70),
    rot: rnd(405, i) * TAU,
    spin: rndr(406, i, -0.08, 0.08),
    n: 5 + Math.floor(rnd(407, i) * 3),
    seed: i,
  };
});
const CLOUDS = Array.from({length: 14}, (_, i) => ({
  x: rndr(501, i, -2200, 2200),
  y: rndr(502, i, 300, 900),
  z: rndr(503, i, -1400, 1400),
  w: rndr(504, i, 500, 1200),
}));

const sky = (ctx: Ctx, cam: Cam, t: number) => {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07060E');
  g.addColorStop(0.5, '#1A0F2A');
  g.addColorStop(0.82, '#52233A');
  g.addColorStop(1, '#C0613F');
  ctx.fillStyle = g;
  ctx.fillRect(-2000, -2000, W + 4000, H + 4000);
  // city bokeh far below (deep parallax)
  const shift = -cam.yaw * 420;
  for (let i = 0; i < 70; i++) {
    const x = ((rnd(601, i) * 2400 + shift) % 2400 + 2400) % 2400 - 660;
    const y = 1380 + rnd(602, i) * 520;
    const r = rndr(603, i, 10, 46);
    glow(ctx, x, y, r * 2.2, rnd(604, i) > 0.7 ? P.neon : P.orange, 0.35 + 0.3 * rnd(605, i));
  }
  void t;
};

const drawCloud = (ctx: Ctx, cam: Cam) => {
  for (const c of CLOUDS) {
    const p = project(cam, c.x, c.y, c.z);
    if (p.depth < 200) continue;
    ctx.save();
    ctx.fillStyle = withA('#2A1730', 0.55);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, (c.w * p.k) / 2, 34 * p.k, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
};

const drawDebris = (ctx: Ctx, cam: Cam, t: number, front: boolean) => {
  const ta = tau(t);
  for (const d of DEBRIS) {
    const p = project(cam, d.x + d.x * 0.002 * Math.max(0, ta), d.y, d.z);
    if (front !== p.depth < FOC) continue;
    if (p.depth < 120) continue;
    const s = d.s * p.k;
    const rot = d.rot + d.spin * Math.max(0, ta);
    const pts: number[][] = [];
    for (let k = 0; k < d.n; k++) {
      const a = rot + (k / d.n) * TAU;
      const r = s * (0.7 + 0.5 * rnd(d.seed + 700, k));
      pts.push([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r]);
    }
    poly(ctx, pts);
    ctx.fillStyle = '#0B0910';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 3 * p.k);
    ctx.strokeStyle = withA(d.x < 0 ? P.orange : P.neon, 0.75);
    ctx.stroke();
  }
};

const drawSparks = (ctx: Ctx, cam: Cam, t: number) => {
  const ta = tau(t);
  if (ta < 0) return;
  const after = t >= M.snap ? t - M.snap : 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (const s of SPARKS) {
    const d = s.sp * (ta + 1.2) * (1 + after * 0.02);
    const X = IMPACT.x + s.dx * d;
    const Y = IMPACT.y + s.dy * d;
    const Zs = IMPACT.z + s.dz * d * 0.6;
    const a = project(cam, X, Y, Zs);
    const tail = s.sp * (t >= M.contact && t < M.snap ? 1.4 : 4);
    const b = project(cam, X - s.dx * tail, Y - s.dy * tail, Zs - s.dz * tail * 0.6);
    const fade = clamp(1 - after / 50);
    if (fade <= 0) continue;
    ctx.strokeStyle = withA(s.hot > 0.75 ? P.cream : s.hot > 0.4 ? P.orangeHi : P.neon, 0.9 * fade);
    ctx.lineWidth = s.w * a.k;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
};

const speedLines = (ctx: Ctx, x: number, y: number, t: number, amt: number) => {
  if (amt <= 0) return;
  const bs = Math.floor(onTwos(t, 15) / 15);
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const a = rnd(bs * 17 + 3, i) * TAU;
    const r0 = 380 + rnd(bs * 17 + 4, i) * 500;
    const r1 = r0 + 400 + rnd(bs * 17 + 5, i) * 900;
    const w = 1 + rnd(bs * 17 + 6, i) * 5;
    ctx.fillStyle = withA(P.cream, (0.08 + 0.2 * rnd(bs, i)) * amt);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a + w * 0.002) * r1, y + Math.sin(a + w * 0.002) * r1);
    ctx.lineTo(x + Math.cos(a - w * 0.002) * r1, y + Math.sin(a - w * 0.002) * r1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

const core = (ctx: Ctx, cam: Cam, t: number) => {
  const ta = tau(t);
  if (ta < -2) return;
  const p = project(cam, IMPACT.x, IMPACT.y, IMPACT.z);
  const after = t >= M.snap ? t - M.snap : -1;
  const pulse = 1 + 0.08 * Math.sin(t * 0.25);
  const r = (after >= 0 ? 260 + after * 40 : 200) * pulse * p.k;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, p.x, p.y, r * 3, P.orange, after >= 0 ? clamp(1 - after / 30) * 0.9 : 0.6);
  glow(ctx, p.x, p.y, r * 1.2, '#FFFFFF', after >= 0 ? clamp(1 - after / 14) : 0.9);
  // cross flare
  ctx.fillStyle = withA('#FFFFFF', 0.85);
  const fl = r * 4;
  ctx.beginPath();
  ctx.moveTo(p.x - fl, p.y);
  ctx.lineTo(p.x, p.y - 7);
  ctx.lineTo(p.x + fl, p.y);
  ctx.lineTo(p.x, p.y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - fl * 0.5);
  ctx.lineTo(p.x - 5, p.y);
  ctx.lineTo(p.x, p.y + fl * 0.5);
  ctx.lineTo(p.x + 5, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // shockwave rings after the snap
  if (after >= 0) {
    for (let k = 0; k < 3; k++) {
      const a2 = after - k * 4;
      if (a2 < 0) continue;
      const rr = E.outCubic(clamp(a2 / 40)) * 1500 * p.k;
      ctx.save();
      ctx.lineWidth = Math.max(0, 60 * (1 - a2 / 40)) * p.k;
      ctx.strokeStyle = withA(k === 1 ? P.neon : P.cream, 0.85 * (1 - a2 / 40));
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rr, rr * (0.35 + 0.65 * Math.abs(Math.cos(cam.yaw))), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
};

const drawScene = (ctx: Ctx, t: number, withTitle: boolean) => {
  const cam = camAt(t);
  sky(ctx, cam, t);
  drawCloud(ctx, cam);
  drawDebris(ctx, cam, t, false);
  const ip = project(cam, IMPACT.x, IMPACT.y, IMPACT.z);
  const frozen = t >= M.contact && t < M.snap;
  speedLines(ctx, ip.x, ip.y, t, frozen ? 1 : t >= M.snap ? clamp(1 - (t - M.snap) / 20) : 0);
  // draw the farther fighter first (depends on orbit)
  const order: (-1 | 1)[] = Math.sin(cam.yaw) > 0 ? [1, -1] : [-1, 1];
  const after = t - M.snap;
  for (const side of order) {
    if (after >= 2 && after < 12) {
      // smear frames: ghost trail along the recoil
      for (let g = 4; g >= 1; g--) drawFighter(ctx, cam, t - g * 1.6, side, 0.16 * (5 - g), 1.25);
    }
    drawFighter(ctx, cam, t, side, 1, after >= 2 && after < 8 ? 1.3 : 1);
  }
  core(ctx, cam, t);
  drawSparks(ctx, cam, t);
  drawDebris(ctx, cam, t, true);
  // energy glow reacts to the slowed music
  glow(ctx, CX, CY + 400, 900, P.orange, 0.1 + 0.15 * envAt('low', t));
  if (withTitle && t >= M.contact) {
    drawSkillTitle(ctx, ['ACTION / FIGHT', 'ANIMATION'], 'SKILL 09 / 09', t - M.contact - 6, M.snap - t, 0);
  }
};

export const drawBullet = (ctx: Ctx, t: number, f: number) => {
  drawScene(ctx, t, true);
  void f;
};

/** home view of this scene, used when it is nested inside the speaker cone during the one-take */
export const drawBulletHome = (ctx: Ctx, t: number) => drawScene(ctx, Math.min(t, M.contact - 0.001), false);
void CY;
void circle;
