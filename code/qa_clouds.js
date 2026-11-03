// Clouds and the sea wash on the saved tiles: resting clouds clear of the middle 60% of the view at several zooms, none from
// zoom 13, a flight from the world to the Lake District (frames of the clouds sweeping past), a zoom out (clouds gathering),
// reduced motion (no flying), the Clouds switch, the altitude line, the sea wash in winter and plain, and the poster.
// node code/qa_clouds.js <out dir>   env: SCR (folder holding tj12.json), MAPLIBRE_DIST, BASE, ROOT
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || 'qa/clouds');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..'));
const SCR = process.env.SCR || '/tmp', BASE = process.env.BASE || 'http://127.0.0.1:8791';
const ML = process.env.MAPLIBRE_DIST || '/tmp/ml/node_modules/maplibre-gl/dist';
fs.mkdirSync(OUT, { recursive: true });
const ok = [], bad = [];
// a screenshot can stall for minutes in the software renderer on a heavy view: try twice, then go on without it
const shot = async (page, file) => { for (let k = 0; k < 2; k++) { try { await page.screenshot({ path: file, timeout: 90000 }); return true; } catch (e) { console.log('   (screenshot stalled: ' + path.basename(file) + ')'); } } return false; };
const check = (c, msg) => { (c ? ok : bad).push(msg); console.log(c ? 'ok  ' : 'FAIL', msg); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  async function open(at, o) {
    o = o || {};
    const ctx = await browser.newContext({ viewport: o.vp || { width: 1280, height: 800 }, reducedMotion: o.reduce ? 'reduce' : 'no-preference', colorScheme: o.dark ? 'dark' : 'light', acceptDownloads: true });
    if (o.winterOff) await ctx.addInitScript(() => { try { localStorage.setItem('ink-winter', '0'); } catch (e) {} });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await page.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/, (route, req) => { const f = path.join(ML, req.url().split('/dist/')[1]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|wikipedia|wikidata/, r => r.abort());
    const q = new URLSearchParams({ tj: `${BASE}${SCR}/tj12.json`, dem: `${BASE}/home/claude/newdata/raw9/terrarium/{z}/{x}/{y}.png`, demmax: '12', maponly: '1', at });
    if (o.clean) q.set('clean', '1');
    await page.goto(`${BASE}${ROOT}/index.html?${q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__map && window.__map.__clouds, null, { timeout: 120000 });
    await page.evaluate(() => new Promise(res => { const m = window.__map; if (m.loaded() && m.areTilesLoaded()) res(); else m.once('idle', res); setTimeout(res, 40000); }));
    await page.waitForTimeout(o.settle || 2500);
    return { ctx, page, errs };
  }
  // the resting clouds now on screen (their drawn box, as the browser composites it)
  const restBoxes = page => page.evaluate(() => {
    const W = innerWidth, H = document.getElementById('map').clientHeight, r0 = document.getElementById('map').getBoundingClientRect();
    return [...document.querySelectorAll('.ink-clouds img.rest')].map(el => { const r = el.getBoundingClientRect(), op = +getComputedStyle(el).opacity; return { x0: r.left - r0.left, y0: r.top - r0.top, x1: r.right - r0.left, y1: r.bottom - r0.top, op, W: r0.width, H: r0.height }; }).filter(b => b.op > 0.02);
  });
  // a cloud's drawn box overlaps the middle 60% of the view? (the sprite box has transparent margins, so shrink it a little)
  const inMiddle = b => { const sx = (b.x1 - b.x0) * 0.07, sy = (b.y1 - b.y0) * 0.1; return b.x1 - sx > b.W * 0.2 && b.x0 + sx < b.W * 0.8 && b.y1 - sy > b.H * 0.2 && b.y0 + sy < b.H * 0.8; };

  // 1. resting clouds at several heights
  for (const [name, at, want] of [['world', '25,10,1.6', [5, 8]], ['europe', '52,10,3.8', [4, 7]], ['gb', '54.5,-3.5,6', [2, 5]], ['lakes11', '54.5,-3.1,11.2', [1, 3]], ['lakes14', '54.45,-3.2,14', [0, 0]]]) {
    const { ctx, page, errs } = await open(at, { clean: true });
    let worst = 0, counts = [];
    for (let k = 0; k < 4; k++) {
      const bx = await restBoxes(page); counts.push(bx.length);
      worst += bx.filter(inMiddle).length;
      if (k === 0) await shot(page, path.join(OUT, `rest_${name}.png`));
      await page.waitForTimeout(3000);
    }
    const n = Math.max(...counts);
    check(n >= want[0] && n <= want[1], `${name}: ${n} resting clouds (want ${want[0]} to ${want[1]})`);
    check(worst === 0, `${name}: no resting cloud over the middle 60% (4 checks over 9 s)`);
    const alt = await page.evaluate(() => document.querySelector('#zbadge .alt') && document.querySelector('#zbadge .alt').textContent);
    console.log('   altitude:', alt);
    check(!errs.length, `${name}: no console errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  // 2. a flight from the world to the Lake District, and back out. (In the software renderer a frame can take seconds, so
  // MapLibre's flight may jump to its end in one frame: each flight is watched until the map rests, up to 15 s.)
  {
    const { ctx, page, errs } = await open('25,10,1.6', {});
    // the map at rest and the sky clear of flying clouds (their animations keep the page's own clock, which in the software
    // renderer only moves on with each slow frame)
    const rest_ = () => page.evaluate(() => new Promise(res => { const m = window.__map, t0 = performance.now(); const k = () => (!m.isMoving() && !document.querySelector('.ink-clouds img.fly')) || performance.now() - t0 > 25000 ? res() : setTimeout(k, 200); k(); }));
    const watch = (fn) => page.evaluate(fn => new Promise(res => {
      const m = window.__map, out = [], t0 = performance.now(); let ended = 0;
      (new Function('m', fn))(m);
      m.once('moveend', () => { ended = performance.now(); });
      const tick = () => {
        const t = performance.now() - t0, imgs = [...document.querySelectorAll('.ink-clouds img.fly')];
        const W = innerWidth, H = innerHeight;
        // how many flying clouds cover the centre (the middle 10% box) at more than 30% opacity
        const cen = imgs.filter(el => { const r = el.getBoundingClientRect(), op = +getComputedStyle(el).opacity; return op > 0.3 && r.left < W * 0.55 && r.right > W * 0.45 && r.top < H * 0.55 && r.bottom > H * 0.45; }).length;
        out.push({ t: Math.round(t), n: imgs.length, cen, z: +m.getZoom().toFixed(2) });
        if (t < 15000 && !(ended && performance.now() - ended > 2500)) setTimeout(tick, 80); else res(out);
      };
      tick();
    }), fn);
    let frames = await watch("m.fitBounds([[-3.32, 54.36], [-2.86, 54.6]], { padding: 20, duration: 2400, essential: true })");
    const maxN = Math.max(...frames.map(f => f.n)), cenT = frames.filter(f => f.cen > 0).length * 80;
    console.log('   flight frames:', frames.filter((f, i) => i % 3 === 0).map(f => `${f.t}:${f.n}/${f.cen}@${f.z}`).join(' '));
    check(maxN >= 8, `flight in: ${maxN} clouds sweep past`);
    check(cenT <= 500, `flight in: clouds over the centre for about ${cenT} ms in all`);
    await rest_();
    check(!(await page.evaluate(() => document.querySelector('.ink-clouds img.fly'))), 'flight in: the sky has cleared at the end');
    await rest_();
    frames = await watch("m.flyTo({ center: [-3, 54], zoom: 5, duration: 1800 })");
    check(Math.max(...frames.map(f => f.n)) >= 5, `zoom out: ${Math.max(...frames.map(f => f.n))} clouds gather`);
    await rest_(); await page.waitForTimeout(1500);
    frames = await watch("m.zoomTo(m.getZoom() + 0.5, { duration: 400 })");
    check(Math.max(...frames.map(f => f.n)) === 0, 'half a zoom level: no clouds fly');
    await rest_();
    // stills of a descent and a gathering: the cloud animations paused part way (deterministic, whatever the frame rate)
    for (const [dir, ts] of [[1, [120, 350, 650]], [-1, [300, 700]]]) {
      for (const t of ts) {
        await page.evaluate(([dir, t]) => { window.__map.__clouds.burst(dir, 1); for (const a of document.querySelector('.ink-clouds').getAnimations({ subtree: true })) { const el = a.effect && a.effect.target; if (el && el.classList && el.classList.contains('fly')) { a.pause(); a.currentTime = t; } } }, [dir, t]);
        await shot(page, path.join(OUT, `burst_${dir > 0 ? 'in' : 'out'}_${t}.png`));
        await page.evaluate(() => { for (const a of document.querySelector('.ink-clouds').getAnimations({ subtree: true })) { const el = a.effect && a.effect.target; if (a.playState === 'paused' && el && el.classList && el.classList.contains('fly')) a.finish(); } });
        await page.waitForTimeout(300);
      }
    }
    // the switch
    await page.evaluate(() => { document.getElementById('lyrBtn').click(); });
    await page.click('#cloudBox'); await page.waitForTimeout(300);
    const offState = await page.evaluate(() => ({ disp: document.querySelector('.ink-clouds').style.display, n: document.querySelectorAll('.ink-clouds img').length, alt: !!document.querySelector('#zbadge .alt') }));
    frames = await watch("m.flyTo({ center: [-3, 54.5], zoom: 10, duration: 1200 })");
    const flyOff = Math.max(...frames.map(f => f.n));
    check(offState.disp === 'none' && offState.n === 0 && flyOff === 0, 'Clouds switched off: none rest, none fly');
    await page.click('#cloudBox');
    check(!errs.length, `flight: no console errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  // 3. reduced motion: resting clouds stand still, nothing flies
  {
    const { ctx, page, errs } = await open('52,10,3.8', { reduce: true });
    const a = await restBoxes(page); await page.waitForTimeout(2000); const b = await restBoxes(page);
    check(a.length > 0 && JSON.stringify(a.map(r => Math.round(r.x0))) === JSON.stringify(b.map(r => Math.round(r.x0))), 'reduced motion: resting clouds still');
    const mx = await page.evaluate(() => new Promise(res => { const m = window.__map; m.flyTo({ center: [-3, 54.5], zoom: 10, duration: 1500 }); let mx = 0; const t0 = performance.now(); const k = () => { mx = Math.max(mx, document.querySelectorAll('.ink-clouds img.fly').length); if (performance.now() - t0 < 12000) setTimeout(k, 80); else res(mx); }; k(); }));
    check(mx === 0, 'reduced motion: no clouds fly');
    await ctx.close();
  }

  // 4. the sea wash: winter and plain, dark mode, the phone, and the poster with clouds at the edges
  for (const [name, at, o] of [['sea_world', '25,10,1.6', {}], ['sea_gb', '54.5,-3.5,5.5', {}], ['sea_gb_plain', '54.5,-3.5,5.5', { winterOff: true }], ['sea_coast9', '54.45,-3.55,9', {}], ['sea_coast10', '54.2,-3.25,10.5', {}], ['sea_dark', '54.5,-3.5,5.5', { dark: true }], ['phone', '54.5,-3.5,5', { vp: { width: 390, height: 780 } }]]) {
    const { ctx, page, errs } = await open(at, Object.assign({ clean: name !== 'phone' && name !== 'sea_dark' }, o));
    await shot(page, path.join(OUT, name + '.png'));
    if (name === 'sea_dark') { const op = await page.evaluate(() => JSON.stringify(window.__map.getPaintProperty('sea-tint', 'fill-opacity'))); check(/0\.45/.test(op), 'dark mode: the sea a little deeper'); }
    check(!errs.length, `${name}: no console errors ${errs.join(' | ')}`);
    if (name === 'sea_gb') {
      const r = await page.evaluate(async () => { const r = await InkExtras.poster(window.__map, { title: 'Clouds over Britain', scale: 2, border: true, clouds: true }); const u = URL.createObjectURL(r.blob); return { u, w: r.width, h: r.height }; });
      const b64 = await page.evaluate(async u => { const b = await (await fetch(u)).blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(b); }); }, r.u);
      fs.writeFileSync(path.join(OUT, 'poster_clouds.png'), Buffer.from(b64, 'base64'));
      check(r.w > 2000, `poster with clouds: ${r.w} x ${r.h}`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`${ok.length} passed, ${bad.length} failed`);
  fs.writeFileSync(path.join(OUT, 'qa_clouds.json'), JSON.stringify({ ok, bad }, null, 1));
})();
