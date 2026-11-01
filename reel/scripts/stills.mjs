// Render specific frames to PNG with one bundle + one browser session.
// usage: node scripts/stills.mjs out/stills 882 1000 1029 ...
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const [outDir, ...frames] = process.argv.slice(2);
const browserExecutable = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = process.env.BUNDLE ?? (await bundle({entryPoint: path.resolve('src/index.ts')}));
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: process.env.COMP ?? 'Reel', puppeteerInstance: browser, browserExecutable});
for (const f of frames) {
  const t0 = Date.now();
  const output = path.join(outDir, `f${String(f).padStart(4, '0')}.png`);
  await renderStill({serveUrl, composition, frame: Number(f), output, puppeteerInstance: browser, browserExecutable});
  console.log(output, `${Date.now() - t0} ms`);
}
await browser.close({silent: true});
