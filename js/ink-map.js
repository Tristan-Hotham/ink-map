/* The Inked World: a zoomable, hand-inked style world map on MapLibre GL JS.
 * Glyphs (mountains, hills, trees, tufts) are computed in js/ink-worker.js and served through the
 * custom "ink://" protocol; everything else is styled from OpenFreeMap vector tiles.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const INK = {
    paper: '#F3E5BF', paperDeep: '#E7D2A0', ink: '#2B2119', inkSoft: 'rgba(43,33,25,0.55)',
    red: '#A3261B', redDeep: '#8A1F16', blue: '#3D6E9E', blueSoft: '#6F9DC6', wash: '#7FA9CF',
  };
  const DEFAULTS = {
    tilejson: 'https://tiles.openfreemap.org/planet',
    dem: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    demMax: 15,
    base: null, // base URL of this page's folder (for fonts, data, worker)
  };

  // ------------------------------------------------------------------ sprites
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function wob(ctx, pts, R, amt) { // stroke a polyline with a slight hand wobble
    ctx.beginPath();
    pts.forEach((p, i) => { const x = p[0] + (R() - 0.5) * amt, y = p[1] + (R() - 0.5) * amt; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  function quad(p0, c, p1, n) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t; o.push([a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1]]); } return o; }
  function toImage(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); }
  // crop a sprite to its inked pixels, so a glyph only gives way to a name where it really touches it
  function trim(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return c;
    const o = canvas(x1 - x0 + 3, y1 - y0 + 3); o.getContext('2d').drawImage(c, -x0 + 1, -y0 + 1);
    return o;
  }

  function mountainSprite(v) {
    const R = rng(1000 + v * 7919), W = 76, H = 64, base = 58;
    const c = canvas(W, H), x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round';
    const tall = v % 4 === 3 ? 0.62 : 0.78 + R() * 0.16;
    const ax = 30 + R() * 14, ay = base - (base - 6) * tall;
    const lf = 4 + R() * 5, rf = W - 4 - R() * 5;
    // flanks: left concave, right slightly convex; optional shoulder
    let left = quad([lf, base], [ax - 10 - R() * 6, base - (base - ay) * 0.42], [ax, ay], 10);
    let right;
    if (v % 3 === 1) { // shoulder on the right
      const sx = ax + (rf - ax) * 0.5, sy = ay + (base - ay) * (0.38 + R() * 0.1);
      right = quad([ax, ay], [ax + 4, ay + (sy - ay) * 0.6], [sx - 3, sy - 2], 6).concat(quad([sx - 3, sy - 2], [sx + 6, sy - 3], [rf, base], 8).slice(1));
    } else if (v % 3 === 2) { // shoulder on the left
      const sx = lf + (ax - lf) * 0.42, sy = ay + (base - ay) * (0.42 + R() * 0.1);
      left = quad([lf, base], [lf + 4, sy + 6], [sx, sy], 6).concat(quad([sx, sy], [sx + 6, sy - 2], [ax, ay], 7).slice(1));
      right = quad([ax, ay], [ax + 12 + R() * 6, base - (base - ay) * 0.5], [rf, base], 10);
    } else right = quad([ax, ay], [ax + 12 + R() * 6, base - (base - ay) * 0.55], [rf, base], 10);
    const spurX = ax + 7 + R() * 7;
    const spur = quad([ax, ay], [ax + 2 + R() * 3, ay + (base - ay) * 0.5], [spurX, base], 8);
    // silhouette fill (paper) so peaks behind are hidden
    x.beginPath(); left.concat(right).forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
    x.fillStyle = 'rgba(243,229,191,0.97)'; x.fill();
    // shaded face between spur and right flank
    x.save(); x.beginPath(); spur.concat(right.slice().reverse()).forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.clip();
    x.strokeStyle = INK.ink; x.lineWidth = 1.35;
    const dx = -0.42, step = 2.7;
    for (let s = -60; s < 110; s += step) {
      const x0 = ax + s * 0.7 - 10, y0 = ay - 4, len = 80;
      wob(x, [[x0, y0], [x0 + dx * len * 0.5, y0 + len * 0.5], [x0 + dx * len, y0 + len]], R, 0.5);
    }
    x.restore();
    // a few strokes on the lit face
    x.strokeStyle = INK.ink; x.lineWidth = 1.1;
    for (let k = 0; k < 2 + (v % 2); k++) {
      const t = 0.45 + R() * 0.4, p = left[Math.floor(t * (left.length - 1))];
      wob(x, [[p[0] + 3, p[1] + 2], [p[0] + 6 + R() * 3, p[1] + 7 + R() * 4]], R, 0.4);
    }
    // outline
    x.lineWidth = 2.8; x.strokeStyle = INK.ink;
    wob(x, left, R, 0.6); wob(x, right, R, 0.6);
    x.lineWidth = 1.3; wob(x, spur.slice(0, 7), R, 0.4);
    // ground ticks
    x.lineWidth = 1.2;
    wob(x, [[lf - 2, base + 1], [lf + 7, base + 1.5]], R, 0.3);
    wob(x, [[rf - 7, base + 1.5], [rf + 1, base + 1]], R, 0.3);
    return c;
  }
  function hillSprite(v) {
    const R = rng(5000 + v * 104729), W = 56, H = 30, base = 25;
    const c = canvas(W, H), x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round';
    const h = 11 + R() * 6, cx = 24 + R() * 8;
    const arc = quad([4, base], [cx - 6, base - h * 2.0], [W - 5, base], 14);
    x.beginPath(); arc.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
    x.fillStyle = 'rgba(243,229,191,0.95)'; x.fill();
    x.strokeStyle = INK.ink; x.lineWidth = 1.5;
    const n = 4 + (v % 3);
    for (let k = 0; k < n; k++) {
      const t = 0.55 + k * (0.38 / n), p = arc[Math.round(t * (arc.length - 1))];
      wob(x, [[p[0] - 1, p[1] + 2], [p[0] - 4 - R() * 2, p[1] + 5 + R() * 3]], R, 0.3);
    }
    x.lineWidth = 2.6; wob(x, arc, R, 0.5);
    x.lineWidth = 1.1; wob(x, [[W - 9, base + 1], [W - 1, base + 1]], R, 0.3);
    return c;
  }
  function treeSprite(v, conifer) {
    const R = rng(9000 + v * 31 + (conifer ? 777 : 0)), W = 26, H = 32;
    const c = canvas(W, H), x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = INK.ink;
    if (!conifer) {
      const cx = 13, cy = 12, r = 8 + R() * 1.5;
      const pts = [];
      for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = r * (1 + 0.1 * Math.sin(a * 7 + v)) * (a > 0.3 && a < 2.8 ? 1 : 0.97); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]); }
      x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
      x.fillStyle = 'rgba(243,229,191,0.96)'; x.fill();
      x.lineWidth = 1.1;
      for (let k = 0; k < 3; k++) { const a = 0.2 + k * 0.45; wob(x, [[cx + Math.cos(a) * (r - 2.5), cy + Math.sin(a) * (r - 2.5)], [cx + Math.cos(a + 0.35) * (r - 1.5), cy + Math.sin(a + 0.35) * (r - 1.5)]], R, 0.2); }
      x.lineWidth = 1.7; wob(x, pts, R, 0.35);
      x.lineWidth = 1.6; wob(x, [[cx, cy + r * 0.9], [cx + 0.3, cy + r * 0.9 + 6]], R, 0.2);
    } else {
      const cx = 13, top = 1.5, w = 6.5 + R() * 1.5, tiers = 3;
      const sil = [[cx, top]];
      const right = [], left = [];
      for (let k = 0; k < tiers; k++) {
        const y0 = top + k * 6.2, y1 = y0 + 9.5, ww = w * (k + 1) / tiers + 1.2;
        right.push([cx + ww * 0.45, y0 + 4.5], [cx + ww, y1]);
        left.push([cx - ww * 0.45, y0 + 4.5], [cx - ww, y1]);
      }
      const bot = top + (tiers - 1) * 6.2 + 9.5;
      x.beginPath(); x.moveTo(cx, top); right.forEach(p => x.lineTo(p[0], p[1])); left.slice().reverse().forEach(p => x.lineTo(p[0], p[1])); x.closePath();
      x.fillStyle = 'rgba(243,229,191,0.96)'; x.fill();
      x.lineWidth = 1.0; for (let k = 0; k < tiers; k++) { const y = top + k * 6.2 + 8; wob(x, [[cx + 1, y - 1], [cx + w * (k + 1) / tiers, y + 0.5]], R, 0.2); }
      x.lineWidth = 1.6;
      for (let k = 0; k < tiers; k++) {
        const y0 = top + k * 6.2, y1 = y0 + 9.5, ww = w * (k + 1) / tiers + 1.2;
        wob(x, [[cx - ww, y1], [cx - ww * 0.4, y0 + 4.2], [cx, y0], [cx + ww * 0.4, y0 + 4.2], [cx + ww, y1]], R, 0.3);
        wob(x, [[cx - ww, y1], [cx + ww, y1]], R, 0.25);
      }
      x.lineWidth = 1.6; wob(x, [[cx, bot], [cx, bot + 4.5]], R, 0.2);
    }
    return c;
  }
  function tuftSprite(v, wet) {
    const R = rng(300 + v * 17 + (wet ? 50 : 0)), c = canvas(28, 18), x = c.getContext('2d');
    x.lineCap = 'round'; x.strokeStyle = wet ? INK.blue : INK.ink; x.lineWidth = 1.2;
    if (wet) {
      for (let k = -1; k <= 1; k++) wob(x, [[14 + k * 4, 12], [14 + k * 5.5, 5 + Math.abs(k) * 2 + R()]], R, 0.3);
      x.lineWidth = 1.1; wob(x, [[5, 14], [23, 14]], R, 0.4); wob(x, [[9, 16.5], [19, 16.5]], R, 0.4);
    } else {
      for (let k = -1; k <= 1; k++) wob(x, [[14 + k * 2, 14], [14 + k * 6, 7 + Math.abs(k) * 2 + R() * 2]], R, 0.3);
    }
    return c;
  }
  // ---- biome glyphs
  function duneSprite(v) {
    // a small field of crescent dunes: each a long windward curve with a short steep slip face, and sand stipple
    const R = rng(7000 + v * 61), c = canvas(52, 26), x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = INK.ink;
    const rows = [[3, 9, 22], [22, 15, 24], [8, 21, 18]];
    rows.slice(0, 2 + (v % 2)).forEach(([ox, oy, w], k) => {
      ox += R() * 4; const tip = [ox + w, oy - 1];
      x.lineWidth = 1.45; wob(x, quad([ox, oy + 2], [ox + w * 0.55, oy - 6], tip, 10), R, 0.3);
      x.lineWidth = 1.0; wob(x, quad(tip, [ox + w * 0.82, oy + 3], [ox + w * 0.6, oy + 4.5], 6), R, 0.2);
      x.lineWidth = 0.7; for (let t = 0; t < 3; t++) wob(x, [[ox + w * (0.72 + t * 0.07), oy + 0.5], [ox + w * (0.7 + t * 0.07), oy + 3.2]], R, 0.1);
    });
    x.fillStyle = INK.ink;
    for (let k = 0; k < 9; k++) { x.beginPath(); x.arc(2 + R() * 48, 4 + R() * 21, 0.65, 0, 7); x.fill(); }
    return c;
  }
  function grassSprite(v) {
    const R = rng(8100 + v * 37), c = canvas(22, 16), x = c.getContext('2d');
    x.lineCap = 'round'; x.strokeStyle = INK.ink; x.lineWidth = 1.35;
    const n = 4 + (v % 2);
    for (let k = 0; k < n; k++) { const t = k / (n - 1) - 0.5, bx = 11 + t * 5; wob(x, quad([bx, 14], [bx + t * 4, 9], [bx + t * 9 + (R() - 0.5) * 2, 4 + Math.abs(t) * 5 + R() * 2], 5), R, 0.2); }
    return c;
  }
  function rainSprite(v) {
    const R = rng(8800 + v * 53), c = canvas(34, 30), x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = INK.ink;
    if (v === 3) { // a palm among the crowns
      x.lineWidth = 1.5; wob(x, quad([17, 28], [15, 18], [18, 9], 8), R, 0.2);
      x.lineWidth = 1.3; for (const a of [-2.6, -2.0, -1.2, -0.5, 0.1]) wob(x, quad([18, 9], [18 + Math.cos(a) * 6, 9 + Math.sin(a) * 6 - 2], [18 + Math.cos(a) * 11, 9 + Math.sin(a) * 6 + 4], 6), R, 0.2);
      return c;
    }
    const crowns = [[10, 16, 7], [22, 15, 7.5], [16, 9, 7]];
    for (const [cx, cy, r] of crowns) {
      const pts = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; const rr = r * (1 + 0.14 * Math.sin(a * 5 + v + cx)); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85]); }
      x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = 'rgba(243,229,191,0.97)'; x.fill();
      x.lineWidth = 1.4; wob(x, pts, R, 0.3);
      x.lineWidth = 0.9; for (let k = 0; k < 2; k++) { const a = 0.3 + k * 0.7; wob(x, [[cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.4], [cx + Math.cos(a + 0.5) * r * 0.65, cy + Math.sin(a + 0.5) * r * 0.55]], R, 0.15); }
    }
    x.lineWidth = 1.4; wob(x, [[16, 22], [16.3, 28]], R, 0.2);
    return c;
  }
  function taigaSprite(v) {
    const R = rng(9300 + v * 29), c = canvas(14, 26), x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = INK.ink;
    const h = 17 + R() * 4, w = 4 + R();
    const L = [[7, 2], [7 - w * 0.5, 2 + h * 0.4], [7 - w * 0.3, 2 + h * 0.42], [7 - w, 2 + h]], Rr = [[7, 2], [7 + w * 0.5, 2 + h * 0.4], [7 + w * 0.3, 2 + h * 0.42], [7 + w, 2 + h]];
    x.beginPath(); L.concat(Rr.slice().reverse()).forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = 'rgba(243,229,191,0.96)'; x.fill();
    x.lineWidth = 1.7; wob(x, L, R, 0.2); wob(x, Rr, R, 0.2); wob(x, [[7 - w, 2 + h], [7 + w, 2 + h]], R, 0.2);
    x.lineWidth = 1.3; wob(x, [[7, 2 + h], [7, 2 + h + 3.5]], R, 0.1);
    return c;
  }
  function iceSprite(v) {
    // ice: pale blue hatching, or a crevasse line with short ticks
    const R = rng(9900 + v * 71), c = canvas(40, 18), x = c.getContext('2d');
    x.lineCap = 'round'; x.strokeStyle = INK.blue;
    if (v % 2 === 0) { x.lineWidth = 1.3; for (let k = 0; k < 5; k++) wob(x, [[4 + k * 7, 15], [10 + k * 7, 3]], R, 0.3); }
    else { x.lineWidth = 1.4; const P = [[3, 9], [9, 7], [15, 10], [21, 7], [28, 10], [36, 8]]; wob(x, P, R, 0.5); x.lineWidth = 1.0; for (const [px, py] of P.slice(1, -1)) wob(x, [[px, py], [px + 1, py + (py < 9 ? -5 : 5)]], R, 0.2); }
    return c;
  }
  function settleSprite(kind) {
    const c = canvas(28, 28), x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = INK.ink; x.fillStyle = INK.ink;
    const P = 'rgba(243,229,191,1)';
    if (kind === 'capital' || kind === 'city') {
      x.fillStyle = P; x.beginPath(); x.arc(14, 14, 8.5, 0, 7); x.fill();
      x.lineWidth = 2; x.beginPath(); x.arc(14, 14, 8.5, 0, 7); x.stroke();
      x.fillStyle = INK.red; x.beginPath(); x.arc(14, 14, 4.2, 0, 7); x.fill();
      if (kind === 'capital') { x.lineWidth = 1.2; x.beginPath(); x.arc(14, 14, 11.8, 0, 7); x.stroke(); }
    } else if (kind === 'town') {
      x.fillStyle = P; x.fillRect(6, 13, 9, 8); x.fillRect(14, 10, 8, 11);
      x.lineWidth = 1.6; x.strokeRect(6, 13, 9, 8); x.strokeRect(14, 10, 8, 11);
      x.fillStyle = INK.ink; x.beginPath(); x.moveTo(5, 13.5); x.lineTo(10.5, 8); x.lineTo(16, 13.5); x.fill();
      x.beginPath(); x.moveTo(13, 10.5); x.lineTo(18, 4); x.lineTo(23, 10.5); x.fill();
    } else if (kind === 'village') {
      x.fillStyle = P; x.fillRect(9, 13, 10, 8); x.lineWidth = 1.5; x.strokeRect(9, 13, 10, 8);
      x.fillStyle = INK.ink; x.beginPath(); x.moveTo(8, 13.5); x.lineTo(14, 7); x.lineTo(20, 13.5); x.fill();
    } else if (kind === 'hamlet') {
      x.fillStyle = P; x.beginPath(); x.arc(14, 15, 3.4, 0, 7); x.fill(); x.lineWidth = 1.5; x.stroke();
    } else if (kind === 'peak') {
      x.fillStyle = INK.ink; x.beginPath(); x.moveTo(14, 7); x.lineTo(20.5, 19); x.lineTo(7.5, 19); x.closePath(); x.fill();
    }
    return c;
  }
  function paperTexture() {
    const N = 512, c = canvas(N, N), x = c.getContext('2d');
    const img = x.createImageData(N, N), d = img.data, R = rng(424242);
    const grids = [[8, 10], [16, 6], [32, 4], [64, 2.4], [128, 1.6]];
    const layers = grids.map(([g, amp]) => { const a = new Float32Array(g * g); for (let i = 0; i < a.length; i++) a[i] = R() * 2 - 1; return { g, amp, a }; });
    const base = [243, 229, 191];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let v = 0;
      for (const L of layers) {
        const fx = i / N * L.g, fy = j / N * L.g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), g = L.g;
        const a = L.a[(y0 % g) * g + (x0 % g)], b = L.a[(y0 % g) * g + ((x0 + 1) % g)], cc = L.a[((y0 + 1) % g) * g + (x0 % g)], dd = L.a[((y0 + 1) % g) * g + ((x0 + 1) % g)];
        v += ((a * (1 - sx) + b * sx) * (1 - sy) + (cc * (1 - sx) + dd * sx) * sy) * L.amp;
      }
      v += (R() - 0.5) * 3.2;
      const k = (j * N + i) * 4;
      d[k] = base[0] + v * 0.55; d[k + 1] = base[1] + v * 0.65; d[k + 2] = base[2] + v * 0.9; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // fibres
    x.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const px = R() * N, py = R() * N, a = R() * Math.PI, l = 3 + R() * 9;
      x.strokeStyle = R() < 0.5 ? 'rgba(150,120,70,0.07)' : 'rgba(255,250,235,0.12)'; x.lineWidth = 0.8;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.cos(a) * l, py + oy + Math.sin(a) * l); x.stroke(); }
    }
    return c;
  }
  function addSprites(map) {
    const add = (name, c, pr) => { if (!map.hasImage(name)) map.addImage(name, toImage(c), { pixelRatio: pr || 2 }); };
    for (let v = 0; v < 8; v++) add('m' + v, trim(mountainSprite(v)));
    for (let v = 0; v < 8; v++) add('h' + v, trim(hillSprite(v)));
    for (let v = 0; v < 4; v++) { add('t' + v, trim(treeSprite(v, false))); add('c' + v, trim(treeSprite(v, true))); }
    for (let v = 0; v < 3; v++) { add('w' + v, trim(tuftSprite(v, true))); add('g' + v, trim(tuftSprite(v, false))); }
    for (let v = 0; v < 4; v++) { add('b1-' + v, trim(duneSprite(v))); add('b2-' + v, trim(grassSprite(v))); add('b3-' + v, trim(rainSprite(v))); add('b4-' + v, trim(taigaSprite(v))); add('b5-' + v, trim(iceSprite(v))); add('b6-' + v, trim(tuftSprite(v % 3, true))); add('b7-' + v, trim(tuftSprite(v % 3, false))); }
    for (const k of ['capital', 'city', 'town', 'village', 'hamlet', 'peak']) add('s-' + k, settleSprite(k));
    add('paper', paperTexture(), 2);
  }

  // ------------------------------------------------------------------ expressions
  const ZS = []; for (let z = 0; z <= 18; z++) ZS.push(z);
  const R_ = ['get', 'r'];
  // integer-zoom stops of an expression built from the zoom value
  function byZoom(fn) { const e = ['interpolate', ['linear'], ['zoom']]; for (const z of ZS) e.push(z, fn(z)); return e; }
  const clamp01 = e => ['max', 0, ['min', 1, e]];
  // glyph of rank r: fades in over the zoom before its home zoom
  const fadeRank = (extra) => byZoom(z => ['*', extra ? extra(z) : 1, clamp01(['-', z + 1, R_])]);
  const growRank = (base, k, cap, prop) => byZoom(z => ['*', base, prop ? ['get', prop] : 1, ['min', cap, ['^', 2, ['*', k, ['-', z, R_]]]]]);
  // opacity ramp: 0 at a, 1 at b, 1 at c, 0 at d
  function ramp(a, b, c, d) {
    const s = ['interpolate', ['linear'], ['zoom']];
    if (a !== null) s.push(a, 0, b, 1); else s.push(0, 1);
    if (c !== null) s.push(c, 1, d, 0);
    return s;
  }
  const iz = (...pairs) => { const e = ['interpolate', ['linear'], ['zoom']]; for (let i = 0; i < pairs.length; i += 2) e.push(pairs[i], pairs[i + 1]); return e; };
  // a per-feature fade-in from a "z" property: 0 at z-0.7, 1 at z+0.3 (sampled at integer zooms)
  const fadeProp = (prop, hi) => byZoom(z => ['*', clamp01(['-', z + 0.7, ['get', prop]]), hi === undefined ? 1 : (typeof hi === 'function' ? hi(z) : hi)]);
  const NAME_LOCAL = ['coalesce', ['get', 'name:latin'], ['get', 'name_int'], ['get', 'name']];
  const NAME_EN = ['coalesce', ['get', 'name_en'], ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
  const HALO = 'rgba(243,229,191,0.92)';

  // ------------------------------------------------------------------ style
  function buildStyle(o) {
    const base = o.base;
    const water = (extra) => Object.assign({ source: 'ofm', 'source-layer': 'water' }, extra);
    const OCEAN = ['==', ['get', 'class'], 'ocean'];
    const LAKE = ['in', ['get', 'class'], ['literal', ['lake', 'pond', 'river']]];
    const layers = [];
    const L = (l, group) => { l.metadata = { group: group || 'ink' }; layers.push(l); };

    L({ id: 'paper', type: 'background', paint: { 'background-pattern': 'paper' } }, 'paper');
    L({ id: 'm-bg', type: 'background', layout: { visibility: 'none' }, paint: { 'background-color': '#F2EFE9' } }, 'modern');
    // ---- sea shading
    L(water({ id: 'sea-tint', type: 'fill', paint: { 'fill-color': INK.wash, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, ['case', OCEAN, 0.07, 0.10], 6, ['case', OCEAN, 0.05, 0.10], 12, ['case', OCEAN, 0.04, 0.10]], 'fill-antialias': false } }), 'sea');
    [[2.2, 4, 0.055], [4.4, 4, 0.035], [6.4, 3, 0.022]].forEach(([off, w, op], i) => {
      L(water({ id: 'sea-wash-' + i, type: 'line', filter: OCEAN, paint: { 'line-color': INK.wash, 'line-width': w, 'line-offset': off, 'line-blur': w * 0.8, 'line-opacity': iz(0, op * 1.2, 6, op, 12, op * 0.8) } }), 'sea');
    });
    // ripples: thin offset lines along the coast (the first in black ink, the rest blue); more appear as you zoom
    const rip = [[1.7, INK.ink, 0.55, null], [3.3, INK.blue, 0.5, null], [4.9, INK.blue, 0.42, [3, 4.5]], [6.4, INK.blueSoft, 0.48, [5, 6.5]], [7.7, INK.blueSoft, 0.4, [7, 8.5]]];
    rip.forEach(([off, col, op, zr], i) => {
      L(water({ id: 'ripple-' + i, type: 'line', filter: i < 2 ? ['any', OCEAN, ['>=', ['zoom'], 8]] : OCEAN, minzoom: zr ? zr[0] : 0,
        paint: { 'line-color': col, 'line-offset': iz(0, off * 0.6, 3, off * 0.7, 6, off, 12, off), 'line-width': iz(0, 0.45, 6, 0.7, 12, 0.9 - i * 0.08),
          'line-opacity': zr ? iz(zr[0], 0, zr[1], op) : op } }), 'sea');
    });
    // ---- land cover hints
    L({ id: 'ice', type: 'fill', source: 'ofm', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'ice'], paint: { 'fill-color': '#FBF6E6', 'fill-opacity': 0.75 } }, 'ink');
    L({ id: 'ice-edge', type: 'line', source: 'ofm', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'ice'], paint: { 'line-color': INK.blue, 'line-width': 0.6, 'line-dasharray': [2, 2], 'line-opacity': 0.6 } }, 'ink');
    L({ id: 'sand', type: 'fill', source: 'ofm', 'source-layer': 'landcover', minzoom: 9, filter: ['==', ['get', 'class'], 'sand'], paint: { 'fill-color': INK.paperDeep, 'fill-opacity': iz(9, 0, 10, 0.5) } }, 'ink');
    L({ id: 'hillshade', type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: { 'hillshade-shadow-color': '#4A3420', 'hillshade-highlight-color': '#FFF6DC', 'hillshade-accent-color': '#4A3420', 'hillshade-exaggeration': iz(3, 0.25, 10, 0.35, 14, 0.5), 'hillshade-illumination-direction': 315 } }, 'hillshade');
    // ---- modern plain map (hidden unless toggled)
    L(water({ id: 'm-water', type: 'fill', layout: { visibility: 'none' }, paint: { 'fill-color': '#AAD3DF' } }), 'modern');
    L({ id: 'm-wood', type: 'fill', source: 'ofm', 'source-layer': 'landcover', layout: { visibility: 'none' }, filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': '#ADD19E', 'fill-opacity': 0.7 } }, 'modern');
    L({ id: 'm-urban', type: 'fill', source: 'ofm', 'source-layer': 'landuse', layout: { visibility: 'none' }, filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial']]], paint: { 'fill-color': '#E0DFDF', 'fill-opacity': 0.8 } }, 'modern');
    // ---- lakes and rivers
    L(water({ id: 'lake-edge', type: 'line', filter: ['!', OCEAN], minzoom: 5, paint: { 'line-color': INK.ink, 'line-width': iz(5, 0.4, 9, 0.8, 13, 1.1), 'line-opacity': iz(5, 0, 6, 0.85) } }), 'ink');
    L({ id: 'rivers', type: 'line', source: 'ofm', 'source-layer': 'waterway', filter: ['!=', ['get', 'intermittent'], 1],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': INK.blue,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'class'], 'river', 0.6, 0.2], 7, ['match', ['get', 'class'], 'river', 1.1, 'canal', 0.5, 0.3], 10, ['match', ['get', 'class'], 'river', 1.6, 'canal', 0.9, 'stream', 0.6, 0.4], 14, ['match', ['get', 'class'], 'river', 2.4, 'canal', 1.4, 'stream', 1.0, 0.6]],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'class'], 'river', 0.8, 0], 9, ['match', ['get', 'class'], 'river', 0.95, 'canal', 0.6, 0], 11, ['match', ['get', 'class'], 'river', 1, 'canal', 0.8, 'stream', 0.75, 0.3]] } }, 'rivers');
    // ---- coast
    L(water({ id: 'coast', type: 'line', filter: OCEAN, layout: { 'line-join': 'round' }, paint: { 'line-color': INK.ink, 'line-width': iz(0, 0.7, 4, 1.0, 8, 1.4, 12, 1.7), 'line-blur': 0.2 } }), 'coast');
    // ---- boundaries
    L({ id: 'border-2', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round' }, paint: { 'line-color': INK.ink, 'line-width': iz(1, 0.5, 5, 0.9, 10, 1.4), 'line-opacity': iz(1, 0.5, 5, 0.65), 'line-dasharray': [5, 2, 1, 2] } }, 'borders');
    L({ id: 'border-4', type: 'line', source: 'ofm', 'source-layer': 'boundary', minzoom: 4, filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': INK.ink, 'line-width': iz(4, 0.4, 9, 0.8), 'line-opacity': iz(4, 0, 5, 0.45), 'line-dasharray': [1, 2.4] } }, 'borders');
    // ---- roads, faint dotted
    const RC = ['get', 'class'];
    L({ id: 'roads', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 6,
      filter: ['in', RC, ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'track', 'path']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#6B4E2E', 'line-dasharray': [0.1, 2.6],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, ['match', RC, ['motorway', 'trunk'], 1.3, 0.9], 12, ['match', RC, ['motorway', 'trunk', 'primary'], 2.2, ['secondary', 'tertiary'], 1.8, 1.4]],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 7, ['match', RC, 'motorway', 0.32, 0], 9, ['match', RC, ['motorway', 'trunk'], 0.38, 'primary', 0.2, 0], 10.5, ['match', RC, ['motorway', 'trunk', 'primary'], 0.45, 'secondary', 0.32, 0], 12, ['match', RC, ['motorway', 'trunk', 'primary', 'secondary'], 0.5, 'tertiary', 0.42, 'minor', 0.3, 0], 13, ['match', RC, ['track', 'path'], 0.28, 0.5]] } }, 'roads');
    L({ id: 'm-roads', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 5, layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      filter: ['in', RC, ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]],
      paint: { 'line-color': ['match', RC, 'motorway', '#E892A2', 'trunk', '#F9B29C', 'primary', '#FCD6A4', '#FFFFFF'], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 12, ['match', RC, ['motorway', 'trunk'], 4, 'primary', 3, 1.6]] } }, 'modern');
    L({ id: 'm-border', type: 'line', source: 'ofm', 'source-layer': 'boundary', layout: { visibility: 'none' }, filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': '#9E8FA8', 'line-width': ['match', ['get', 'admin_level'], 2, 1.2, 0.6] } }, 'modern');

    // ---- glyphs (cooperative: they overlap each other but give way to every name)
    const glyphLayout = (img, size, extra) => Object.assign({ 'icon-image': img, 'icon-size': size, 'icon-overlap': 'cooperative', 'icon-ignore-placement': false, 'symbol-z-order': 'viewport-y', 'icon-anchor': 'bottom', 'icon-padding': 0 }, extra || {});
    // biome glyphs (RESOLVE Ecoregions 2017 with OpenStreetMap ice and sand): grow and multiply with zoom like the peaks;
    // rainforest and taiga crowns fade out at zoom 7, where OpenStreetMap's own woods take over
    const BB = ['get', 'b'];
    L({ id: 'biome', type: 'symbol', source: 'ink', 'source-layer': 'biome',
      layout: glyphLayout(['concat', 'b', ['to-string', BB], '-', ['to-string', ['get', 'v']]],
        byZoom(z => ['*', ['match', BB, 1, 0.82, 2, 1.0, 3, 0.74, 4, 1.0, 5, 0.85, 0.6], z < 3 ? 0.85 : 1, ['min', 1.35, ['^', 2, ['*', 0.35, ['-', z, R_]]]]])),
      paint: { 'icon-opacity': byZoom(z => ['*', clamp01(['-', z + 1, R_]),
        ['match', BB, 3, z < 6 ? 1 : z >= 7 ? 0 : 7 - z, 4, z < 6 ? 1 : z >= 7 ? 0 : 7 - z, 5, 0.9, 7, 0.75, 2, 0.85, 0.95]]) } }, 'biomes');
    L({ id: 'tufts', type: 'symbol', source: 'ink', 'source-layer': 'tufts', minzoom: 9,
      layout: glyphLayout(['concat', ['match', ['get', 'w'], 1, 'w', 'g'], ['to-string', ['get', 'v']]], growRank(0.75, 0.3, 1.1)),
      paint: { 'icon-opacity': fadeRank(z => (z <= 9 ? 0 : z >= 10 ? 0.75 : 0.75 * (z - 9))) } }, 'forests');
    L({ id: 'trees', type: 'symbol', source: 'ink', 'source-layer': 'trees', minzoom: 7,
      layout: glyphLayout(['concat', ['match', ['get', 'c'], 1, 'c', 't'], ['to-string', ['get', 'v']]], growRank(0.82, 0.3, 1.2)),
      paint: { 'icon-opacity': fadeRank(z => (z <= 7 ? 0 : z >= 8 ? 1 : (z - 7))) } }, 'forests');
    L({ id: 'relief', type: 'symbol', source: 'ink', 'source-layer': 'relief',
      layout: glyphLayout(['concat', ['match', ['get', 'k'], 0, 'm', 'h'], ['to-string', ['get', 'v']]],
        byZoom(z => ['*', ['match', ['get', 'k'], 0, 0.54, 0.52], ['get', 's'], z < 3 ? 0.8 : z < 5 ? 0.9 : z <= 7 ? 1 : z <= 11 ? 1 + (z - 7) * 0.075 : Math.min(1.6, 1.3 + (z - 11) * 0.1), ['min', z <= 11 ? 1.45 : Math.min(1.75, 1.45 + (z - 11) * 0.1), ['^', 2, ['*', 0.42, ['-', z, R_]]]]])),
      paint: { 'icon-opacity': fadeRank() } }, 'mountains');

    // ---- names (placed before glyphs, never overlapping one another)
    const TXT = (extra) => Object.assign({ 'text-overlap': 'never', 'text-optional': false, 'text-padding': 2, 'text-letter-spacing': 0.05 }, extra);
    const placeLayer = (id, filter, opts) => L({ id, type: 'symbol', source: 'ofm', 'source-layer': 'place', filter, minzoom: opts.minzoom || 0, maxzoom: opts.maxzoom || 24,
      layout: TXT(Object.assign({ 'text-field': opts.field || NAME_LOCAL, 'text-font': [opts.font || 'Ink Roman'], 'text-size': opts.size, 'icon-image': opts.icon || '', 'icon-size': opts.iconSize || 0.5,
        'text-variable-anchor': opts.icon ? ['left', 'right', 'top', 'bottom'] : ['center'], 'text-radial-offset': opts.icon ? 0.75 : 0, 'text-justify': 'auto', 'text-max-width': 9,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 30], 'icon-overlap': 'never', 'icon-optional': false, 'text-letter-spacing': opts.ls || 0.04, 'text-transform': opts.transform || 'none' })),
      paint: { 'text-color': opts.color || INK.red, 'text-halo-color': HALO, 'text-halo-width': 1.4, 'text-halo-blur': 0.5, 'text-opacity': opts.opacity, 'icon-opacity': opts.opacity } }, opts.group || 'names');
    const CL = ['get', 'class'];

    // countries and nations, lettered along curves. MapLibre checks whether a curved name fits using its size at
    // zoom 18, so each size ramp drops to a small value just past the zooms where the layer is shown; the label
    // lines themselves are cut to fit the real size (code/02_labels.py).
    L({ id: 'countries', type: 'symbol', source: 'labels', maxzoom: 10.5,
      filter: ['all', ['in', ['get', 'kind'], ['literal', ['country', 'nation']]], ['==', ['get', 'zb'], ['zoom']]],
      layout: TXT({ 'text-field': ['get', 'name'], 'text-font': ['Ink Caps'], 'symbol-placement': 'line-center', 'text-max-angle': 28, 'text-keep-upright': true,
        'text-size': iz(1, 9.5, 2, 11, 3, 13.5, 4, 16, 5, 18, 7, 25, 9, 32, 10.6, 32, 11, 6),
        'text-letter-spacing': iz(1, 0.16, 3, 0.26, 5, 0.36, 8, 0.48), 'symbol-sort-key': ['get', 'lr'], 'text-padding': 2 }),
      paint: { 'text-color': INK.red, 'text-halo-color': HALO, 'text-halo-width': 1.6, 'text-halo-blur': 0.6,
        'text-opacity': byZoom(z => ['*', clamp01(['+', 0.62, ['*', 0.6, ['-', z, ['get', 'zf']]]]),
          1, z >= 10 ? 0 : z >= 9 ? 0.6 : 1]) } }, 'names');
    // hand-placed upland, lowland and sea names around Britain and Ireland
    const OCN = ['==', ['get', 'kind'], 'ocean'];
    L({ id: 'regions-sea', type: 'symbol', source: 'regions', maxzoom: 12, filter: ['all', ['in', ['get', 'kind'], ['literal', ['sea', 'ocean']]], ['==', ['get', 'zb'], ['zoom']], ['>=', ['zoom'], ['floor', ['get', 'zf']]]],
      layout: TXT({ 'text-field': ['get', 'name'], 'text-font': ['Ink Italic'], 'symbol-placement': 'line-center', 'text-max-angle': 30,
        // seas and oceans (oceans larger); code/02_labels.py SIZES mirrors these stops
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, ['case', OCN, 12.5, 11], 3, ['case', OCN, 16, 11], 5, ['case', OCN, 20, 14], 7, ['case', OCN, 23, 17],
          9, ['case', OCN, 23, 20], 11, ['case', OCN, 23, 22], 12.1, ['case', OCN, 23, 22], 12.5, 6],
        'text-letter-spacing': ['interpolate', ['linear'], ['zoom'], 1, ['case', OCN, 0.32, 0.3], 3, ['case', OCN, 0.427, 0.3], 4, ['case', OCN, 0.48, 0.35],
          6, ['case', OCN, 0.54, 0.45], 7, ['case', OCN, 0.6, 0.5], 9, 0.6] }),
      paint: { 'text-color': INK.red, 'text-halo-color': HALO, 'text-halo-width': 1.4, 'text-opacity': byZoom(z => ['*', clamp01(['+', 0.62, ['*', 0.6, ['-', z, ['get', 'zf']]]]), z >= 11 ? 0.5 : 1]) } }, 'names');
    L({ id: 'regions-land', type: 'symbol', source: 'regions', maxzoom: 12.5, filter: ['all', ['==', ['get', 'uk'], 1], ['in', ['get', 'kind'], ['literal', ['up', 'low']]], ['==', ['get', 'zb'], ['zoom']], ['>=', ['zoom'], ['floor', ['get', 'zf']]]],
      layout: TXT({ 'text-field': ['get', 'name'], 'text-font': ['Ink Caps'], 'symbol-placement': 'line-center', 'text-max-angle': 30,
        'text-size': iz(5, 10.5, 7, 14, 9, 18, 11, 21, 12.6, 21, 13, 6), 'text-letter-spacing': iz(5, 0.25, 8, 0.4, 11, 0.5) }),
      paint: { 'text-color': INK.red, 'text-halo-color': HALO, 'text-halo-width': 1.5, 'text-opacity': byZoom(z => ['*', clamp01(['+', 0.62, ['*', 0.6, ['-', z, ['get', 'zf']]]]), z >= 12 ? 0 : z >= 11 ? 0.7 : 1]) } }, 'names');
    // ranges, deserts and regions beyond Britain and Ireland: lettered before cities, as on a hand-drawn map
    L({ id: 'regions-world', type: 'symbol', source: 'regions', maxzoom: 12.5, filter: ['all', ['!=', ['get', 'uk'], 1], ['in', ['get', 'kind'], ['literal', ['up', 'low']]], ['==', ['get', 'zb'], ['zoom']], ['>=', ['zoom'], ['floor', ['get', 'zf']]]],
      layout: TXT({ 'text-field': ['get', 'name'], 'text-font': ['Ink Caps'], 'symbol-placement': 'line-center', 'text-max-angle': 30,
        'text-size': iz(2, 11, 4, 13, 6, 16, 9, 19, 11, 21, 12.6, 21, 13, 6), 'text-letter-spacing': iz(2, 0.22, 5, 0.3, 8, 0.4, 11, 0.5) }),
      paint: { 'text-color': INK.red, 'text-halo-color': HALO, 'text-halo-width': 1.5, 'text-opacity': byZoom(z => ['*', clamp01(['+', 0.62, ['*', 0.6, ['-', z, ['get', 'zf']]]]), z >= 12 ? 0 : z >= 11 ? 0.7 : 1]) } }, 'names');
    // seas and bays from OpenStreetMap
    // OpenStreetMap's own sea labels give way to the hand lettering from the zoom where it fits (js/curated.js)
    const CUR = global.INK_CURATED || {};
    const curGroups = {};
    for (const [n, zf] of Object.entries(CUR)) (curGroups[zf] = curGroups[zf] || []).push(n);
    const notCurated = ['match', ['coalesce', ['get', 'name_en'], ['get', 'name']]];
    for (const [zf, names] of Object.entries(curGroups)) notCurated.push(names, ['<', ['zoom'], +zf]);
    notCurated.push(true);
    L({ id: 'seas', type: 'symbol', source: 'ofm', 'source-layer': 'water_name',
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'class'], ['literal', ['ocean', 'sea', 'bay', 'strait']]], notCurated,
        ['any', ['==', ['get', 'class'], 'ocean'], ['==', ['get', 'class'], 'sea'], ['all', ['==', ['get', 'class'], 'bay'], ['>=', ['zoom'], 7]], ['>=', ['zoom'], 11]]],
      layout: TXT({ 'text-field': ['let', 'n', NAME_EN, ['case', ['in', ' / ', ['var', 'n']], ['slice', ['var', 'n'], 0, ['index-of', ' / ', ['var', 'n']]], ['var', 'n']]],
        'text-font': ['Ink Italic'], 'text-transform': 'uppercase', 'text-max-width': 7,
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'class'], 'ocean', 12, 9], 4, ['match', ['get', 'class'], 'ocean', 16, 'sea', 13, 11], 8, ['match', ['get', 'class'], 'ocean', 20, 'sea', 17, 13], 12, 15],
        'text-letter-spacing': iz(1, 0.25, 5, 0.4, 9, 0.5) }),
      paint: { 'text-color': INK.red, 'text-halo-color': HALO, 'text-halo-width': 1.3,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 4.5, ['case', ['==', ['get', 'class'], 'ocean'], 1, 1], 6, ['case', ['==', ['get', 'class'], 'ocean'], 0.0, 1]] } }, 'names');
    // states and provinces (not the UK nations, which are lettered above)
    placeLayer('states', ['all', ['in', CL, ['literal', ['state', 'province']]], ['!', ['in', NAME_EN, ['literal', ['England', 'Scotland', 'Wales', 'Northern Ireland']]]], ['<=', ['coalesce', ['get', 'rank'], 9], 5]],
      { minzoom: 4.6, maxzoom: 8.5, font: 'Ink Caps', field: NAME_EN, transform: 'uppercase', ls: 0.25, size: iz(4.6, 9.5, 6, 11, 8, 13), opacity: ramp(4.6, 5.6, 7.6, 8.4) });
    // which cities are lettered is set by filter, not by opacity, so unlettered cities never push glyphs aside
    placeLayer('cities', ['all', ['==', CL, 'city'], ['<=', ['coalesce', ['get', 'rank'], 9], ['step', ['zoom'], 0, 3, 3, 4, 5, 5, 7, 6, 99]]], {
      minzoom: 3,
      font: 'Ink SC', field: NAME_EN, size: ['interpolate', ['linear'], ['zoom'], 3, ['case', ['<=', ['coalesce', ['get', 'rank'], 9], 2], 11, 9.5], 7, ['case', ['<=', ['coalesce', ['get', 'rank'], 9], 4], 16, 13.5], 11, 18],
      icon: ['case', ['==', ['get', 'capital'], 2], 's-capital', 's-city'], iconSize: iz(3, 0.38, 7, 0.55, 11, 0.65),
      opacity: ramp(3, 3.6, null, null) });
    placeLayer('towns', ['==', CL, 'town'], { minzoom: 6.5, size: iz(7, 11.5, 10, 14, 13, 16), icon: 's-town', iconSize: iz(7, 0.42, 11, 0.6), opacity: ramp(6.5, 7.6, null, null) });
    placeLayer('villages', ['==', CL, 'village'], { minzoom: 9.5, size: iz(10, 11, 13, 14), icon: 's-village', iconSize: iz(10, 0.42, 13, 0.6), opacity: ramp(9.5, 10.5, null, null) });
    placeLayer('hamlets', ['in', CL, ['literal', ['hamlet', 'suburb', 'neighbourhood', 'isolated_dwelling']]], { minzoom: 11.5, size: iz(12, 10.5, 15, 13), icon: 's-hamlet', iconSize: 0.5, opacity: ramp(11.5, 12.5, null, null), color: INK.redDeep });
    placeLayer('islands', ['all', ['==', CL, 'island'], ['!', ['in', NAME_EN, ['literal', ['Great Britain', 'Ireland', 'Iceland']]]]], { minzoom: 7, font: 'Ink Italic', size: iz(7, 11, 12, 14), opacity: ramp(7, 8, null, null) });
    // peaks with names, and their heights
    L({ id: 'peaks', type: 'symbol', source: 'ofm', 'source-layer': 'mountain_peak', minzoom: 8.8,
      filter: ['all', ['in', ['get', 'class'], ['literal', ['peak', 'volcano']]], ['has', 'name'], ['<=', ['coalesce', ['get', 'rank'], 9], ['step', ['zoom'], 1, 10, 2, 11, 4, 12, 9]]],
      layout: TXT({ 'text-field': ['format', NAME_LOCAL, {}, ['case', ['has', 'ele'], ['concat', '\n', ['to-string', ['get', 'ele']], ' m'], ''], { 'font-scale': 0.78, 'text-font': ['literal', ['Ink Italic']] }],
        'text-font': ['Ink Roman'], 'text-size': iz(8, 10.5, 12, 13), 'icon-image': 's-peak', 'icon-size': iz(8, 0.38, 12, 0.5), 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.55, 'text-justify': 'auto',
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 9], 'icon-overlap': 'never' }),
      paint: { 'text-color': INK.ink, 'text-halo-color': HALO, 'text-halo-width': 1.4, 'text-opacity': ramp(8.8, 9.4, null, null), 'icon-opacity': ramp(8.8, 9.4, null, null) } }, 'names');
    // national parks
    L({ id: 'parks', type: 'symbol', source: 'ofm', 'source-layer': 'park', minzoom: 8.5, filter: ['all', ['==', ['get', 'class'], 'national_park'], ['==', ['geometry-type'], 'Point']],
      layout: TXT({ 'text-field': NAME_LOCAL, 'text-font': ['Ink SC'], 'text-size': iz(9, 12, 12, 15), 'text-letter-spacing': 0.12, 'text-max-width': 12 }),
      paint: { 'text-color': INK.redDeep, 'text-halo-color': HALO, 'text-halo-width': 1.4, 'text-opacity': ramp(8.5, 9.5, null, null) } }, 'names');
    // rivers and lakes, in blue
    L({ id: 'river-names', type: 'symbol', source: 'ofm', 'source-layer': 'waterway', minzoom: 8,
      filter: ['all', ['has', 'name'], ['any', ['==', ['get', 'class'], 'river'], ['>=', ['zoom'], 12]]],
      layout: TXT({ 'text-field': NAME_LOCAL, 'text-font': ['Ink Italic'], 'symbol-placement': 'line', 'symbol-spacing': 420, 'text-max-angle': 25, 'text-size': iz(8, 11, 12, 14), 'text-letter-spacing': 0.12 }),
      paint: { 'text-color': INK.blue, 'text-halo-color': HALO, 'text-halo-width': 1.4, 'text-opacity': ramp(8, 9, null, null) } }, 'rivers');
    for (const [id, geom] of [['lake-names', 'Point'], ['lake-names-l', 'LineString']]) {
      L({ id, type: 'symbol', source: 'ofm', 'source-layer': 'water_name', minzoom: 7,
        filter: ['all', ['==', ['get', 'class'], 'lake'], ['==', ['geometry-type'], geom]],
        layout: TXT({ 'text-field': NAME_LOCAL, 'text-font': ['Ink Italic'], 'text-size': iz(7, 10.5, 12, 14), 'text-max-width': 6, 'text-letter-spacing': 0.06,
          'symbol-placement': geom === 'Point' ? 'point' : 'line-center', 'text-max-angle': 35 }),
        paint: { 'text-color': INK.blue, 'text-halo-color': HALO, 'text-halo-width': 1.4, 'text-opacity': ramp(7, 8, null, null) } }, 'rivers');
    }

    // placement priority is top-down: reorder so names come in a sensible order (most important on top)
    const order = ['countries', 'regions-sea', 'regions-world', 'seas', 'cities', 'regions-land', 'states', 'towns', 'peaks', 'parks', 'lake-names', 'lake-names-l', 'islands', 'villages', 'river-names', 'hamlets'];
    const named = order.map(id => layers.find(l => l.id === id));
    const rest = layers.filter(l => !order.includes(l.id));
    const final = rest.concat(named.reverse());
    // optional text scale (used by the poster): point names by textScale, curved names by curvedScale
    const scaleOut = (e, k) => typeof e === 'number' ? Math.round(e * k * 10) / 10
      : (Array.isArray(e) && e[0] === 'interpolate') ? e.map((v, i) => (i >= 4 && i % 2 === 0) ? scaleOut(v, k) : v)
      : (Array.isArray(e) && e[0] === 'case') ? e.map((v, i) => (i > 1 && (i % 2 === 0 || i === e.length - 1)) ? scaleOut(v, k) : v)
      : (Array.isArray(e) && e[0] === 'match') ? e.map((v, i) => (i >= 3 && (i % 2 === 1 || i === e.length - 1)) ? scaleOut(v, k) : v) : e;
    if (o.textScale || o.curvedScale) for (const l of final) {
      if (l.type !== 'symbol' || !l.layout['text-size']) continue;
      const curved = ['countries', 'regions-sea', 'regions-land', 'regions-world'].includes(l.id);
      const k = curved ? (o.curvedScale || 1) : (o.textScale || 1);
      if (k !== 1) l.layout['text-size'] = scaleOut(l.layout['text-size'], k);
    }

    return {
      version: 8, name: 'The Inked World',
      glyphs: base + 'fonts/{fontstack}/{range}.pbf',
      sources: {
        ofm: { type: 'vector', url: o.tilejson, attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">© OpenMapTiles</a> Data © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors' },
        ink: { type: 'vector', tiles: ['ink://{z}/{x}/{y}'], minzoom: 0, maxzoom: 14, attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Terrain Tiles</a>; biomes: <a href="https://ecoregions.appspot.com/" target="_blank">RESOLVE Ecoregions 2017</a> (CC BY 4.0)' },
        dem: { type: 'raster-dem', tiles: [o.dem], encoding: 'terrarium', tileSize: 256, maxzoom: 15 },
        labels: { type: 'geojson', buffer: 512, tolerance: 0.2, data: base + 'data/labels_countries.geojson', attribution: 'Lettering lines: Natural Earth, ONS' },
        regions: { type: 'geojson', buffer: 512, tolerance: 0.2, data: base + 'data/labels_regions.geojson' },
      },
      layers: final,
    };
  }

  // ------------------------------------------------------------------ protocol
  let seq = 0; const pending = new Map();
  const STATS = { n: 0, ms: 0, max: 0 }; global.__inkStats = STATS;
  // a small pool of workers; each tile always goes to the same worker (by x) so elevation caches are reused
  let pool = null;
  function setupProtocol(o, ofmTemplate) {
    const cfg = { config: Object.assign({ ofm: ofmTemplate, dem: o.dem, demMax: o.demMax, biomes: o.base + 'data/biomes.png' }, o.workerConfig || {}) };
    if (pool) { pool.forEach(w => w.postMessage(cfg)); return; }
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    pool = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(o.base + 'js/ink-worker.js');
      w.onmessage = (ev) => {
        const m = ev.data, p = pending.get(m.id); if (!p) return; pending.delete(m.id);
        if (m.err) { console.warn('ink tile', m.err); p.res({ data: new ArrayBuffer(0) }); } else { STATS.n++; STATS.ms += m.ms || 0; STATS.max = Math.max(STATS.max, m.ms || 0); p.res({ data: m.buf }); }
      };
      w.postMessage(cfg);
      pool.push(w);
    }
    maplibregl.addProtocol('ink', (params, ac) => new Promise((res, rej) => {
      const mm = params.url.match(/ink:\/\/(\d+)\/(\d+)\/(\d+)/);
      const z = +mm[1], x = +mm[2], y = +mm[3];
      const w = pool[((x >> 1) + (y >> 1)) % pool.length];
      const id = ++seq; pending.set(id, { res, rej });
      w.postMessage({ id, z, x, y });
      ac.signal.addEventListener('abort', () => { w.postMessage({ cancel: id }); if (pending.has(id)) { pending.delete(id); rej(new Error('aborted')); } });
    }));
  }

  async function create(container, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    if (!o.base) o.base = new URL('./', location.href).href;
    let tj = null;
    try { tj = await (await fetch(o.tilejson)).json(); } catch (e) { console.warn('tilejson', e); }
    const ofmTemplate = tj && tj.tiles ? tj.tiles[0] : null;
    setupProtocol(o, ofmTemplate);
    const style = buildStyle(o);
    const map = new maplibregl.Map(Object.assign({
      container, style, center: [-3.2, 54.6], zoom: 5.2, minZoom: 0.6, maxZoom: 16, hash: false,
      attributionControl: { compact: true }, fadeDuration: 250, renderWorldCopies: true, dragRotate: false, pitchWithRotate: false,
      localIdeographFontFamily: "'Noto Serif', 'Songti SC', serif",
    }, o.mapOptions || {}));
    map.touchZoomRotate.disableRotation();
    map.on('styleimagemissing', () => {});
    addSprites(map);
    map.once('styledata', () => addSprites(map));
    map.INK = INK;
    if (!map.isStyleLoaded()) await new Promise(res => map.once('style.load', res));
    return map;
  }

  // layer groups for the panel
  function setGroup(map, group, on) {
    for (const l of map.getStyle().layers) {
      const g = l.metadata && l.metadata.group;
      if (g === group) map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none');
    }
  }
  global.InkMap = { create, setGroup, INK, buildStyle, sprites: { mountainSprite, hillSprite, treeSprite, tuftSprite, settleSprite, paperTexture, duneSprite, grassSprite, rainSprite, taigaSprite, iceSprite } };
})(window);
