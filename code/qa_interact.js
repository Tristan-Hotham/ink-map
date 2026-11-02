// Interaction QA against the offline tiles: search, popups, layer toggles, full screen.
// Usage: node code/qa_interact.js <shots.json written by 03_renders.py> <out dir>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), out = process.argv[3];
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true })).newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/404|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror ' + e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => {
    const f = path.join(cfg.maplibre, req.url().split('/dist/')[1]);
    route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const q = new URLSearchParams({ tj: cfg.tj, dem: cfg.dem, demmax: '12', maponly: '1', at: '54.47,-3.05,9.6' });
  await page.goto(`${cfg.base}/index.html?${q}`);
  await page.waitForFunction(() => window.__map);
  const idle = () => page.evaluate(() => new Promise(r => { window.__map.once('idle', () => setTimeout(r, 600)); setTimeout(r, 60000); }));
  await idle();
  const log = {};
  // search: a gazetteer name and a live peak name
  await page.fill('#q', 'Kesw'); await page.waitForTimeout(1500);
  log.search_kesw = await page.$$eval('#sug li', l => l.map(x => x.textContent).slice(0, 4));
  await page.fill('#q', 'Helvel'); await page.waitForTimeout(1200);
  log.search_helvel = await page.$$eval('#sug li', l => l.map(x => x.textContent).slice(0, 4));
  await page.keyboard.press('Enter'); await page.waitForTimeout(3500); await idle();
  log.after_search = await page.evaluate(() => ({ zoom: window.__map.getZoom().toFixed(2), c: window.__map.getCenter() }));
  await page.screenshot({ path: path.join(out, 'interact_search.png') });
  // popup on a mountain glyph
  const pt = await page.evaluate(() => { const m = window.__map, c = { x: m.getCanvas().clientWidth / 2, y: m.getCanvas().clientHeight / 2 }; let best = null, bd = 1e9; for (const f of m.queryRenderedFeatures({ layers: ['relief'] })) { const p = m.project(f.geometry.coordinates), d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) { bd = d; best = p; } } return best; });
  if (pt) { await page.mouse.click(pt.x, pt.y - 6); await page.waitForTimeout(800); log.popup = await page.$eval('.maplibregl-popup-content', e => e.innerText).catch(() => null); }
  await page.screenshot({ path: path.join(out, 'interact_popup.png') });
  // layer toggles: hill shading on, mountains off
  await page.click('#lyrBtn');
  await page.click('input[data-g="hillshade"]'); await page.click('input[data-g="mountains"]');
  await idle();
  log.layers = await page.evaluate(() => ({ hillshade: window.__map.getLayoutProperty('hillshade', 'visibility'), relief: window.__map.getLayoutProperty('relief', 'visibility') }));
  await page.screenshot({ path: path.join(out, 'interact_layers.png') });
  // compass rose and border toggles
  await page.click('#frameBox'); await page.waitForTimeout(300);
  log.frame = await page.evaluate(() => !!document.querySelector('.ink-frame') && document.querySelector('.ink-frame').style.display !== 'none');
  await page.click('#compassBox');
  log.compass_hidden = await page.evaluate(() => document.getElementById('rose').style.display === 'none');
  await page.click('#compassBox'); await page.click('#frameBox');
  await page.click('#lyrBtn');
  log.scalebar = await page.$eval('#scalebar canvas', c => c.getAttribute('aria-label'));
  // "Ink your home": make a poster at 2 x and catch the download
  await page.click('#posterBtn'); await page.fill('#pTitle', 'Keswick'); await page.selectOption('#pScale', '2');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('#pGo')]);
  const pf = path.join(require('os').tmpdir(), 'ink_poster_test.png'); await dl.saveAs(pf); log.poster_saved_to = pf;
  log.poster = await page.evaluate(() => window.__lastPoster); log.poster_file = dl.suggestedFilename();
  await page.click('#pCancel');
  // full screen button
  await page.click('.mfs-btn'); await page.waitForTimeout(800);
  log.fullscreen = await page.evaluate(() => !!(document.fullscreenElement || document.querySelector('.mfs-fake')));
  log.errors = errors;
  fs.writeFileSync(path.join(out, 'interact.json'), JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log, null, 1));
  await browser.close();
})();
