// Time renderFrames over a frame range with a given GL backend (no encoding), to pick the fastest setup.
import {openBrowser, renderFrames, selectComposition} from '@remotion/renderer';
const [serveUrl, gl, first, last, conc] = process.argv.slice(2);
const browserExecutable = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = gl === 'default' ? {} : {gl};
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const composition = await selectComposition({serveUrl, id: 'Reel', puppeteerInstance: browser, browserExecutable, chromiumOptions});
const t0 = Date.now();
await renderFrames({
  serveUrl, composition, puppeteerInstance: browser, browserExecutable, chromiumOptions,
  frameRange: [Number(first), Number(last)], imageFormat: 'jpeg', jpegQuality: 96,
  outputDir: process.env.BENCH_DIR ?? '/tmp/bench-frames',
  concurrency: Number(conc), onStart: () => {}, onFrameUpdate: () => {}, inputProps: {},
});
const n = Number(last) - Number(first) + 1;
console.log(`${gl}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${((Date.now() - t0) / n).toFixed(0)} ms/frame (conc ${conc})`);
await browser.close({silent: true});
