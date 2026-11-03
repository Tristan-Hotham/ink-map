// Jump timings on the saved tiles (round 4): load at Great Britain, let it settle, then jump straight to a view and time
// how long the map takes to go idle; also cold loads of the world view. Main-thread long tasks and worker time are reported.
// node code/qa_jump.js <label> [runs]   env: SCR, MAPLIBRE_DIST, BASE, ROOT (as code/qa_perf.js); CASES (comma list);
//   LAT (ms added to every local request, as a network round trip); PROF=1 (worker stage times)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const LABEL = process.argv[2] || 'run', RUNS = +(process.argv[3] || 3);
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..'));
const SCR = process.env.SCR || '/tmp', BASE = process.env.BASE || 'http://127.0.0.1:8791';
const ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
const CASES = (process.env.CASES || 'cold_world,jump_lakes155,jump_world,jump_keswick13').split(',');
const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  for (const name of CASES) {
    const runs = [];
    for (let rep = 0; rep < RUNS; rep++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', e => errs.push(e.message));
      await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
      await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
      // LAT=ms: a network round trip added to every request to the local server (tiles, elevation, data), as on a real connection
      if (+process.env.LAT) await page.context().route(/127\.0\.0\.1/, async r => { await new Promise(res => setTimeout(res, +process.env.LAT)); r.continue(); });
      await page.addInitScript(() => { window.__lt = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt += e.duration; }).observe({ entryTypes: ['longtask'] }); } catch (e) {} });
      const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12', maponly: '1' });
      if (process.env.PROF) q.set('wk', JSON.stringify({ prof: 1 }));
      if (process.env.NOPRE) q.set('noprewarm', '1');
      const cold = name.startsWith('cold_');
      if (name === 'cold_world') q.set('at', '25,10,1.6');
      await page.goto(`${BASE}${ROOT}/index.html?${q}`);
      await page.waitForFunction(() => window.__map, null, { timeout: 120000 });
      const idle = () => page.evaluate(() => new Promise(res => { const m = window.__map; const t0 = performance.now(); const done = () => res(performance.now()); if (m.loaded() && m.areTilesLoaded()) setTimeout(() => { if (m.loaded() && m.areTilesLoaded()) done(); else m.once('idle', done); }, 50); else m.once('idle', done); setTimeout(() => res(null), 120000); }));
      let r;
      if (cold) {
        const t = await idle(); r = { t: Math.round(t), lt: Math.round(await page.evaluate(() => window.__lt)) };
        // filled in fully: the deferred modules (the sea, the folk) have arrived and the map has gone idle again after them
        await page.waitForFunction(() => window.InkSea && window.InkFolk, null, { timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(1500); const t2 = await idle(); r.full = Math.round(t2); r.ltFull = Math.round(await page.evaluate(() => window.__lt));
      }
      else {
        await idle(); await page.waitForTimeout(7000); await idle();   // the deferred extras land, then the map settles
        const at = { jump_lakes155: [-3.0244, 54.4588, 15.5], jump_world: [10, 25, 1.6], jump_keswick13: [-3.134, 54.6006, 12.9] }[name];
        const r0 = await page.evaluate(at => { window.__lt = 0; window.__w0 = JSON.parse(JSON.stringify(window.__inkStats)); window.__t0 = performance.now(); window.__map.jumpTo({ center: [at[0], at[1]], zoom: at[2] }); return 0; }, at);
        const t = await idle();
        r = await page.evaluate(t => {
          const S = window.__inkStats, o = { t: Math.round(t - window.__t0), lt: Math.round(window.__lt), wn: S.n - window.__w0.n, wms: Math.round(S.ms - window.__w0.ms) };
          if (S.prof) { const sum = P => { const a = {}; for (const w of Object.values(P || {})) for (const [k, v] of Object.entries(w)) a[k] = (a[k] || 0) + v; return a; }; const A = sum(S.prof), B = sum(window.__w0.prof); for (const k in A) o['p_' + k] = Math.round(A[k] - (B[k] || 0)); }
          return o; }, t);
      }
      r.errs = errs.length; runs.push(r);
      if (errs.length && rep === 0) console.log('  errors:', errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    const m = {}; for (const k of Object.keys(runs[0])) m[k] = med(runs.map(x => x[k]));
    out[name] = { median: m, runs }; console.log(LABEL, name, JSON.stringify(m));
  }
  fs.writeFileSync(path.join(SCR, `jump_${LABEL}.json`), JSON.stringify(out, null, 1));
  await browser.close();
})();
