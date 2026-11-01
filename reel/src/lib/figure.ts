// Stylised anime silhouettes built from a skeleton: union path, rim light, cel tone, line boil.
import {P, TAU, lerp, noise1} from './core';
import {Ctx} from './draw';

export type Pt = [number, number];
export type Pose = Record<string, Pt>;
export const JOINTS = [
  'head', 'neck', 'chest', 'pelvis', 'lSh', 'rSh', 'lEl', 'rEl', 'lHa', 'rHa', 'lHip', 'rHip', 'lKn', 'rKn', 'lFt', 'rFt',
] as const;

export const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  const o: Pose = {};
  for (const k of JOINTS) o[k] = [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t)];
  return o;
};
export const mirror = (a: Pose): Pose => {
  const o: Pose = {};
  for (const k of JOINTS) o[k] = [-a[k][0], a[k][1]];
  return o;
};

// --- key poses (facing +x, pelvis at origin, ~700 px tall)
export const POSE_PUNCH: Pose = {
  head: [78, -338], neck: [52, -282], chest: [28, -205], pelvis: [0, 0],
  rSh: [62, -248], rEl: [196, -262], rHa: [334, -270],
  lSh: [-18, -244], lEl: [-112, -182], lHa: [-58, -128],
  rHip: [34, 2], rKn: [172, 92], rFt: [196, 300],
  lHip: [-22, 10], lKn: [-134, 132], lFt: [-310, 282],
};
export const POSE_WIND: Pose = {
  head: [40, -350], neck: [22, -292], chest: [0, -210], pelvis: [0, 0],
  rSh: [40, -250], rEl: [-40, -200], rHa: [-110, -250],
  lSh: [-34, -246], lEl: [40, -160], lHa: [120, -200],
  rHip: [30, 2], rKn: [120, 120], rFt: [120, 310],
  lHip: [-26, 8], lKn: [-90, 140], lFt: [-200, 300],
};
export const POSE_RECOIL: Pose = {
  head: [-40, -320], neck: [-28, -268], chest: [-16, -196], pelvis: [0, 0],
  rSh: [24, -240], rEl: [120, -330], rHa: [60, -420],
  lSh: [-50, -236], lEl: [-150, -260], lHa: [-230, -330],
  rHip: [30, 2], rKn: [150, -30], rFt: [260, 80],
  lHip: [-26, 8], lKn: [-60, 160], lFt: [-30, 330],
};
export const standPose = (yaw: number): Pose => {
  // yaw 0 = front, PI/2 = side (facing +x), PI = back
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sw = 72 * Math.abs(c) + 22;
  const hw = 40 * Math.abs(c) + 14;
  return {
    head: [8 * s, -350], neck: [4 * s, -292], chest: [0, -210], pelvis: [0, 0],
    rSh: [sw, -250], rEl: [sw + 16, -130], rHa: [sw + 10, -20],
    lSh: [-sw, -250], lEl: [-sw - 16, -130], lHa: [-sw - 10, -20],
    rHip: [hw, 4], rKn: [hw + 6, 160], rFt: [hw + 4 + 30 * s, 320],
    lHip: [-hw, 4], lKn: [-hw - 6, 160], lFt: [-hw - 4 + 30 * s, 320],
  };
};

/** clockwise (on a y-down canvas) capsule so every sub-path shares one winding -> clean nonzero union */
const capsuleP = (p: Path2D, a: Pt, b: Pt, r1: number, r2: number) => {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const n = ang + Math.PI / 2;
  p.moveTo(a[0] + Math.cos(n) * r1, a[1] + Math.sin(n) * r1);
  p.arc(a[0], a[1], r1, n, n + Math.PI, false);
  p.lineTo(b[0] - Math.cos(n) * r2, b[1] - Math.sin(n) * r2);
  p.arc(b[0], b[1], r2, n + Math.PI, n + 2 * Math.PI, false);
  p.closePath();
};
const areaSign = (pts: Pt[]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    s += pts[i][0] * q[1] - q[0] * pts[i][1];
  }
  return s;
};
/** add a polygon, forcing clockwise winding */
const polyCW = (p: Path2D, pts: Pt[]) => {
  const q = areaSign(pts) < 0 ? [...pts].reverse() : pts;
  p.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) p.lineTo(q[i][0], q[i][1]);
  p.closePath();
};
const quadPts = (a: Pt, c: Pt, b: Pt, n = 8): Pt[] => {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
};

export type FigStyle = {
  facing: 1 | -1;
  hair: 'spike' | 'long';
  ribbon?: 'scarf' | 'band';
  wind?: number; // hair/ribbon flutter strength
  t: number; // time for flutter (quantised on 2s by caller)
  boilSeed: number;
  boilAmt?: number;
  stretch?: number; // smear stretch along x
  bulk?: number; // limb thickness multiplier
  coat?: boolean; // flared jacket tails
};

export const figurePath = (pose: Pose, st: FigStyle) => {
  const bj = (k: string, i: number): Pt => {
    const a = st.boilAmt ?? 1.6;
    return [pose[k][0] + noise1(i * 3.3 + st.boilSeed * 1.7, 3) * a, pose[k][1] + noise1(i * 2.1 + st.boilSeed * 2.9, 7) * a];
  };
  const j: Record<string, Pt> = {};
  JOINTS.forEach((k, i) => (j[k] = bj(k, i)));
  const p = new Path2D();
  const B = st.bulk ?? 1.38;
  // legs
  capsuleP(p, j.lHip, j.lKn, 31 * B, 24 * B);
  capsuleP(p, j.lKn, j.lFt, 24 * B, 15 * B);
  capsuleP(p, j.rHip, j.rKn, 31 * B, 24 * B);
  capsuleP(p, j.rKn, j.rFt, 24 * B, 15 * B);
  // feet
  for (const ft of [j.lFt, j.rFt]) {
    const d = st.facing;
    const fs = 0.75 + 0.25 * B;
    polyCW(p, [[ft[0] - 22 * d * fs, ft[1] - 18 * fs], [ft[0] + 56 * d * fs, ft[1] + 4 * fs], [ft[0] + 50 * d * fs, ft[1] + 22 * fs], [ft[0] - 26 * d * fs, ft[1] + 20 * fs]]);
  }
  // torso (tapered, with lats)
  const [ls, rs, lh, rh, ch] = [j.lSh, j.rSh, j.lHip, j.rHip, j.chest];
  const sgn = rs[0] >= ls[0] ? 1 : -1;
  const tw = 10 * B;
  const A: Pt = [ls[0] - tw * sgn, ls[1] - 8];
  const torso: Pt[] = [A];
  torso.push(...quadPts(A, [ch[0], ch[1] - 80], [rs[0] + tw * sgn, rs[1] - 8]));
  torso.push(...quadPts([rs[0] + tw * sgn, rs[1] - 8], [rs[0] + 3 * tw * sgn, (rs[1] + rh[1]) / 2], [rh[0] + 2.2 * tw * sgn, rh[1]]));
  torso.push([lh[0] - 2.2 * tw * sgn, lh[1] + 8]);
  torso.push(...quadPts([lh[0] - 2.2 * tw * sgn, lh[1] + 8], [ls[0] - 3.2 * tw * sgn, (ls[1] + lh[1]) / 2], A).slice(0, -1));
  polyCW(p, torso);
  // flared jacket tails from the hips, trailing behind
  if (st.coat) {
    const d0 = st.facing;
    const w0 = st.wind ?? 1;
    const hipC: Pt = [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2];
    const fl = noise1(st.t * 0.07, 61) * 30 * w0;
    polyCW(p, [
      [hipC[0] - 70 * B, hipC[1] - 40],
      [hipC[0] + 70 * B, hipC[1] - 40],
      [hipC[0] + 60 * B - d0 * 40, hipC[1] + 120 + fl * 0.3],
      [hipC[0] - d0 * (200 + fl), hipC[1] + 150 + fl],
      [hipC[0] - d0 * (150 + fl), hipC[1] + 60],
    ]);
  }
  // arms
  capsuleP(p, j.lSh, j.lEl, 22 * B, 18 * B);
  capsuleP(p, j.lEl, j.lHa, 18 * B, 15 * B);
  capsuleP(p, j.rSh, j.rEl, 22 * B, 18 * B);
  capsuleP(p, j.rEl, j.rHa, 18 * B, 15 * B);
  const fr = 26 * (0.6 + 0.4 * B);
  p.moveTo(j.lHa[0] + fr, j.lHa[1]);
  p.arc(j.lHa[0], j.lHa[1], fr, 0, TAU);
  p.moveTo(j.rHa[0] + fr, j.rHa[1]);
  p.arc(j.rHa[0], j.rHa[1], fr, 0, TAU);
  // neck + head
  capsuleP(p, j.chest, j.neck, 26 * B, 20 * B);
  const hd = j.head;
  const hs = 0.8 + 0.2 * B;
  p.moveTo(hd[0] + 46 * hs, hd[1]);
  p.ellipse(hd[0], hd[1], 46 * hs, 54 * hs, 0, 0, TAU);
  // hair
  const d = st.facing;
  const wind = st.wind ?? 1;
  const spikes =
    st.hair === 'spike'
      ? [[-150, 112], [-120, 128], [-95, 118], [-70, 96], [-42, 84], [-15, 62], [170, 70]]
      : [[-170, 150], [-140, 170], [-115, 150], [-90, 120], [-60, 96], [-30, 70], [160, 60]];
  const hair: Pt[] = [[hd[0] + 40 * d, hd[1] - 30]];
  spikes.forEach(([deg, len], i) => {
    const a = ((deg * Math.PI) / 180) * d + (d > 0 ? 0 : Math.PI);
    const flutter = noise1(st.t * 0.08 + i * 1.3, 13) * 0.18 * wind;
    const ax = Math.cos(a + flutter * d);
    const ay = Math.sin(a + flutter * d);
    const bx = hd[0] + ax * 40;
    const by = hd[1] + ay * 44;
    hair.push([bx + ax * len * hs - ay * 8, by + ay * len * hs + ax * 8]);
    const a2 = a + 0.25 * d;
    hair.push([hd[0] + Math.cos(a2) * 44, hd[1] + Math.sin(a2) * 48]);
  });
  hair.push([hd[0] + 46 * d, hd[1] + 6]);
  polyCW(p, hair);
  // ribbon (scarf / headband tails), trailing behind
  if (st.ribbon) {
    const base: Pt = st.ribbon === 'scarf' ? j.neck : [hd[0] - 30 * d, hd[1] - 20];
    const n = 14;
    const L = st.ribbon === 'scarf' ? 330 : 240;
    const top: Pt[] = [];
    const bot: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = base[0] - d * u * L;
      const wav = Math.sin(u * 5.5 - st.t * 0.12) * 34 * u * wind + noise1(st.t * 0.05 + u * 3, 21) * 20 * u;
      const y = base[1] - 10 + u * 40 + wav;
      const w = (st.ribbon === 'scarf' ? 26 : 12) * (1 - u * 0.75);
      top.push([x, y - w]);
      bot.push([x, y + w]);
    }
    polyCW(p, [...top, ...bot.reverse()]);
  }
  return p;
};

/**
 * Cel-shaded silhouette: ink outline, then cream hairline -> rim colour band -> dark base, offset toward `light`.
 */
export const drawFigure = (
  ctx: Ctx,
  path: Path2D,
  o: {rim: string; light: Pt; base?: string; line?: string; lw?: number; rimW?: number; inner?: string; alpha?: number},
) => {
  const base = o.base ?? '#0E0C12';
  const [lx, ly] = o.light;
  const rw = o.rimW ?? 13;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineJoin = 'round';
  ctx.lineWidth = (o.lw ?? 5) * 2;
  ctx.strokeStyle = o.line ?? '#050407';
  ctx.stroke(path);
  ctx.fillStyle = o.inner ?? P.cream;
  ctx.fill(path);
  ctx.clip(path);
  ctx.save();
  ctx.translate(-lx * 3, -ly * 3);
  ctx.fillStyle = o.rim;
  ctx.fill(path);
  ctx.restore();
  ctx.save();
  ctx.translate(-lx * rw, -ly * rw);
  ctx.fillStyle = base;
  ctx.fill(path);
  ctx.restore();
  ctx.restore();
};
