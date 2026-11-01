import {Ctx, fillBg, text} from '../lib/draw';
export const drawShatter = (ctx: Ctx, t: number, f: number) => {
  fillBg(ctx, '#222');
  text(ctx, 'shatter ' + f, 540, 960, {size: 80});
  void t;
};
export const drawShardBlast = (ctx: Ctx, t: number) => { void ctx; void t; };
