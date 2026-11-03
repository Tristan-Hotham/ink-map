/* The Inked World: the lively sea. Loaded after the map's first view (with the hidden folk), so nothing here touches the
 * first load. Adds the sea layers (sea life on a nested grid, named sea things, rhumb lines and compass roses), an overlay
 * that animates whale spouts, whirlpools, ghostly glimmers and merchant ships sailing their CLIWOC passages (only while
 * the map is at rest and only at the zooms that show them), wind-heads blowing at the map's edges far out, the shared
 * wind (js/ink-palette.js InkWind, fed here with the CLIWOC logbook winds), popups, a Sea section in the key, and storm
 * layers for the traveller at sea. Data: data/sea/ (code/02m_sea.py); drawings: js/ink-sea-art.js.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const A = () => global.InkSeaArt;
  const iz = (...p) => { const e = ['interpolate', ['linear'], ['zoom']]; for (let i = 0; i < p.length; i += 2) e.push(p[i], p[i + 1]); return e; };
  // opacity: a point fades in over the zoom before its first zoom (z0) and, for named things, out before its last (z1)
  const fade = (lo, hi, top, z1) => { const e = ['interpolate', ['linear'], ['zoom']]; for (let z = lo; z <= hi + 1e-6; z += 0.5) { const zz = Math.round(z * 10) / 10; let v = ['max', 0, ['min', 1, ['-', zz + 0.9, ['get', 'z0']]]]; if (z1) v = ['*', v, ['max', 0, ['min', 1, ['*', 2, ['-', ['get', 'z1'], zz]]]]]; e.push(zz, ['*', typeof top === 'function' ? top(zz) : top, v]); } return e; };
  // (a symbol filter is evaluated at the tile's whole zoom, so it lets in all that are due before the next one; the opacity decides)
  const ZF = ['<=', ['get', 'z0'], ['+', ['zoom'], 1]];
  const ZF1 = ['all', ZF, ['>', ['get', 'z1'], ['-', ['zoom'], 0.2]]];
  const KINDS_OF = {
    life: ['sea-life', 'sea-life-w', 'sea-named-life'], ships: ['sea-named-ships'], wrecks: ['sea-wrecks'], legend: ['sea-legend'], chart: ['sea-rhumb', 'sea-roses'],
  };
  const GROUP = { 'sea-life': 'sealife', 'sea-life-w': 'sealife', 'sea-named-life': 'sealife', 'sea-named-ships': 'seaships', 'sea-wrecks': 'seawrecks', 'sea-legend': 'sealegend', 'sea-rhumb': 'seachart', 'sea-roses': 'seachart' };
  const CLICK = ['sea-life', 'sea-life-w', 'sea-named-life', 'sea-named-ships', 'sea-wrecks', 'sea-legend', 'sea-roses'];
  const LIFE_TXT = {
    whale: ['Whale', 'Whales of the open ocean, drawn as on old charts; a picture, not a sighting.'],
    dolphin: ['Dolphins', 'Dolphins leaping, drawn where the sea suits them; a picture, not a sighting.'],
    flyfish: ['Flying fish', 'Flying fish of the warm seas, gliding over the waves.'],
    serpent: ['Sea serpent', 'A sea serpent of the kind old charts put in the empty ocean, as on Olaus Magnus\'s Carta Marina (1539). Decoration.'],
    kraken: ['Kraken', 'A kraken taking a ship, from sailors\' tales. Decoration.'],
    berg: ['Iceberg', 'Icebergs drift in the polar seas; in the winter look they come further south, down Iceberg Alley off Newfoundland.'],
    floe: ['Sea ice', 'Pack ice in the polar seas, drawn in the winter look.'],
  };
  let map = null, base = '', data = { life: null, named: null, rhumb: null, lanes: null, wind: null }, overlay = null, heads = null;

  // ---------------------------------------------------------------- the shared wind (CLIWOC logbooks via InkWind)
  function loadWind() {
    if (data.wind) return data.wind;
    data.wind = fetch(base + 'data/sea/wind.json?v=20261103').then(r => r.json()).then(j => { if (global.InkWind) global.InkWind.setGrid(j); return j; }).catch(e => { console.warn('sea wind', e); data.wind = null; });
    return data.wind;
  }

  // ---------------------------------------------------------------- storms: a few systems drifting through the storm belts
  // (deterministic from the clock, so every viewer sees the same weather; a game device, not a forecast)
  const BELTS = [   // lon0, lon1, lat0, lat1, drift (degrees a minute east, north), weight
    [-70, -10, 40, 60, 1.6, 0.4, 3], [140, 230, 35, 55, 1.6, 0.3, 3], [-180, 180, -60, -40, 2.2, 0, 6], [-85, -50, 12, 26, -1.2, 0.5, 2],
    [120, 150, 10, 25, -1.2, 0.6, 2], [82, 95, 12, 20, -0.6, 0.6, 1], [50, 90, -22, -10, -1.0, -0.5, 1], [0, 30, 55, 68, 1.4, 0.2, 1], [-160, -110, 10, 18, -1.0, 0.2, 1],
  ];
  function storms(now) {
    const t = (now || Date.now()) / 60000, out = [];
    let i = 0;
    for (const b of BELTS) for (let k = 0; k < b[6]; k++, i++) {
      const s = ((i * 0.6180339887) % 1), T = 14 + (i % 5) * 3, ph = (t / T + s) % 1, cyc = Math.floor(t / T + s);
      const h = Math.abs(Math.sin((cyc + 1) * 12.9898 + i * 78.233) * 43758.5453) % 1, h2 = Math.abs(Math.sin((cyc + 1) * 4.1414 + i * 15.17) * 9631.31) % 1;
      const lon = b[0] + (b[1] - b[0]) * h + b[4] * ph * T, lat = b[2] + (b[3] - b[2]) * h2 + b[5] * ph * T;
      const str = Math.sin(Math.PI * ph);
      out.push({ lng: ((lon + 540) % 360) - 180, lat, r: 260 + 420 * str, s: str });
    }
    return out;
  }
  function stormAt(lng, lat, now) {
    let best = 0;
    for (const s of storms(now)) {
      const dx = (lng - s.lng) * 111 * Math.cos(lat * Math.PI / 180), dy = (lat - s.lat) * 111, d = Math.hypot(dx, dy);
      if (d < s.r) best = Math.max(best, s.s * (1 - d / s.r * 0.6));
    }
    return best;   // 0 calm .. 1 the eye of a full storm
  }

  // ---------------------------------------------------------------- layers
  function visibleBox(g) { const b = document.querySelector(`input[data-g="${g}"]`); return !b || b.checked; }
  function addLayers() {
    if (map.getLayer('sea-life')) return;
    const has = id => !!map.getLayer(id), before = (...ids) => ids.find(has);
    const symBefore = before('animals', 'serpents', 'ships', 'beasts', 'heritage');
    const lineBefore = before('rivers', 'roads');
    const EMPTY = { type: 'FeatureCollection', features: [] };
    for (const s of ['sea-life', 'sea-named', 'sea-rhumb']) if (!map.getSource(s)) map.addSource(s, Object.assign({ type: 'geojson', data: EMPTY, tolerance: 0.5 },
      s === 'sea-named' ? { attribution: 'Sea: shipwrecks from Wikidata (CC0) and NOAA AWOIS; piracy hotspots from Crime at Sea (Benden et al. 2021, CC BY 4.0); ship passages and winds from CLIWOC' } : {}));
    const add = (l, b) => {
      const g = GROUP[l.id]; l.metadata = Object.assign({ group: g }, l.metadata || {});
      map.addLayer(l, b);
      const on = visibleBox(g) && (!l.metadata.winter || (global.InkMap && global.InkMap.isWinter(map)));
      if (!on) map.setLayoutProperty(l.id, 'visibility', 'none');
    };
    const K = ['get', 'k'];
    // rhumb lines: the eight winds in ink, the half winds in green, the quarter winds in red, as on a portolan chart
    add({ id: 'sea-rhumb', type: 'line', source: 'sea-rhumb', maxzoom: 5,
      paint: { 'line-color': ['match', ['get', 'r'], 0, '#2B2119', 1, '#5E7F44', '#A3261B'], 'line-width': iz(0.5, 0.35, 3, 0.55, 5, 0.7),
        'line-opacity': iz(0.5, 0.32, 3.6, 0.32, 4.8, 0) } }, lineBefore);
    // sea life on the nested grid (one layer each for the year-round and the winter-only drawings)
    const life = (id, filter, winter) => add({ id, type: 'symbol', source: 'sea-life', minzoom: 0.9, maxzoom: 10.5, filter: ['all', ZF, filter], metadata: winter ? { winter: true } : {},
      layout: { 'icon-image': ['get', 'i'], 'icon-size': iz(1, 0.75, 3, 0.85, 5, 0.95, 7, 1.1, 9, 1.2), 'icon-overlap': 'never', 'icon-padding': 6, 'symbol-sort-key': ['get', 'z0'] },
      paint: { 'icon-opacity': fade(1, 10.5, z => z < 2 ? 0.5 : z > 9.5 ? Math.max(0, 0.92 * (10.5 - z)) : 0.92) } }, symBefore);
    life('sea-life', ['==', ['get', 'w'], 0], false);
    life('sea-life-w', ['==', ['get', 'w'], 1], true);
    add({ id: 'sea-roses', type: 'symbol', source: 'sea-named', maxzoom: 5, filter: ['==', K, 'rose'],
      layout: { 'icon-image': 'sea-rose', 'icon-size': iz(0.5, 0.8, 2, 1.0, 4, 1.15), 'icon-overlap': 'cooperative', 'icon-padding': 2 },
      paint: { 'icon-opacity': iz(0.5, 0.9, 4.2, 0.9, 4.9, 0) } }, symBefore);
    // named things: mermaids and the kraken; ships (fishing fleets, pirates, ghost ships); wrecks; legends and whirlpools
    // (cooperative: they may sit over the drawn hills and trees, as the hand-placed drawings do, but never over a name)
    const TXT = (min, extra) => Object.assign({ 'text-field': ['step', ['zoom'], '', min, ['get', 'n']], 'text-font': ['Ink Italic'], 'text-size': iz(3, 10, 7, 11.5, 11, 13), 'text-anchor': 'top', 'text-offset': [0, 0.7],
      'text-optional': true, 'text-overlap': 'never', 'text-max-width': 9, 'text-letter-spacing': 0.04 }, extra || {});
    const TP = (c) => ({ 'text-color': c || '#2B4F73', 'text-halo-color': 'rgba(243,229,191,0.92)', 'text-halo-width': 1.4 });
    add({ id: 'sea-named-life', type: 'symbol', source: 'sea-named', filter: ['all', ZF1, ['in', K, ['literal', ['mermaid', 'kraken']]]],
      layout: Object.assign({ 'icon-image': ['get', 'i'], 'icon-size': iz(2.4, ['match', K, 'kraken', 0.8, 0.5], 5, ['match', K, 'kraken', 1.0, 0.6], 7.5, ['match', K, 'kraken', 1.1, 0.8], 10, 1.1, 14, 1.6), 'icon-overlap': 'cooperative', 'icon-padding': 2 }, TXT(10.5)),
      paint: Object.assign({ 'icon-opacity': fade(2, 15, 0.95, true) }, TP('#2B4F73')) }, symBefore);
    add({ id: 'sea-named-ships', type: 'symbol', source: 'sea-named', filter: ['all', ZF1, ['in', K, ['literal', ['fleet', 'pirate', 'ghost']]]],
      layout: Object.assign({ 'icon-image': ['get', 'i'], 'icon-size': iz(3, 0.62, 6, 0.85, 9, 1.0, 12, 1.2), 'icon-overlap': 'cooperative', 'icon-padding': 3, 'symbol-sort-key': ['match', K, 'ghost', 0, 'fleet', 1, 2] },
        TXT(6.2, { 'text-field': ['step', ['zoom'], '', 6.2, ['match', K, 'pirate', '', ['get', 'n']]] })),
      paint: Object.assign({ 'icon-opacity': fade(3, 12, 0.95, true) }, TP('#2B4F73')) }, symBefore);
    add({ id: 'sea-wrecks', type: 'symbol', source: 'sea-named', maxzoom: 7.8, filter: ['all', ZF1, ['==', K, 'wreck']],
      layout: { 'icon-image': ['get', 'i'], 'icon-size': iz(3, 0.55, 5, 0.72, 7, 0.88), 'icon-overlap': 'never', 'icon-padding': 3, 'symbol-sort-key': ['get', 'z0'] },
      paint: { 'icon-opacity': fade(2.5, 7.8, 0.92, true) } }, symBefore);
    add({ id: 'sea-legend', type: 'symbol', source: 'sea-named', filter: ['all', ZF1, ['in', K, ['literal', ['legend', 'atlantis', 'whirl']]]],
      layout: Object.assign({ 'icon-image': ['get', 'i'], 'icon-size': iz(2, ['match', K, 'whirl', 0.6, 0.7], 5, ['match', K, 'whirl', 0.65, 0.95], 8, ['match', K, 'whirl', 1.0, 1.2], 11, ['match', K, 'whirl', 1.5, 1.3], 14, ['match', K, 'whirl', 2.2, 1.3]), 'icon-overlap': 'cooperative', 'icon-padding': 2 },
        TXT(3, { 'text-field': ['step', ['zoom'], ['match', K, 'whirl', '', ['get', 'n']], 7.5, ['get', 'n']], 'text-size': iz(2, 9.5, 5, 11, 9, 12.5), 'text-max-width': 8 })),
      paint: Object.assign({ 'icon-opacity': fade(2, 15, 0.95, true) }, TP('#8A1F16')) }, symBefore);
  }
  function lifeGeo(j) {
    const K = j.kinds, f = [];
    for (const r of j.rows) {
      const k = K[r[2]], i = 'sea-' + (k === 'serpent' ? 'serpent' : k) + r[3];
      f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [r[0], r[1]] }, properties: { k, i, z0: r[4], w: r[5] } });
    }
    return { type: 'FeatureCollection', features: f };
  }

  // ---------------------------------------------------------------- lazy data by zoom (after the first idle only)
  function loadData() {
    const z = map.getZoom(), get = (k, f, fn) => { if (data[k]) return; data[k] = fetch(base + 'data/sea/' + f + '?v=20261103').then(r => r.json()).then(j => { fn(j); return j; }).catch(e => { console.warn('sea', f, e); data[k] = null; }); };
    if (z < 10.5) get('life', 'life.json', j => map.getSource('sea-life').setData(lifeGeo(j)));
    get('named', 'sea.geojson', j => map.getSource('sea-named').setData(j));
    if (z < 5) get('rhumb', 'rhumb.geojson', j => map.getSource('sea-rhumb').setData(j));
    if (z >= 2 && z < 9) get('lanes', 'lanes.json', j => { if (overlay) overlay.setLanes(j.lanes); });
  }

  // ---------------------------------------------------------------- popups
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  function setupPopups() {
    map.on('click', e => {
      if (e.originalEvent && e.originalEvent.__seaDone) return;
      const ids = CLICK.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      const fs = map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ids });
      if (!fs.length) return;
      const p = fs[0].properties; let h;
      if (fs[0].layer.id.startsWith('sea-life')) { const t = LIFE_TXT[p.k] || ['Sea life', '']; h = `<b class="t">${esc(t[0])}</b>${esc(t[1])}`; }
      else h = `<b class="t">${esc(p.n)}</b>${esc(p.d)}${p.q ? `<br><a href="https://www.wikidata.org/wiki/${esc(p.q)}" target="_blank" rel="noopener">Wikidata ${esc(p.q)}</a>` : ''}${p.src ? `<br><span style="color:#7A6A52">${esc(p.src)}</span>` : ''}`;
      const mine = new global.maplibregl.Popup({ closeButton: true, maxWidth: '290px', className: 'ink-sea-pop' }).setLngLat(e.lngLat).setHTML(h).addTo(map);
      setTimeout(() => { for (const el of document.querySelectorAll('.maplibregl-popup')) if (el !== mine.getElement()) el.remove(); }, 0);
    });
    let mt = 0;
    map.on('mousemove', e => {
      const now = performance.now(); if (now - mt < 90) return; mt = now;
      const ids = CLICK.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      if (map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: ids }).length) setTimeout(() => { map.getCanvas().style.cursor = 'pointer'; }, 0);
    });
  }

  // ---------------------------------------------------------------- the overlay: spouts, whirlpools, glimmers, ships under way, storms
  function setupOverlay() {
    const cv = document.createElement('canvas'); cv.className = 'ink-sea-overlay';
    cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none';
    map.getCanvasContainer().appendChild(cv);
    const ctx = cv.getContext('2d');
    const st = { raf: 0, last: 0, moving: false, dirty: false, items: [], lanes: [], movers: [], names: [] };
    overlay = st;
    const resize = () => { const c = map.getCanvas(), dpr = global.devicePixelRatio || 1; cv.width = Math.round(c.clientWidth * dpr); cv.height = Math.round(c.clientHeight * dpr); cv.style.width = c.clientWidth + 'px'; cv.style.height = c.clientHeight + 'px'; };
    resize(); map.on('resize', resize);
    const on = g => visibleBox(g);
    st.setLanes = lanes => {
      st.lanes = lanes.map((l, i) => {
        const P = l.c.map(c => global.maplibregl.MercatorCoordinate.fromLngLat(c)), cum = [0];
        for (let k = 1; k < P.length; k++) { let dx = P[k].x - P[k - 1].x; cum.push(cum[k - 1] + Math.hypot(dx, P[k].y - P[k - 1].y)); }
        return { P, cum, len: cum[cum.length - 1], ph: (i * 0.618034) % 1, s: l.s, n: l.n, y: l.y };
      });
      gather();
    };
    // what is on screen is gathered once the map is at rest (rendered, so it is only what MapLibre placed: never under a name)
    function gather() {
      const z = map.getZoom(), W = cv.width / (global.devicePixelRatio || 1), H = cv.height / (global.devicePixelRatio || 1), items = [];
      const lay = ['sea-life', 'sea-named-life', 'sea-named-ships', 'sea-legend'].filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      if (lay.length) for (const f of map.queryRenderedFeatures({ layers: lay })) {
        const p = f.properties, i = String(p.i || '');
        const kind = /^sea-whale[01]$/.test(i) ? 'spout' : p.k === 'whirl' ? 'whirl' : p.k === 'ghost' ? 'ghost' : null;
        if (!kind) continue;
        const pt = map.project(f.geometry.coordinates);
        if (pt.x < -40 || pt.y < -40 || pt.x > W + 40 || pt.y > H + 40) continue;
        items.push({ kind, x: pt.x, y: pt.y, i, ph: (pt.x * 0.013 + pt.y * 0.007) % 1 });
        if (items.length > 60) break;
      }
      st.items = items;
      // only the passages that come into view (with a margin) are animated
      st.movers = [];
      if (on('seaships') && z >= 2.4 && z < 8.6 && st.lanes.length) {
        const b = map.getBounds(), w = b.getWest(), e = b.getEast(), n = b.getNorth(), s = b.getSouth(), mx = (e - w) * 0.2, my = (n - s) * 0.2;
        const lo = global.maplibregl.MercatorCoordinate.fromLngLat([w - mx, Math.min(85, n + my)]), hi = global.maplibregl.MercatorCoordinate.fromLngLat([e + mx, Math.max(-85, s - my)]);
        st.movers = st.lanes.filter(l => l.P.some(p => p.x >= lo.x && p.x <= hi.x && p.y >= lo.y && p.y <= hi.y));
      }
      // name anchors on screen, so a ship under way never sails across a name
      st.names = [];
      if (st.movers.length) {
        const txt = map.getStyle().layers.filter(l => l.type === 'symbol' && l.layout && l.layout['text-field'] && map.getLayoutProperty(l.id, 'visibility') !== 'none').map(l => l.id);
        try { for (const f of map.queryRenderedFeatures({ layers: txt })) { if (f.geometry.type !== 'Point') { continue; } const q = map.project(f.geometry.coordinates), nm = String(f.properties.name || f.properties.n || f.properties.name_en || ''); st.names.push([q.x, q.y, Math.min(110, 6 + nm.length * 3.8)]); if (st.names.length > 300) break; } } catch (e) {}
      }
      start();
    }
    st.gather = gather;
    let gt = null;
    const regather = () => { clearTimeout(gt); gt = setTimeout(() => { if (map.isMoving()) regather(); else gather(); }, 300); };
    map.on('moveend', regather); map.on('idle', regather);
    const active = () => !document.hidden && (st.items.length || st.movers.length);
    function clear() { if (st.dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); st.dirty = false; } }
    function stop() { if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; clear(); cv.style.display = 'none'; }
    function start() { if (!st.raf && !st.moving && active()) { cv.style.display = ''; st.raf = requestAnimationFrame(frame); } else if (!active()) stop(); }
    st.start = start; st.stop = stop;
    map.on('movestart', () => { st.moving = true; stop(); });
    // (it starts again only once the map has rested for a moment and the view is gathered afresh, so a run of short pans
    // never flashes the canvas on and off between them)
    map.on('moveend', () => { st.moving = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    const spr = id => A() && A().draw(id), SC = 3;
    function frame(now) {
      st.raf = requestAnimationFrame(frame);
      if (now - st.last < 50) return; st.last = now;
      if (!active()) { stop(); return; }
      const t0 = performance.now();
      try { draw(now); } finally { const d = performance.now() - t0; st.frames = (st.frames || 0) + 1; st.ms = (st.ms || 0) + d; st.maxMs = Math.max(st.maxMs || 0, d); }
    }
    function draw(now) {
      const dpr = global.devicePixelRatio || 1, z = map.getZoom();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); st.dirty = true;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = cv.width / dpr, H = cv.height / dpr, ts = now / 1000;
      const sz = Math.max(0.55, Math.min(1.15, 0.55 + (z - 1.5) * 0.1));
      for (const it of st.items) {
        if (it.kind === 'spout') {
          // a puff of spray rising and falling over the whale's blowhole every few seconds
          const k = (ts / 3.4 + it.ph) % 1; if (k > 0.45) continue;
          const a = Math.sin(k / 0.45 * Math.PI), bx = it.x + (it.i === 'sea-whale0' ? -10.6 : -5.6) * sz * 1.0, by = it.y - (it.i === 'sea-whale0' ? 9 : 9.6) * sz;
          ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = '#6F9DC6'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + s * 2 * sz, by - 7 * a * sz, bx + s * 5 * a * sz, by - 9 * a * sz); ctx.stroke(); }
          ctx.fillStyle = '#7FA3C4'; for (let d = 0; d < 5; d++) { ctx.beginPath(); ctx.arc(bx + (d - 2) * 2.4 * a * sz, by - (9 + (d % 2) * 1.6) * a * sz, 0.9, 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else if (it.kind === 'whirl') {
          const c = spr('sea-whirl'); if (!c) continue;
          const s = z < 8 ? 0.7 + (z - 5.5) * 0.12 : z < 11 ? 1.0 + (z - 8) * 0.167 : Math.min(2.2, 1.5 + (z - 11) * 0.233), w = c.width / SC * s, h = c.height / SC * s;
          ctx.save(); ctx.translate(it.x, it.y); ctx.scale(1, 0.55); ctx.rotate(-ts * 0.9); ctx.scale(1, 1 / 0.55); ctx.globalAlpha = 0.55; ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore(); ctx.globalAlpha = 1;
        } else if (it.kind === 'ghost') {
          // a pale glimmer that comes and goes about the ghost ship
          const a = 0.5 + 0.5 * Math.sin(ts * 1.3 + it.ph * 6);
          const g = ctx.createRadialGradient(it.x, it.y - 12 * sz, 1, it.x, it.y - 12 * sz, 26 * sz);
          g.addColorStop(0, `rgba(200,236,210,${0.35 * a})`); g.addColorStop(1, 'rgba(200,236,210,0)');
          ctx.fillStyle = g; ctx.fillRect(it.x - 30 * sz, it.y - 42 * sz, 60 * sz, 60 * sz);
        }
      }
      // merchant ships under way along their logbook passages (a passage takes about four minutes on screen)
      if (st.movers.length) {
        const pxU = 512 * Math.pow(2, z), c = spr('sea-merchant'), cl = spr('sea-merchant-l'); let n = 0;
        if (c) for (const m of st.movers) {
          if (n >= 16) break;
          const d = ((ts / 240 + m.ph) % 1) * m.len;
          let i = 1; while (i < m.cum.length - 1 && m.cum[i] < d) i++;
          const a = m.P[i - 1], b = m.P[i], u = (d - m.cum[i - 1]) / ((m.cum[i] - m.cum[i - 1]) || 1);
          const mx = a.x + (b.x - a.x) * u, my = a.y + (b.y - a.y) * u;
          const p = map.project(new global.maplibregl.MercatorCoordinate(mx, my, 0).toLngLat());
          if (p.x < -30 || p.y < -30 || p.x > W + 30 || p.y > H + 30) continue;
          if (st.names.some(q => Math.abs(q[0] - p.x) < q[2] / 2 + 16 && p.y > q[1] - 10 && p.y - 30 < q[1] + 10)) continue;
          const sp = (b.x - a.x) < 0 ? cl : c, s = Math.max(0.5, Math.min(1.0, 0.5 + (z - 2.4) * 0.09)), w = sp.width / SC * s, h = sp.height / SC * s;
          const bob = Math.sin(ts * 2 + m.ph * 9) * 0.6;
          ctx.globalAlpha = Math.min(1, (z - 2.4) * 2, (8.6 - z) * 2); ctx.drawImage(sp, p.x - w / 2, p.y - h * 0.86 + bob, w, h); ctx.globalAlpha = 1; n++;
        }
      }
    }
    gather();
  }

  // ---------------------------------------------------------------- wind-heads at the map's edges, far out
  function setupHeads() {
    const host = map.getContainer();
    const st = document.createElement('style');
    st.textContent = `.sea-wh{position:absolute;z-index:2;pointer-events:none;display:none;opacity:.82}.sea-wh.on{display:block}.sea-wh.up{opacity:1}
.sea-wh canvas{display:block;width:84px}.sea-rest .sea-wh canvas{animation:seaPuff 3.4s ease-in-out infinite}
.sea-wh.w{left:4px;top:50%;margin-top:-23px}.sea-wh.e{right:52px;top:50%;margin-top:-23px;transform:scaleX(-1)}
.sea-wh.n{left:50%;top:58px;margin-left:-42px;transform:rotate(90deg)}.sea-wh.s{left:50%;bottom:64px;margin-left:-42px;transform:rotate(-90deg)}
@keyframes seaPuff{0%,100%{transform:translateX(0) scale(1)}50%{transform:translateX(2px) scale(1.04)}}
@media (prefers-reduced-motion:reduce){.sea-wh canvas{animation:none}}
@media (max-width:600px){.sea-wh canvas{width:60px}.sea-wh.n{display:none}}
body.clean .sea-wh{display:none}`;
    document.head.appendChild(st);
    heads = {};
    for (const side of ['w', 'e', 'n', 's']) {
      const d = document.createElement('div'); d.className = 'sea-wh ' + side; d.setAttribute('aria-hidden', 'true');
      const c = A().draw('sea-windhead'), cc = document.createElement('canvas'); cc.width = c.width; cc.height = c.height; cc.getContext('2d').drawImage(c, 0, 0);
      d.appendChild(cc); host.appendChild(d); heads[side] = d;
    }
    // the heads puff only once the map has rested a moment (never during a pan)
    map.on('movestart', () => { clearTimeout(setupHeads.t); host.classList.remove('sea-rest'); });
    map.on('moveend', () => { clearTimeout(setupHeads.t); setupHeads.t = setTimeout(() => { if (!map.isMoving()) host.classList.add('sea-rest'); }, 600); });
    const sync = () => {
      const show = map.getZoom() < 3.6 && visibleBox('seachart');
      // the head on the side the wind comes from (at the centre of the view) blows hardest
      let up = null;
      if (global.InkWind) { const c = map.getCenter(), w = global.InkWind.at(c.lng, c.lat); const f = w.from; up = f >= 315 || f < 45 ? 'n' : f < 135 ? 'e' : f < 225 ? 's' : 'w'; }
      for (const [side, d] of Object.entries(heads)) {
        let ok = show;
        if (ok) {   // never over a name: hide a head that would cover lettering
          d.style.visibility = 'hidden'; d.classList.add('on'); const r = d.getBoundingClientRect(), h = host.getBoundingClientRect(); d.style.visibility = '';
          const bb = [[r.left - h.left, r.top - h.top], [r.right - h.left, r.bottom - h.top]];
          try { const txt = map.getStyle().layers.filter(l => l.type === 'symbol' && l.layout && l.layout['text-field'] && map.getLayoutProperty(l.id, 'visibility') !== 'none').map(l => l.id); if (map.queryRenderedFeatures(bb, { layers: txt }).length) ok = false; } catch (e) {}
        }
        d.classList.toggle('on', ok); d.classList.toggle('up', side === up);
      }
    };
    map.on('idle', () => { clearTimeout(sync.t); sync.t = setTimeout(sync, 200); });
    map.on('zoom', () => { if (map.getZoom() >= 3.6) for (const d of Object.values(heads)) d.classList.remove('on'); });
    const box = document.querySelector('input[data-g="seachart"]'); if (box) box.addEventListener('change', sync);
    sync();
  }

  // ---------------------------------------------------------------- the key and the panel
  function setupKey() {
    const el = document.getElementById('key'); if (!el || el.querySelector('.ink-sea-key')) return;
    const K = [['sea-whale1', 'Whale, with its spout'], ['sea-dolphin0', 'Dolphins'], ['sea-flyfish0', 'Flying fish in the warm seas'], ['sea-serpent0', 'Sea serpent <i>(decorative)</i>'], ['sea-kraken0', 'Kraken <i>(decorative)</i>'],
      ['sea-berg0', 'Iceberg (more in the winter look)'], ['sea-floe1', 'Sea ice (winter look)'], ['sea-mermaid', 'Mermaid where a legend puts one'], ['sea-fleet0', 'Fishing fleet on a real bank'],
      ['sea-merchant', 'Merchant ship on a CLIWOC passage'], ['sea-pirate', 'Pirate ship at a piracy hotspot'], ['sea-ghost', 'Ghost ship of legend'], ['sea-wreckchest', 'Notable shipwreck (chest: sailing-era, decorative)'],
      ['sea-whirl', 'Whirlpool'], ['sea-legend0', 'Island of legend (never found)'], ['sea-rose', 'Compass rose and rhumb lines'], ['sea-windhead', 'Wind-head at the edge of the world'], ['sea-storm', 'Storm (when you are at sea)']];
    const hd = document.createElement('h3'); hd.textContent = 'The sea'; hd.className = 'ink-sea-key'; el.appendChild(hd);
    for (const [id, label] of K) {
      const c = A().draw(id); if (!c) continue;
      const cc = document.createElement('canvas'); cc.width = c.width; cc.height = c.height; cc.getContext('2d').drawImage(c, 0, 0);
      cc.style.width = Math.min(52, c.width / 3 * 1.2) + 'px';
      const d = document.createElement('div'); d.appendChild(cc); const sp = document.createElement('span'); sp.innerHTML = label; d.appendChild(sp); el.appendChild(d);
    }
  }
  function whenKeyShown(fn) {
    const el = document.getElementById('key');
    if (!el || !('IntersectionObserver' in global)) { setTimeout(fn, 4000); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(fn, 0); } }, { rootMargin: '600px' });
    io.observe(el);
  }

  // ---------------------------------------------------------------- set-up (after the first idle: see index.html)
  function attach(m, opts) {
    if (map) return; map = m; base = (opts && opts.base) || new URL('./', location.href).href;
    map.on('styleimagemissing', e => { if (/^sea-/.test(e.id) && A() && !map.hasImage(e.id)) A().addOne(map, e.id); });
    const off = (new URLSearchParams(location.search).get('seaoff') || '').split(',');   // QA only: leave parts out to time them
    if (off.includes('all')) return;
    try { if (!off.includes('layers')) addLayers(); } catch (e) { console.warn('sea layers', e); }
    loadWind();
    if (map.getSource('sea-life')) { loadData(); map.on('zoomend', loadData); }
    try { setupPopups(); } catch (e) { console.warn('sea popups', e); }
    try { if (!off.includes('overlay')) setupOverlay(); } catch (e) { console.warn('sea overlay', e); }
    try { if (!off.includes('heads')) setupHeads(); } catch (e) { console.warn('sea heads', e); }
    whenKeyShown(() => { try { setupKey(); } catch (e) { console.warn('sea key', e); } });
    // the panel's Sea switches also start and stop the animation
    for (const g of ['sealife', 'seaships', 'sealegend']) { const b = document.querySelector(`input[data-g="${g}"]`); if (b) b.addEventListener('change', () => setTimeout(() => overlay && overlay.gather(), 50)); }
    map.on('inkwinter', () => setTimeout(() => overlay && overlay.gather(), 300));
  }
  global.InkSea = {
    attach, storms, stormAt, state: () => overlay,
    setSailing(on) {
      // storms are drawn as map layers (they move with the map while the camera follows the boat), refreshed every few seconds
      if (!map) return;
      if (on && !map.getSource('sea-storms')) {
        map.addSource('sea-storms', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        const b = ['sea-named-ships', 'sea-life'].find(id => map.getLayer(id));
        map.addLayer({ id: 'sea-storm-area', type: 'circle', source: 'sea-storms', maxzoom: 11, metadata: { group: 'traveller' },
          paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, ['get', 'rp'], 12, ['*', ['get', 'rp'], 4096]], 'circle-color': '#4A4E55', 'circle-opacity': ['*', 0.16, ['get', 's']], 'circle-blur': 0.8, 'circle-pitch-alignment': 'map' } }, b);
        map.addLayer({ id: 'sea-storms', type: 'symbol', source: 'sea-storms', maxzoom: 11, metadata: { group: 'traveller' },
          layout: { 'icon-image': 'sea-storm', 'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 6, 1.3, 10, 1.6], 'icon-overlap': 'never', 'icon-padding': 0 },
          paint: { 'icon-opacity': ['+', 0.45, ['*', 0.5, ['get', 's']]] } }, b);
      }
      clearInterval(this._st);
      const upd = () => { const src = map.getSource('sea-storms'); if (!src) return; src.setData({ type: 'FeatureCollection', features: storms().filter(x => x.s > 0.12).map(x => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { s: Math.round(x.s * 100) / 100, rp: x.r / (40075 * Math.cos(x.lat * Math.PI / 180) / 512) } })) }); };
      for (const id of ['sea-storm-area', 'sea-storms']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      if (on) { upd(); this._st = setInterval(upd, 4000); }
    },
    loadWind: () => loadWind(),
  };
})(window);
