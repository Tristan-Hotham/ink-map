// Round 4 QA on the saved tiles: screenshots of fixed views and what each layer shows there.
// node code/qa_round4.js <out dir> <name=lat,lon,zoom[,w,h]> ...   env: SCR (folder with tj12.json), MAPLIBRE_DIST, BASE, ROOT, EVAL (js run per view)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..'));
const SCR = process.env.SCR || '/tmp', BASE = process.env.BASE || 'http://127.0.0.1:8791';
const ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const views = process.argv.slice(3).map(a => { const [n, v] = a.split('='); const p = v.split(',').map(Number); return { n, lat: p[0], lon: p[1], z: p[2], w: p[3] || 1280, h: p[4] || 800 }; });
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const v of views) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
    if (process.env.STORAGE) await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, JSON.parse(process.env.STORAGE));
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/404|ERR_FAILED|ERR_CONNECTION|net::/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
    const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12', maponly: '1', at: `${v.lat},${v.lon},${v.z}` });
    if (process.env.CLEAN) q.set('clean', '1');
    if (process.env.WK) q.set('wk', process.env.WK);   // worker settings, e.g. {"houseStyle":"jp"} to draw a town in one region's style
    const t0 = Date.now();
    await page.goto(`${BASE}${ROOT}/index.html?${q}`);
    await page.waitForFunction(() => window.__map, null, { timeout: 120000 });
    await page.evaluate(() => new Promise(r => { const m = window.__map; if (m.loaded() && m.areTilesLoaded()) r(); m.once('idle', r); setTimeout(r, 90000); }));
    const tIdle = Date.now() - t0;
    await page.waitForTimeout(+(process.env.WAIT || 3000));
    await page.evaluate(() => new Promise(r => { const m = window.__map; m.once('idle', r); m.triggerRepaint(); setTimeout(r, 30000); }));
    await page.screenshot({ path: path.join(out, v.n + '.png') });
    const info = await page.evaluate(async (ev) => {
      const m = window.__map, o = { zoom: +m.getZoom().toFixed(2) };
      const ids = ['countries', 'country-uk', 'nations', 'nations-pt', 'regions-sea-pt', 'regions-sea', 'lake-names-ink', 'lake-names-ink-pt', 'lake-names-ink-l', 'lake-names', 'lake-names-l', 'villages', 'xplaces', 'world-ranges', 'town', 'landmarks', 'landmarks-near', 'landmark-names'];
      for (const id of ids) { if (!m.getLayer(id)) continue; const fs = m.queryRenderedFeatures({ layers: [id] }); const names = [...new Set(fs.map(f => f.properties.name || f.properties.n || f.properties.t || '').filter(Boolean))]; o[id] = fs.length + (names.length < 25 ? ' ' + names.join('|') : ''); }
      if (ev) try { o.ev = await eval(ev); } catch (e) { o.ev = 'ERR ' + e.message; }
      return o;
    }, process.env.EVAL || '');
    console.log(v.n, 'idle', tIdle, 'ms', JSON.stringify(info), errs.length ? 'ERRS ' + errs.slice(0, 3).join(' | ') : '');
    await ctx.close();
  }
  await browser.close();
})();
