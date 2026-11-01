/* Ink map worker: turns elevation and land cover into hand-drawn glyph positions.
 * For each requested tile (z, x, y) it returns a Mapbox Vector Tile with these point layers:
 *   relief  mountains and hills, placed on local high points of Terrarium elevation tiles
 *   trees   tree glyphs scattered inside OpenStreetMap woods and forests (OpenFreeMap landcover)
 *   tufts   marsh and moorland tufts inside wetland and heath
 *   biome   desert, grassland, rainforest, taiga, ice, marsh and tundra glyphs (RESOLVE Ecoregions 2017)
 *   heritage  castles, churches, stone circles and other sites (Wikidata, zoom 6 and closer)
 *   town    townhouses along real streets, market squares, churches and town walls (zoom 12 and closer)
 * Every point carries the rank (r) at which it first appears, so the map can fade new glyphs in
 * smoothly as you zoom: the set at one zoom is always contained in the set at the next.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
'use strict';
let CFG = {
  dem: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', demMax: 15,
  ofm: null, ofmMax: 14,
  C: 14, RS: 99, RMAX: 12, HILL: 0.4, SAT_NB: 6, SAT_HI: 3, SAT_Q: 2.2, SNOWF: 700, HMAX: 650, TMAX: 1100, CHURCH_Z: 7.5, CAP_M: 0.75, CAP_T: 1.05, CAP_SAT: 0.45, SAT_INK: 1.6, PLAT: 2.5, G0: 1, GT: [4, 4.5, 5.5, 7.5, 10, 12, 13, 22, 30, 38, 48, 60, 70], GH: 0.45, MONT: 0.3, OPEN: 1.5, CB: 20, biomes: null, demScale: 1, // no new peaks beyond rank RMAX: close in, cells would measure slopes, not summits
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
// a simple snow line by latitude (metres): about 3,500 m in the tropics, 2,900 m at 45 degrees, 1,300 m at 60, 300 m at 75
function snowLine(lat) {
  const a = Math.abs(lat);
  return a <= 25 ? 3500 : a <= 45 ? 3500 - 30 * (a - 25) : a <= 60 ? 2900 - 106.7 * (a - 45) : a <= 75 ? 1300 - 66.7 * (a - 60) : 0;
}
const J0cell = (L, jj) => L.j0 + jj;
const biomeAt = (BR, nx, ny) => { if (!BR) return 0; const i = Math.min(BR.n - 1, Math.floor(nx * BR.n)), j = Math.min(BR.n - 1, Math.max(0, Math.floor(ny * BR.n))); return BR.a[j * BR.n + i] >> 2; };
const montaneAt = (BR, nx, ny) => { if (!BR) return false; const i = Math.min(BR.n - 1, Math.floor(nx * BR.n)), j = Math.min(BR.n - 1, Math.max(0, Math.floor(ny * BR.n))); return (BR.a[j * BR.n + i] & 2) === 2; };
const plateauAt = (BR, nx, ny) => { if (!BR) return false; const i = Math.min(BR.n - 1, Math.floor(nx * BR.n)), j = Math.min(BR.n - 1, Math.max(0, Math.floor(ny * BR.n))); return (BR.a[j * BR.n + i] & 1) === 1; };
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
        // the montane relief applies on coarse tiles (elevation zoom 5 or less) and fades out by zoom 8, where real
        // slopes show; on the high plateaus the bar is doubled so that only their ranges are peaked
        const nxp = (px0 + axp + 0.5) / S, nyp = (py0 + ayp + 0.5) / S;
        const montF = d <= 5 ? CFG.MONT : d >= 8 ? 1 : CFG.MONT + (1 - CFG.MONT) * (d - 5) / 3;
        const mf = plateauAt(BR, nxp, nyp) ? CFG.PLAT : montaneAt(BR, nxp, nyp) ? montF : (bAt >= 1 && bAt <= 4) || bAt === 7 ? CFG.OPEN : 1;
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
      const eM = v * CFG.demScale, sl = snowLine(latOfY(ny)) + (plateauAt(BR, nx, ny) ? 1500 : 0);
      out.push({ nx, ny, r: Math.max(r, 0), k, s: Math.round(s * 100) / 100, v: Math.floor(hash3(I, J, r + 99) * 8), e: Math.round(eM), rl: Math.round(rel[c]), rg: Math.round(rug[c] * 10) / 10,
                 sn: k === 0 && eM >= sl ? 1 : 0 });
    }
    // snowfields and glaciers: pale blue hatching on high, rugged ground well above the snow line (finest cells only)
    if (L === R[R.length - 1]) for (let jj = 1; jj < nJ - 1; jj++) for (let ii = 1; ii < nI - 1; ii++) {
      const c = jj * nI + ii, a = am[c];
      if (a < 0 || kind[c] < 0 || seen.has(a)) continue;
      const ax = a % W, ay = (a - ax) / W, ny = (py0 + ay + 0.5) / S, nx = (px0 + ax + 0.5) / S;
      if (nx < tnx0 || nx >= tnx1 || ny < tny0 || ny >= tny1) continue;
      if (mn[c] * CFG.demScale < snowLine(latOfY(ny)) + CFG.SNOWF + (plateauAt(BR, nx, ny) ? 1500 : 0)) continue;
      const I = L.i0 + ii, J = L.j0 + jj;
      out.push({ nx: nx + (hash3(I, J, 5) - 0.5) * cell * 0.5, ny: ny + cell * 0.3, r: Math.max(r, 0), k: 2, s: 1, v: Math.floor(hash3(I, J, 6) * 3), e: Math.round(mn[c] * CFG.demScale), rl: 0, rg: 0, sn: 1 });
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

// ---------------- ink cap ----------------
// Hand-drawn maps leave paper between the peaks. Glyphs are taken coarse ranks first and, within a rank, the most
// prominent first, at the size the style gives them in the middle of the tile's zoom; a mountain is kept only while
// the summed footprints of the mountains in its patch (a sixth of the tile each way) stay under CAP_M of the patch, and
// a hill while all glyphs stay under CAP_T. In a great range the lesser peaks are dropped so the ridgelines show; in
// hill country such as the Lake District the cap trims fewer than one peak in ten.
function glyphScale(zv, k, s, r) {
  const f = zv < 3 ? 0.8 : zv < 5 ? 0.9 : zv <= 7 ? 1 : zv <= 11 ? 1 + (zv - 7) * 0.075 : Math.min(1.6, 1.3 + (zv - 11) * 0.1);
  const cap = zv <= 11 ? 1.45 : Math.min(1.75, 1.45 + (zv - 11) * 0.1);
  return (k === 0 ? 0.54 : 0.52) * s * f * Math.min(cap, Math.pow(2, 0.42 * (zv - r)));
}
function inkCap(pts, z, x, y) {
  // ink density per patch: the summed footprints of the glyphs (overlaps counted, as the pen would draw them)
  const zv = z + 0.5, n = Math.pow(2, z), T = 512 * Math.pow(2, 0.5), NP = 6, P = T / NP;
  const inkM = new Float32Array(NP * NP), inkT = new Float32Array(NP * NP);
  const order = pts.map((p, i) => i).sort((a, b) => (pts[a].r - pts[b].r) || (pts[a].k - pts[b].k) || (pts[b].rl - pts[a].rl));
  // where a patch is saturated (candidate mountains would ink it more than SAT_INK times over, as in the Himalaya or
  // on a high plateau), the cap is cut to CAP_SAT, so the great ranges come out as ridges with paper between
  const cand = new Float32Array(NP * NP);
  const foot = p => { const sc = glyphScale(zv, p.k, p.s, p.r); return p.k === 0 ? 0.5 * 36 * 31 * sc * sc : 0.7 * 27 * 13 * sc * sc; };
  const cellOf = p => Math.max(0, Math.min(NP - 1, Math.floor((p.ny * n - y) * T / P))) * NP + Math.max(0, Math.min(NP - 1, Math.floor((p.nx * n - x) * T / P)));
  for (const p of pts) if (p.k === 0) cand[cellOf(p)] += foot(p) / (P * P);
  const keep = [];
  for (const i of order) {
    const p = pts[i], sc = glyphScale(zv, p.k, p.s, p.r);
    const a = p.k === 0 ? 0.5 * 36 * 31 * sc * sc : 0.7 * 27 * 13 * sc * sc;
    const cx = (p.nx * n - x) * T, by = (p.ny * n - y) * T;
    const c = Math.max(0, Math.min(NP - 1, Math.floor(by / P))) * NP + Math.max(0, Math.min(NP - 1, Math.floor(cx / P)));
    const capM = cand[c] > CFG.SAT_INK ? CFG.CAP_SAT : CFG.CAP_M;
    if (p.k === 0) { if (inkM[c] + a / (P * P) > capM) continue; inkM[c] += a / (P * P); }
    else { if (inkM[c] + inkT[c] + a / (P * P) > CFG.CAP_T) continue; inkT[c] += a / (P * P); }
    keep.push(p);
  }
  return keep;
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
      for (let i = 0; i < n * n; i++) a[i] = Math.round(d[i * 4] / 8);   // 4 x class + 2 x montane + plateau
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
  for (const v of vals) { const V = new Writer(); if (typeof v === 'string') V.str(1, v); else V.double(3, v); L.bytes(4, V.a); }
  L.tag(5, 0); L.varint(ext);
  return L.a;
}


// ---------------- heritage (Wikidata and the data studies, data/heritage/{x}_{y}.json on a zoom-6 grid) ----------------
let herIdx = null; const herTiles = new Map();
function heritageIndex() {
  if (!herIdx) herIdx = (async () => {
    if (!CFG.heritage) return null;
    try { const r = await fetch(CFG.heritage + 'index.json'); if (!r.ok) return null; const j = await r.json(); j.set = new Set(j.tiles); return j; } catch (e) { return null; }
  })();
  return herIdx;
}
function heritageBin(bx, by) {
  const k = bx + '_' + by;
  if (!herTiles.has(k)) herTiles.set(k, (async () => {
    try { const r = await fetch(CFG.heritage + k + '.json'); return r.ok ? await r.json() : []; } catch (e) { return []; }
  })());
  return herTiles.get(k);
}
const mercX = lon => (lon + 180) / 360;
const mercY = lat => { const s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * DEG); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
async function heritagePoints(z, x, y) {
  if (z < 6) return [];
  const I = await heritageIndex(); if (!I) return [];
  const sh = z - 6, bx = x >> sh, by = y >> sh;
  if (!I.set.has(bx + '_' + by)) return [];
  const rows = await heritageBin(bx, by), n = Math.pow(2, z), out = [];
  for (const r of rows) {
    const mz = r[3] / 10; if (mz > z + 1) continue;
    const nx = mercX(r[0] / 1e5), ny = mercY(r[1] / 1e5);
    if (Math.floor(nx * n) !== x || Math.floor(ny * n) !== y) continue;
    out.push({ nx, ny, i: I.icons[r[2]], z: mz, n: r[4] || '', q: r[5] ? 'Q' + r[5] : '' });
  }
  out.sort((a, b) => a.z - b.z);
  const kept = out.slice(0, CFG.HMAX);
  // names: at most one per cell of about 140 x 90 screen pixels, the best known first (lowest first zoom = most Wikipedia
  // articles); ordinary churches and chapels (fewer than about ten articles) stay unnamed until zoom 15 (see the style)
  const used = new Set();
  for (const p of kept) {
    p.l = '';
    if (!p.n || p.z > z - 0.5) continue;
    if (p.i === 'church' && p.z > CFG.CHURCH_Z && z < 14) continue;
    const k = Math.floor((p.nx * n - x) * 512 / 140) + ',' + Math.floor((p.ny * n - y) * 512 / 90);
    if (used.has(k)) continue;
    used.add(k); p.l = p.n;
  }
  return kept;
}

// ---------------- named hills (Wikidata, data/hills/{x}_{y}.json), zoom 10 and closer, where OpenStreetMap has no peak ----------------
let hillIdx = null; const hillTiles = new Map();
async function hillPoints(z, x, y) {
  if (z < 10 || !CFG.hills) return [];
  if (!hillIdx) hillIdx = (async () => { try { const r = await fetch(CFG.hills + 'index.json'); if (!r.ok) return null; const j = await r.json(); j.set = new Set(j.tiles); return j; } catch (e) { return null; } })();
  const I = await hillIdx; if (!I) return [];
  const sh = z - 6, k = (x >> sh) + '_' + (y >> sh);
  if (!I.set.has(k)) return [];
  if (!hillTiles.has(k)) hillTiles.set(k, (async () => { try { const r = await fetch(CFG.hills + k + '.json'); return r.ok ? await r.json() : []; } catch (e) { return []; } })());
  const rows = await hillTiles.get(k), n = Math.pow(2, z), out = [];
  for (const r of rows) {
    if (r[3] / 10 > z + 1) continue;
    const nx = mercX(r[0] / 1e5), ny = mercY(r[1] / 1e5);
    if (Math.floor(nx * n) !== x || Math.floor(ny * n) !== y) continue;
    out.push({ nx, ny, z: r[3] / 10, e: r[2], n: r[4] });
  }
  if (!out.length) return out;
  // OpenStreetMap peaks in the same tile already carry a name: skip a hill with the same name nearby, or any peak right on it
  const buf = CFG.ofm && z <= CFG.ofmMax ? await fetchOfm(z, x, y) : null;
  const pk = [];
  if (buf) { const L = decodeLayers(buf, new Set(['mountain_peak'])).mountain_peak; if (L) for (const span of L.feats) { const F = featureOf(buf, L, span); if (F.type !== 1) continue; const [px, py] = pointOf(buf, F.geom); pk.push({ x: px / L.extent * 512, y: py / L.extent * 512, n: String(F.props.name || '').toLowerCase() }); } }
  const res = [];
  for (const h of out) {
    const hx = (h.nx * n - x) * 512, hy = (h.ny * n - y) * 512, nm = h.n.toLowerCase();
    let dup = false;
    for (const q of pk) { const d = Math.hypot(q.x - hx, q.y - hy); if (d < 6 || (d < 60 && q.n && (q.n === nm || q.n.startsWith(nm) || nm.startsWith(q.n)))) { dup = true; break; } }
    if (!dup) res.push(h);
  }
  return res.slice(0, 300);
}

// ---------------- villages and hamlets (Wikidata, data/places/{x}_{y}.json), Britain and Ireland, where OpenStreetMap's tiles leave a place out ----------------
let placeIdx = null; const placeTiles = new Map();
async function placePoints(z, x, y) {
  if (z < 10 || !CFG.places) return [];
  if (!placeIdx) placeIdx = (async () => { try { const r = await fetch(CFG.places + 'index.json'); if (!r.ok) return null; const j = await r.json(); j.set = new Set(j.tiles); return j; } catch (e) { return null; } })();
  const I = await placeIdx; if (!I) return [];
  const sh = z - 6, k = (x >> sh) + '_' + (y >> sh);
  if (!I.set.has(k)) return [];
  if (!placeTiles.has(k)) placeTiles.set(k, (async () => { try { const r = await fetch(CFG.places + k + '.json'); return r.ok ? await r.json() : []; } catch (e) { return []; } })());
  const rows = await placeTiles.get(k), n = Math.pow(2, z), out = [];
  for (const r of rows) {
    if (r[3] / 10 > z + 1) continue;
    const nx = mercX(r[0] / 1e5), ny = mercY(r[1] / 1e5);
    if (Math.floor(nx * n) !== x || Math.floor(ny * n) !== y) continue;
    out.push({ nx, ny, z: r[3] / 10, k: r[2], n: r[4] });
  }
  if (!out.length) return out;
  // a place the OpenStreetMap tile (or, beyond its last zoom, the tile it is cut from) already names is left to it
  const oz = Math.min(z, CFG.ofmMax || 14), d = z - oz;
  const buf = CFG.ofm ? await fetchOfm(oz, x >> d, y >> d) : null;
  const names = new Set();
  if (buf) { const L = decodeLayers(buf, new Set(['place'])).place; if (L) for (const span of L.feats) { const F = featureOf(buf, L, span); for (const key of ['name', 'name_en', 'name:en', 'name:latin']) if (F.props[key]) names.add(String(F.props[key]).toLowerCase()); } }
  return out.filter(p => !names.has(p.n.toLowerCase())).slice(0, 200);
}

// ---------------- drawn towns (zoom 12 and closer): townhouses along the real streets of built-up land ----------------
function lineParts(buf, g) {
  const R = new Reader(buf); R.p = g[0];
  let x = 0, y = 0; const parts = []; let cur = null;
  while (R.p < g[1]) {
    const ci = R.varint(), cmd = ci & 7, cnt = ci >> 3;
    if (cmd === 7) continue;
    for (let i = 0; i < cnt; i++) {
      const dx = R.varint(), dy = R.varint();
      x += (dx >>> 1) ^ -(dx & 1); y += (dy >>> 1) ^ -(dy & 1);
      if (cmd === 1) { cur = [[x, y]]; parts.push(cur); } else cur.push([x, y]);
    }
  }
  return parts;
}
function pointOf(buf, g) { const R = new Reader(buf); R.p = g[0]; R.varint(); const dx = R.varint(), dy = R.varint(); return [(dx >>> 1) ^ -(dx & 1), (dy >>> 1) ^ -(dy & 1)]; }
// radius of the drawn town (km) and of its walled old core, by kind of place
const TOWN_R = { capital: 4.2, city: 2.6, town: 1.25, village: 0.45 };
// share of house sites kept at distance dr (in place radii) from the centre: packed rows in the old core, falling fast
// through the inner streets, then scattered houses with gardens at the edge
const townKeep = dr => dr < 0.15 ? 1 : dr < 0.35 ? 1 - 1.5 * (dr - 0.15) : Math.max(0.04, 0.7 * Math.exp(-3.2 * (dr - 0.35)));
// real town walls (data/walls.geojson): where one runs round a core, it is drawn from the data, not as a ring
let wallBoxes = null;
function realWalls() {
  if (!wallBoxes) wallBoxes = (async () => {
    if (!CFG.walls) return [];
    try {
      const j = await (await fetch(CFG.walls)).json(), out = [];
      for (const f of j.features) {
        if (f.properties.k !== 'wall') continue;
        const g = f.geometry, ls = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
        let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
        for (const l of ls) for (const c of l) { const X = mercX(c[0]), Y = mercY(c[1]); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
        out.push([x0, y0, x1, y1]);
      }
      return out;
    } catch (e) { return []; }
  })();
  return wallBoxes;
}
async function townPoints(z, x, y, avoid) {
  if (z < 12 || !CFG.ofm || z > CFG.ofmMax) return [];
  const [buf, pbuf] = await Promise.all([fetchOfm(z, x, y), fetchOfm(z - 2, x >> 2, y >> 2)]);
  if (!buf || !pbuf) return [];
  const n = Math.pow(2, z), Ls = decodeLayers(buf, new Set(['transportation', 'landuse', 'building', 'water']));
  // places from the parent tile two zooms up, so a town just over the tile's edge still sets the density here
  const PL = decodeLayers(pbuf, new Set(['place'])).place, n2 = n / 4, places = [];
  if (PL) for (const span of PL.feats) {
    const F = featureOf(pbuf, PL, span); if (F.type !== 1) continue;
    const cl = F.props.class; if (!TOWN_R[cl] && cl !== 'city') continue;
    const [px, py] = pointOf(pbuf, F.geom);
    const nx = ((x >> 2) + px / PL.extent) / n2, ny = ((y >> 2) + py / PL.extent) / n2;
    const kind = cl === 'city' && (F.props.capital === 2 || F.props.capital === '2') ? 'capital' : cl;
    places.push({ nx, ny, kind, R: TOWN_R[kind] || 1, rank: F.props.rank || 9 });
  }
  if (!places.length) return [];
  const kmPerN = 40075 * Math.cos(latOfY((y + 0.5) / n) * DEG);   // km per unit of normalised x at this latitude
  // built-up land: residential, commercial and retail land use and the buildings themselves
  const built = Ls.landuse ? polyMask(buf, Ls.landuse, p => ['residential', 'commercial', 'retail', 'suburb', 'neighbourhood', 'quarter'].includes(p.class)) : null;
  const bld = Ls.building ? polyMask(buf, Ls.building, null) : null;
  const wet = Ls.water ? polyMask(buf, Ls.water, null) : null;
  const at = (m, tx, ty) => m && m[Math.max(0, Math.min(MS - 1, Math.floor(ty * MS))) * MS + Math.max(0, Math.min(MS - 1, Math.floor(tx * MS)))] === 1;
  // building density round a point (share of a 5 x 5 mask window covered)
  const dens = (tx, ty) => { if (!bld) return 0; let c = 0; const i0 = Math.floor(tx * MS), j0 = Math.floor(ty * MS); for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < MS && j < MS && bld[j * MS + i]) c++; } return c / 25; };
  const near = (nx, ny) => { let best = null, bd = 1e9; for (const P of places) { const d = Math.hypot((nx - P.nx) * kmPerN, (ny - P.ny) * kmPerN) / P.R; if (d < bd) { bd = d; best = P; } } return [best, bd]; };
  // occupancy grid in tile pixels (512 a tile), so houses never overprint each other or a heritage drawing
  const OC = 7, occ = new Set();
  const key = (px, py) => Math.floor(px / OC) + ',' + Math.floor(py / OC);
  const free = (px, py, r) => { for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (occ.has((Math.floor(px / OC) + di) + ',' + (Math.floor(py / OC) + dj))) return false; return true; };
  const take = (px, py, r) => { for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) occ.add((Math.floor(px / OC) + di) + ',' + (Math.floor(py / OC) + dj)); };
  // heritage drawings keep a clear square round them; the houses pack the rest of the old core
  for (const p of avoid) take((p.nx * n - x) * 512, (p.ny * n - y) * 512, 2);
  const out = [];
  // the centre of each place in this tile: a market square and its church, and for capitals and cities a wall with towers round the old core
  for (const P of places) {
    const px = (P.nx * n - x) * 512, py = (P.ny * n - y) * 512;
    if (px >= 0 && px < 512 && py >= 0 && py < 512 && P.kind !== 'village') {
      // set just below the name, which sits on the place point
      out.push({ nx: P.nx - 8 / 512 / n, ny: P.ny + 20 / 512 / n, t: 'market', a: 0, o: 0 }); take(px - 8, py + 20, 2);
      out.push({ nx: P.nx + 14 / 512 / n, ny: P.ny + 16 / 512 / n, t: 'townchurch', a: 0, o: 0 }); take(px + 14, py + 16, 2);
    } else if (px >= 0 && px < 512 && py >= 0 && py < 512) { out.push({ nx: P.nx + 10 / 512 / n, ny: P.ny + 16 / 512 / n, t: 'townchurch', a: 0, o: 0 }); take(px + 10, py + 16, 2); }
    const W0 = await realWalls(), rk0 = P.R * 0.4 / kmPerN;
    const hasWall = W0.some(b => b[0] < P.nx + rk0 && b[2] > P.nx - rk0 && b[1] < P.ny + rk0 && b[3] > P.ny - rk0 && (b[2] - b[0]) < rk0 * 6);
    if (!hasWall && (P.kind === 'capital' || (P.kind === 'city' && P.rank <= 3))) {
      const rk = P.R * 0.32 / kmPerN, segs = Math.max(24, Math.round(2 * Math.PI * rk * n * 512 / 13));
      for (let s = 0; s < segs; s++) {
        const th = s / segs * 2 * Math.PI, wob = 1 + 0.06 * Math.sin(th * 3 + P.nx * 1e4);
        const wx = P.nx + Math.cos(th) * rk * wob, wy = P.ny + Math.sin(th) * rk * wob;
        const tx = (wx * n - x), ty = (wy * n - y);
        if (tx < 0 || tx >= 1 || ty < 0 || ty >= 1 || at(wet, tx, ty)) continue;
        const tower = s % 5 === 0;
        out.push({ nx: wx, ny: wy, t: tower ? 'walltower' : 'wallseg', a: tower ? 0 : (th * 180 / Math.PI + 90) % 360, o: 1 });
        take(tx * 512, ty * 512, 1);
      }
    }
  }
  // townhouses: both sides of every street, facing it, densest at the centre and thinning outwards with the buildings
  const T = Ls.transportation, cand = [];
  if (T) {
    const STREET = { primary: 1, secondary: 1, tertiary: 1, minor: 1, service: 0.5, residential: 1, living_street: 1, pedestrian: 1 };
    const sc = 512 / T.extent, step = 10.5, off = 8;
    for (const span of T.feats) {
      if (cand.length >= 8000) break;
      const F = featureOf(buf, T, span); if (F.type !== 2) continue;
      const w = STREET[F.props.class]; if (!w || F.props.brunnel === 'tunnel' || F.props.brunnel === 'bridge') continue;
      for (const part of lineParts(buf, F.geom)) {
        let carry = step * 0.5;
        for (let k = 1; k < part.length; k++) {
          const ax = part[k - 1][0] * sc, ay = part[k - 1][1] * sc, bx = part[k][0] * sc, by = part[k][1] * sc;
          const L = Math.hypot(bx - ax, by - ay); if (L < 0.5) continue;
          const ux = (bx - ax) / L, uy = (by - ay) / L;
          for (let d = carry; d < L; d += step) {
            const cx = ax + ux * d, cy = ay + uy * d;
            for (const side of [1, -1]) {
              const nxv = -uy * side, nyv = ux * side, hx = cx + nxv * off, hy = cy + nyv * off;
              if (hx < 0 || hx >= 512 || hy < 0 || hy >= 512) continue;
              const tx = hx / 512, ty = hy / 512;
              if (at(wet, tx, ty)) continue;
              const gnx = (x + tx) / n, gny = (y + ty) / n, [P, dr] = near(gnx, gny);
              if (!P || dr > 1.6) continue;
              const ins = at(built, tx, ty), dn = dens(tx, ty);
              if (!ins && dn < 0.12 && dr > 0.5) continue;
              // keep share: the old core is packed; beyond it, houses only where OpenStreetMap maps buildings
              const keep = Math.min(1, townKeep(dr) * w * (0.7 + 0.5 * dn));
              const h = hash3(Math.round(gnx * 4e7), Math.round(gny * 4e7), 31);
              if (h >= keep) continue;
              cand.push({ hx, hy, dr, it: { nx: gnx, ny: gny, t: 'th' + Math.floor(hash3(Math.round(gnx * 4e7), 7, Math.round(gny * 4e7)) * 6), a: Math.round((Math.atan2(nxv, -nyv) * 180 / Math.PI + 360) % 360), o: 0 } });
            }
          }
          carry = (carry - L % step + step) % step; if (carry < 0.01) carry = step;
        }
      }
    }
  }
  // blocks between the streets (and towns whose small streets the tile leaves out): fill the built-up land on a
  // jittered grid, houses turned to the nearest street direction found above, or square to the map
  const G = 10.5;
  for (let gy = G / 2; gy < 512; gy += G) for (let gx = G / 2; gx < 512; gx += G) {
    const gnx0 = (x + gx / 512) / n, gny0 = (y + gy / 512) / n;
    const hx = gx + (hash3(Math.round(gnx0 * 4e7), Math.round(gny0 * 4e7), 41) - 0.5) * G * 0.6, hy = gy + (hash3(Math.round(gny0 * 4e7), Math.round(gnx0 * 4e7), 43) - 0.5) * G * 0.6;
    const tx = hx / 512, ty = hy / 512;
    if (tx < 0 || ty < 0 || tx >= 1 || ty >= 1 || at(wet, tx, ty)) continue;
    const gnx = (x + tx) / n, gny = (y + ty) / n, [P, dr] = near(gnx, gny);
    if (!P || dr > 1.3) continue;
    const ins = at(built, tx, ty), dn = dens(tx, ty);
    if (!ins && dn < 0.2 && dr > 0.4) continue;            // the old core counts as built even where the tile maps nothing
    const keep = dr < 0.18 ? 0.95 : Math.min(1, townKeep(dr) * (0.25 + 0.6 * dn));
    if (hash3(Math.round(gnx * 4e7), Math.round(gny * 4e7), 47) >= keep) continue;
    cand.push({ hx, hy, dr: dr + 0.001, it: { nx: gnx, ny: gny, t: 'th' + Math.floor(hash3(Math.round(gnx * 4e7), 9, Math.round(gny * 4e7)) * 6), a: [0, 90, 180, 270][Math.floor(hash3(Math.round(gnx * 4e7), 11, 3) * 4)], o: 0 } });
  }
  // place from the centre outwards, so the cap on drawings per tile thins the edges, never the old core
  cand.sort((a, b) => a.dr - b.dr);
  for (const c of cand) {
    if (out.length >= CFG.TMAX) break;
    if (!free(c.hx, c.hy, 0)) continue;
    take(c.hx, c.hy, 0); out.push(c.it);
  }
  return out;
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
  const snowf = relief0.filter(p => p.k === 2 && !nearWet(p));
  const relief = inkCap(relief0.filter(p => p.k !== 2 && !nearWet(p)), z, x, y).concat(snowf);
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
      if (BR) { const bi = Math.min(BR.n - 1, Math.floor(p.nx * BR.n)), bj = Math.min(BR.n - 1, Math.floor(p.ny * BR.n)); b = BR.a[bj * BR.n + bi] >> 2; }
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
  if (relief.length) T.bytes(3, encodeLayer('relief', relief, ['r', 'k', 's', 'v', 'e', 'rl', 'rg', 'sn'], z, x, y));
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
  // heritage drawings and, close in, the drawn towns
  const her = await heritagePoints(z, x, y);
  if (her.length) T.bytes(3, encodeLayer('heritage', her, ['i', 'z', 'n', 'q', 'l'], z, x, y));
  if (z >= 10) {
    const hills = await hillPoints(z, x, y);
    if (hills.length) T.bytes(3, encodeLayer('hills', hills, ['z', 'e', 'n'], z, x, y));
    const xp = await placePoints(z, x, y);
    if (xp.length) T.bytes(3, encodeLayer('xplaces', xp, ['z', 'k', 'n'], z, x, y));
  }
  if (z >= 12) {
    const town = await townPoints(z, x, y, her);
    town.sort((a, b) => a.ny - b.ny);
    if (town.length) T.bytes(3, encodeLayer('town', town, ['t', 'a', 'o'], z, x, y));
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
