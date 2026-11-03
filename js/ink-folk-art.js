/* The Inked World: hidden folk. A small sprite system for the "Where's the Cartographer?" figures and the traveller.
 * Every figure is built from layered parts (body and pose, garments and their colours, headgear, props, beasts, boats)
 * and drawn once on canvas at 3x in the same pen as the map: brown-black ink outlines, flat muted fills (madder, ochre,
 * woad, sage, undyed wool), fine hatching for shade. All designs are original. Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const INK = '#2B2119', PAPER = '#F3E5BF', WATER = '#3D6E9E';
  // TODO(art): switch to js/ink-palette.js when the palette module lands (same hues, kept muted to sit with the map's ink)
  const C = {
    ink: INK, paper: PAPER, madder: '#A8382B', madderDk: '#7C2519', rose: '#C27A68', ochre: '#C99A42', ochreLt: '#DEBD72',
    saffron: '#D6A436', woad: '#56769A', woadDk: '#36506E', indigo: '#2E3E64', sage: '#7E8D5E', green: '#4F7041', moss: '#69744A',
    undyed: '#E6D9BB', wool: '#D3C49F', russet: '#8E5C37', brown: '#6A4A31', dun: '#9C8462', black: '#3B322B', white: '#F3EDDF',
    grey: '#8F8A7E', slate: '#6E7378', murrey: '#713344', purple: '#5E4466', teal: '#4C7C74', gold: '#C9A13B', steel: '#B3B7B6',
    steelDk: '#747A7C', straw: '#D9C17A', bone: '#E9E1CB', water: WATER, waterLt: '#8DB2D2', ice: '#E7EEF0', fire: '#E07B2A', leaf: '#5E7F44',
    stone: '#A69E8C', stoneDk: '#7D7666', jade: '#5F8F72', crimson: '#9B2C2C', vermilion: '#C4472E', orchre: '#C99A42',
  };
  const SKIN = {   // fair European manuscript tones; region-appropriate tones elsewhere (never exaggerated)
    fair: '#F2DCC4', pale: '#F5E3CF', ruddy: '#EDC9AA', olive: '#D9B08A', tan: '#C6976C', medium: '#B07F55', brown: '#8E5D3D',
    deep: '#6A432B', ebony: '#55362A', golden: '#E6C29A', copper: '#B97A52', green: '#9AA77A', grey: '#9FA0A0', stone: '#A9A291', blue: '#B9C7D2', ghost: '#EEF1EE',
  };
  const HAIR = { blond: '#D7B56A', fair: '#C9A35E', brown: '#6E4A2E', dark: '#3D2C22', black: '#221A16', red: '#A2522B', grey: '#B9B2A4', white: '#EDE8DA', auburn: '#8A4426' };
  const col = (v, d) => (v && (C[v] || SKIN[v] || HAIR[v] || (v[0] === '#' ? v : null))) || d;

  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function hashStr(t) { let h = 2166136261; for (const ch of String(t)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ------------------------------------------------------------------ the pen (units are CSS pixels; the canvas is scaled)
  function G(ctx, R) {
    const j = a => (R() - 0.5) * a;
    const g = {
      x: ctx, R,
      path(pts, close, smooth, jit) {
        const J = jit === undefined ? 0.12 : jit;
        const q = pts.map(p => [p[0] + j(J), p[1] + j(J)]);
        ctx.beginPath();
        if (smooth && q.length > 2) {
          ctx.moveTo(q[0][0], q[0][1]);
          const n = q.length;
          for (let i = 1; i < n - (close ? 0 : 1); i++) {
            const a = q[i], b = q[(i + 1) % n];
            ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
          }
          if (!close) ctx.lineTo(q[n - 1][0], q[n - 1][1]); else { ctx.quadraticCurveTo(q[0][0], q[0][1], q[0][0], q[0][1]); }
        } else q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        if (close) ctx.closePath();
        return g;
      },
      shape(pts, fill, lw, smooth) {
        g.path(pts, true, smooth);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (lw !== 0) { ctx.strokeStyle = INK; ctx.lineWidth = lw || 0.42; ctx.stroke(); }
        return g;
      },
      line(pts, lw, c, smooth) { g.path(pts, false, smooth, 0.08); ctx.strokeStyle = c || INK; ctx.lineWidth = lw || 0.4; ctx.stroke(); return g; },
      // a limb or pole: ink outline then colour, so it reads as a drawn, filled shape
      limb(pts, w, c, smooth) {
        g.path(pts, false, smooth, 0.04); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = w + 0.75; ctx.stroke();
        g.path(pts, false, smooth, 0); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke();
        return g;
      },
      ell(cx, cy, rx, ry, fill, lw, rot) {
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (lw !== 0) { ctx.strokeStyle = INK; ctx.lineWidth = lw || 0.42; ctx.stroke(); }
        return g;
      },
      dot(x, y, r, c) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = c || INK; ctx.fill(); return g; },
      // fine shading lines inside a shape, optionally only beyond a vertical cut (the shaded side)
      hatch(pts, ang, gap, opt) {
        opt = opt || {};
        ctx.save(); g.path(pts, true, opt.smooth, 0); ctx.clip();
        if (opt.side !== undefined) { ctx.beginPath(); ctx.rect(opt.side < 0 ? -200 : opt.cut || 0, -200, 200 + (opt.side < 0 ? (opt.cut || 0) : 0), 400); ctx.clip(); }
        ctx.strokeStyle = opt.c || 'rgba(43,33,25,0.55)'; ctx.lineWidth = opt.lw || 0.2;
        const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = (x1 - x0) + (y1 - y0) + 4;
        for (let d = -L; d <= L; d += gap) {
          const px = cx - sa * d, py = cy + ca * d;
          ctx.beginPath(); ctx.moveTo(px - ca * L, py - sa * L); ctx.lineTo(px + ca * L, py + sa * L); ctx.stroke();
        }
        ctx.restore(); return g;
      },
      save() { ctx.save(); return g; }, restore() { ctx.restore(); return g; },
    };
    return g;
  }
  const arc = (cx, cy, rx, ry, a0, a1, n) => { const o = []; n = n || 10; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  // ------------------------------------------------------------------ heraldry (tiny shields and banners)
  function charge(g, pts, d, x, y, s) {
    const t1 = col(d && d.c1, C.madder), t2 = col(d && d.c2, C.ochreLt), k = (d && d.d) || 'pale';
    g.shape(pts, t1, 0);
    g.save(); g.path(pts, true, false, 0); g.x.clip(); g.x.fillStyle = t2; g.x.beginPath();
    if (k === 'pale') g.x.rect(x, y - 10 * s, 10 * s, 20 * s);
    else if (k === 'fess') g.x.rect(x - 10 * s, y - 0.5 * s, 20 * s, 1.3 * s);
    else if (k === 'bend') { g.x.moveTo(x - 4 * s, y - 4 * s); g.x.lineTo(x - 2.6 * s, y - 5 * s); g.x.lineTo(x + 4 * s, y + 3 * s); g.x.lineTo(x + 2.6 * s, y + 4 * s); }
    else if (k === 'chevron') { g.x.moveTo(x - 4 * s, y + 2 * s); g.x.lineTo(x, y - 1.6 * s); g.x.lineTo(x + 4 * s, y + 2 * s); g.x.lineTo(x + 4 * s, y + 3.4 * s); g.x.lineTo(x, y - 0.2 * s); g.x.lineTo(x - 4 * s, y + 3.4 * s); }
    else if (k === 'cross') { g.x.rect(x - 0.55 * s, y - 10 * s, 1.1 * s, 20 * s); g.x.rect(x - 10 * s, y - 0.9 * s, 20 * s, 1.1 * s); }
    else if (k === 'chief') g.x.rect(x - 10 * s, y - 10 * s, 20 * s, 8.6 * s);
    else if (k === 'quarterly') { g.x.rect(x, y - 10 * s, 10 * s, 10 * s); g.x.rect(x - 10 * s, y, 10 * s, 10 * s); }
    else if (k === 'roundel') g.x.arc(x, y, 1.1 * s, 0, 7);
    else if (k === 'saltire') { g.x.moveTo(x - 4 * s, y - 4 * s); g.x.lineTo(x + 4 * s, y + 4 * s); g.x.lineTo(x + 4 * s, y + 2.8 * s); g.x.lineTo(x - 2.8 * s, y - 4 * s); g.x.moveTo(x + 4 * s, y - 4 * s); g.x.lineTo(x - 4 * s, y + 4 * s); g.x.lineTo(x - 2.8 * s, y + 4 * s); g.x.lineTo(x + 4 * s, y - 2.8 * s); }
    g.x.fill(); g.restore();
    g.path(pts, true, false, 0); g.x.strokeStyle = INK; g.x.lineWidth = 0.35; g.x.stroke();
  }
  function shield(g, x, y, s, d) {
    const p = [[x - 1.5 * s, y - 1.9 * s], [x + 1.5 * s, y - 1.9 * s], [x + 1.5 * s, y], [x + 0.8 * s, y + 1.5 * s], [x, y + 2.1 * s], [x - 0.8 * s, y + 1.5 * s], [x - 1.5 * s, y]];
    charge(g, p, d, x, y, s);
  }
  function roundShield(g, x, y, r, d) {
    g.ell(x, y, r, r, col(d && d.c1, C.madder), 0.4);
    g.ell(x, y, r * 0.3, r * 0.3, col(d && d.c2, C.steel), 0.3);
    if (d && d.d === 'quarterly') { g.line([[x - r, y], [x + r, y]], 0.25); g.line([[x, y - r], [x, y + r]], 0.25); }
  }
  function banner(g, x, y, top, d, swallow) {
    g.limb([[x, y], [x, top]], 0.35, C.brown);
    const w = 4.2, h = 2.6;
    const pts = swallow ? [[x, top + 0.2], [x + w, top + 0.4], [x + w - 1.2, top + h / 2 + 0.2], [x + w, top + h], [x, top + h]] : [[x, top + 0.2], [x + w, top + 0.4], [x + w, top + h + 0.3], [x, top + h]];
    charge(g, pts, d, x + w / 2, top + h / 2, 0.9);
    g.dot(x, top - 0.3, 0.35, C.gold);
  }

  // ------------------------------------------------------------------ props held in the hand (hand at hx, hy; ground at 0)
  const PROPS = {
    staff(g, h, f) { g.limb([[h[0] + 0.2, -f.H * 1.02], [h[0] - 0.3, 0]], 0.42, C.brown); },
    pilgrim(g, h, f) { g.limb([[h[0] + 0.2, -f.H * 1.06], [h[0] - 0.3, 0]], 0.42, C.brown); g.ell(h[0] + 0.15, -f.H * 0.98, 0.45, 0.75, C.ochre, 0.3); g.ell(h[0] + 0.5, h[1] - 1.2, 0.55, 0.85, C.ochreLt, 0.3); },
    crook(g, h, f) { const t = -f.H * 1.02; g.limb([[h[0], 0], [h[0] + 0.2, t], [h[0] + 0.9, t - 1.0], [h[0] + 1.7, t - 0.4], [h[0] + 1.6, t + 0.5]], 0.38, C.brown); },
    spear(g, h, f) { const t = -f.H * 1.22; g.limb([[h[0] - 0.4, 0.4], [h[0] + 0.3, t]], 0.36, C.brown); g.shape([[h[0] + 0.3, t - 2.2], [h[0] + 0.85, t], [h[0] - 0.25, t]], C.steel, 0.3); },
    pike(g, h, f) { const t = -f.H * 1.5; g.limb([[h[0] - 0.4, 0.4], [h[0] + 0.4, t]], 0.32, C.brown); g.shape([[h[0] + 0.4, t - 2], [h[0] + 0.9, t], [h[0] - 0.1, t]], C.steel, 0.3); },
    halberd(g, h, f) { const t = -f.H * 1.3; g.limb([[h[0] - 0.4, 0.4], [h[0] + 0.3, t]], 0.34, C.brown); g.shape([[h[0] + 0.3, t - 1.5], [h[0] + 2.1, t + 0.3], [h[0] + 2.1, t + 2.0], [h[0] + 0.3, t + 1.6]], C.steel, 0.3); g.shape([[h[0] + 0.3, t - 2.4], [h[0] + 0.65, t - 0.5], [h[0] - 0.05, t - 0.5]], C.steel, 0.3); },
    banner(g, h, f) { banner(g, h[0], 1, -f.H * 1.32, f.her, true); },
    sword(g, h) { g.limb([[h[0], h[1]], [h[0] + 1.6, h[1] - 5.8]], 0.5, C.steel); g.line([[h[0] - 0.8, h[1] - 0.1], [h[0] + 0.8, h[1] - 0.5]], 0.5); },
    swordup(g, h) { g.limb([[h[0], h[1]], [h[0] + 0.2, h[1] - 6.2]], 0.5, C.steel); g.line([[h[0] - 0.9, h[1] - 0.4], [h[0] + 0.9, h[1] - 0.4]], 0.5); },
    axe(g, h) { g.limb([[h[0] - 0.4, h[1] + 1.4], [h[0] + 0.6, h[1] - 5]], 0.38, C.brown); g.shape([[h[0] + 0.4, h[1] - 4.8], [h[0] + 2.4, h[1] - 5.8], [h[0] + 2.4, h[1] - 3.2], [h[0] + 0.5, h[1] - 3.8]], C.steel, 0.3); },
    hammer(g, h) { g.limb([[h[0], h[1] + 0.6], [h[0] + 0.6, h[1] - 3.6]], 0.36, C.brown); g.shape([[h[0] - 0.4, h[1] - 4.6], [h[0] + 1.8, h[1] - 4.2], [h[0] + 1.7, h[1] - 3.2], [h[0] - 0.5, h[1] - 3.6]], C.steelDk, 0.3); },
    pick(g, h) { g.limb([[h[0], h[1] + 0.6], [h[0] + 0.6, h[1] - 3.8]], 0.36, C.brown); g.line([[h[0] - 1.6, h[1] - 3.0], [h[0] + 0.6, h[1] - 4.2], [h[0] + 2.6, h[1] - 3.2]], 0.6, C.steelDk, true); },
    bow(g, h) { g.line([[h[0] + 0.2, h[1] - 4.5], [h[0] + 1.6, h[1]], [h[0] + 0.2, h[1] + 4.5]], 0.55, C.brown, true); g.line([[h[0] + 0.2, h[1] - 4.4], [h[0] - 0.6, h[1]], [h[0] + 0.2, h[1] + 4.4]], 0.18, INK); },
    lantern(g, h) { g.line([[h[0], h[1]], [h[0], h[1] + 0.9]], 0.25); g.shape([[h[0] - 0.7, h[1] + 0.9], [h[0] + 0.7, h[1] + 0.9], [h[0] + 0.8, h[1] + 2.6], [h[0] - 0.8, h[1] + 2.6]], '#F2D27A', 0.32); g.line([[h[0] - 0.9, h[1] + 0.9], [h[0] + 0.9, h[1] + 0.9]], 0.35); },
    torch(g, h) { g.limb([[h[0], h[1] + 1], [h[0] + 0.5, h[1] - 3]], 0.38, C.brown); g.shape([[h[0] + 0.5, h[1] - 3], [h[0] - 0.4, h[1] - 4.2], [h[0] + 0.6, h[1] - 6.4], [h[0] + 1.5, h[1] - 4.4]], C.fire, 0.28); g.shape([[h[0] + 0.5, h[1] - 3.3], [h[0] + 0.1, h[1] - 4.2], [h[0] + 0.6, h[1] - 5.2], [h[0] + 1.0, h[1] - 4.2]], '#F4D06A', 0); },
    basket(g, h) { g.shape([[h[0] - 1.5, h[1] + 0.4], [h[0] + 1.5, h[1] + 0.4], [h[0] + 1.1, h[1] + 2.4], [h[0] - 1.1, h[1] + 2.4]], C.straw, 0.35); g.line([[h[0] - 1.3, h[1] + 1.3], [h[0] + 1.3, h[1] + 1.3]], 0.2); g.line([[h[0] - 1.3, h[1] + 0.4], [h[0], h[1] - 1.2], [h[0] + 1.3, h[1] + 0.4]], 0.3, INK, true); },
    book(g, h) { g.shape([[h[0] - 0.3, h[1] - 1.4], [h[0] + 1.6, h[1] - 1.0], [h[0] + 1.6, h[1] + 0.8], [h[0] - 0.3, h[1] + 0.4]], C.madder, 0.3); },
    quill(g, h) { g.line([[h[0], h[1]], [h[0] + 1.6, h[1] - 3.2]], 0.3); g.shape([[h[0] + 0.7, h[1] - 1.4], [h[0] + 1.9, h[1] - 3.8], [h[0] + 1.3, h[1] - 1.6]], C.white, 0.25); },
    map(g, h) { g.shape([[h[0] - 0.2, h[1] - 1.6], [h[0] + 3.2, h[1] - 2.2], [h[0] + 3.4, h[1] + 0.8], [h[0] - 0.1, h[1] + 1.2]], C.paper, 0.3); g.line([[h[0] + 0.5, h[1] - 0.6], [h[0] + 1.4, h[1] - 1.1], [h[0] + 2.0, h[1] - 0.4]], 0.18, C.madder); g.line([[h[0] + 0.6, h[1] + 0.4], [h[0] + 2.6, h[1]]], 0.18, C.water); },
    alphorn(g, h) { g.limb([[h[0] - 0.4, h[1] - 0.8], [h[0] + 4, h[1] + 4], [h[0] + 8.5, h[1] + 9.6]], 0.55, C.brown, true); g.shape([[h[0] + 8.0, h[1] + 8.4], [h[0] + 10.6, h[1] + 9.8], [h[0] + 9.6, h[1] + 11.0], [h[0] + 7.6, h[1] + 10.4]], C.russet, 0.3); g.line([[h[0] + 2, h[1] + 2.1], [h[0] + 2.6, h[1] + 1.5]], 0.25, C.gold); },
    bagpipe(g, h) { g.ell(h[0] - 1.0, h[1] + 0.4, 1.7, 1.2, C.madder, 0.32, 0.3); for (const [dx, dy] of [[-2.4, -4.6], [-1.4, -5.2], [-0.4, -4.4]]) g.line([[h[0] - 1.2, h[1] - 0.2], [h[0] + dx, h[1] + dy]], 0.35, C.black); g.line([[h[0] - 0.2, h[1] + 0.8], [h[0] + 1.6, h[1] + 3.4]], 0.4, C.black); g.line([[h[0] - 0.6, h[1] - 0.6], [h[0] + 0.6, h[1] - 2.2]], 0.25, C.black); },
    horn(g, h) { g.shape([[h[0], h[1] - 0.2], [h[0] + 2.4, h[1] - 1.6], [h[0] + 2.8, h[1] - 0.6], [h[0] + 0.2, h[1] + 0.5]], C.bone, 0.3); },
    rod(g, h, f) { g.line([[h[0], h[1]], [h[0] + 7, h[1] - 5.5]], 0.32, C.brown); g.line([[h[0] + 7, h[1] - 5.5], [h[0] + 7.6, (f.lineTo || 3)]], 0.14); },
    net(g, h) { g.line([[h[0], h[1]], [h[0] + 2.8, h[1] - 2.4]], 0.3, C.brown); g.shape(arc(h[0] + 3.6, h[1] - 2.1, 1.4, 1.4, 0, Math.PI * 2, 12), null, 0.25); g.hatch(arc(h[0] + 3.6, h[1] - 2.1, 1.4, 1.4, 0, Math.PI * 2, 12), 45, 0.6, { lw: 0.12 }); g.hatch(arc(h[0] + 3.6, h[1] - 2.1, 1.4, 1.4, 0, Math.PI * 2, 12), -45, 0.6, { lw: 0.12 }); },
    scythe(g, h) { g.limb([[h[0] - 1.2, h[1] + 3], [h[0] + 1.2, h[1] - 5]], 0.34, C.brown); g.shape([[h[0] + 1.2, h[1] - 5], [h[0] + 5, h[1] - 3.4], [h[0] + 1.4, h[1] - 4.3]], C.steel, 0.28); },
    rake(g, h) { g.limb([[h[0] - 1.6, h[1] + 4], [h[0] + 2.4, h[1] - 3.6]], 0.3, C.brown); g.line([[h[0] + 1.4, h[1] - 4.2], [h[0] + 3.4, h[1] - 3]], 0.4); for (let i = 0; i < 4; i++) g.line([[h[0] + 1.6 + i * 0.6, h[1] - 4 + i * 0.36], [h[0] + 1.9 + i * 0.6, h[1] - 3.1 + i * 0.36]], 0.2); },
    hoe(g, h) { g.limb([[h[0] - 2, h[1] - 3], [h[0] + 2.6, h[1] + 4]], 0.32, C.brown); g.shape([[h[0] + 2.4, h[1] + 3.6], [h[0] + 3.6, h[1] + 4.6], [h[0] + 2.6, h[1] + 5]], C.steelDk, 0.28); },
    fork(g, h) { g.limb([[h[0] - 1, h[1] + 3], [h[0] + 1.4, h[1] - 5]], 0.3, C.brown); g.line([[h[0] + 0.9, h[1] - 4.8], [h[0] + 1.1, h[1] - 6.6]], 0.25); g.line([[h[0] + 1.7, h[1] - 4.6], [h[0] + 2.1, h[1] - 6.4]], 0.25); },
    shovel(g, h) { g.limb([[h[0] - 0.6, h[1] - 2.4], [h[0] + 1, h[1] + 4]], 0.32, C.brown); g.shape([[h[0] + 0.4, h[1] + 4], [h[0] + 1.8, h[1] + 3.6], [h[0] + 2.2, h[1] + 5.8], [h[0] + 1.0, h[1] + 6.2]], C.steelDk, 0.28); },
    broom(g, h) { g.limb([[h[0] + 0.6, h[1] - 4], [h[0] - 0.8, h[1] + 4]], 0.3, C.brown); g.shape([[h[0] - 0.8, h[1] + 3.6], [h[0] - 2.4, h[1] + 6.8], [h[0] + 0.6, h[1] + 6.6]], C.straw, 0.28); },
    ladle(g, h) { g.line([[h[0], h[1]], [h[0] + 1.6, h[1] + 3.6]], 0.35, C.brown); g.ell(h[0] + 1.8, h[1] + 3.9, 0.6, 0.4, C.brown, 0.25); },
    cross(g, h, f) { g.limb([[h[0], 0.2], [h[0] + 0.1, -f.H * 1.2]], 0.32, C.brown); g.limb([[h[0] - 1.1, -f.H * 1.08], [h[0] + 1.2, -f.H * 1.08]], 0.32, C.gold); },
    bell(g, h) { g.line([[h[0], h[1]], [h[0], h[1] + 0.7]], 0.3); g.shape([[h[0] - 0.4, h[1] + 0.7], [h[0] + 0.4, h[1] + 0.7], [h[0] + 0.9, h[1] + 2.2], [h[0] - 0.9, h[1] + 2.2]], C.gold, 0.3); },
    lute(g, h) { g.ell(h[0] - 0.6, h[1] + 0.8, 1.5, 1.1, C.ochre, 0.32, -0.5); g.line([[h[0] + 0.2, h[1] + 0.2], [h[0] + 3.0, h[1] - 1.8]], 0.45, C.brown); },
    drum(g, h) { g.shape([[h[0] - 1.3, h[1] - 0.2], [h[0] + 1.3, h[1] - 0.2], [h[0] + 1.3, h[1] + 2.0], [h[0] - 1.3, h[1] + 2.0]], C.madder, 0.3); g.ell(h[0], h[1] - 0.2, 1.3, 0.4, C.bone, 0.3); },
    pole(g, h, f) { g.limb([[h[0] - 0.3, 0.2], [h[0] + 0.3, -f.H * 1.1]], 0.36, C.brown); },
    paddle(g, h) { g.limb([[h[0] - 2, h[1] - 3], [h[0] + 2.2, h[1] + 4.5]], 0.32, C.brown); g.shape([[h[0] + 1.6, h[1] + 3.4], [h[0] + 3.2, h[1] + 4.6], [h[0] + 2.8, h[1] + 6.4], [h[0] + 1.6, h[1] + 5.4]], C.brown, 0.28); },
    parasol(g, h) { g.line([[h[0], h[1] + 1], [h[0] - 0.4, h[1] - 6]], 0.3, C.brown); g.shape([[h[0] - 4.4, h[1] - 4.4], [h[0] - 0.4, h[1] - 7], [h[0] + 3.6, h[1] - 4.8]], col(h.c, C.madder), 0.35); },
    fan(g, h) { g.shape([[h[0], h[1]], [h[0] + 2.2, h[1] - 1.8], [h[0] + 2.6, h[1] - 0.2]], C.white, 0.28); },
    scroll(g, h) { g.shape([[h[0] - 0.2, h[1] - 0.4], [h[0] + 2.4, h[1] - 0.8], [h[0] + 2.5, h[1] + 0.6], [h[0] - 0.1, h[1] + 1.0]], C.bone, 0.28); g.ell(h[0] - 0.2, h[1] + 0.3, 0.3, 0.7, C.bone, 0.25); },
    cup(g, h) { g.shape([[h[0] - 0.5, h[1] - 1], [h[0] + 0.6, h[1] - 1], [h[0] + 0.4, h[1] + 0.3], [h[0] - 0.3, h[1] + 0.3]], C.gold, 0.28); },
    jug(g, h) { g.shape([[h[0] - 0.7, h[1] - 0.4], [h[0] + 0.7, h[1] - 0.4], [h[0] + 1.0, h[1] + 1.6], [h[0] - 1.0, h[1] + 1.6]], C.russet, 0.3); },
    sack(g, h) { g.shape([[h[0] - 1.2, h[1] - 0.6], [h[0] + 1.4, h[1] - 0.8], [h[0] + 1.8, h[1] + 2.6], [h[0] - 1.6, h[1] + 2.6]], C.wool, 0.32, true); },
    stick(g, h) { g.limb([[h[0], h[1]], [h[0] + 2.4, h[1] + 3.6]], 0.3, C.brown); },
    wand(g, h) { g.limb([[h[0], h[1]], [h[0] + 2.4, h[1] - 3]], 0.26, C.brown); g.dot(h[0] + 2.5, h[1] - 3.2, 0.45, '#F4E08A'); },
    rosary(g, h) { for (let i = 0; i < 5; i++) g.dot(h[0] + 0.2 * i, h[1] + 0.5 + i * 0.45, 0.22, C.brown); },
    bucket(g, h) { g.line([[h[0], h[1]], [h[0], h[1] + 0.8]], 0.25); g.shape([[h[0] - 1, h[1] + 0.8], [h[0] + 1, h[1] + 0.8], [h[0] + 0.8, h[1] + 2.6], [h[0] - 0.8, h[1] + 2.6]], C.dun, 0.3); },
    yoke(g, h, f) { const y = -f.H * 0.8; g.line([[-4.4, y + 0.6], [4.4, y + 0.6]], 0.45, C.brown); [-4, 4].forEach(x => { g.line([[x, y + 0.6], [x, y + 3.6]], 0.2); g.shape([[x - 1, y + 3.6], [x + 1, y + 3.6], [x + 0.8, y + 5.6], [x - 0.8, y + 5.6]], C.dun, 0.3); }); },
    chain(g, h) { for (let i = 0; i < 4; i++) g.ell(h[0] + 0.4 + i * 0.8, h[1] + 0.6 + i * 0.6, 0.45, 0.3, null, 0.22); },
    flower(g, h) { g.line([[h[0], h[1]], [h[0] + 0.6, h[1] - 2]], 0.2, C.green); g.dot(h[0] + 0.6, h[1] - 2.2, 0.5, C.rose); },
    cheese(g, h) { g.ell(h[0], h[1] + 0.5, 1.4, 1.4, C.ochreLt, 0.3); },
    cauldronspoon(g, h) { g.line([[h[0], h[1]], [h[0] + 1.4, h[1] + 3.6]], 0.35, C.brown); },
    skull(g, h) { g.ell(h[0] + 0.4, h[1] - 0.5, 0.9, 0.85, C.bone, 0.28); g.dot(h[0] + 0.7, h[1] - 0.6, 0.2); },
    hawk(g, h) { g.ell(h[0] + 0.2, h[1] - 1.4, 0.7, 1.1, C.brown, 0.28); g.ell(h[0] + 0.4, h[1] - 2.6, 0.5, 0.5, C.dun, 0.25); },
    sling(g, h) { g.line([[h[0], h[1]], [h[0] + 1.2, h[1] - 2.8]], 0.2); g.dot(h[0] + 1.2, h[1] - 2.9, 0.45, C.stone); },
    bundle(g, h) { g.limb([[h[0] - 3, h[1] + 1.4], [h[0] + 3, h[1] - 0.6]], 0.9, C.straw); },
    candle(g, h) { g.shape([[h[0] - 0.3, h[1] - 1.4], [h[0] + 0.3, h[1] - 1.4], [h[0] + 0.3, h[1] + 0.2], [h[0] - 0.3, h[1] + 0.2]], C.white, 0.2); g.dot(h[0], h[1] - 1.9, 0.35, '#F2C34A'); },
    katana(g, h) { g.line([[h[0], h[1]], [h[0] + 4.6, h[1] - 4.2]], 0.55, C.steelDk, true); g.line([[h[0] - 0.6, h[1] + 0.6], [h[0] + 0.5, h[1] - 0.4]], 0.6, C.black); },
    shieldhide(g, h) { g.ell(h[0] + 0.6, h[1] - 0.8, 1.6, 3.4, C.white, 0.35); g.ell(h[0] + 0.0, h[1] - 0.2, 0.7, 1.0, C.brown, 0); g.ell(h[0] + 1.1, h[1] - 2.2, 0.6, 0.8, C.black, 0); g.line([[h[0] + 0.6, h[1] - 4.2], [h[0] + 0.6, h[1] + 2.6]], 0.3, C.brown); },
    shield(g, h, f) { shield(g, h[0] + 0.9, h[1] - 0.6, 1.2, f.her); },
    roundshield(g, h, f) { roundShield(g, h[0] + 0.6, h[1] - 0.6, 2.3, f.her); },
  };

  // ------------------------------------------------------------------ headgear (head centre 0,0, radius r, facing +x)
  const HATS = {
    hood(g, r, c, f) { g.shape([[-r * 1.25, r * 1.6], [-r * 1.25, -r * 0.2], [-r * 0.7, -r * 1.25], [r * 0.4, -r * 1.35], [r * 1.18, -r * 0.4], [r * 0.9, r * 0.2], [r * 0.7, r * 1.2], [r * 1.5, r * 1.8], [-r * 1.6, r * 2.0]], c, 0.4, true); g.ell(r * 0.35, r * 0.1, r * 0.72, r * 0.86, f.skinC, 0.3); },
    chaperon(g, r, c, f) { g.limb([[-r * 0.6, -r * 0.9], [-r * 1.9, -r * 0.2], [-r * 2.4, r * 1.4]], 0.6, c, true); HATS.hood(g, r, c, f); },
    cowl(g, r, c, f) { g.shape([[-r * 1.3, r * 1.9], [-r * 1.35, -r * 0.3], [-r * 0.5, -r * 1.35], [r * 0.6, -r * 1.25], [r * 1.25, -r * 0.2], [r * 0.85, r * 0.4], [r * 0.9, r * 1.6]], c, 0.4, true); g.ell(r * 0.45, r * 0.15, r * 0.6, r * 0.8, f.skinC, 0.28); g.hatch([[-r * 1.3, r * 1.9], [-r * 1.35, -r * 0.3], [-r * 0.2, -r * 1.3], [-r * 0.1, r * 1.9]], 70, 0.55); },
    coif(g, r, c) { g.shape(arc(0, 0, r * 1.06, r * 1.06, Math.PI * 0.85, Math.PI * 2.05, 12).concat([[r * 0.2, r * 0.9]]), c || C.white, 0.32); },
    kerchief(g, r, c) { g.shape([[-r * 1.15, r * 1.5], [-r * 1.15, -r * 0.3], [-r * 0.5, -r * 1.2], [r * 0.6, -r * 1.15], [r * 1.05, -r * 0.4], [r * 0.6, -r * 0.5], [-r * 0.3, r * 0.2], [-r * 0.2, r * 1.6]], c || C.white, 0.35, true); },
    wimple(g, r, c, f) { g.shape([[-r * 1.4, r * 2.2], [-r * 1.3, -r * 0.6], [-r * 0.2, -r * 1.35], [r * 0.95, -r * 0.9], [r * 1.25, r * 0.1], [r * 1.0, r * 1.6], [r * 0.4, r * 2.3]], c || C.black, 0.38, true); g.shape([[-r * 0.2, r * 1.6], [-r * 0.2, -r * 0.7], [r * 0.6, -r * 0.95], [r * 1.05, -r * 0.1], [r * 0.9, r * 1.2], [r * 0.4, r * 1.7]], C.white, 0.3, true); g.ell(r * 0.45, r * 0.1, r * 0.55, r * 0.7, f.skinC, 0.25); },
    straw(g, r, c) { g.ell(0, -r * 0.55, r * 2.1, r * 0.55, c || C.straw, 0.35); g.shape([[-r * 0.85, -r * 0.6], [-r * 0.7, -r * 1.6], [r * 0.7, -r * 1.6], [r * 0.85, -r * 0.6]], c || C.straw, 0.35, true); g.line([[-r * 0.85, -r * 0.85], [r * 0.85, -r * 0.85]], 0.3, C.madder); },
    pilgrim(g, r, c) { g.shape([[-r * 2.0, -r * 0.6], [-r * 1.4, -r * 1.5], [-r * 0.7, -r * 0.95], [-r * 0.6, -r * 1.75], [r * 0.6, -r * 1.75], [r * 0.7, -r * 0.95], [r * 1.5, -r * 1.6], [r * 2.0, -r * 0.6]], c || C.black, 0.35, true); g.ell(r * 0.05, -r * 1.25, r * 0.38, r * 0.42, C.white, 0.22); },
    felt(g, r, c) { g.shape([[-r * 1.4, -r * 0.5], [-r * 0.9, -r * 0.65], [-r * 0.6, -r * 1.8], [r * 0.8, -r * 1.6], [r * 0.95, -r * 0.65], [r * 1.9, -r * 0.4], [r * 1.1, -r * 0.2], [-r * 1.1, -r * 0.2]], c || C.green, 0.35, true); g.line([[r * 0.2, -r * 1.6], [-r * 0.8, -r * 2.6]], 0.3, C.madder); },
    cap(g, r, c) { g.shape(arc(0, -r * 0.2, r * 1.05, r * 0.95, Math.PI, Math.PI * 2, 10).concat([[r * 1.1, -r * 0.1], [-r * 1.1, -r * 0.1]]), c || C.madder, 0.35); },
    phrygian(g, r, c) { g.shape([[-r * 1.05, -r * 0.1], [-r * 1.1, -r * 0.8], [-r * 0.3, -r * 1.7], [r * 1.0, -r * 1.75], [r * 1.5, -r * 1.2], [r * 0.9, -r * 1.1], [r * 1.1, -r * 0.1]], c || C.madder, 0.35, true); },
    kettle(g, r) { g.ell(0, -r * 0.5, r * 1.9, r * 0.45, C.steel, 0.35); g.shape(arc(0, -r * 0.5, r * 1.05, r * 1.2, Math.PI, Math.PI * 2, 10), C.steel, 0.35); g.line([[-r * 0.5, -r * 1.4], [r * 0.3, -r * 0.6]], 0.2, C.white); },
    bascinet(g, r) { g.shape([[-r * 1.1, r * 0.9], [-r * 1.15, -r * 0.4], [-r * 0.2, -r * 2.0], [r * 0.9, -r * 0.9], [r * 1.15, r * 0.9]], C.steel, 0.38, true); g.shape([[r * 0.25, -r * 0.5], [r * 1.9, r * 0.1], [r * 0.25, r * 0.8]], C.steel, 0.32); g.line([[r * 0.5, r * 0.05], [r * 1.4, r * 0.15]], 0.2); },
    greathelm(g, r) { g.shape([[-r * 1.15, r * 1.1], [-r * 1.15, -r * 0.8], [-r * 0.6, -r * 1.3], [r * 0.6, -r * 1.3], [r * 1.15, -r * 0.8], [r * 1.15, r * 1.1]], C.steel, 0.38); g.line([[r * 0.0, -r * 0.2], [r * 1.15, -r * 0.2]], 0.32); g.line([[r * 0.7, -r * 1.3], [r * 0.7, r * 1.1]], 0.25); },
    nasal(g, r) { g.shape(arc(0, -r * 0.2, r * 1.08, r * 1.15, Math.PI, Math.PI * 2, 10).concat([[r * 1.1, -r * 0.1], [-r * 1.1, -r * 0.1]]), C.steel, 0.35); g.line([[r * 0.85, -r * 0.2], [r * 1.0, r * 0.7]], 0.4, C.steelDk); },
    crown(g, r) { g.shape([[-r * 1.0, -r * 0.6], [-r * 1.05, -r * 1.7], [-r * 0.5, -r * 1.15], [0, -r * 1.85], [r * 0.5, -r * 1.15], [r * 1.05, -r * 1.7], [r * 1.0, -r * 0.6]], C.gold, 0.32); },
    witch(g, r, c) { g.ell(0, -r * 0.6, r * 2.0, r * 0.45, c || C.black, 0.35); g.shape([[-r * 0.9, -r * 0.7], [-r * 0.2, -r * 2.6], [r * 0.9, -r * 3.9], [r * 0.6, -r * 2.4], [r * 0.95, -r * 0.7]], c || C.black, 0.35, true); },
    turban(g, r, c) { g.shape([[-r * 1.15, -r * 0.1], [-r * 1.25, -r * 0.9], [-r * 0.6, -r * 1.75], [r * 0.6, -r * 1.8], [r * 1.2, -r * 1.0], [r * 1.1, -r * 0.1]], c || C.white, 0.35, true); g.line([[-r * 1.1, -r * 0.7], [r * 1.0, -r * 1.3]], 0.25); g.line([[-r * 0.9, -r * 1.25], [r * 0.6, -r * 1.65]], 0.22); },
    veil(g, r, c, f) { g.shape([[-r * 1.3, r * 2.4], [-r * 1.3, -r * 0.4], [-r * 0.4, -r * 1.3], [r * 0.8, -r * 1.1], [r * 1.2, -r * 0.2], [r * 0.7, -r * 0.2], [r * 0.9, r * 2.0]], c || C.indigo, 0.38, true); g.ell(r * 0.4, r * 0.15, r * 0.6, r * 0.75, f.skinC, 0.28); },
    tagelmust(g, r, c, f) { g.shape([[-r * 1.3, r * 1.6], [-r * 1.3, -r * 0.5], [-r * 0.6, -r * 1.6], [r * 0.7, -r * 1.55], [r * 1.25, -r * 0.6], [r * 1.25, r * 1.4]], c || C.indigo, 0.38, true); g.shape([[r * 0.25, -r * 0.45], [r * 1.2, -r * 0.45], [r * 1.2, r * 0.05], [r * 0.25, r * 0.05]], f.skinC, 0.2); g.dot(r * 0.75, -r * 0.2, r * 0.13); },
    kasa(g, r, c) { g.shape([[-r * 2.4, -r * 0.2], [0, -r * 1.9], [r * 2.4, -r * 0.2], [0, -r * 0.6]], c || C.straw, 0.35); g.line([[-r * 1.2, -r * 0.95], [r * 1.2, -r * 0.95]], 0.18); },
    conical(g, r, c) { g.shape([[-r * 2.3, -r * 0.4], [0, -r * 2.5], [r * 2.3, -r * 0.4]], c || C.straw, 0.35); g.line([[-r * 1.1, -r * 1.4], [r * 1.1, -r * 1.4]], 0.18); },
    jingasa(g, r, c) { g.shape([[-r * 2.0, -r * 0.4], [-r * 0.9, -r * 1.3], [r * 0.9, -r * 1.3], [r * 2.0, -r * 0.4]], c || C.black, 0.35, true); g.dot(0, -r * 1.3, r * 0.2, C.gold); },
    kabuto(g, r) { g.shape(arc(0, -r * 0.3, r * 1.1, r * 1.15, Math.PI, Math.PI * 2, 10).concat([[r * 1.1, -r * 0.2], [-r * 1.1, -r * 0.2]]), C.black, 0.35); g.shape([[-r * 1.2, -r * 0.4], [-r * 2.0, r * 0.7], [-r * 1.0, r * 0.9]], C.black, 0.3); g.line(arc(r * 0.1, -r * 1.6, r * 1.1, r * 0.9, Math.PI * 0.95, Math.PI * 2.05, 8), 0.5, C.gold); g.dot(r * 0.1, -r * 1.25, r * 0.22, C.gold); },
    hood_ninja(g, r, c, f) { g.shape(arc(0, 0, r * 1.15, r * 1.15, 0, Math.PI * 2, 14), c || C.black, 0.35); g.shape([[r * 0.15, -r * 0.4], [r * 1.12, -r * 0.4], [r * 1.12, r * 0.05], [r * 0.15, r * 0.05]], f.skinC, 0.15); g.dot(r * 0.75, -r * 0.18, r * 0.13); },
    futou(g, r, c) { g.shape([[-r * 0.95, -r * 0.4], [-r * 0.9, -r * 1.7], [r * 0.9, -r * 1.7], [r * 0.95, -r * 0.4]], c || C.black, 0.35); g.line([[-r * 0.9, -r * 1.3], [-r * 2.5, -r * 1.2]], 0.35); g.line([[r * 0.9, -r * 1.3], [r * 2.4, -r * 1.2]], 0.35); },
    topknot(g, r, c) { g.shape(arc(0, -r * 0.1, r * 1.04, r * 1.0, Math.PI * 0.95, Math.PI * 2.05, 10), c || HAIR.black, 0.3); g.ell(r * 0.05, -r * 1.2, r * 0.4, r * 0.35, c || HAIR.black, 0.3); },
    fur(g, r, c) { g.shape([[-r * 1.25, -r * 0.2], [-r * 1.1, -r * 1.4], [r * 1.1, -r * 1.4], [r * 1.25, -r * 0.2]], c || C.dun, 0.38, true); for (let i = 0; i < 4; i++) g.line([[-r + i * r * 0.62, -r * 1.3], [-r + i * r * 0.62 + 0.2, -r * 0.4]], 0.15); },
    mongol(g, r, c) { g.shape([[-r * 1.4, r * 0.4], [-r * 1.3, -r * 0.5], [-r * 0.4, -r * 2.0], [r * 0.2, -r * 2.1], [r * 1.1, -r * 0.6], [r * 1.35, -r * 0.2]], c || C.madder, 0.35, true); g.shape([[-r * 1.4, -r * 0.3], [r * 1.35, -r * 0.3], [r * 1.25, r * 0.15], [-r * 1.5, r * 0.6]], C.dun, 0.3); },
    feather(g, r, c) { g.line([[-r * 1.05, -r * 0.4], [r * 1.05, -r * 0.4]], 0.6, c || C.madder); g.shape([[-r * 0.7, -r * 0.6], [-r * 1.6, -r * 3.0], [-r * 0.3, -r * 1.0]], C.white, 0.25); },
    chullo(g, r, c) { g.shape([[-r * 1.15, r * 0.9], [-r * 1.2, -r * 0.4], [-r * 0.4, -r * 1.45], [r * 0.6, -r * 1.35], [r * 1.15, -r * 0.4], [r * 0.9, -r * 0.1], [-r * 0.5, -r * 0.1], [-r * 0.6, r * 1.0]], c || C.madder, 0.35, true); g.line([[-r * 1.0, -r * 0.6], [r * 0.9, -r * 0.6]], 0.3, C.ochreLt); g.dot(-r * 0.1, -r * 1.5, r * 0.25, C.ochreLt); },
    keffiyeh(g, r, c, f) { g.shape([[-r * 1.45, r * 2.0], [-r * 1.3, -r * 0.5], [-r * 0.4, -r * 1.35], [r * 0.7, -r * 1.25], [r * 1.25, -r * 0.4], [r * 0.7, -r * 0.4], [r * 0.6, r * 1.2]], c || C.white, 0.36, true); g.ell(r * 0.5, r * 0.1, r * 0.55, r * 0.75, f.skinC, 0.25); g.line([[-r * 1.1, -r * 0.75], [r * 0.95, -r * 0.95]], 0.45, C.black); },
    headwrap(g, r, c) { g.shape([[-r * 1.15, -r * 0.15], [-r * 1.3, -r * 1.2], [-r * 0.4, -r * 2.0], [r * 0.8, -r * 1.7], [r * 1.15, -r * 0.6], [r * 1.05, -r * 0.15]], c || C.saffron, 0.35, true); g.line([[-r * 1.1, -r * 0.7], [r * 1.1, -r * 1.1]], 0.2); },
    plume(g, r) { HATS.kettle(g, r); g.shape([[-r * 0.2, -r * 1.6], [-r * 2.2, -r * 3.0], [-r * 0.6, -r * 1.3]], C.madder, 0.25); },
    hornhelm(g, r) { g.shape(arc(0, -r * 0.2, r * 1.08, r * 1.15, Math.PI, Math.PI * 2, 10).concat([[r * 1.1, -r * 0.1], [-r * 1.1, -r * 0.1]]), C.steelDk, 0.35); },
    mitre(g, r) { g.shape([[-r * 0.95, -r * 0.5], [-r * 0.95, -r * 2.0], [0, -r * 3.0], [r * 0.95, -r * 2.0], [r * 0.95, -r * 0.5]], C.white, 0.35); g.line([[0, -r * 0.5], [0, -r * 2.9]], 0.3, C.gold); },
    jester(g, r, c) { g.shape([[-r * 1.1, -r * 0.1], [-r * 2.4, -r * 1.6], [-r * 0.2, -r * 1.5], [r * 0.4, -r * 2.6], [r * 1.1, -r * 0.1]], c || C.madder, 0.33, true); g.dot(-r * 2.4, -r * 1.7, r * 0.3, C.gold); g.dot(r * 0.4, -r * 2.7, r * 0.3, C.gold); },
    tonsure(g, r, c, f) { g.shape(arc(-r * 0.1, -r * 0.05, r * 1.05, r * 1.0, Math.PI * 0.75, Math.PI * 1.25, 6).concat(arc(-r * 0.1, -r * 0.05, r * 0.7, r * 0.6, Math.PI * 1.25, Math.PI * 0.75, 6)), col(f.hair, HAIR.brown), 0.25); },
    gat(g, r) { g.ell(0, -r * 0.75, r * 2.2, r * 0.4, 'rgba(40,32,28,0.85)', 0.3); g.shape([[-r * 0.75, -r * 0.8], [-r * 0.7, -r * 2.3], [r * 0.7, -r * 2.3], [r * 0.75, -r * 0.8]], 'rgba(40,32,28,0.85)', 0.3); },
    wreath(g, r) { for (let a = Math.PI * 0.9; a < Math.PI * 2.1; a += 0.45) g.ell(Math.cos(a) * r, -r * 0.1 + Math.sin(a) * r * 0.9, r * 0.35, r * 0.2, C.leaf, 0.15, a); },
  };

  // ------------------------------------------------------------------ a person: layered body, garments, head, props
  // f: { h, pose, skin, hair, beard, garb ('tunic','gown','robe','habit','armour','kirtle','coat','loin','sari','kimono','deel','poncho','none'),
  //      c1 (main garment), c2 (hose or underlayer), c3 (cloak/hood), cloak, hat, hatc, props:[front, back], arms:[front, back], belt, her, apron }
  const ARMS = {   // elbow and hand relative to the shoulder (torso frame, +x forward, +y down)
    down: [[0.25, 2.7], [0.45, 5.2]], fwd: [[1.5, 2.6], [3.2, 3.3]], hold: [[1.0, 2.8], [2.4, 4.0]], up: [[1.4, -2.1], [1.9, -4.8]],
    out: [[2.3, 0.9], [4.6, 0.6]], hip: [[1.9, 2.4], [0.9, 4.4]], back: [[-1.2, 2.6], [-2.1, 4.9]], chest: [[1.3, 3.0], [1.7, 1.9]],
    reach: [[2.0, -0.6], [3.9, -2.4]], raise: [[0.5, -2.6], [0.4, -5.4]], pray: [[1.4, 2.6], [2.1, 1.1]], low: [[1.0, 2.8], [2.6, 5.0]],
    row: [[2.0, 2.0], [3.8, 3.4]], wave: [[2.2, -1.2], [2.4, -4.0]], point: [[2.4, 0.4], [5.0, -0.6]], carry: [[-0.4, -1.8], [0.4, -3.6]],
    bow: [[2.6, 0.2], [5.2, -0.2]], draw: [[-1.4, 0.8], [-0.2, 0.6]], shade: [[1.6, -0.4], [1.3, -2.4]], fold: [[1.2, 2.6], [-0.2, 2.6]],
  };
  function person(g, f) {
    const H = f.h || 18, S = H / 18;
    f.H = H;
    const pose = f.pose || 'stand';
    const skinC = col(f.skin, SKIN.fair); f.skinC = skinC;
    const garb = f.garb || 'tunic';
    const c1 = col(f.c1, C.madder), c2 = col(f.c2, C.woad), c3 = col(f.c3, C.ochre);
    const long = ['gown', 'robe', 'habit', 'kirtle', 'kimono', 'deel', 'sari', 'thobe', 'kaftan'].includes(garb);
    // joints (ground y = 0, facing +x)
    let hip = [0, -0.47 * H], lean = 0, feet, knees;
    const legLen = 0.47 * H;
    if (pose === 'walk' || pose === 'run') {
      const st = pose === 'run' ? 3.2 * S : 2.3 * S;
      feet = [[st, 0], [-st * 0.9, 0]]; knees = [[st * 0.6, hip[1] * 0.48], [-st * 0.25, hip[1] * 0.5]];
      lean = pose === 'run' ? 0.18 : 0.05;
      if (pose === 'run') hip = [0, -0.44 * H];
    } else if (pose === 'sit') {
      hip = [0, -1.5 * S]; feet = [[4.8 * S, 0], [4.2 * S, 0]]; knees = [[2.6 * S, -3.4 * S], [2.2 * S, -3.0 * S]]; lean = -0.05;
    } else if (pose === 'sitbank') {   // sitting on a ledge, legs hanging (bridge, wall)
      hip = [0, -1.0 * S]; feet = [[2.0 * S, 5.0 * S], [1.4 * S, 5.2 * S]]; knees = [[2.6 * S, -0.6 * S], [2.2 * S, -0.4 * S]];
    } else if (pose === 'kneel') {
      hip = [0, -0.3 * H]; feet = [[2.4 * S, 0], [-3.2 * S, 0]]; knees = [[2.6 * S, -3.6 * S], [-0.6 * S, 0]];
    } else if (pose === 'bend') {
      hip = [0, -0.45 * H]; feet = [[1.6 * S, 0], [-1.6 * S, 0]]; knees = [[1.2 * S, -4 * S], [-1.0 * S, -4 * S]]; lean = 0.55;
    } else if (pose === 'crouch') {
      hip = [-0.6 * S, -0.26 * H]; feet = [[1.8 * S, 0], [-1.6 * S, 0]]; knees = [[2.6 * S, -3.6 * S], [0.6 * S, -3.0 * S]]; lean = 0.25;
    } else if (pose === 'ride') {
      hip = f.hip || [0, -0.47 * H]; feet = [[hip[0] + 0.9 * S, hip[1] + 5.6 * S], [hip[0] + 0.5 * S, hip[1] + 5.2 * S]]; knees = [[hip[0] + 2.0 * S, hip[1] + 2.6 * S], [hip[0] + 1.6 * S, hip[1] + 2.3 * S]];
    } else if (pose === 'row' || pose === 'boat') {
      hip = f.hip || [0, -1.2 * S]; feet = [[hip[0] + 3.6 * S, hip[1] + 1.6 * S], [hip[0] + 3.2 * S, hip[1] + 1.8 * S]]; knees = [[hip[0] + 2.2 * S, hip[1] - 1.8 * S], [hip[0] + 1.8 * S, hip[1] - 1.6 * S]]; lean = pose === 'row' ? 0.12 : 0;
    } else if (pose === 'lie') {
      return lyingPerson(g, f, H, skinC, c1, c2, c3);
    } else { feet = [[0.9 * S, 0], [-0.9 * S, 0]]; knees = [[0.7 * S, hip[1] * 0.5], [-0.6 * S, hip[1] * 0.5]]; }
    if (f.lean !== undefined) lean = f.lean;
    const torsoLen = 0.31 * H, sh = [hip[0], hip[1] - torsoLen];
    const rot = (p) => { const dx = p[0] - hip[0], dy = p[1] - hip[1], c = Math.cos(lean), s = Math.sin(lean); return [hip[0] + dx * c - dy * s, hip[1] + dx * s + dy * c]; };
    const shW = (f.broad ? (f.broad > 1 ? 3.0 : 2.4) : 1.85) * S, waistW = (f.broad ? (f.broad > 1 ? 2.6 : 2.0) : 1.35) * S;
    const shF = rot([sh[0] + 0.55 * S, sh[1] + 0.3 * S]), shB = rot([sh[0] - 0.75 * S, sh[1] + 0.35 * S]);
    const headC = rot([sh[0] + 0.35 * S, sh[1] - 1.75 * S]), hr = 1.36 * S * (f.headScale || 1);
    const arms = f.arms || [pose === 'walk' ? 'fwd' : 'down', pose === 'walk' ? 'back' : 'down'];
    const armPts = (which, sp) => { const a = ARMS[which] || ARMS.down; return [sp, rotRel(sp, a[0]), rotRel(sp, a[1])]; };
    function rotRel(sp, d) { const c = Math.cos(lean), s = Math.sin(lean); return [sp[0] + (d[0] * c - d[1] * s) * S, sp[1] + (d[0] * s + d[1] * c) * S]; }
    const bare = garb === 'loin' || garb === 'bare';
    const sleeve = col(f.sleeve, garb === 'armour' ? C.steel : bare ? skinC : c1);
    const sleeveB = shadeOf(sleeve);
    const hand = [armPts(arms[0], shF), armPts(arms[1], shB)];
    // ---- back props (behind everything)
    if (f.backProp && PROPS[f.backProp]) PROPS[f.backProp](g, hand[1][2], f);
    // ---- cloak behind the body
    if (f.cloak) {
      const hemY = long ? -0.6 * S : -0.36 * H, wind = (f.wind || (pose === 'walk' || pose === 'run' ? 1.4 : 0.5)) * S;
      const cl = [rot([sh[0] - 1.1 * S, sh[1] - 0.2 * S]), rot([sh[0] + 1.2 * S, sh[1] - 0.1 * S]), [hip[0] + 1.4 * S, hip[1] + 0.6 * S], [hip[0] + 1.2 * S, f.cloak === 'short' ? hip[1] + 1.2 * S : hemY], [hip[0] - 2.4 * S - wind, (f.cloak === 'short' ? hip[1] + 1.6 * S : hemY) + 0.4 * S], [hip[0] - 2.6 * S - wind * 0.7, hip[1] - 1 * S]];
      g.shape(cl, c3, 0.42, true);
      g.hatch(cl, 65, 0.7 * S, { smooth: true, side: -1, cut: hip[0] - 0.8 * S });
    }
    // ---- back arm
    limbArm(g, hand[1], sleeveB, skinC, S, f.gloves);
    // ---- legs
    const hose = col(f.hose, garb === 'armour' ? C.steel : bare ? skinC : c2);
    const legW = (f.broad ? (f.broad > 1 ? 1.6 : 1.35) : 1.05) * S;
    const legB = [[hip[0] - 0.3 * S, hip[1]], knees[1], feet[1]], legF = [[hip[0] + 0.3 * S, hip[1]], knees[0], feet[0]];
    if (!long || pose === 'ride' || pose === 'sit' || pose === 'kneel' || pose === 'row' || pose === 'sitbank') {
      g.limb(legB, legW, shadeOf(hose)); shoe(g, feet[1], S, f.bare); g.limb(legF, legW, hose); shoe(g, feet[0], S, f.bare);
    } else { shoe(g, [feet[1][0] * 0.6, 0], S, f.bare); shoe(g, [feet[0][0] * 0.7 + 0.4 * S, 0], S, f.bare); }
    // ---- garment
    const wy = hip[1] - 0.3 * S;
    const bod = [rot([sh[0] - shW * 0.95, sh[1]]), rot([sh[0] + shW * 0.7, sh[1] - 0.1 * S]), rot([hip[0] + waistW, wy]), rot([hip[0] - waistW * 1.05, wy])];
    let skirt = null;
    const swing = pose === 'walk' ? -0.5 * S : pose === 'run' ? -1.0 * S : 0;
    if (pose === 'sit' || pose === 'row' || pose === 'boat' || pose === 'sitbank') {
      skirt = long ? [[hip[0] - waistW - 0.3 * S, wy], [hip[0] + waistW, wy], [knees[0][0] + 0.6 * S, knees[0][1] - 0.4 * S], [feet[0][0] - 0.2 * S, feet[0][1] - 0.6 * S], [hip[0] - 1.4 * S, hip[1] + 1.2 * S]]
        : [[hip[0] - waistW - 0.2 * S, wy], [hip[0] + waistW, wy], [knees[0][0] - 0.2 * S, knees[0][1] - 0.2 * S], [hip[0] + 0.6 * S, hip[1] + 1.0 * S], [hip[0] - 1.6 * S, hip[1] + 0.9 * S]];
    } else if (pose === 'ride') {
      skirt = [[hip[0] - waistW - 0.3 * S, wy], [hip[0] + waistW + 0.1 * S, wy], [knees[0][0] + 0.2 * S, knees[0][1] + (long ? 2.2 : 0.2) * S], [hip[0] - 2.2 * S, hip[1] + (long ? 3.4 : 1.6) * S]];
    } else if (pose === 'kneel') {
      skirt = [[hip[0] - waistW - 0.2 * S, wy], [hip[0] + waistW, wy], [knees[0][0] + 0.4 * S, knees[0][1] + 0.2 * S], [knees[1][0] - 1.6 * S, (long ? -0.2 : -1.8) * S]];
    } else if (pose !== 'none') {
      const hemY = long ? -0.5 * S : bare ? -0.6 * H : -0.36 * H, hw = long ? (garb === 'kimono' ? 2.4 : 3.1) * S : bare ? 1.8 * S : 2.4 * S;
      skirt = [[hip[0] - waistW - 0.1 * S, wy], [hip[0] + waistW, wy], [hip[0] + hw * 0.85 + swing * 0.3, hemY], [hip[0] + swing - hw, hemY + 0.15 * S]];
      if (long) skirt.splice(3, 0, [hip[0] + swing * 0.6, hemY + 0.45 * S]);
    }
    const gc = garb === 'armour' ? col(f.c1, C.madder) : c1;   // armour shows a surcoat in the heraldic colour
    if (garb === 'armour') g.shape([rot([sh[0] - shW, sh[1] - 0.1 * S]), rot([sh[0] + shW * 0.75, sh[1] - 0.2 * S]), rot([hip[0] + waistW + 0.2 * S, wy]), rot([hip[0] - waistW - 0.2 * S, wy])], C.steel, 0.4);
    if (skirt) { g.shape(skirt, shadeOf(gc, 0.92), 0.42, false); g.hatch(skirt, 70, 0.62 * S, { side: -1, cut: hip[0] - 0.2 * S }); if (long && pose !== 'sit' && pose !== 'ride') { g.line([lerp(skirt[0], skirt[1], 0.45), lerp(skirt[skirt.length - 1], skirt[2], 0.45)], 0.22); } }
    if (garb === 'armour') {
      const sc = [rot([sh[0] - shW * 0.75, sh[1] + 0.6 * S]), rot([sh[0] + shW * 0.55, sh[1] + 0.5 * S]), rot([hip[0] + waistW, wy]), rot([hip[0] - waistW, wy])];
      g.shape(sc, gc, 0.38); if (f.her) charge(g, sc, f.her, rot([sh[0], sh[1] + 2.4 * S])[0], rot([sh[0], sh[1] + 2.4 * S])[1], 0.9);
    } else g.shape(bod, bare ? skinC : gc, 0.42);
    g.hatch(bod, 65, 0.6 * S, { side: -1, cut: hip[0] - 0.5 * S });
    if (f.furry) { const fc = shadeOf(col(f.c1, C.brown), 0.7); for (let k = 0; k < 16; k++) { const t = k / 16, px = hip[0] - 1.4 * S + (k * 7 % 5) * 0.65 * S, py = sh[1] + 0.8 * S + t * (hip[1] - sh[1] + 0.47 * H * 0.8); g.line([[px, py], [px - 0.5 * S, py + 0.9 * S]], 0.22, fc); } }
    if (f.bands) { const bc = col(f.bands, C.white); [0.35, 0.55].forEach(t => { const p = lerp(legF[0], legF[1], t + 0.3); g.line([[p[0] - 0.7 * S, p[1]], [p[0] + 0.7 * S, p[1]]], 0.45 * S, bc); }); }
    if (f.sash) g.line([rot([sh[0] - shW * 0.8, sh[1] + 0.2 * S]), rot([hip[0] + waistW, wy - 0.4 * S])], 0.55 * S, col(f.sash, C.madder));
    if (f.apron) { const ap = [[hip[0] + 0.1 * S, wy], [hip[0] + waistW + 0.3 * S, wy], [hip[0] + 1.9 * S, long ? -2.4 * S : -0.4 * H], [hip[0] + 0.3 * S, long ? -2.2 * S : -0.4 * H]]; g.shape(ap, col(f.apron, C.white), 0.32); }
    if (garb === 'sari') {
      const pal = [rot([sh[0] - shW * 0.9, sh[1] - 0.2 * S]), rot([sh[0] + shW * 0.5, sh[1] - 0.3 * S]), rot([hip[0] + waistW + 0.3 * S, wy - 0.4 * S]), rot([hip[0] + waistW - 0.4 * S, wy + 0.6 * S]), rot([sh[0] - shW * 0.2, sh[1] + 1.4 * S])];
      g.shape([rot([sh[0] - shW * 0.9, sh[1] - 0.2 * S]), rot([sh[0] - shW * 0.2, sh[1] + 1.2 * S]), [hip[0] - 2.6 * S, hip[1] + 2.6 * S], [hip[0] - 3.2 * S, hip[1] + 1.2 * S]], c3, 0.35);
      g.shape(pal, c3, 0.35); g.line([pal[0], pal[2]], 0.35 * S, col(f.border || 'gold'));
      if (skirt) for (let k = 0; k < 3; k++) g.line([[hip[0] + (0.2 + k * 0.5) * S, wy + 0.4 * S], [hip[0] + (0.4 + k * 0.7) * S, -0.8 * S]], 0.2);
    }
    if (garb === 'poncho') g.shape([rot([sh[0] - shW - 0.6 * S, sh[1] + 0.2 * S]), rot([sh[0] + 0.2 * S, sh[1] - 0.5 * S]), rot([sh[0] + shW + 0.8 * S, sh[1] + 0.4 * S]), rot([hip[0] + 2.2 * S, hip[1] - 1.0 * S]), rot([hip[0] - 2.6 * S, hip[1] - 0.8 * S])], c3, 0.38);
    if (f.stripe) g.line([rot([sh[0] + 0.1 * S, sh[1] + 0.2 * S]), rot([hip[0] + 0.3 * S, wy])], 0.45 * S, col(f.stripe));
    if (f.belt !== false && garb !== 'robe' && garb !== 'sari' && garb !== 'poncho') g.line([rot([hip[0] - waistW - 0.1 * S, wy - 0.1 * S]), rot([hip[0] + waistW + 0.1 * S, wy - 0.1 * S])], 0.5 * S, col(f.belt, C.brown));
    if (garb === 'habit' || f.cord) g.line([rot([hip[0] + 0.4 * S, wy]), [hip[0] + 0.8 * S, wy + 4 * S]], 0.25, C.white);
    if (f.pack) { const pc = rot([sh[0] - 2.0 * S, sh[1] + 2.2 * S]); g.shape([[pc[0] - 1.4 * S, pc[1] - 2.2 * S], [pc[0] + 1.1 * S, pc[1] - 2.4 * S], [pc[0] + 1.3 * S, pc[1] + 2.0 * S], [pc[0] - 1.6 * S, pc[1] + 2.2 * S]], col(f.pack, C.wool), 0.38, true); }
    // ---- head
    const hatC = col(f.hatc, c3);
    const hair = col(f.hair, HAIR.brown);
    g.save(); g.x.translate(headC[0], headC[1]);
    if (f.headless) { g.restore(); g.save(); g.x.translate(headC[0], headC[1] + hr * 1.4); g.ell(0, 0, hr * 0.7, hr * 0.3, C.madderDk, 0.3); g.restore(); g.save(); g.x.translate(-9999, -9999); }
    if (f.hairLong) g.shape([[-hr * 1.0, -hr * 0.4], [-hr * 1.4, hr * 2.0], [hr * 0.1, hr * 1.6], [hr * 0.2, hr * 0.2]], hair, 0.3, true);
    const hoodish = ['hood', 'chaperon', 'cowl', 'wimple', 'veil', 'tagelmust', 'keffiyeh', 'hood_ninja'].includes(f.hat);
    if (!hoodish) {
      g.ell(0, 0, hr, hr * 1.05, skinC, 0.38);
      g.shape([[hr * 0.95, -hr * 0.1], [hr * 1.35, hr * 0.25], [hr * 0.95, hr * 0.4]], skinC, 0.28);   // nose
      if (!f.hat || ['straw', 'pilgrim', 'felt', 'kettle', 'cap', 'crown', 'witch', 'turban', 'kasa', 'conical', 'jingasa', 'futou', 'fur', 'feather', 'plume', 'wreath', 'headwrap', 'mitre', 'phrygian', 'nasal', 'jester', 'chullo', 'mongol', 'coif', 'kerchief', 'hornhelm', 'topknot'].includes(f.hat)) {
        if (!f.bald && (!['coif', 'kerchief', 'topknot', 'chullo', 'nasal', 'hornhelm', 'cap', 'phrygian', 'fur', 'mongol', 'jester', 'headwrap', 'turban'].includes(f.hat) || f.hat === undefined))
          g.shape(arc(-hr * 0.1, -hr * 0.12, hr * 1.04, hr * 1.0, Math.PI * 0.82, Math.PI * 1.9, 8).concat([[-hr * 0.2, -hr * 0.2]]), hair, 0.28);
      }
      g.dot(hr * 0.5, -hr * 0.12, 0.24 * S);
      if (f.beard) g.shape([[hr * 0.95, hr * 0.45], [hr * 0.6, hr * (f.beard === 'long' ? 2.4 : 1.4)], [-hr * 0.2, hr * 1.1], [-hr * 0.35, hr * 0.5]], col(f.beardc, hair), 0.28, true);
      if (f.tusks) { g.shape([[hr * 0.75, hr * 0.55], [hr * 0.95, -hr * 0.05], [hr * 1.05, hr * 0.6]], C.bone, 0.2); }
      if (f.ears) g.shape([[-hr * 0.2, -hr * 0.3], [-hr * 1.2, -hr * 1.5], [-hr * 0.6, hr * 0.1]], skinC, 0.25);
    }
    if (f.hat && HATS[f.hat]) HATS[f.hat](g, hr, hatC, f);
    if (f.antlers) { [-1, 1].forEach(k => { const b = [k * hr * 0.4, -hr * 0.9]; g.line([b, [b[0] + k * 0.6, b[1] - 2.2], [b[0] + k * 0.2, b[1] - 4.2]], 0.42, C.brown); g.line([[b[0] + k * 0.45, b[1] - 1.4], [b[0] + k * 1.8, b[1] - 2.2]], 0.32, C.brown); g.line([[b[0] + k * 0.5, b[1] - 2.8], [b[0] + k * 1.7, b[1] - 3.8]], 0.3, C.brown); }); }
    if (hoodish) { g.dot(hr * 0.55, -hr * 0.05, 0.22 * S); if (f.beard) g.shape([[hr * 0.95, hr * 0.45], [hr * 0.6, hr * 1.4], [-hr * 0.1, hr * 0.9]], col(f.beardc, hair), 0.25, true); }
    g.restore();
    // ---- front arm and props
    if (f.prop === 'shieldhide' || f.prop === 'shield' || f.prop === 'roundshield') { limbArm(g, hand[0], sleeve, skinC, S, f.gloves); PROPS[f.prop](g, hand[0][2], f); }
    else {
      if (f.prop && PROPS[f.prop] && !f.propFront) PROPS[f.prop](g, hand[0][2], f);
      limbArm(g, hand[0], sleeve, skinC, S, f.gloves);
      if (f.prop && PROPS[f.prop] && f.propFront) PROPS[f.prop](g, hand[0][2], f);
    }
    if (f.prop2 && PROPS[f.prop2]) PROPS[f.prop2](g, hand[1][2], f);
    return { hand, headC, hip, sh: rot(sh) };
  }
  function limbArm(g, pts, c, skin, S, gloves) {
    g.limb(pts, 0.95 * S, c, true);
    g.dot(pts[2][0], pts[2][1], 0.58 * S, INK); g.dot(pts[2][0], pts[2][1], 0.42 * S, gloves ? col(gloves) : skin);
  }
  function shoe(g, p, S, bare) { g.ell(p[0] + 0.35 * S, p[1] - 0.25 * S, 0.85 * S, 0.42 * S, bare ? null : INK, bare ? 0.25 : 0); }
  function shadeOf(hex, k) {
    k = k || 0.82; if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(gg) << 8) + f(b)).toString(16).slice(1);
  }
  function lyingPerson(g, f, H, skinC, c1, c2, c3) {
    const S = H / 18, y = -1.4 * S;
    if (f.cloak) g.shape([[-8.2 * S, y + 1.4 * S], [-8.6 * S, y - 1.6 * S], [3 * S, y - 2.3 * S], [5.2 * S, y + 1.4 * S]], c3, 0.4, true);
    g.shape([[-7.6 * S, y + 1 * S], [-7.8 * S, y - 1.2 * S], [-2 * S, y - 1.6 * S], [3.6 * S, y - 1.4 * S], [4 * S, y + 1 * S]], c1, 0.42, true);
    g.hatch([[-7.6 * S, y + 1 * S], [-7.8 * S, y - 0.2 * S], [4 * S, y - 0.2 * S], [4 * S, y + 1 * S]], 70, 0.6 * S);
    g.limb([[3.4 * S, y - 0.2 * S], [8 * S, y + 0.1 * S]], 1.05 * S, c2);
    g.ell(8.6 * S, y - 0.2 * S, 0.5 * S, 0.9 * S, INK, 0);
    g.ell(-9.3 * S, y - 0.6 * S, 1.36 * S, 1.3 * S, skinC, 0.38);
    g.shape(arc(-9.4 * S, y - 0.6 * S, 1.42 * S, 1.36 * S, Math.PI * 0.5, Math.PI * 1.5, 8), col(f.hair, HAIR.brown), 0.3);
    g.line([[-9.0 * S, y - 1.0 * S], [-8.3 * S, y - 1.0 * S]], 0.25);
    if (f.hat === 'straw') { g.ell(-8.6 * S, y - 2.6 * S, 2.2 * S, 0.6 * S, C.straw, 0.32, -0.3); }
    if (f.zzz !== false) { g.x.font = `italic ${2.6 * S}px Georgia, serif`; g.x.fillStyle = INK; g.x.fillText('z', -6.4 * S, y - 3.4 * S); g.x.font = `italic ${1.9 * S}px Georgia, serif`; g.x.fillText('z', -4.9 * S, y - 5.2 * S); }
    return {};
  }

  // ------------------------------------------------------------------ four-legged beasts (facing +x, ground 0)
  // body length L, depth Hb, leg length, neck (length, angle in degrees above horizontal), head (length, depth, angle below horizontal)
  const BEAST = {
    horse: { L: 10.5, Hb: 4.4, leg: 6.0, nl: 5.0, na: 58, hl: 3.8, hd: 1.7, ha: 52, ear: 1.0, mane: 1, tail: 'long', c: 'bay', hoof: 1 },
    pony: { L: 8.4, Hb: 4.1, leg: 4.4, nl: 3.6, na: 50, hl: 3.0, hd: 1.6, ha: 50, ear: 0.9, mane: 1, tail: 'long', c: 'dun', hoof: 1 },
    donkey: { L: 8.2, Hb: 4.0, leg: 4.6, nl: 3.0, na: 42, hl: 3.4, hd: 1.7, ha: 38, ear: 2.6, tail: 'tuft', c: 'grey', hoof: 1, muzzle: 'pale' },
    mule: { L: 9.2, Hb: 4.2, leg: 5.2, nl: 3.8, na: 48, hl: 3.6, hd: 1.7, ha: 45, ear: 2.0, tail: 'tuft', c: 'brown', hoof: 1 },
    ox: { L: 10.6, Hb: 5.4, leg: 4.2, nl: 1.6, na: 10, hl: 2.8, hd: 2.0, ha: 40, ear: 0.6, horns: 'ox', tail: 'tuft', c: 'dun', hoof: 1, dewlap: 1 },
    cow: { L: 9.8, Hb: 5.0, leg: 4.2, nl: 1.6, na: 10, hl: 2.7, hd: 1.9, ha: 42, ear: 0.6, horns: 'cow', tail: 'tuft', c: 'pied', hoof: 1 },
    zebu: { L: 9.8, Hb: 4.8, leg: 4.8, nl: 1.6, na: 10, hl: 2.7, hd: 1.7, ha: 42, ear: 0.9, horns: 'cow', tail: 'tuft', c: 'white', hump: 1.6, hoof: 1, dewlap: 1 },
    nguni: { L: 9.8, Hb: 4.8, leg: 4.6, nl: 1.6, na: 10, hl: 2.7, hd: 1.7, ha: 42, ear: 0.8, horns: 'long', tail: 'tuft', c: 'nguni', hump: 1.0, hoof: 1 },
    yak: { L: 10, Hb: 5.4, leg: 3.6, nl: 1.2, na: 5, hl: 2.6, hd: 1.9, ha: 45, ear: 0.6, horns: 'cow', tail: 'bush', c: 'black', shag: 1, hoof: 1, hump: 1.2 },
    sheep: { L: 6.2, Hb: 4.0, leg: 2.6, nl: 1.2, na: 30, hl: 2.0, hd: 1.3, ha: 30, ear: 0.6, tail: 'none', c: 'fleece', wool: 1, face: 'black', legc: '#4A3C30' },
    rat: { L: 3.0, Hb: 1.5, leg: 0.8, nl: 0.4, na: 10, hl: 1.4, hd: 0.8, ha: 5, ear: 0.6, tail: 'rat', c: 'grey', paw: 1 },
    goat: { L: 6.2, Hb: 3.4, leg: 3.4, nl: 2.0, na: 50, hl: 2.0, hd: 1.0, ha: 35, ear: 0.7, horns: 'goat', tail: 'up', c: 'white', beard: 1, hoof: 1 },
    pig: { L: 7.2, Hb: 3.9, leg: 2.0, nl: 0.6, na: 0, hl: 2.4, hd: 2.0, ha: 15, ear: 0.9, tail: 'curl', c: 'pink', snout: 1 },
    boar: { L: 7.6, Hb: 4.2, leg: 2.4, nl: 0.6, na: 0, hl: 2.8, hd: 2.0, ha: 18, ear: 0.9, tail: 'tuft', c: 'black', snout: 1, tusk: 1, bristle: 1 },
    dog: { L: 5.6, Hb: 2.6, leg: 3.0, nl: 1.6, na: 45, hl: 2.2, hd: 1.2, ha: 5, ear: 0.9, tail: 'up', c: 'brown', paw: 1 },
    hound: { L: 6.8, Hb: 2.7, leg: 3.8, nl: 2.0, na: 45, hl: 2.6, hd: 1.1, ha: 8, ear: 1.1, earDown: 1, tail: 'up', c: 'white', spots: 1, paw: 1 },
    wolf: { L: 7.4, Hb: 3.0, leg: 3.6, nl: 1.8, na: 32, hl: 2.8, hd: 1.3, ha: 6, ear: 1.1, tail: 'bush', c: 'wolf', paw: 1 },
    blackdog: { L: 8.6, Hb: 3.8, leg: 4.4, nl: 2.0, na: 30, hl: 3.0, hd: 1.6, ha: 6, ear: 1.2, tail: 'bush', c: 'black', eyes: 1, paw: 1 },
    fox: { L: 6.0, Hb: 2.4, leg: 2.6, nl: 1.4, na: 35, hl: 2.6, hd: 1.1, ha: 4, ear: 1.1, tail: 'bush', c: 'fox', paw: 1 },
    deer: { L: 8.0, Hb: 3.6, leg: 5.4, nl: 3.4, na: 62, hl: 2.6, hd: 1.2, ha: 40, ear: 1.1, antlers: 1, tail: 'none', c: 'russet', hoof: 1 },
    stag: { L: 8.6, Hb: 3.8, leg: 5.6, nl: 3.6, na: 64, hl: 2.7, hd: 1.2, ha: 38, ear: 1.1, antlers: 1.5, tail: 'none', c: 'russet', hoof: 1 },
    reindeer: { L: 8.4, Hb: 4.0, leg: 4.8, nl: 2.8, na: 45, hl: 2.6, hd: 1.3, ha: 35, ear: 0.8, antlers: 1.5, tail: 'none', c: 'grey', hoof: 1 },
    camel: { L: 9.6, Hb: 4.2, leg: 7.4, nl: 6.0, na: 20, hl: 2.8, hd: 1.3, ha: 5, ear: 0.5, hump: 3.0, tail: 'tuft', c: 'camel', camel: 1 },
    bactrian: { L: 9.8, Hb: 4.6, leg: 6.4, nl: 5.0, na: 25, hl: 2.6, hd: 1.3, ha: 5, ear: 0.5, hump: 2.4, humps: 2, tail: 'tuft', c: 'dun', camel: 1, shag: 1 },
    llama: { L: 6.8, Hb: 3.6, leg: 5.0, nl: 5.6, na: 84, hl: 2.0, hd: 1.0, ha: 5, ear: 1.4, tail: 'up', c: 'fleece', wool: 1 },
    bear: { L: 9.0, Hb: 5.0, leg: 3.2, nl: 1.4, na: 10, hl: 2.8, hd: 2.0, ha: 15, ear: 0.8, tail: 'none', c: 'brown', paw: 1, hump: 1.0 },
    unicorn: { L: 9.8, Hb: 4.1, leg: 6.2, nl: 4.8, na: 60, hl: 3.4, hd: 1.4, ha: 50, ear: 0.9, mane: 1, tail: 'lion', c: 'white', horn: 1, beard: 1, hoof: 1, cloven: 1 },
    lion: { L: 9.0, Hb: 3.8, leg: 4.0, nl: 1.6, na: 30, hl: 2.4, hd: 1.8, ha: 10, ear: 0.6, tail: 'lion', c: 'ochre', maneLion: 1, paw: 1 },
    cat: { L: 4.0, Hb: 2.0, leg: 1.8, nl: 1.0, na: 50, hl: 1.4, hd: 1.0, ha: 0, ear: 0.8, tail: 'up', c: 'grey', paw: 1 },
    elephant: { elephant: 1, c: 'elephant' },
  };
  const COATS = { bay: '#8C5634', dun: '#C3A574', grey: '#AAA79D', brown: '#7A5638', white: '#EDE7D8', black: '#3D3530', chestnut: '#9C5A2E', pied: '#EEE6D3', nguni: '#E8DCC6', fleece: '#EFE8D6', pink: '#E3B5A2', wolf: '#8E8B83', fox: '#C0662E', russet: '#A8683E', camel: '#D2AF74', elephant: '#9C9690', ochre: '#C99A42', dapple: '#C9C6BC', piebald: '#EFE8D8', cream: '#E6D3A6' };
  const pol = (p, len, deg) => [p[0] + Math.cos(deg * Math.PI / 180) * len, p[1] - Math.sin(deg * Math.PI / 180) * len];
  function legShape(g, pts, w0, w1, c) {   // a tapered leg: thick at the body, thin at the hoof; ink outline then fill
    const ctx = g.x;
    const seg = (a, b, w, col) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); };
    const ws = pts.map((p, i) => w0 + (w1 - w0) * i / (pts.length - 1));
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], ws[i] + 0.75, INK);
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], ws[i], c);
  }
  function beast(g, kind, o) {
    o = o || {};
    if ((BEAST[kind] || {}).elephant) return elephant(g, o);
    const B = Object.assign({}, BEAST[kind] || BEAST.horse, o.b || {});
    const sc = o.s || 1, coat = COATS[o.coat || B.c] || col(o.coat, COATS.bay), dark = shadeOf(coat, 0.72);
    g.save(); g.x.scale(sc, sc);
    const L = B.L, Hb = B.Hb, leg = B.leg, belly = -leg, top = -leg - Hb, x0 = -L / 2, x1 = L / 2;
    const walk = o.walk ? 1 : 0, graze = o.graze ? 1 : 0;
    const lw0 = Math.max(0.8, Hb * 0.3), lw1 = Math.max(0.5, Hb * 0.14);
    // legs: [x at the body, front?]
    const fx = x1 - L * 0.17, hx = x0 + L * 0.17;
    const front = (x, far, step) => [[x, belly - 1.0], [x + 0.15 + step * 0.4, belly + leg * 0.48], [x + 0.1 + step, -0.55], [x + 0.35 + step, 0]];
    const hind = (x, far, step) => [[x - 0.2, belly - 1.4], [x - 0.9 + step * 0.3, belly + leg * 0.42], [x - 0.4 + step, -0.55], [x - 0.15 + step, 0]];
    const st = walk ? 1.3 : 0.35;
    const foot = (p, c) => { if (B.hoof) g.shape([[p[0] - 0.45, p[1]], [p[0] - 0.35, p[1] - 0.6], [p[0] + 0.45, p[1] - 0.6], [p[0] + 0.65, p[1]]], INK, 0); else if (B.paw) g.ell(p[0] + 0.3, p[1] - 0.25, 0.55, 0.3, c, 0.25); };
    const LEGS = [[hind(hx + 0.6, 1, walk ? -st : st * 0.5), true], [front(fx - 0.5, 1, walk ? st * 0.6 : -st * 0.4), true], [hind(hx, 0, walk ? st : -st * 0.4), false], [front(fx, 0, walk ? -st * 0.4 : st * 0.4), false]];
    const legc = B.legc || coat, legd = B.legc ? shadeOf(B.legc, 0.8) : dark;
    for (const [pts, far] of LEGS.slice(0, 2)) { legShape(g, pts, lw0, lw1, far ? legd : legc); foot(pts[3], dark); }
    // tail
    const tr = [x0 + 0.2, top + Hb * 0.22];
    if (B.tail === 'long') g.shape([tr, [tr[0] - 1.6, tr[1] + 0.4], [tr[0] - 2.4, tr[1] + 2.6], [tr[0] - 2.3, tr[1] + 5.2], [tr[0] - 1.5, tr[1] + 4.4], [tr[0] - 1.0, tr[1] + 2.4], [tr[0] - 0.2, tr[1] + 1.4]], o.tailc ? col(o.tailc) : shadeOf(coat, 0.55), 0.32);
    else if (B.tail === 'tuft') { g.line([tr, [tr[0] - 0.7, tr[1] + 1.4], [tr[0] - 0.9, tr[1] + 3.4]], 0.35, INK, true); g.ell(tr[0] - 0.95, tr[1] + 3.8, 0.42, 0.75, INK, 0); }
    else if (B.tail === 'bush') g.shape([tr, [tr[0] - 1.6, tr[1] + 0.2], [tr[0] - 3.0, tr[1] + 1.4], [tr[0] - 3.8, tr[1] + 2.8], [tr[0] - 2.2, tr[1] + 2.4], [tr[0] - 0.4, tr[1] + 1.4]], kind === 'fox' ? coat : shadeOf(coat, 0.9), 0.32);
    else if (B.tail === 'up') g.line([tr, [tr[0] - 1.0, tr[1] - 1.2], [tr[0] - 1.3, tr[1] - 2.6]], 0.42, INK, true);
    else if (B.tail === 'rat') g.line([tr, [tr[0] - 1.6, tr[1] + 1.4], [tr[0] - 3.4, tr[1] + 0.8], [tr[0] - 4.4, tr[1] + 1.8]], 0.25, INK, true);
    else if (B.tail === 'curl') g.line(arc(tr[0] - 0.6, tr[1], 0.6, 0.6, 0, Math.PI * 1.6, 6), 0.32);
    else if (B.tail === 'lion') { g.line([tr, [tr[0] - 1.8, tr[1] + 1.8], [tr[0] - 2.8, tr[1] - 0.4]], 0.35, INK, true); g.ell(tr[0] - 2.9, tr[1] - 0.8, 0.55, 0.8, shadeOf(coat, 0.8), 0.25); }
    // neck and head geometry
    const withers = [x1 - L * 0.12, top + 0.15], chestTop = [x1 + 0.2, top + Hb * 0.55];
    const poll = pol(withers, B.nl, B.na);
    const throat0 = pol(chestTop, B.nl * 0.82, B.na + 4);
    const ha = -B.ha * Math.PI / 180 + (graze ? -1.0 : 0);   // head direction (radians, y down positive)
    const hdir = [Math.cos(-ha), Math.sin(-ha)], hnorm = [-hdir[1], hdir[0]];
    const HP = (u, v) => [poll[0] + hdir[0] * u * B.hl + hnorm[0] * v * B.hd, poll[1] + hdir[1] * u * B.hl + hnorm[1] * v * B.hd];
    // y down: hnorm points "down" from the head line when the head points right
    const nn = [hnorm[0], hnorm[1]]; if (nn[1] < 0) { nn[0] = -nn[0]; nn[1] = -nn[1]; }
    const H2 = (u, v) => [poll[0] + hdir[0] * u * B.hl + nn[0] * v * B.hd, poll[1] + hdir[1] * u * B.hl + nn[1] * v * B.hd];
    const head = B.snout ? [H2(0, -0.1), H2(0.5, -0.2), H2(0.92, 0.05), H2(1.05, 0.35), H2(1.0, 0.85), H2(0.6, 1.0), H2(0.15, 1.0)]
      : B.paw ? [H2(0, 0), H2(0.45, -0.15), H2(0.75, 0.15), H2(1.05, 0.3), H2(1.02, 0.7), H2(0.7, 0.8), H2(0.3, 1.05), H2(0.05, 0.9)]
      : [H2(0, 0), H2(0.38, -0.12), H2(0.94, 0.12), H2(1.04, 0.5), H2(0.92, 0.82), H2(0.55, 0.78), H2(0.28, 1.08), H2(0.05, 0.95)];
    const throat = head[head.length - 1];
    const body = [[x0 - 0.2, top + Hb * 0.5], [x0 + 0.1, top + Hb * 0.12], [x0 + L * 0.2, top - 0.05], [x0 + L * 0.5, top + 0.35], [withers[0] - 0.6, top + 0.05], withers,
      ...(B.nl > 1 ? [poll] : []), ...head.slice(1, -1), throat, chestTop, [x1 + 0.1, belly - Hb * 0.2], [x1 - L * 0.12, belly + 0.15], [x0 + L * 0.5, belly + 0.35], [x0 + L * 0.14, belly + 0.1], [x0 - 0.1, belly - Hb * 0.25]];
    // humps
    if (B.humps === 2) { [x0 + L * 0.3, x0 + L * 0.62].forEach(hx2 => g.shape(arc(hx2, top + 0.6, L * 0.14, B.hump, Math.PI, Math.PI * 2, 8), coat, 0.38)); }
    else if (B.hump && B.camel) g.shape(arc(x0 + L * 0.46, top + 0.7, L * 0.27, B.hump, Math.PI, Math.PI * 2, 10), coat, 0.38);
    else if (B.hump) g.shape(arc(withers[0] - 0.4, top + 0.5, 1.2, B.hump, Math.PI, Math.PI * 2, 8), coat, 0.35);
    if (B.maneLion) g.ell(poll[0] + 0.6, poll[1] + 0.9, B.hd * 1.15, B.hd * 1.35, shadeOf(coat, 0.7), 0.35);
    g.shape(body, coat, 0.42);
    // shading: the hindquarters and the underside
    g.hatch(body, 62, 0.62, { side: -1, cut: x0 + L * 0.32 });
    g.save(); g.path(body, true, false, 0); g.x.clip(); g.hatch([[x0 - 2, belly - Hb * 0.22], [x1 + 2, belly - Hb * 0.22], [x1 + 2, belly + 2], [x0 - 2, belly + 2]], 15, 0.65); g.restore();
    if (B.c === 'pied' && !o.coat) { g.ell(x0 + L * 0.38, top + Hb * 0.45, 1.4, 1.0, '#5A4636', 0); g.ell(x0 + L * 0.7, top + Hb * 0.6, 1.0, 0.8, '#5A4636', 0); }
    if (B.c === 'nguni' && !o.coat) { g.ell(x0 + L * 0.3, top + Hb * 0.4, 1.2, 0.9, '#8C5634', 0); g.ell(x0 + L * 0.62, top + Hb * 0.55, 1.0, 1.0, '#3D3530', 0); g.ell(x0 + L * 0.8, top + Hb * 0.35, 0.7, 0.6, '#8C5634', 0); }
    if (o.coat === 'dapple') for (let i = 0; i < 8; i++) g.ell(x0 + 1 + (i % 4) * L / 4.4, top + 1.2 + Math.floor(i / 4) * 1.4, 0.5, 0.4, null, 0.15);
    if (B.wool) { for (let i = 0; i < 6; i++) g.shape(arc(x0 + 0.6 + i * (L - 1.4) / 5.4, top + 0.5, 0.8, 0.75, Math.PI, Math.PI * 2, 5), coat, 0.3); for (let i = 0; i < 4; i++) g.line(arc(x0 + 1.6 + i * (L - 3) / 3, top + Hb * 0.5, 0.5, 0.4, 0.2, Math.PI * 1.2, 4), 0.15, 'rgba(43,33,25,0.6)'); }
    else if (B.shag) for (let i = 0; i < 9; i++) g.line([[x0 + 0.8 + i * (L - 1.4) / 8, belly - Hb * 0.3], [x0 + 0.6 + i * (L - 1.4) / 8, belly + 0.6]], 0.3, shadeOf(coat, 0.7));
    if (B.spots) { g.ell(x0 + L * 0.4, top + 1.0, 0.9, 0.7, '#7A5638', 0); g.ell(x0 + L * 0.7, top + 1.4, 0.7, 0.5, '#3D3530', 0); }
    if (B.bristle) for (let i = 0; i < 5; i++) g.line([[x0 + 1.0 + i * 1.1, top + 0.3], [x0 + 1.3 + i * 1.1, top - 0.6]], 0.25);
    if (B.face === 'black') g.shape(head, '#4A3C30', 0.3);
    if (B.muzzle === 'pale') g.ell(H2(0.88, 0.5)[0], H2(0.88, 0.5)[1], B.hd * 0.42, B.hd * 0.36, '#E6E0D0', 0.2, ha);
    if (B.dewlap) g.shape([chestTop, [chestTop[0] - 0.6, chestTop[1] + Hb * 0.4], [x1 - 0.4, belly - Hb * 0.1]], coat, 0.3);
    // mane and forelock
    if (B.mane) { const m = [withers, [withers[0] - 0.5, withers[1] + 0.7], ...[0.25, 0.5, 0.75].map(t => { const p = lerp(withers, poll, t); return [p[0] - 0.7, p[1] + 0.3]; }), [poll[0] - 0.3, poll[1] + 0.2], poll]; g.shape(m, o.manec ? col(o.manec) : shadeOf(coat, 0.5), 0.3); }
    // ears, horns, antlers
    const er = H2(0.12, -0.05);
    if (B.ear) {
      if (B.earDown) g.shape([er, [er[0] - 0.5, er[1] + B.ear * 1.6], [er[0] + 0.5, er[1] + 0.3]], dark, 0.28);
      else g.shape([[er[0] - 0.35, er[1] + 0.2], [er[0] - 0.55 - B.ear * 0.3, er[1] - B.ear], [er[0] + 0.45, er[1] + 0.05]], coat, 0.3);
    }
    if (B.horns === 'ox' || B.horns === 'cow') { g.limb([[er[0] + 0.2, er[1] + 0.1], [er[0] + 0.1, er[1] - 1.0], [er[0] + 0.8, er[1] - 1.7]], 0.3, C.bone, true); }
    if (B.horns === 'long') g.limb([[er[0], er[1]], [er[0] - 1.5, er[1] - 1.2], [er[0] - 1.2, er[1] - 2.6]], 0.34, C.bone, true);
    if (B.horns === 'goat') g.line([[er[0], er[1]], [er[0] - 1.0, er[1] - 1.1], [er[0] - 1.7, er[1] - 0.3]], 0.42, INK, true);
    if (B.horn) g.limb([H2(0.3, -0.1), pol(H2(0.3, -0.1), 3.0, 70)], 0.3, C.gold);
    if (B.antlers) { const k = B.antlers, a = [er[0] + 0.3, er[1] - 0.1]; g.line([a, [a[0] - 0.4 * k, a[1] - 1.8 * k], [a[0] + 0.2 * k, a[1] - 3.2 * k]], 0.34, C.brown); g.line([[a[0] - 0.25 * k, a[1] - 1.1 * k], [a[0] + 0.9 * k, a[1] - 1.6 * k]], 0.26, C.brown); g.line([[a[0] - 0.4 * k, a[1] - 2.1 * k], [a[0] - 1.4 * k, a[1] - 2.8 * k]], 0.26, C.brown); }
    // face
    const eye = H2(0.32, 0.28);
    g.dot(eye[0], eye[1], 0.24); if (B.eyes) { g.dot(eye[0], eye[1], 0.38, '#E8A23A'); g.dot(eye[0], eye[1], 0.15); }
    if (B.snout) { const s = H2(1.02, 0.45); g.ell(s[0], s[1], 0.32, 0.5, shadeOf(coat, 0.9), 0.25, ha); }
    if (B.tusk) { const t = H2(0.85, 0.7); g.shape([[t[0] - 0.2, t[1] + 0.2], [t[0] + 0.4, t[1] - 0.9], [t[0] + 0.4, t[1] + 0.2]], C.bone, 0.18); }
    if (B.beard) { const b = H2(0.85, 0.95); g.line([b, [b[0] - 0.2, b[1] + 1.0]], 0.42); }
    if (!B.paw && !B.snout) { const n = H2(0.97, 0.45); g.dot(n[0], n[1], 0.16); }
    // tack
    if (o.saddle) g.shape([[x0 + L * 0.42, top + 0.2], [x0 + L * 0.68, top + 0.3], [x0 + L * 0.66, top + Hb * 0.55], [x0 + L * 0.4, top + Hb * 0.55]], col(o.saddle, C.madder), 0.32);
    if (o.caparison) { const cp = [[x0 - 0.2, top + 0.4], [withers[0] + 0.6, top + 0.2], [x1 + 0.6, belly - Hb * 0.1], [x1 + 0.3, belly + 1.6], [x0 - 0.4, belly + 1.8]]; charge(g, cp, o.caparison, x0 + L * 0.5, belly - Hb * 0.4, 1.4); g.line([[x0 - 0.4, belly + 1.8], [x1 + 0.3, belly + 1.6]], 0.45, C.gold); }
    if (o.panniers) { g.shape([[x0 + L * 0.3, top + 0.6], [x0 + L * 0.66, top + 0.6], [x0 + L * 0.64, belly + 0.6], [x0 + L * 0.32, belly + 0.6]], col(o.panniers, C.straw), 0.35); g.line([[x0 + L * 0.31, top + Hb * 0.5], [x0 + L * 0.65, top + Hb * 0.5]], 0.2); }
    if (o.load) { const lt = top - (B.hump && B.camel ? B.hump * 0.8 : 0); g.shape([[x0 + L * 0.2, lt - 2.0], [x0 + L * 0.72, lt - 2.2], [x0 + L * 0.8, top + Hb * 0.45], [x0 + L * 0.12, top + Hb * 0.45]], col(o.load, C.wool), 0.35); g.line([[x0 + L * 0.46, lt - 2.1], [x0 + L * 0.46, top + Hb * 0.45]], 0.25, C.brown); g.line([[x0 + L * 0.14, top + Hb * 0.2], [x0 + L * 0.78, top + Hb * 0.2]], 0.2, C.gold); }
    if (o.yoke) g.limb([[er[0] - 0.6, er[1] + 0.6], [er[0] + 1.2, er[1] + 0.2]], 0.5, C.brown);
    if (o.rider || o.led || o.bridle) { const a = H2(0.15, 0.4), b = H2(0.88, 0.62); g.line([a, b], 0.24, C.madderDk); }
    // near legs last
    for (const [pts, far] of LEGS.slice(2)) { legShape(g, pts, lw0, lw1, legc); foot(pts[3], dark); }
    if (o.caparison) { /* the cloth hangs over the near legs' tops */ g.save(); const cp = [[x0 - 0.4, belly + 0.4], [x1 + 0.3, belly + 0.2], [x1 + 0.3, belly + 1.6], [x0 - 0.4, belly + 1.8]]; charge(g, cp, o.caparison, x0 + L * 0.5, belly + 1, 1.4); g.line([[x0 - 0.4, belly + 1.8], [x1 + 0.3, belly + 1.6]], 0.45, C.gold); g.restore(); }
    g.restore();
    return { head: [H2(0.6, 0.4)[0] * sc, H2(0.6, 0.4)[1] * sc], back: [0, top * sc], saddle: [(x0 + L * 0.54) * sc, (top + 0.3) * sc], L: L * sc, top: top * sc };
  }
  function elephant(g, o) {
    const sc = o.s || 1, coat = COATS.elephant, dark = shadeOf(coat, 0.75);
    g.save(); g.x.scale(sc, sc);
    const leg = 5.2, top = -13.4, belly = -leg;
    legShape(g, [[-4.4, belly - 1], [-4.6, -0.3]], 2.0, 1.9, dark); legShape(g, [[3.4, belly - 1], [3.6, -0.3]], 2.0, 1.9, dark);
    g.line([[-7.4, -9.6], [-8.4, -6.4]], 0.35); g.ell(-8.5, -6.0, 0.35, 0.6, INK, 0);
    const body = [[-7.4, -8.4], [-6.8, -11.6], [-3.6, top], [1.6, top + 0.2], [4.6, -12.6], [6.6, -10.8], [6.4, -6.2], [3.6, belly + 0.4], [-2, belly + 0.6], [-6.6, belly - 0.4]];
    g.shape(body, coat, 0.45);
    g.hatch(body, 62, 0.7, { side: -1, cut: -3 });
    g.save(); g.path(body, true, false, 0); g.x.clip(); g.hatch([[-9, -7], [9, -7], [9, -3], [-9, -3]], 15, 0.7); g.restore();
    // head with trunk, tusk and a great ear
    const head = [[4.2, -12.0], [6.0, -13.6], [8.6, -13.0], [9.6, -10.8], [9.6, -8.4], [10.4, -5.4], [11.6, -3.0], [12.2, -1.4], [11.2, -1.2], [10.2, -3.4], [8.8, -6.0], [7.2, -7.0], [5.0, -8.0]];
    g.shape(head, coat, 0.45);
    g.shape([[9.2, -7.4], [11.0, -6.6], [11.8, -5.0], [10.2, -6.4]], C.bone, 0.25);
    g.shape([[4.4, -12.4], [6.6, -12.8], [7.4, -10.2], [6.6, -7.6], [4.8, -7.0], [3.8, -9.2]], dark, 0.38);
    g.hatch([[4.4, -12.4], [6.6, -12.8], [7.4, -10.2], [6.6, -7.6], [4.8, -7.0], [3.8, -9.2]], 70, 0.6);
    g.dot(8.4, -10.8, 0.28);
    for (let i = 0; i < 4; i++) g.line([[9.8 + i * 0.4, -7 + i * 1.3], [10.6 + i * 0.4, -7.2 + i * 1.3]], 0.2);
    legShape(g, [[-2.8, belly - 1], [-3.0, -0.3]], 2.1, 2.0, coat); legShape(g, [[4.8, belly - 1], [5.0, -0.3]], 2.1, 2.0, coat);
    for (const x of [-3.0, 5.0]) for (let k = 0; k < 3; k++) g.dot(x - 0.6 + k * 0.6, -0.5, 0.18, C.bone);
    if (o.howdah) { const t = top; g.shape([[-4.6, t + 0.6], [2.8, t + 0.6], [2.4, t - 3.2], [-4.2, t - 3.2]], C.madder, 0.35); g.shape([[-4.8, t - 3.2], [-0.8, t - 5.8], [3.0, t - 3.2]], C.gold, 0.32); g.shape([[-0.8, t - 5.8], [-0.6, t - 6.8], [-1.0, t - 6.8]], C.gold, 0.25);
      charge(g, [[-4.4, t + 0.4], [3.2, t + 0.4], [2.8, t + 4.6], [-4.0, t + 4.6]], { d: 'fess', c1: 'saffron', c2: 'madder' }, -0.6, t + 2.4, 1); g.line([[-4.0, t + 4.6], [2.8, t + 4.6]], 0.45, C.gold); }
    g.restore();
    return { head: [8 * sc, -10 * sc], saddle: [-0.8 * sc, (top + 0.2) * sc], L: 14 * sc, top: top * sc };
  }

  // ------------------------------------------------------------------ small things on the ground
  function bird(g, x, y, o) {
    o = o || {}; const s = o.s || 1, c = col(o.c, C.white);
    g.save(); g.x.translate(x, y); g.x.scale(s * (o.dir || 1), s);
    if (o.penguin) { g.ell(0, -2.6, 1.3, 2.6, '#2B2119', 0.3); g.ell(0.45, -2.4, 0.8, 2.0, C.white, 0); g.ell(0.1, -5.4, 0.9, 0.85, '#2B2119', 0.3); g.shape([[0.9, -5.5], [1.9, -5.3], [0.9, -5.1]], C.saffron, 0.15); g.dot(0.4, -5.6, 0.14, C.white); g.line([[-1.1, -3.6], [-1.7, -1.8]], 0.4); g.line([[-0.4, 0], [0.6, 0]], 0.35, C.saffron); g.restore(); return; }
    if (o.fire) { g.shape([[-1.6, -3.2], [-6.4, -6.2], [-4.6, -3.6], [-7.2, -3.4], [-4.4, -2.2], [-6.6, -0.6], [-1.8, -2.0]], C.fire, 0.3, true); g.shape([[-1.4, -3.0], [-4.8, -4.6], [-3.4, -2.6]], '#F4D06A', 0); g.shape([[-0.4, -3.0], [-1.6, -6.6], [1.0, -4.0]], C.vermilion, 0.3); g.ell(0, -2.8, 1.9, 1.2, C.vermilion, 0.35); g.limb([[1.2, -3.2], [1.8, -4.8]], 0.5, C.vermilion); g.ell(2.0, -5.2, 0.6, 0.55, C.vermilion, 0.28); g.shape([[1.8, -5.7], [1.6, -7.0], [2.4, -5.8]], '#F4D06A', 0.15); g.shape([[2.5, -5.3], [3.4, -5.1], [2.5, -4.9]], C.gold, 0.15); g.line([[-0.2, -1.6], [-0.2, 0]], 0.25); g.line([[0.4, -1.6], [0.6, 0]], 0.25); g.restore(); return; }
    if (o.fly) { g.line([[-2.6, -1], [-1, -2.2], [0, -1.2], [1, -2.2], [2.6, -1]], 0.4, INK, true); g.restore(); return; }
    g.line([[0.2, -1.6], [0.2, 0]], 0.25); g.line([[-0.4, -1.6], [-0.6, 0]], 0.25);
    g.ell(0, -2.6, 2.0, 1.25, c, 0.35, -0.1);
    g.limb([[1.4, -3.0], [2.0, -4.6]], 0.5, c, true);
    g.ell(2.3, -5.0, 0.7, 0.6, c, 0.3); g.shape([[2.9, -5.1], [4.0, -4.8], [2.9, -4.7]], C.ochre, 0.18); g.dot(2.4, -5.15, 0.16);
    g.shape([[-1.9, -2.8], [-3.0, -3.4], [-2.4, -2.2]], c, 0.25);
    g.restore();
  }
  function goose(g, x, y, dir, fly) { bird(g, x, y, { c: C.white, dir, s: 1, fly }); }
  function hen(g, x, y, dir) {
    g.save(); g.x.translate(x, y); g.x.scale(dir || 1, 1);
    g.line([[0, -1.1], [0, 0]], 0.22); g.ell(0, -1.9, 1.3, 1.0, C.russet, 0.3); g.ell(1.0, -2.9, 0.5, 0.5, C.russet, 0.25); g.dot(1.1, -3.4, 0.3, C.madder); g.shape([[-1.2, -2.2], [-1.9, -3.2], [-1.0, -2.6]], C.black, 0.2);
    g.restore();
  }
  function ground(g, x0, x1, y, kind) {
    if (kind === 'water') { g.line([[x0, y + 0.4], [x1, y + 0.4]], 0.35, C.water); g.line([[x0 + 1.5, y + 1.4], [x1 - 1.5, y + 1.4]], 0.25, C.water); return; }
    if (kind === 'snow') { g.line([[x0, y + 0.3], [x1, y + 0.3]], 0.3, '#8DA6B8'); return; }
    if (kind === 'none') return;
    g.line([[x0, y + 0.2], [x1, y + 0.2]], 0.28, 'rgba(43,33,25,0.7)');
    for (let i = 0; i < 3; i++) { const t = x0 + (x1 - x0) * (0.15 + 0.3 * i); g.line([[t, y + 0.2], [t - 0.4, y - 0.9]], 0.18); g.line([[t + 0.4, y + 0.2], [t + 0.6, y - 0.7]], 0.18); }
  }
  function water(g, x0, x1, y, n) { for (let i = 0; i < (n || 2); i++) { const yy = y + i * 1.2, a = x0 + i * 1.2, b = x1 - i * 1.2; g.line([[a, yy], [a + (b - a) * 0.25, yy - 0.35], [a + (b - a) * 0.5, yy], [a + (b - a) * 0.75, yy - 0.35], [b, yy]], 0.32, C.water, true); } }

  // boats: hull centred at 0, waterline at y=0; returns seat positions
  function boat(g, kind, o) {
    o = o || {};
    const c = col(o.c, C.brown);
    if (kind === 'rowing' || kind === 'coracle' || kind === 'kayak' || kind === 'canoe' || kind === 'waka' || kind === 'sampan' || kind === 'reed' || kind === 'felucca' || kind === 'longship' || kind === 'cog' || kind === 'gondola' || kind === 'dhow') {
      const L = { rowing: 12, coracle: 6, kayak: 14, canoe: 14, waka: 22, sampan: 13, reed: 13, felucca: 14, longship: 24, cog: 16, gondola: 15, dhow: 16 }[kind] * (o.s || 1);
      const Hh = { rowing: 2.4, coracle: 2.4, kayak: 1.2, canoe: 1.6, waka: 2.2, sampan: 2.2, reed: 2.0, felucca: 2.4, longship: 3.0, cog: 4.4, gondola: 1.6, dhow: 3.0 }[kind];
      if (kind === 'felucca' || kind === 'dhow') { g.limb([[0.6, -Hh], [-1.4, -Hh - 12]], 0.35, C.brown); g.shape([[-5.6, -Hh - 3.2], [-1.6, -Hh - 13.4], [5.4, -Hh - 1.2]], C.white, 0.38, true); g.hatch([[-5.6, -Hh - 3.2], [-1.6, -Hh - 13.4], [5.4, -Hh - 1.2]], 70, 0.8, { side: -1, cut: -1 }); }
      if (kind === 'longship') { g.limb([[0, -Hh], [0, -Hh - 11]], 0.4, C.brown); g.shape([[-5, -Hh - 10], [5, -Hh - 10], [5.6, -Hh - 3], [-5.6, -Hh - 3]], C.white, 0.38); for (let i = 0; i < 3; i++) g.shape([[-5 + i * 3.4, -Hh - 10], [-3.3 + i * 3.4, -Hh - 10], [-3.0 + i * 3.4, -Hh - 3], [-4.8 + i * 3.4, -Hh - 3]], C.madder, 0); g.shape([[-5, -Hh - 10], [5, -Hh - 10], [5.6, -Hh - 3], [-5.6, -Hh - 3]], null, 0.38); }
      if (kind === 'cog') { g.limb([[0, -Hh], [0, -Hh - 12]], 0.4, C.brown); g.shape([[-4.4, -Hh - 11], [4.4, -Hh - 11], [5, -Hh - 3], [-5, -Hh - 3]], C.undyed, 0.38); g.shape([[-1.4, -Hh - 9], [1.4, -Hh - 9], [1.4, -Hh - 5.4], [0, -Hh - 4.6], [-1.4, -Hh - 5.4]], C.madder, 0.3); g.line([[0, -Hh - 12], [2.6, -Hh - 12.8]], 0.5, C.madder); }
      let hull;
      if (kind === 'coracle') hull = arc(0, -Hh * 0.2, L / 2, Hh, 0, Math.PI, 10).reverse();
      else if (kind === 'longship' || kind === 'waka') hull = [[-L / 2 - 1.2, -Hh - 2.6], [-L / 2 + 0.6, -Hh * 0.4], [-L / 3, Hh * 0.5], [L / 3, Hh * 0.5], [L / 2 - 0.6, -Hh * 0.4], [L / 2 + 1.4, -Hh - 2.8], [L / 2 - 0.4, -Hh], [-L / 2 + 0.4, -Hh]];
      else if (kind === 'gondola') hull = [[-L / 2 - 0.6, -Hh - 1.6], [-L / 2 + 1, -Hh * 0.2], [-L / 3, Hh * 0.4], [L / 3, Hh * 0.4], [L / 2 - 1, -Hh * 0.2], [L / 2 + 0.8, -Hh - 2.2], [L / 2 - 0.6, -Hh], [-L / 2 + 0.6, -Hh]];
      else if (kind === 'reed') hull = [[-L / 2 - 0.8, -Hh - 1.6], [-L / 2 + 0.6, -Hh * 0.2], [-L / 3, Hh * 0.5], [L / 3, Hh * 0.5], [L / 2 - 0.6, -Hh * 0.2], [L / 2 + 0.8, -Hh - 1.8], [L / 2 - 0.8, -Hh], [-L / 2 + 0.8, -Hh]];
      else hull = [[-L / 2, -Hh], [-L / 2 + 1.2, Hh * 0.2], [-L / 3, Hh * 0.55], [L / 3, Hh * 0.55], [L / 2 - 0.6, Hh * 0.1], [L / 2 + 0.8, -Hh - 0.4]];
      g.shape(hull, kind === 'reed' ? C.straw : kind === 'gondola' ? C.black : c, 0.42, kind === 'coracle' || kind === 'reed');
      if (kind === 'reed') for (let i = 0; i < 6; i++) g.line([[-L / 2 + 1 + i * L / 6, -Hh + 0.2], [-L / 2 + 1.4 + i * L / 6, Hh * 0.4]], 0.2);
      else g.hatch(hull, 15, 0.7, { smooth: kind === 'coracle' });
      if (kind === 'longship') { for (let i = 0; i < 5; i++) roundShield(g, -L / 3 + i * L / 6.6, -Hh * 0.55, 1.15, { c1: i % 2 ? 'ochreLt' : 'madder', c2: 'steel' }); g.shape([[L / 2 + 1.4, -Hh - 2.8], [L / 2 + 2.6, -Hh - 3.6], [L / 2 + 2.0, -Hh - 2.0]], c, 0.3); }
      if (kind === 'waka') { g.line([[-L / 2 + 1, -Hh * 0.4], [L / 2 - 1, -Hh * 0.4]], 0.3, C.madder); for (let i = 0; i < 8; i++) g.line([[-L / 2 + 2 + i * 2.4, -Hh * 0.1], [-L / 2 + 2.8 + i * 2.4, -Hh * 0.7]], 0.2, C.white); }
      if (kind === 'sampan') { g.shape(arc(1, -Hh, 3.2, 2.8, Math.PI, Math.PI * 2, 8), C.straw, 0.35); for (let i = 0; i < 4; i++) g.line([[-1.6 + i * 1.6, -Hh - 0.2], [-1.4 + i * 1.6, -Hh - 2.4]], 0.18); }
      if (kind === 'kayak') g.line([[-L / 2 + 1, -Hh], [L / 2 - 1, -Hh - 0.2]], 0.25);
      water(g, -L / 2 - 2, L / 2 + 2.4, Hh * 0.6 + 0.6, 2);
      return { L, Hh };
    }
    return { L: 10, Hh: 2 };
  }

  // ------------------------------------------------------------------ props on the ground or set pieces
  const SET = {
    cart(g, o) { const c = col(o.c, C.russet); g.ell(-1, -2.6, 2.6, 2.6, null, 0.42); for (let a = 0; a < 6.28; a += 1.05) g.line([[-1, -2.6], [-1 + Math.cos(a) * 2.5, -2.6 + Math.sin(a) * 2.5]], 0.22); g.shape([[-5.8, -6.6], [4.6, -6.6], [4.2, -3.6], [-5.4, -3.6]], c, 0.42); g.hatch([[-5.8, -6.6], [4.6, -6.6], [4.2, -3.6], [-5.4, -3.6]], 80, 0.8); g.line([[4.4, -4.4], [9.2, -4.0]], 0.45, C.brown); if (o.load) g.shape([[-5.6, -6.6], [-4.8, -9.2], [0, -10.2], [4, -9], [4.4, -6.6]], col(o.load, C.straw), 0.38, true); g.ell(-1, -2.6, 2.6, 2.6, null, 0.42); },
    cauldron(g) { g.line([[-2.6, 0], [-1.2, -3.6]], 0.3); g.line([[2.6, 0], [1.2, -3.6]], 0.3); g.shape([[-2.2, -3.8], [2.2, -3.8], [1.8, -1.4], [0, -0.8], [-1.8, -1.4]], C.black, 0.4, true); g.shape([[-0.9, 0], [0, -1.1], [0.9, 0]], C.fire, 0.25); g.line([[-0.6, -4.4], [-0.8, -6], [-0.2, -7.2]], 0.3, '#8DA0A8', true); g.line([[0.8, -4.4], [1.2, -5.6], [0.8, -7]], 0.25, '#8DA0A8', true); g.ell(0, -3.8, 2.2, 0.5, '#7FA36A', 0.3); },
    fire(g) { for (let i = 0; i < 3; i++) g.line([[-1.6 + i * 1.6, 0], [-1 + i * 0.6, -0.6]], 0.45, C.brown); g.shape([[-1.4, -0.4], [-0.6, -3.0], [0, -1.8], [0.4, -3.6], [1.4, -0.4]], C.fire, 0.28, true); g.shape([[-0.6, -0.5], [0.1, -2.2], [0.7, -0.5]], '#F4D06A', 0); },
    tent(g, o) { g.shape([[-4.6, 0], [0, -6.4], [4.6, 0]], col(o.c, C.undyed), 0.42); g.shape([[-0.6, 0], [0, -4.4], [0.8, 0]], C.black, 0); g.hatch([[0, -6.4], [4.6, 0], [0.6, 0]], 75, 0.7); g.line([[0, -6.4], [0, -7.8]], 0.3); g.shape([[0, -7.8], [1.8, -7.4], [0, -7]], C.madder, 0.2); },
    yurt(g) { g.shape([[-4.6, 0], [-4.6, -3.0], [-2.4, -5.2], [2.4, -5.2], [4.6, -3.0], [4.6, 0]], C.white, 0.42, true); g.line([[-4.6, -3], [4.6, -3]], 0.3, C.madder); g.shape([[-0.8, 0], [-0.8, -2.2], [0.8, -2.2], [0.8, 0]], C.madder, 0.3); },
    well(g) { g.shape([[-2.4, 0], [-2.4, -2.6], [2.4, -2.6], [2.4, 0]], C.stone, 0.4); for (let i = 0; i < 3; i++) g.line([[-2.4, -0.8 * i - 0.6], [2.4, -0.8 * i - 0.6]], 0.18); g.line([[-2, -2.6], [-2, -6]], 0.35, C.brown); g.line([[2, -2.6], [2, -6]], 0.35, C.brown); g.shape([[-2.8, -6], [0, -7.8], [2.8, -6]], C.madder, 0.35); g.line([[0, -6], [0, -4]], 0.2); },
    stall(g, o) { g.line([[-3.6, 0], [-3.6, -6]], 0.35, C.brown); g.line([[3.6, 0], [3.6, -6]], 0.35, C.brown); g.shape([[-4.2, -6], [4.2, -6], [4.0, -7.6], [-4.0, -7.6]], col(o.c, C.madder), 0.35); for (let i = 0; i < 4; i++) g.shape([[-4.2 + i * 2.1, -6], [-3.15 + i * 2.1, -6], [-3.15 + i * 2.1, -5.4], [-4.2 + i * 2.1, -5.4]], C.white, 0.2); g.shape([[-3.8, -2.6], [3.8, -2.6], [3.8, -1.4], [-3.8, -1.4]], C.russet, 0.35); for (let i = 0; i < 4; i++) g.ell(-2.6 + i * 1.7, -3.0, 0.6, 0.5, [C.ochreLt, C.green, C.madder, C.ochre][i], 0.2); },
    hut(g, o) { g.shape([[-4, 0], [-4, -4], [4, -4], [4, 0]], col(o.c, C.undyed), 0.42); g.shape([[-5, -4], [0, -8.6], [5, -4]], C.straw, 0.42); g.hatch([[-5, -4], [0, -8.6], [5, -4]], 80, 0.6); g.shape([[0.6, 0], [0.6, -2.6], [2.2, -2.6], [2.2, 0]], C.brown, 0.3); },
    chickenhut(g) {   // a hut stood on two great bird legs
      g.line([[-1.8, -5], [-2.2, -2.4], [-1.6, 0]], 0.7, C.ochre); g.line([[1.8, -5], [2.6, -2.4], [2.0, 0]], 0.7, C.ochre);
      [[-1.6, 0], [2.0, 0]].forEach(p => { g.line([[p[0], p[1]], [p[0] - 1.2, p[1] + 0.2]], 0.35); g.line([[p[0], p[1]], [p[0] + 1.2, p[1] + 0.2]], 0.35); g.line([[p[0], p[1]], [p[0] + 0.1, p[1] - 0.9]], 0.3); });
      g.shape([[-3.6, -5], [-3.6, -9.6], [3.6, -9.6], [3.6, -5]], C.russet, 0.42); for (let i = 0; i < 4; i++) g.line([[-3.6, -6 - i * 1.1], [3.6, -6 - i * 1.1]], 0.2);
      g.shape([[-4.6, -9.6], [0, -13.4], [4.6, -9.6]], C.moss, 0.42); g.hatch([[-4.6, -9.6], [0, -13.4], [4.6, -9.6]], 80, 0.6); g.shape([[-0.8, -6.4], [-0.8, -8.4], [0.8, -8.4], [0.8, -6.4]], '#F2D27A', 0.3); g.line([[1.6, -13], [1.6, -14.4], [2.2, -15.6]], 0.3, '#9AA7AE', true);
    },
    mushrooms(g, o) { const n = o.n || 9, rx = o.rx || 6, ry = o.ry || 2.2; for (let i = 0; i < n; i++) { const a = i / n * 6.283, x = Math.cos(a) * rx, y = Math.sin(a) * ry; g.line([[x, y], [x, y - 0.9]], 0.3, C.bone); g.shape(arc(x, y - 0.9, 0.85, 0.7, Math.PI, Math.PI * 2, 6), C.madder, 0.25); g.dot(x - 0.2, y - 1.2, 0.15, C.white); } },
    stones(g, o) { (o.pts || [[-3, 0], [0, -0.4], [3, 0.2]]).forEach(([x, y], i) => g.shape([[x - 1.2, y], [x - 1.0, y - 2.0 - (i % 2) * 0.4], [x + 1.0, y - 2.2], [x + 1.2, y]], C.stone, 0.38)); },
    columns(g) { for (let i = 0; i < 5; i++) { const x = -6 + i * 2.6, h = 2 + (i * 7 % 5) * 0.6; g.shape([[x - 1.2, 0.4 * (i % 2)], [x - 1.2, -h], [x - 0.4, -h - 0.6], [x + 0.6, -h - 0.5], [x + 1.2, -h], [x + 1.2, 0.4 * (i % 2)]], C.stoneDk, 0.38); g.ell(x, -h - 0.3, 1.2, 0.5, C.stone, 0.3); } water(g, -8, 8, 1.6, 2); },
    sledge(g) { g.shape([[-4, -1.4], [3.6, -1.4], [3.4, -2.8], [-4, -2.8]], C.brown, 0.35); g.line([[-4.6, 0], [3.4, 0], [4.6, -1.2]], 0.4, INK, true); g.line([[-3, 0], [-3, -1.4]], 0.25); g.line([[2, 0], [2, -1.4]], 0.25); },
    anvil(g) { g.shape([[-2, -2.4], [2.4, -2.4], [3.4, -3.0], [-2.6, -3.0]], C.steelDk, 0.35); g.shape([[-1, -2.4], [1, -2.4], [1.4, 0], [-1.4, 0]], C.steelDk, 0.35); g.shape([[-1.4, 0], [1.4, 0], [1.0, -0.8], [-1.0, -0.8]], C.brown, 0); },
    hoard(g) { for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.5 + (i % 5) * 0.9; g.ell(Math.cos(a) * r * 1.8, -0.4 - Math.abs(Math.sin(a)) * r * 0.5, 0.6, 0.4, C.gold, 0.18); } g.shape([[-1.4, -1.2], [1.0, -1.2], [1.0, -2.6], [-1.4, -2.6]], C.russet, 0.3); g.shape([[1.6, -0.4], [2.6, -2.2], [3.4, -0.4]], C.gold, 0.25); },
    rock(g, o) { const s = o.s || 1; g.shape([[-3 * s, 0], [-2.4 * s, -2.4 * s], [-0.6 * s, -3.4 * s], [1.6 * s, -3.0 * s], [3 * s, -1.2 * s], [3.2 * s, 0]], C.stone, 0.42, true); g.hatch([[-3 * s, 0], [-2.4 * s, -2.4 * s], [-0.6 * s, -3.4 * s], [1.6 * s, -3.0 * s], [3 * s, -1.2 * s], [3.2 * s, 0]], 60, 0.7, { side: 1, cut: 0.4 }); },
    cave(g) { g.shape([[-6, 0], [-5, -4], [-2, -6.4], [2, -6.6], [5, -4.4], [6.4, 0]], C.stone, 0.42, true); g.shape([[-2.4, 0], [-2.0, -3.2], [0, -4.2], [2.2, -3.0], [2.6, 0]], '#2E2620', 0.35, true); g.hatch([[-6, 0], [-5, -4], [-2, -6.4], [2, -6.6], [5, -4.4], [6.4, 0]], 50, 0.8, { side: 1, cut: 2.6, smooth: true }); },
    barrow(g) { g.shape(arc(0, 0, 8, 3.4, Math.PI, Math.PI * 2, 14), C.sage, 0.4); g.shape([[-1.2, 0], [-1.2, -1.8], [1.2, -1.8], [1.2, 0]], '#2E2620', 0.3); g.shape([[-1.8, -1.8], [1.8, -1.8], [1.6, -2.4], [-1.6, -2.4]], C.stone, 0.3); for (let i = 0; i < 6; i++) g.line([[-6 + i * 2.4, -1.6 + Math.abs(i - 2.5) * 0.3], [-5.6 + i * 2.4, -2.4 + Math.abs(i - 2.5) * 0.3]], 0.18); },
    stack(g, o) { if (o && o.face) { g.save(); } g.shape([[-2.6, 1], [-2.2, -6], [-1, -9.6], [0.8, -10], [1.8, -7], [2.4, 1]], C.stone, 0.42, true); g.hatch([[-2.6, 1], [-2.2, -6], [-1, -9.6], [0.8, -10], [1.8, -7], [2.4, 1]], 70, 0.6, { side: 1, cut: 0 }); if (o && o.face) { g.shape([[1.6, -7.4], [3.0, -6.4], [1.9, -5.6]], C.stone, 0.32); g.dot(0.6, -7.6, 0.3); g.line([[0.4, -8.4], [1.2, -8.2]], 0.3); g.line([[0.6, -5.0], [1.6, -4.8]], 0.25); g.restore(); } water(g, -6, 6, 1.6, 2); },
    tree(g, o) { const s = o.s || 1; g.limb([[0, 0], [0, -4 * s]], 0.7 * s, C.brown); g.shape([[-3 * s, -3.6 * s], [-3.4 * s, -6.4 * s], [-1.6 * s, -8.6 * s], [1.4 * s, -8.8 * s], [3.4 * s, -6.6 * s], [3.0 * s, -3.6 * s]], col(o.c, C.leaf), 0.42, true); g.hatch([[-3 * s, -3.6 * s], [-3.4 * s, -6.4 * s], [-1.6 * s, -8.6 * s], [1.4 * s, -8.8 * s], [3.4 * s, -6.6 * s], [3.0 * s, -3.6 * s]], 60, 0.7, { side: 1, cut: 0.6 * s, smooth: true }); if (o.fruit) for (let i = 0; i < 5; i++) g.dot(-2 * s + i * s, -5 * s - (i % 2) * 1.6 * s, 0.4 * s, C.madder); },
    bush(g, o) { const s = o.s || 1; g.shape(arc(0, 0, 3 * s, 2.6 * s, Math.PI, Math.PI * 2, 10), col(o.c, C.leaf), 0.38, true); g.hatch(arc(0, 0, 3 * s, 2.6 * s, Math.PI, Math.PI * 2, 10), 60, 0.6, { side: 1, cut: 0.4 }); },
    reeds(g) { for (let i = 0; i < 7; i++) { const x = -3 + i; g.line([[x, 0], [x + 0.3 * (i % 3 - 1), -3 - (i % 3)]], 0.25, C.moss); if (i % 2) g.ell(x + 0.3 * (i % 3 - 1), -3.2 - (i % 3), 0.3, 0.8, C.brown, 0); } },
    sign(g, o) { g.line([[0, 0], [0, -6]], 0.4, C.brown); g.shape([[-0.2, -6], [5, -5.6], [5.6, -4.6], [5, -3.6], [-0.2, -3.8]], col(o.c, C.paper), 0.35); },
    hearth(g) { g.shape([[-3, 0], [-3, -4.4], [-1.6, -6.6], [1.6, -6.6], [3, -4.4], [3, 0]], C.stoneDk, 0.4); g.shape([[-1.6, 0], [-1.6, -2.8], [1.6, -2.8], [1.6, 0]], '#2E2620', 0.3); g.shape([[-1.2, 0], [-0.4, -2.0], [0.2, -1.2], [0.8, -2.2], [1.2, 0]], C.fire, 0.2); },
    bridgeArch(g, o) { const w = o.w || 16; g.shape([[-w / 2, -3], [w / 2, -3], [w / 2, 2], [w / 2 - 2, 2], [w / 2 - 2.6, 0], [0, -1.2], [-w / 2 + 2.6, 0], [-w / 2 + 2, 2], [-w / 2, 2]], C.stone, 0.42); g.line([[-w / 2, -3.8], [w / 2, -3.8]], 0.35); for (let i = 0; i < 7; i++) g.line([[-w / 2 + 1 + i * w / 7, -3.8], [-w / 2 + 1 + i * w / 7, -3]], 0.2); water(g, -w / 2 + 2, w / 2 - 2, 2.4, 2); },
    wheelcheese(g) { g.ell(0, -1.6, 1.6, 1.6, C.ochreLt, 0.35); g.ell(0, -1.6, 0.6, 0.6, null, 0.2); g.line([[-2.4, -1.2], [-4, -1.4]], 0.2); g.line([[-2.2, -2.2], [-3.6, -2.6]], 0.2); },
    picnic(g) { g.shape([[-5, 0], [5, 0], [4, -1.4], [-4, -1.4]], C.madder, 0.32); for (let i = 0; i < 4; i++) g.line([[-4.6 + i * 2.6, 0], [-3.8 + i * 2.6, -1.4]], 0.25, C.white); g.shape([[-1.2, -1.4], [1.2, -1.4], [1.0, -3.0], [-1.0, -3.0]], C.straw, 0.3); g.ell(2.6, -1.8, 0.8, 0.5, C.ochreLt, 0.25); },
    pots(g) { for (let i = 0; i < 3; i++) g.shape([[-3 + i * 2.2, 0], [-3.6 + i * 2.2, -1.2], [-3 + i * 2.2, -2.4], [-2.0 + i * 2.2, -2.4], [-1.4 + i * 2.2, -1.2], [-2.0 + i * 2.2, 0]], C.russet, 0.3, true); },
    barrels(g) { for (let i = 0; i < 3; i++) { const x = -3 + i * 2.6; g.shape([[x - 1.1, 0], [x - 1.3, -1.4], [x - 1.1, -2.8], [x + 1.1, -2.8], [x + 1.3, -1.4], [x + 1.1, 0]], C.russet, 0.32, true); g.line([[x - 1.25, -0.8], [x + 1.25, -0.8]], 0.2); g.line([[x - 1.25, -2.0], [x + 1.25, -2.0]], 0.2); } },
    pyre(g) { g.shape([[-3, 0], [3, 0], [2.4, -1.4], [-2.4, -1.4]], C.brown, 0.3); SET.fire(g); },
  };

  // ------------------------------------------------------------------ creatures of story (all original designs)
  const CREATURE = {
    // a large dragon asleep, coiled round a ring (the Slough roundabout); r is the ring radius in px
    dragonRing(g, o) {
      const r = o.r || 26, body = col(o.c, '#6E8A55'), belly = '#D9C98E';
      const N = 60, pts = [], pts2 = [];
      for (let i = 0; i <= N; i++) { const a = -0.4 + i / N * Math.PI * 1.86, w = 4.6 * (1 - Math.pow(i / N, 1.6) * 0.75); pts.push([Math.cos(a) * (r + w), Math.sin(a) * (r + w) * 0.62]); pts2.push([Math.cos(a) * (r - w), Math.sin(a) * (r - w) * 0.62]); }
      const shape = pts.concat(pts2.reverse());
      // a folded bat wing on the far side of the coil: spars fanning from the shoulder, scalloped membrane
      const wb = [r * 0.05, -r * 0.6], tip = [-r * 0.55, -r * 1.22], sp = [[-r * 0.62, -r * 0.98], [-r * 0.5, -r * 0.78], [-r * 0.28, -r * 0.7], [-r * 0.05, -r * 0.68]];
      const mem = [wb, [wb[0] - r * 0.12, -r * 0.95], tip];
      sp.forEach((q, i) => { const prev = i ? sp[i - 1] : tip; mem.push([(prev[0] + q[0]) / 2 + r * 0.02, (prev[1] + q[1]) / 2 + r * 0.07]); mem.push(q); });
      mem.push([r * 0.28, -r * 0.62]);
      g.shape(mem, shadeOf(body, 0.78), 0.5);
      g.hatch(mem, 75, 1.1, { lw: 0.28 });
      sp.forEach(q => g.line([[wb[0] - r * 0.1, -r * 0.92], q], 0.35));
      g.line([wb, [wb[0] - r * 0.12, -r * 0.95], tip], 0.6);
      g.shape([[tip[0], tip[1]], [tip[0] - 1.2, tip[1] - 1.6], [tip[0] + 0.8, tip[1] - 0.4]], C.bone, 0.3);
      g.shape(shape, body, 0.6, true);
      g.hatch(shape, 50, 1.0, { smooth: true, lw: 0.25 });
      // spines along the outer edge
      for (let i = 2; i < N - 6; i += 3) { const a = -0.4 + i / N * Math.PI * 1.86, w = 4.6 * (1 - Math.pow(i / N, 1.6) * 0.75), rr = r + w; const p = [Math.cos(a) * rr, Math.sin(a) * rr * 0.62], q = [Math.cos(a + 0.05) * (rr + 2.2), Math.sin(a + 0.05) * (rr + 2.2) * 0.62], s = [Math.cos(a + 0.1) * rr, Math.sin(a + 0.1) * rr * 0.62]; g.shape([p, q, s], C.madder, 0.3); }
      // belly scutes on the inner edge
      for (let i = 2; i < N - 4; i += 2) { const a = -0.4 + i / N * Math.PI * 1.86, w = 4.6 * (1 - Math.pow(i / N, 1.6) * 0.75); g.line([[Math.cos(a) * (r - w + 0.4), Math.sin(a) * (r - w + 0.4) * 0.62], [Math.cos(a) * (r - w * 0.3), Math.sin(a) * (r - w * 0.3) * 0.62]], 0.25, belly); }
      // tail tip: an arrowhead tucked near the head
      const ta = -0.4 + Math.PI * 1.86, tp = [Math.cos(ta) * r, Math.sin(ta) * r * 0.62];
      g.shape([[tp[0], tp[1] - 1.2], [tp[0] + 4.2, tp[1] - 2.4], [tp[0] + 2.4, tp[1] + 0.8]], C.madder, 0.4);
      // head resting on the front coil, eyes shut
      const ha = -0.4, hp = [Math.cos(ha) * r + 2, Math.sin(ha) * r * 0.62 + 1];
      const head = [[hp[0] - 4, hp[1] - 3.2], [hp[0] + 2, hp[1] - 4.6], [hp[0] + 8.4, hp[1] - 2.6], [hp[0] + 9.6, hp[1] - 0.6], [hp[0] + 7.6, hp[1] + 1.0], [hp[0] + 1, hp[1] + 2.2], [hp[0] - 4, hp[1] + 1.4]];
      g.shape(head, body, 0.55, true); g.hatch(head, 60, 0.9, { smooth: true, side: -1, cut: hp[0] + 1 });
      g.shape([[hp[0] - 2.4, hp[1] - 3.6], [hp[0] - 5.4, hp[1] - 7.4], [hp[0] - 0.6, hp[1] - 4.2]], C.bone, 0.35);
      g.shape([[hp[0] + 0.6, hp[1] - 4.2], [hp[0] - 1.0, hp[1] - 8.0], [hp[0] + 2.6, hp[1] - 4.4]], C.bone, 0.35);
      g.line([[hp[0] + 2.4, hp[1] - 1.6], [hp[0] + 3.6, hp[1] - 1.2], [hp[0] + 4.8, hp[1] - 1.6]], 0.4, INK, true);   // shut eye
      g.line([[hp[0] + 6.4, hp[1] + 0.4], [hp[0] + 9.2, hp[1] - 0.4]], 0.3);
      g.dot(hp[0] + 8.6, hp[1] - 1.4, 0.35);
      // a wisp of smoke from the nostril, and a ZZZ
      g.line([[hp[0] + 9.8, hp[1] - 1.6], [hp[0] + 11.4, hp[1] - 4], [hp[0] + 10.6, hp[1] - 6.2], [hp[0] + 12.4, hp[1] - 8.6]], 0.35, '#8E9AA0', true);
      g.x.font = 'italic 5px Georgia, serif'; g.x.fillStyle = INK; g.x.fillText('z', hp[0] + 12, hp[1] - 9.4); g.x.font = 'italic 3.6px Georgia, serif'; g.x.fillText('z', hp[0] + 15, hp[1] - 12.6);
      // forefoot with claws over the coil
      const fp = [Math.cos(0.3) * r, Math.sin(0.3) * r * 0.62];
      g.shape([[fp[0] - 1.6, fp[1] - 2.2], [fp[0] + 2.0, fp[1] - 2.6], [fp[0] + 3.2, fp[1] + 1.4], [fp[0] - 1.0, fp[1] + 1.6]], body, 0.45, true);
      for (let i = 0; i < 3; i++) g.line([[fp[0] + 1.2 + i * 0.8, fp[1] + 1.4], [fp[0] + 1.6 + i * 0.8, fp[1] + 2.6]], 0.4);
    },
    dragon(g, o) {   // a small sleeping dragon on a hoard (or a cross lizard when o.lizard)
      const c = col(o.c, '#6E8A55'), s = o.s || 1;
      g.save(); g.x.scale(s, s);
      if (o.hoard) SET.hoard(g, {});
      const body = [[-9, -1.6], [-6, -4.6], [-1, -6.2], [4, -5.4], [7, -3.2], [7.4, -0.4], [2, 0.6], [-4, 0.4]];
      if (o.wing !== false) { g.shape([[-3, -5.4], [-1.4, -11], [2, -8.4], [4.6, -10.6], [5, -5]], shadeOf(c, 0.75), 0.4, true); g.line([[0.8, -5.6], [-1.4, -11]], 0.25); g.line([[1.6, -5.6], [4.6, -10.6]], 0.25); }
      g.shape([[-9, -1.6], [-12.6, -1.2], [-15, -3.4], [-13.4, -0.2], [-8, 0.4]], c, 0.4, true);
      g.shape([[-15, -3.4], [-16.6, -4.8], [-15.6, -2.4]], C.madder, 0.25);
      g.shape(body, c, 0.45, true); g.hatch(body, 55, 0.7, { smooth: true }); for (let i = 0; i < 6; i++) g.shape([[-6 + i * 2.2, -4.8 - Math.sin(i / 5 * 3) * 1.2], [-5.2 + i * 2.2, -6.6 - Math.sin(i / 5 * 3) * 1.2], [-4.4 + i * 2.2, -4.8 - Math.sin(i / 5 * 3) * 1.2]], C.madder, 0.2);
      const hd = o.awake ? [[6, -4.4], [8.4, -7.4], [12.4, -7.0], [13.6, -5.4], [10.4, -4.0]] : [[6, -2.6], [8.4, -4.4], [12.6, -3.6], [13.6, -1.6], [10, -0.6]];
      g.shape(hd, c, 0.45, true);
      if (o.awake) { g.dot(10.2, -6.2, 0.45, '#E8A23A'); g.dot(10.2, -6.2, 0.18); g.line([[12, -4.4], [13.4, -5.0]], 0.3); g.line([[8.6, -7.2], [8.0, -9.0]], 0.4); } else { g.line([[9.6, -3.4], [10.8, -3.2]], 0.35); g.x.font = 'italic 3px Georgia, serif'; g.x.fillStyle = INK; g.x.fillText('z', 13.4, -6.2); }
      for (const lx of [-5, 4]) { g.limb([[lx, -0.6], [lx + 0.8, 0]], 1.1, c); }
      g.restore();
    },
    wyvern(g, o) {   // flying, wings spread
      const c = col(o.c, C.madder);
      g.shape([[-1, -6], [-10, -12], [-8.4, -8.6], [-12, -7.6], [-7, -5.6], [-2, -3.6]], shadeOf(c, 0.85), 0.42, true);
      g.shape([[1, -6], [9, -13], [8.2, -9.2], [11.6, -8.6], [6.4, -5.6], [2, -3.6]], c, 0.42, true);
      g.hatch([[1, -6], [9, -13], [8.2, -9.2], [11.6, -8.6], [6.4, -5.6], [2, -3.6]], 70, 0.8, { smooth: true });
      g.shape([[-2.6, -5], [0, -7.2], [3, -6.2], [3.4, -3.6], [0, -2.6]], c, 0.42, true);
      g.line([[-2.4, -4.2], [-6, -2.4], [-8.6, -3.4], [-10, -1.6]], 0.6, INK, true); g.shape([[-10, -1.6], [-11.6, -2.6], [-10.8, -0.6]], c, 0.25);
      g.shape([[3, -6.2], [5.4, -8.6], [8.4, -8.2], [6.4, -6.4]], c, 0.38, true); g.dot(6.4, -7.8, 0.3, '#E8A23A');
      g.line([[0, -2.8], [-0.4, -1.0]], 0.4); g.line([[1.6, -3], [1.8, -1.2]], 0.4);
    },
    serpent(g, o) {   // humps of a sulking lake or sea serpent
      const c = col(o.c, '#5E7F66');
      [[-8, 4.2], [-1.6, 3.6], [4.6, 2.8]].forEach(([x, h]) => { const pts = arc(x, 0, 2.6, h, Math.PI, Math.PI * 2, 10); g.shape(pts, c, 0.42, true); g.hatch(pts, 60, 0.6, { smooth: true, side: 1, cut: x }); g.shape([[x - 0.6, -h + 0.1], [x, -h - 1.1], [x + 0.6, -h + 0.1]], C.madder, 0.2); });
      g.limb([[9.6, 0], [10.4, -4.4], [12.6, -6.4]], 1.5, c, true);
      g.shape([[11.4, -7.4], [14.8, -7.2], [15.4, -5.8], [12.2, -5.4]], c, 0.38, true); g.line([[12.6, -6.6], [13.6, -6.4]], 0.3);   // eyes half shut, sulking
      g.line([[13.8, -5.6], [15.0, -6.0]], 0.25);
      water(g, -12, 16, 0.6, 2);
    },
    kraken(g, o) {
      const c = col(o.c, '#8A4E5A');
      for (let i = 0; i < 5; i++) { const x = -10 + i * 5, h = 5 + (i % 2) * 3; const pts = [[x - 0.8, 0], [x - 1.4, -h * 0.5], [x - 0.2, -h], [x + 1.4, -h - 1.2], [x + 2.4, -h + 0.4], [x + 1.2, -h + 0.2], [x + 0.8, -h * 0.5], [x + 0.9, 0]]; g.shape(pts, c, 0.4, true); for (let k = 1; k < 4; k++) g.dot(x - 0.1, -k * h / 4.4, 0.28, C.rose); }
      g.ell(0, 0.4, 4.6, 2.4, c, 0.42); g.dot(-1.6, -0.2, 0.5, '#E8D27A'); g.dot(-1.6, -0.2, 0.22); g.dot(1.8, -0.2, 0.5, '#E8D27A'); g.dot(1.8, -0.2, 0.22);
      water(g, -14, 14, 1.6, 2);
    },
    griffin(g, o) {
      const c = col(o.c, C.ochre);
      beast(g, 'lion', { coat: 'ochre', b: { maneLion: false, neck: 2.6, headL: 2.0, headW: 1.4, ear: 1.2 } });
      g.shape([[-3, -8], [-1, -15], [2.4, -12.4], [4.4, -15.4], [4, -8.6]], C.white, 0.4, true);
      g.hatch([[-3, -8], [-1, -15], [2.4, -12.4], [4.4, -15.4], [4, -8.6]], 75, 0.7, { smooth: true });
      g.ell(6.6, -10.6, 1.6, 1.4, C.white, 0.38); g.shape([[7.8, -11], [9.8, -10.2], [8.0, -9.4]], C.saffron, 0.28); g.dot(6.8, -11, 0.25);
    },
    mermaid(g, o) {
      const tail = col(o.c, C.teal), skin = col(o.skin, SKIN.fair);
      g.shape([[-2, -1], [2.4, -1.4], [4.4, 0.2], [7.4, -0.4], [8.6, -2.6], [9.6, 0.4], [7.0, 1.6], [3, 1.6], [-1.8, 1.2]], tail, 0.42, true);
      for (let i = 0; i < 5; i++) g.line(arc(0.4 + i * 1.3, 0.2, 0.6, 0.6, 0, Math.PI, 4), 0.2);
      g.shape([[-2, -1], [-1.6, -6.4], [1.4, -6.6], [2.0, -1.4]], skin, 0.4);
      g.shape([[-0.6, -7.4], [-2.8, -4.4], [-3.0, -1.6], [-1.6, -2.4], [-1.0, -5.6]], HAIR.blond, 0.3, true);
      g.ell(0, -8.2, 1.3, 1.36, skin, 0.38); g.shape(arc(-0.1, -8.3, 1.36, 1.36, Math.PI * 0.85, Math.PI * 1.9, 8), HAIR.blond, 0.28); g.dot(0.6, -8.3, 0.2);
      g.limb([[1.2, -6], [2.6, -4.8], [3.4, -6.6]], 0.8, skin, true);
      g.ell(3.6, -7.0, 0.6, 0.8, C.gold, 0.25);   // a comb or mirror
      SET.rock(g, { s: 1.2 }); water(g, -6, 11, 1.6, 2);
    },
    wisp(g) { for (let i = 0; i < 3; i++) { const x = -3 + i * 3.4, y = -4 - (i % 2) * 2.6; g.dot(x, y, 1.6, 'rgba(240,226,140,0.35)'); g.dot(x, y, 0.8, 'rgba(255,240,170,0.9)'); g.dot(x, y, 0.35, '#FFF8D8'); } SET.reeds(g); },
    fairy(g, o) { const x = 0, y = 0; g.ell(x - 0.8, y - 0.8, 0.9, 0.5, 'rgba(220,235,240,0.8)', 0.18, -0.6); g.ell(x + 0.8, y - 0.8, 0.9, 0.5, 'rgba(220,235,240,0.8)', 0.18, 0.6); g.limb([[x, y], [x, y + 1.6]], 0.6, col(o.c, C.green)); g.dot(x, y - 0.5, 0.45, SKIN.fair); g.dot(x, y - 0.5, 0.45, null); },
    basilisk(g) { g.limb([[-8, -0.6], [-4, -2.4], [0, -1.2], [3, -2.8], [5.4, -5.6]], 1.4, '#7E8F4A', true); for (let i = 0; i < 5; i++) g.line([[-7 + i * 2.4, -1.6 - (i % 2)], [-6.8 + i * 2.4, -2.8 - (i % 2)]], 0.25); g.ell(6.2, -6.4, 1.6, 1.1, '#7E8F4A', 0.38); g.shape([[5.4, -7.2], [5.8, -9.0], [6.6, -7.4]], C.madder, 0.25); g.dot(6.6, -6.7, 0.4, '#E8A23A'); g.dot(6.6, -6.7, 0.15); g.line([[7.8, -6.4], [9.0, -6.6]], 0.2, C.madder); },
    cockatrice(g) { bird(g, -1, 0, { c: C.russet, s: 1.2 }); g.limb([[-3, -3.2], [-5.4, -2.0], [-7.4, -3.6], [-8.6, -2.0]], 0.8, '#7E8F4A', true); g.shape([[-1.6, -4], [-0.4, -8], [1.4, -5], [2.4, -7.6], [2.6, -3.6]], '#7E8F4A', 0.35, true); g.dot(1.9, -7.4, 0.5, C.madder); },
    tatzelwurm(g) { g.limb([[-7, -1], [-3, -2.6], [1, -2.2], [4, -3.0]], 2.2, '#8A8462', true); g.ell(5.2, -3.4, 2.0, 1.7, '#8A8462', 0.4); g.dot(5.8, -3.9, 0.35, '#E8A23A'); g.line([[6.6, -2.8], [7.4, -2.8]], 0.25); for (const x of [2.4, 3.4]) g.limb([[x, -2.2], [x + 0.6, 0]], 0.5, '#8A8462'); },
    troll(g, o) {   // a hunched bridge troll: grey-green hide, long arms, great nose, a club
      const sk = col(o.c, '#8E9479'), dk = shadeOf(sk, 0.72), s = o.s || 1;
      g.save(); g.x.scale(s, s);
      g.limb([[-1.6, -6], [-2.2, -3], [-2.6, 0]], 1.9, dk); g.ell(-2.2, -0.2, 1.3, 0.55, dk, 0.3);
      g.limb([[-3.4, -13], [-6.4, -9], [-6.8, -4.6]], 1.6, dk); g.ell(-6.8, -4.2, 0.9, 0.8, dk, 0.3);
      const bd = [[-5.6, -11], [-3.8, -15.6], [0.4, -16.8], [3.6, -15], [4.2, -11], [3.2, -6.6], [-0.4, -5.6], [-4.2, -6.4]];
      g.shape(bd, sk, 0.5, true); g.hatch(bd, 62, 0.7, { smooth: true, side: -1, cut: -0.6 });
      for (let i = 0; i < 6; i++) g.dot(-3 + (i % 3) * 2.2, -13.4 + Math.floor(i / 3) * 3, 0.28, dk);
      g.shape([[-4.4, -8.4], [3.6, -8.6], [3.8, -5.2], [1.6, -4.4], [0.4, -5.6], [-1.0, -4.2], [-3.4, -4.6]], col(o.c2, C.dun), 0.38);
      g.limb([[1.6, -6], [2.2, -3], [2.4, 0]], 1.9, sk); g.ell(2.8, -0.2, 1.4, 0.6, sk, 0.3);
      const hd = [[2.2, -15.4], [3.4, -17.6], [5.6, -17.8], [6.8, -16.2], [8.4, -15.2], [8.0, -13.8], [6.0, -13.6], [4.8, -12.6], [2.8, -13.2]];
      g.shape(hd, sk, 0.45, true);
      g.ell(7.2, -14.9, 1.3, 0.9, sk, 0.35); g.dot(5.3, -16.3, 0.32); g.line([[4.6, -16.9], [5.9, -17.1]], 0.32);
      g.shape([[3.2, -17.2], [2.2, -19.2], [4.0, -17.8]], sk, 0.3); g.line([[5.2, -13.4], [6.4, -13.2]], 0.3); g.shape([[5.6, -13.5], [5.9, -12.7], [6.1, -13.4]], C.bone, 0.15);
      for (let i = 0; i < 4; i++) g.line([[3.4 + i * 0.7, -17.6], [3.0 + i * 0.8, -19 - (i % 2) * 0.6]], 0.3, '#4A4234');
      g.limb([[2.6, -13.6], [5.4, -10.4], [7.2, -7.4]], 1.6, sk);
      g.limb([[7.6, -6.4], [10.4, -14.6]], 1.0, C.brown); g.ell(10.6, -15.2, 1.2, 1.5, C.brown, 0.35, 0.3); g.dot(10.0, -15.6, 0.25, INK); g.dot(11.0, -14.6, 0.25, INK);
      g.ell(7.4, -7.0, 0.95, 0.9, sk, 0.32);
      g.restore();
    },
    giantstride(g, o) { },
  };

  // ------------------------------------------------------------------ the scene builder
  // spec: { w, h, figs: [ { t: 'person'|'beast'|'boat'|'set'|'creature'|'bird'|'goose'|'hen'|'ground'|'water', x, y, dir, ... } ] }
  function render(spec, scale) {
    const S = scale || 3, pad = 2;
    const w = (spec.w || 24) + pad * 2, h = (spec.h || 24) + pad * 2;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.scale(S, S); ctx.translate(pad, pad);
    const R = rng(spec.seed || hashStr(JSON.stringify(spec)));
    const g = G(ctx, R);
    if (spec.ghost) ctx.globalAlpha = 0.72;
    for (const f of spec.figs || []) drawFig(g, f);
    ctx.globalAlpha = 1;
    for (const f of spec.front || []) drawFig(g, f);
    return c;
  }
  function drawFig(g, f) {
    g.save(); g.x.translate(f.x || 0, f.y || 0); if (f.dir === -1) g.x.scale(-1, 1); if (f.rot) g.x.rotate(f.rot);
    const t = f.t;
    if (t === 'person') {
      if (f.mount) {
        const m = beast(g, f.mount, Object.assign({ saddle: f.saddle || (f.caparison ? null : 'madder'), rider: true }, f.mountOpt || {}));
        const hipY = m.saddle[1] + 0.2, H = f.h || 18;
        if (f.mount === 'elephant') { person(g, Object.assign({}, f, { pose: 'ride', hip: [-1, hipY - 2.6], h: H * 0.92 })); }
        else person(g, Object.assign({}, f, { pose: 'ride', hip: [m.saddle[0] - 0.2, hipY] }));
        if (f.reins !== false && f.mount !== 'elephant') g.line([[m.saddle[0] + 2.4, hipY - 4.6], [m.head[0] - 0.3, m.head[1] + 0.3]], 0.22, C.madderDk);
      } else if (f.inBoat) {
        const b = boat(g, f.inBoat, f.boatOpt || {});
        const seats = f.seats || [[0, -b.Hh + 0.4]];
        seats.forEach((p, i) => {
          const pf = Object.assign({}, f, (f.crew && f.crew[i]) || {}, { pose: (f.crew && f.crew[i] && f.crew[i].pose) || f.pose || 'boat', hip: [p[0], p[1]] });
          if (pf.pose === 'stand') { g.save(); g.x.translate(p[0], p[1]); delete pf.hip; person(g, pf); g.restore(); }
          else { if (pf.pose !== 'row') pf.pose = 'boat'; person(g, pf); }
        });
      } else person(g, f);
    } else if (t === 'beast') beast(g, f.k, f);
    else if (t === 'boat') boat(g, f.k, f);
    else if (t === 'set') SET[f.k] && SET[f.k](g, f);
    else if (t === 'creature') CREATURE[f.k] && CREATURE[f.k](g, f);
    else if (t === 'bird') bird(g, 0, 0, f);
    else if (t === 'goose') goose(g, 0, 0, 1, f.fly);
    else if (t === 'hen') hen(g, 0, 0, 1);
    else if (t === 'ground') ground(g, f.x0 || -6, f.x1 || 6, 0, f.k);
    else if (t === 'water') water(g, f.x0 || -6, f.x1 || 6, 0, f.n || 2);
    else if (t === 'text') { g.x.font = `italic ${f.size || 4}px Georgia, serif`; g.x.fillStyle = col(f.c, INK); g.x.fillText(f.s || '', 0, 0); }
    else if (t === 'cartouche') cartouche(g, f);
    g.restore();
  }
  function cartouche(g, f) {
    const w = f.w || 60, h = f.h || 12;
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 + 3, 0], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2 - 3, 0]];
    g.shape(pts, '#F7ECCC', 0.6);
    g.line([[-w / 2 + 1.2, -h / 2 + 1.2], [w / 2 - 1.2, -h / 2 + 1.2]], 0.3, C.madder); g.line([[-w / 2 + 1.2, h / 2 - 1.2], [w / 2 - 1.2, h / 2 - 1.2]], 0.3, C.madder);
    [-1, 1].forEach(s => { g.line([[s * (w / 2 + 3), 0], [s * (w / 2 + 6), -2.4], [s * (w / 2 + 8), 0.6], [s * (w / 2 + 6.4), 1.8]], 0.45, INK, true); });
    g.x.font = `${f.size || 7}px "MedievalSharp", "IM Fell English", Georgia, serif`; g.x.textAlign = 'center'; g.x.textBaseline = 'middle'; g.x.fillStyle = C.madder;
    g.x.fillText(f.s || '', 0, 0.4);
  }

  // ------------------------------------------------------------------ variation helpers for data authors
  const PALETTE_EU = ['madder', 'ochre', 'woad', 'sage', 'undyed', 'russet', 'green', 'murrey', 'wool', 'dun', 'woadDk', 'moss', 'saffron', 'grey', 'brown'];
  function vary(seed) { const R = rng(seed); return { pick: a => a[Math.floor(R() * a.length) % a.length], R }; }

  global.InkFolkArt = { render, person, beast, boat, SET, CREATURE, PROPS, HATS, ARMS, BEAST, C, SKIN, HAIR, PALETTE_EU, rng, hashStr, vary, G };
})(window);
