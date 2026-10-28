// Offline renderer: headless Chromium draws frames, ffmpeg encodes them.
//   node render.js [--scale 1] [--workers 4] [--sub 1] [--from 0] [--to 90] [--out pi.mp4] [--audio pi_audio.wav]
// --scale 2 renders 3840x2160 (4K). --sub N accumulates N sub-frames per frame for motion blur.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const SCALE = +(args.scale || 1), WORKERS = +(args.workers || 4), SUB = +(args.sub || 1);
const FPS = 60, FROM = +(args.from || 0), TO = +(args.to || 90);
const OUT = path.resolve(args.out || 'pi.mp4');
const AUDIO = args.audio ? path.resolve(args.audio) : null;
const TMP = fs.mkdtempSync(path.join(path.dirname(OUT), '.render-'));
const page = 'file://' + path.join(__dirname, 'index.html') + `?render=1&scale=${SCALE}`;

const f0 = Math.round(FROM * FPS), f1 = Math.round(TO * FPS), total = f1 - f0;
let done = 0;
const started = Date.now();

async function worker(w, a, b) {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  p.on('pageerror', (e) => console.error(`[w${w}]`, e.message));
  await p.goto(page);
  await p.evaluate(() => FILM.ready);
  const chunk = path.join(TMP, `chunk_${String(w).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', SCALE > 1 ? '18' : '15', '-pix_fmt', 'yuv420p', '-tune', 'grain', chunk], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    const url = await p.evaluate(([t, s]) => FILM.frame(t, s, 0.96), [f / FPS, SUB]);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 120 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`${done}/${total} frames  ${(done / el).toFixed(1)} fps  eta ${((total - done) / (done / el) / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  return chunk;
}

(async () => {
  const per = Math.ceil(total / WORKERS);
  const chunks = await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w, f0 + w * per, Math.min(f1, f0 + (w + 1) * per))));
  const list = path.join(TMP, 'list.txt');
  fs.writeFileSync(list, chunks.map((c) => `file '${c}'`).join('\n'));
  const mux = ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (AUDIO) mux.push('-ss', String(FROM), '-t', String(TO - FROM), '-i', AUDIO, '-af', 'loudnorm=I=-15:TP=-1.0:LRA=11', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
  mux.push('-c:v', 'copy', '-movflags', '+faststart', '-shortest', OUT);
  execFileSync('ffmpeg', mux, { stdio: 'inherit' });
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`wrote ${OUT} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
})();
