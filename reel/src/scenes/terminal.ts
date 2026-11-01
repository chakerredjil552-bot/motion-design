// Scene 1 (terminal), scene 7 (closing line) and the shared terminal renderer.
import {CX, E, FPB, H, M, P, TL, W, clamp, envAt, hits, invLerp, ring, rnd, spring} from '../lib/core';
import {Ctx, FONT, fillBg, font, glow, roundRect, text, withA} from '../lib/draw';

const WIN = {x: 70, y: 420, w: 940, h: 1010};
const PAD = 58;
const MONO = 44;

const cursorOn = (t: number) => (t / FPB) % 1 < 0.55;

const warnIcon = (ctx: Ctx, x: number, y: number, s: number, color: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.55);
  ctx.lineTo(s * 0.55, s * 0.42);
  ctx.lineTo(-s * 0.55, s * 0.42);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.1;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(-s * 0.045, -s * 0.22, s * 0.09, s * 0.36);
  ctx.fillRect(-s * 0.05, s * 0.2, s * 0.1, s * 0.1);
  ctx.restore();
};

/** wraps words to width; returns lines */
export const wrap = (ctx: Ctx, s: string, maxW: number, size: number, family = FONT.mono, weight = 400) => {
  font(ctx, size, family, weight);
  (ctx as any).letterSpacing = '0px';
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
};

export const drawWindowChrome = (ctx: Ctx, t: number, glowAmt: number) => {
  // CRT glow behind
  glow(ctx, CX, WIN.y + WIN.h / 2, 900, P.orange, 0.1 + 0.12 * glowAmt);
  ctx.save();
  roundRect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, 30);
  const g = ctx.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h);
  g.addColorStop(0, '#15131A');
  g.addColorStop(1, '#0C0B10');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = withA(P.cream, 0.16);
  ctx.stroke();
  // title bar
  ctx.beginPath();
  ctx.roundRect(WIN.x, WIN.y, WIN.w, 74, [30, 30, 0, 0]);
  ctx.fillStyle = '#1B1820';
  ctx.fill();
  const dots = [P.orange, P.creamDk, P.neonDk];
  dots.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(WIN.x + 44 + i * 36, WIN.y + 37, 10, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  text(ctx, '~/ad — claude', CX, WIN.y + 48, {size: 26, family: FONT.mono, color: withA(P.cream, 0.55)});
  ctx.restore();
};

const typed = (list: {ch: string; f: number}[], t: number) => {
  let s = '';
  let lastF = -1e9;
  for (const k of list) {
    if (k.f <= t) {
      s += k.ch;
      lastF = k.f;
    }
  }
  return {s, lastF, done: list.length > 0 && t >= list[list.length - 1].f};
};

/** Scene 1 — the terminal; also used (frozen) as the shard texture in scene 2 */
export const drawTerminal = (ctx: Ctx, t: number, f: number) => {
  fillBg(ctx, P.bg);
  const h = hits(f, 0.35);
  const env = envAt('full', f);
  // bulge toward camera at the end (anticipation of the crack)
  const bulge = E.inCubic(invLerp(M.ignoring + 20, M.crack, t)) * 0.05;
  ctx.save();
  ctx.translate(CX, H / 2);
  ctx.scale(1 + bulge, 1 + bulge);
  ctx.translate(-CX, -H / 2);
  drawWindowChrome(ctx, t, env);

  const x0 = WIN.x + PAD;
  let y = WIN.y + 190;
  // prompt line
  const pr = typed(TL.typing.prompt, t);
  text(ctx, '>', x0, y, {size: MONO, family: FONT.mono, weight: 700, color: P.orange, align: 'left'});
  font(ctx, MONO, FONT.mono, 400);
  const pre = ctx.measureText('> ').width;
  // per-character pop on 2s
  let cx = x0 + pre;
  for (let i = 0; i < pr.s.length; i++) {
    const k = TL.typing.prompt[i];
    const age = t - k.f;
    const sc = 1 + 0.35 * Math.max(0, 1 - age / 6);
    ctx.save();
    font(ctx, MONO, FONT.mono, 400);
    const cw = ctx.measureText(pr.s[i]).width;
    ctx.translate(cx + cw / 2, y - MONO * 0.35);
    ctx.scale(sc, sc);
    ctx.fillStyle = P.cream;
    ctx.textAlign = 'center';
    ctx.fillText(pr.s[i], 0, MONO * 0.35);
    ctx.restore();
    cx += cw;
  }
  const replyOn = t >= M.reply;
  if (!replyOn && (cursorOn(t) || t - pr.lastF < 12)) {
    ctx.fillStyle = P.orange;
    ctx.fillRect(cx + 4, y - MONO * 0.8, MONO * 0.55, MONO * 0.95);
  }

  // reply: "say less." slams, bounces on the cowbell
  y += 128;
  if (replyOn) {
    const a = t - M.reply;
    const s = spring(a, 3.2, 0.32, 40);
    const sc = 1.9 - 0.9 * s + 0.06 * h.bounce / 0.35;
    ctx.save();
    ctx.translate(x0, y);
    ctx.scale(sc, sc);
    ctx.rotate(-0.06 * (1 - s));
    text(ctx, TL.copy.reply, 0, 0, {size: 78, family: FONT.mono, weight: 800, color: P.orange, align: 'left'});
    ctx.restore();
  }

  // warning box
  y += 70;
  if (t >= M.warning) {
    const a = t - M.warning;
    const pop = E.outBack(clamp(a / 10), 2.4);
    const af = f - M.warning; // discrete jitter keys off the integer frame (no sub-frame ghosting)
    const jitter = af >= 0 && af < 14 && af % 2 === 0 ? (rnd(af, 3) - 0.5) * 18 : 0;
    const bx = x0 - 10 + jitter;
    const bw = WIN.w - PAD * 2 + 20;
    const bh = 250;
    ctx.save();
    ctx.translate(bx + bw / 2, y + bh / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(bx + bw / 2), -(y + bh / 2));
    const blink = Math.floor(a / 8) % 2 === 0 || a > 40;
    roundRect(ctx, bx, y, bw, bh, 16);
    ctx.fillStyle = withA(P.orange, blink ? 0.13 : 0.06);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = P.orange;
    ctx.setLineDash([22, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
    warnIcon(ctx, bx + 62, y + 66, 64, P.orange);
    text(ctx, 'WARNING', bx + 112, y + 88, {size: 62, color: P.orange, align: 'left', track: 4});
    const lines = wrap(ctx, TL.copy.warning, bw - 70, 38, FONT.mono);
    lines.forEach((ln, i) =>
      text(ctx, ln, bx + 34, y + 150 + i * 52, {size: 38, family: FONT.mono, color: P.cream, align: 'left'}),
    );
    // struck out once it's ignored
    if (t >= M.ignoring + 18) {
      const k = E.outExpo(clamp((t - M.ignoring - 18) / 8));
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = P.cream;
      ctx.beginPath();
      ctx.moveTo(bx + 20, y + bh - 30);
      ctx.lineTo(bx + 20 + (bw - 40) * k, y + bh - 30 - (bh - 60) * k);
      ctx.stroke();
    }
    ctx.restore();
  }

  // AI streams its answer
  y += 360;
  const st = TL.stream.ignoring.filter((c) => c.f <= t).map((c) => c.t).join('');
  if (st) {
    text(ctx, st, x0, y, {size: 58, family: FONT.mono, weight: 800, color: P.cream, align: 'left'});
    if (cursorOn(t)) {
      font(ctx, 58, FONT.mono, 800);
      const w = ctx.measureText(st).width;
      ctx.fillStyle = P.orange;
      ctx.fillRect(x0 + w + 8, y - 48, 30, 56);
    }
  }
  ctx.restore();
};

/** Scene 7 — the closing line, typed with key clicks */
export const drawClosing = (ctx: Ctx, t: number, f: number) => {
  fillBg(ctx, '#050406');
  const a = invLerp(M.closing, M.closing + 20, t);
  glow(ctx, CX, 980, 760, P.orange, 0.07 * a);
  const size = 64;
  const x0 = 96;
  const tp = typed(TL.typing.closing, t);
  // lay out the full sentence once so the wrap never jumps while typing
  const lines = wrap(ctx, TL.copy.closing, W - x0 * 2, size, FONT.mono, 700);
  const lh = 92;
  const y0 = 900 - ((lines.length - 1) * lh) / 2;
  text(ctx, '~ claude', x0, y0 - 130, {size: 30, family: FONT.mono, color: withA(P.orange, 0.85 * a), align: 'left'});
  let remaining = tp.s.length;
  let lastX = x0;
  let lastY = y0;
  lines.forEach((ln, i) => {
    const shown = ln.slice(0, Math.max(0, remaining));
    remaining -= ln.length + 1;
    const yy = y0 + i * lh;
    if (shown) {
      text(ctx, shown, x0, yy, {size, family: FONT.mono, weight: 700, color: P.cream, align: 'left'});
      font(ctx, size, FONT.mono, 700);
      lastX = x0 + ctx.measureText(shown).width;
      lastY = yy;
    }
  });
  const sinceKey = t - tp.lastF;
  if (cursorOn(t) || sinceKey < 10) {
    ctx.fillStyle = P.orange;
    ctx.fillRect(lastX + 8, lastY - size * 0.78, size * 0.55, size * 0.95);
  }
  // little key-press bounce of the whole line
  void ring(sinceKey, 4, 0.1);
};
