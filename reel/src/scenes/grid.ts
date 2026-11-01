import {Ctx, fillBg, text} from '../lib/draw';
export const drawGrid = (ctx: Ctx, t: number, f: number) => {
  fillBg(ctx, '#222');
  text(ctx, 'grid ' + f, 540, 960, {size: 80});
  void t;
};
