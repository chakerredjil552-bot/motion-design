// Scene 2 — the terminal glass cracks, Delaunay shards launch on the kick roll and fly at the camera,
// their back faces reflecting the worlds to come; the world freezes for one silent beat, then BOOM.
import {Delaunay} from 'd3-delaunay';
import {BEATS, E, H, M, P, TAU, TL, W, clamp, rnd, rndr} from '../lib/core';
import {Ctx, ctxOf, glow, off, withA} from '../lib/draw';
import {drawTerminal} from './terminal';
import {WORLDS} from './worlds';
import {drawWorldNested} from './onetake';

const I = {x: 560, y: 1150}; // impact point (where "ignoring warning." sits)
const FOC = 1500;

type Shard = {
  pts: [number, number][]; // source triangle (screen px)
  cx: number;
  cy: number;
  dist: number;
  launch: number; // frame
  vx: number;
  vy: number;
  vz: number;
  az: number;
  axis: [number, number];
  spin: number;
  world: number;
  micro: [number, number];
};

const SHARDS: Shard[] = (() => {
  const pts: [number, number][] = [];
  // dense near the impact, sparse at the edges, plus the frame border so the glass covers the screen
  for (let i = 0; i < 46; i++) {
    const a = rnd(71, i) * TAU;
    const r = Math.pow(rnd(72, i), 0.75) * 1150;
    pts.push([I.x + Math.cos(a) * r * 0.75, I.y + Math.sin(a) * r]);
  }
  for (let i = 0; i <= 4; i++) {
    pts.push([(W * i) / 4, -20], [(W * i) / 4, H + 20]);
  }
  for (let i = 1; i < 7; i++) pts.push([-20, (H * i) / 7], [W + 20, (H * i) / 7]);
  const d = Delaunay.from(pts);
  const kicks = BEATS.events.kick.filter((e) => e.f >= M.burst && e.f < M.freeze).map((e) => e.f);
  const out: Shard[] = [];
  const tri = d.triangles;
  for (let i = 0; i < tri.length; i += 3) {
    const p: [number, number][] = [pts[tri[i]], pts[tri[i + 1]], pts[tri[i + 2]]];
    const cx = (p[0][0] + p[1][0] + p[2][0]) / 3;
    const cy = (p[0][1] + p[1][1] + p[2][1]) / 3;
    const dist = Math.hypot(cx - I.x, cy - I.y);
    out.push({
      pts: p,
      cx,
      cy,
      dist,
      launch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      az: 0,
      axis: [Math.cos(rnd(81, i) * TAU), Math.sin(rnd(81, i) * TAU)],
      spin: rndr(82, i, 0.012, 0.045) * (rnd(83, i) > 0.5 ? 1 : -1),
      world: Math.floor(rnd(84, i) * 8),
      micro: [rndr(85, i, -5, 5), rndr(86, i, -5, 5)],
    });
  }
  // launch order: inner shards on the first kick of the roll, rings outward on the following kicks;
  // the outermost ~30 % stay in the frame until the drop blows them away
  const sorted = [...out].sort((a, b) => a.dist - b.dist);
  const launchN = Math.floor(sorted.length * 0.7);
  sorted.forEach((s, rank) => {
    if (rank < launchN && kicks.length) {
      const k = Math.min(kicks.length - 1, Math.floor((rank / launchN) * kicks.length));
      s.launch = kicks[k];
    } else s.launch = M.drop;
    const dirx = (s.cx - I.x) / (s.dist + 1);
    const diry = (s.cy - I.y) / (s.dist + 1);
    const i = out.indexOf(s);
    // slow enough that the shards still hang in front of the lens when time freezes
    const sp = rndr(87, i, 0.9, 2.6);
    s.vx = dirx * sp + rndr(88, i, -0.5, 0.5);
    s.vy = diry * sp + rndr(89, i, -0.5, 0.5) - 0.4;
    s.vz = -rndr(90, i, 2.2, 4.4);
    s.az = -rndr(91, i, 0.0008, 0.0026);
  });
  return out;
})();

// ------------------------------------------------------------------------------------------ textures (once per tab)
const termTex = () => {
  const c = off('tex-term');
  if (!(c as any)._ok) {
    const x = ctxOf(c);
    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);
    drawTerminal(x, M.crack - 1, M.crack - 1);
    (c as any)._ok = true;
  }
  return c;
};
const worldTex = (i: number) => {
  const c = off(`tex-world-${i}`, W / 2, H / 2);
  if (!(c as any)._ok) {
    const x = ctxOf(c);
    x.save();
    x.scale(0.5, 0.5);
    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);
    drawWorldNested(x, i, TL.portals[i] + 60, 0);
    x.restore();
    (c as any)._ok = true;
  }
  return c;
};

// ------------------------------------------------------------------------------------------ geometry
/** shard world-time: real time until the freeze, crawling during it */
const shardTime = (t: number) => (t < M.freeze ? t : M.freeze + (t - M.freeze) * 0.03);

const norm3 = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const rot3 = (x: number, y: number, ax: [number, number], ang: number): [number, number, number] => {
  // Rodrigues rotation of (x, y, 0) around the in-plane unit axis (ax, ay, 0)
  const [ux, uy] = ax;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const dot = ux * x + uy * y;
  // k x v with k = (ux, uy, 0), v = (x, y, 0) -> (0, 0, ux*y - uy*x)
  const cz = ux * y - uy * x;
  return [x * c + ux * dot * (1 - c), y * c + uy * dot * (1 - c), cz * s];
};

type Proj = {pts: [number, number][]; facing: number; depth: number; visible: boolean; n: [number, number, number]};

/** camera orbit through the frozen shards (yaw about the vertical axis through the impact) */
const camYaw = (t: number) => {
  if (t < M.freeze) return 0.05 * E.inOutCubic(clamp((t - M.burst) / (M.freeze - M.burst)));
  return 0.05 + 0.42 * E.inOutCubic(clamp((t - M.freeze) / (M.drop - M.freeze)));
};

const projectShard = (s: Shard, t: number, blast: number, yaw = camYaw(Math.min(t, M.drop - 0.001))): Proj => {
  const st = shardTime(t);
  const tau = Math.max(0, st - s.launch);
  let px = s.cx;
  let py = s.cy;
  let pz = 0;
  let ang = 0;
  if (tau > 0 || blast > 0) {
    const tb = tau + blast;
    px += s.vx * tb;
    py += s.vy * tb + 0.04 * tb * tb;
    pz = s.vz * tb + s.az * tb * tb - blast * blast * 1.6;
    ang = s.spin * tb * (1 + blast * 0.05);
  }
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const out: [number, number][] = [];
  let dsum = 0;
  for (const [x, y] of s.pts) {
    const [rx, ry, rz] = ang !== 0 ? rot3(x - s.cx, y - s.cy, s.axis, ang) : [x - s.cx, y - s.cy, 0];
    // world point, then the orbiting camera
    const wx = px + rx - I.x;
    const wz = pz + rz;
    const cx = wx * cy - wz * sy + I.x;
    const cz = wx * sy + wz * cy;
    const depth = FOC + cz;
    if (depth < 120) return {pts: [], facing: 1, depth, visible: false, n: [0, 0, 1]};
    dsum += depth;
    const kk = FOC / Math.max(60, depth);
    out.push([W / 2 + (cx - W / 2) * kk, H / 2 + (py + ry - H / 2) * kk]);
  }
  // normal = (0,0,1) rotated about the in-plane axis, then the camera yaw
  const [ux, uy] = s.axis;
  const n0: [number, number, number] = ang !== 0 ? [uy * Math.sin(ang), -ux * Math.sin(ang), Math.cos(ang)] : [0, 0, 1];
  const n: [number, number, number] = [n0[0] * cy - n0[2] * sy, n0[1], n0[0] * sy + n0[2] * cy];
  return {pts: out, facing: n[2], depth: dsum / 3, visible: true, n};
};

/** draw the source triangle of `tex` (scaled by texScale) onto the destination triangle */
const texTri = (ctx: Ctx, tex: HTMLCanvasElement, src: [number, number][], dst: [number, number][], texScale: number) => {
  const [s0, s1, s2] = src.map(([x, y]) => [x * texScale, y * texScale]);
  const [d0, d1, d2] = dst;
  const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
  if (Math.abs(den) < 1e-6) return;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
  const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
  const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
  const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
  const e = d0[0] - a * s0[0] - c * s0[1];
  const f = d0[1] - b * s0[0] - d * s0[1];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0[0], d0[1]);
  ctx.lineTo(d1[0], d1[1]);
  ctx.lineTo(d2[0], d2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(tex, 0, 0);
  ctx.restore();
};

// ------------------------------------------------------------------------------------------ cracks
const CRACKS = (() => {
  const lines: {pts: [number, number][]; wave: number}[] = [];
  for (let b = 0; b < 14; b++) {
    let a = (b / 14) * TAU + rndr(101, b, -0.15, 0.15);
    let x = I.x;
    let y = I.y;
    const pts: [number, number][] = [[x, y]];
    const steps = 9 + Math.floor(rnd(102, b) * 6);
    for (let s = 0; s < steps; s++) {
      const len = rndr(103, b * 31 + s, 50, 150);
      a += rndr(104, b * 31 + s, -0.35, 0.35);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len * 1.2;
      pts.push([x, y]);
    }
    lines.push({pts, wave: b % 3 === 0 ? 1 : 0});
  }
  return lines;
})();

const drawCracks = (ctx: Ctx, t: number) => {
  for (const c of CRACKS) {
    const start = c.wave ? M.crack2 : M.crack;
    const k = E.outExpo(clamp((t - start) / 22));
    if (k <= 0) continue;
    const n = c.pts.length - 1;
    const upto = k * n;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const [lw, col] of [
      [9, withA(P.neon, 0.25)],
      [3, withA(P.cream, 0.95)],
    ] as const) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(c.pts[0][0], c.pts[0][1]);
      for (let i = 1; i <= Math.ceil(upto); i++) {
        const fr = Math.min(1, upto - (i - 1));
        const [x0, y0] = c.pts[i - 1];
        const [x1, y1] = c.pts[i];
        ctx.lineTo(x0 + (x1 - x0) * fr, y0 + (y1 - y0) * fr);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // spider-web rings near the impact
  const kw = E.outExpo(clamp((t - M.crack) / 14));
  if (kw > 0) {
    ctx.save();
    ctx.strokeStyle = withA(P.cream, 0.6);
    ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      const rad = (40 + r * 55) * kw;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * TAU;
        const rr = rad * (0.85 + 0.3 * rnd(120 + r, i % 14));
        const x = I.x + Math.cos(a) * rr;
        const y = I.y + Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, I.x, I.y, 260 * kw, P.cream, 0.35 * (1 - clamp((t - M.crack) / 60)));
  }
};

// ------------------------------------------------------------------------------------------ draw
const drawShards = (ctx: Ctx, t: number, blast: number) => {
  const tex = termTex();
  const yaw = blast > 0 ? 0 : camYaw(Math.min(t, M.drop - 0.001));
  const list = SHARDS.map((s) => ({s, p: projectShard(s, t, blast, yaw)})).filter((o) => o.p.visible);
  // far to near
  list.sort((a, b) => b.p.depth - a.p.depth);
  const cracked = t >= M.crack;
  for (const {s, p} of list) {
    const flown = shardTime(t) > s.launch || blast > 0;
    let dst = p.pts;
    if (!flown && cracked) {
      // micro displacement along the fracture once cracked
      const k = E.outCubic(clamp((t - M.crack - s.dist / 45) / 20)) * (t >= M.crack2 ? 1.6 : 1);
      dst = p.pts.map(([x, y]) => [x + s.micro[0] * k, y + s.micro[1] * k] as [number, number]);
    }
    if (p.facing >= 0) {
      texTri(ctx, tex, s.pts, dst, 1);
    } else {
      texTri(ctx, worldTex(WORLDS.length > s.world ? s.world : 0), s.pts, dst, 0.5);
    }
    // glass lighting: two-sided diffuse, a specular glint sweeping with the light, bright bevel when edge-on
    const sweep = clamp((t - M.burst) / (M.drop - M.burst));
    const L = norm3([-0.5 + 1.1 * sweep, -0.7, 0.55]);
    const nn = p.facing >= 0 ? p.n : ([-p.n[0], -p.n[1], -p.n[2]] as [number, number, number]);
    const diff = Math.max(0, nn[0] * L[0] + nn[1] * L[1] + nn[2] * L[2]);
    const Hh = norm3([L[0], L[1], L[2] + 1]);
    const spec = 1.15 * Math.pow(Math.max(0, nn[0] * Hh[0] + nn[1] * Hh[1] + nn[2] * Hh[2]), 14);
    const shade = Math.abs(p.facing);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dst[0][0], dst[0][1]);
    ctx.lineTo(dst[1][0], dst[1][1]);
    ctx.lineTo(dst[2][0], dst[2][1]);
    ctx.closePath();
    if (flown) {
      ctx.fillStyle = withA(p.facing >= 0 ? '#9FE9F0' : '#FFD9C7', 0.06 + 0.16 * (1 - shade));
      ctx.fill();
      ctx.fillStyle = `rgba(0,0,0,${0.42 * (1 - diff)})`;
      ctx.fill();
      if (spec > 0.02) {
        const gx0 = Math.min(dst[0][0], dst[1][0], dst[2][0]);
        const gx1 = Math.max(dst[0][0], dst[1][0], dst[2][0]);
        const gy0 = Math.min(dst[0][1], dst[1][1], dst[2][1]);
        const gy1 = Math.max(dst[0][1], dst[1][1], dst[2][1]);
        const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(255,255,255,${Math.min(0.95, spec)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fill();
      }
    }
    // fracture edges appear as the crack front passes them
    const front = E.outExpo(clamp((t - M.crack - s.dist / 45) / 18));
    ctx.lineWidth = flown ? 2 + 5 * (1 - shade) : 1.2;
    ctx.strokeStyle = flown ? withA(spec > 0.3 ? '#FFFFFF' : '#CFFBFF', 0.5 + 0.45 * (1 - shade) + 0.3 * spec) : withA(P.cream, 0.22 * front);
    ctx.stroke();
    ctx.restore();
  }
};

export const drawShatter = (ctx: Ctx, t: number, f: number) => {
  // behind the glass: the first world, waiting
  ctx.save();
  drawWorldNested(ctx, 0, Math.min(t, M.drop - 1), 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);
  drawShards(ctx, t, 0);
  if (t < M.burst + 30) drawCracks(ctx, t);
  // freeze: cold tint
  if (t >= M.freeze) {
    ctx.fillStyle = withA(P.neonDk, 0.12);
    ctx.fillRect(0, 0, W, H);
  }
  void f;
};

/** on the drop, every shard still in the air blasts past the lens over the first world */
export const drawShardBlast = (ctx: Ctx, t: number) => {
  const blast = Math.max(0, t - M.drop) * 2.2;
  if (blast > 70) return;
  drawShards(ctx, M.freeze + (M.drop - M.freeze), blast);
};
