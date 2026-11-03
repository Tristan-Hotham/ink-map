/* The Inked World: your traveller. A small customisable figure (on foot or horseback) that walks the roads at the
 * closest zoom: arrow keys or WASD, tap or click to walk there, or the on-screen pad on phones. It keeps to roads and
 * paths when it is near one (faster there), is slower across country, cannot cross the sea or lakes, and finds any
 * hidden figure it bumps into. Zoomed out, a banner pin marks where you are, with a dotted trail of where you have been.
 * Everything is saved in this browser. Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const STORE = 'inkTraveller.v1', WALKZ = 13.5, SAILZ = 4;
  // the vessels: speed, the share of speed from oars (the rest from the sail), how well it sails towards the wind, small
  // enough for rivers and lakes
  const BOATS = {
    rowing: { label: 'Rowing boat', speed: 0.5, oars: 0.85, upwind: 0.3, small: true },
    longship: { label: 'Longship', speed: 0.9, oars: 0.5, upwind: 0.25, small: true },
    cog: { label: 'Cog', speed: 0.78, oars: 0, upwind: 0.2 },
    caravel: { label: 'Caravel', speed: 1.0, oars: 0, upwind: 0.42 },
    galleon: { label: 'Galleon', speed: 0.95, oars: 0, upwind: 0.22 },
  };
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* not saved in a private window */ } };
  const FIGS = {
    pilgrim: { label: 'Pilgrim', p: { garb: 'gown', hat: 'pilgrim', prop: 'pilgrim', arms: ['fwd', 'back'] } },
    knight: { label: 'Knight', p: { garb: 'armour', hat: 'bascinet', prop: 'banner', arms: ['hold', 'down'] } },
    merchant: { label: 'Merchant', p: { garb: 'gown', hat: 'chaperon', prop: 'scroll', arms: ['chest', 'back'], beard: 1 } },
    herbalist: { label: 'Herbalist', p: { garb: 'kirtle', hat: 'kerchief', prop: 'basket', arms: ['hold', 'back'], h: 16.8 } },
    minstrel: { label: 'Minstrel', p: { garb: 'tunic', hat: 'felt', prop: 'lute', arms: ['chest', 'chest'] } },
    ranger: { label: 'Ranger', p: { garb: 'tunic', hat: 'hood', prop: 'bow', arms: ['hold', 'back'] } },
    scholar: { label: 'Scholar', p: { garb: 'robe', hat: 'cap', prop: 'book', arms: ['chest', 'back'] } },
    smith: { label: 'Smith', p: { garb: 'tunic', hat: 'coif', prop: 'hammer', arms: ['hold', 'back'], apron: 'brown', broad: 1, beard: 1 } },
  };
  const CLOTH = ['madder', 'woad', 'green', 'ochre', 'murrey', 'sage', 'russet', 'black', 'undyed', 'saffron', 'woadDk', 'moss'];
  const HORSES = ['bay', 'grey', 'black', 'chestnut', 'dun', 'white'];
  const DIVS = [['pale', 'Per pale'], ['fess', 'A fess'], ['bend', 'A bend'], ['chevron', 'A chevron'], ['cross', 'A cross'], ['saltire', 'A saltire'], ['quarterly', 'Quarterly'], ['chief', 'A chief'], ['roundel', 'A roundel']];
  const TINCT = ['madder', 'woad', 'ochreLt', 'green', 'black', 'white', 'murrey'];
  const S = Object.assign({ on: false, pos: null, trail: [], dir: 1, look: { fig: 'pilgrim', mount: 'foot', cloak: 'madder', hood: 'woad', horse: 'bay', skin: 'fair', hair: 'brown', her: { d: 'chevron', c1: 'woad', c2: 'ochreLt' }, name: 'Traveller' } }, load());
  if (!BOATS[S.look.boat]) S.look.boat = 'cog';
  S.boat = Object.assign({ kind: S.look.boat, afloat: false }, S.boat || {});
  if (!BOATS[S.boat.kind]) S.boat.kind = S.look.boat;
  let map = null, folk = null, el = null, marker = null, frames = null, keys = new Set(), target = null, raf = null, last = 0, step = 0, pad = null, dlg = null;
  let roads = [], water = [], netAt = null, stuck = 0, act = null, hud = null, shoreAt = 0;
  const afloat = () => !!(S.boat && S.boat.afloat);
  const minZ = () => afloat() ? SAILZ : WALKZ;

  // ------------------------------------------------------------------ the figure
  function spec(frame, dir) {
    const L = S.look, F = FIGS[L.fig] || FIGS.pilgrim;
    const p = Object.assign({ t: 'person', x: 13, y: 0, dir, skin: L.skin, hair: L.hair, c1: L.cloak, c2: 'brown', c3: L.hood, hatc: L.hood, cloak: L.fig === 'knight' ? 'short' : true, her: L.her }, F.p);
    if (L.fig === 'knight') p.c1 = L.her.c1;
    if (L.mount === 'horse') {
      Object.assign(p, { y: 27, mount: 'horse', mountOpt: { coat: L.horse, walk: frame, caparison: L.fig === 'knight' ? L.her : null }, arms: ['fwd', 'down'] });
      if (p.prop === 'pilgrim') p.prop = 'staff';
      return { w: 26, h: 29, figs: [p] };
    }
    Object.assign(p, { y: 23, pose: frame ? 'walk' : 'stand' });
    if (!frame && p.arms) p.arms = [p.arms[0] === 'fwd' ? 'hold' : p.arms[0], 'down'];
    return { w: 26, h: 25, figs: [p] };
  }
  function pinCanvas() {
    const L = S.look, c = document.createElement('canvas'), k = 3; c.width = 26 * k; c.height = 34 * k;
    const x = c.getContext('2d'); x.scale(k, k);
    // a pennon on a staff with the traveller's device
    x.lineCap = 'round'; x.strokeStyle = '#2B2119'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(6, 33); x.lineTo(6, 3); x.stroke();
    x.strokeStyle = '#6A4A31'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(6, 33); x.lineTo(6, 3); x.stroke();
    x.fillStyle = '#C9A13B'; x.beginPath(); x.arc(6, 2.6, 1.8, 0, 7); x.fill();
    // draw the device in an Inked World pen
    const pts = [[7, 4], [24, 5], [20, 10.5], [24, 16], [7, 16]];
    const col = n => (global.InkFolkArt.C[n] || n);
    x.save(); x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = col(L.her.c1); x.fill(); x.clip();
    x.fillStyle = col(L.her.c2); x.beginPath();
    const d = L.her.d;
    if (d === 'pale') x.rect(15.5, 0, 20, 20); else if (d === 'fess') x.rect(0, 8.6, 30, 3.2); else if (d === 'chief') x.rect(0, 0, 30, 8);
    else if (d === 'quarterly') { x.rect(15.5, 0, 20, 10); x.rect(0, 10, 15.5, 10); } else if (d === 'cross') { x.rect(13.6, 0, 3, 20); x.rect(0, 8.6, 30, 3); }
    else if (d === 'roundel') x.arc(14, 10, 3.2, 0, 7); else if (d === 'bend') { x.moveTo(7, 4); x.lineTo(11, 4); x.lineTo(24, 16); x.lineTo(20, 16); }
    else if (d === 'saltire') { x.moveTo(7, 4); x.lineTo(10, 4); x.lineTo(24, 16); x.lineTo(21, 16); x.moveTo(21, 4); x.lineTo(24, 4); x.lineTo(10, 16); x.lineTo(7, 16); }
    else if (d === 'chevron') { x.moveTo(7, 14); x.lineTo(15, 7); x.lineTo(23, 14); x.lineTo(23, 16.5); x.lineTo(15, 9.6); x.lineTo(7, 16.5); }
    x.fill(); x.restore();
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.strokeStyle = '#2B2119'; x.lineWidth = 0.9; x.stroke();
    return c;
  }
  function buildFrames() {
    frames = {};
    for (const dir of [1, -1]) for (const f of [0, 1]) frames[f + (dir > 0 ? 'r' : 'l')] = global.InkFolkArt.render(spec(f, dir), 3);
    frames.pin = pinCanvas();
    frames.boat = null;
  }
  // the boat in the traveller's colours (drawn when first needed, again when the look or the vessel changes)
  function boatFrames() {
    const k = S.boat.kind + JSON.stringify(S.look);
    if (frames.boat && frames.boat.k === k) return frames.boat;
    const B = { k };
    if (global.InkSeaArt) for (const dir of [1, -1]) for (const f of [0, 1]) B[f + (dir > 0 ? 'r' : 'l')] = global.InkSeaArt.boat(S.boat.kind, S.look, f, dir);
    frames.boat = B; return B;
  }
  function buildMarker() {
    el = document.createElement('div'); el.className = 'trav';
    el.innerHTML = '<canvas class="trav-fig"></canvas><div class="trav-pin"><canvas></canvas><span></span></div>';
    const style = document.createElement('style');
    style.textContent = `.trav{pointer-events:none}.trav .trav-fig{display:block;transform-origin:50% 100%}.trav .trav-pin{display:none;flex-direction:column;align-items:center;transform:translateY(4px)}
.trav .trav-pin canvas{width:26px;height:34px}.trav .trav-pin span{font:400 13px/1 "MedievalSharp","IM Fell English",Georgia,serif;color:#8A1F16;background:rgba(251,245,228,.92);border:1px solid #9C8656;border-radius:2px 8px 2px 8px;padding:2px 7px;white-space:nowrap;margin-top:-2px;box-shadow:0 1px 3px rgba(60,40,10,.2)}
.trav.far .trav-fig{display:none}.trav.far .trav-pin{display:flex}
.trav-pad{position:absolute;right:56px;bottom:120px;z-index:6;display:none;grid-template-columns:repeat(3,40px);grid-template-rows:repeat(3,40px);gap:2px;touch-action:none}
.trav-pad.on{display:grid}.trav-pad button{background:rgba(251,245,228,.9);border:1px solid #9C8656;border-radius:6px;font:16px/1 serif;color:#2B2119;padding:0;touch-action:none}
.trav-pad button:active{background:#EFE1BC}.trav-pad button.bt{font:600 10px/1 var(--mono,monospace);letter-spacing:.02em}
.trav-act{position:absolute;left:50%;bottom:52px;transform:translateX(-50%);z-index:7;font:500 12px/1 var(--mono,monospace);background:#A3261B;color:#fff;border:0;border-radius:999px;padding:9px 14px;cursor:pointer;box-shadow:0 1px 4px rgba(60,40,10,.3);min-height:34px}
.trav-sail{position:absolute;right:10px;top:104px;z-index:6;display:flex;gap:8px;align-items:center;max-width:calc(100% - 24px);font:400 12px/1.3 var(--mono,monospace);background:rgba(251,245,228,.95);border:1px solid #9C8656;border-radius:999px;padding:5px 12px 5px 6px;color:#2B2119;pointer-events:none}
.trav-sail .ar{width:22px;height:22px;flex:none;transition:transform .8s}.trav-sail.storm{border-color:#A3261B;color:#8A1F16}
@media (max-width:600px){.trav-sail{top:154px;left:12px;right:12px;font-size:11px}.trav-act{bottom:96px}}
.trav-dlg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;width:min(360px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;background:#FBF5E4;color:#2B2119;border:1px solid #9C8656;border-radius:4px;box-shadow:0 6px 24px rgba(60,40,10,.35);padding:14px 16px;font:400 13px/1.4 var(--mono,monospace)}
.trav-dlg h4{margin:0 0 8px;font:400 22px/1.1 var(--hand,serif);color:#A3261B}.trav-dlg .row{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.trav-dlg .row button{border:1px solid #C9B583;background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer;font:500 12px/1 var(--mono,monospace);color:#2B2119;min-height:30px}.trav-dlg .row button[aria-pressed=true]{background:#2B2119;color:#F6EED8;border-color:#2B2119}
.trav-dlg .sw{width:26px;height:26px;border-radius:50%;padding:0!important;min-height:26px!important}.trav-dlg .sw[aria-pressed=true]{outline:3px solid #A3261B;outline-offset:1px}
.trav-dlg label{display:block;font:500 11px/1 var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:#6E604E;margin-top:4px}
.trav-dlg input[type=text]{width:100%;font:400 15px/1 var(--mono,monospace);padding:8px;border:1px solid #9C8656;border-radius:3px;background:#fff;color:#2B2119;min-height:38px}
.trav-dlg .prev{display:flex;justify-content:center;gap:10px;align-items:flex-end;background:#F3E5BF;border-radius:4px;padding:8px;margin:6px 0 10px}
.trav-dlg .go{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}.trav-dlg .go button{font:500 12px/1 var(--mono,monospace);border-radius:999px;padding:9px 14px;cursor:pointer;border:1px solid #2B2119;min-height:36px}
.trav-dlg .go .p{background:#A3261B;border-color:#A3261B;color:#fff}.trav-dlg .go .s{background:none;color:#2B2119}
.trav-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;font:400 12px/1.3 var(--mono,monospace);background:rgba(251,245,228,.94);border:1px solid #9C8656;border-radius:999px;padding:6px 12px;color:#2B2119;pointer-events:none;transition:opacity .6s}
body.clean .trav-pad,body.clean .trav-hint,body.clean .trav-act,body.clean .trav-sail{display:none!important}`;
    document.head.appendChild(style);
    marker = new global.maplibregl.Marker({ element: el, anchor: 'bottom' });
  }
  function buildSeaUI() {
    act = document.createElement('button'); act.type = 'button'; act.className = 'trav-act'; act.style.display = 'none';
    act.addEventListener('click', e => { e.stopPropagation(); board(); });
    ['mousedown', 'touchstart', 'dblclick'].forEach(ev => act.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    map.getContainer().appendChild(act);
    hud = document.createElement('div'); hud.className = 'trav-sail'; hud.style.display = 'none'; hud.setAttribute('aria-live', 'polite');
    // an arrow showing where the wind blows to
    hud.innerHTML = '<svg class="ar" viewBox="-11 -11 22 22" aria-hidden="true"><circle r="10" fill="#F3E5BF" stroke="#9C8656"/><path d="M0 -7 L4 2 L0 0 L-4 2 Z" fill="#3D6E9E" stroke="#2B2119" stroke-width="0.8"/><path d="M0 0 L0 7" stroke="#2B2119" stroke-width="1.2"/></svg><span class="tx"></span>';
    map.getContainer().appendChild(hud);
  }
  function paint() {
    if (!el || !frames) return;
    const z = map.getZoom(), far = z < (afloat() ? SAILZ - 0.5 : WALKZ);
    el.classList.toggle('far', far);
    if (far) {
      const pc = el.querySelector('.trav-pin canvas'); pc.width = frames.pin.width; pc.height = frames.pin.height; pc.getContext('2d').drawImage(frames.pin, 0, 0);
      el.querySelector('.trav-pin span').textContent = S.look.name || 'Traveller';
      return;
    }
    const fk = (moving() || afloat() ? step : 0) + (S.dir > 0 ? 'r' : 'l');
    const fr = afloat() ? (boatFrames()[fk] || frames[fk]) : frames[fk], c = el.querySelector('.trav-fig');
    if (c.width !== fr.width || c.height !== fr.height) { c.width = fr.width; c.height = fr.height; }
    const sc = afloat() ? Math.max(1.0, Math.min(1.45, 1.0 + (z - 8) * 0.08)) : Math.max(0.8, Math.min(1.35, 0.92 + (z - 15) * 0.2));
    c.style.width = (fr.width / 3 * sc) + 'px'; c.style.height = (fr.height / 3 * sc) + 'px';
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(fr, 0, 0);
  }

  // ------------------------------------------------------------------ roads and water from the loaded vector tiles
  const ROADY = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'path', 'raceway', 'busway']);
  function refreshNet() {
    if (!map.getSource('ofm') || !S.pos) return;
    const z = map.getZoom(); if (z < 11) { roads = []; water = []; return; }
    const R = [];
    try {
      for (const f of map.querySourceFeatures('ofm', { sourceLayer: 'transportation' })) {
        const cl = f.properties.class; if (!ROADY.has(cl) || f.properties.brunnel === 'tunnel') continue;
        const g = f.geometry, lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
        const fast = cl === 'path' || cl === 'track' ? 0.8 : 1;
        for (const ln of lines) for (let i = 0; i < ln.length - 1; i++) R.push([ln[i][0], ln[i][1], ln[i + 1][0], ln[i + 1][1], fast, f.properties.brunnel === 'bridge' ? 1 : 0]);
      }
    } catch (e) { /* source not ready */ }
    const W = [];
    try {
      for (const f of map.querySourceFeatures('ofm', { sourceLayer: 'water' })) {
        const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const p of polys) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p[0]) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } W.push({ b: [x0, y0, x1, y1], p }); }
      }
    } catch (e) {}
    roads = R; water = W; netAt = S.pos.slice();
  }
  function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function isWater(lng, lat) {
    for (const w of water) { const b = w.b; if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue; if (inRing(lng, lat, w.p[0]) && !w.p.slice(1).some(h => inRing(lng, lat, h))) return true; }
    return false;
  }
  // metres per degree at the traveller's latitude
  const mdeg = lat => [111320 * Math.cos(lat * Math.PI / 180), 110574];
  function nearestRoad(lng, lat, maxm) {
    const [kx, ky] = mdeg(lat); let best = null, bd = maxm;
    for (const s of roads) {
      const ax = (s[0] - lng) * kx, ay = (s[1] - lat) * ky, bx = (s[2] - lng) * kx, by = (s[3] - lat) * ky;
      if (Math.min(ax, bx) > bd || Math.max(ax, bx) < -bd || Math.min(ay, by) > bd || Math.max(ay, by) < -bd) continue;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9; let t = -(ax * dx + ay * dy) / L2; t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px, py);
      if (d < bd) { bd = d; best = { s, px, py, d, ux: dx / Math.sqrt(L2), uy: dy / Math.sqrt(L2) }; }
    }
    return best;
  }

  // ------------------------------------------------------------------ water for boats: what is drawn at a point on screen
  // (two hidden layers on the OpenFreeMap water and waterways, queried where they are drawn, so it works at every zoom from
  // the open ocean to a harbour; the traveller is always at the centre of the view, so the point is always drawn)
  function addWaterLayers() {
    if (map.getLayer('trav-water')) return;
    const b = ['trav-trail'].find(id => map.getLayer(id));
    map.addLayer({ id: 'trav-water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#000', 'fill-opacity': 0 }, metadata: { group: 'traveller' } }, b);
    map.addLayer({ id: 'trav-river', type: 'line', source: 'ofm', 'source-layer': 'waterway', minzoom: 9, filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]],
      paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 14, 10] }, metadata: { group: 'traveller' } }, b);
  }
  // 'ocean' | 'lake' | 'river' | null (land) | undefined (not drawn yet: wait)
  function waterAt(lng, lat) {
    if (!map.getLayer('trav-water')) addWaterLayers();
    const p = map.project([lng, lat]), c = map.getCanvas(), W = c.clientWidth, H = c.clientHeight;
    if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return undefined;
    let fs = [];
    try { fs = map.queryRenderedFeatures([p.x, p.y], { layers: ['trav-water', 'trav-river'] }); } catch (e) { return undefined; }
    for (const f of fs) if (f.layer.id === 'trav-water') { const cl = f.properties.class; return cl === 'ocean' ? 'ocean' : cl === 'river' ? 'river' : 'lake'; }
    if (fs.length) return 'river';
    return map.areTilesLoaded() ? null : undefined;
  }
  const canFloat = w => w === 'ocean' || ((w === 'lake' || w === 'river') && BOATS[S.boat.kind].small);
  // the nearest point (in a ring search out to maxpx screen pixels) whose water test passes
  function ringFind(pos, maxpx, test) {
    const p0 = map.project(pos);
    for (let r = 4; r <= maxpx; r += 4) for (let a = 0; a < 360; a += Math.max(10, 90 / r * 6)) {
      const q = map.unproject([p0.x + r * Math.cos(a * Math.PI / 180), p0.y + r * Math.sin(a * Math.PI / 180)]), w = waterAt(q.lng, q.lat);
      if (test(w)) return [q.lng, q.lat, w];
    }
    return null;
  }
  // water a boat can float on, within reach of the shore (about 40 m, or 14 screen pixels if more)
  function findSea(pos, maxm) {
    const mpp = 40075016 * Math.cos(pos[1] * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
    const w0 = waterAt(pos[0], pos[1]); if (w0 && canFloat(w0)) return [pos[0], pos[1], w0];
    return ringFind(pos, Math.max(14, Math.min(60, (maxm || 40) / mpp)), w => !!w && canFloat(w));
  }
  function board() {
    if (afloat()) return land();
    if (!S.pos) return false;
    const w = findSea(S.pos, 40);
    if (!w) {
      const any = ringFind(S.pos, 20, x => !!x);
      banner(any && !BOATS[S.boat.kind].small ? `A ${BOATS[S.boat.kind].label.toLowerCase()} is too big for rivers and lakes: take a rowing boat or a longship.` : 'Walk to a coast, harbour or pier to take to the water.');
      return false;
    }
    S.pos = [w[0], w[1]]; S.boat = { kind: S.look.boat, afloat: true }; keys.clear(); target = null;
    if (global.InkSea) global.InkSea.setSailing(true);
    if (global.InkSea && global.InkSea.loadWind) global.InkSea.loadWind();
    place(); syncPad(); showAct(null); updHud(true);
    banner(`All aboard the ${BOATS[S.boat.kind].label.toLowerCase()}! Sail with the arrow keys; B to go ashore.`);
    save(); return true;
  }
  function land() {
    if (!afloat()) return false;
    const p = ringFind(S.pos, 60, w => w === null);
    if (!p) { banner('No shore close enough: sail to a coast first.'); return false; }
    S.pos = [p[0], p[1]]; S.boat = { kind: S.boat.kind, afloat: false }; keys.clear(); target = null;
    if (global.InkSea) global.InkSea.setSailing(false);
    place(); syncPad(); showAct(null); updHud(false);
    banner(map.getZoom() < WALKZ ? 'Ashore! Zoom right in to walk on.' : 'Ashore!');
    save(); return true;
  }
  // the speed of the boat here on this heading (degrees from north), as a share of its best: its own speed, the wind by the
  // point of sail (running, reaching, close-hauled, in irons), and storms
  const POS = [[0, 0.9], [45, 1.05], [95, 1.15], [130, 0.75], [150, 0], [180, 0]];
  function pointOfSail(theta) { return theta < 25 ? 'running before the wind' : theta < 70 ? 'on a broad reach' : theta < 115 ? 'on a beam reach' : theta < 145 ? 'close-hauled' : 'in irons, head to wind'; }
  function windTerm(theta, B) {
    let v = POS[0][1];
    for (let i = 1; i < POS.length; i++) if (theta <= POS[i][0]) { const a = POS[i - 1], b = POS[i], t = (theta - a[0]) / (b[0] - a[0]); v = a[1] + (b[1] - a[1]) * t; break; }
    if (theta > 130) v = Math.max(v, B.upwind);
    return v;
  }
  function speedFactor(lng, lat, hdg, noStorm) {
    const B = BOATS[S.boat.kind] || BOATS.cog, w = global.InkWind ? global.InkWind.at(lng, lat) : { to: [1, 0], k: 1 };
    const to = Math.atan2(w.to[0], w.to[1]) * 180 / Math.PI, theta = Math.abs(((hdg - to) % 360 + 540) % 360 - 180);
    const sail = windTerm(theta, B) * w.k;
    let f = B.speed * (B.oars + (1 - B.oars) * sail);
    if (!noStorm && global.InkSea) f *= 1 - 0.6 * global.InkSea.stormAt(lng, lat);
    return Math.max(0.05, f);
  }
  let lastHdg = 90;
  function sailInfo() {
    if (!S.pos) return null;
    const w = global.InkWind ? global.InkWind.at(S.pos[0], S.pos[1]) : null; if (!w) return null;
    const to = Math.atan2(w.to[0], w.to[1]) * 180 / Math.PI, theta = Math.abs(((lastHdg - to) % 360 + 540) % 360 - 180);
    const storm = global.InkSea ? global.InkSea.stormAt(S.pos[0], S.pos[1]) : 0;
    return { from: Math.round(w.from), wind: global.InkWind.name(w.from), point: pointOfSail(theta), factor: +speedFactor(S.pos[0], S.pos[1], lastHdg).toFixed(2), storm: +storm.toFixed(2) };
  }
  // the little sailing card: wind, point of sail, speed, storm warning
  function updHud(on) {
    if (!hud) return;
    if (on === false || !afloat() || !S.on) { hud.style.display = 'none'; return; }
    const i = sailInfo(); if (!i) return;
    hud.style.display = '';
    const sp = i.factor > 0.95 ? 'making good speed' : i.factor > 0.6 ? 'steady' : i.factor > 0.3 ? 'slow going' : 'barely moving';
    hud.querySelector('.ar').style.transform = `rotate(${(i.from + 180) % 360}deg)`;
    hud.querySelector('.tx').textContent = `Wind from the ${i.wind}, ${i.point}: ${sp}${i.storm > 0.25 ? '. A storm! Heavy going.' : '.'}`;
    hud.classList.toggle('storm', i.storm > 0.25);
  }
  function showAct(kind) {
    if (!act) return;
    if (!kind) { act.style.display = 'none'; act.dataset.k = ''; return; }
    act.textContent = kind === 'board' ? 'Take to the water (B)' : 'Go ashore (B)'; act.dataset.k = kind; act.style.display = '';
  }

  // ------------------------------------------------------------------ movement
  const moving = () => keys.size > 0 || !!target;
  function inputVec() {
    let x = 0, y = 0;
    if (keys.has('l')) x -= 1; if (keys.has('r')) x += 1; if (keys.has('u')) y += 1; if (keys.has('d')) y -= 1;
    if (target) { const [kx, ky] = mdeg(S.pos[1]); const ex = (target[0] - S.pos[0]) * kx, ny = (target[1] - S.pos[1]) * ky, d = Math.hypot(ex, ny); if (d < 2.5) { target = null; return null; } x = ex / d; y = ny / d; return [x, y, d]; }
    const d = Math.hypot(x, y); return d ? [x / d, y / d, Infinity] : null;
  }
  // one step at sea: speed in screen pixels a second (faster far out, so an ocean takes a minute, not an hour), times the
  // vessel, the wind and any storm; land ahead stops the boat and offers to go ashore
  function sailStep(v, dt, now) {
    const z = map.getZoom();
    if (!v) { if (now - (sailStep.h || 0) > 500) { sailStep.h = now; updHud(); } return; }
    if (z < SAILZ) { banner('Zoom in a little to sail.'); keys.clear(); target = null; return; }
    const [kx, ky] = mdeg(S.pos[1]);
    const mpp = 40075016 * Math.cos(S.pos[1] * Math.PI / 180) / (512 * Math.pow(2, z));
    const hdg = (Math.atan2(v[0], v[1]) * 180 / Math.PI + 360) % 360; lastHdg = hdg;
    const pxs = 40 + Math.max(0, 12 - z) * 12;
    const f = speedFactor(S.pos[0], S.pos[1], hdg);
    const stepm = Math.min(pxs * mpp * f * dt, v[2]);
    const nx = S.pos[0] + v[0] * stepm / kx, ny = S.pos[1] + v[1] * stepm / ky;
    const w = waterAt(nx, ny);
    if (w === undefined) return;   // the water there is not drawn yet: wait a frame
    if (w === null) { target = null; if (!sailStep.land || now - sailStep.land > 1500) { sailStep.land = now; banner('Land ho! Press B to go ashore.'); } showAct('land'); return; }
    if (!canFloat(w)) { target = null; banner(`Too big for ${w === 'river' ? 'a river' : 'a lake'}: only a rowing boat or a longship can go on.`); return; }
    S.pos = [nx, ny]; showAct(null);
    if (Math.abs(v[0]) > 0.2) S.dir = v[0] > 0 ? 1 : -1;
    step = Math.floor(now / 420) % 2;
    const lastT = S.trail[S.trail.length - 1];
    if (!lastT || dist(lastT, S.pos) > Math.max(20, 6 * mpp)) { S.trail.push([+S.pos[0].toFixed(5), +S.pos[1].toFixed(5)]); if (S.trail.length > 3000) S.trail.splice(0, S.trail.length - 3000); setTrail(); }
    marker.setLngLat(S.pos);
    map.jumpTo({ center: S.pos });
    if (z >= WALKZ) bump();
    if (now - (sailStep.h || 0) > 250) { sailStep.h = now; updHud(); }
    if (now - (tick.saved || 0) > 1500) { tick.saved = now; save(); }
  }
  function tick(now) {
    raf = null;
    if (!S.on || !S.pos) return;
    const dt = Math.min(0.2, (now - (last || now)) / 1000); last = now;
    const v = inputVec();
    if (afloat()) { sailStep(v, dt, now); paint(); if (moving()) raf = requestAnimationFrame(tick); else { last = 0; save(); } return; }
    if (v && map.getZoom() >= WALKZ) {
      if (!netAt || dist(netAt, S.pos) > 250) refreshNet();
      const [kx, ky] = mdeg(S.pos[1]);
      const horse = S.look.mount === 'horse';
      const mpp = 40075016 * Math.cos(S.pos[1] * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
      const rd = nearestRoad(S.pos[0], S.pos[1], Math.max(10, 16 * mpp));
      let mx = v[0], my = v[1], speed;
      if (rd && Math.abs(v[0] * rd.ux + v[1] * rd.uy) > 0.3) {   // follow the road in the direction nearest the input
        const sgn = v[0] * rd.ux + v[1] * rd.uy >= 0 ? 1 : -1;
        mx = rd.ux * sgn; my = rd.uy * sgn;
        speed = (horse ? 70 : 32) * rd.s[4];
        // ease back onto the line
        mx += rd.px / Math.max(8, rd.d * 4) * 0.4; my += rd.py / Math.max(8, rd.d * 4) * 0.4;
      } else speed = horse ? 26 : 14;
      speed *= Math.max(0.6, Math.min(2.2, mpp / 1.6));   // a little faster when zoomed out a step
      const n = Math.hypot(mx, my) || 1, stepm = Math.min(speed * dt, v[2]);
      const nx = S.pos[0] + mx / n * stepm / kx, ny = S.pos[1] + my / n * stepm / ky;
      const onRoad = rd && rd.d < 12 * mpp;
      let ok = onRoad || !isWater(nx, ny);
      if (ok) { S.pos = [nx, ny]; stuck = 0; }
      else {   // slide along the shore if one axis is free
        if (!isWater(nx, S.pos[1])) S.pos = [nx, S.pos[1]]; else if (!isWater(S.pos[0], ny)) S.pos = [S.pos[0], ny]; else { stuck += dt; if (stuck > 0.4) { target = null; banner('Water. Press B to take to the water in your ' + BOATS[S.look.boat].label.toLowerCase() + '.'); showAct('board'); } }
      }
      if (Math.abs(mx) > 0.2) S.dir = mx > 0 ? 1 : -1;
      step = Math.floor(now / (horse ? 160 : 230)) % 2;
      const lastT = S.trail[S.trail.length - 1];
      if (!lastT || dist(lastT, S.pos) > 20) { S.trail.push([+S.pos[0].toFixed(6), +S.pos[1].toFixed(6)]); if (S.trail.length > 3000) S.trail.splice(0, S.trail.length - 3000); setTrail(); }
      marker.setLngLat(S.pos);
      map.jumpTo({ center: S.pos });
      bump();
      // by the water's edge, offer a boat
      if (now - shoreAt > 600) { shoreAt = now; showAct(findSea(S.pos, 25) ? 'board' : null); }
      if (now - (tick.saved || 0) > 1500) { tick.saved = now; save(); }
    } else if (v && map.getZoom() < WALKZ) { banner('Zoom right in to walk.'); keys.clear(); target = null; }
    paint();
    if (moving()) raf = requestAnimationFrame(tick); else { last = 0; save(); }
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
  function dist(a, b) { const [kx, ky] = mdeg(a[1]); return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * ky); }
  function bump() {
    if (!folk || !folk.data) return;
    const f = folk.near(S.pos[0], S.pos[1], 22);
    if (f && !folk.isFound(f.id)) { folk.markFound(f.id, 'bump'); keys.clear(); target = null; }
  }
  function setTrail() {
    const src = map.getSource('trav-trail'); if (!src) return;
    src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: S.trail.length > 1 ? S.trail.concat([S.pos]) : [] }, properties: {} });
  }
  let bannerT = null, bannerEl = null;
  function banner(t) {
    if (!bannerEl) { bannerEl = document.createElement('div'); bannerEl.className = 'trav-hint'; map.getContainer().appendChild(bannerEl); }
    bannerEl.textContent = t; bannerEl.style.opacity = 1; clearTimeout(bannerT); bannerT = setTimeout(() => { bannerEl.style.opacity = 0; }, 2200);
  }

  // ------------------------------------------------------------------ controls
  const KEYMAP = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd', A: 'l', D: 'r', W: 'u', S: 'd' };
  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  function onKey(e) {
    if (!S.on || typing(e) || map.getZoom() < minZ()) return;
    if ((e.key === 'b' || e.key === 'B') && e.type === 'keydown') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) board(); return; }
    const k = KEYMAP[e.key]; if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') { keys.add(k); target = null; kick(); } else keys.delete(k);
  }
  function onClick(e) {
    if (!S.on || map.getZoom() < minZ() || (e.originalEvent && e.originalEvent.__folkHit)) return;
    if (folk && folk.hitAt && folk.hitAt(e.point)) return;   // tapping a hidden figure finds it instead
    if (!S.pos) { S.pos = [e.lngLat.lng, e.lngLat.lat]; place(); return; }
    target = [e.lngLat.lng, e.lngLat.lat]; kick();
  }
  function buildPad() {
    pad = document.createElement('div'); pad.className = 'trav-pad'; pad.setAttribute('aria-label', 'Walk');
    const B = [['', ''], ['u', '▲'], ['', ''], ['l', '◀'], ['b', 'Boat'], ['r', '▶'], ['', ''], ['d', '▼'], ['', '']];
    for (const [k, t] of B) {
      const b = document.createElement('button'); b.type = 'button';
      if (!k) { b.style.visibility = 'hidden'; pad.appendChild(b); continue; }
      if (k === 'b') {   // take to the water, or go ashore
        b.textContent = t; b.dataset.k = 'b'; b.className = 'bt'; b.setAttribute('aria-label', 'Take to the water or go ashore');
        b.addEventListener('click', ev => { ev.preventDefault(); board(); }); pad.appendChild(b); continue;
      }
      b.textContent = t; b.setAttribute('aria-label', { u: 'North', d: 'South', l: 'West', r: 'East' }[k]);
      const on = ev => { ev.preventDefault(); keys.add(k); target = null; kick(); }, off = ev => { ev.preventDefault(); keys.delete(k); };
      b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(x => b.addEventListener(x, off));
      pad.appendChild(b);
    }
    map.getContainer().appendChild(pad);
  }
  function syncPad() {
    if (pad) { pad.classList.toggle('on', S.on && map.getZoom() >= minZ() && matchMedia('(pointer:coarse)').matches); const b = pad.querySelector('[data-k="b"]'); if (b) b.textContent = afloat() ? 'Land' : 'Boat'; }
    if (hud) updHud(S.on && afloat());
  }

  // ------------------------------------------------------------------ dressing room
  function dress() {
    if (dlg) dlg.remove();
    dlg = document.createElement('div'); dlg.className = 'trav-dlg'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-label', 'Dress your traveller');
    ['mousedown', 'touchstart', 'wheel', 'click', 'dblclick'].forEach(ev => dlg.addEventListener(ev, e => e.stopPropagation(), { passive: ev !== 'click' }));
    map.getContainer().appendChild(dlg);
    const L = S.look, C = global.InkFolkArt.C;
    const sw = (key, list, cur) => list.map(c => `<button class="sw" data-k="${key}" data-v="${c}" aria-pressed="${cur === c}" title="${c}" style="background:${C[c] || '#ccc'}"></button>`).join('');
    const opt = (key, list, cur) => list.map(([v, l]) => `<button data-k="${key}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('');
    function draw() {
      dlg.innerHTML = `<h4>Your traveller</h4><div class="prev"></div>
        <label>Who</label><div class="row">${opt('fig', Object.entries(FIGS).map(([k, v]) => [k, v.label]), L.fig)}</div>
        <label>How</label><div class="row">${opt('mount', [['foot', 'On foot'], ['horse', 'On horseback']], L.mount)}</div>
        <label>Vessel (at a coast, harbour or pier, press B)</label><div class="row">${opt('boat', Object.entries(BOATS).map(([k, v]) => [k, v.label]), L.boat)}</div>
        <label>Cloak</label><div class="row">${sw('cloak', CLOTH, L.cloak)}</div>
        <label>Hood and hat</label><div class="row">${sw('hood', CLOTH, L.hood)}</div>
        ${L.mount === 'horse' ? `<label>Horse</label><div class="row">${opt('horse', HORSES.map(h => [h, h]), L.horse)}</div>` : ''}
        <label>Banner</label><div class="row">${opt('d', DIVS, L.her.d)}</div><div class="row">${sw('c1', TINCT, L.her.c1)}</div><div class="row">${sw('c2', TINCT, L.her.c2)}</div>
        <label for="travName">Name on the ribbon</label><input type="text" id="travName" maxlength="24" value="${String(L.name || '').replace(/"/g, '&quot;')}">
        <div class="go"><button class="s" type="button" data-act="close">Close</button><button class="p" type="button" data-act="go">${S.on ? 'Done' : 'Set off'}</button></div>`;
      buildFrames();
      const pv = dlg.querySelector('.prev');
      for (const k of ['0r', '1r']) { const c = frames[k], cc = document.createElement('canvas'); cc.width = c.width; cc.height = c.height; cc.style.width = (c.width / 3 * 2.2) + 'px'; cc.getContext('2d').drawImage(c, 0, 0); pv.appendChild(cc); }
      const pc = document.createElement('canvas'); pc.width = frames.pin.width; pc.height = frames.pin.height; pc.style.width = '44px'; pc.getContext('2d').drawImage(frames.pin, 0, 0); pv.appendChild(pc);
      if (global.InkSeaArt) { const bc = global.InkSeaArt.boat(L.boat, L, 0, 1), cc = document.createElement('canvas'); cc.width = bc.width; cc.height = bc.height; cc.style.width = (bc.width / 3 * 1.6) + 'px'; cc.getContext('2d').drawImage(bc, 0, 0); pv.appendChild(cc); }
      dlg.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k, v = b.dataset.v;
        if (k === 'd' || k === 'c1' || k === 'c2') L.her = Object.assign({}, L.her, { [k]: v }); else L[k] = v;
        if (k === 'boat' && !afloat()) S.boat.kind = v;
        if (k === 'boat' && afloat()) { if (S.boat.kind !== v) banner('You will change ships when you next come ashore.'); }
        save(); draw();
      }));
      dlg.querySelector('#travName').addEventListener('input', e => { L.name = e.target.value.slice(0, 24); save(); });
      dlg.querySelector('[data-act=close]').addEventListener('click', close);
      dlg.querySelector('[data-act=go]').addEventListener('click', () => { close(); setActive(true); });
    }
    function close() { dlg.remove(); dlg = null; buildFrames(); paint(); }
    draw();
  }

  // ------------------------------------------------------------------ on and off
  function place() {
    if (!S.pos) return;
    marker.setLngLat(S.pos).addTo(map); paint(); setTrail(); save();
  }
  function setActive(on) {
    S.on = !!on;
    if (on) {
      addTrailLayer(); if (folk) folk.fetchData();
      if (!S.pos) {
        const c = map.getCenter(); S.pos = [c.lng, c.lat];
        if (map.getZoom() < WALKZ) map.easeTo({ center: S.pos, zoom: 15.5, duration: 1600 });
        banner('Your traveller is here. Arrow keys, WASD, or tap to walk.');
      }
      if (!frames) buildFrames();
      place();
      map.keyboard.disable();
      if (afloat() && global.InkSea) global.InkSea.setSailing(true);
    } else { if (marker) marker.remove(); map.keyboard.enable(); keys.clear(); target = null; showAct(null); if (global.InkSea) global.InkSea.setSailing(false); }
    const tl = map.getLayer('trav-trail'); if (tl) map.setLayoutProperty('trav-trail', 'visibility', on ? 'visible' : 'none');
    syncPad(); save();
  }
  function addTrailLayer() {
    if (map.getSource('trav-trail')) return;
    map.addSource('trav-trail', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
    map.addLayer({ id: 'trav-trail', type: 'line', source: 'trav-trail', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: S.on ? 'visible' : 'none' },
      paint: { 'line-color': '#A3261B', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 14, 2.4], 'line-dasharray': [0.1, 2.2], 'line-opacity': 0.8 }, metadata: { group: 'folk' } });
    setTrail(); addWaterLayers();
  }
  function init(m, f) {
    if (map) return;
    map = m; folk = f;
    buildMarker(); buildPad(); buildSeaUI();
    map.getContainer().addEventListener('keydown', onKey, true); map.getContainer().addEventListener('keyup', onKey, true);
    window.addEventListener('keydown', e => { if (S.on && document.activeElement === document.body) onKey(e); });
    window.addEventListener('keyup', e => { if (S.on) onKey(e); });
    window.addEventListener('blur', () => keys.clear());
    map.on('click', onClick);
    map.on('zoom', () => { paint(); syncPad(); });
    map.on('moveend', () => { if (S.on && afloat() && !raf) updHud(); });
    map.on('moveend', () => { if (S.on && S.pos && (!netAt || dist(netAt, S.pos) > 250)) setTimeout(refreshNet, 50); });
    map.on('sourcedata', e => { if (S.on && e.sourceId === 'ofm' && e.isSourceLoaded) { clearTimeout(init.t); init.t = setTimeout(refreshNet, 300); } });
    const ready = () => { if (S.on && S.pos) { addTrailLayer(); buildFrames(); place(); map.keyboard.disable(); syncPad(); if (folk) folk.fetchData(); if (afloat() && global.InkSea) { global.InkSea.setSailing(true); global.InkSea.loadWind(); setTimeout(() => updHud(true), 1500); } } };
    if (map.isStyleLoaded()) ready(); else map.once('idle', ready);
  }
  global.InkTraveller = {
    init, dress, setActive, active: () => !!S.on, state: S, _tick: tick,
    goTo(lng, lat) { S.pos = [lng, lat]; if (S.on) { place(); map.jumpTo({ center: S.pos }); } },
    // sailing (also for QA): the water test, the nearest water a boat can take, board or land, the speed factor, the wind
    waterAt, findSea, board, land, speedFactor, sailInfo, boats: BOATS,
  };
})(window);
