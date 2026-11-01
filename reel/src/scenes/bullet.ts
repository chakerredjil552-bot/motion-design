// Scene 4 — bullet-time: two silhouettes clash fist-to-fist, the world freezes, the camera orbits through
// 3D parallax layers while time crawls (music at 0.5x), then everything snaps back with a huge hit.
import {CX, E, H, M, P, TAU, W, clamp, envAt, lerp, onTwos, boilSeed, rnd, rndr} from '../lib/core';
import {Ctx, glow, poly, withA} from '../lib/draw';
import {POSE_PUNCH, POSE_RECOIL, POSE_WIND, Pose, drawFigure, figurePath, lerpPose, mirror} from '../lib/figure';
import {drawSkillTitle} from './onetake';

const SLOW = 0.035; // world-time rate while frozen
const FOC = 1600;
const S = 1.12; // fighter scale (world px per figure px)
const TILT = 0.32; // the clash line is tilted for a diagonal portrait composition
const BASEY = 300;
const FIST = {x: 334 * S, y: -270 * S};
const IMPACT = {x: 0, y: BASEY + FIST.y, z: 0};

export const isImpactFrame = (f: number) => f === M.snap || f === M.snap + 1;

/** scene time: real time before contact, crawling during the freeze, real time after the snap */
const tau = (t: number) => {
  if (t < M.contact) return t - M.contact;
  if (t < M.snap) return (t - M.contact) * SLOW;
  return (M.snap - M.contact) * SLOW + (t - M.snap);
};

type Cam = {yaw: number; pitch: number; zoom: number};
const camAt = (t: number): Cam => {
  if (t < M.contact) return {yaw: 0, pitch: 0, zoom: 0.94};
  const p = clamp((t - M.contact) / (M.snap - M.contact));
  const e = E.inOutCubic(p);
  let yaw = 0.85 * e;
  let pitch = -0.12 * Math.sin(p * Math.PI);
  let zoom = 0.94 + 0.2 * e;
  if (t >= M.snap) {
    // whip back to the front with an overshoot, then settle
    const k = E.outBack(clamp((t - M.snap) / 10), 1.4);
    yaw = lerp(0.85, 0, k);
    pitch = 0;
    zoom = lerp(1.14, 0.9, E.outExpo(clamp((t - M.snap) / 12)));
    // crash zoom into the second clash
    if (t >= M.relunge) zoom = lerp(0.9, 1.35, E.inCubic(clamp((t - M.relunge) / (M.hardcut - M.relunge))));
  }
  return {yaw, pitch, zoom};
};

const project = (cam: Cam, X: number, Y: number, Z: number) => {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const x1 = X * cy - Z * sy;
  const z1 = X * sy + Z * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const Yc = Y - IMPACT.y;
  const y2 = Yc * cp - z1 * sp;
  const z2 = Yc * sp + z1 * cp;
  const depth = FOC + z2;
  const k = (FOC / Math.max(80, depth)) * cam.zoom;
  return {x: CX + x1 * k, y: 1010 + y2 * k, k, depth};
};

/** rotate a point of the clash plane around the impact (diagonal composition) */
const tilt = (x: number, y: number): [number, number] => {
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  const dx = x - IMPACT.x;
  const dy = y - IMPACT.y;
  return [IMPACT.x + dx * c - dy * s, IMPACT.y + dx * s + dy * c];
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
    off = ta * 2.5;
  } else {
    const ts = t - M.snap;
    const k = E.outCubic(clamp(ts / 9));
    pose = lerpPose(POSE_PUNCH, POSE_RECOIL, k);
    // thrown back a step...
    off = (M.snap - M.contact) * SLOW * 2.5 + E.outExpo(clamp(ts / 22)) * 120;
    rot = -0.3 * E.outBack(clamp(ts / 20), 2);
    lift = -E.outCubic(clamp(ts / 30)) * 50;
    // ...then both lunge again on the fill: the hard cut lands one frame before the second impact
    if (t >= M.relunge) {
      const lk = E.inCubic(clamp((t - M.relunge) / (M.hardcut - M.relunge)));
      pose = lerpPose(POSE_RECOIL, POSE_PUNCH, E.outBack(clamp((t - M.relunge) / 22), 1.6));
      off = lerp(off, 30, lk);
      rot = lerp(rot, 0, lk);
      lift = lerp(lift, 0, lk);
    }
  }
  if (side === 1) pose = mirror(pose);
  return {pose, off: off * side, rot: rot * side, lift};
};

const fighterPath = (t: number, side: -1 | 1, pose: Pose) =>
  figurePath(pose, {
    facing: side === -1 ? 1 : -1,
    hair: side === -1 ? 'spike' : 'long',
    ribbon: side === -1 ? 'scarf' : 'band',
    coat: true,
    wind: t >= M.contact && t < M.snap ? 0.25 : 1.6,
    t: t < M.contact || t >= M.snap ? onTwos(t) : M.contact + (t - M.contact) * SLOW,
    boilSeed: boilSeed(t, t >= M.contact && t < M.snap ? 20 : 10),
  });

/** affine for the fighter card (figure px -> screen), from the projected card origin and axes */
const fighterXf = (cam: Cam, t: number, side: -1 | 1) => {
  const st = fighterState(t, side);
  const baseX = side * (FIST.x + 6) + st.off;
  const baseY = BASEY + st.lift;
  const Zc = side * 50;
  const o = tilt(baseX, baseY);
  const ax = tilt(baseX + 100 * S, baseY);
  const ay = tilt(baseX, baseY + 100 * S);
  const O = project(cam, o[0], o[1], Zc);
  const ex = project(cam, ax[0], ax[1], Zc);
  const ey = project(cam, ay[0], ay[1], Zc);
  return {st, O, ex, ey};
};

const drawFighter = (ctx: Ctx, cam: Cam, t: number, side: -1 | 1, alpha = 1, stretch = 1, solid?: string) => {
  const {st, O, ex, ey} = fighterXf(cam, t, side);
  const path = fighterPath(t, side, st.pose);
  ctx.save();
  ctx.setTransform((ex.x - O.x) / 100, (ex.y - O.y) / 100, (ey.x - O.x) / 100, (ey.y - O.y) / 100, O.x, O.y);
  ctx.rotate(st.rot);
  ctx.scale(stretch, 1 / Math.sqrt(stretch));
  if (solid) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = solid;
    ctx.fill(path);
  } else {
    drawFigure(ctx, path, {rim: side === -1 ? P.orange : P.neon, light: [0.78 * -side, -0.5], lw: 6, rimW: 20, alpha});
  }
  ctx.restore();
};

// ------------------------------------------------------------------------------------------ layers
const SPARKS = Array.from({length: 300}, (_, i) => {
  const a = rnd(301, i) * TAU;
  const el = (rnd(302, i) - 0.5) * 2.2;
  const sp = rndr(303, i, 16, 92);
  return {dx: Math.cos(a), dy: Math.sin(a) * 0.85, dz: el, sp, hot: rnd(304, i), w: rndr(305, i, 2, 6)};
});
const DEBRIS = (() => {
  const out: {x: number; y: number; z: number; s: number; rot: number; spin: number; n: number; seed: number}[] = [];
  let i = 0;
  while (out.length < 44 && i < 400) {
    const x = rndr(401, i, -1700, 1700);
    const y = rndr(402, i, -1300, 1100);
    const z = rndr(403, i, -1300, 1500);
    i++;
    // keep the clash readable: nothing in a column around the fighters, and nothing too close to the lens
    if (Math.abs(x) < 900 && Math.abs(y - IMPACT.y) < 700) continue;
    if (z < -900) continue;
    out.push({x, y, z, s: rndr(404, i, 14, 64), rot: rnd(405, i) * TAU, spin: rndr(406, i, -0.08, 0.08), n: 5 + Math.floor(rnd(407, i) * 3), seed: i});
  }
  return out;
})();
const CLOUDS = Array.from({length: 14}, (_, i) => ({
  x: rndr(501, i, -2200, 2200),
  y: rndr(502, i, 500, 1100),
  z: rndr(503, i, -1200, 1600),
  w: rndr(504, i, 500, 1200),
}));

const sky = (ctx: Ctx, cam: Cam) => {
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
    const x = (((rnd(601, i) * 2400 + shift) % 2400) + 2400) % 2400 - 660;
    const y = 1440 + rnd(602, i) * 480;
    const r = rndr(603, i, 10, 46);
    glow(ctx, x, y, r * 2.2, rnd(604, i) > 0.7 ? P.neon : P.orange, 0.3 + 0.3 * rnd(605, i));
  }
};

const drawClouds = (ctx: Ctx, cam: Cam) => {
  for (const c of CLOUDS) {
    const p = project(cam, c.x, c.y, c.z);
    if (p.depth < 200) continue;
    ctx.fillStyle = withA('#2A1730', 0.55);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, (c.w * p.k) / 2, 34 * p.k, 0, 0, TAU);
    ctx.fill();
  }
};

const drawDebris = (ctx: Ctx, cam: Cam, t: number, front: boolean, solid?: string) => {
  const ta = tau(t);
  const blast = t >= M.snap ? E.outCubic(clamp((t - M.snap) / 40)) * 0.6 : 0;
  for (const d of DEBRIS) {
    const sc = 1 + 0.002 * Math.max(0, ta) + blast;
    const p = project(cam, d.x * sc, IMPACT.y + (d.y - IMPACT.y) * sc, d.z);
    if (front !== p.depth < FOC) continue;
    if (p.depth < 150) continue;
    const s = d.s * p.k;
    const rot = d.rot + d.spin * Math.max(0, ta);
    const pts: number[][] = [];
    for (let k = 0; k < d.n; k++) {
      const a = rot + (k / d.n) * TAU;
      const r = s * (0.7 + 0.5 * rnd(d.seed + 700, k));
      pts.push([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r]);
    }
    poly(ctx, pts);
    ctx.fillStyle = solid ?? '#0B0910';
    ctx.fill();
    if (!solid) {
      ctx.lineWidth = Math.max(1.5, 3 * p.k);
      ctx.strokeStyle = withA(d.x < 0 ? P.orange : P.neon, 0.75);
      ctx.stroke();
    }
  }
};

const sparkPos = (s: (typeof SPARKS)[number], ta: number, after: number) => {
  const d = s.sp * (ta + 1.2) * (1 + after * 0.02);
  return [IMPACT.x + s.dx * d, IMPACT.y + s.dy * d, IMPACT.z + s.dz * d * 0.6];
};

const drawSparks = (ctx: Ctx, cam: Cam, t: number, solid?: string) => {
  const ta = tau(t);
  if (ta < 0) return;
  const after = t >= M.snap ? t - M.snap : 0;
  const fade = clamp(1 - after / 45);
  if (fade <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  if (!solid) ctx.globalCompositeOperation = 'lighter';
  for (const s of SPARKS) {
    const [X, Y, Zs] = sparkPos(s, ta, after);
    const a = project(cam, X, Y, Zs);
    const tail = s.sp * (t >= M.contact && t < M.snap ? 1.4 : 4);
    const b = project(cam, X - s.dx * tail, Y - s.dy * tail, Zs - s.dz * tail * 0.6);
    ctx.strokeStyle = solid ?? withA(s.hot > 0.75 ? P.cream : s.hot > 0.4 ? P.orangeHi : P.neon, 0.9 * fade);
    ctx.lineWidth = s.w * a.k;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
};

const speedLines = (ctx: Ctx, x: number, y: number, t: number, amt: number, color = P.cream, count = 90) => {
  if (amt <= 0) return;
  const bs = Math.floor(onTwos(t, 15) / 15);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const a = rnd(bs * 17 + 3, i) * TAU;
    const r0 = 380 + rnd(bs * 17 + 4, i) * 500;
    const r1 = r0 + 500 + rnd(bs * 17 + 5, i) * 900;
    const w = 1 + rnd(bs * 17 + 6, i) * 5;
    ctx.fillStyle = withA(color, (0.08 + 0.2 * rnd(bs, i)) * amt);
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
  const r = (after >= 0 ? 130 + after * 6 : 120) * pulse * p.k;
  const coreA = after >= 0 ? clamp(1 - after / 18) : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, p.x, p.y, r * 3, P.orange, 0.55 * coreA);
  glow(ctx, p.x, p.y, r, '#FFFFFF', 0.95 * coreA);
  // anamorphic cross flare (fades fast after the snap)
  const fa = (after >= 0 ? clamp(1 - after / 10) : 1) * 0.55;
  if (fa > 0) {
    ctx.fillStyle = withA('#FFFFFF', fa);
    const fl = 420 * p.k;
    ctx.beginPath();
    ctx.moveTo(p.x - fl, p.y);
    ctx.lineTo(p.x, p.y - 5);
    ctx.lineTo(p.x + fl, p.y);
    ctx.lineTo(p.x, p.y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - fl * 0.45);
    ctx.lineTo(p.x - 4, p.y);
    ctx.lineTo(p.x, p.y + fl * 0.45);
    ctx.lineTo(p.x + 4, p.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // shockwave rings after the snap
  if (after >= 0) {
    for (let k = 0; k < 3; k++) {
      const a2 = after - k * 4;
      if (a2 < 0 || a2 > 40) continue;
      const rr = E.outCubic(clamp(a2 / 40)) * 1500 * p.k;
      ctx.save();
      ctx.lineWidth = Math.max(0, 60 * (1 - a2 / 40)) * p.k;
      ctx.strokeStyle = withA(k === 1 ? P.neon : P.cream, 0.85 * (1 - a2 / 40));
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rr, rr * (0.35 + 0.65 * Math.abs(Math.cos(cam.yaw))), TILT, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
};

/** anime impact frame: two-tone (ink on paper, or inverted) silhouettes, burst and speed lines */
export const drawImpactFrame = (ctx: Ctx, t: number, inverted: boolean) => {
  const paper = inverted ? '#050407' : P.cream;
  const ink = inverted ? P.cream : '#050407';
  const cam = camAt(M.snap - 0.001);
  ctx.fillStyle = paper;
  ctx.fillRect(-100, -100, W + 200, H + 200);
  const p = project(cam, IMPACT.x, IMPACT.y, IMPACT.z);
  // dense radial speed lines
  ctx.save();
  for (let i = 0; i < 160; i++) {
    const a = rnd(911, i) * TAU;
    const r0 = 260 + rnd(912, i) * 260;
    const w = 0.004 + rnd(913, i) * 0.02;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0);
    ctx.lineTo(p.x + Math.cos(a + w) * 2400, p.y + Math.sin(a + w) * 2400);
    ctx.lineTo(p.x + Math.cos(a - w) * 2400, p.y + Math.sin(a - w) * 2400);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawDebris(ctx, cam, M.snap - 0.001, false, ink);
  for (const side of [-1, 1] as const) drawFighter(ctx, cam, M.snap - 0.001, side, 1, 1, ink);
  // jagged burst with an orange ring
  const spikes = 18;
  const burst: number[][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU + 0.1;
    const r = (i % 2 ? 120 : 300 + 120 * rnd(915, i)) * p.k;
    burst.push([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r]);
  }
  poly(ctx, burst);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 90 * p.k, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = P.orange;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 200 * p.k, 0, TAU);
  ctx.stroke();
  drawSparks(ctx, cam, M.snap - 0.001, ink);
  void t;
};

const drawScene = (ctx: Ctx, t: number, withTitle: boolean) => {
  const cam = camAt(t);
  sky(ctx, cam);
  drawClouds(ctx, cam);
  drawDebris(ctx, cam, t, false);
  const ip = project(cam, IMPACT.x, IMPACT.y, IMPACT.z);
  const frozen = t >= M.contact && t < M.snap;
  speedLines(ctx, ip.x, ip.y, t, frozen ? 1 : t >= M.relunge ? clamp((t - M.relunge) / 20) : t >= M.snap ? clamp(1 - (t - M.snap) / 20) : 0);
  // draw the farther fighter first (depends on orbit)
  const order: (-1 | 1)[] = Math.sin(cam.yaw) > 0 ? [1, -1] : [-1, 1];
  const after = t - M.snap;
  for (const side of order) {
    if (after >= 2 && after < 14) {
      // smear frames: ghost trail along the recoil
      for (let g = 4; g >= 1; g--) drawFighter(ctx, cam, t - g * 1.8, side, 0.14 * (5 - g), 1.22, side === -1 ? P.orange : P.neon);
    }
    drawFighter(ctx, cam, t, side, 1, after >= 2 && after < 8 ? 1.25 : 1);
  }
  core(ctx, cam, t);
  drawSparks(ctx, cam, t);
  drawDebris(ctx, cam, t, true);
  glow(ctx, CX, 1500, 900, P.orange, 0.08 + 0.15 * envAt('low', t));
  if (withTitle && t >= M.contact) {
    drawSkillTitle(ctx, ['ACTION / FIGHT', 'ANIMATION'], 'SKILL 09 / 09', t - M.contact - 6, M.snap - t, 0, 700);
  }
};

export const drawBullet = (ctx: Ctx, t: number, f: number) => {
  if (isImpactFrame(f)) {
    drawImpactFrame(ctx, t, false);
    return;
  }
  drawScene(ctx, t, true);
};

/** the scene without its title (grid panel replay) */
export const drawBulletScene = (ctx: Ctx, t: number) => drawScene(ctx, t, false);

/** home view of this scene, used when it is nested inside the speaker cone during the one-take */
export const drawBulletHome = (ctx: Ctx, t: number) => drawScene(ctx, Math.min(t, M.contact - 0.001), false);
