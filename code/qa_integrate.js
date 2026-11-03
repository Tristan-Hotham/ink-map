// Integration QA on the offline tiles: the art, life and folk modules together. Winter toggle (snowy twins of the life
// drawings and their return to summer), popups on the merged winter layers, the grouped layers panel, the deferred
// modules (folk, history, overlay) arriving after the first view, and the poster.
// node code/qa_integrate.js <shots.json as for qa_render.js> <out dir>
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), out = process.argv[3];
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const log = { errors: [] };
  async function open(w, h, at, dpr) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr || 1, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && !/404|ERR_FAILED/.test(m.text())) log.errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', e => log.errors.push('pageerror ' + e.message));
    await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(cfg.maplibre, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
    const q = new URLSearchParams({ tj: cfg.tj, dem: cfg.dem, demmax: '12', maponly: '1' }); if (at) q.set('at', at);
    await page.goto(`${cfg.base}/index.html?${q}`);
    await page.waitForFunction(() => window.__map, null, { timeout: 90000 });
    return page;
  }
  const idle = page => page.evaluate(() => new Promise(r => { window.__map.once('idle', () => setTimeout(r, 700)); window.__map.triggerRepaint(); setTimeout(r, 60000); }));

  // ---- Lake District, zoom 12: life in the snow
  let page = await open(1280, 800, '54.43,-2.97,12.2');
  await idle(page); await page.waitForTimeout(4000); await idle(page);
  const snap = () => page.evaluate(() => {
    const m = window.__map, imgs = m.listImages();
    const n = id => { try { return m.queryRenderedFeatures({ layers: [id] }).length; } catch (e) { return null; } };
    return { zoom: +m.getZoom().toFixed(2), layers: m.getStyle().layers.length, images: imgs.length, lifeSnowImgs: imgs.filter(i => /^l[a-z]-.*-s$/.test(i)).length,
      lifeLand: n('life-land'), lifeTown: n('life-town'), lifeRoad: n('life-road'), relief: n('relief'), trees: n('trees'), hedges: n('life-hedge'),
      winter: window.InkMap.isWinter(m), lifeIcon: JSON.stringify(m.getLayoutProperty('life-land', 'icon-image')).slice(0, 60),
      folk: !!window.InkFolk, trav: !!window.InkTraveller, overlay: !!(window.InkLife && InkLife.state()), hist: m.getStyle().layers.filter(l => /^life-(roman|pilgrim|battles|dmv|wrecks|monks)/.test(l.id)).map(l => l.id) };
  });
  log.lakes_winter = await snap();
  await page.screenshot({ path: path.join(out, 'int_lakes_winter.png') });
  // popups on the merged winter layers: a mountain and a tree
  for (const id of ['relief', 'trees', 'life-land', 'town']) {
    const pt = await page.evaluate(id => { const m = window.__map; let f; try { f = m.queryRenderedFeatures({ layers: [id] })[0]; } catch (e) {} if (!f) return null; const p = m.project(f.geometry.coordinates); return { x: p.x, y: p.y - 4 }; }, id);
    if (!pt) { log['popup_' + id] = 'none in view'; continue; }
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(700);
    log['popup_' + id] = await page.$eval('.maplibregl-popup-content', e => e.innerText.slice(0, 90)).catch(() => null);
    await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()));
  }
  // Winter off from the panel
  await page.click('#lyrBtn'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'int_panel.png') });
  log.panel = await page.$$eval('#lp h5', h => h.map(x => x.textContent));
  await page.click('#winterBox'); await idle(page); await page.waitForTimeout(1500);
  log.lakes_summer = await snap();
  await page.click('#lyrBtn').catch(() => {});
  await page.screenshot({ path: path.join(out, 'int_lakes_summer.png') });
  await page.click('#lyrBtn'); await page.click('#winterBox'); await page.click('#lyrBtn'); await idle(page);
  // poster
  await page.click('#posterBtn'); await page.fill('#pTitle', 'Grasmere'); await page.selectOption('#pScale', '2');
  const dl = page.waitForEvent('download', { timeout: 240000 });
  await page.click('#pGo');
  try { const d = await dl; const f = path.join(out, 'int_poster.png'); await d.saveAs(f); log.poster = { bytes: fs.statSync(f).size, info: await page.evaluate(() => window.__lastPoster) }; } catch (e) { log.poster = 'failed ' + e.message; }
  await page.context().close();

  // ---- folk at the deepest zoom, desktop, and the phone layout with the panel open
  page = await open(1280, 800, '54.4521,-3.2072,15.5');
  await idle(page); await page.waitForTimeout(5000); await idle(page);
  log.folk = await page.evaluate(() => ({ folk: !!window.InkFolk, layer: !!window.__map.getLayer('folk'), n: (() => { try { return window.__map.queryRenderedFeatures({ layers: ['folk'] }).length; } catch (e) { return null; } })() }));
  await page.screenshot({ path: path.join(out, 'int_folk15.png') });
  await page.context().close();
  page = await open(390, 844, null, 2);
  await idle(page); await page.waitForTimeout(3000);
  await page.click('#lyrBtn'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'int_phone_panel.png') });
  await page.context().close();
  await browser.close();
  fs.writeFileSync(path.join(out, 'integrate.json'), JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log, null, 1));
})();
