// Offline QA renders: serves the page against the local test tiles and screenshots views.
// Usage: node code/qa_render.js shots.json
//   shots.json: {"base": "http://localhost:8765", "tj": ".../tj_local.json", "dem": ".../terrarium/{z}/{x}/{y}.png",
//                "maplibre": "/path/to/maplibre-gl/dist", "shots": [{"out": "qa/x.png", "w": 1280, "h": 800, "dpr": 1,
//                "lat": 54.5, "lon": -3, "z": 6, "page": "index.html", "clip": "#map"}]}
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  for (const s of cfg.shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w || 1280, height: s.h || 800 }, deviceScaleFactor: s.dpr || 1, colorScheme: s.scheme || 'light' });
    const page = await ctx.newPage();
    await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => {
      const f = path.join(cfg.maplibre, req.url().split('/dist/')[1]);
      route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' });
    });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${s.out}] ${m.type()}: ${m.text().slice(0, 4000)}`); });
    page.on('pageerror', e => errors.push(`[${s.out}] pageerror: ${e.message}`));
    const q = new URLSearchParams({ tj: cfg.tj, dem: cfg.dem, demmax: String(cfg.demMax || 12) });
    if (s.lat !== undefined) q.set('at', `${s.lat},${s.lon},${s.z}`);
    if (s.maponly) q.set('maponly', '1');
    if (s.clean) q.set('clean', '1');
    if (s.wk) q.set('wk', JSON.stringify(s.wk));
    const url = `${cfg.base}/${s.page || 'index.html'}?${q}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__map, null, { timeout: 60000 });
    if (s.scroll) await page.evaluate(sel => document.querySelector(sel).scrollIntoView(), s.scroll);
    await page.evaluate(() => new Promise(res => { const m = window.__map; const done = () => setTimeout(res, 900); if (m.loaded() && m.areTilesLoaded()) m.once('idle', done); else m.once('idle', done); setTimeout(res, 45000); }));
    await page.waitForFunction(() => window.__posterReady !== false, null, { timeout: 600000 });
    if (s.eval) await page.evaluate(s.eval);
    if (s.eval) await page.evaluate(() => new Promise(res => { window.__map.once('idle', () => setTimeout(res, 900)); setTimeout(res, 30000); }));
    if (s.clip) { const bb = await page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, s.clip); await page.screenshot({ path: s.out, clip: bb, timeout: 120000 }); }
    else await page.screenshot({ path: s.out, fullPage: !!s.full, timeout: 180000 });
    if (s.stats) {
      const st = await page.evaluate(() => {
        const m = window.__map, c = { zoom: m.getZoom(), ink_tiles: (window.__inkStats || {}).n, ink_ms_mean: window.__inkStats && window.__inkStats.n ? Math.round(window.__inkStats.ms / window.__inkStats.n) : null, ink_ms_max: window.__inkStats ? Math.round(window.__inkStats.max) : null };
        for (const id of ['relief', 'trees', 'tufts', 'biome', 'countries', 'regions-land', 'regions-world', 'regions-sea', 'seas', 'cities', 'towns', 'villages', 'hamlets', 'peaks', 'river-names']) {
          try { c[id] = m.queryRenderedFeatures({ layers: [id] }).length; } catch (e) { c[id] = null; }
        }
        try { const r = m.queryRenderedFeatures({ layers: ['relief'] }); c.mountains = r.filter(f => f.properties.k === 0).length; c.hills = r.filter(f => f.properties.k === 1).length; } catch (e) {}
        try { const b = m.queryRenderedFeatures({ layers: ['biome'] }); c.biome_by_class = {}; for (const f of b) c.biome_by_class[f.properties.b] = (c.biome_by_class[f.properties.b] || 0) + 1; } catch (e) {}
        return c;
      });
      fs.writeFileSync(s.out.replace(/\.png$/, '') + '.stats.json', JSON.stringify(st));
      console.log(s.out, JSON.stringify(st));
    } else console.log('ok', s.out);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(cfg.errlog || '/dev/stdout', errors.join('\n') + '\n');
})();
