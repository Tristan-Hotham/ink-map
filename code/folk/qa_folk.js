// Offline QA for the hidden folk and the traveller (saved OpenFreeMap and Terrarium tiles; the live servers are blocked here).
// Usage: node code/folk/qa_folk.js shots.json   shots: [{out, w, h, dpr, lat, lon, z, pre (js run before load), eval (js after idle), wait}]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const SCR = process.env.SCR || '/tmp';
const BASE = 'http://127.0.0.1:8791';
const ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
(async () => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], results = {};
  for (const s of cfg.shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w || 1280, height: s.h || 800 }, deviceScaleFactor: s.dpr || 1, hasTouch: !!s.touch, isMobile: !!s.touch });
    const page = await ctx.newPage();
    await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata|open-meteo/, r => r.abort());
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${s.out}] ${m.type()}: ${m.text().slice(0, 500)}`); });
    page.on('pageerror', e => errors.push(`[${s.out}] pageerror: ${e.message}`));
    if (s.pre) await page.addInitScript(s.pre);
    const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12' });
    if (s.lat !== undefined) q.set('at', `${s.lat},${s.lon},${s.z}`);
    if (s.maponly !== false) q.set('maponly', '1');
    const t0 = Date.now();
    await page.goto(`${BASE}${ROOT}/index.html?${q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__map, null, { timeout: 90000 });
    const tMap = Date.now() - t0;
    await page.evaluate(() => new Promise(res => { const m = window.__map; m.once('idle', () => setTimeout(res, 800)); setTimeout(res, 60000); }));
    const tIdle = Date.now() - t0;
    if (s.eval) { const r = await page.evaluate(s.eval); if (r !== undefined) results[s.out] = r; }
    if (s.click) { const pt = await page.evaluate(c => { const p = window.__map.project(c.slice(0, 2)); const r = window.__map.getContainer().getBoundingClientRect(); return [p.x + r.left, p.y + r.top + (c[2] || 0)]; }, s.click); await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(900); }
    if (s.keys) { await page.evaluate(() => window.__map.getCanvas().focus()); for (const [k, ms] of s.keys) { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); } }
    if (s.wait) await page.waitForTimeout(s.wait);
    await page.evaluate(() => new Promise(res => { const m = window.__map; m.once('idle', () => setTimeout(res, 600)); m.triggerRepaint(); setTimeout(res, 20000); }));
    if (s.eval2) { const r = await page.evaluate(s.eval2); if (r !== undefined) results[s.out + ':2'] = r; await page.waitForTimeout(s.wait2 || 800); }
    await page.screenshot({ path: path.join(SCR, s.out), timeout: 120000 });
    results[s.out + ':t'] = { mapMs: tMap, idleMs: tIdle };
    console.log('ok', s.out, JSON.stringify(results[s.out] || ''), tMap, tIdle);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(SCR, 'qa_errors.txt'), errors.join('\n') + '\n');
  fs.writeFileSync(path.join(SCR, 'qa_results.json'), JSON.stringify(results, null, 1));
  console.log('errors', errors.length);
})();
