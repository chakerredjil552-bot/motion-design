// Cover still: the bullet-time freeze behind a headline, laid out inside the 1:1 grid crop (y 420-1500).
import {CX, H, M, P, W} from '../lib/core';
import {Ctx, FONT, ctxOf, glow, off, text, withA} from '../lib/draw';
import {LOGO} from '../lib/assets';
import {drawBulletScene} from './bullet';
import {bloom, grain, vignette} from '../lib/post';

export const renderCover = (out: Ctx) => {
  const c = off('cover');
  const x = ctxOf(c);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  drawBulletScene(x, M.contact + 150);
  x.fillStyle = 'rgba(6,5,9,0.55)';
  x.fillRect(0, 0, W, H);
  glow(x, CX, 980, 700, P.orange, 0.18);
  // logo badge, nearest-neighbour x2
  if (LOGO.img) {
    x.save();
    x.imageSmoothingEnabled = false;
    const k = 2;
    x.drawImage(LOGO.img, CX - (LOGO.w * k) / 2, 650 - 186 * k + 40, LOGO.w * k, LOGO.h * k);
    x.restore();
  }
  text(x, 'CLAUDE CODE', CX, 820, {size: 46, family: FONT.mono, weight: 800, color: P.orange, track: 8});
  text(x, 'MADE ITS', CX, 1060, {size: 230, color: P.cream, stroke: '#08070B', lineWidth: 16, track: 4});
  text(x, 'OWN AD.', CX, 1290, {size: 230, color: P.cream, stroke: '#08070B', lineWidth: 16, track: 4});
  text(x, 'every frame is code', CX, 1400, {size: 40, family: FONT.mono, weight: 700, color: withA(P.cream, 0.85)});
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.drawImage(c, 0, 0);
  bloom(out, 0.35);
  grain(out, 7, 0.06);
  vignette(out, 0.5);
};
