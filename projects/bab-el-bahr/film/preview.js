// node preview.js outdir t1 t2 ... : render stills for inspection
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await p.goto('file://' + path.join(__dirname, 'scene.html'));
  for (const t of ts) {
    const t0 = Date.now(); await p.evaluate(x => renderFrame(x), +t);
    await p.screenshot({ path: `${out}/f_${t}.jpg`, type: 'jpeg', quality: 85 });
    console.log(t, Date.now() - t0, 'ms');
  }
  await b.close();
})();
