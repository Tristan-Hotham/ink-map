/* The Inked World: "Where's the Cartographer?" Hidden folk at the deepest zoom, a found counter with region tallies,
 * riddles, a found list with fly-to, hint mode, treasure trails, progress saved in this browser.
 * Data: data/folk/folk.json (loaded lazily). Sprites: js/ink-folk-art.js (drawn once each, only when first needed).
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const STORE = 'inkFolk.v1', MINZ = 15, BIGZ = 12;
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } };
  const save = s => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* private window: progress lasts this visit */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let map = null, DATA = null, BYID = new Map(), loading = null, ui = {}, state = load();
  state.found = state.found || {}; state.hint = !!state.hint;
  const listeners = [];

  // ------------------------------------------------------------------ styles (kept here so the page needs only a script tag)
  const CSS = `
.folk-badge{position:absolute;left:10px;bottom:118px;z-index:6;display:flex;align-items:center;gap:7px;font:500 12px/1 var(--mono,monospace);background:rgba(251,245,228,.95);color:#2B2119;border:1px solid #9C8656;border-radius:999px;padding:6px 11px 6px 7px;cursor:pointer;box-shadow:0 1px 4px rgba(60,40,10,.2);min-height:34px}
.folk-badge:hover{background:#EFE1BC}.folk-badge canvas{width:22px;height:22px}
.folk-badge b{color:#A3261B;font-weight:600}.folk-badge .nb{display:none;color:#3D6E9E;font-style:italic}.folk-badge.near .nb{display:inline}
.folk-panel{position:absolute;left:10px;bottom:160px;z-index:7;width:min(380px,calc(100% - 20px));max-height:calc(100% - 180px);overflow:auto;background:rgba(251,245,228,.985);color:#2B2119;border:1px solid #9C8656;border-radius:4px;box-shadow:0 3px 14px rgba(60,40,10,.3);font:400 13px/1.4 var(--mono,monospace);display:none;padding:12px 14px 10px}
.folk-panel.open{display:block}
.folk-panel h4{margin:0 0 2px;font:400 22px/1.1 var(--hand,serif);color:#A3261B;letter-spacing:.02em}
.folk-panel .sub{color:#6E604E;margin:0 0 8px;font-size:12px}
.folk-panel .bar{height:6px;background:#E7D9B6;border-radius:3px;overflow:hidden;margin:4px 0 10px}.folk-panel .bar i{display:block;height:100%;background:#B8862B}
.folk-tabs{display:flex;gap:4px;margin:0 0 8px;flex-wrap:wrap}.folk-tabs button{font:500 11px/1 var(--mono,monospace);letter-spacing:.05em;text-transform:uppercase;background:none;border:1px solid #C9B583;border-radius:999px;padding:7px 10px;cursor:pointer;color:#6E604E;min-height:30px}
.folk-tabs button[aria-selected=true]{background:#2B2119;color:#F6EED8;border-color:#2B2119}
.folk-reg{border-top:1px solid #E2D3AE}.folk-reg>button{all:unset;box-sizing:border-box;display:flex;justify-content:space-between;width:100%;padding:8px 2px;cursor:pointer;min-height:34px;align-items:center}
.folk-reg>button span:last-child{color:#6E604E}.folk-reg>button:focus-visible{outline:2px solid #A3261B}
.folk-reg ul{list-style:none;margin:0 0 8px;padding:0}.folk-reg li{padding:6px 0 6px 10px;border-left:2px solid #E2D3AE;margin:4px 0}
.folk-reg li.f{border-left-color:#B8862B}.folk-reg li .n{font-weight:600;color:#A3261B}.folk-reg li .p{color:#6E604E;font-size:12px}
.folk-reg li .r{font-family:var(--body,Georgia,serif);font-style:italic;font-size:14px;line-height:1.4}
.folk-fly{font:500 11px/1 var(--mono,monospace);background:#2B2119;color:#F6EED8;border:0;border-radius:999px;padding:6px 10px;margin-top:4px;cursor:pointer;min-height:28px}
.folk-set label{display:flex;gap:8px;align-items:center;padding:6px 0;cursor:pointer;min-height:32px}.folk-set input{accent-color:#A3261B;width:16px;height:16px}
.folk-set p{color:#6E604E;font-size:12px;margin:2px 0 8px}
.folk-set .danger{font:500 11px/1 var(--mono,monospace);background:none;border:1px solid #A3261B;color:#A3261B;border-radius:999px;padding:7px 10px;cursor:pointer;margin-top:6px}
.folk-trail{border-top:1px solid #E2D3AE;padding:8px 0}.folk-trail b{color:#A3261B}.folk-trail .st{display:flex;gap:3px;margin:5px 0}.folk-trail .st i{width:14px;height:6px;border-radius:2px;background:#E7D9B6}.folk-trail .st i.on{background:#B8862B}
.folk-trail .clue{font-family:var(--body,Georgia,serif);font-style:italic;font-size:14px}
.maplibregl-popup.folk-pop .maplibregl-popup-content{background:#FBF5E4;border:2px solid #B8862B;padding:12px 14px;max-width:300px;animation:folkIn .55s cubic-bezier(.2,1.6,.4,1)}
.folk-pop .fan{display:block;font:400 13px/1 var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:#B8862B;margin-bottom:4px}
.folk-pop .t{display:block;font:400 21px/1.1 var(--hand,serif);color:#A3261B;margin-bottom:4px}
.folk-pop .pl{color:#6E604E;font-size:12px;margin:0 0 6px}.folk-pop .rd{font-family:var(--body,Georgia,serif);font-style:italic;margin:0 0 6px}
.folk-pop .cl{border-top:1px dashed #C9B583;padding-top:6px;margin-top:6px;font-family:var(--body,Georgia,serif)}.folk-pop .cl b{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#B8862B;font-weight:500}
.folk-pop .ct{color:#6E604E;font-size:12px}
.folk-burst{position:absolute;pointer-events:none;z-index:8;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:3px solid rgba(184,134,43,.9);animation:folkBurst .9s ease-out forwards}
@keyframes folkIn{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes folkBurst{from{transform:scale(.15);opacity:1}to{transform:scale(1.4);opacity:0}}
@media (max-width:600px){.folk-badge{bottom:96px}.folk-panel{left:8px;right:8px;width:auto;bottom:138px;max-height:calc(100% - 230px)}}
body.clean .folk-badge,body.clean .folk-panel{display:none!important}
@media (prefers-reduced-motion:reduce){.maplibregl-popup.folk-pop .maplibregl-popup-content,.folk-burst{animation:none}}
`;

  // ------------------------------------------------------------------ data
  function fetchData() {
    if (loading) return loading;
    const base = (map && map.__inkBase) || new URL('./', location.href).href;
    loading = fetch(base + 'data/folk/folk.json?v=20261104').then(r => r.json()).then(d => {
      DATA = d; d.folk.forEach(f => BYID.set(f.id, f));
      addLayers(); refresh(); listeners.forEach(fn => { try { fn(d); } catch (e) { console.warn(e); } });
      return d;
    }).catch(e => { console.warn('folk data', e); loading = null; });
    return loading;
  }
  function geo() {
    return { type: 'FeatureCollection', features: DATA.folk.map((f, i) => ({ type: 'Feature', id: i, geometry: { type: 'Point', coordinates: [f.lon, f.lat] }, properties: { id: f.id, sid: 'folk-' + f.id, f: state.found[f.id] ? 1 : 0, big: f.big ? 1 : 0 } })) };
  }

  // ------------------------------------------------------------------ the map layers
  function beforeId() {
    // above the drawn towns and trees so nobody is buried for ever, below the heritage pictograms and every name
    for (const id of ['heritage', 'landmarks-near', 'hills', 'xplaces']) if (map.getLayer(id)) return id;
    return undefined;
  }
  function addLayers() {
    if (!DATA || map.getSource('folk')) return;
    map.addSource('folk', { type: 'geojson', data: geo() });
    const b = beforeId();
    map.addLayer({ id: 'folk-found', type: 'circle', source: 'folk', minzoom: MINZ - 0.3, filter: ['all', ['==', ['get', 'f'], 1], ['==', ['get', 'big'], 0]],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 13, 16, 17], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#B8862B', 'circle-stroke-width': 1.4, 'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 14.7, 0, 15.2, 0.75], 'circle-translate': [0, -9] },
      metadata: { group: 'folk' } }, b);
    map.addLayer({ id: 'folk', type: 'symbol', source: 'folk', minzoom: MINZ - 0.3, filter: ['==', ['get', 'big'], 0],
      layout: { 'icon-image': ['get', 'sid'], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.92, 16, 1.12, 17, 1.3] },
      paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 14.7, 0, 15.1, 1] }, metadata: { group: 'folk' } }, b);
    map.addLayer({ id: 'folk-big', type: 'symbol', source: 'folk', minzoom: BIGZ - 0.3, filter: ['==', ['get', 'big'], 1],
      layout: { 'icon-image': ['get', 'sid'], 'icon-anchor': 'center', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 12, 0.6, 14, 1.2, 16, 2.4] },
      paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11.7, 0, 12.2, 1] }, metadata: { group: 'folk' } }, b);
    // hint rings: a faint circle somewhere near (never centred on) an unfound figure
    map.addSource('folk-hint', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'folk-hint', type: 'circle', source: 'folk-hint', minzoom: 9,
      paint: { 'circle-radius': 40, 'circle-color': 'rgba(184,134,43,0.06)', 'circle-stroke-color': '#B8862B', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.5, 'circle-pitch-alignment': 'map' }, metadata: { group: 'folk' } });
  }
  // sprites are drawn the first time MapLibre asks for them (only figures in view at zoom 15+ ever get drawn)
  const drawn = new Set();
  function onMissing(e) {
    const id = e.id; if (!id || id.indexOf('folk-') !== 0 || !DATA || drawn.has(id)) return;
    const f = BYID.get(id.slice(5)); if (!f || !global.InkFolkArt) return;
    drawn.add(id);
    try {
      const c = global.InkFolkArt.render(f.art, 3);
      map.addImage(id, c.getContext('2d').getImageData(0, 0, c.width, c.height), { pixelRatio: 3 });
    } catch (err) { console.warn('folk sprite', id, err); }
  }
  function refresh() {
    if (!DATA) return;
    const src = map.getSource('folk'); if (src) src.setData(geo());
    updateBadge(); if (ui.panel && ui.panel.classList.contains('open')) renderPanel();
  }

  // ------------------------------------------------------------------ finding
  function hitAt(point, pad) {
    if (!map.getLayer('folk')) return null;
    const p = pad || 9, bb = [[point.x - p, point.y - p * 1.6], [point.x + p, point.y + p * 0.6]];
    const fs = map.queryRenderedFeatures(bb, { layers: ['folk', 'folk-big'].filter(l => map.getLayer(l)) });
    return fs.length ? fs[0].properties.id : null;
  }
  function markFound(id, how) {
    const f = BYID.get(id); if (!f) return false;
    const fresh = !state.found[id];
    if (fresh) { state.found[id] = Date.now(); save(state); }
    refresh(); fanfare(f, fresh, how);
    return fresh;
  }
  function fanfare(f, fresh, how) {
    document.querySelectorAll('.maplibregl-popup:not(.folk-pop)').forEach(p => p.remove());
    setTimeout(() => document.querySelectorAll('.maplibregl-popup:not(.folk-pop)').forEach(p => p.remove()), 0);
    const n = Object.keys(state.found).filter(k => BYID.has(k)).length, N = DATA.folk.length;
    let trails = '';
    (f.trails || []).forEach(t => {
      const meta = DATA.trails.find(x => x.id === t.t);
      trails += `<div class="cl"><b>${esc(meta ? meta.name : 'Trail')} · ${t.n} of ${t.of}</b><br>${esc(t.clue)}</div>`;
    });
    const html = `<span class="fan">${fresh ? (how === 'bump' ? 'You bumped into' : 'Found!') : 'Found already'}</span><b class="t">${esc(f.name)}</b><p class="pl">${esc(f.place)}</p><p class="rd">${esc(f.riddle)}</p>${trails}<p class="ct">${n} of ${N} found · ${regionCount(f.region)} in ${esc(f.region)}</p>`;
    new global.maplibregl.Popup({ className: 'folk-pop', closeButton: true, maxWidth: '300px', offset: f.big ? 30 : 22 }).setLngLat([f.lon, f.lat]).setHTML(html).addTo(map);
    if (fresh && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const pt = map.project([f.lon, f.lat]), b = document.createElement('div'); b.className = 'folk-burst'; b.style.left = pt.x + 'px'; b.style.top = (pt.y - 10) + 'px';
      map.getContainer().appendChild(b); setTimeout(() => b.remove(), 1000);
      if (ui.badge) { ui.badge.animate && ui.badge.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 500 }); }
    }
  }
  function regionCount(r) {
    const all = DATA.folk.filter(f => f.region === r); return `${all.filter(f => state.found[f.id]).length} of ${all.length}`;
  }

  // ------------------------------------------------------------------ badge and panel
  function badgeIcon() {
    const c = document.createElement('canvas'); c.width = 66; c.height = 66;
    try { const s = global.InkFolkArt.render({ w: 18, h: 22, figs: [{ t: 'person', x: 9, y: 21, garb: 'gown', c1: 'woad', c3: 'madder', cloak: true, hat: 'chaperon', hatc: 'madder', prop: 'map', arms: ['chest', 'down'], beard: 1, hair: 'grey', skin: 'ruddy' }] }, 3); const x = c.getContext('2d'); const k = Math.min(66 / s.width, 66 / s.height); x.drawImage(s, (66 - s.width * k) / 2, (66 - s.height * k) / 2, s.width * k, s.height * k); } catch (e) {}
    return c;
  }
  function buildUI() {
    const st = document.createElement('style'); st.id = 'folk-style'; st.textContent = CSS; document.head.appendChild(st);
    const host = map.getContainer();
    const b = ui.badge = document.createElement('button'); b.className = 'folk-badge'; b.type = 'button'; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
    b.title = "Where's the Cartographer? Hidden folk at the closest zoom";
    b.appendChild(badgeIcon()); const sp = document.createElement('span'); sp.className = 'tx'; sp.innerHTML = "Where's the Cartographer?"; b.appendChild(sp);
    const nb = document.createElement('span'); nb.className = 'nb'; nb.textContent = 'something stirs nearby'; b.appendChild(nb);
    host.appendChild(b);
    const p = ui.panel = document.createElement('div'); p.className = 'folk-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', "Where's the Cartographer?");
    host.appendChild(p);
    b.addEventListener('click', e => { e.stopPropagation(); const o = !p.classList.contains('open'); p.classList.toggle('open', o); b.setAttribute('aria-expanded', String(o)); if (o) { fetchData().then(renderPanel); renderPanel(); } });
    p.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && p.classList.contains('open')) { p.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); b.focus(); } });
    ['mousedown', 'touchstart', 'wheel', 'dblclick'].forEach(ev => p.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  }
  function updateBadge() {
    if (!ui.badge) return;
    const tx = ui.badge.querySelector('.tx');
    if (!DATA) { const n = Object.keys(state.found).length; tx.innerHTML = n ? `Found <b>${n}</b>` : "Where's the Cartographer?"; return; }
    const n = DATA.folk.filter(f => state.found[f.id]).length;
    tx.innerHTML = `Found <b>${n}</b> of ${DATA.folk.length}`;
  }
  let tab = 'regions', openReg = null;
  function renderPanel() {
    const p = ui.panel; if (!p) return;
    if (!DATA) { p.innerHTML = '<h4>Where\'s the Cartographer?</h4><p class="sub">Unrolling the list of hidden folk…</p>'; return; }
    const N = DATA.folk.length, n = DATA.folk.filter(f => state.found[f.id]).length;
    let h = `<h4>Where's the Cartographer?</h4><p class="sub">${N} small folk are hidden across the world, drawn only at the closest zoom. Read a riddle, go there, zoom right in and tap one when you spot it.</p>
      <div class="bar" aria-hidden="true"><i style="width:${(100 * n / N).toFixed(1)}%"></i></div><p class="sub" style="margin-top:-6px">Found <b style="color:#A3261B">${n}</b> of ${N}</p>
      <div class="folk-tabs" role="tablist">${[['regions', 'Riddles'], ['found', 'Found'], ['trails', 'Trails'], ['set', 'Settings']].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
    if (tab === 'regions') {
      for (const r of DATA.regions) {
        const all = DATA.folk.filter(f => f.region === r), got = all.filter(f => state.found[f.id]).length;
        h += `<div class="folk-reg"><button data-reg="${esc(r)}" aria-expanded="${openReg === r}"><span>${esc(r)}</span><span>${got} / ${all.length}</span></button>`;
        if (openReg === r) {
          h += '<ul>' + all.map(f => state.found[f.id]
            ? `<li class="f"><span class="n">${esc(f.name)}</span><br><span class="p">${esc(f.place)}</span><br><button class="folk-fly" data-fly="${esc(f.id)}">Fly to</button></li>`
            : `<li><span class="r">${esc(f.riddle)}</span></li>`).join('') + '</ul>';
        }
        h += '</div>';
      }
    } else if (tab === 'found') {
      const got = DATA.folk.filter(f => state.found[f.id]).sort((a, b) => state.found[b.id] - state.found[a.id]);
      h += got.length ? '<div class="folk-reg"><ul>' + got.map(f => `<li class="f"><span class="n">${esc(f.name)}</span><br><span class="p">${esc(f.place)} · ${esc(f.region)}</span><br><span class="r">${esc(f.riddle)}</span><br><button class="folk-fly" data-fly="${esc(f.id)}">Fly to</button></li>`).join('') + '</ul></div>'
        : '<p class="sub">Nobody found yet. Try the riddles, or start with the lost Cartographer somewhere high in the English Lakes.</p>';
    } else if (tab === 'trails') {
      h += '<p class="sub">Some of the folk lead on to others. Find one on a trail to read the clue to the next.</p>';
      for (const t of DATA.trails) {
        const steps = t.steps.map(id => BYID.get(id)), got = steps.filter(f => f && state.found[f.id]);
        let last = null; for (const f of steps) if (f && state.found[f.id]) last = f;
        const tr = last && (last.trails || []).find(x => x.t === t.id);
        h += `<div class="folk-trail"><b>${esc(t.name)}</b> <span class="sub">${got.length} of ${steps.length}</span><div class="st">${steps.map(f => `<i class="${f && state.found[f.id] ? 'on' : ''}"></i>`).join('')}</div>`
          + (tr ? `<div class="clue">${esc(tr.clue)}</div>` : `<div class="clue">Start: ${esc(steps[0].riddle)}</div>`) + '</div>';
      }
    } else {
      h += `<div class="folk-set"><label><input type="checkbox" id="folkHint" ${state.hint ? 'checked' : ''}> Hint mode</label><p>A faint gold ring pulses somewhere close to a hidden figure when you are within about 5 km of one.</p>
        <label><input type="checkbox" id="folkShow" ${map.getLayer('folk') && map.getLayoutProperty('folk', 'visibility') === 'none' ? '' : 'checked'}> Show the hidden folk</label>
        ${global.InkTraveller ? '<label><input type="checkbox" id="folkTrav" ' + (global.InkTraveller.active() ? 'checked' : '') + '> Your traveller</label><p>Walk the roads yourself at the closest zoom (arrow keys or WASD, or tap where to go). Bumping into a hidden figure counts as finding it.</p><button class="folk-fly" id="folkTravEdit" type="button">Dress your traveller</button>' : ''}
        <p>Progress is kept in this browser only.</p>
        <p>Every figure is an original drawing. Places from Wikidata (CC0) through the map's heritage layer, Natural Earth, Beresford's gazetteer of deserted medieval villages, and the battle, monastic house and pilgrimage lists of my other data studies; some placed by hand.</p><button class="danger" id="folkReset" type="button">Forget everyone I have found</button></div>`;
    }
    p.innerHTML = h;
    p.querySelectorAll('[data-tab]').forEach(x => x.addEventListener('click', () => { tab = x.dataset.tab; renderPanel(); }));
    p.querySelectorAll('[data-reg]').forEach(x => x.addEventListener('click', () => { openReg = openReg === x.dataset.reg ? null : x.dataset.reg; renderPanel(); }));
    p.querySelectorAll('[data-fly]').forEach(x => x.addEventListener('click', () => flyTo(x.dataset.fly)));
    const hb = p.querySelector('#folkHint'); if (hb) hb.addEventListener('change', () => { state.hint = hb.checked; save(state); hint(); });
    const sb = p.querySelector('#folkShow'); if (sb) sb.addEventListener('change', () => { ['folk', 'folk-found', 'folk-big'].forEach(l => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', sb.checked ? 'visible' : 'none')); });
    const tb = p.querySelector('#folkTrav'); if (tb) tb.addEventListener('change', () => { global.InkTraveller.setActive(tb.checked); });
    const te = p.querySelector('#folkTravEdit'); if (te) te.addEventListener('click', () => global.InkTraveller.dress());
    const rb = p.querySelector('#folkReset'); if (rb) rb.addEventListener('click', () => { if (confirm('Forget every hidden figure you have found?')) { state.found = {}; save(state); refresh(); } });
  }
  function flyTo(id) {
    const f = BYID.get(id); if (!f) return;
    if (matchMedia('(max-width:600px)').matches) { ui.panel.classList.remove('open'); ui.badge.setAttribute('aria-expanded', 'false'); }
    map.flyTo({ center: [f.lon, f.lat], zoom: f.big ? 13.5 : 16, duration: 3200, essential: true });
  }

  // ------------------------------------------------------------------ hint mode
  let hintTimer = null, hintPulse = null;
  let hintShown = 0;
  function hint() {
    if (!DATA || !map.getSource('folk-hint')) return;
    if (!state.hint && !hintShown) { if (ui.badge) ui.badge.classList.remove('near'); return; }   // nothing to do: never touch the style
    const near = [];
    if (state.hint && map.getZoom() >= 9) {
      const c = map.getCenter();
      for (const f of DATA.folk) {
        if (state.found[f.id]) continue;
        const d = dist(c.lat, c.lng, f.lat, f.lon);
        if (d < 5000) near.push(f);
      }
    }
    // the ring is centred up to 250 m away from the figure (by a fixed offset per figure) and is 450 m across
    const feats = near.slice(0, 12).map(f => { let h = 0; for (const ch of f.id) h = (h * 31 + ch.charCodeAt(0)) | 0; const a = (h % 360) * Math.PI / 180, r = 120 + (Math.abs(h) % 130); return { type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon + r * Math.cos(a) / (111320 * Math.cos(f.lat * Math.PI / 180)), f.lat + r * Math.sin(a) / 111320] }, properties: {} }; });
    if (!feats.length && !hintShown) { if (ui.badge) ui.badge.classList.toggle('near', false); return; }
    hintShown = feats.length;
    map.getSource('folk-hint').setData({ type: 'FeatureCollection', features: feats });
    const lat = map.getCenter().lat, mpp = z => 40075016 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, z));
    map.setPaintProperty('folk-hint', 'circle-radius', ['interpolate', ['exponential', 2], ['zoom'], 9, 260 / mpp(9), 16, 260 / mpp(16)]);
    if (ui.badge) ui.badge.classList.toggle('near', near.length > 0);
    if (feats.length && !hintPulse) {
      let t0 = performance.now(), last = 0;
      const step = now => { if (!hintPulse) return; if (now - last > 100) { last = now; const k = 0.5 + 0.5 * Math.sin((now - t0) / 420); try { map.setPaintProperty('folk-hint', 'circle-stroke-opacity', 0.15 + 0.5 * k); } catch (e) {} } hintPulse = requestAnimationFrame(step); };
      hintPulse = requestAnimationFrame(step);
    } else if (!feats.length && hintPulse) { cancelAnimationFrame(hintPulse); hintPulse = null; }
  }
  function dist(la1, lo1, la2, lo2) { const R = 6371000, a = la1 * Math.PI / 180, b = la2 * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180, dp = b - a; const h = Math.sin(dp / 2) ** 2 + Math.cos(a) * Math.cos(b) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

  // ------------------------------------------------------------------ set-up
  function init(m) {
    if (map) return;
    map = m;
    map.on('styleimagemissing', onMissing);
    buildUI(); updateBadge();
    // the list (about 78 kB compressed) is only fetched when it can matter: zoomed in to zoom 11 or closer, the panel
    // opened, saved progress to show, or the traveller out walking; nothing is added to the first load of the page
    const want = () => { if (!DATA && map.getZoom() >= BIGZ - 1) fetchData(); };
    map.on('zoomend', want); map.once('idle', want);
    if (Object.keys(state.found).length) map.once('idle', () => setTimeout(() => (global.requestIdleCallback || (f => setTimeout(f, 2000)))(() => fetchData(), { timeout: 8000 }), 4000));
    map.on('click', e => {
      if (!DATA || map.getZoom() < BIGZ - 0.5) return;
      const id = hitAt(e.point); if (id) { e.__folk = id; markFound(id, 'tap'); }
    });
    map.on('moveend', () => { clearTimeout(hintTimer); hintTimer = setTimeout(hint, 120); });
    map.on('styledata', () => { if (DATA && !map.getSource('folk')) addLayers(); });
    document.addEventListener('click', e => { if (ui.panel && ui.panel.classList.contains('open') && !ui.panel.contains(e.target) && e.target !== ui.badge) { ui.panel.classList.remove('open'); ui.badge.setAttribute('aria-expanded', 'false'); } });
    if (global.InkTraveller) global.InkTraveller.init(map, api);
  }
  const api = {
    init, fetchData, markFound, hitAt, flyTo, refresh,
    get data() { return DATA; }, isFound: id => !!state.found[id],
    onData: fn => { if (DATA) fn(DATA); else listeners.push(fn); },
    near(lng, lat, metres) { if (!DATA) return null; let best = null, bd = metres; for (const f of DATA.folk) { if (f.big) continue; const d = dist(lat, lng, f.lat, f.lon); if (d < bd) { bd = d; best = f; } } return best; },
  };
  global.InkFolk = api;
})(window);
