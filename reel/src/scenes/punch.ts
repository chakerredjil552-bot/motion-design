import {Ctx, fillBg, text} from '../lib/draw';
export const punchPost = (ctx: Ctx, f: number) => { void ctx; void f; };
export const drawPunch = (ctx: Ctx, t: number, f: number) => {
  fillBg(ctx, '#003');
  text(ctx, 'punch ' + f, 540, 960, {size: 80});
  void t;
};
