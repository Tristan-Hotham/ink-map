// Round 4 QA of the game end to end on the saved tiles: find a hidden figure by clicking it (the counter goes up), walk the
// traveller with the keys, bump into a figure, take to the water with the B key, sail, land with B, and the poster carries the
// round 4 layers (the nations, the narrow seas, the lakes along their axis) and the hidden folk.
// node code/qa_game.js <out dir>   env: SCR, MAPLIBRE_DIST, BASE, ROOT (as code/qa_sea.js)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || 'qa');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..'));
const SCR = process.env.SCR || '/tmp', BASE = process.env.BASE || 'http://127.0.0.1:8791';
const ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
fs.mkdirSync(OUT, { recursive: true });
const errors = []; let fails = 0;
const ok = (k, v, info) => { if (!v) fails++; console.log((v ? 'PASS ' : 'FAIL ') + k, info !== undefined ? JSON.stringify(info) : ''); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  async function open(w, h, at, storage) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
    if (storage) await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && !/404|ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', e => errors.push('pageerror ' + e.message));
    await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
    const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12', maponly: '1', at });
    await page.goto(`${BASE}${ROOT}/index.html?${q}`);
    await page.waitForFunction(() => window.__map, null, { timeout: 90000 });
    await idle(page);
    await page.waitForFunction(() => window.InkFolk && window.InkSea && window.InkTraveller, null, { timeout: 60000 });
    return page;
  }
  const idle = page => page.evaluate(() => new Promise(r => { const m = window.__map; if (m.loaded() && m.areTilesLoaded()) r(); else m.once('idle', r); setTimeout(r, 60000); }));
  const badge = page => page.evaluate(() => (document.querySelector('.folk-badge') || {}).textContent || '');

  // 1. find the lost Cartographer (Scafell Pike) by clicking on the figure
  let page = await open(1280, 800, '54.4521,-3.2072,15.5');
  await page.waitForFunction(() => window.InkFolk.data && window.__map.getLayer('folk'), null, { timeout: 60000 });
  await idle(page); await page.waitForTimeout(1500);
  const b0 = await badge(page);
  const pt = await page.evaluate(() => { const f = window.InkFolk.data.folk.find(x => x.id === 'cartographer'); const p = window.__map.project([f.lon, f.lat]); const r = window.__map.queryRenderedFeatures({ layers: ['folk'] }).map(x => x.properties.id); return { x: p.x, y: p.y, rendered: r }; });
  await page.screenshot({ path: path.join(OUT, 'game_folk_before.png') });
  await page.mouse.click(pt.x, pt.y - 6); await page.waitForTimeout(1200);
  const b1 = await badge(page), found = await page.evaluate(() => window.InkFolk.isFound('cartographer'));
  await page.screenshot({ path: path.join(OUT, 'game_folk_found.png') });
  ok('folk: the figure is drawn at the deepest zoom', pt.rendered.includes('cartographer'), pt.rendered);
  ok('folk: clicking the figure finds it and the counter goes up', found && /Found 1 of/.test(b1) && /Found 0 of/.test(b0), { b0, b1 });
  const saved = await page.evaluate(() => localStorage.getItem('inkFolk.v1') || '');
  ok('folk: progress saved in the browser', /cartographer/.test(saved), saved.slice(0, 80));
  await page.context().close();

  // 2. the traveller (keys work from zoom 13.5, where the traveller walks): walk with the keys, B at the water's edge to take
  // to the water, row, B by the shore to land; then walk into a hidden figure. (The saved tiles reach zoom 12 only in the
  // Lake District, so this is on Windermere in a rowing boat from Bowness; code/qa_sea.js boards a caravel on the open sea.)
  const S = { on: true, pos: [-2.9200, 54.3640], trail: [], dir: 1, look: { fig: 'merchant', mount: 'foot', cloak: 'woad', hood: 'madder', horse: 'bay', skin: 'fair', hair: 'brown', her: { d: 'cross', c1: 'madder', c2: 'white' }, name: 'Tester', boat: 'rowing' } };
  page = await open(1280, 800, '54.3640,-2.9200,14', { 'inkTraveller.v1': JSON.stringify(S) });
  await page.waitForFunction(() => window.InkTraveller.active(), null, { timeout: 20000 });
  const p0 = await page.evaluate(() => window.InkTraveller.state.pos.slice());
  await page.mouse.click(640, 150); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2000); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(300);
  const p1 = await page.evaluate(() => window.InkTraveller.state.pos.slice());
  ok('traveller: walks with the arrow keys', Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]) > 2e-5, { p0, p1 });
  await page.evaluate(() => { const T = window.InkTraveller; T.waterAt(T.state.pos[0], T.state.pos[1]); }); await idle(page); await page.waitForTimeout(500);   // the water test layer draws first
  const edge = await page.evaluate(() => { const T = window.InkTraveller; const near = T.findSea(T.state.pos, 2000); if (near) T.goTo(near[0], near[1]); return near; });
  await idle(page); await page.mouse.click(640, 150);
  await page.keyboard.press('b'); await page.waitForTimeout(700);
  const boat = await page.evaluate(() => window.InkTraveller.state.boat);
  ok('sail: B at the shore takes to the water', boat && boat.afloat === true, { boat, edge });
  // (rowing is tested at zoom 12: in the software renderer every frame at zoom 14 takes long enough to stall the stroke)
  await page.evaluate(() => window.__map.jumpTo({ zoom: 12 })); await idle(page);
  const s0 = await page.evaluate(() => window.InkTraveller.state.pos.slice());
  if (process.env.DBG) await page.evaluate(() => { window.__trk = []; const T = window.InkTraveller; const iv = setInterval(() => { window.__trk.push([T.state.pos[0].toFixed(5), (document.querySelector('.trav-hint') || {}).textContent, document.activeElement && document.activeElement.className]); if (window.__trk.length > 12) clearInterval(iv); }, 300); });
  await page.mouse.click(640, 120); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(300);
  const s1 = await page.evaluate(() => window.InkTraveller.state.pos.slice());
  if (process.env.DBG) console.log(JSON.stringify(await page.evaluate(() => window.__trk)));
  ok('sail: the boat rows with the arrow keys', Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) > 1e-4, { s0, s1 });
  await page.screenshot({ path: path.join(OUT, 'game_rowing.png') });
  await page.mouse.click(640, 120);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(4000); await page.keyboard.up('ArrowRight');
  await page.keyboard.press('b'); await page.waitForTimeout(700);
  const boat2 = await page.evaluate(() => window.InkTraveller.state.boat);
  ok('sail: B by the shore lands again', boat2 && boat2.afloat === false, boat2);
  await page.context().close();
  // walking into a figure counts as finding it: the Cartographer on Scafell, from about 32 m east
  page = await open(1280, 800, '54.4521,-3.2067,15.5', { 'inkTraveller.v1': JSON.stringify(Object.assign({}, S, { pos: [-3.2067, 54.4521] })) });
  await page.waitForFunction(() => window.InkTraveller.active() && window.InkFolk.data, null, { timeout: 60000 });
  await idle(page); await page.mouse.click(640, 150);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(7000); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(800);
  const bump = await page.evaluate(() => ({ found: window.InkFolk.isFound('cartographer'), pos: window.InkTraveller.state.pos }));
  ok('traveller: walking into a figure finds it', bump.found, bump);
  await page.context().close();

  // 3. the poster at Great Britain zoom 4.7 carries the round 4 lettering and the game layers
  page = await open(1280, 800, '54.5,-3.5,4.7');
  // (the hidden folk load from zoom 11, so they are not on a map of Britain; the poster copies them when they are there)
  const lay = await page.evaluate(() => ['country-uk', 'nations', 'regions-sea-pt', 'lake-names-ink-l', 'lake-names-ink-pt', 'sea-life', 'sea-roses'].filter(id => !window.__map.getLayer(id)));
  ok('poster: the page map has the round 4 and game layers', lay.length === 0, lay);
  await page.click('#posterBtn'); await page.fill('#pTitle', 'Britain'); await page.selectOption('#pScale', '2');
  const dl = page.waitForEvent('download', { timeout: 300000 });
  await page.click('#pGo');
  try {
    const d = await dl; const f = path.join(OUT, 'game_poster.png'); await d.saveAs(f);
    const info = await page.evaluate(() => window.__lastPoster);
    ok('poster: saved', fs.statSync(f).size > 200000 && info && info.width >= 2560, info);
  } catch (e) { ok('poster: saved', false, e.message); }
  await page.context().close();
  ok('no console errors', errors.length === 0, errors.slice(0, 5));
  await browser.close();
  process.exitCode = fails ? 1 : 0;
})();
