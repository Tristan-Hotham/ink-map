/* The Inked World: clouds. A small set of hand-drawn manuscript clouds (curly ink outlines, a cream wash shaded pale
 * blue-grey underneath, some with the flat bottoms of old map clouds), drawn once to canvas at two or three times their size.
 *  - Flying through: on a big zoom (a flight from the world to the Lake District, a fast wheel or pinch, the + and - buttons)
 *    the clouds sweep outward from the zoom's centre and swell past the viewer as if the eye were dropping through a cloud
 *    deck, then clear (about a second, never resting on the centre). Zooming out, they gather instead.
 *  - Resting clouds for depth: a few clouds drift with the shared wind (InkWind) in a band round the edges and corners of the
 *    view, never over its middle 60%, more at the world and continent zooms and none from zoom 13. A pale haze at the far
 *    zooms lifts as you come down, and faint cloud shadows drift across the ground at zooms 5 to 9.
 *  - Every movement is a CSS transform or opacity animation (Web Animations) on a handful of small images, run by the
 *    compositor: no drawing per frame. Everything stops while the map is off screen or the tab is hidden, and the
 *    flying-through and drifting are off when the viewer prefers reduced motion.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const PAL = global.InkPalette || { ink: '#2B2119' };
  const INK = PAL.ink || '#2B2119';
  const N_SPRITES = 10;
  function rngF(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

  // ---------------- the drawings
  // each cloud is a row of overlapping puffs (circles) over a base line. The wash is their union; the ink outline is the part
  // of each puff's rim that no other puff covers, drawn with a slight tremor; the hidden rims of the puffs in front show as
  // thinner inner lines ending in a small curl, as on a sixteenth-century woodcut cloud
  function design(i) {
    const R = rngF(1009 + i * 7919);
    const flat = i % 3 !== 2, tall = i % 4 === 3, long = i % 5 === 1;
    const W = (long ? 190 : 120) + R() * 70, base = tall ? 0.62 : 0.5;
    const n = Math.max(4, Math.round(W / 34 + R() * 2));
    const puffs = [];
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, hump = Math.sin(Math.PI * t);
      const r = W / n * (0.62 + 0.55 * hump * base * 1.6) * (0.85 + 0.3 * R());
      puffs.push({ x: W * (0.06 + 0.88 * t) + (R() - 0.5) * 6, y: -r * (0.45 + 0.25 * R()), r });
    }
    // a second, higher row of smaller puffs on the bigger clouds
    if (!long || R() < 0.5) for (let k = 1; k < n - 1; k += 1 + (R() < 0.5 ? 1 : 0)) {
      const p = puffs[k], r = p.r * (0.6 + 0.25 * R());
      puffs.push({ x: p.x + (R() - 0.5) * p.r * 0.8, y: p.y - p.r * (0.55 + 0.25 * R()), r });
    }
    // round-bottomed clouds get lobes underneath
    if (!flat) for (let k = 1; k < n - 1; k += 2) { const p = puffs[k]; puffs.push({ x: p.x + (R() - 0.5) * 10, y: p.r * 0.15, r: p.r * 0.62 }); }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of puffs) { x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r); y0 = Math.min(y0, p.y - p.r); y1 = Math.max(y1, flat ? 0 : p.y + p.r); }
    return { puffs, flat, hatch: i % 2 === 0, x0: x0 - 6, y0: y0 - 6, x1: x1 + 6, y1: y1 + (flat ? 10 : 6), seed: i };
  }
  function inside(px, py, puffs, skip, flat) {
    if (flat && py > 0.01) return true;   // below the flat base nothing is drawn
    for (let j = 0; j < puffs.length; j++) { if (j === skip) continue; const q = puffs[j]; if ((px - q.x) * (px - q.x) + (py - q.y) * (py - q.y) < q.r * q.r * 0.995) return true; }
    return false;
  }
  function drawCloud(d, S, opt) {
    opt = opt || {};
    const w = d.x1 - d.x0, h = d.y1 - d.y0;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
    const x = c.getContext('2d');
    x.setTransform(S, 0, 0, S, -d.x0 * S, -d.y0 * S);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const R = rngF(31 + d.seed * 13);
    const union = () => { x.beginPath(); for (const p of d.puffs) { x.moveTo(p.x + p.r, p.y); x.arc(p.x, p.y, p.r, 0, Math.PI * 2); } };
    x.save();
    if (d.flat) { x.beginPath(); x.rect(d.x0, d.y0, w, -d.y0); x.clip(); }
    // the wash: warm cream, shaded pale blue-grey underneath, lit at the top of each puff
    union(); x.fillStyle = opt.wash || 'rgba(251,247,236,0.97)'; x.fill();
    x.save(); union(); x.clip();
    const top = d.y0 + 6, bot = d.flat ? 0 : d.y1 - 6;
    const g = x.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, 'rgba(160,176,190,0)'); g.addColorStop(0.55, 'rgba(160,176,190,0.16)'); g.addColorStop(1, 'rgba(132,150,168,0.5)');
    x.fillStyle = g; x.fillRect(d.x0, d.y0, w, h);
    for (const p of d.puffs) {
      const rg = x.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.38, 0, p.x - p.r * 0.2, p.y - p.r * 0.25, p.r * 0.95);
      rg.addColorStop(0, 'rgba(255,253,246,0.95)'); rg.addColorStop(0.6, 'rgba(255,253,246,0.35)'); rg.addColorStop(1, 'rgba(255,253,246,0)');
      x.fillStyle = rg; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
    }
    // ink hatching in the shade along the base
    if (d.hatch) {
      x.strokeStyle = 'rgba(70,82,98,0.32)'; x.lineWidth = 0.7;
      const yb = d.flat ? 0 : (d.y1 - 6) * 0.6;
      for (let t = d.x0 + 8; t < d.x1 - 8; t += 4.2) { const l = 5 + R() * 7; x.beginPath(); x.moveTo(t, yb - 1.5); x.lineTo(t + l * 0.55, yb - 1.5 - l); x.stroke(); }
    }
    x.restore();
    // inner lines: where two puffs meet, the rim of the one behind carries on a short way inside the cloud and ends in a
    // small inward curl, as on a woodcut cloud (only on the upper side, where the light falls)
    x.strokeStyle = 'rgba(43,33,25,0.62)'; x.lineWidth = 0.9;
    d.puffs.forEach((p, k) => {
      const step = Math.max(0.03, 1.6 / p.r), vis = a => !inside(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, d.puffs, k, d.flat);
      for (let a = 0; a < Math.PI * 2; a += step) {
        const v0 = vis(a), v1 = vis(a + step);
        if (v0 === v1) continue;
        const at = a + step / 2, py = p.y + Math.sin(at) * p.r;
        if (py > -p.r * 0.15 || py > -4 || R() < 0.55) continue;   // upper side only
        const dir = v0 ? 1 : -1, span = Math.min(0.75, (10 + R() * 8) / p.r);
        // the arc running on into the hidden part of the rim
        x.beginPath();
        let ex = 0, ey = 0, ea = at;
        for (let t = 0; t <= span; t += 0.04) { ea = at + dir * t; ex = p.x + Math.cos(ea) * p.r; ey = p.y + Math.sin(ea) * p.r; t ? x.lineTo(ex, ey) : x.moveTo(ex, ey); }
        // and the curl: a tightening spiral turning in towards the puff's centre
        const tx = -Math.sin(ea) * dir, ty = Math.cos(ea) * dir, nx = -Math.cos(ea), ny = -Math.sin(ea);
        const c0 = Math.min(4.2, p.r * 0.14);
        for (let u = 0; u <= 1.0001; u += 0.08) {
          const th = u * Math.PI * 1.5, rr = c0 * (1 - 0.55 * u);
          const cx = ex + nx * c0, cy = ey + ny * c0;
          x.lineTo(cx - nx * rr * Math.cos(th) + tx * rr * Math.sin(th), cy - ny * rr * Math.cos(th) + ty * rr * Math.sin(th));
        }
        x.stroke();
      }
    });
    // the outline: each puff's rim where no other puff covers it, with a slight tremor of the pen
    x.strokeStyle = INK; x.lineWidth = opt.line || 1.35;
    d.puffs.forEach((p, k) => {
      let on = false; x.beginPath();
      const step = Math.max(0.035, 2.2 / p.r);
      for (let a = 0; a <= Math.PI * 2 + step; a += step) {
        const rr = p.r * (1 + Math.sin(a * 5 + k) * 0.012 + Math.sin(a * 13 + k * 3) * 0.006), px = p.x + Math.cos(a) * rr, py = p.y + Math.sin(a) * rr;
        const vis = !inside(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, d.puffs, k, d.flat);
        if (vis) { on ? x.lineTo(px, py) : x.moveTo(px, py); on = true; } else on = false;
      }
      x.stroke();
    });
    x.restore();
    // the flat base: one long stroke, a little uneven, with a fainter second line under it
    if (d.flat) {
      let xa = 1e9, xb = -1e9;
      for (const p of d.puffs) if (p.y + p.r > 0) { const half = Math.sqrt(Math.max(0, p.r * p.r - p.y * p.y)); xa = Math.min(xa, p.x - half); xb = Math.max(xb, p.x + half); }
      x.strokeStyle = INK; x.lineWidth = opt.line || 1.35; x.beginPath(); x.moveTo(xa, 0);
      for (let t = xa; t <= xb; t += 6) x.lineTo(t, Math.sin(t * 0.13 + d.seed) * 0.5); x.lineTo(xb, 0); x.stroke();
      x.strokeStyle = 'rgba(43,33,25,0.35)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(xa + 10, 3.6); x.lineTo(xb - 14, 3.2); x.stroke();
      if (d.seed % 4 === 0) { x.beginPath(); x.moveTo(xa + 26, 6.8); x.lineTo(xb - 34, 6.6); x.stroke(); }
    }
    c.__w = w; c.__h = h;
    return c;
  }
  const DESIGNS = Array.from({ length: N_SPRITES }, (_, i) => design(i));
  function sprite(i, S, opt) { return drawCloud(DESIGNS[i % N_SPRITES], S, opt); }
  // ---------------- altitude: MapLibre's camera sits 1.5 view heights above the centre (its field of view is about 37
  // degrees), so the eye is at about 1.5 x the view's height in metres
  function altitude(map) {
    const H = map.getContainer().clientHeight || 600, lat = map.getCenter().lat;
    const mpp = 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
    return 1.5 * H * mpp;
  }
  function round2(v) { const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; }
  function altitudeText(m) {
    const km = m / 1000, f = v => round2(v).toLocaleString('en-GB');
    if (km >= 12000) return 'seen from about ' + f(km) + ' km, far out in space';
    if (km >= 100) return 'seen from about ' + f(km) + ' km, as from orbit';
    if (km >= 15) return 'from about ' + f(km) + ' km, high above the clouds';
    if (km >= 2) return 'from about ' + f(km) + ' km, among the clouds';
    if (m >= 250) return 'a bird\'s-eye view from about ' + f(m) + ' m';
    return 'as from a church tower, about ' + f(Math.max(10, m)) + ' m up';
  }

  // ---------------- on the page
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function attach(map, opts) {
    opts = opts || {};
    if (!map || map.__clouds) return map && map.__clouds;
    const host = map.getCanvasContainer(), cont = map.getContainer();
    const dpr = global.devicePixelRatio || 1, S = Math.min(3, Math.max(2, Math.round(dpr * 1.5)));
    const root = document.createElement('div'); root.className = 'ink-clouds'; root.setAttribute('aria-hidden', 'true');
    // (every box here is zero-sized: a transparent box the size of the view over the map would still be blended over it at
    // every frame on a machine without a GPU; only the small cloud pictures themselves are layers)
    root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none';
    const rest = document.createElement('div'); rest.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
    const fly = document.createElement('div'); fly.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
    const veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;left:0;top:0;width:var(--vw,100px);height:var(--vh,100px);opacity:0;display:none;background:radial-gradient(circle at 50% 50%, rgba(250,250,246,0) 18%, rgba(250,250,246,0.55) 70%, rgba(246,248,250,0.8) 100%)';
    root.append(rest, veil, fly);
    host.appendChild(root);

    let on = true;
    try { if (global.localStorage && localStorage.getItem('ink-clouds') === '0') on = false; } catch (e) {}
    if (opts.off) on = false;
    const st = { on, shown: true, rest: [], restZ: null, flying: 0 };
    // sprites, as images so every copy shares one decoded picture
    const urls = [];
    const imgSize = [];
    for (let i = 0; i < N_SPRITES; i++) { const c = sprite(i, S); urls.push(c.toDataURL('image/png')); imgSize.push([c.__w, c.__h]); }
    function img(i, cls) {
      const el = document.createElement('img'); el.src = urls[i % N_SPRITES]; el.alt = ''; el.decoding = 'async'; el.draggable = false;
      const [w, h] = imgSize[i % N_SPRITES];
      el.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform-origin:50% 50%;opacity:0;will-change:transform,opacity`;
      el.__w = w; el.__h = h; if (cls) el.className = cls; return el;
    }
    const size = () => [cont.clientWidth, cont.clientHeight];
    const T = (el, cx, cy, sc, flip) => `translate(${(cx - el.__w / 2).toFixed(1)}px,${(cy - el.__h / 2).toFixed(1)}px) scale(${(flip ? -sc : sc).toFixed(3)},${sc.toFixed(3)})`;
    const wind = () => {
      try { const c = map.getCenter(); if (global.InkWind) { const w = InkWind.at(c.lng, c.lat); return [w.to[0], -w.to[1]]; } } catch (e) {}
      return [0.94, 0.34];
    };

    // ---- resting clouds: how many, and how strong, at this zoom
    const DBG = String(opts.dbg || '');   // QA only (?cloudsdbg=norest,noshadow,nodrift)
    function restCount(z) { if (DBG.includes('norest')) return 0; if (z >= 13) return 0; if (z >= 11) return 2; if (z >= 8.5) return 3; if (z >= 5.5) return 4; if (z >= 3) return 6; return 7; }
    // (and from zoom 12 they fade out, gone by 13)
    function restAlpha(z) { return (z >= 12 ? 0.5 * Math.max(0, Math.min(1, 13 - z)) : z >= 9 ? 0.66 : 0.8); }
    function restScale(z) { return z < 3 ? 1.15 : z < 6 ? 1.08 : z < 9 ? 1.0 : 0.88; }
    // a cloud of this size at (cx, cy) keeps clear of the middle 60% of the view (both ways)
    function clearOfMiddle(cx, cy, hw, hh, W, H) {
      return cx + hw < W * 0.2 || cx - hw > W * 0.8 || cy + hh < H * 0.2 || cy - hh > H * 0.8;
    }
    // where a resting cloud may start, and how far it may drift with the wind before it must fade
    function placeRest(el, k, z, W, H) {
      const sc = restScale(z) * (0.8 + Math.random() * 0.4), hw = el.__w * sc / 2 * 0.86, hh = el.__h * sc / 2 * 0.8;
      const wv = wind(), speed = 3 + Math.random() * 3;   // screen pixels a second
      for (let tries = 0; tries < 40; tries++) {
        // corners and edges: pick an edge (k spreads them round), then a point along it, tucked partly off screen
        const edge = (k + tries) % 4, u = Math.random();
        let cx, cy;
        if (edge === 0) { cx = u * W; cy = -hh * 0.1 + Math.random() * H * 0.08; }
        else if (edge === 1) { cx = W + hw * 0.1 - Math.random() * W * 0.07; cy = u * H; }
        else if (edge === 2) { cx = u * W; cy = H + hh * 0.15 - Math.random() * H * 0.08; }
        else { cx = -hw * 0.1 + Math.random() * W * 0.07; cy = u * H; }
        if (!clearOfMiddle(cx, cy, hw, hh, W, H)) continue;
        // how long it can drift before touching the middle (checked every 2 s of drift, at most 80 s)
        let life = 0;
        for (let t = 2; t <= 80; t += 2) { if (!clearOfMiddle(cx + wv[0] * speed * t, cy + wv[1] * speed * t, hw, hh, W, H)) break; life = t; }
        if (life < 16) continue;
        return { cx, cy, sc, life, dx: wv[0] * speed * life, dy: wv[1] * speed * life, flip: Math.random() < 0.4 };
      }
      return null;
    }
    function runRest(el, k) {
      if (!st.on || !st.shown) return;
      const z = map.getZoom(), [W, H] = size();
      // a cloud whose drift ends at a height with no resting clouds (zoom 13 and in) does not come back
      if (restAlpha(z) < 0.02 || restCount(z) === 0) { el.style.opacity = '0'; return; }
      const p = placeRest(el, k, z, W, H);
      if (!p) { el.style.opacity = '0'; el.__t = setTimeout(() => runRest(el, k + 1), 4000); return; }
      const a = restAlpha(z);
      if (reduce() || DBG.includes('nodrift')) { el.style.transform = T(el, p.cx, p.cy, p.sc, p.flip); el.style.opacity = String(a); return; }
      const life = p.life * 1000, fade = Math.min(5000, life * 0.2);
      const an = el.animate([
        { transform: T(el, p.cx, p.cy, p.sc, p.flip), opacity: 0 },
        { transform: T(el, p.cx + p.dx * fade / life, p.cy + p.dy * fade / life, p.sc, p.flip), opacity: a, offset: fade / life },
        { transform: T(el, p.cx + p.dx * (1 - fade / life), p.cy + p.dy * (1 - fade / life), p.sc, p.flip), opacity: a, offset: 1 - fade / life },
        { transform: T(el, p.cx + p.dx, p.cy + p.dy, p.sc, p.flip), opacity: 0 },
      ], { duration: life, easing: 'linear', fill: 'both' });
      el.__an = an;
      an.onfinish = () => { if (el.__an === an) runRest(el, k + 2); };
    }
    function clearRest() {
      for (const el of st.rest) { clearTimeout(el.__t); if (el.__an) { el.__an.onfinish = null; el.__an.cancel(); } el.remove(); }
      st.rest = [];
    }
    function layRest() {
      clearRest();
      if (!st.on || !st.shown) return;
      const z = map.getZoom(), n = restCount(z); st.restZ = z;
      const pick = [...Array(N_SPRITES).keys()].sort(() => Math.random() - 0.5);
      for (let k = 0; k < n; k++) {
        const el = img(pick[k % N_SPRITES], 'rest'); rest.appendChild(el); st.rest.push(el);
        // start part way through its drift so the view is never empty after a move
        runRest(el, k);
        if (el.__an) el.__an.currentTime = Math.min(el.__an.effect.getTiming().duration * 0.12, 3000) + Math.random() * 1500;
      }
    }

    // ---- cloud shadows on the ground at zooms 5 to 9: soft dark blotches drawn by the map itself (a circle layer with full
    // blur under the names), so they lie on the land and move with it at no cost to a pan; at rest they creep downwind a few
    // pixels every 3 s (one repaint each time)
    let shadeAt = null, shadeT = 0, shadeOff = [0, 0];
    const SH = 'cloud-shadows';
    function shadowAlpha(z) { if (DBG.includes('noshadow')) return 0; if (z < 4.6 || z > 9.6) return 0; return 1; }
    function ensureShadeLayer() {
      if (map.getLayer(SH)) return true;
      try {
        map.addSource(SH, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        const first = map.getStyle().layers.find(l => l.type === 'symbol');
        const R = ['*', ['get', 'r'], ['^', 2, ['-', 4, ['get', 'z0']]]], R2 = ['*', ['get', 'r'], ['^', 2, ['-', 10, ['get', 'z0']]]];
        map.addLayer({ id: SH, type: 'circle', source: SH, metadata: { group: 'clouds' }, paint: {
          'circle-color': '#2E343A', 'circle-blur': 1, 'circle-pitch-alignment': 'map',
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 4, R, 10, R2],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4.6, 0, 5.5, ['get', 'a'], 8.7, ['get', 'a'], 9.6, 0] } }, first && first.id);
        return true;
      } catch (e) { return false; }
    }
    function layShadows() {
      const z = map.getZoom();
      shadeAt = null; shadeOff = [0, 0];
      if (!ensureShadeLayer()) return;
      map.setPaintProperty(SH, 'circle-translate', [0, 0]);
      const on = st.on && st.shown && shadowAlpha(z) > 0;
      map.setLayoutProperty(SH, 'visibility', on ? 'visible' : 'none');
      if (!on) { map.getSource(SH).setData({ type: 'FeatureCollection', features: [] }); return; }
      const [W, H] = size(), c = map.getCenter(), feats = [];
      shadeAt = { ll: [c.lng, c.lat], z };
      for (let k = 0; k < 5; k++) {
        const cx = W * (-0.1 + 1.2 * Math.random()), cy = H * (-0.1 + 1.2 * Math.random()), a = 0.09 + Math.random() * 0.05;
        for (let j = 0; j < 2; j++) {
          const p = map.unproject([cx + (Math.random() - 0.5) * 110, cy + (Math.random() - 0.5) * 50]);
          feats.push({ type: 'Feature', properties: { r: 55 + Math.random() * 55, z0: z, a }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } });
        }
      }
      map.getSource(SH).setData({ type: 'FeatureCollection', features: feats });
    }
    function creepShadows() {
      if (!shadeAt || map.isMoving() || reduce() || !st.on || !st.shown) return;
      const wv = wind(), [W] = size();
      shadeOff = [shadeOff[0] + wv[0] * 4, shadeOff[1] + wv[1] * 4];
      if (Math.hypot(shadeOff[0], shadeOff[1]) > W * 0.5) { layShadows(); return; }
      map.setPaintProperty(SH, 'circle-translate', [Math.round(shadeOff[0] * 10) / 10, Math.round(shadeOff[1] * 10) / 10]);
    }
    shadeT = setInterval(creepShadows, 3000);

    // ---- haze at the far zooms, lifting as you come down
    let hazeA = -1;
    function setHaze() {
      const z = map.getZoom(), a = !st.on || !st.shown ? 0 : Math.max(0, Math.min(1, (6.5 - z) / 4.5));
      const q = Math.round(a * 40) / 40;   // in steps, so a pan never restyles it
      if (q === hazeA) return; hazeA = q;
      // drawn by the page's own vignette (#map::after in index.html) through a custom property: no extra layer over the map
      cont.style.setProperty('--haze', (q * 0.9).toFixed(3));
    }

    // ---- flying through: on a big zoom the clouds sweep past from the zoom's centre
    let pointer = null, pointerAt = 0;
    const markPointer = (x, y) => { const r = cont.getBoundingClientRect(); pointer = [x - r.left, y - r.top]; pointerAt = performance.now(); };
    cont.addEventListener('wheel', e => markPointer(e.clientX, e.clientY), { passive: true, capture: true });
    cont.addEventListener('touchmove', e => { if (e.touches.length === 2) markPointer((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2); }, { passive: true, capture: true });
    cont.addEventListener('dblclick', e => markPointer(e.clientX, e.clientY), { capture: true });
    function burst(dir, strength) {
      if (!st.on || !st.shown || reduce()) return;
      const [W, H] = size(), m = Math.min(W, H), M = Math.max(W, H);
      const c = pointer && performance.now() - pointerAt < 600 ? pointer : [W / 2, H / 2];
      const n = Math.round(6 + 10 * strength), base = 0.85 + 0.4 * strength;
      st.flying++;
      // the resting clouds give way while the eye passes through
      rest.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      let left = n;
      const done = () => { if (--left === 0) { st.flying--; } };
      // a pale veil, brightest at the edges, that blooms and clears (never over the centre)
      veil.style.setProperty('--vw', W + 'px'); veil.style.setProperty('--vh', H + 'px'); veil.style.display = '';
      const va = veil.animate([{ opacity: 0 }, { opacity: 0.55 * strength + 0.2, offset: dir > 0 ? 0.3 : 0.6 }, { opacity: 0 }], { duration: 950, easing: 'ease-in-out' });
      va.onfinish = () => { if (!st.flying) veil.style.display = 'none'; };
      for (let j = 0; j < n; j++) {
        const el = img((j * 3 + Math.floor(Math.random() * N_SPRITES)) % N_SPRITES, 'fly'); fly.appendChild(el);
        const a = (j + Math.random() * 0.7) / n * Math.PI * 2, r0 = m * (0.08 + Math.random() * 0.3), r1 = r0 + M * (0.7 + Math.random() * 0.45);
        const s0 = base * (0.55 + Math.random() * 0.4), s1 = s0 * (3.4 + Math.random() * 1.8), flip = Math.random() < 0.4;
        const p0 = [c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0 * 0.8], p1 = [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1 * 0.8];
        const pk = 0.9 + Math.random() * 0.1;
        const kf = dir > 0
          ? [{ transform: T(el, p0[0], p0[1], s0, flip), opacity: 0 }, { opacity: pk, offset: 0.1 }, { opacity: pk * 0.95, offset: 0.55 }, { transform: T(el, p1[0], p1[1], s1, flip), opacity: 0 }]
          : [{ transform: T(el, p1[0], p1[1], s1, flip), opacity: 0 }, { opacity: pk * 0.95, offset: 0.4 }, { opacity: pk, offset: 0.8 }, { transform: T(el, p0[0] + (p1[0] - p0[0]) * 0.15, p0[1] + (p1[1] - p0[1]) * 0.15, s0, flip), opacity: 0 }];
        const an = el.animate(kf, { duration: 700 + 400 * strength + Math.random() * 200, delay: (j % 3) * 70 + Math.random() * 90, easing: dir > 0 ? 'cubic-bezier(.35,0,.75,1)' : 'cubic-bezier(.2,.4,.5,1)', fill: 'both' });
        an.onfinish = () => { el.remove(); done(); };
      }
    }
    // a movement: zoom change since the move began (or since the last burst), and at most two cloud decks per move
    let mv = null;
    // the slow drifts are paused while the map moves: a running animation asks the compositor for a fresh frame at every
    // tick, and on a slow machine those frames compete with the map's own (they ride along with the map's frames instead)
    const drifts = () => st.rest.map(el => el.__an).filter(Boolean);
    map.on('movestart', () => {
      mv = { z0: map.getZoom(), zRef: map.getZoom(), n: 0, at: 0, c: map.getCenter(), zoomed: false };
      for (const a of drifts()) { try { a.pause(); } catch (e) {} }
      // and the resting clouds thin away while the ground slides under them (a hidden layer costs nothing to composite),
      // drifting back in once the map rests
      if (st.rest.length) { rest.style.transition = 'opacity .25s ease'; rest.style.opacity = '0'; clearTimeout(st.hideT); st.hideT = setTimeout(() => { if (mv) rest.style.visibility = 'hidden'; }, 280); }
    });
    map.on('move', () => {
      if (!mv) return;
      const z = map.getZoom(), dz = z - mv.zRef;
      if (Math.abs(z - mv.z0) > 0.02) mv.zoomed = true;
      // the zoom's direction decides in or out; a deck is crossed at 0.95 levels, then again after 3.5 more
      const need = mv.n === 0 ? 0.95 : 3.5, now = performance.now();
      if (st.on && mv.n < 2 && Math.abs(dz) >= need && now - mv.at > 900 && (dz > 0 ? mv.zRef < 12.5 : z < 13)) {
        const total = Math.abs(dz);
        burst(dz > 0 ? 1 : -1, Math.min(1, (total - 0.6) / 2.4));
        mv.n++; mv.at = now; mv.zRef = z;
      }
      // a zoom swells the resting clouds and fades them (a plain pan leaves them be: restyling a layer the size of the view
      // at every frame of a pan costs a slow machine a good part of its frame rate)
      if (mv.zoomed && !mv.n && st.rest.length) {
        const k = Math.pow(2, (z - mv.z0) * 0.6), [W, H] = size();
        rest.style.transition = 'none'; rest.style.transformOrigin = `${W / 2}px ${H / 2}px`; rest.style.transform = `scale(${k.toFixed(3)})`; rest.style.opacity = String(Math.max(0, 1 - Math.abs(z - mv.z0) * 0.8));
      }
      setHaze();
    });
    map.on('moveend', () => {
      const m = mv; mv = null; setHaze(); clearTimeout(st.hideT); rest.style.visibility = '';
      for (const a of drifts()) { try { if (a.playState === 'paused') a.play(); } catch (e) {} }
      if (!m) return;
      const z = map.getZoom();
      // the clouds of a flight down to the deep zooms clear at once when the map rests there
      if (z >= 13 && fly.children.length) {
        for (const el of [...fly.children]) {
          const op = getComputedStyle(el).opacity;
          el.getAnimations().forEach(a => { a.onfinish = null; a.pause(); });
          el.animate([{ opacity: op }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).onfinish = () => el.remove();
        }
        st.flying = 0; veil.style.display = 'none';
      }
      // (small zooms add up: compare with the zoom the set was laid for, and re-lay in the fade band 12 to 13 or when the
      // count for this height differs, so wheel steps of a quarter level can never carry clouds down to the deep zooms)
      const zr = st.restZ == null ? z : st.restZ;
      if ((m.zoomed && (Math.abs(z - m.z0) > 0.25 || m.n)) || Math.abs(z - zr) > 0.6 || restCount(z) !== restCount(zr) || (Math.max(z, zr) > 12 && Math.abs(z - zr) > 0.05)) {
        // a new set for the new height, faded in
        rest.getAnimations().forEach(a => a.cancel()); rest.style.transition = 'none'; rest.style.transform = ''; rest.style.opacity = '0';
        layRest(); requestAnimationFrame(() => { rest.style.transition = 'opacity 1.4s ease'; rest.style.opacity = '1'; });
      } else {
        rest.getAnimations().forEach(a => a.cancel());
        rest.style.transition = 'transform .5s ease, opacity .9s ease .15s'; rest.style.transform = ''; rest.style.opacity = '1';
      }
      // the shadows lie on the ground: lay a fresh set when the zoom has changed a lot or they have slid away
      const sa = shadowAlpha(z);
      if (!shadeAt ? sa > 0 : (sa <= 0 || Math.abs(z - shadeAt.z) > 0.8 || (() => { const p = map.project(shadeAt.ll), [W, H] = size(); return Math.abs(p.x - W / 2) > W * 0.7 || Math.abs(p.y - H / 2) > H * 0.7; })())) layShadows();
    });
    map.on('resize', () => { if (!map.isMoving()) layRest(); });

    // ---- off screen or a hidden tab: nothing runs
    function setShown(v) {
      if (v === st.shown) return; st.shown = v;
      root.style.display = v && st.on ? '' : 'none';
      if (v) { layRest(); layShadows(); hazeA = -1; setHaze(); }
      else { clearRest(); layShadows(); hazeA = -1; setHaze(); }
    }
    let visible = true;
    const sync = () => setShown(visible && !document.hidden);
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in global) new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); sync(); }).observe(cont);
    function setOn(v) {
      st.on = !!v; try { global.localStorage && localStorage.setItem('ink-clouds', st.on ? '1' : '0'); } catch (e) {}
      root.style.display = st.on && st.shown ? '' : 'none';
      if (st.on && st.shown) { layRest(); layShadows(); hazeA = -1; setHaze(); } else { clearRest(); layShadows(); hazeA = -1; setHaze(); }
      if (opts.onAlt) opts.onAlt();
    }
    root.style.display = st.on ? '' : 'none';
    layRest(); layShadows(); setHaze();
    const api = { state: st, setOn, isOn: () => st.on, burst, layRest, root };
    map.__clouds = api;
    return api;
  }

  // ---------------- the poster: a few clouds tucked in at the corners and edges of the map, under the frame
  function drawPosterClouds(ctx, x, y, w, h, s) {
    const R = rngF(4242), spots = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.55]];
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    spots.forEach(([u, v], k) => {
      const c = sprite((k * 3 + 1) % N_SPRITES, Math.min(6, s * 1.6)), sc = s * (u === 0.5 || v === 0.5 || v === 0.55 ? 0.95 : 1.3) * (0.9 + R() * 0.25);
      const cw = c.__w * sc, ch = c.__h * sc;
      const cx = x + u * w + (u === 0 ? cw * 0.18 : u === 1 ? -cw * 0.18 : (R() - 0.5) * w * 0.3), cy = y + v * h + (v === 0 ? ch * 0.12 : v === 1 ? -ch * 0.18 : (R() - 0.5) * h * 0.2);
      ctx.globalAlpha = 0.92; ctx.drawImage(c, cx - cw / 2, cy - ch / 2, cw, ch);
    });
    ctx.restore();
  }

  global.InkClouds = { attach, sprite, drawCloud, design, drawPosterClouds, altitude, altitudeText, N: N_SPRITES };
})(window);
