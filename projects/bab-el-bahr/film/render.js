// node render.js out.mp4 : renders all 1200 frames (20 s x 60 fps) and pipes them to ffmpeg
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const FPS = 60, DUR = 20, N = FPS * DUR;
(async () => {
  const out = process.argv[2];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    // film grain + subtle chromatic aberration + vignette
    '-vf', 'rgbashift=rh=-2:bh=2,noise=alls=6:allf=t,vignette=PI/6,format=yuv420p',
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await p.goto('file://' + path.join(__dirname, 'scene.html'));
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    await p.evaluate(x => renderFrame(x), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0), 's');
})();
