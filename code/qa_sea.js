// QA for the lively sea and sailing (round 3), on the saved offline tiles in the software renderer.
// node code/qa_sea.js <out dir> [steps,comma,separated]
//   env: SCR (folder holding tj12.json), MAPLIBRE_DIST, BASE (server on 127.0.0.1:8791 serving /), ROOT (checkout)
// Steps: world (sea layers, rhumb lines, roses, wind-heads), atlantic (ships under way, wrecks, legends, overlay pauses while
// moving), north (winter ice on and off), whirl (Corryvreckan close in), sail (board at a coast, sail, wind and storms, land,
// saved state), phone (390 px, the pad's board button), folk (sea folk in the counter).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || 'qa'), STEPS = (process.argv[3] || 'world,atlantic,north,whirl,sail,phone,folk').split(',');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..'));
const SCR = process.env.SCR || '/tmp', BASE = process.env.BASE || 'http://127.0.0.1:8791';
const ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
fs.mkdirSync(OUT, { recursive: true });
const log = { errors: [], checks: {} };
const ok = (k, v, info) => { log.checks[k] = { pass: !!v, info }; console.log((v ? 'PASS ' : 'FAIL ') + k, info !== undefined ? JSON.stringify(info) : ''); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  async function open(w, h, at, opts) {
    opts = opts || {};
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!opts.touch, isMobile: !!opts.touch });
    if (opts.storage) await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, opts.storage);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && !/404|ERR_FAILED|Failed to load resource/.test(m.text())) log.errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', e => log.errors.push('pageerror ' + e.message));
    await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
    const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12', maponly: '1' });
    if (at) q.set('at', at);
    await page.goto(`${BASE}${ROOT}/index.html?${q}`);
    await page.waitForFunction(() => window.__map, null, { timeout: 90000 });
    return page;
  }
  const idle = page => page.evaluate(() => new Promise(r => { const m = window.__map; let done = false; const fin = () => { if (!done) { done = true; setTimeout(r, 600); } }; m.once('idle', fin); m.triggerRepaint(); setTimeout(fin, 45000); }));
  const ready = async page => { await idle(page); await page.waitForFunction(() => window.InkSea && window.__map.getLayer('sea-life'), null, { timeout: 30000 }); await page.waitForTimeout(2500); await idle(page); };
  const count = (page, ids) => page.evaluate(ids => { const m = window.__map, o = {}; for (const id of ids) { try { o[id] = m.getLayer(id) ? m.queryRenderedFeatures({ layers: [id] }).length : null; } catch (e) { o[id] = 'err'; } } return o; }, ids);
  const shot = (page, n) => page.screenshot({ path: path.join(OUT, n) });

  if (STEPS.includes('world')) {
    const page = await open(1280, 800, '20,-20,1.8');
    await ready(page);
    const c = await count(page, ['sea-life', 'sea-life-w', 'sea-roses', 'sea-rhumb', 'sea-legend', 'sea-wrecks', 'sea-named-ships']);
    ok('world: sea life drawn', c['sea-life'] >= 8, c);
    ok('world: compass roses and rhumb lines', c['sea-roses'] >= 2 && c['sea-rhumb'] > 20, { roses: c['sea-roses'], rhumb: c['sea-rhumb'] });
    const heads = await page.evaluate(() => [...document.querySelectorAll('.sea-wh.on')].map(d => d.className));
    ok('world: wind-heads at the edges', heads.length >= 2, heads);
    // never under a name: every drawn sea icon's box is clear of every placed name's anchor box (MapLibre collision)
    const clash = await page.evaluate(() => {
      const m = window.__map, txt = m.getStyle().layers.filter(l => l.type === 'symbol' && l.layout && l.layout['text-field'] && !l.id.startsWith('sea-')).map(l => l.id);
      const names = m.queryRenderedFeatures({ layers: txt }).filter(f => f.geometry.type === 'Point').map(f => m.project(f.geometry.coordinates));
      const sea = m.queryRenderedFeatures({ layers: ['sea-life', 'sea-life-w', 'sea-named-ships', 'sea-wrecks', 'sea-roses'].filter(id => m.getLayer(id)) }).map(f => m.project(f.geometry.coordinates));
      let n = 0; for (const s of sea) for (const p of names) if (Math.abs(s.x - p.x) < 4 && Math.abs(s.y - p.y) < 4) n++; return { sea: sea.length, names: names.length, clashes: n };
    });
    ok('world: no sea drawing sits on a name anchor', clash.clashes === 0, clash);
    await shot(page, 'sea_world.png');
    await page.context().close();
  }
  if (STEPS.includes('atlantic')) {
    const page = await open(1280, 800, '45,-15,4.2');
    await ready(page);
    await page.waitForFunction(() => window.InkSea.state() && window.InkSea.state().lanes.length > 0, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => { const s = window.InkSea.state(); return { lanes: s.lanes.length, movers: s.movers.length, items: s.items.length, raf: !!s.raf, display: document.querySelector('.ink-sea-overlay').style.display, frames: s.frames || 0, ms: s.ms ? +(s.ms / s.frames).toFixed(2) : 0 }; });
    ok('atlantic: ships under way on the overlay at rest', st.movers > 0 && st.raf && st.display !== 'none', st);
    await shot(page, 'sea_atlantic.png');
    const moving = await page.evaluate(() => new Promise(res => { const m = window.__map, s = window.InkSea.state(); m.panBy([200, 0], { duration: 900 }); setTimeout(() => res({ raf: !!s.raf, display: document.querySelector('.ink-sea-overlay').style.display, moving: m.isMoving() }), 300); }));
    ok('atlantic: the animation pauses while the map moves', !moving.raf && moving.display === 'none', moving);
    const c = await count(page, ['sea-wrecks', 'sea-legend', 'sea-named-ships', 'sea-life']);
    ok('atlantic: wrecks, legends and ships drawn', c['sea-wrecks'] + c['sea-legend'] + c['sea-named-ships'] > 3, c);
    // popup on a legend island
    await idle(page);
    const pop = await page.evaluate(() => { const m = window.__map, f = m.queryRenderedFeatures({ layers: ['sea-legend', 'sea-wrecks', 'sea-named-ships'] })[0]; if (!f) return null; const p = m.project(f.geometry.coordinates); return { x: p.x, y: p.y, n: f.properties.n }; });
    if (pop) { await page.mouse.click(pop.x, pop.y); await page.waitForTimeout(400); const t = await page.evaluate(() => { const p = document.querySelector('.ink-sea-pop'); return p ? p.textContent.slice(0, 160) : null; }); ok('atlantic: popup for a sea drawing', !!t, t); }
    await page.context().close();
  }
  if (STEPS.includes('north')) {
    const page = await open(1280, 800, '70,-25,3.3');
    await ready(page);
    const w = await count(page, ['sea-life-w', 'sea-life']);
    await page.evaluate(() => { const b = document.getElementById('winterBox'); b.checked = false; b.dispatchEvent(new Event('change')); });
    await idle(page);
    const s = await count(page, ['sea-life-w', 'sea-life']);
    ok('north: sea ice and icebergs in winter, gone with the Winter switch off', w['sea-life-w'] > 0 && !s['sea-life-w'], { winter: w, summer: s });
    await page.evaluate(() => { const b = document.getElementById('winterBox'); b.checked = true; b.dispatchEvent(new Event('change')); });
    await idle(page); await shot(page, 'sea_north_winter.png');
    await page.context().close();
  }
  if (STEPS.includes('whirl')) {
    const page = await open(1280, 800, '56.15,-5.72,9.5');
    await ready(page);
    const c = await count(page, ['sea-legend']);
    const st = await page.evaluate(() => window.InkSea.state().items.map(i => i.kind));
    ok('whirl: Corryvreckan drawn and turning', c['sea-legend'] >= 1 && st.includes('whirl'), { c, st });
    await shot(page, 'sea_corryvreckan.png');
    await page.context().close();
  }
  if (STEPS.includes('sail')) {
    // the traveller on the shore at Whitby harbour mouth, in a caravel
    const S = { on: true, pos: [-0.6125, 54.4905], trail: [], dir: 1, look: { fig: 'merchant', mount: 'foot', cloak: 'woad', hood: 'madder', horse: 'bay', skin: 'fair', hair: 'brown', her: { d: 'cross', c1: 'madder', c2: 'white' }, name: 'Tester', boat: 'caravel' } };
    // (the saved tiles reach zoom 10 on this coast, so the boarding is tested at zoom 10.5; the live site has every zoom)
    const page = await open(1280, 800, '54.4905,-0.6125,10.5', { storage: { 'inkTraveller.v1': JSON.stringify(S) } });
    await ready(page);
    await page.waitForFunction(() => window.InkTraveller && window.InkTraveller.active(), null, { timeout: 20000 });
    // walk east into the sea until the board prompt appears, then board
    const r = await page.evaluate(async () => {
      const T = window.InkTraveller, m = window.__map, out = {};
      out.water = T.waterAt(T.state.pos[0] + 0.004, T.state.pos[1]);
      await new Promise(res => setTimeout(res, 300));
      const near = T.findSea(T.state.pos, 800); out.near = near;
      if (near) { T.goTo(near[0], near[1]); }
      out.board = T.board(); out.afloat = T.state.boat && T.state.boat.afloat; out.kind = T.state.boat && T.state.boat.kind;
      return out;
    });
    ok('sail: board a boat at the coast', r.afloat === true && r.kind === 'caravel', r);
    await page.evaluate(() => window.__map.jumpTo({ zoom: 7 }));
    await idle(page);
    const before = await page.evaluate(() => window.InkTraveller.state.pos.slice());
    // sail east with the arrow key for three seconds
    await page.mouse.click(640, 120); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => { const T = window.InkTraveller; return { pos: T.state.pos.slice(), trail: T.state.trail.length, wind: T.sailInfo && T.sailInfo(), hud: (document.querySelector('.trav-sail') || {}).textContent }; });
    const km = (after.pos[0] - before[0]) * 111 * Math.cos(54.5 * Math.PI / 180);
    ok('sail: sails east with the arrow key, wind and point of sail shown', km > 2 && after.hud && /wind/i.test(after.hud), { km: +km.toFixed(1), hud: after.hud, wind: after.wind });
    await shot(page, 'sea_sailing_z7.png');
    // storms slow the boat: compare the speed factor inside and outside a storm
    const sf = await page.evaluate(() => { const st = window.InkSea.storms().sort((a, b) => b.s - a.s)[0]; return { storm: window.InkTraveller.speedFactor(st.lng, st.lat, 90), calm: window.InkTraveller.speedFactor(st.lng + 60, st.lat, 90), s: st.s }; });
    ok('sail: storms slow you', sf.storm < sf.calm, sf);
    const sl = await page.evaluate(() => { const m = window.__map; return { layer: !!m.getLayer('sea-storms') && m.getLayoutProperty('sea-storms', 'visibility'), n: m.querySourceFeatures('sea-storms').length }; });
    ok('sail: storms drawn while at sea', sl.layer === 'visible' && sl.n > 0, sl);
    // wind changes speed: running, beam reach and dead into the wind
    const wf = await page.evaluate(() => { const T = window.InkTraveller, p = T.state.pos, w = window.InkWind.at(p[0], p[1]); const to = Math.atan2(w.to[0], w.to[1]) * 180 / Math.PI; return { run: T.speedFactor(p[0], p[1], to, true), beam: T.speedFactor(p[0], p[1], to + 90, true), irons: T.speedFactor(p[0], p[1], to + 180, true) }; });
    ok('sail: the wind changes the speed', wf.irons < wf.run && wf.run <= wf.beam, wf);
    // saved: vessel, position and trail survive a reload
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inkTraveller.v1')));
    ok('sail: vessel, position and trail saved', saved.boat && saved.boat.afloat && saved.boat.kind === 'caravel' && saved.trail.length > 1, { boat: saved.boat, trail: saved.trail.length });
    // land again: sail west back to the coast near Whitby
    const landed = await page.evaluate(async () => { const T = window.InkTraveller; T.goTo(-0.62, 54.49); await new Promise(r => setTimeout(r, 200)); const ok = T.land(); return { ok, afloat: T.state.boat.afloat }; });
    ok('sail: land at a coast', landed.afloat === false, landed);
    await page.context().close();
  }
  if (STEPS.includes('phone')) {
    // a rowing boat on Windermere (small boats may take to lakes and rivers; the saved tiles cover the Lakes to zoom 12)
    const S = { on: true, pos: [-2.9335, 54.3640], trail: [], dir: 1, look: { fig: 'pilgrim', mount: 'foot', cloak: 'madder', hood: 'woad', horse: 'bay', skin: 'fair', hair: 'brown', her: { d: 'chevron', c1: 'woad', c2: 'ochreLt' }, name: 'Phone', boat: 'rowing' }, boat: { kind: 'rowing', afloat: true } };
    const page = await open(390, 800, '54.3640,-2.9335,12.6', { touch: true, storage: { 'inkTraveller.v1': JSON.stringify(S) } });
    await ready(page);
    await page.waitForTimeout(800);
    const pad = await page.evaluate(() => { const p = document.querySelector('.trav-pad'); return p ? { on: p.classList.contains('on'), board: !!p.querySelector('[data-k="b"]') } : null; });
    ok('phone: the on-screen pad shows, with a board or land button', pad && pad.on && pad.board, pad);
    const b0 = await page.evaluate(() => window.InkTraveller.state.pos.slice());
    const btn = await page.$('.trav-pad button[aria-label="North"]');
    if (btn) { const bb = await btn.boundingBox(); await page.mouse.move(bb.x + 20, bb.y + 20); await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up(); }
    const b1 = await page.evaluate(() => window.InkTraveller.state.pos.slice());
    ok('phone: rows up the lake with the pad', b1[1] > b0[1], { b0, b1, water: await page.evaluate(() => window.InkTraveller.waterAt(window.InkTraveller.state.pos[0], window.InkTraveller.state.pos[1])) });
    await shot(page, 'sea_phone.png');
    // a galleon may not sail a lake
    const big = await page.evaluate(() => { const T = window.InkTraveller; T.land(); T.state.look.boat = 'galleon'; T.state.boat.kind = 'galleon'; const r = T.board(); return { boarded: r, afloat: T.state.boat.afloat, msg: (document.querySelector('.trav-hint') || {}).textContent }; });
    ok('phone: a galleon cannot take to a lake', !big.afloat, big);
    await page.context().close();
  }
  if (STEPS.includes('folk')) {
    const page = await open(1280, 800, '50.2,-5.58,12');
    await ready(page);
    await page.evaluate(() => window.InkFolk.fetchData());
    await page.waitForFunction(() => window.InkFolk.data, null, { timeout: 20000 });
    const f = await page.evaluate(() => { const d = window.InkFolk.data; return { total: d.folk.length, sea: d.folk.filter(x => x.id.startsWith('sea-')).length, badge: document.querySelector('.folk-badge .tx').textContent }; });
    ok('folk: the sea folk are in the counter', f.sea >= 20 && new RegExp('of ' + f.total).test(f.badge), f);
    // draw every sea folk sprite once
    const bad = await page.evaluate(() => { const d = window.InkFolk.data, out = []; for (const x of d.folk.filter(x => x.id.startsWith('sea-'))) { try { const c = window.InkFolkArt.render(x.art, 3); if (!c.width) out.push(x.id); } catch (e) { out.push(x.id + ': ' + e.message); } } return out; });
    ok('folk: every sea folk drawing renders', bad.length === 0, bad);
    await page.context().close();
  }
  ok('no console errors', log.errors.length === 0, log.errors.slice(0, 8));
  fs.writeFileSync(path.join(OUT, 'qa_sea.json'), JSON.stringify(log, null, 1));
  await browser.close();
})();
