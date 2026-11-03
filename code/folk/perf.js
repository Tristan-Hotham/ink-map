// Load time and panning frame rate, before (baseline checkout) and after (this branch), on the offline tiles.
// node code/folk/perf.js <root-of-checkout> <label>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2]), LABEL = process.argv[3], SCR = process.env.SCR || '/tmp';
const BASE = 'http://127.0.0.1:8791', ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
const VIEWS = [['gb_default', null], ['lakes_z15', '54.4521,-3.2072,15.5'], ['lakes_z12', '54.50,-3.10,12']];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  for (const [name, at] of VIEWS) {
    const runs = [];
    for (let rep = 0; rep < 2; rep++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      let bytes = 0; page.on('response', async r => { try { const h = await r.allHeaders(); bytes += +(h['content-length'] || 0); } catch (e) {} });
      await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
      await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
      const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12', maponly: '1' });
      if (at) q.set('at', at);
      const t0 = Date.now();
      await page.goto(`${BASE}${ROOT}/index.html?${q}`, { waitUntil: 'load' });
      const tLoad = Date.now() - t0;
      await page.waitForFunction(() => window.__map, null, { timeout: 90000 });
      const tMap = Date.now() - t0;
      await page.evaluate(() => new Promise(res => { window.__map.once('idle', res); setTimeout(res, 60000); }));
      const tIdle = Date.now() - t0;
      await page.waitForTimeout(5000);   // the folk list loads a few seconds after the first idle
      const fps = await page.evaluate(() => new Promise(res => {
        const m = window.__map; let n = 0, t0 = performance.now(), on = true;
        const f = () => { n++; if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
        let k = 0; const step = () => { if (k++ < 12) { m.panBy([60, 25], { duration: 250 }); setTimeout(step, 260); } else { on = false; res(n / ((performance.now() - t0) / 1000)); } }; step();
      }));
      const heap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null);
      runs.push({ tLoad, tMap, tIdle, fps: Math.round(fps * 10) / 10, heapMB: heap, bytes });
      await ctx.close();
    }
    out[name] = runs;
    console.log(LABEL, name, JSON.stringify(runs));
  }
  fs.writeFileSync(path.join(SCR, `perf_${LABEL}.json`), JSON.stringify(out, null, 1));
  await browser.close();
})();
