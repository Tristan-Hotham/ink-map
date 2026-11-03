// Load time and panning frame rate on the offline tiles (software renderer), three runs per view, medians reported.
// node code/qa_perf.js <label> [runs] [views,comma,separated]
//   env: SCR (scratch folder holding tj12.json), MAPLIBRE_DIST, BASE (http server serving / on 127.0.0.1:8791), ROOT (checkout),
//        EXTRA (more page parameters, such as noclouds=1)
// First meaningful paint (fmp): the base map (OpenFreeMap) and ink tiles for the view are loaded and a frame has been drawn.
// First idle: MapLibre's first 'idle' event (every source loaded, every fade done).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const LABEL = process.argv[2] || 'run', RUNS = +(process.argv[3] || 3);
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..'));
const SCR = process.env.SCR || '/tmp', BASE = process.env.BASE || 'http://127.0.0.1:8791';
const ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
const ALL = { world: '25,10,1.6', europe: '52,10,3.8', gb: null, lakes12: '54.50,-3.10,12', lakes15: '54.4521,-3.2072,15' };
// dense cities (round 7): only when named, and only with saved tiles to zoom 14 there (a tilejson with maxzoom 14 in SCR)
const MORE = { kyoto13: '35.0036,135.7681,13.5', kyoto15: '35.0036,135.7681,15.3', paris14: '48.8566,2.3522,14.2' };
const VIEWS = (process.argv[4] ? process.argv[4].split(',') : Object.keys(ALL)).map(k => [k, k in ALL ? ALL[k] : MORE[k]]);
const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  for (const [name, at] of VIEWS) {
    const runs = [];
    for (let rep = 0; rep < RUNS; rep++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
      let bytes = 0, nreq = 0, dataBytes = 0;
      page.on('response', async r => { try { const h = await r.allHeaders(); const b = +(h['content-length'] || 0); bytes += b; nreq++; if (/\/data\//.test(r.url())) dataBytes += b; } catch (e) {} });
      await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
      await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
      await page.addInitScript(() => {
        window.__perf = {};
        const t = setInterval(() => {
          const m = window.__map; if (!m || window.__perf.fmp) return;
          try { if (m.isSourceLoaded('ofm') && (!m.getSource('ink') || m.isSourceLoaded('ink'))) { m.once('render', () => { window.__perf.fmp = window.__perf.fmp || performance.now(); }); m.triggerRepaint(); } } catch (e) {}
        }, 40);
      });
      const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12', maponly: '1' });
      if (at) q.set('at', at);
      if (process.env.SEAOFF) q.set('seaoff', process.env.SEAOFF);
      if (process.env.EXTRA) for (const [k, v] of new URLSearchParams(process.env.EXTRA)) q.set(k, v);   // e.g. EXTRA=noclouds=1
      await page.goto(`${BASE}${ROOT}/index.html?${q}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__map, null, { timeout: 120000 });
      const tMap = await page.evaluate(() => performance.now());
      const tIdle = await page.evaluate(() => new Promise(res => { const m = window.__map; if (m.loaded() && m.areTilesLoaded()) res(performance.now()); m.once('idle', () => res(performance.now())); setTimeout(() => res(null), 90000); }));
      const tFmp = await page.evaluate(() => new Promise(res => { const k = () => window.__perf.fmp ? res(window.__perf.fmp) : setTimeout(k, 50); k(); setTimeout(() => res(null), 5000); }));
      // the extras deferred past the first idle (history cells, the folk scripts, the overlay) load next: pan once the map
      // has settled again, so the frame rate measures panning, not the tail of the load (the same rule for every checkout)
      await page.waitForTimeout(6000);
      await page.evaluate(() => new Promise(res => { const m = window.__map; if (m.loaded() && m.areTilesLoaded()) res(); else m.once('idle', res); setTimeout(res, 30000); }));
      await page.waitForTimeout(2000);
      const fps = await page.evaluate(() => new Promise(res => {
        const m = window.__map; let n = 0, t0 = performance.now(), on = true;
        const f = () => { n++; if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
        let k = 0; const step = () => { if (k++ < 12) { m.panBy([60, 25], { duration: 250 }); setTimeout(step, 260); } else { on = false; res(n / ((performance.now() - t0) / 1000)); } }; step();
      }));
      const info = await page.evaluate(() => ({ layers: window.__map.getStyle().layers.length, images: window.__map.listImages().length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }));
      runs.push({ tMap: Math.round(tMap), tFmp: tFmp && Math.round(tFmp), tIdle: tIdle && Math.round(tIdle), fps: Math.round(fps * 10) / 10, kB: Math.round(bytes / 1024), dataKB: Math.round(dataBytes / 1024), nreq, ...info, errs: errs.length });
      if (errs.length && rep === 0) console.log('  errors:', errs.slice(0, 5).join(' | '));
      await ctx.close();
    }
    const m = {}; for (const k of Object.keys(runs[0])) m[k] = med(runs.map(r => r[k]));
    out[name] = { median: m, runs };
    console.log(LABEL, name, JSON.stringify(m));
  }
  fs.writeFileSync(path.join(SCR, `perf_${LABEL}.json`), JSON.stringify(out, null, 1));
  await browser.close();
})();
