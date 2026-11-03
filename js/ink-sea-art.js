/* The Inked World: drawings for the lively sea and the traveller's boats. Every one is an original drawing in the
 * map's pen (js/ink-folk-art.js: brown-black ink outline, flat muted fills, fine hatching), at three times its size on
 * the map: whales and spouts, dolphins, flying fish, sea serpents, krakens, icebergs and sea ice, ghost ships, wrecks
 * and treasure chests, fishing fleets, merchant ships, pirate ships, whirlpools, portolan compass roses, islands of
 * legend, wind-heads, storms, drifting bottles and castaways, and the five vessels the traveller can sail (rowing boat,
 * cog, caravel, longship, galleon) in the traveller's own colours and device. Load after js/ink-folk-art.js.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const FA = global.InkFolkArt; if (!FA) return;
  const C = FA.C, INK = C.ink, SC = 3;
  const col = (v, d) => (v && (C[v] || (v[0] === '#' ? v : null))) || d;
  const arc = (cx, cy, rx, ry, a0, a1, n) => { const o = []; n = n || 10; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  const WATER = C.water, FOAM = '#EAF1F4', WHALE = '#5D6B79', WHALE_LT = '#A9B4BC', DOLPH = '#7B8B98', SILVER = '#9DB2C2';
  function waves(g, x0, x1, y, n, c) { for (let i = 0; i < (n || 2); i++) { const yy = y + i * 1.3, a = x0 + i * 1.6, b = x1 - i * 1.6, m = (a + b) / 2; g.line([[a, yy], [a + (m - a) * 0.5, yy - 0.5], [m, yy], [m + (b - m) * 0.5, yy - 0.5], [b, yy]], 0.32, c || WATER, true); } }
  function foam(g, x, y, w) { for (let i = 0; i < 4; i++) { const a = x - w / 2 + i * w / 3.4; g.line([[a, y], [a + 0.6, y - 0.6], [a + 1.4, y - 0.2]], 0.28, WATER, true); } }

  // ---------------------------------------------------------------- heraldic device on a sail or flag (bbox x0,y0,x1,y1)
  function device(g, pts, her, bx) {
    const t1 = col(her && her.c1, C.madder), t2 = col(her && her.c2, C.ochreLt), d = (her && her.d) || 'pale';
    const [x0, y0, x1, y1] = bx, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, h = y1 - y0, x = g.x;
    g.save(); g.path(pts, true, false, 0); x.clip();
    x.fillStyle = t1; x.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    x.fillStyle = t2; x.beginPath();
    if (d === 'pale') x.rect(cx, y0 - 2, w, h + 4);
    else if (d === 'fess') x.rect(x0 - 2, cy - h * 0.13, w + 4, h * 0.26);
    else if (d === 'chief') x.rect(x0 - 2, y0 - 2, w + 4, h * 0.36 + 2);
    else if (d === 'quarterly') { x.rect(cx, y0 - 2, w, h / 2 + 2); x.rect(x0 - 2, cy, w / 2 + 2, h); }
    else if (d === 'cross') { x.rect(cx - w * 0.1, y0 - 2, w * 0.2, h + 4); x.rect(x0 - 2, cy - h * 0.1, w + 4, h * 0.2); }
    else if (d === 'roundel') x.arc(cx, cy, Math.min(w, h) * 0.24, 0, 7);
    else if (d === 'bend') { x.moveTo(x0, y0); x.lineTo(x0 + w * 0.24, y0); x.lineTo(x1, y1); x.lineTo(x1 - w * 0.24, y1); }
    else if (d === 'saltire') { const t = w * 0.12; x.moveTo(x0, y0); x.lineTo(x0 + t, y0); x.lineTo(x1, y1); x.lineTo(x1 - t, y1); x.moveTo(x1 - t, y0); x.lineTo(x1, y0); x.lineTo(x0 + t, y1); x.lineTo(x0, y1); }
    else if (d === 'chevron') { x.moveTo(x0, y1 - h * 0.12); x.lineTo(cx, y0 + h * 0.3); x.lineTo(x1, y1 - h * 0.12); x.lineTo(x1, y1 + h * 0.12); x.lineTo(cx, y0 + h * 0.56); x.lineTo(x0, y1 + h * 0.12); }
    x.fill(); g.restore();
  }
  // a square sail bellied by the wind: top yard at (cx, top), width w, height h
  function squareSail(g, cx, top, w, h, fill, her, belly) {
    const b = belly === undefined ? 1.2 : belly;
    const pts = [[cx - w / 2, top], [cx + w / 2, top], [cx + w / 2 + b * 0.6, top + h * 0.5], [cx + w / 2 - 0.2, top + h], [cx, top + h + b * 0.6], [cx - w / 2 + 0.2, top + h], [cx - w / 2 + b * 0.6, top + h * 0.5]];
    if (her) device(g, pts, her, [cx - w / 2, top, cx + w / 2, top + h]); else g.shape(pts, fill, 0, true);
    g.hatch(pts, 80, 0.85, { smooth: true, side: 1, cut: cx + w * 0.15, lw: 0.18 });
    g.shape(pts, null, 0.4, true);
    g.line([[cx - w / 2 - 0.8, top], [cx + w / 2 + 0.8, top]], 0.45, C.brown);
    return pts;
  }
  function lateen(g, mx, foot, h, fill, her, back) {
    // a triangular sail on a long slanting yard: luff along the yard, foot near the deck
    const s = back ? -1 : 1, tip = [mx - s * 3.4, foot - h], low = [mx + s * 5.2, foot - 0.6];
    const pts = [tip, [mx + s * 0.6, foot - h * 0.42], low, [mx - s * 1.6, foot - 1.4]];
    if (her) device(g, pts, her, [Math.min(tip[0], low[0]), tip[1], Math.max(tip[0], low[0]), foot]); else g.shape(pts, fill, 0, true);
    g.hatch(pts, 70, 0.9, { lw: 0.18, side: -s, cut: mx });
    g.shape(pts, null, 0.4, true);
    g.line([[tip[0] - s * 0.6, tip[1] - 0.6], [low[0] + s * 0.8, low[1] + 0.5]], 0.42, C.brown);
  }
  function pennant(g, x, y, c, len) { g.shape([[x, y], [x + (len || 4.4), y + 0.7], [x, y + 1.4]], col(c, C.madder), 0.25); }
  function mast(g, x, y0, y1, w) { g.limb([[x, y0], [x, y1]], w || 0.5, C.brown); }

  // ---------------------------------------------------------------- vessels (hull centred at x = 0, waterline y = 0, bow to +x)
  // o: { kind, sail (colour), her (device), hull, crew (a person spec for the traveller), frame, ghost, pirate, broken }
  function vessel(g, o) {
    const kind = o.kind || 'cog', fr = o.frame || 0, sail = col(o.sail, C.undyed), hullC = col(o.hull, C.russet), her = o.her || null;
    const bob = fr ? 0.35 : 0;
    g.save(); g.x.translate(0, bob);
    if (kind === 'rowing') {
      const L = 13, hull = [[-L / 2, -2.6], [-L / 2 + 1.2, 0.3], [-L / 3, 0.9], [L / 3, 0.9], [L / 2 - 0.6, 0.2], [L / 2 + 0.9, -2.9]];
      // the oars (two strokes: blades in and out of the water)
      const oa = fr ? [[-1, -2.4], [-6.4, 1.6]] : [[1, -2.4], [6.6, 1.4]];
      g.line(oa, 0.45, C.brown); g.ell(oa[1][0], oa[1][1], 0.9, 0.32, C.dun, 0.2, fr ? -0.6 : 0.6);
      if (o.crew) FA.person(g, Object.assign({}, o.crew, { pose: 'row', hip: [0, -2.0], h: 12, arms: ['row', 'row'] }));
      g.shape(hull, hullC, 0.45); g.hatch(hull, 15, 0.7);
      g.line([[-L / 2 + 0.6, -1.7], [L / 2 - 0.2, -1.9]], 0.28, col(o.trim, C.madder));
      if (her) { const fl = [[L / 2 - 0.4, -6.6], [L / 2 + 3.4, -6.3], [L / 2 + 2.6, -5.4], [L / 2 + 3.4, -4.5], [L / 2 - 0.4, -4.6]]; g.line([[L / 2 - 0.4, -2.6], [L / 2 - 0.4, -7]], 0.35, C.brown); device(g, fl, her, [L / 2 - 0.4, -6.6, L / 2 + 3.4, -4.5]); g.shape(fl, null, 0.25); }
      waves(g, -L / 2 - 2.5, L / 2 + 3, 1.6, 2); g.restore(); return;
    }
    if (kind === 'longship') {
      const L = 26, Hh = 2.6;
      // oars below the shields
      for (let i = 0; i < 6; i++) { const x = -L / 3 + i * L / 7.5, d = fr ? 1.6 : -1.2; g.line([[x, -Hh * 0.4], [x + d, 1.8]], 0.3, C.brown); }
      mast(g, 0, -Hh, -Hh - 13);
      const sp = [[-5.6, -Hh - 12], [5.6, -Hh - 12], [6.4, -Hh - 6.6], [5.8, -Hh - 2.6], [-5.8, -Hh - 2.6], [-6.4, -Hh - 6.6]];
      g.shape(sp, sail, 0, true);
      // vertical stripes in the traveller's second colour
      g.save(); g.path(sp, true, true, 0); g.x.clip(); g.x.fillStyle = col(her && her.c2, C.white); for (let i = 0; i < 4; i++) g.x.fillRect(-5.6 + i * 3.2, -Hh - 13, 1.5, 12); g.restore();
      g.hatch(sp, 80, 0.9, { smooth: true, side: 1, cut: 2, lw: 0.18 }); g.shape(sp, null, 0.4, true); g.line([[-6.4, -Hh - 12], [6.4, -Hh - 12]], 0.45, C.brown);
      if (o.crew) { g.save(); g.x.translate(-L / 3.4, -Hh + 0.4); FA.person(g, Object.assign({ pose: 'stand', h: 9 }, o.crew)); g.restore(); }
      const hull = [[-L / 2 - 1.2, -Hh - 3.4], [-L / 2 + 0.4, -Hh * 0.3], [-L / 3, Hh * 0.45], [L / 3, Hh * 0.45], [L / 2 - 0.4, -Hh * 0.3], [L / 2 + 1.6, -Hh - 3.6], [L / 2 - 0.6, -Hh], [-L / 2 + 0.6, -Hh]];
      g.shape(hull, hullC, 0.45, true); g.hatch(hull, 15, 0.7, { smooth: true });
      // a curled prow and stern (a plain scroll, no beast head)
      g.line(arc(L / 2 + 1.0, -Hh - 4.4, 1.1, 1.0, Math.PI * 0.6, Math.PI * 2.2, 8), 0.45, INK, true);
      g.line(arc(-L / 2 - 0.6, -Hh - 4.2, 1.0, 0.9, Math.PI * 0.4, -Math.PI * 1.2, 8), 0.45, INK, true);
      for (let i = 0; i < 6; i++) { const x = -L / 3 + 0.6 + i * L / 7.5; g.ell(x, -Hh * 0.62, 1.15, 1.15, col(i % 2 ? (her && her.c2) : (her && her.c1), i % 2 ? C.ochreLt : C.madder), 0.32); g.dot(x, -Hh * 0.62, 0.32, C.steel); }
      waves(g, -L / 2 - 2, L / 2 + 2.6, Hh * 0.7 + 0.6, 2); g.restore(); return;
    }
    // ships with a deck: cog, caravel, galleon, merchantman, pirate, ghost
    const big = kind === 'galleon' || kind === 'merchant' || kind === 'pirate' || kind === 'ghost';
    const L = kind === 'cog' ? 17 : kind === 'caravel' ? 19 : 24, Hh = kind === 'cog' ? 4.4 : kind === 'caravel' ? 3.6 : 4.6;
    const sternH = big ? 4.2 : kind === 'cog' ? 3.4 : 2.6, bowH = big ? 2.2 : kind === 'cog' ? 2.6 : 0.8;
    const hull = big
      ? [[-L / 2 - 0.4, -Hh - sternH], [-L / 2 + 0.8, -Hh - sternH], [-L / 2 + 1.0, -Hh], [L / 2 - 4, -Hh], [L / 2 - 2.6, -Hh - bowH], [L / 2 + 0.6, -Hh - bowH], [L / 2 + 3.6, -Hh - 0.6], [L / 2, -Hh * 0.4], [L / 3, Hh * 0.38], [-L / 3, Hh * 0.38], [-L / 2 + 0.2, -Hh * 0.2]]
      : kind === 'cog'
        ? [[-L / 2, -Hh - sternH], [-L / 2 + 3.6, -Hh - sternH], [-L / 2 + 3.6, -Hh], [L / 2 - 3, -Hh], [L / 2 - 3, -Hh - bowH], [L / 2 + 0.4, -Hh - bowH], [L / 2 + 0.8, -Hh * 0.6], [L / 3, Hh * 0.45], [-L / 3, Hh * 0.45], [-L / 2 - 0.4, -Hh * 0.5]]
        : [[-L / 2 - 0.2, -Hh - sternH], [-L / 2 + 3.8, -Hh - sternH], [-L / 2 + 3.8, -Hh], [L / 2 + 1.6, -Hh - bowH], [L / 2, -Hh * 0.2], [L / 3, Hh * 0.45], [-L / 3, Hh * 0.45], [-L / 2 + 0.2, -Hh * 0.3]];
    const ghost = kind === 'ghost', pirate = kind === 'pirate';
    const sailC = ghost ? 'rgba(214,226,214,0.7)' : pirate ? '#3B342E' : sail;
    if (ghost) g.x.globalAlpha = 0.85;
    // rigging behind the sails
    if (big) { g.line([[-L / 2 + 0.4, -Hh - sternH], [-L / 2 + 6, -Hh - 21]], 0.2); g.line([[L / 2 + 3.6, -Hh - 0.6], [L / 2 - 4.6, -Hh - 17]], 0.2); }
    if (kind === 'cog') {
      mast(g, 0, -Hh, -Hh - 15); g.line([[-L / 2 + 1, -Hh - sternH], [0, -Hh - 14]], 0.2); g.line([[L / 2, -Hh - bowH], [0, -Hh - 14]], 0.2);
      squareSail(g, 0, -Hh - 13.4, 10, 8.6, sailC, her && !ghost ? her : null, 1.4);
      g.ell(0, -Hh - 15.4, 1.3, 0.7, C.brown, 0.3);   // the top
      pennant(g, 0, -Hh - 17.4, her ? her.c1 : 'madder', 4.6); mast(g, 0, -Hh - 15, -Hh - 17.6, 0.35);
    } else if (kind === 'caravel') {
      mast(g, 2.4, -Hh, -Hh - 15); mast(g, -4.4, -Hh, -Hh - 11);
      lateen(g, 2.4, -Hh - 1, 13.6, sailC, her && !ghost ? her : null);
      lateen(g, -4.4, -Hh - 1.6, 9.4, sailC, null);
      pennant(g, 2.4, -Hh - 15.6, her ? her.c1 : 'madder', 4); mast(g, 2.4, -Hh - 14, -Hh - 16, 0.35);
    } else {
      // galleon, merchantman, pirate and ghost: three masts, square courses and topsails, a lateen mizzen
      const ms = [[L / 2 - 6.2, 17], [0.4, 21], [-L / 2 + 5.4, 14]];
      for (const [x, hh] of ms) mast(g, x, -Hh, -Hh - hh, 0.5);
      lateen(g, ms[2][0], -Hh - 2.4, 10.4, sailC, null);
      if (ghost) {   // tattered sails
        for (const [x, top, w, hh] of [[ms[0][0], -Hh - 15, 7.4, 5.6], [ms[1][0], -Hh - 19, 9, 6.4], [ms[1][0], -Hh - 11.4, 10, 5.6]]) {
          const pts = [[x - w / 2, top], [x + w / 2, top], [x + w / 2 + 0.4, top + hh * 0.7], [x + w / 4, top + hh * 0.5], [x + w / 8, top + hh], [x - w / 6, top + hh * 0.55], [x - w / 2 + 0.3, top + hh * 0.9]];
          g.shape(pts, sailC, 0.32); g.line([[x - w / 2 - 0.6, top], [x + w / 2 + 0.6, top]], 0.35, C.brown);
        }
      } else {
        squareSail(g, ms[0][0], -Hh - 15.4, 7.6, 5.4, sailC, null, 1.0);
        squareSail(g, ms[0][0], -Hh - 9.4, 9, 5.6, sailC, null, 1.2);
        squareSail(g, ms[1][0], -Hh - 19.4, 8.8, 6, sailC, null, 1.0);
        squareSail(g, ms[1][0], -Hh - 12.6, 10.6, 7.4, sailC, her && !pirate ? her : null, 1.4);
        if (!her && !pirate) { const cx = ms[1][0], cy = -Hh - 9; g.line([[cx, cy - 2.6], [cx, cy + 2.6]], 0.7, C.madder); g.line([[cx - 2.4, cy], [cx + 2.4, cy]], 0.7, C.madder); }
      }
      // flags: a long pennant from the main, a flag at the stern
      if (pirate) {
        mast(g, ms[1][0], -Hh - 21, -Hh - 23.6, 0.35);
        const fl = [[ms[1][0], -Hh - 23.6], [ms[1][0] + 5.4, -Hh - 23.4], [ms[1][0] + 5.2, -Hh - 20], [ms[1][0], -Hh - 20.2]];
        g.shape(fl, '#1F1A17', 0.3);
        const sx = ms[1][0] + 2.7, sy = -Hh - 22.2;
        g.ell(sx, sy, 0.95, 0.85, C.bone, 0); g.dot(sx - 0.35, sy - 0.05, 0.22, '#1F1A17'); g.dot(sx + 0.35, sy - 0.05, 0.22, '#1F1A17');
        g.line([[sx - 1.3, sy + 0.9], [sx + 1.3, sy + 1.9]], 0.3, C.bone); g.line([[sx + 1.3, sy + 0.9], [sx - 1.3, sy + 1.9]], 0.3, C.bone);
      } else if (!ghost) { mast(g, ms[1][0], -Hh - 21, -Hh - 23, 0.35); pennant(g, ms[1][0], -Hh - 23, her ? her.c1 : 'madder', 6.4); }
      if (!ghost) { g.line([[-L / 2 - 0.2, -Hh - sternH], [-L / 2 - 1.6, -Hh - sternH - 4.6]], 0.3, C.brown); const sf = [[-L / 2 - 1.6, -Hh - sternH - 4.6], [-L / 2 - 4.8, -Hh - sternH - 4.4], [-L / 2 - 4.8, -Hh - sternH - 2.6], [-L / 2 - 1.6, -Hh - sternH - 2.8]]; if (her && !pirate) device(g, sf, her, [-L / 2 - 4.8, -Hh - sternH - 4.6, -L / 2 - 1.6, -Hh - sternH - 2.6]); else g.shape(sf, pirate ? '#1F1A17' : C.madder, 0); g.shape(sf, null, 0.25); }
    }
    // the crew on deck (the traveller) before the hull, so the rail hides the legs
    if (o.crew) { g.save(); g.x.translate(kind === 'caravel' ? -1.6 : big ? -3 : -2.6, -Hh + 2.6); FA.person(g, Object.assign({ pose: 'stand', h: 9.2 }, o.crew)); g.restore(); }
    g.shape(hull, ghost ? 'rgba(196,206,196,0.75)' : pirate ? '#4A3B30' : hullC, 0.45);
    g.hatch(hull, 15, 0.75, { lw: 0.2 });
    // wales, castles and gunports
    g.line([[-L / 2 + 0.6, -Hh * 0.55], [L / 2 - 0.6, -Hh * 0.6]], 0.28, ghost ? '#8E9A8E' : C.ochre);
    if (big) for (let i = 0; i < 5; i++) g.shape([[-L / 3 + 1 + i * 3.3, -Hh * 0.25 - 0.9], [-L / 3 + 2 + i * 3.3, -Hh * 0.25 - 0.9], [-L / 3 + 2 + i * 3.3, -Hh * 0.25], [-L / 3 + 1 + i * 3.3, -Hh * 0.25]], '#2A211A', 0.15);
    if (kind === 'cog' || big) { for (let i = 0; i < 3; i++) g.line([[-L / 2 + 0.8 + i * 1.2, -Hh - sternH], [-L / 2 + 0.8 + i * 1.2, -Hh - sternH + 1.2]], 0.22); }
    if (ghost) { g.x.globalAlpha = 1; g.ell(0, -Hh - 8, 13, 11, 'rgba(200,230,205,0.12)', 0); }
    if (!o.noWater) waves(g, -L / 2 - 2.5, L / 2 + 3.5, Hh * 0.55 + 0.7, 2);
    g.restore();
  }

  // ---------------------------------------------------------------- creatures of the sea (all original designs)
  const SEA = {
    vessel,
    whale(g, o) {
      const v = o.v || 0, c = o.c || WHALE;
      if (v === 2) {   // diving: the flukes raised above the water, streaming
        g.limb([[0, 0.6], [0.4, -3.4]], 2.4, c);
        const fl = [[0.4, -3.6], [-3.8, -6.4], [-6.6, -6.6], [-4.4, -8.6], [-1.4, -7.4], [0.4, -5.6], [2.2, -7.4], [5.2, -8.6], [7.4, -6.6], [4.6, -6.4]];
        g.shape(fl, c, 0.45, true); g.hatch(fl, 70, 0.7, { smooth: true, lw: 0.2 });
        for (let i = 0; i < 4; i++) g.line([[-4 + i * 2.6, -6.4], [-4.2 + i * 2.6, -4.4 - (i % 2)]], 0.25, WATER, true);
        foam(g, 0.4, 0.2, 7); waves(g, -8, 9, 1.2, 2); return;
      }
      const sperm = v === 0;
      const body = sperm
        ? [[-12, 0], [-12.2, -3.6], [-11, -5.4], [-6, -6.0], [0, -5.6], [5, -4.4], [9, -2.4], [11.6, 0]]
        : [[-11.6, 0], [-11.2, -2.6], [-8.4, -4.8], [-3, -6.2], [2.4, -5.8], [6.6, -4.0], [10, -1.8], [11.6, 0]];
      g.shape(body, c, 0.5, !sperm);
      g.hatch(body, 20, 0.8, { smooth: !sperm, lw: 0.2 });
      g.line(sperm ? [[-12, -1.6], [-7.6, -1.2]] : [[-11.2, -1.4], [-7.4, -0.8], [-5.6, -1.6]], 0.32, INK, true);
      g.dot(sperm ? -8.8 : -7.6, -2.8, 0.42); g.dot(sperm ? -8.8 : -7.6, -2.8, 0.15, FOAM);
      if (!sperm) for (let i = 0; i < 4; i++) g.dot(-9.6 + i * 1.3, -4.0 - i * 0.6, 0.35, WHALE_LT);   // knobs on the head
      if (!sperm) { const fp = [[-4.6, -1.0], [-7.6, 1.6], [-8.4, 3.0], [-6.6, 2.4], [-3.6, -0.2]]; g.shape(fp, WHALE_LT, 0.38, true); }
      // tail stock and flukes rising behind
      const tail = [[9.6, -1.6], [12.6, -3.6], [13.4, -5.6], [11.2, -8.0], [13.8, -7.2], [15, -6.0], [16.4, -7.6], [19.0, -8.0], [15.4, -4.4], [12.6, -0.6]];
      g.shape(tail, c, 0.45, true); g.hatch(tail, 70, 0.7, { smooth: true, lw: 0.2 });
      g.dot(sperm ? -10.2 : -5.6, sperm ? -5.4 : -6.0, 0.35);   // blowhole
      if (o.spout !== false) {   // a forked spout of spray
        const bx = sperm ? -10.6 : -5.6, by = sperm ? -5.8 : -6.4, lean = sperm ? -1 : 0;
        for (const s of [-1, 1]) { g.line([[bx, by], [bx + s * 1.2 + lean, by - 4], [bx + s * 3 + lean, by - 6.4], [bx + s * 4.6 + lean, by - 6.6]], 0.42, WATER, true); }
        for (let i = 0; i < 6; i++) g.dot(bx + lean + (i - 2.5) * 1.6, by - 6.6 - (i % 2) * 0.9, 0.32, '#7FA3C4');
      }
      foam(g, -10, 0.3, 4); waves(g, -14, 18, 1.3, 2);
    },
    dolphin(g, o) {
      // two dolphins leaping in arcs, one ahead of the other
      const c = o.c || DOLPH;
      const one = (x, y, s) => {
        const b = [[x - 6 * s, y + 1.4 * s], [x - 4.4 * s, y - 1.6 * s], [x - 1.2 * s, y - 3.6 * s], [x + 2.4 * s, y - 3.6 * s], [x + 5.2 * s, y - 2.2 * s], [x + 7.4 * s, y - 0.6 * s], [x + 5.4 * s, y - 0.8 * s], [x + 2.4 * s, y - 1.6 * s], [x - 1.4 * s, y - 1.2 * s], [x - 4.2 * s, y + 0.2 * s]];
        g.shape(b, c, 0.42, true);
        g.shape([[x + 2.4 * s, y - 1.7 * s], [x - 1.4 * s, y - 1.3 * s], [x - 4.0 * s, y + 0.2 * s], [x - 1.0 * s, y - 2.2 * s]], '#D9DFE2', 0, true);   // pale belly
        g.shape([[x - 0.4 * s, y - 3.5 * s], [x - 2.2 * s, y - 6.0 * s], [x + 1.4 * s, y - 3.7 * s]], c, 0.35, true);   // dorsal fin
        g.shape([[x - 6 * s, y + 1.4 * s], [x - 8.2 * s, y + 0.2 * s], [x - 7.6 * s, y + 2.8 * s]], c, 0.35);   // flukes
        g.dot(x + 4.4 * s, y - 2.2 * s, 0.28 * s);
        g.line([[x + 1 * s, y - 1.9 * s], [x + 2 * s, y + 0.2 * s]], 0.3, c);   // flipper
      };
      one(-3.4, -3.6, 0.95); one(6.6, -1.2, 0.8);
      g.line(arc(-3.4, 0, 9, 4.6, Math.PI * 1.05, Math.PI * 1.25, 4), 0.25, WATER, true);
      foam(g, -10.4, 0.8, 4); foam(g, 1.6, 0.8, 4); waves(g, -13, 13, 1.6, 2);
    },
    flyfish(g) {
      // flying fish skimming the waves, wing fins spread
      const one = (x, y, s) => {
        g.shape([[x - 4 * s, y], [x - 1 * s, y - 1 * s], [x + 3.4 * s, y - 0.6 * s], [x + 4.4 * s, y], [x + 3.4 * s, y + 0.6 * s], [x - 1 * s, y + 0.8 * s]], SILVER, 0.32, true);
        g.shape([[x - 4 * s, y], [x - 5.6 * s, y - 1.2 * s], [x - 5.2 * s, y + 1.4 * s]], SILVER, 0.25);
        const wg = [[x + 1.6 * s, y - 0.6 * s], [x - 1.6 * s, y - 4.4 * s], [x - 3.0 * s, y - 3.6 * s], [x - 1.4 * s, y - 0.6 * s]];
        g.shape(wg, 'rgba(200,215,225,0.85)', 0.28, true); for (let i = 0; i < 3; i++) g.line([[x + 0.8 * s - i * 0.6 * s, y - 0.6 * s], [x - 1.4 * s - i * 0.5 * s, y - 4.0 * s + i * 0.3 * s]], 0.15);
        g.dot(x + 2.8 * s, y - 0.2 * s, 0.22 * s);
      };
      one(-5, -5.4, 0.9); one(3, -7.4, 0.8); one(7.4, -3.4, 0.7);
      for (let i = 0; i < 3; i++) g.line([[-12 + i * 2, -3.6 + i * 0.8], [-9.6 + i * 2, -3.8 + i * 0.8]], 0.2, WATER);   // spray trail
      waves(g, -12, 12, 0.6, 2);
    },
    seaserpent(g, o) {
      // a long banded serpent in coils, finned crest, open jaw
      const c = col(o.c, '#5F7F68'), band = col(o.c2, C.madder), belly = '#D8CC9A';
      const humps = [[-12, 3.6], [-5, 4.6], [2.2, 3.8]];
      humps.forEach(([x, h]) => {
        // each coil an arched tube of the body, banded, with a fin on its crown
        const pts = arc(x, 0.8, 3.0, h, Math.PI, Math.PI * 2, 14);
        g.limb(pts, 2.3, c, true);
        g.line(arc(x, 0.8, 2.3, h - 0.7, Math.PI * 1.1, Math.PI * 1.45, 4), 0.25, 'rgba(43,33,25,0.5)', true);
        for (let k = 1; k < 6; k++) { const a = Math.PI + k * Math.PI / 6, px = x + Math.cos(a) * 3.0, py = 0.8 + Math.sin(a) * h, nx = Math.cos(a), ny = Math.sin(a) * h / 3; const L = Math.hypot(nx, ny); g.line([[px - nx / L * 1.05, py - ny / L * 1.05], [px + nx / L * 1.05, py + ny / L * 1.05]], 0.32, k % 2 ? band : belly); }
        g.shape([[x - 1.0, 0.8 - h - 1.0], [x - 0.2, 0.8 - h - 2.8], [x + 1.0, 0.8 - h - 1.0]], band, 0.25);
        foam(g, x - 3.4, 0.9, 2); foam(g, x + 3.0, 0.9, 2);
      });
      // the neck rising and the head turned back over the coils
      g.limb([[7.8, 0.4], [8.6, -5], [10.4, -8.4]], 2.4, c, true);
      for (let i = 0; i < 4; i++) g.line([[7.4 + i * 0.6, -1 - i * 2], [8.8 + i * 0.6, -1.4 - i * 2]], 0.3, belly);
      const hd = [[9.4, -9.6], [11.6, -11.2], [15.4, -10.8], [17.2, -9.6], [15.0, -9.0], [16.8, -8.0], [13.4, -7.4], [10.6, -7.6]];
      g.shape(hd, c, 0.45, true);
      g.shape([[15, -9.0], [16.8, -8.0], [13.4, -7.6]], '#8C2E1E', 0);   // the open mouth
      g.dot(12.6, -9.8, 0.42, '#E8C25A'); g.dot(12.7, -9.8, 0.16);
      g.shape([[10.2, -10.4], [9.0, -13.6], [11.0, -11.6], [11.6, -14.4], [12.4, -11.2]], band, 0.3, true);   // finned crest
      g.line([[16.2, -8.6], [16.6, -7.8]], 0.2, FOAM);
      waves(g, -16, 14, 1.6, 2);
    },
    kraken(g) {
      // a great kraken's arms rising round a small ship it has caught
      const c = '#8A4E5A', sk = '#D9A08E';
      const arms = [[-12, 0.6, -16, -8, -11, -14, -7.4, -12], [-6.4, 0.6, -9, -6, -5.6, -9.4, -3.8, -7.6], [7.4, 0.6, 11, -8, 8, -16, 4.6, -15],
        [13, 0.6, 17.4, -6, 15.6, -11, 12.6, -10.4], [2.6, 0.8, 1.2, -4, 4.4, -6.6, 6.4, -5.2]];
      const bez = (q, t) => { const u = 1 - t; return [u * u * u * q[0] + 3 * u * u * t * q[2] + 3 * u * t * t * q[4] + t * t * t * q[6], u * u * u * q[1] + 3 * u * u * t * q[3] + 3 * u * t * t * q[5] + t * t * t * q[7]]; };
      const drawArm = (q, w) => {
        const pts = []; for (let k = 0; k <= 16; k++) pts.push(bez(q, k / 16));
        g.limb(pts.slice(0, 9), w, c, true); g.limb(pts.slice(8, 14), w * 0.7, c, true); g.limb(pts.slice(13), w * 0.45, c, true);
        for (let k = 2; k < 13; k += 2) g.dot(pts[k][0] + (q[6] > q[0] ? 0.45 : -0.45), pts[k][1] + 0.2, 0.26 * (1.2 - k / 16), sk);
        // a curl at the tip
        const e = pts[16], d = pts[15], ang = Math.atan2(e[1] - d[1], e[0] - d[0]), sgn = q[6] > q[0] ? 1 : -1;
        g.line(arc(e[0] + Math.cos(ang + sgn * 1.57) * 0.8, e[1] + Math.sin(ang + sgn * 1.57) * 0.8, 0.8, 0.8, ang - sgn * 1.57, ang - sgn * 1.57 + sgn * 4.4, 8), 0.45, c, true);
      };
      drawArm(arms[0], 1.7); drawArm(arms[3], 1.5);
      g.save(); g.x.translate(1.4, -1.0); g.x.rotate(-0.28);
      vessel(g, { kind: 'cog', sail: 'undyed', noWater: true });
      g.restore();
      drawArm(arms[1], 1.5); drawArm(arms[2], 1.7); drawArm(arms[4], 1.3);
      g.ell(-1.6, 1.2, 5.4, 1.5, c, 0.4);   // the head just under the surface, one great eye showing
      g.dot(-3.2, 0.9, 0.62, '#E8C25A'); g.dot(-3.2, 0.9, 0.26);
      foam(g, -13, 0.8, 3); foam(g, 9, 0.8, 3); waves(g, -18, 19, 1.9, 2);
    },
    berg(g, o) {
      const v = o.v || 0;
      const shapes = [
        [[-8, 0], [-7, -4], [-4.6, -6], [-3.4, -9.6], [-0.4, -11], [1.6, -8], [4, -8.6], [6, -4.4], [8.4, -2], [9, 0]],
        [[-9, 0], [-8.4, -3], [-6, -3.6], [-4, -6.4], [0.4, -6.8], [3, -5], [7.4, -5.4], [9.4, -0.4]],
        [[-6, 0], [-5, -6], [-2.4, -12], [0, -13.6], [1.6, -10], [3.4, -8.6], [5.6, -2.6], [6.6, 0]],
      ];
      const p = shapes[v % 3];
      g.shape(p, '#F7FAFA', 0.45);
      g.hatch(p, 72, 0.75, { side: 1, cut: v === 1 ? 1 : 0.6, c: 'rgba(110,150,185,0.85)', lw: 0.24 });
      g.line([[p[3][0], p[3][1]], [p[3][0] + 0.8, -2]], 0.22, '#8FB0CC');
      // the mass below the water
      g.shape([[-7.6, 0.4], [-5.6, 3.4], [0, 4.6], [6.4, 3], [8.6, 0.4]], 'rgba(143,176,204,0.35)', 0);
      waves(g, -11, 11, 0.6, 2);
    },
    floe(g, o) {
      const v = o.v || 0;
      const fl = [
        [[-11, -1], [-8, -2.6], [-2.4, -2.8], [0, -1.6], [-2, 0.4], [-9.6, 0.6]],
        [[1.2, -2.6], [6, -3.4], [10.6, -2.4], [11, -0.6], [5.6, 0.2], [1.6, -0.6]],
        [[-5, 1.6], [-1.6, 1.0], [2.6, 1.4], [3.6, 2.8], [-1, 3.4], [-4.6, 3]],
      ];
      fl.forEach((p, i) => { if (i === 2 && v === 0) return; g.shape(p, '#F2F6F7', 0.38); g.hatch(p, 0, 0.7, { c: 'rgba(143,176,204,0.6)', lw: 0.18 }); g.line([[p[1][0] + 1, p[1][1] + 0.4], [p[2][0] - 1, p[2][1] + 1.2]], 0.2, '#8FB0CC'); });
      if (v === 1) {   // a seal hauled out on the floe
        g.shape([[-7, -2.4], [-5.6, -4], [-3.6, -4.2], [-2.6, -3.2], [-4, -2.6]], '#7D7A72', 0.32, true); g.dot(-3.4, -3.7, 0.2);
      }
      if (v === 2) {   // a white bear
        const b = [[3, -3], [3.4, -5.4], [6, -6.2], [8.6, -5.8], [9.6, -4.8], [10.6, -4.6], [10.6, -3.8], [9.4, -3.6], [9, -2.8]];
        g.shape(b, '#F4F1E6', 0.36, true); g.dot(9.9, -4.5, 0.18); g.line([[4, -3], [4, -2.4]], 0.6, '#F4F1E6'); g.line([[8, -3], [8, -2.4]], 0.6, '#F4F1E6');
      }
      waves(g, -12, 12, 4.2, 1, 'rgba(61,110,158,0.6)');
    },
    wreck(g, o) {
      // a hull broken in two on a reef, masts snapped, ribs showing
      g.shape([[-11, 0.6], [-8, -1.6], [-4, -1.2], [1, -2.2], [6, -1], [10, -2], [12, 0.6]], C.stone, 0.35, true);   // the reef
      const aft = [[-10.4, -2], [-10, -7.6], [-6, -7.6], [-3.4, -5], [-2.6, -1.6], [-8, -0.8]];
      g.shape(aft, C.russet, 0.45); g.hatch(aft, 15, 0.75, { lw: 0.2 });
      for (let i = 0; i < 4; i++) g.line([[-2.8 - i * 0.2, -5 + i * 1.0], [-1.2 + i * 0.3, -5.4 + i * 1.1]], 0.3, C.brown);   // ribs at the break
      const fore = [[1.6, -1.6], [2.2, -4.4], [6, -5.6], [9.4, -7.6], [10.4, -6.6], [9.4, -1.4]];
      g.shape(fore, C.russet, 0.45); g.hatch(fore, 15, 0.75, { lw: 0.2 });
      for (let i = 0; i < 4; i++) g.line([[2.0, -4.2 + i * 0.7], [0.6, -4.6 + i * 0.8]], 0.3, C.brown);
      g.limb([[-6.6, -7.4], [-9.6, -15]], 0.5, C.brown); g.line([[-9.6, -15], [-7, -14]], 0.4, C.brown);   // snapped masts
      g.limb([[6.4, -5.6], [10.6, -11.4]], 0.5, C.brown);
      const rag = [[-9, -13.6], [-5.6, -12.6], [-6.4, -10.4], [-7.6, -11.2], [-8.6, -9.4]];
      g.shape(rag, C.undyed, 0.3); g.line([[-9.4, -14.6], [-12, -10]], 0.2);
      if (o.chest) {   // a treasure chest spilling coins on the reef
        const cx = 13.4, cy = -0.4;
        g.shape([[cx - 3, cy], [cx - 3, cy - 2.8], [cx + 3, cy - 2.8], [cx + 3, cy]], C.russet, 0.4);
        g.shape([[cx - 3, cy - 2.8], [cx - 2.4, cy - 4.8], [cx + 2.4, cy - 5.2], [cx + 3, cy - 2.8]], '#7A4A2C', 0.4, true);
        g.line([[cx - 3, cy - 1.6], [cx + 3, cy - 1.6]], 0.35, C.gold); g.line([[cx, cy - 2.8], [cx, cy]], 0.35, C.gold);
        g.dot(cx, cy - 2.2, 0.35, C.gold);
        for (let i = 0; i < 7; i++) g.ell(cx - 2.2 + i * 0.8 + (i % 2) * 0.3, cy - 3.0 - (i % 3) * 0.4, 0.55, 0.36, C.gold, 0.15);
        for (let i = 0; i < 4; i++) g.ell(cx + 3.8 + i * 0.9, cy + 0.2 - (i % 2) * 0.3, 0.5, 0.32, C.gold, 0.15);
      }
      waves(g, -14, o.chest ? 18 : 14, 1.6, 2);
    },
    fleet(g, o) {
      // a small fishing fleet: two boats hauling a net between them and one more under sail, with gulls
      const boat = (x, y, s, sailc, dirn) => {
        g.save(); g.x.translate(x, y); g.x.scale(s * dirn, s);
        mast(g, 0, -3, -12, 0.45);
        const sp = [[-0.2, -11.6], [4.6, -4.4], [-0.2, -4.0]];
        g.shape(sp, col(sailc, C.ochre), 0.35); g.hatch(sp, 70, 0.8, { lw: 0.18 });
        const h = [[-5.4, -3.4], [-4.4, 0.2], [3.6, 0.2], [5.6, -3.6]]; g.shape(h, C.brown, 0.4); g.hatch(h, 15, 0.7, { lw: 0.2 });
        g.ell(-2.4, -4.4, 0.8, 0.8, '#F2DCC4', 0.25); g.shape([[-3.2, -3.4], [-2.4, -3.8], [-1.6, -3.4]], C.madder, 0);
        g.restore();
      };
      const v = o.v || 0;
      boat(-8, 0, 0.9, v ? 'madder' : 'ochre', 1); boat(6, 0.4, 0.85, 'ochre', -1);
      // the net slung between them, floats along the head rope
      g.line([[-4.2, -1.6], [-1, 1.6], [3, 1.4], [2.8, -1.4]], 0.3, INK, true);
      for (let i = 0; i < 5; i++) g.line([[-3.6 + i * 1.5, -0.6], [-2.4 + i * 1.4, 1.5]], 0.15);
      for (let i = 0; i < 4; i++) g.dot(-3.2 + i * 1.9, -1.0 + Math.abs(i - 1.5) * 0.3, 0.42, C.madder);
      boat(14, -5, 0.6, v ? 'ochre' : 'madder', 1);
      for (const [x, y] of [[-2, -12], [2.4, -14.2], [9.4, -12.6]]) g.line([[x - 1.2, y + 0.4], [x - 0.4, y - 0.2], [x, y + 0.3], [x + 0.4, y - 0.2], [x + 1.2, y + 0.4]], 0.3, INK, true);
      waves(g, -15, 19, 1.4, 2);
    },
    whirl(g, o) {
      // a whirlpool: spiralling ink lines drawn in towards a dark eye, flecked with foam
      const R = o.r || 9;
      for (let k = 0; k < 3; k++) {
        const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = k * 2.094 + t * Math.PI * 2.6, r = R * (1 - t * 0.9); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.55]); }
        g.line(pts, 0.5 - k * 0.08, WATER, true);
        for (let i = 3; i < 36; i += 7) g.line([[pts[i][0], pts[i][1]], [pts[i][0] + 0.6, pts[i][1] - 0.3]], 0.25, FOAM);
      }
      g.ell(0, 0, R * 0.16, R * 0.09, '#1E3A55', 0.2);
    },
    rose(g, o) {
      // a portolan compass rose: eight winds in ink and pale halves, half winds in green, quarter winds in red, a ring
      const R = o.r || 16;
      g.ell(0, 0, R * 0.72, R * 0.72, 'rgba(243,229,191,0.55)', 0.35); g.ell(0, 0, R * 0.62, R * 0.62, null, 0.25);
      for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16; g.line([[Math.sin(a) * R * 0.62, -Math.cos(a) * R * 0.62], [Math.sin(a) * R * 0.72, -Math.cos(a) * R * 0.72]], i % 4 ? 0.12 : 0.25); }
      const pt = (a, len, w, c1, c2) => {
        const tip = [Math.sin(a) * len, -Math.cos(a) * len], l = [Math.sin(a - Math.PI / 2) * w, -Math.cos(a - Math.PI / 2) * w], r = [-l[0], -l[1]];
        g.shape([[0, 0], l, tip], c1, 0.3); g.shape([[0, 0], tip, r], c2, 0.3);
      };
      for (let i = 0; i < 8; i++) pt(i * Math.PI / 4 + Math.PI / 8, R * 0.5, R * 0.07, C.madder, '#E7B9A6');
      for (let i = 0; i < 4; i++) pt(i * Math.PI / 2 + Math.PI / 4, R * 0.68, R * 0.1, C.green, '#C6D3A8');
      for (let i = 0; i < 4; i++) pt(i * Math.PI / 2, R * (i === 0 ? 1.02 : 0.92), R * 0.12, INK, C.paper);
      g.ell(0, 0, R * 0.1, R * 0.1, C.gold, 0.3);
      // a small fleur at north
      const n = -R * 1.02; g.shape([[0, n - 0.4], [-1.2, n - 2.4], [0, n - 3.8], [1.2, n - 2.4]], C.madder, 0.3, true);
    },
    legendisle(g, o) {
      // an island that never was: a coast in dotted ink, little hills and trees, as charts drew doubtful islands
      const v = o.v || 0;
      const outlines = [
        [[-11, 0.6], [-9, -2.4], [-5, -3.4], [-1, -2.6], [3, -3.6], [8, -2.8], [11, -0.4], [8, 2.4], [2, 3.2], [-5, 2.8]],
        [[-9, 0], [-8, -3], [-3, -4.4], [0, -3], [6, -4], [9.4, -1], [7, 2.4], [0, 2.8], [-6, 2.4]],
        [[-10, -1], [-6, -4], [-1, -3.4], [1, -5], [7, -3.6], [10, 0], [6, 3], [-2, 2.6], [-8, 2]],
      ];
      const p = outlines[v % 3];
      g.shape(p, 'rgba(232,214,168,0.85)', 0, true);
      g.path(p, true, true, 0); g.x.setLineDash([0.9, 0.8]); g.x.strokeStyle = INK; g.x.lineWidth = 0.42; g.x.stroke(); g.x.setLineDash([]);
      for (let i = 0; i < 3; i++) { const x = -5 + i * 4.2, hh = 2.2 + (i % 2); g.shape([[x - 2, -0.4], [x, -0.4 - hh], [x + 2, -0.4]], 'rgba(200,180,130,0.6)', 0.3, true); g.hatch([[x - 2, -0.4], [x, -0.4 - hh], [x + 2, -0.4]], 70, 0.6, { side: 1, cut: x, lw: 0.16 }); }
      for (const x of [-8, 7]) { g.line([[x, 0.6], [x, -1.6]], 0.3, C.brown); g.ell(x, -2.4, 1.1, 1, C.sage, 0.28); }
      waves(g, -13, 13, 4.4, 2);
    },
    atlantis(g) {
      // the drowned city: columns and a pediment just breaking the waves
      for (let i = 0; i < 5; i++) { const x = -6 + i * 3, h = 4 + ((i * 5) % 3) * 1.4; g.shape([[x - 0.8, 0.4], [x - 0.8, -h], [x + 0.8, -h], [x + 0.8, 0.4]], C.stone, 0.35); g.line([[x - 1.1, -h], [x + 1.1, -h]], 0.4); }
      g.shape([[-7.4, -6.4], [0, -9.6], [6.2, -7.0], [5.6, -6.2], [-6.6, -5.6]], C.stone, 0.38);
      g.hatch([[-7.4, -6.4], [0, -9.6], [6.2, -7.0], [5.6, -6.2], [-6.6, -5.6]], 70, 0.7, { lw: 0.18 });
      waves(g, -10, 10, 0.4, 3);
    },
    windhead(g, o) {
      // a wind-head: a round face in a cloud, cheeks puffed, blowing streams of breath to the right
      const cl = [[-9, 3], [-11, -1], [-9, -6], [-5, -9], [0, -9.6], [4, -7], [5.6, -2], [4, 3.6], [0, 6], [-5, 6.4]];
      g.shape(cl, '#F6EEDA', 0.42, true);
      for (const [x, y, r] of [[-8.6, -4, 2.4], [-6, -8, 2.6], [-1, -9, 2.6], [3.4, -6, 2.4], [-9.4, 1.6, 2.2], [-6, 5.2, 2.4], [-1, 5.6, 2.2], [3, 3, 2]]) g.line(arc(x, y, r, r, Math.PI * 0.9, Math.PI * 2.1, 6), 0.3, INK, true);
      const sk = '#EFD5BC';
      g.ell(-1, -1.4, 4.6, 5, sk, 0.42);
      g.ell(1.8, 0.4, 1.9, 1.7, '#E8B9A0', 0.25);   // the puffed cheek
      g.line([[-2.6, -3.2], [-1.4, -3.6], [-0.2, -3.2]], 0.3, INK, true);   // closed eye, straining
      g.line([[-3.6, -4.6], [-1.6, -5.6]], 0.3);
      g.ell(3.4, -0.6, 0.8, 0.6, '#B0574A', 0.3);   // pursed lips
      for (let i = 0; i < 6; i++) g.line([[-5 + i * 1.4, -6.2], [-4.6 + i * 1.6, -8.2 + (i % 2) * 0.4]], 0.3, '#8A6A4E');   // windblown hair
      const n = o.breath === undefined ? 1 : o.breath;
      for (let i = 0; i < 4; i++) { const y = -1.8 + i * 1.1, L = (8 + i * 1.6) * n; g.line([[4.4, -0.6], [4.4 + L * 0.4, y - 0.4], [4.4 + L * 0.75, y + 0.3], [4.4 + L, y]], 0.32, 'rgba(61,110,158,0.75)', true); }
    },
    storm(g, o) {
      // a storm: a dark rolling cloud, slanting rain and a forked flash
      const cl = [[-14, 2], [-15, -2], [-12, -6], [-6, -8], [0, -9], [6, -7.6], [12, -6], [15, -2], [13, 2]];
      g.shape(cl, 'rgba(92,94,98,0.82)', 0.45, true);
      g.hatch(cl, 30, 0.8, { smooth: true, c: 'rgba(30,28,26,0.55)', lw: 0.25 });
      for (const [x, y, r] of [[-11, -4, 3.4], [-5, -6.6, 3.6], [1.6, -7, 3.6], [8, -5, 3.4], [12.6, -1.6, 2.4]]) g.line(arc(x, y, r, r, Math.PI, Math.PI * 2, 6), 0.32, INK, true);
      for (let i = 0; i < 12; i++) { const x = -12 + i * 2.2; g.line([[x, 2.6 + (i % 3)], [x - 2.4, 9 + (i % 2) * 2]], 0.3, 'rgba(61,110,158,0.75)'); }
      if (o.flash !== false) { const f = [[3, 1.6], [1.4, 5.6], [3.4, 5.4], [1.8, 10.4], [5.4, 4.4], [3.4, 4.6], [5, 1.6]]; g.shape(f, '#F4D06A', 0.3); }
    },
    bottle(g) {
      // a green glass bottle bobbing on the swell, a rolled message inside
      g.save(); g.x.rotate(-0.35);
      const b = [[-4.4, -1.6], [2.0, -1.6], [3.2, -1.0], [4.6, -0.8], [4.6, 0.8], [3.2, 1.0], [2.0, 1.6], [-4.4, 1.6], [-4.8, 0]];
      g.shape(b, 'rgba(111,150,112,0.8)', 0.4, true);
      g.shape([[-3, -0.8], [1, -0.8], [1, 0.8], [-3, 0.8]], C.paper, 0.2); g.line([[-2.2, -0.8], [-2.2, 0.8]], 0.15, C.madder);
      g.shape([[4.6, -0.7], [5.6, -0.6], [5.6, 0.6], [4.6, 0.7]], C.brown, 0.25);
      g.line([[-3.6, -1.1], [1.2, -1.1]], 0.25, 'rgba(255,255,255,0.7)');
      g.restore();
      waves(g, -7, 7, 1.4, 2);
    },
    islet(g, o) {
      // a speck of an island with one palm
      g.shape([[-7, 0.4], [-5, -1.4], [-1, -2], [3, -1.6], [6.4, 0.4]], C.ochreLt, 0.4, true);
      g.hatch([[-7, 0.4], [-5, -1.4], [-1, -2], [3, -1.6], [6.4, 0.4]], 0, 0.9, { lw: 0.15, c: 'rgba(156,122,46,0.6)' });
      if (o.palm !== false) {
        g.limb([[3, -1.6], [3.6, -6], [4.8, -10]], 0.7, C.brown, true);
        for (const [dx, dy] of [[-4.4, -1.4], [-3, 1.4], [3.6, -0.2], [3.6, 2.4], [0.4, -3]]) g.limb([[4.8, -10], [4.8 + dx * 0.55, -10 + dy * 0.6 - 0.8], [4.8 + dx, -10 + dy]], 0.55, C.leaf, true);
        g.dot(4.6, -9.6, 0.4, C.brown); g.dot(5.2, -9.4, 0.4, C.brown);
      }
      waves(g, -10, 10, 1.6, 2);
    },
  };
  Object.assign(FA.CREATURE, SEA);
  // a few set pieces the hidden folk at sea use (data/folk/folk.json: the "sea-" figures)
  FA.SET.bottle = SEA.bottle; FA.SET.islet = SEA.islet;

  // ---------------------------------------------------------------- sprites by id (drawn once each, at 3x)
  const R = (w, h, figs) => ({ w, h, figs });
  const F = (k, x, y, o) => Object.assign({ t: 'creature', k, x, y }, o || {});
  const SPECS = {
    'sea-whale0': R(34, 18, [F('whale', 15, 13, { v: 0 })]), 'sea-whale1': R(34, 18, [F('whale', 15, 13, { v: 1 })]), 'sea-whale2': R(20, 14, [F('whale', 10, 11, { v: 2 })]),
    'sea-whale0-n': R(34, 12, [F('whale', 15, 7, { v: 0, spout: false })]), 'sea-whale1-n': R(34, 12, [F('whale', 15, 7, { v: 1, spout: false })]),
    'sea-dolphin0': R(28, 14, [F('dolphin', 14, 10)]), 'sea-dolphin1': R(28, 14, [F('dolphin', 14, 10, { dir: -1 })]), 'sea-dolphin2': R(28, 14, [F('dolphin', 14, 10, { c: '#6B7E8E' })]),
    'sea-flyfish0': R(26, 12, [F('flyfish', 13, 9)]), 'sea-flyfish1': R(26, 12, [F('flyfish', 13, 9, { dir: -1 })]), 'sea-flyfish2': R(26, 12, [F('flyfish', 13, 9)]),
    'sea-serpent0': R(36, 20, [F('seaserpent', 17, 15)]), 'sea-serpent1': R(36, 20, [F('seaserpent', 19, 15, { dir: -1, c: '#5E7363', c2: 'ochre' })]), 'sea-serpent2': R(36, 20, [F('seaserpent', 17, 15, { c: '#6E7F5A', c2: 'woadDk' })]),
    'sea-kraken0': R(40, 32, [F('kraken', 20, 27)]), 'sea-kraken1': R(40, 32, [F('kraken', 20, 27, { dir: -1 })]), 'sea-kraken2': R(40, 32, [F('kraken', 20, 27)]),
    'sea-berg0': R(22, 16, [F('berg', 11, 12, { v: 0 })]), 'sea-berg1': R(22, 12, [F('berg', 11, 8, { v: 1 })]), 'sea-berg2': R(18, 19, [F('berg', 9, 15, { v: 2 })]),
    'sea-floe0': R(26, 10, [F('floe', 13, 5, { v: 0 })]), 'sea-floe1': R(26, 12, [F('floe', 13, 6, { v: 1 })]), 'sea-floe2': R(26, 12, [F('floe', 13, 7, { v: 2 })]),
    'sea-ghost': R(36, 34, [F('vessel', 17, 28, { kind: 'ghost' })]),
    'sea-pirate': R(36, 34, [F('vessel', 17, 28, { kind: 'pirate', hull: '#4A3B30' })]),
    'sea-merchant': R(36, 34, [F('vessel', 17, 28, { kind: 'merchant', sail: 'undyed' })]), 'sea-merchant-l': R(36, 34, [F('vessel', 17, 28, { kind: 'merchant', sail: 'undyed', dir: -1 })]),
    'sea-wreck': R(30, 20, [F('wreck', 14, 16)]), 'sea-wreckchest': R(38, 20, [F('wreck', 14, 16, { chest: true })]),
    'sea-fleet0': R(38, 22, [F('fleet', 17, 18, { v: 0 })]), 'sea-fleet1': R(38, 22, [F('fleet', 17, 18, { v: 1 })]),
    'sea-whirl': R(22, 14, [F('whirl', 11, 7)]),
    'sea-rose': R(40, 44, [F('rose', 20, 23, { r: 18 })]),
    'sea-legend0': R(28, 12, [F('legendisle', 14, 6, { v: 0 })]), 'sea-legend1': R(28, 12, [F('legendisle', 14, 6, { v: 1 })]), 'sea-legend2': R(28, 12, [F('legendisle', 14, 6, { v: 2 })]),
    'sea-atlantis': R(22, 14, [F('atlantis', 11, 11)]),
    'sea-mermaid': R(26, 20, [{ t: 'creature', k: 'mermaid', x: 10, y: 14, rot: 0 }]),
    'sea-storm': R(34, 24, [F('storm', 17, 10)]),
    'sea-windhead': R(40, 22, [F('windhead', 12, 11)]),
  };
  const cache = new Map();
  function draw(id) {
    if (cache.has(id)) return cache.get(id);
    const sp = SPECS[id]; if (!sp) return null;
    let c = null; try { c = FA.render(sp, SC); } catch (e) { console.warn('sea sprite', id, e); }
    cache.set(id, c); return c;
  }
  function addOne(map, id) {
    if (map.hasImage(id)) return true;
    const c = draw(id); if (!c) return false;
    map.addImage(id, c.getContext('2d').getImageData(0, 0, c.width, c.height), { pixelRatio: SC });
    return true;
  }
  // the traveller's boat in the traveller's colours (frame 0 or 1, facing dir)
  function boat(kind, look, frame, dir) {
    const L = look || {}, crew = { garb: 'tunic', c1: L.cloak || 'madder', c2: 'brown', c3: L.hood || 'woad', hat: 'hood', hatc: L.hood || 'woad', skin: L.skin || 'fair', hair: L.hair || 'brown', cloak: kind === 'rowing' ? false : true, arms: kind === 'rowing' ? ['row', 'row'] : ['fwd', 'down'], prop: kind === 'rowing' ? 'paddle' : null };
    const sizes = { rowing: [26, 16, 12, 12], longship: [36, 24, 18, 20], cog: [30, 30, 15, 25], caravel: [32, 30, 16, 25], galleon: [38, 36, 18, 30] }[kind] || [30, 30, 15, 25];
    return FA.render({ w: sizes[0], h: sizes[1], seed: 7, figs: [F('vessel', sizes[2], sizes[3], { kind, sail: L.cloak || 'undyed', her: L.her, hull: kind === 'longship' ? 'brown' : 'russet', crew, frame, dir })] }, SC);
  }
  global.InkSeaArt = { draw, addOne, boat, vessel, SPECS, SC, ids: () => Object.keys(SPECS) };
})(window);
