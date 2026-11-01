/* Ink map worker: turns elevation and land cover into hand-drawn glyph positions.
 * For each requested tile (z, x, y) it returns a Mapbox Vector Tile with three point layers:
 *   relief  mountains and hills, placed on local high points of Terrarium elevation tiles
 *   trees   tree glyphs scattered inside OpenStreetMap woods and forests (OpenFreeMap landcover)
 *   tufts   marsh and moorland tufts inside wetland and heath
 * Every point carries the rank (r) at which it first appears, so the map can fade new glyphs in
 * smoothly as you zoom: the set at one zoom is always contained in the set at the next.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
'use strict';
let CFG = {
  dem: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', demMax: 15,
  ofm: null, ofmMax: 14,
  C: 14, RS: 99, RMAX: 12, HILL: 0.4, SAT_NB: 6, SAT_HI: 3, SAT_Q: 2.2, G0: 1, GT: [4, 4.5, 5.5, 7.5, 10, 12, 13, 22, 30, 38, 48, 60, 70], GH: 0.45, MONT: 0.3, OPEN: 1.5, CB: 20, biomes: null, demScale: 1, // no new peaks beyond rank RMAX: close in, cells would measure slopes, not summits
  // (RS: optional rank from which a rank reuses the previous rank's cells, to thin close-up glyphs)
      // mountain cell size in screen px at the rank's home zoom (512 px tiles)
  CT: 10,     // tree cell size
  CU: 20,     // tuft cell size
  A: 185,     // mountain relief threshold, metres, scaled by (cell ground size in km)^0.3
};

// ---------------- small utilities ----------------
function hash3(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const DEG = Math.PI / 180;
function latOfY(ny) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * ny))) / DEG; }

// ---------------- elevation tiles ----------------
const demCache = new Map();
function demUrl(z, x, y) { return CFG.dem.replace('{z}', z).replace('{x}', x).replace('{y}', y); }
async function decodePng(blob) {
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const n = bmp.width * bmp.height, e = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) e[i] = d[j] * 256 + d[j + 1] + d[j + 2] / 256 - 32768;
  return e;
}
function getDemRaw(z, x, y) {
  const k = z + '/' + x + '/' + y;
  let p = demCache.get(k);
  if (!p) {
    p = fetch(demUrl(z, x, y)).then(r => r.ok ? r.blob() : null).then(b => b ? decodePng(b) : null).catch(() => null);
    demCache.set(k, p);
    if (demCache.size > 600) demCache.delete(demCache.keys().next().value);
  } else { demCache.delete(k); demCache.set(k, p); }
  return p;
}
// A sampler over one tile at zoom z, falling back to a parent tile (upsampled) when the tile is missing.
async function demSampler(z, x, y) {
  for (let k = 0; k <= Math.min(z, 6); k++) {
    const pz = z - k, px = x >> k, py = y >> k;
    const arr = await getDemRaw(pz, px, py);
    if (!arr) continue;
    if (k === 0) return (i, j) => arr[j * 256 + i];
    const s = 1 << k, ox = (x - (px << k)) * 256, oy = (y - (py << k)) * 256;
    return (i, j) => {
      const fx = (ox + i + 0.5) / s - 0.5, fy = (oy + j + 0.5) / s - 0.5;
      const x0 = Math.max(0, Math.min(255, Math.floor(fx))), y0 = Math.max(0, Math.min(255, Math.floor(fy)));
      const x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1), tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
      const a = arr[y0 * 256 + x0], b = arr[y0 * 256 + x1], c = arr[y1 * 256 + x0], d = arr[y1 * 256 + x1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    };
  }
  return null;
}
// Mosaic of elevations (metres) at zoom d over normalised bounds.
async function mosaic(d, nx0, ny0, nx1, ny1) {
  const S = 256 * Math.pow(2, d), n = 1 << d;
  const px0 = Math.floor(nx0 * S), py0 = Math.floor(ny0 * S), px1 = Math.ceil(nx1 * S), py1 = Math.ceil(ny1 * S);
  const W = px1 - px0, H = py1 - py0, E = new Float32Array(W * H).fill(-500);
  const tx0 = Math.floor(px0 / 256), tx1 = Math.floor((px1 - 1) / 256), ty0 = Math.floor(py0 / 256), ty1 = Math.floor((py1 - 1) / 256);
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (ty < 0 || ty >= n) continue;
    const wx = ((tx % n) + n) % n;
    jobs.push(demSampler(d, wx, ty).then(sm => {
      if (!sm) return;
      const ix0 = Math.max(px0, tx * 256), ix1 = Math.min(px1, tx * 256 + 256), iy0 = Math.max(py0, ty * 256), iy1 = Math.min(py1, ty * 256 + 256);
      for (let py = iy0; py < iy1; py++) {
        const row = (py - py0) * W, j = py - ty * 256;
        for (let px = ix0; px < ix1; px++) E[row + px - px0] = sm(px - tx * 256, j);
      }
    }));
  }
  await Promise.all(jobs);
  return { E, W, H, px0, py0, S };
}

// ---------------- relief glyphs ----------------
const J0cell = (L, jj) => L.j0 + jj;
const biomeAt = (BR, nx, ny) => { if (!BR) return 0; const i = Math.min(BR.n - 1, Math.floor(nx * BR.n)), j = Math.min(BR.n - 1, Math.max(0, Math.floor(ny * BR.n))); return BR.a[j * BR.n + i] >> 1; };
const montaneAt = (BR, nx, ny) => { if (!BR) return false; const i = Math.min(BR.n - 1, Math.floor(nx * BR.n)), j = Math.min(BR.n - 1, Math.max(0, Math.floor(ny * BR.n))); return (BR.a[j * BR.n + i] & 1) === 1; };
async function reliefPoints(z, x, y) {
  const BR = await biomeRaster();
  const n = Math.pow(2, z);
  const tnx0 = x / n, tny0 = y / n, tnx1 = (x + 1) / n, tny1 = (y + 1) / n;
  const rf = Math.min(z + 1, CFG.RMAX), rc = Math.max(0, Math.min(z - 1, rf - 2));
  const cw = r => CFG.C / (512 * Math.pow(2, r - (r >= CFG.RS ? 1 : 0)));
  const m = 2.6 * cw(rc);
  const d = Math.max(0, Math.min(CFG.demMax, z <= 9 ? z + 1 : z));
  const M = await mosaic(d, tnx0 - m, Math.max(0, tny0 - m), tnx1 + m, Math.min(1, tny1 + m));
  // coarse elevation tiles smooth the summits away, so relief is measured low far out: lower the bar to match
  const demFactor = d <= 4 ? 0.5 : d <= 6 ? 0.68 : d <= 8 ? 0.85 : 1;
  const { E, W, H, px0, py0, S } = M;
  const cwf = cw(rf);
  const I0 = Math.floor((px0 + 0.5) / S / cwf), J0 = Math.floor((py0 + 0.5) / S / cwf);
  const I1 = Math.floor((px0 + W - 0.5) / S / cwf), J1 = Math.floor((py0 + H - 0.5) / S / cwf);
  // per-rank arrays
  const R = [];
  for (let r = rc; r <= rf; r++) {
    const k = Math.round(Math.log2(cw(r) / cwf));
    const i0 = I0 >> k, j0 = J0 >> k, i1 = I1 >> k, j1 = J1 >> k;
    const nI = i1 - i0 + 1, nJ = j1 - j0 + 1;
    R.push({ r, k, i0, j0, nI, nJ, mx: new Float32Array(nI * nJ).fill(-1e9), mn: new Float32Array(nI * nJ).fill(1e9), am: new Int32Array(nI * nJ).fill(-1), gs: new Float32Array(nI * nJ), gn: new Uint32Array(nI * nJ) });
  }
  // single pass over pixels
  const inv = 1 / (S * cwf);
  const colI = new Int32Array(W);
  for (let i = 0; i < W; i++) colI[i] = Math.floor((px0 + i + 0.5) * inv);
  for (let j = 0; j < H; j++) {
    const J = Math.floor((py0 + j + 0.5) * inv);
    for (const L of R) {
      const jj = (J >> L.k) - L.j0; L._row = jj * L.nI;
    }
    const row = j * W;
    for (let i = 0; i < W; i++) {
      const e = E[row + i], I = colI[i];
      // ruggedness: absolute elevation change to the next pixel across and down (skipped where there is no data)
      let g = -1;
      if (i < W - 1 && j < H - 1 && e > -400) {
        const ex = E[row + i + 1], ey = E[row + W + i];
        if (ex > -400 && ey > -400) g = Math.abs(ex - e) + Math.abs(ey - e);
      }
      for (let q = 0; q < R.length; q++) {
        const L = R[q], c = L._row + (I >> L.k) - L.i0;
        if (e > L.mx[c]) { L.mx[c] = e; L.am[c] = row + i; }
        if (e < L.mn[c]) L.mn[c] = e;
        if (g >= 0) { L.gs[c] += g; L.gn[c]++; }
      }
    }
  }
  const out = [], seen = new Set();
  for (const L of R) {
    const { nI, nJ, mx, mn, am, r } = L;
    const cell = cw(r), cellPx = cell * S;
    const kmBase = cell * 40075;
    // close in, a cell's highest point on a plain slope sits on its uphill edge, next to a higher neighbour;
    // spacing points further apart there keeps peaks on summits and ridges instead of rows down a hillside
    const kmMid = kmBase * Math.cos(latOfY((py0 + H / 2) / S) * DEG);
    const sep = kmMid >= 1 ? 0.55 : kmMid <= 0.1 ? 1.0 : 0.55 + 0.45 * (1 - (Math.log10(kmMid) + 1));
    const dmin2 = Math.pow(sep * cellPx, 2);
    // pass 1: relative relief and kind of every cell (0 mountain, 1 hill, -1 nothing)
    const N = nI * nJ, kind = new Int8Array(N).fill(-1), rel = new Float32Array(N), qq = new Float32Array(N), rug = new Float32Array(N);
    // ruggedness bars (mean slope, metres per km, measured on the elevation tiles at zoom d): a range must be rugged, not
    // just high, so high flat plateaus, deserts and plains get no peaks however far they rise above a distant lowland
    const Gm = CFG.G0 * CFG.GT[Math.max(0, Math.min(CFG.GT.length - 1, d))], Gh = CFG.GH * Gm;
    for (let jj = 1; jj < nJ - 1; jj++) {
      const latRow = latOfY((J0cell(L, jj) + 0.5) * cell);
      const km = Math.max(0.05, kmBase * Math.cos(latRow * DEG));
      const pxKm = 40075 * Math.cos(latRow * DEG) / S;
      const T = CFG.A * Math.pow(km, 0.3) * demFactor;
      for (let ii = 1; ii < nI - 1; ii++) {
        const c = jj * nI + ii;
        if (am[c] < 0 || mx[c] * CFG.demScale < 3) continue;   // never on ground at or below sea level
        let lo = 1e9;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const v2 = mn[c + dj * nI + di]; if (v2 < lo) lo = v2; }
        const relief = (mx[c] - Math.max(lo, 0)) * CFG.demScale;
        // ruggedness is measured close round the cell's highest point (the finest cells, 3 x 3, about 40 screen
        // pixels), so a small rugged massif counts in full and a plateau is judged on its own floor
        const a0 = am[c], axp = a0 % W, ayp = (a0 - axp) / W, F = R[R.length - 1];
        const fi = colI[axp] - F.i0, fj = Math.floor((py0 + ayp + 0.5) * inv) - F.j0;
        let gsum = 0, gcnt = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii2 = fi + di, jj2 = fj + dj; if (ii2 < 0 || jj2 < 0 || ii2 >= F.nI || jj2 >= F.nJ) continue;
          const cc = jj2 * F.nI + ii2; gsum += F.gs[cc]; gcnt += F.gn[cc];
        }
        const rg = gcnt ? gsum / gcnt / 2 / pxKm * CFG.demScale : 0;
        rel[c] = relief; qq[c] = relief / T; rug[c] = rg;
        // in ecoregions named for mountains (RESOLVE), a narrow range smoothed by coarse elevation tiles still counts
        // and in the great open biomes (desert, steppe, rainforest, taiga, tundra) that are not named for mountains,
        // a dissected plateau has to be a good deal more rugged before it is drawn as a range
        const bAt = biomeAt(BR, (px0 + axp + 0.5) / S, (py0 + ayp + 0.5) / S);
        const mf = montaneAt(BR, (px0 + axp + 0.5) / S, (py0 + ayp + 0.5) / S) ? CFG.MONT : (bAt >= 1 && bAt <= 4) || bAt === 7 ? CFG.OPEN : 1;
        kind[c] = relief >= T && rg >= Gm * mf ? 0 : relief >= CFG.HILL * T && rg >= Gh * Math.sqrt(mf) ? 1 : -1;
        if (kind[c] === 1 && bAt === 5) kind[c] = -1;   // the edge of an ice sheet is not a hill
      }
    }
    // pass 2: place, thinning saturated ground so a great range reads as ridges and summits, not a solid mass
    for (let jj = 1; jj < nJ - 1; jj++) for (let ii = 1; ii < nI - 1; ii++) {
      const c = jj * nI + ii, a = am[c];
      if (kind[c] < 0) continue;
      const v = mx[c];
      const ax = a % W, ay = (a - ax) / W;
      const nx = (px0 + ax + 0.5) / S, ny = (py0 + ay + 0.5) / S;
      if (nx < tnx0 || nx >= tnx1 || ny < tny0 || ny >= tny1) continue;
      if (seen.has(a)) continue;
      let drop = false, mtnNb = 0, higherMtn = 0, qSum = 0;
      for (let dj = -1; dj <= 1 && !drop; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const cc = c + dj * nI + di;
        qSum += qq[cc];
        if (kind[cc] === 0) { mtnNb++; if (mx[cc] > v || (mx[cc] === v && cc < c)) higherMtn++; }
        if (am[cc] >= 0) {
          const bx = am[cc] % W, by = (am[cc] - bx) / W;
          const dd = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
          if (dd < dmin2 && (mx[cc] > v || (mx[cc] === v && cc < c))) { drop = true; break; }
        }
      }
      if (drop) continue;
      // only where the ground is saturated with strong relief (a great range at this scale): there, a mountain
      // with several higher mountains around it is a flank, and leaving it out lets the ridges and summits read
      // far out a cell is tens of kilometres across and each one is its own mountain mass, so this only applies
      // once cells are under about 30 km, and more firmly under 10 km
      const satHi = kmMid < 10 ? CFG.SAT_HI : kmMid < 30 ? CFG.SAT_HI + 1 : 99;
      if (kind[c] === 0 && mtnNb >= CFG.SAT_NB && higherMtn >= satHi && (qSum + qq[c]) / 9 >= CFG.SAT_Q) continue;
      const k = kind[c], q = qq[c];
      const s = k === 0 ? Math.min(1.3, 0.8 + 0.22 * (q - 1)) : Math.min(1.0, 0.72 + 0.45 * (q - 0.42));
      seen.add(a);
      const I = L.i0 + ii, J = L.j0 + jj;
      out.push({ nx, ny, r: Math.max(r, 0), k, s: Math.round(s * 100) / 100, v: Math.floor(hash3(I, J, r + 99) * 8), e: Math.round(v * CFG.demScale), rl: Math.round(rel[c]), rg: Math.round(rug[c] * 10) / 10 });
    }
  }
  return out;
}

// ---------------- vector tile decoding (OpenFreeMap landcover) ----------------
function Reader(buf) { this.b = buf; this.p = 0; }
Reader.prototype.varint = function () {
  let r = 0, s = 0, b;
  do { b = this.b[this.p++]; if (s < 28) r |= (b & 0x7f) << s; else r += (b & 0x7f) * Math.pow(2, s); s += 7; } while (b >= 0x80);
  return r >>> 0 === r ? r : r;
};
Reader.prototype.skip = function (w) {
  if (w === 0) this.varint(); else if (w === 1) this.p += 8; else if (w === 2) { const l = this.varint(); this.p += l; } else if (w === 5) this.p += 4;
};
const td = new TextDecoder();
function decodeLayers(buf, wanted) {
  const R = new Reader(buf), layers = {};
  while (R.p < buf.length) {
    const t = R.varint(), f = t >> 3, w = t & 7;
    if (f === 3 && w === 2) {
      const len = R.varint(), end = R.p + len;
      const L = { name: '', keys: [], values: [], feats: [], extent: 4096 };
      while (R.p < end) {
        const t2 = R.varint(), f2 = t2 >> 3, w2 = t2 & 7;
        if (f2 === 1) { const l = R.varint(); L.name = td.decode(buf.subarray(R.p, R.p + l)); R.p += l; if (!wanted.has(L.name)) { R.p = end; break; } }
        else if (f2 === 2) { const l = R.varint(); L.feats.push([R.p, R.p + l]); R.p += l; }
        else if (f2 === 3) { const l = R.varint(); L.keys.push(td.decode(buf.subarray(R.p, R.p + l))); R.p += l; }
        else if (f2 === 4) {
          const l = R.varint(), e2 = R.p + l; let val = null;
          while (R.p < e2) {
            const t3 = R.varint(), f3 = t3 >> 3;
            if (f3 === 1) { const l3 = R.varint(); val = td.decode(buf.subarray(R.p, R.p + l3)); R.p += l3; }
            else if (f3 === 2) { val = new DataView(buf.buffer, buf.byteOffset + R.p, 4).getFloat32(0, true); R.p += 4; }
            else if (f3 === 3) { val = new DataView(buf.buffer, buf.byteOffset + R.p, 8).getFloat64(0, true); R.p += 8; }
            else { val = R.varint(); }
          }
          L.values.push(val);
        }
        else if (f2 === 5) L.extent = R.varint();
        else R.skip(w2);
      }
      if (L.name && wanted.has(L.name)) layers[L.name] = L;
      R.p = end;
    } else R.skip(w);
  }
  return layers;
}
function featureOf(buf, L, span) {
  const R = new Reader(buf); R.p = span[0];
  const props = {}; let type = 0, geom = null;
  while (R.p < span[1]) {
    const t = R.varint(), f = t >> 3, w = t & 7;
    if (f === 2) { const l = R.varint(), e = R.p + l; while (R.p < e) { const k = R.varint(), v = R.varint(); props[L.keys[k]] = L.values[v]; } }
    else if (f === 3) type = R.varint();
    else if (f === 4) { const l = R.varint(); geom = [R.p, R.p + l]; R.p += l; }
    else R.skip(w);
  }
  return { props, type, geom };
}
function tracePolygon(buf, g, ctx, sc) {
  const R = new Reader(buf); R.p = g[0];
  let x = 0, y = 0;
  while (R.p < g[1]) {
    const ci = R.varint(), cmd = ci & 7, cnt = ci >> 3;
    if (cmd === 7) { ctx.closePath(); continue; }
    for (let i = 0; i < cnt; i++) {
      const dx = R.varint(), dy = R.varint();
      x += (dx >>> 1) ^ -(dx & 1); y += (dy >>> 1) ^ -(dy & 1);
      if (cmd === 1) ctx.moveTo(x * sc, y * sc); else ctx.lineTo(x * sc, y * sc);
    }
  }
}
async function fetchOfm(z, x, y) {
  if (!CFG.ofm) return null;
  try {
    const r = await fetch(CFG.ofm.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    if (!r.ok) return null;
    let b = new Uint8Array(await r.arrayBuffer());
    if (b[0] === 0x1f && b[1] === 0x8b) {
      const ds = new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')));
      b = new Uint8Array(await ds.arrayBuffer());
    }
    return b;
  } catch (e) { return null; }
}
const MS = 256;
// Rasterise one layer's polygons (all, or those passing `keep`) into a MS x MS 0/1 mask.
function polyMask(buf, L, keep) {
  const c = new OffscreenCanvas(MS, MS), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.beginPath();
  let n = 0;
  for (const span of L.feats) {
    const F = featureOf(buf, L, span);
    if (F.type !== 3 || (keep && !keep(F.props))) continue;
    tracePolygon(buf, F.geom, ctx, MS / L.extent); n++;
  }
  if (!n) return null;
  ctx.fill('nonzero');
  const d = ctx.getImageData(0, 0, MS, MS).data, a = new Uint8Array(MS * MS);
  for (let i = 0; i < MS * MS; i++) a[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return a;
}
// Water mask from the OpenStreetMap water layer of the same tile: no glyph is drawn on sea, lake or river.
async function waterMask(z, x, y) {
  const buf = await fetchOfm(z, x, y);
  if (!buf) return null;
  const Ls = decodeLayers(buf, new Set(['water', 'landcover']));
  const out = Ls.water ? (polyMask(buf, Ls.water, null) || { none: true }) : { none: true };
  // glaciers and ice caps, and sand, from OpenStreetMap land cover: blended with the biome mask
  if (Ls.landcover) {
    out.ice = polyMask(buf, Ls.landcover, p => p.class === 'ice');
    out.sand = z >= 8 ? polyMask(buf, Ls.landcover, p => p.class === 'sand') : null;
  }
  return out;
}

// ---------------- biome mask (RESOLVE Ecoregions 2017, data/biomes.png, 32 x class) ----------------
let biomeP = null;
function biomeRaster() {
  if (!biomeP) biomeP = (async () => {
    if (!CFG.biomes) return null;
    try {
      const r = await fetch(CFG.biomes); if (!r.ok) return null;
      const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const c = new OffscreenCanvas(bmp.width, bmp.height), ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data, n = bmp.width, a = new Uint8Array(n * n);
      for (let i = 0; i < n * n; i++) a[i] = Math.round(d[i * 4] / 16);   // 2 x class + montane flag
      return { n, a };
    } catch (e) { return null; }
  })();
  return biomeP;
}
// biome glyph per class: desert dunes, grassland tufts, rainforest crowns, taiga conifers, ice hatching, marsh, tundra tufts;
// keep = share of nested points that carry a glyph
const BIOME = { 1: { keep: 0.55 }, 2: { keep: 0.3 }, 3: { keep: 0.97 }, 4: { keep: 0.72 }, 5: { keep: 0.6 }, 6: { keep: 0.5 }, 7: { keep: 0.16 } };
async function coverMask(z, x, y) {
  const buf = await fetchOfm(z, x, y);
  if (!buf) return null;
  const layers = decodeLayers(buf, new Set(['landcover']));
  const L = layers.landcover;
  if (!L) return null;
  const c = new OffscreenCanvas(MS, MS), ctx = c.getContext('2d', { willReadFrequently: true });
  const sc = MS / L.extent;
  const groups = { forest: [], wood: [], wet: [], heath: [] };
  for (const span of L.feats) {
    const F = featureOf(buf, L, span);
    if (F.type !== 3) continue;
    const cl = F.props.class, sub = F.props.subclass;
    if (cl === 'wood') (sub === 'forest' ? groups.forest : groups.wood).push(F.geom);
    else if (cl === 'wetland') groups.wet.push(F.geom);
    else if (cl === 'grass' && (sub === 'heath' || sub === 'moor' || sub === 'fell')) groups.heath.push(F.geom);
  }
  if (!groups.forest.length && !groups.wood.length && !groups.wet.length && !groups.heath.length) return null;
  // channels: R forest, G wood, B wetland, A heath (drawn as separate passes into separate arrays)
  const out = {};
  for (const k of ['forest', 'wood', 'wet', 'heath']) {
    if (!groups[k].length) { out[k] = null; continue; }
    ctx.clearRect(0, 0, MS, MS); ctx.fillStyle = '#fff'; ctx.beginPath();
    for (const g of groups[k]) tracePolygon(buf, g, ctx, sc);
    ctx.fill('nonzero');
    const d = ctx.getImageData(0, 0, MS, MS).data, a = new Uint8Array(MS * MS);
    for (let i = 0; i < MS * MS; i++) a[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    out[k] = a;
  }
  return out;
}
// Nested jittered points: the point of a cell at rank r is inherited by whichever child cell contains it.
function nestedPoints(z, x, y, CS, rBase, rTop, salt) {
  const n = Math.pow(2, z), tnx0 = x / n, tny0 = y / n, tnx1 = (x + 1) / n, tny1 = (y + 1) / n;
  let prev = null;
  for (let r = rBase; r <= rTop; r++) {
    const cw = CS / (512 * Math.pow(2, r));
    const i0 = Math.floor(tnx0 / cw), i1 = Math.floor((tnx1 - 1e-12) / cw), j0 = Math.floor(tny0 / cw), j1 = Math.floor((tny1 - 1e-12) / cw);
    const cur = new Map();
    for (let J = j0; J <= j1; J++) for (let I = i0; I <= i1; I++) {
      let p = null;
      if (prev) {
        const pp = prev.get((I >> 1) + ',' + (J >> 1));
        if (pp && Math.floor(pp.nx / cw) === I && Math.floor(pp.ny / cw) === J) p = pp;
      }
      if (!p) {
        const hx = hash3(I, J, r * 7 + salt), hy = hash3(J, I, r * 13 + salt + 1);
        p = { nx: (I + 0.12 + 0.76 * hx) * cw, ny: (J + 0.12 + 0.76 * hy) * cw, r, h: hash3(I, J, salt + 777) };
      }
      cur.set(I + ',' + J, p);
    }
    prev = cur;
  }
  const out = [];
  for (const p of prev.values()) if (p.nx >= tnx0 && p.nx < tnx1 && p.ny >= tny0 && p.ny < tny1) out.push(p);
  return out;
}

// ---------------- vector tile encoding ----------------
function Writer() { this.a = []; }
Writer.prototype.varint = function (v) { v = Math.floor(v); while (v > 127) { this.a.push((v & 127) | 128); v = Math.floor(v / 128); } this.a.push(v); };
Writer.prototype.tag = function (f, w) { this.varint((f << 3) | w); };
Writer.prototype.bytes = function (f, arr) { this.tag(f, 2); this.varint(arr.length); for (const b of arr) this.a.push(b); };
Writer.prototype.str = function (f, s) { this.bytes(f, new TextEncoder().encode(s)); };
Writer.prototype.double = function (f, v) { this.tag(f, 1); const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); for (const x of b) this.a.push(x); };
function zz(v) { return (v << 1) ^ (v >> 31); }
function encodeLayer(name, pts, keys, z, x, y) {
  const n = Math.pow(2, z), ext = 4096;
  const L = new Writer();
  L.varint((15 << 3) | 0); L.varint(2);
  L.str(1, name);
  const vals = [], vmap = new Map();
  const vi = v => { let i = vmap.get(v); if (i === undefined) { i = vals.length; vals.push(v); vmap.set(v, i); } return i; };
  for (const p of pts) {
    const F = new Writer();
    const tags = [];
    keys.forEach((k, ki) => { tags.push(ki, vi(p[k])); });
    const T = new Writer(); for (const t of tags) T.varint(t);
    F.bytes(2, T.a);
    F.tag(3, 0); F.varint(1);
    const px = Math.max(0, Math.min(ext - 1, Math.round((p.nx * n - x) * ext))), py = Math.max(0, Math.min(ext - 1, Math.round((p.ny * n - y) * ext)));
    const G = new Writer(); G.varint(9); G.varint(zz(px)); G.varint(zz(py));
    F.bytes(4, G.a);
    L.bytes(2, F.a);
  }
  for (const k of keys) L.str(3, k);
  for (const v of vals) { const V = new Writer(); V.double(3, v); L.bytes(4, V.a); }
  L.tag(5, 0); L.varint(ext);
  return L.a;
}

async function buildTile(z, x, y) {
  const T = new Writer();
  const [relief0, water] = await Promise.all([reliefPoints(z, x, y), z <= CFG.ofmMax && CFG.ofm ? waterMask(z, x, y) : null]);
  const n = Math.pow(2, z);
  const wetAt = (i, j) => water[Math.max(0, Math.min(MS - 1, j)) * MS + Math.max(0, Math.min(MS - 1, i))] === 1;
  const wet = p => { if (!water || water.none) return false; return wetAt(Math.floor((p.nx * n - x) * MS), Math.floor((p.ny * n - y) * MS)); };
  // relief glyphs also keep clear of the water's edge (2 to 4 screen px), so a speck of an island far out
  // does not carry a lone mountain into an empty ocean
  const ER = z <= 4 ? 2 : 1;
  const nearWet = p => {
    if (!water || water.none) return false;
    const i = Math.floor((p.nx * n - x) * MS), j = Math.floor((p.ny * n - y) * MS);
    for (let dj = -ER; dj <= ER; dj++) for (let di = -ER; di <= ER; di++) if (wetAt(i + di, j + dj)) return true;
    return false;
  };
  const relief = relief0.filter(p => !nearWet(p));
  relief.sort((a, b) => a.ny - b.ny);
  // ---- biome glyphs: dunes, grass, rainforest, taiga, ice, marsh, tundra
  const BR = await biomeRaster();
  if (BR || (water && water.ice)) {
    const pts = [];
    // a biome glyph keeps clear of every mountain: spatial hash of mountain positions, in tile pixels (512 per tile)
    const hash = new Map(), HC = 24;
    for (const p of relief) { if (p.k !== 0) continue; const key = Math.floor((p.nx * n - x) * 512 / HC) + ',' + Math.floor((p.ny * n - y) * 512 / HC); (hash.get(key) || hash.set(key, []).get(key)).push(p); }
    const nearMtn = p => {
      const tx = (p.nx * n - x) * 512, ty = (p.ny * n - y) * 512, ci = Math.floor(tx / HC), cj = Math.floor(ty / HC);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) for (const q of hash.get((ci + di) + ',' + (cj + dj)) || []) {
        const dx = (q.nx * n - x) * 512 - tx, dy = (q.ny * n - y) * 512 - ty;
        if (dx * dx + dy * dy < 15 * 15 && dy > -24) return true;
      }
      return false;
    };
    const at = (m, p) => { const i = Math.floor((p.nx * n - x) * MS), j = Math.floor((p.ny * n - y) * MS); return m[Math.max(0, Math.min(MS - 1, j)) * MS + Math.max(0, Math.min(MS - 1, i))] === 1; };
    for (const p of nestedPoints(z, x, y, CFG.CB, 0, z + 1, 41)) {
      let b = 0;
      if (BR) { const bi = Math.min(BR.n - 1, Math.floor(p.nx * BR.n)), bj = Math.min(BR.n - 1, Math.floor(p.ny * BR.n)); b = BR.a[bj * BR.n + bi] >> 1; }
      if (water && water.ice && at(water.ice, p)) b = 5;           // OpenStreetMap glaciers, at any zoom
      else if (water && water.sand && at(water.sand, p)) b = 1;    // and sand, close in
      if (!b || !BIOME[b] || p.h >= BIOME[b].keep) continue;
      if (b !== 5 && z >= 7 && (b === 3 || b === 4)) continue;     // close in, OpenStreetMap's own woods take over
      if (wet(p) || nearWet(p) || nearMtn(p)) continue;
      pts.push({ nx: p.nx, ny: p.ny, r: p.r, b, v: Math.floor(hash3(Math.round(p.nx * 1e7), Math.round(p.ny * 1e7), 9) * 4) });
    }
    pts.sort((a, b) => a.ny - b.ny);
    if (pts.length) T.bytes(3, encodeLayer('biome', pts, ['r', 'b', 'v'], z, x, y));
  }
  if (relief.length) T.bytes(3, encodeLayer('relief', relief, ['r', 'k', 's', 'v', 'e', 'rl', 'rg'], z, x, y));
  if (z >= 7 && CFG.ofm) {
    const oz = Math.min(z, CFG.ofmMax);
    if (oz === z) {
      const mask = await coverMask(z, x, y);
      if (mask) {
        const at = p => { const n = Math.pow(2, z); const i = Math.floor((p.nx * n - x) * MS), j = Math.floor((p.ny * n - y) * MS); return j * MS + i; };
        if (mask.forest || mask.wood) {
          const trees = [];
          for (const p of nestedPoints(z, x, y, CFG.CT, 6, z + 1, 11)) {
            const i = at(p);
            const f = mask.forest && mask.forest[i], w = mask.wood && mask.wood[i];
            if ((!f && !w) || wet(p)) continue;
            const con = f ? (p.h < 0.7 ? 1 : 0) : (p.h < 0.18 ? 1 : 0);
            trees.push({ nx: p.nx, ny: p.ny, r: p.r, c: con, v: Math.floor(hash3(Math.round(p.nx * 1e7), Math.round(p.ny * 1e7), 5) * 4) });
          }
          trees.sort((a, b) => a.ny - b.ny);
          if (trees.length) T.bytes(3, encodeLayer('trees', trees, ['r', 'c', 'v'], z, x, y));
        }
        if (z >= 9 && (mask.wet || mask.heath)) {
          const tufts = [];
          for (const p of nestedPoints(z, x, y, CFG.CU, 8, z + 1, 23)) {
            const i = at(p);
            const wt = mask.wet && mask.wet[i], ht = mask.heath && mask.heath[i];
            if ((!wt && !ht) || wet(p)) continue;
            tufts.push({ nx: p.nx, ny: p.ny, r: p.r, w: wt ? 1 : 0, v: Math.floor(p.h * 3) });
          }
          if (tufts.length) T.bytes(3, encodeLayer('tufts', tufts, ['r', 'w', 'v'], z, x, y));
        }
      }
    }
  }
  return new Uint8Array(T.a).buffer;
}

const live = new Set();
self.onmessage = async (ev) => {
  const m = ev.data;
  if (m.config) { Object.assign(CFG, m.config); return; }
  if (m.cancel) { live.delete(m.cancel); return; }
  live.add(m.id);
  try {
    const t0 = performance.now();
    const buf = await buildTile(m.z, m.x, m.y);
    if (!live.has(m.id)) return;
    live.delete(m.id);
    self.postMessage({ id: m.id, buf, ms: performance.now() - t0 }, [buf]);
  } catch (e) {
    live.delete(m.id);
    self.postMessage({ id: m.id, err: String(e && e.stack || e) });
  }
};
