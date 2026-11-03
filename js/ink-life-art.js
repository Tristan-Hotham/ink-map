/* The Inked World: countryside and town life, drawn on canvas at load time.
 * Riders, walkers, drovers, packhorses, carts and wagons for the roads; ricks, sheepfolds, grouse butts, peat hags and
 * reeds for the fields and moors; brickworks, mills, forges, kilns and breweries where industry really is; and the modern
 * world turned medieval (cartwrights for car dealers, stables for fuel stations, coaching inns for stations, and so on).
 * Every figure is original and drawn in the map's own pen: brown-black ink outlines, flat muted fills (madder red, ochre,
 * woad blue, sage green, undyed wool), hatching for shade. Sprites are drawn at 3x and registered with pixelRatio 3.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  // TODO(palette): switch to js/ink-palette.js (art branch) once merged; these mirror the INK colours of js/ink-map.js
  const PAL = Object.assign({
    ink: '#2B2119', paper: '#F3E5BF', paperFill: 'rgba(246,236,210,0.97)', red: '#A3261B', redDeep: '#8A1F16',
    blue: '#3D6E9E', blueSoft: '#6F9DC6', ochre: '#B8862B', sage: '#8C9A63', green: '#6E7F45', wool: '#E9DFC6',
    brown: '#7A5634', brownSoft: '#A07A4F', grey: '#8E8778', slate: '#5E6B78', copper: '#B4643A', straw: '#D8B860',
    horse: '#8B5E3C', horseDark: '#4E3423', skin: '#F0D5BC', smoke: 'rgba(90,80,70,0.55)',
  }, (global.InkPalette && global.InkPalette.colors) || {});
  const SC = 3;   // drawing scale: sprites are drawn at 3x and shown at pixelRatio 3

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function hashStr(t) { let h = 2166136261; for (const ch of t) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------------- the pen (logical units; the canvas is SC times larger)
  function Pen(w, h, seed) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC);
    const x = c.getContext('2d', { willReadFrequently: true }); x.scale(SC, SC); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = PAL.ink;
    const R = rng(seed || 7), j = a => (R() - 0.5) * a;
    const p = {
      c, x, R, w, h,
      path(pts, close, jit) { x.beginPath(); const J = jit === undefined ? 0.25 : jit; pts.forEach((q, i) => { const px = q[0] + j(J), py = q[1] + j(J); i ? x.lineTo(px, py) : x.moveTo(px, py); }); if (close) x.closePath(); return p; },
      line(pts, lw, col) { x.lineWidth = lw || 0.8; x.strokeStyle = col || PAL.ink; p.path(pts, false); x.stroke(); x.strokeStyle = PAL.ink; return p; },
      poly(pts, fill, lw, col) { p.path(pts, true); if (fill) { x.fillStyle = fill; x.fill(); } if (lw !== 0) { x.lineWidth = lw || 0.8; x.strokeStyle = col || PAL.ink; x.stroke(); x.strokeStyle = PAL.ink; } return p; },
      rect(x0, y0, w0, h0, fill, lw) { return p.poly([[x0, y0], [x0 + w0, y0], [x0 + w0, y0 + h0], [x0, y0 + h0]], fill, lw); },
      ell(cx, cy, rx, ry, fill, lw, a0, a1, col) {
        const pts = [], s = a0 === undefined ? 0 : a0, e = a1 === undefined ? Math.PI * 2 : a1, n = 22;
        for (let i = 0; i <= n; i++) { const a = s + (e - s) * i / n; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
        if (fill === null) return p.line(pts, lw || 0.7, col);
        x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath();
        if (fill) { x.fillStyle = fill; x.fill(); } if (lw !== 0) { x.lineWidth = lw || 0.7; x.strokeStyle = col || PAL.ink; x.stroke(); x.strokeStyle = PAL.ink; }
        return p;
      },
      dot(px, py, r, col) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fillStyle = col || PAL.ink; x.fill(); return p; },
      hatch(pts, ang, gap, lw, col) {
        x.save(); x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.clip();
        x.strokeStyle = col || PAL.ink; x.lineWidth = lw || 0.35; const a = ang * Math.PI / 180, L = w + h;
        for (let d = -L; d < L; d += gap) {
          const cx = w / 2 + Math.cos(a + Math.PI / 2) * d, cy = h / 2 + Math.sin(a + Math.PI / 2) * d;
          x.beginPath(); x.moveTo(cx - Math.cos(a) * L, cy - Math.sin(a) * L); x.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); x.stroke();
        }
        x.restore(); x.strokeStyle = PAL.ink; return p;
      },
      // a soft ink shadow on the ground, the same in every sprite
      shadow(cx, cy, rx, ry) { x.save(); x.globalAlpha = 0.18; p.ell(cx, cy, rx, ry || rx * 0.28, PAL.ink, 0); x.restore(); return p; },
    };
    return p;
  }
  function mirror(c) { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const x = m.getContext('2d', { willReadFrequently: true }); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return m; }

  // ---------------- figures (facing right; the map uses mirrored copies for travellers going left)
  // a horse in profile; (x, y) = hind hoof on the ground; s = scale; gallop stretches the legs
  function horse(p, x, y, s, o) {
    o = o || {}; const col = o.col || PAL.horse, k = s || 1, g = o.gallop;
    const X = v => x + v * k, Y = v => y - v * k;
    // legs
    const legs = g ? [[[1.5, 4], [-1.5, 0.6]], [[3, 4], [1.6, 0.2]], [[8.6, 4], [11.6, 1.2]], [[9.6, 4], [12.4, 2.4]]]
      : [[[1.6, 4], [1.2, 0]], [[3, 4], [3.2, 0]], [[8.4, 4], [8.6, 0]], [[9.7, 4], [10.2, 0]]];
    for (const [a, b] of legs) p.line([[X(a[0]), Y(a[1])], [X(b[0]), Y(b[1])]], 0.75 * Math.max(0.8, k));
    // body, neck and head
    p.poly([[X(0.4), Y(4.6)], [X(0.8), Y(7)], [X(4), Y(7.6)], [X(8), Y(7.4)], [X(10.2), Y(8.2)], [X(11.4), Y(11)], [X(12.4), Y(11.6)],
      [X(14.2), Y(9.6)], [X(13.6), Y(9)], [X(12.2), Y(9.8)], [X(10.6), Y(6)], [X(10), Y(4.2)], [X(4), Y(3.6)], [X(1), Y(3.8)]], col, 0.7);
    p.line([[X(0.6), Y(6.6)], [X(-0.8), Y(4.2)], [X(-0.6), Y(2.6)]], 0.8, PAL.horseDark);   // tail
    p.line([[X(10.4), Y(8.4)], [X(11.6), Y(11.4)]], 0.7, PAL.horseDark);                  // mane
    p.dot(X(12.7), Y(10.6), 0.28 * k);
    p.hatch([[X(1), Y(4)], [X(10), Y(4.2)], [X(10), Y(5.2)], [X(1), Y(5)]], 0, 0.9 * k, 0.3);
  }
  // a standing or walking person; (x, y) = feet; cloak colour, hood/hat, staff
  function person(p, x, y, s, o) {
    o = o || {}; const k = s || 1, X = v => x + v * k, Y = v => y - v * k;
    const step = o.walk ? 1.1 : 0.5;
    p.line([[X(-0.2), Y(3.2)], [X(-step), Y(0)]], 0.75); p.line([[X(0.4), Y(3.2)], [X(step + 0.2), Y(0)]], 0.75);
    // cloak / tunic: slightly elongated Gothic proportions
    p.poly([[X(-1.6), Y(2.4)], [X(-1.2), Y(7.4)], [X(0), Y(8.4)], [X(1.3), Y(7.4)], [X(1.9), Y(2.4)]], o.col || PAL.red, 0.7);
    if (o.belt) p.line([[X(-1.3), Y(5)], [X(1.5), Y(5)]], 0.5, PAL.ink);
    p.ell(X(0.1), Y(9.5), 1.15 * k, 1.2 * k, PAL.skin, 0.6);
    if (o.hood) p.poly([[X(-1.3), Y(9.2)], [X(-0.6), Y(11.2)], [X(0.9), Y(11)], [X(1.2), Y(9.6)], [X(0.4), Y(10.4)]], o.hood, 0.6);
    if (o.hat === 'pilgrim') { p.ell(X(0.1), Y(10.6), 2.4 * k, 0.6 * k, PAL.brown, 0.6); p.dot(X(0.9), Y(10.7), 0.35 * k, PAL.paper); }
    else if (o.hat === 'cap') p.poly([[X(-1.1), Y(10)], [X(0), Y(11.4)], [X(1.6), Y(10.6)]], o.capCol || PAL.blue, 0.5);
    if (o.staff) p.line([[X(2.4), Y(-0.2)], [X(2.2), Y(11.6)]], 0.7, PAL.brown);
    if (o.pack) p.poly([[X(-2.6), Y(5)], [X(-2.8), Y(8)], [X(-1.2), Y(8.2)], [X(-1.2), Y(5)]], PAL.ochre, 0.55);
    if (o.shell) p.ell(X(-0.4), Y(6.6), 0.7 * k, 0.6 * k, PAL.paper, 0.4);
  }
  // a rider on horseback
  function rider(p, x, y, s, o) {
    o = o || {}; const k = s || 1, X = v => x + v * k, Y = v => y - v * k;
    horse(p, x, y, k, o);
    // the rider: torso and cloak flying back at a gallop
    if (o.gallop) p.poly([[X(5), Y(10)], [X(1), Y(11.4)], [X(2.4), Y(9.4)], [X(4.6), Y(8.4)]], o.cloak || PAL.red, 0.55);
    p.poly([[X(4.4), Y(7.6)], [X(4.6), Y(11.6)], [X(5.6), Y(12.4)], [X(6.8), Y(11.6)], [X(6.8), Y(7.4)]], o.col || PAL.blue, 0.65);
    p.line([[X(5.6), Y(7.4)], [X(6.4), Y(4.6)]], 0.75);                       // leg
    p.ell(X(5.8), Y(13.6), 1.1 * k, 1.15 * k, PAL.skin, 0.55);
    p.poly([[X(4.6), Y(14)], [X(5.8), Y(15.4)], [X(7.2), Y(14.2)]], o.hat || PAL.ink, 0.45);
    p.line([[X(6.6), Y(10.4)], [X(10.8), Y(10.2)]], 0.4);                     // reins
    if (o.lance) { p.line([[X(3), Y(6)], [X(10), Y(20)]], 0.6, PAL.brown); p.poly([[X(9.4), Y(18.6)], [X(11.6), Y(19)], [X(10.4), Y(20.6)]], o.pennon || PAL.red, 0.4); }
    if (o.bag) p.rect(X(3), Y(7.6), 1.8 * k, 2 * k, PAL.ochre, 0.5);
  }
  function sheep(p, x, y, k) {
    k = k || 1;
    p.line([[x + 0.8 * k, y], [x + 0.8 * k, y - 1.4 * k]], 0.5); p.line([[x + 2.6 * k, y], [x + 2.6 * k, y - 1.4 * k]], 0.5);
    p.ell(x + 1.7 * k, y - 2.4 * k, 2 * k, 1.35 * k, PAL.wool, 0.55);
    p.ell(x + 3.9 * k, y - 2.9 * k, 0.75 * k, 0.6 * k, PAL.ink, 0);
  }
  function cow(p, x, y, k, col) {
    k = k || 1;
    for (const lx of [0.8, 1.8, 5, 6]) p.line([[x + lx * k, y], [x + lx * k, y - 2 * k]], 0.55);
    p.poly([[x, y - 2 * k], [x + 0.2 * k, y - 4.6 * k], [x + 6.8 * k, y - 4.8 * k], [x + 7.2 * k, y - 2 * k]], col || PAL.brownSoft, 0.6);
    p.poly([[x + 6.6 * k, y - 4.6 * k], [x + 8.8 * k, y - 4.4 * k], [x + 8.9 * k, y - 3 * k], [x + 7.2 * k, y - 3 * k]], col || PAL.brownSoft, 0.55);
    p.line([[x + 7 * k, y - 4.8 * k], [x + 6.6 * k, y - 5.6 * k]], 0.45); p.line([[x - 0.1 * k, y - 4.2 * k], [x - 0.8 * k, y - 2.2 * k]], 0.45);
  }
  function ox(p, x, y, k) { cow(p, x, y, k, '#C9B08A'); p.line([[x + 6.8 * k, y - 4.8 * k], [x + 7.6 * k, y - 6 * k]], 0.5); }
  // a two-wheeled cart, its bed from x to x + L
  function cart(p, x, y, L, o) {
    o = o || {};
    p.poly([[x, y - 4.6], [x + L, y - 4.6], [x + L - 0.6, y - 2.6], [x + 0.6, y - 2.6]], o.col || PAL.brownSoft, 0.65);
    p.hatch([[x, y - 4.6], [x + L, y - 4.6], [x + L - 0.6, y - 2.6], [x + 0.6, y - 2.6]], 90, 1.2, 0.3);
    if (o.load === 'hay') p.poly([[x + 0.3, y - 4.6], [x + 1, y - 8.4], [x + L * 0.5, y - 9.4], [x + L - 1, y - 8.2], [x + L - 0.3, y - 4.6]], PAL.straw, 0.6);
    if (o.load === 'barrels') { for (let i = 0; i < 2; i++) p.ell(x + 2 + i * 3.2, y - 6.2, 1.4, 1.6, PAL.ochre, 0.55); }
    if (o.load === 'sacks') { for (let i = 0; i < 3; i++) p.ell(x + 1.8 + i * (L - 3.6) / 2, y - 5.8, 1.3, 1.2, PAL.wool, 0.5); }
    if (o.load === 'cover') { p.poly([[x + 0.2, y - 4.6], [x + 0.6, y - 9], [x + L - 0.6, y - 9], [x + L - 0.2, y - 4.6]], PAL.wool, 0.65); for (let i = 1; i < 4; i++) p.line([[x + i * L / 4, y - 4.8], [x + i * L / 4, y - 8.8]], 0.35); }
    if (o.load === 'timber') { for (let i = 0; i < 3; i++) p.line([[x - 1, y - 5.2 - i * 0.9], [x + L + 2, y - 5.4 - i * 0.9]], 0.8, PAL.brown); }
    const wx = x + L * (o.four ? 0.22 : 0.5), wr = o.four ? 1.9 : 2.3;
    p.ell(wx, y - wr, wr, wr, PAL.paperFill, 0.7); p.line([[wx - wr, y - wr], [wx + wr, y - wr]], 0.35); p.line([[wx, y - 2 * wr], [wx, y]], 0.35);
    if (o.four) { const w2 = x + L * 0.8; p.ell(w2, y - wr, wr, wr, PAL.paperFill, 0.7); p.line([[w2 - wr, y - wr], [w2 + wr, y - wr]], 0.35); }
    p.line([[x + L, y - 3.4], [x + L + (o.shaft || 4), y - 4.4]], 0.6);   // shaft forward
  }

  // ---------------- registration helpers
  const ART = [];   // [id, w, h, draw, opts]
  function def(id, w, h, draw, o) { ART.push([id, w, h, draw, o || {}]); }
  function trim(c) {
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return c;
    // keep the bottom edge (the anchor is the ground line), trim the rest with a 2 px margin
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(c.width - 1, x1 + 2);
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = c.height - y0; o.getContext('2d', { willReadFrequently: true }).drawImage(c, -x0, -y0); o._x0 = x0; return o;
  }

  // ================= road life
  // riders
  def('lr-rider', 22, 20, p => { p.shadow(7, 19.3, 7); rider(p, 2, 19, 1, { col: PAL.blue, hat: PAL.red }); });
  def('lr-rider2', 22, 20, p => { p.shadow(7, 19.3, 7); rider(p, 2, 19, 1, { col: PAL.sage, hat: PAL.brown, col2: PAL.horseDark, bag: true }); });
  def('lr-knight', 24, 26, p => { p.shadow(7, 25.3, 7); rider(p, 2, 25, 1, { col: '#9AA3A8', hat: '#9AA3A8', lance: true, pennon: PAL.red, col2: '#E6DCC4' }); });
  def('lr-messenger', 24, 20, p => { p.shadow(8, 19.3, 8); rider(p, 3, 19, 1, { gallop: true, col: PAL.red, cloak: PAL.blue, hat: PAL.ink, bag: true }); });
  // on foot
  def('lr-walker', 10, 15, p => { p.shadow(5, 14.4, 3.5); person(p, 4.6, 14, 1, { walk: true, col: PAL.brownSoft, hood: PAL.sage, staff: true, pack: true }); });
  def('lr-pilgrims', 16, 15, p => { p.shadow(8, 14.4, 6.5); person(p, 4, 14, 1, { walk: true, col: '#8E7D63', hat: 'pilgrim', staff: true, shell: true }); person(p, 10.4, 14, 0.95, { walk: true, col: PAL.wool, hat: 'pilgrim', staff: true, shell: true }); });
  def('lr-pedlar', 20, 16, p => { p.shadow(9, 15.4, 8); person(p, 3.6, 15, 1, { walk: true, col: PAL.red, hat: 'cap', capCol: PAL.ochre, belt: true });
    // a donkey with panniers
    const k = 0.72; horse(p, 7, 15, k, { col: '#9C9182' }); p.rect(9.2, 8.6, 3, 2.6, PAL.ochre, 0.5); p.line([[5.6, 9.6], [16.6, 8]], 0.35); });
  def('lr-friars', 16, 15, p => { p.shadow(8, 14.4, 6.5); person(p, 4, 14, 1, { walk: true, col: '#5C4B3A', hood: '#5C4B3A', belt: true }); person(p, 10.6, 14, 1, { walk: true, col: '#E9E2D0', hood: '#E9E2D0', belt: true }); });
  // drovers and their beasts
  def('lr-sheepdrove', 36, 15, p => { p.shadow(17, 14.4, 15);
    for (const [sx, sy] of [[12, 14], [17, 12.4], [21.4, 14.2], [26, 12.6], [29.6, 14.1], [14.6, 11], [22.4, 10.8]]) sheep(p, sx, sy, 1.15);
    person(p, 4, 14, 1, { walk: true, col: PAL.sage, hood: PAL.brownSoft, staff: true });
    p.ell(9, 13.2, 1.5, 0.8, PAL.ink, 0); p.line([[7.6, 13.5], [7, 14.2]], 0.5); });
  def('lr-cattledrove', 40, 15, p => { p.shadow(18, 14.4, 16);
    cow(p, 9.6, 14, 1.3, PAL.brownSoft); cow(p, 21, 12.8, 1.2, '#E6DCC4'); cow(p, 24.4, 14.6, 1.3, '#6F4E37');
    person(p, 4, 14, 1, { walk: true, col: PAL.red, hood: PAL.brown, staff: true }); });
  def('lr-geese', 20, 12, p => { p.shadow(10, 11.5, 8);
    for (const [gx, gy] of [[9, 11.4], [12.4, 10.6], [15.6, 11.5], [13.8, 9.2]]) { p.ell(gx, gy - 1.4, 1.6, 1, '#F5F0E2', 0.5); p.line([[gx + 1.2, gy - 1.8], [gx + 1.9, gy - 3.6]], 0.6); p.dot(gx + 2.3, gy - 3.6, 0.35, PAL.ochre); }
    person(p, 3.4, 11.4, 0.85, { walk: true, col: PAL.blue, hood: PAL.wool, staff: true }); });
  def('lr-packtrain', 44, 18, p => { p.shadow(22, 17.4, 20);
    for (let i = 0; i < 3; i++) { const x0 = 3 + i * 12.5; horse(p, x0, 17, 0.78, { col: [PAL.horse, '#9C8466', PAL.horseDark][i] }); p.rect(x0 + 2.2, 10.2, 4.4, 3, [PAL.ochre, PAL.wool, PAL.red][i], 0.5); p.line([[x0 + 2.2, 11.6], [x0 + 6.6, 11.6]], 0.3); }
    person(p, 41, 17, 0.9, { walk: true, col: PAL.blue, hood: PAL.brownSoft, staff: true }); });
  // carts and wagons
  def('lr-oxcart', 38, 16, p => { p.shadow(17, 15.4, 15); cart(p, 2, 15, 11, { load: 'hay', shaft: 3.4 }); ox(p, 16.4, 15, 1.3); ox(p, 19.4, 14, 1.2);
    person(p, 33.6, 15, 0.9, { walk: true, col: PAL.sage, hood: PAL.brownSoft, staff: true }); });
  def('lr-cart', 30, 16, p => { p.shadow(15, 15.4, 13); cart(p, 2, 15, 10, { load: 'barrels' }); horse(p, 15, 15, 0.85, { col: PAL.horseDark });
    person(p, 8, 9.6, 0.8, { col: PAL.red, hat: 'cap', capCol: PAL.blue }); });
  def('lr-wagon', 38, 18, p => { p.shadow(19, 17.4, 17); cart(p, 2, 17, 15, { load: 'cover', four: true, shaft: 3 }); horse(p, 20, 17, 0.85, { col: PAL.horse }); horse(p, 22.6, 16.4, 0.8, { col: '#9C8466' }); });
  def('lr-timber', 36, 16, p => { p.shadow(18, 15.4, 16); cart(p, 3, 15, 13, { load: 'timber', four: true, shaft: 3 }); horse(p, 20, 15, 0.85, { col: PAL.horseDark }); });
  def('lr-handcart', 16, 13, p => { p.shadow(8, 12.4, 6.5); cart(p, 1, 12.6, 7, { load: 'sacks', shaft: 2 }); person(p, 12.6, 12.6, 0.85, { walk: true, col: PAL.brownSoft, hat: 'cap', capCol: PAL.red }); });
  def('lr-coach', 36, 19, p => { p.shadow(18, 18.4, 16);
    // a travelling coach: a boxy painted body on four wheels
    p.poly([[2, 13], [2.8, 5.6], [14.6, 5.6], [15.4, 13]], PAL.red, 0.7); p.rect(4.4, 7, 3.6, 3.2, PAL.paperFill, 0.5); p.rect(9.4, 7, 3.6, 3.2, PAL.paperFill, 0.5);
    p.poly([[2.4, 5.6], [8.7, 3.6], [15, 5.6]], PAL.ink, 0.5); p.rect(4, 2.2, 6, 1.6, PAL.ochre, 0.45);
    for (const wx of [4.4, 13]) { p.ell(wx, 15.6, 2.3, 2.3, PAL.paperFill, 0.7); p.line([[wx - 2.3, 15.6], [wx + 2.3, 15.6]], 0.3); p.line([[wx, 13.3], [wx, 17.9]], 0.3); }
    p.line([[15.4, 12], [19, 11]], 0.6); horse(p, 19, 18, 0.82, { col: PAL.horseDark }); horse(p, 21.6, 17.4, 0.78, { col: PAL.horse }); });
  def('lr-sledge', 30, 14, p => { p.shadow(15, 13.4, 13);
    p.poly([[2, 11.4], [12, 11.4], [12.6, 8], [2.6, 8]], PAL.brownSoft, 0.6); p.line([[1, 13], [13.4, 13], [15, 11.6]], 0.8); p.line([[4, 11.4], [4, 13]], 0.5); p.line([[10, 11.4], [10, 13]], 0.5);
    p.ell(7, 7, 3.6, 1.8, PAL.wool, 0.5); horse(p, 15.6, 13.2, 0.8, { col: '#9C8466' }); });
  // on water
  def('lr-barge', 34, 12, p => {
    p.poly([[3, 7.2], [26, 7.2], [29, 5], [30, 7.6], [27, 10.4], [5, 10.4]], PAL.brown, 0.7); p.hatch([[5, 8.2], [27, 8.2], [26, 10.2], [5, 10.2]], 0, 0.8, 0.3);
    p.rect(8, 4.2, 9, 3, PAL.red, 0.55); p.rect(18.4, 5, 5, 2.2, PAL.ochre, 0.5); p.line([[5.2, 7.2], [5.2, 2.4]], 0.6);
    p.line([[1.2, 11.6], [7, 11.2]], 0.35, PAL.blue); p.line([[22, 11.8], [32.4, 11.2]], 0.35, PAL.blue); });
  def('lr-boat', 18, 15, p => {
    p.poly([[2, 10], [16, 10], [13.6, 13.4], [4.2, 13.4]], PAL.brown, 0.65); p.line([[8.6, 10], [8.6, 1.4]], 0.6);
    p.poly([[9, 1.8], [15, 8.6], [9, 8.6]], PAL.red, 0.55); p.poly([[8.2, 2.6], [3.4, 8.6], [8.2, 8.6]], PAL.wool, 0.5);
    p.line([[0.6, 14.4], [5, 14.2]], 0.35, PAL.blue); p.line([[13, 14.4], [17.4, 14.2]], 0.35, PAL.blue); });
  def('lr-coble', 18, 10, p => {   // a small fishing boat drawn up with nets
    p.poly([[1.6, 4.8], [16, 4.4], [14, 8.4], [3.6, 8.6]], PAL.blue, 0.65); p.line([[3, 6], [14.8, 5.8]], 0.3);
    p.line([[5, 4.6], [5.4, 1], [12, 0.8], [12.4, 4.4]], 0.35); for (let i = 0; i < 5; i++) p.line([[6 + i * 1.3, 1], [6 + i * 1.3, 4.4]], 0.25); });
  def('lr-pots', 12, 7, p => { for (const [x0, y0] of [[1.5, 6], [5.5, 6.4], [9, 6], [3.6, 3.6], [7.2, 3.8]]) { p.ell(x0 + 1.4, y0 - 1.4, 1.5, 1.4, PAL.ochre, 0.45, Math.PI, Math.PI * 2); p.line([[x0, y0 - 1.4], [x0 + 2.8, y0 - 1.4]], 0.45); for (let k = 0; k < 3; k++) p.line([[x0 + 0.5 + k * 0.9, y0 - 2.6], [x0 + 0.5 + k * 0.9, y0 - 1.4]], 0.25); } });
  // a small steam train (drawn facing up = north, for rotation along the line by the map)
  def('lr-train', 10, 40, p => {
    p.poly([[2.2, 4], [7.8, 4], [7.8, 14], [2.2, 14]], PAL.ink, 0.6); p.ell(5, 4, 2.8, 2, PAL.ink, 0); p.dot(5, 2.6, 1.1, PAL.red);
    p.rect(2.4, 14.8, 5.2, 4.4, PAL.red, 0.55);
    for (let i = 0; i < 2; i++) { p.rect(1.8, 20.4 + i * 9.4, 6.4, 8.4, i ? PAL.sage : PAL.ochre, 0.6); p.line([[1.8, 22.6 + i * 9.4], [8.2, 22.6 + i * 9.4]], 0.3); p.line([[1.8, 26.6 + i * 9.4], [8.2, 26.6 + i * 9.4]], 0.3); }
  }, { noTrim: true });

  // ================= country: fields, moors, fens
  def('lf-rick', 12, 11, p => { p.shadow(6, 10.4, 5); p.poly([[1.4, 10], [2, 5.4], [6, 1.2], [10, 5.4], [10.6, 10]], PAL.straw, 0.7); p.hatch([[2, 5.4], [6, 1.2], [10, 5.4], [10.6, 10], [1.4, 10]], 70, 1, 0.3, PAL.brown); p.line([[2, 5.6], [10, 5.6]], 0.5); });
  def('lf-stooks', 16, 8, p => { for (const [x0, y0] of [[1, 7.4], [6, 7.6], [11, 7.3], [3.6, 4.6], [8.6, 4.8]]) { p.poly([[x0, y0], [x0 + 1.8, y0 - 3.6], [x0 + 3.6, y0]], PAL.straw, 0.5); p.line([[x0 + 1.8, y0 - 3.6], [x0 + 1.8, y0]], 0.3); } });
  def('lf-fold', 16, 10, p => { p.ell(8, 6, 7, 3.4, 'rgba(233,223,198,0.6)', 0.9); p.ell(8, 6, 7, 3.4, null, 0.4); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; p.dot(8 + Math.cos(a) * 7, 6 + Math.sin(a) * 3.4, 0.45); } sheep(p, 5.6, 7.2, 0.7); sheep(p, 8.6, 6.4, 0.7); });
  def('lf-butt', 10, 6, p => { p.poly([[1, 5], [2, 2.2], [5, 1.2], [8, 2.2], [9, 5], [7, 3.4], [5, 2.8], [3, 3.4]], PAL.grey, 0.6); for (let i = 0; i < 5; i++) p.dot(2 + i * 1.5, 2.6 + Math.abs(i - 2) * 0.4, 0.3); });
  def('lf-hag', 12, 6, p => { p.poly([[1, 5.2], [2.4, 2.4], [5, 1.6], [7.4, 2.6], [8.2, 1.4], [10.6, 2.6], [11, 5.2]], '#6B5A44', 0.6); p.hatch([[1, 5.2], [2.4, 2.4], [5, 1.6], [7.4, 2.6], [8.2, 1.4], [10.6, 2.6], [11, 5.2]], 80, 0.8, 0.3); p.line([[0.2, 5.4], [11.8, 5.4]], 0.4); });
  def('lf-cairn', 7, 8, p => { p.poly([[1, 7.4], [1.6, 4.4], [3.4, 1], [5.4, 4.4], [6, 7.4]], PAL.grey, 0.6); p.line([[1.6, 4.6], [5.4, 4.6]], 0.35); p.line([[1.2, 6], [5.8, 6]], 0.35); p.line([[2.6, 2.8], [4.4, 2.8]], 0.35); });
  def('lf-shepherd', 20, 14, p => { p.shadow(9, 13.5, 8); person(p, 4, 13.4, 0.95, { col: PAL.wool, hood: PAL.brownSoft, staff: true }); sheep(p, 7.6, 13.4, 1.1); sheep(p, 12, 11.8, 1.05); sheep(p, 12.6, 13.9, 1.1); });
  for (let v = 0; v < 2; v++) def('lf-htree' + v, 9, 11, p => { p.shadow(4.6, 10.6, 3.4); p.line([[4.5, 10.6], [4.5, 6.6]], 0.7, PAL.brown);
    const R = p.R; const pts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = (v ? 3.3 : 3.8) + (R() - 0.5) * 0.9; pts.push([4.5 + Math.cos(a) * r, 4.6 + Math.sin(a) * r * 0.9]); }
    p.poly(pts, v ? '#93A06A' : '#A2AC74', 0.6); p.hatch(pts.map(q => [q[0] + 1.6, q[1] + 1.4]), 60, 0.9, 0.3); });
  def('lf-scarecrow', 9, 13, p => { p.line([[4.5, 13], [4.5, 3]], 0.7, PAL.brown); p.line([[0.6, 5.6], [8.4, 5.6]], 0.6, PAL.brown); p.poly([[2.2, 5], [6.8, 5], [6, 9.6], [3, 9.6]], PAL.red, 0.55); p.ell(4.5, 3.2, 1.3, 1.3, PAL.straw, 0.5); p.poly([[2.4, 2.6], [4.5, 0.6], [6.6, 2.6]], PAL.ink, 0.4); p.line([[1, 4.4], [8, 4.4]], 0.3, PAL.straw); });
  def('lf-beehives', 12, 7, p => { for (const bx of [2.6, 6, 9.4]) { p.ell(bx, 5.6, 1.8, 2.8, PAL.straw, 0.5, Math.PI, Math.PI * 2); p.line([[bx - 1.8, 5.6], [bx + 1.8, 5.6]], 0.4); p.line([[bx - 1.5, 4.2], [bx + 1.5, 4.2]], 0.25); p.dot(bx, 5, 0.35); } });
  for (let v = 0; v < 3; v++) def('lf-reed' + v, 10, 9, p => {
    const R = p.R; for (let i = 0; i < 6; i++) { const x0 = 1.5 + i * 1.3 + (R() - 0.5), h = 4 + R() * 3.6; p.line([[x0, 8.6], [x0 + (R() - 0.5) * 1.4, 8.6 - h]], 0.45, PAL.green); if (i % 2 === v % 2) p.ell(x0 + (R() - 0.5), 8.6 - h + 0.6, 0.45, 1.1, PAL.brown, 0); }
    p.line([[0.4, 8.8], [9.6, 8.8]], 0.35, PAL.blue); });
  for (let v = 0; v < 3; v++) def('lf-mud' + v, 12, 6, p => {
    const R = p.R; for (let i = 0; i < 3; i++) { const y = 1.6 + i * 1.6, x0 = 1 + R() * 3 + (i % 2) * 2, L = 4 + R() * 4; p.line([[x0, y], [x0 + L * 0.5, y - 0.3], [x0 + L, y]], 0.45, 'rgba(122,98,66,0.85)'); }
    p.ell(8 + v, 4.4, 1.4, 0.45, 'rgba(61,110,158,0.45)', 0); });
  def('lf-windpump', 14, 22, p => { p.shadow(7, 21.4, 5);
    p.poly([[4.6, 21], [5.4, 9], [8.6, 9], [9.4, 21]], PAL.paperFill, 0.7); p.hatch([[7.4, 9], [8.6, 9], [9.4, 21], [7.6, 21]], 80, 0.9, 0.3); p.poly([[4.8, 9.2], [7, 6.6], [9.2, 9.2]], PAL.ink, 0.5);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, ex = 7 + Math.cos(a) * 6.4, ey = 7.6 + Math.sin(a) * 6.4; p.line([[7, 7.6], [ex, ey]], 0.55); const nx = -Math.sin(a), ny = Math.cos(a); p.poly([[7 + Math.cos(a) * 1.6, 7.6 + Math.sin(a) * 1.6], [ex, ey], [ex + nx * 1.4, ey + ny * 1.4], [7 + Math.cos(a) * 1.6 + nx * 1.4, 7.6 + Math.sin(a) * 1.6 + ny * 1.4]], PAL.wool, 0.35); }
    p.line([[2, 21.2], [12, 21.2]], 0.4, PAL.blue); });
  def('lf-heron', 8, 12, p => { p.line([[3.6, 11.6], [3.8, 7.4]], 0.4); p.line([[4.6, 11.6], [4.4, 7.4]], 0.4); p.ell(4.4, 6.4, 2.2, 1.4, '#C9CFD3', 0.5); p.line([[5.8, 5.6], [6, 3], [5.4, 1.8], [7.8, 1.6]], 0.55); p.line([[0.6, 11.8], [7.4, 11.8]], 0.35, PAL.blue); });
  def('lf-wildfowl', 16, 7, p => { for (const [dx, dy] of [[2, 4], [6.4, 5.2], [10.6, 3.8], [13, 5.8]]) { p.ell(dx + 1.2, dy, 1.6, 0.9, PAL.brownSoft, 0.45); p.ell(dx + 2.6, dy - 1, 0.6, 0.6, PAL.green, 0.35); p.line([[dx - 0.8, dy + 1.2], [dx + 3.4, dy + 1.1]], 0.3, PAL.blue); } });

  // ================= early industry (where OpenStreetMap maps industrial land and works)
  // a tall chimney, its top at (x, top)
  function chimney(p, x, base, top, w) { w = w || 2.2; p.poly([[x - w * 0.62, base], [x - w * 0.42, top], [x + w * 0.42, top], [x + w * 0.62, base]], '#A86A4A', 0.65); p.hatch([[x, top], [x + w * 0.42, top], [x + w * 0.62, base], [x, base]], 80, 0.9, 0.3); p.rect(x - w * 0.55, top - 0.8, w * 1.1, 0.9, '#8C5238', 0.5); for (let y = base - 3; y > top + 1; y -= 3) p.line([[x - w * 0.5, y], [x + w * 0.5, y]], 0.25); }
  function shed(p, x0, gy, w, h, roof, o) { o = o || {}; const rh = o.rh || h * 0.55;
    p.rect(x0, gy - h, w, h, o.wall || PAL.paperFill, 0.7); p.poly([[x0 - 0.6, gy - h], [x0 + w * 0.5, gy - h - rh], [x0 + w + 0.6, gy - h]], roof || PAL.red, 0.7);
    p.hatch([[x0 + w * 0.62, gy - h], [x0 + w, gy - h], [x0 + w, gy], [x0 + w * 0.62, gy]], 75, 1, 0.3);
    if (o.door) p.poly([[x0 + w * 0.4, gy], [x0 + w * 0.4, gy - h * 0.55], [x0 + w * 0.6, gy - h * 0.55], [x0 + w * 0.6, gy]], PAL.brown, 0.5); }
  def('li-brickworks', 30, 30, p => { p.shadow(15, 29.4, 13);
    shed(p, 2, 29, 12, 7, '#9B5A3C', { door: true }); chimney(p, 19, 29, 4, 3);
    // the kilns: rounded humps with stoke holes
    p.ell(25.4, 29, 4, 4.4, '#C08A60', 0.7, Math.PI, Math.PI * 2); p.line([[21.4, 29], [29.4, 29]], 0.6); p.ell(25.4, 27.6, 0.9, 1, PAL.ink, 0);
    for (let i = 0; i < 4; i++) p.rect(3 + i * 2.2, 18.6 - (i % 2) * 1.4, 2, 1.2, '#B5653F', 0.35); }, { smoke: [19, 3] });
  def('li-bottlekiln', 20, 26, p => { p.shadow(10, 25.4, 8.5);
    p.poly([[3.4, 25], [3, 18], [5.4, 11], [8, 6.4], [8, 3.8], [12, 3.8], [12, 6.4], [14.6, 11], [17, 18], [16.6, 25]], '#C49B74', 0.75);
    p.hatch([[12, 6.4], [14.6, 11], [17, 18], [16.6, 25], [12.2, 25], [12.2, 6.4]], 80, 1, 0.3); p.rect(7.6, 3, 4.8, 1, '#8C5238', 0.5);
    p.poly([[8.4, 25], [8.4, 21], [11.6, 21], [11.6, 25]], PAL.ink, 0.4); p.line([[1.4, 25.2], [18.6, 25.2]], 0.5); }, { smoke: [10, 2.6] });
  def('li-watermill', 30, 22, p => { p.shadow(14, 21.4, 12);
    shed(p, 3, 21, 14, 10, PAL.slate, { door: true, rh: 6 }); p.rect(6, 13.2, 2.4, 2.2, PAL.ink, 0); p.rect(11.6, 13.2, 2.4, 2.2, PAL.ink, 0);
    // the wheel, with paddles, in the leat
    const cx = 22.4, cy = 15.6, r = 5.6; p.ell(cx, cy, r, r, PAL.brownSoft, 0.75); p.ell(cx, cy, r * 0.62, r * 0.62, null, 0.4);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; p.line([[cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62], [cx + Math.cos(a) * (r + 0.9), cy + Math.sin(a) * (r + 0.9)]], 0.45); }
    p.dot(cx, cy, 0.8); p.line([[15.6, 21.4], [29.4, 21.4]], 0.7, PAL.blue); p.line([[17, 20.2], [28, 20.2]], 0.4, PAL.blueSoft); });
  def('li-windmill', 18, 26, p => { p.shadow(9, 25.4, 6);
    p.poly([[5.4, 25], [6.4, 11], [11.6, 11], [12.6, 25]], PAL.paperFill, 0.75); p.hatch([[9.6, 11], [11.6, 11], [12.6, 25], [10, 25]], 80, 1, 0.3);
    p.poly([[5.8, 11.2], [9, 7.8], [12.2, 11.2]], PAL.brownSoft, 0.6); p.poly([[8, 25], [8, 21], [10, 21], [10, 25]], PAL.brown, 0.45);
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 4 + i * Math.PI / 2 + 0.2, ex = 9 + Math.cos(a) * 8.4, ey = 9 + Math.sin(a) * 8.4; p.line([[9, 9], [ex, ey]], 0.6); const nx = -Math.sin(a), ny = Math.cos(a); p.poly([[9 + Math.cos(a) * 2, 9 + Math.sin(a) * 2], [ex, ey], [ex + nx * 2, ey + ny * 2], [9 + Math.cos(a) * 2 + nx * 2, 9 + Math.sin(a) * 2 + ny * 2]], PAL.wool, 0.4); }
    p.dot(9, 9, 0.8); });
  def('li-forge', 24, 20, p => { p.shadow(12, 19.4, 10);
    shed(p, 2, 19, 13, 7, PAL.slate, { rh: 4 }); chimney(p, 12.6, 12.4, 6, 2);
    p.rect(4, 14.6, 4, 4.4, '#E2843A', 0.45); p.dot(6, 16.2, 1, '#F6C25A');
    // anvil and a horseshoe hung outside
    p.poly([[16.4, 19], [17, 16.8], [16, 16.4], [21.6, 16.4], [22.6, 15.8], [21.4, 17], [20.2, 17], [20.8, 19]], PAL.ink, 0.4);
    p.ell(18.4, 9.8, 1.4, 1.6, null, 0.6, Math.PI * 0.15, Math.PI * 1.85); }, { smoke: [12.6, 5.4] });
  def('li-brewery', 30, 26, p => { p.shadow(15, 25.4, 13);
    shed(p, 2, 25, 13, 9, PAL.red, { door: true });
    // an oast-like kiln with a white cowl, and barrels stacked by the door
    p.poly([[17, 25], [17, 14], [25, 14], [25, 25]], PAL.paperFill, 0.7); p.poly([[16.6, 14], [21, 5.4], [25.4, 14]], '#B5653F', 0.7); p.hatch([[21, 5.4], [25.4, 14], [21, 14]], 70, 1, 0.3);
    p.poly([[19.8, 6], [20.4, 2.6], [23, 3.4], [22.2, 6]], PAL.wool, 0.5);
    for (const [bx, by] of [[4.4, 24.4], [7.6, 24.4], [6, 21.6]]) { p.ell(bx, by - 1.2, 1.5, 1.4, PAL.ochre, 0.5); p.line([[bx - 1.4, by - 1.2], [bx + 1.4, by - 1.2]], 0.3); } }, { smoke: [21.6, 2.4] });
  def('li-distillery', 28, 24, p => { p.shadow(14, 23.4, 12);
    shed(p, 2, 23, 11, 9, PAL.slate, { door: true }); chimney(p, 25, 23, 6, 2);
    // copper pot stills with swan necks
    for (const [sx, sr] of [[15.6, 3.2], [21, 2.6]]) { p.ell(sx, 20.6, sr, sr * 1.1, PAL.copper, 0.65); p.rect(sx - sr, 20.6, sr * 2, 2.4, PAL.copper, 0.6); p.line([[sx, 20.6 - sr * 1.1], [sx, 13.4], [sx + 2.6, 12.4], [sx + 3.6, 14.4]], 0.7, '#8A4A2A'); p.hatch([[sx + sr * 0.2, 17], [sx + sr, 19], [sx + sr, 23], [sx + sr * 0.2, 23]], 75, 0.9, 0.3); } }, { smoke: [25, 5.4] });
  def('li-tannery', 28, 18, p => { p.shadow(14, 17.4, 12);
    shed(p, 2, 17, 11, 7, PAL.ochre, { rh: 4 });
    for (const [vx, vy] of [[16, 17], [21.4, 17], [18.8, 14]]) { p.ell(vx, vy - 1, 2.6, 1, '#7C6440', 0.6); p.line([[vx - 2.6, vy - 1], [vx - 2.4, vy]], 0.4); p.line([[vx + 2.6, vy - 1], [vx + 2.4, vy]], 0.4); }
    // hides drying on a frame
    p.line([[3.4, 4.6], [12, 4.6]], 0.5, PAL.brown); for (const hx of [4.6, 7.6, 10.4]) p.poly([[hx, 4.6], [hx + 2, 4.6], [hx + 2.4, 8.4], [hx + 1, 9.2], [hx - 0.4, 8.4]], '#C9A27A', 0.45); });
  def('li-glassworks', 22, 28, p => { p.shadow(11, 27.4, 9.5);
    // a glass cone
    p.poly([[2.6, 27], [6.4, 10], [8.4, 4], [13.6, 4], [15.6, 10], [19.4, 27]], '#A86A4A', 0.75); p.hatch([[13.6, 4], [15.6, 10], [19.4, 27], [11.4, 27], [11.4, 4]], 80, 1, 0.3);
    for (let y = 24; y > 7; y -= 3) p.line([[2.6 + (27 - y) * 0.22, y], [19.4 - (27 - y) * 0.22, y]], 0.25);
    p.poly([[9, 27], [9, 22.4], [13, 22.4], [13, 27]], '#E2843A', 0.45); p.rect(8, 3.2, 6, 1, '#8C5238', 0.5); }, { smoke: [11, 2.4] });
  def('li-works', 32, 26, p => { p.shadow(16, 25.4, 14);
    shed(p, 2, 25, 9, 8, PAL.slate, { rh: 3.6 }); shed(p, 11.4, 25, 9, 8, PAL.slate, { rh: 3.6 }); shed(p, 20.8, 25, 9, 8, PAL.slate, { rh: 3.6 }); chimney(p, 27.4, 17.4, 2, 2.4); }, { smoke: [27.4, 1.2] });
  def('li-quay', 32, 22, p => {   // merchant quay: a crane, bales, and a cog alongside
    p.rect(1, 16, 30, 3, '#C9B08A', 0.7); p.hatch([[1, 16], [31, 16], [31, 19], [1, 19]], 0, 1, 0.3);
    p.line([[5, 16], [5, 4], [11.4, 6.4]], 0.9, PAL.brown); p.line([[11, 6.4], [11, 11.4]], 0.4); p.rect(9.8, 11.4, 2.4, 2, PAL.ochre, 0.45);
    for (const [bx, by] of [[14, 16], [17, 16], [15.6, 13.4]]) p.rect(bx, by - 2.6, 2.8, 2.6, PAL.wool, 0.5);
    // the cog: one mast, a square sail with a red cross, castles fore and aft
    p.poly([[18.6, 19.4], [31.6, 19.4], [30, 22], [20.4, 22]], PAL.brown, 0.65); p.line([[25, 19.4], [25, 7]], 0.6); p.rect(21.6, 8.4, 6.8, 6.4, PAL.wool, 0.5);
    p.line([[25, 8.4], [25, 14.8]], 0.6, PAL.red); p.line([[21.6, 11.6], [28.4, 11.6]], 0.6, PAL.red); });
  def('li-mine', 20, 24, p => { p.shadow(10, 23.4, 8.5);   // a pithead frame with its wheel
    p.line([[4, 23], [9, 5]], 0.9, PAL.brown); p.line([[16, 23], [11, 5]], 0.9, PAL.brown); p.line([[6, 15], [14, 15]], 0.6, PAL.brown); p.line([[5.2, 19], [14.8, 19]], 0.6, PAL.brown);
    p.ell(10, 5, 3, 3, null, 0.7); p.line([[7, 5], [13, 5]], 0.3); p.line([[10, 2], [10, 8]], 0.3); p.line([[10, 8], [10, 21]], 0.35);
    p.poly([[13, 23.2], [15.6, 20.4], [19.6, 23.2]], '#7A6A58', 0.5); });

  // ================= the modern world turned medieval (from OpenStreetMap points of interest and land use)
  def('lm-cartwright', 30, 20, p => { p.shadow(15, 19.4, 13);
    shed(p, 2, 19, 10, 7, PAL.brownSoft, { door: true, rh: 4.4 });
    // carts on show, and a spare wheel leaning on the wall
    cart(p, 13, 19.2, 7, { shaft: 3 }); p.ell(26.4, 14.6, 2.6, 2.6, PAL.paperFill, 0.6); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; p.line([[26.4 - Math.cos(a) * 2.6, 14.6 - Math.sin(a) * 2.6], [26.4 + Math.cos(a) * 2.6, 14.6 + Math.sin(a) * 2.6]], 0.3); }
    p.ell(11, 9.4, 1.4, 1.4, PAL.ochre, 0.4); });
  def('lm-stable', 30, 20, p => { p.shadow(15, 19.4, 13);
    shed(p, 2, 19, 15, 7, '#B5653F', { rh: 4 }); for (let i = 0; i < 3; i++) { p.rect(3.6 + i * 4.6, 13.4, 3, 5.6, PAL.brown, 0.4); p.line([[3.6 + i * 4.6, 15.6], [6.6 + i * 4.6, 15.6]], 0.3); }
    // a horse at the trough
    p.rect(19, 16.4, 6, 2.6, '#9AA3A8', 0.5); p.line([[19.4, 16.8], [24.6, 16.8]], 0.5, PAL.blueSoft); horse(p, 17.6, 19.2, 0.62, { col: PAL.horse }); });
  def('lm-market', 30, 18, p => { p.shadow(15, 17.4, 13);
    for (const [sx, sy, col] of [[2, 17, PAL.red], [11, 15.6, PAL.blue], [20, 17, PAL.ochre]]) {
      p.rect(sx + 1, sy - 4.4, 7, 4.4, PAL.paperFill, 0.55); p.poly([[sx, sy - 4], [sx + 9, sy - 4], [sx + 7.6, sy - 7.2], [sx + 1.4, sy - 7.2]], col, 0.55);
      for (let k = 0; k < 3; k++) p.line([[sx + 2.2 + k * 2.4, sy - 7.2], [sx + 1.8 + k * 2.4, sy - 4]], 0.35, PAL.paperFill);
      p.dot(sx + 3, sy - 2.6, 0.6, PAL.green); p.dot(sx + 5, sy - 2.6, 0.6, PAL.red); p.dot(sx + 6.6, sy - 2.4, 0.5, PAL.ochre); }
    person(p, 10.4, 17.6, 0.7, { col: PAL.sage, hood: PAL.wool }); });
  def('lm-coachinginn', 34, 26, p => { p.shadow(17, 25.4, 15);
    // a long galleried inn round a yard, with a coach at the arch
    p.rect(2, 14, 26, 11, PAL.paperFill, 0.75); p.poly([[1, 14], [5, 8.4], [25, 8.4], [29, 14]], PAL.red, 0.75); p.hatch([[1, 14], [5, 8.4], [25, 8.4], [29, 14]], 75, 1.1, 0.3);
    for (let i = 0; i < 6; i++) p.rect(3.4 + i * 4, 16, 2.2, 2.6, PAL.ink, 0); p.line([[2, 19.6], [28, 19.6]], 0.4);
    p.ell(15, 25, 3, 4, PAL.ink, 0, Math.PI, Math.PI * 2);
    p.line([[28, 12], [32, 12]], 0.5); p.rect(30, 12, 3, 4, PAL.ochre, 0.45); chimney(p, 8, 8.6, 5.4, 1.4); chimney(p, 22, 8.6, 5.4, 1.4); }, { smoke: [8, 4.8] });
  def('lm-carriers', 30, 20, p => { p.shadow(15, 19.4, 13); shed(p, 2, 19, 12, 8, PAL.slate, { door: true, rh: 4 }); cart(p, 15, 19.4, 8, { load: 'cover', shaft: 3 }); });
  def('lm-stage', 28, 22, p => { p.shadow(14, 21.4, 12);
    // a players' stage with a striped curtain and a pennant
    p.rect(3, 15, 22, 4, PAL.brownSoft, 0.7); p.hatch([[3, 15], [25, 15], [25, 19], [3, 19]], 90, 1.4, 0.3); p.line([[4, 19], [4, 21]], 0.6); p.line([[24, 19], [24, 21]], 0.6);
    p.line([[4, 15], [4, 4]], 0.6); p.line([[24, 15], [24, 4]], 0.6); p.poly([[3, 4], [25, 4], [24, 6.6], [4, 6.6]], PAL.red, 0.55);
    for (let i = 0; i < 5; i++) p.rect(5 + i * 4, 6.6, 2, 5.4, i % 2 ? PAL.ochre : PAL.red, 0.35);
    person(p, 13, 15, 0.75, { col: PAL.blue, hat: 'cap', capCol: PAL.red }); person(p, 17, 15, 0.75, { col: PAL.green, hood: PAL.ochre });
    p.line([[14, 4], [14, 0.6]], 0.4); p.poly([[14, 0.6], [17.6, 1.4], [14, 2.2]], PAL.blue, 0.35); });
  def('lm-tourney', 40, 26, p => { p.shadow(20, 25.4, 18);
    // lists: a long barrier, two striped pavilions with pennants, two knights tilting
    for (const [px, col] of [[2, PAL.red], [32, PAL.blue]]) { p.poly([[px, 14], [px + 0.6, 9], [px + 3, 5.4], [px + 5.4, 9], [px + 6, 14]], PAL.paperFill, 0.6); p.hatch([[px, 14], [px + 0.6, 9], [px + 3, 5.4], [px + 5.4, 9], [px + 6, 14]], 90, 1.4, 0.7, col); p.line([[px + 3, 5.4], [px + 3, 2]], 0.4); p.poly([[px + 3, 2], [px + 6, 2.8], [px + 3, 3.6]], col, 0.35); }
    p.line([[6, 22], [34, 22]], 0.9, PAL.brown); for (let i = 0; i < 8; i++) p.line([[7 + i * 3.8, 22], [7 + i * 3.8, 24.6]], 0.5, PAL.brown);
    rider(p, 6, 21.4, 0.8, { col: '#9AA3A8', hat: '#9AA3A8', lance: true, pennon: PAL.red });
    const c = Pen(20, 20, 9); rider(c, 2, 19, 0.8, { col: '#9AA3A8', hat: '#9AA3A8', lance: true, pennon: PAL.blue }); p.x.drawImage(mirror(c.c), 20, 2.4, 20, 20); });
  def('lm-butts', 26, 16, p => { p.shadow(13, 15.4, 11);
    for (const bx of [4, 13]) { p.poly([[bx, 15], [bx + 1, 6], [bx + 6, 6], [bx + 7, 15]], '#9DA36A', 0.6); p.ell(bx + 3.5, 9.6, 2.2, 2.2, PAL.paperFill, 0.5); p.ell(bx + 3.5, 9.6, 1.2, 1.2, PAL.red, 0.35); p.dot(bx + 3.5, 9.6, 0.4, PAL.ochre); }
    person(p, 22.4, 15, 0.8, { col: PAL.green, hood: PAL.brownSoft }); p.ell(20.6, 9.4, 1.6, 3.6, null, 0.5, -Math.PI / 2, Math.PI / 2); });
  def('lm-infirmary', 32, 26, p => { p.shadow(16, 25.4, 14);
    p.rect(2, 13, 22, 12, PAL.paperFill, 0.75); p.poly([[1, 13], [4, 7.6], [22, 7.6], [25, 13]], PAL.slate, 0.7);
    for (let i = 0; i < 4; i++) p.ell(5.4 + i * 5, 18, 1, 1.8, PAL.ink, 0, Math.PI, Math.PI * 2);
    // a chapel bell-cote and a red cross on the gable
    p.rect(25, 9, 6, 16, PAL.paperFill, 0.7); p.poly([[24.4, 9], [28, 4], [31.6, 9]], PAL.red, 0.6); p.line([[28, 13], [28, 18]], 0.9, PAL.red); p.line([[26.2, 15], [29.8, 15]], 0.9, PAL.red); });
  def('lm-school', 26, 24, p => { p.shadow(13, 23.4, 11);
    shed(p, 2, 23, 20, 9, PAL.red, { door: true, rh: 5 }); for (const wx of [4.6, 15.6]) p.ell(wx + 1, 17.4, 1, 1.8, PAL.ink, 0, Math.PI, Math.PI * 2);
    // bell-cote with its bell
    p.rect(10.4, 5, 3.2, 4, PAL.paperFill, 0.55); p.poly([[10, 5], [12, 2.6], [14, 5]], PAL.slate, 0.45); p.ell(12, 7.6, 0.9, 1.1, PAL.ochre, 0.35); });
  def('lm-college', 34, 28, p => { p.shadow(17, 27.4, 15);
    // a college quad: ranges round a green court, a gate tower with pinnacles
    p.poly([[3, 16], [31, 16], [28, 25], [6, 25]], '#C9D3A0', 0.6); p.hatch([[3, 16], [31, 16], [28, 25], [6, 25]], 0, 1.6, 0.25, PAL.green);
    p.rect(2, 11, 30, 5, PAL.paperFill, 0.7); p.poly([[1.4, 11], [3, 8.4], [31, 8.4], [32.6, 11]], PAL.slate, 0.6); for (let i = 0; i < 8; i++) p.rect(3.6 + i * 3.6, 12.4, 1.2, 2, PAL.ink, 0);
    p.rect(13.4, 3.6, 7.2, 12.4, PAL.paperFill, 0.75); for (const tx of [13.4, 20.6]) p.poly([[tx - 0.8, 3.6], [tx, 0.4], [tx + 0.8, 3.6]], PAL.paperFill, 0.5);
    p.ell(17, 16, 1.8, 3, PAL.ink, 0, Math.PI, Math.PI * 2); p.rect(15.2, 6, 3.6, 2.4, PAL.red, 0.4);
    p.rect(2, 24, 30, 2.6, PAL.paperFill, 0.6); });
  def('lm-counting', 24, 24, p => { p.shadow(12, 23.4, 10);
    shed(p, 2, 23, 16, 11, PAL.slate, { rh: 5 }); p.rect(5, 15, 10, 3, PAL.ochre, 0.5);
    // coins stacked on the counter and a hanging sign with three gold roundels
    for (let i = 0; i < 3; i++) p.ell(7 + i * 3, 14.6, 1, 0.5, '#E2B84A', 0.35);
    p.line([[18, 9], [22.4, 9]], 0.5); p.rect(19.2, 9, 3.2, 4.6, PAL.blue, 0.45); for (const [cx, cy] of [[20.2, 10.6], [21.6, 10.6], [20.9, 12.4]]) p.dot(cx, cy, 0.55, '#E2B84A'); });
  def('lm-messenger', 28, 22, p => { p.shadow(14, 21.4, 12); shed(p, 2, 21, 10, 7, '#B5653F', { rh: 4, door: true });
    p.rect(4, 10.6, 6, 1.6, PAL.red, 0.35); rider(p, 13, 21.2, 0.8, { gallop: true, col: PAL.red, cloak: PAL.blue, bag: true }); });
  def('lm-wagonyard', 30, 16, p => { p.shadow(15, 15.4, 13); cart(p, 1, 15, 8, { shaft: 2 }); cart(p, 12, 13.4, 8, { load: 'sacks', shaft: 2 }); cart(p, 19, 15.6, 7, { load: 'hay', shaft: 2 }); });
  def('lm-innsign', 12, 16, p => {
    // a hanging inn sign on a post: board colour and device vary
    p.line([[2, 15.4], [2, 1]], 0.9, PAL.brown); p.line([[2, 2], [10, 2]], 0.7, PAL.brown); p.line([[2.8, 4.8], [5, 2]], 0.4, PAL.brown);
    p.line([[5, 2], [5, 3.8]], 0.3); p.line([[9.4, 2], [9.4, 3.8]], 0.3); p.rect(4, 3.8, 6.4, 6.6, PAL.red, 0.6); p.ell(7.2, 7.1, 1.8, 1.8, '#E2B84A', 0.35); p.line([[0.6, 15.6], [3.4, 15.6]], 0.5); });
  def('lm-innsign2', 12, 16, p => { p.line([[2, 15.4], [2, 1]], 0.9, PAL.brown); p.line([[2, 2], [10, 2]], 0.7, PAL.brown); p.line([[2.8, 4.8], [5, 2]], 0.4, PAL.brown);
    p.line([[5, 2], [5, 3.8]], 0.3); p.line([[9.4, 2], [9.4, 3.8]], 0.3); p.rect(4, 3.8, 6.4, 6.6, PAL.blue, 0.6);
    p.poly([[5.4, 9], [6.4, 5.4], [7.4, 7], [8.4, 5.4], [9.2, 9]], '#E2B84A', 0.35); p.line([[0.6, 15.6], [3.4, 15.6]], 0.5); });
  def('lm-innsign3', 12, 16, p => { p.line([[2, 15.4], [2, 1]], 0.9, PAL.brown); p.line([[2, 2], [10, 2]], 0.7, PAL.brown); p.line([[2.8, 4.8], [5, 2]], 0.4, PAL.brown);
    p.line([[5, 2], [5, 3.8]], 0.3); p.line([[9.4, 2], [9.4, 3.8]], 0.3); p.rect(4, 3.8, 6.4, 6.6, PAL.green, 0.6);
    p.ell(7.2, 7.4, 1.4, 1.8, PAL.ochre, 0.35); p.line([[5.8, 6], [8.6, 6]], 0.3); p.line([[0.6, 15.6], [3.4, 15.6]], 0.5); });
  def('lm-stocks', 12, 9, p => { p.shadow(6, 8.6, 5); p.line([[2, 8.4], [2, 2.6]], 0.8, PAL.brown); p.line([[10, 8.4], [10, 2.6]], 0.8, PAL.brown); p.rect(1, 4.4, 10, 2, PAL.brownSoft, 0.55); for (const hx of [3.6, 6, 8.4]) p.dot(hx, 5.4, 0.45); });
  def('lm-watchhouse', 14, 20, p => { p.shadow(7, 19.4, 6); p.rect(3, 9, 8, 10, PAL.paperFill, 0.7); p.poly([[2.4, 9], [7, 4], [11.6, 9]], PAL.slate, 0.6); p.rect(5.8, 14, 2.4, 5, PAL.brown, 0.4); p.dot(7, 11, 0.8, '#E2B84A'); p.line([[7, 4], [7, 1]], 0.4); p.poly([[7, 1], [9.6, 1.6], [7, 2.2]], PAL.red, 0.3); });
  def('lm-scriptorium', 20, 20, p => { p.shadow(10, 19.4, 8.5); shed(p, 2, 19, 15, 9, PAL.slate, { rh: 5, door: true }); for (const wx of [4.6, 13.6]) p.ell(wx, 14, 0.9, 1.8, PAL.ink, 0, Math.PI, Math.PI * 2);
    p.rect(7, 2.4, 5, 3.6, PAL.paperFill, 0.4); p.line([[9.5, 2.4], [9.5, 6]], 0.3); p.line([[11.4, 0.6], [13.6, 4.4]], 0.45, PAL.blue); });
  def('lm-hostelry', 24, 22, p => { p.shadow(12, 21.4, 10); shed(p, 2, 21, 17, 10, PAL.red, { rh: 5.6, door: true }); for (let i = 0; i < 4; i++) p.rect(3.6 + i * 4, 13, 1.6, 2, PAL.ink, 0); chimney(p, 6, 6.4, 3.4, 1.3);
    p.line([[19, 13.4], [23, 13.4]], 0.45); p.rect(20.4, 13.4, 2.6, 3.2, PAL.ochre, 0.4); }, { smoke: [6, 2.8] });
  def('lm-firewatch', 16, 20, p => { p.shadow(8, 19.4, 7); p.rect(4, 6, 8, 13, PAL.paperFill, 0.7); p.poly([[3, 6], [8, 1.4], [13, 6]], PAL.red, 0.6); p.ell(8, 9, 1.2, 1.5, PAL.ochre, 0.35);
    for (let i = 0; i < 3; i++) { p.poly([[1 + i * 1.6, 19], [1.2 + i * 1.6, 16.4], [2.4 + i * 1.6, 16.4], [2.6 + i * 1.6, 19]], PAL.brown, 0.35); } p.line([[12.6, 19], [15.4, 12], [12.6, 12], [15.4, 19]], 0.4, PAL.brown); });
  def('lm-cabinet', 20, 22, p => { p.shadow(10, 21.4, 9); p.rect(3, 9, 14, 12, PAL.paperFill, 0.7); p.poly([[2, 9], [10, 3], [18, 9]], PAL.slate, 0.6); for (const cx of [5, 8.4, 11.8, 15.2]) p.line([[cx, 10.4], [cx, 20]], 0.6);
    p.ell(10, 6.6, 1.6, 1.2, PAL.ochre, 0.35); });

  // ================= history (sister data studies)
  def('lh-milestone', 6, 9, p => { p.poly([[1, 8.6], [1.2, 3], [3, 1], [4.8, 3], [5, 8.6]], '#D8CCB0', 0.6); p.line([[2, 4.4], [4, 4.4]], 0.3); p.line([[2, 5.8], [4, 5.8]], 0.3); });
  def('lh-scallop', 9, 8, p => { const cx = 4.5, cy = 7; const pts = [[cx, cy]]; for (let i = 0; i <= 10; i++) { const a = Math.PI + i * Math.PI / 10; pts.push([cx + Math.cos(a) * 4, cy - 1 + Math.sin(a) * 5.4]); } p.poly(pts, '#E9D9B0', 0.55); for (let i = 1; i < 6; i++) { const a = Math.PI + i * Math.PI / 6; p.line([[cx, cy], [cx + Math.cos(a) * 3.8, cy - 1 + Math.sin(a) * 5]], 0.3); } });
  def('lh-swords', 12, 12, p => {
    for (const s of [1, -1]) {
      const x0 = 6 - s * 4.4, y0 = 10.4, x1 = 6 + s * 4, y1 = 1.4, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      const gx = x0 + ux * 2.4, gy = y0 + uy * 2.4;
      p.line([[gx, gy], [x1, y1]], 1.2, '#B9C0C4'); p.line([[gx, gy], [x1, y1]], 0.3);
      p.line([[gx - uy * 1.8, gy + ux * 1.8], [gx + uy * 1.8, gy - ux * 1.8]], 0.9, PAL.ochre);
      p.line([[x0, y0], [gx, gy]], 0.9, PAL.brown); p.dot(x0, y0, 0.7, PAL.red);
    } });
  def('lh-dmv', 22, 14, p => {   // the faint outlines of the crofts and tofts of a deserted village, with a lone ruined church
    const R = p.R; p.x.globalAlpha = 0.85;
    for (let i = 0; i < 6; i++) { const x0 = 1 + i * 3.4 + R(), y0 = 5 + (i % 2) * 3.6 + R(); p.poly([[x0, y0], [x0 + 2.6, y0], [x0 + 2.6, y0 + 2.4], [x0, y0 + 2.4]], null, 0.4, PAL.brownSoft); }
    p.line([[0.6, 12.8], [21.4, 12.8]], 0.3, PAL.brownSoft); p.line([[0.6, 4], [21.4, 4]], 0.3, PAL.brownSoft);
    p.poly([[17.6, 11], [17.6, 6.4], [19.2, 4.8], [20.8, 6.4], [20.8, 11]], 'rgba(233,223,198,0.8)', 0.5); p.line([[19.2, 7.4], [19.2, 9.4]], 0.4); });
  def('lh-wreck', 18, 12, p => {
    p.poly([[2, 8], [7, 5], [15.6, 7.2], [14, 10], [4, 10]], PAL.brown, 0.6); p.hatch([[2, 8], [7, 5], [15.6, 7.2], [14, 10], [4, 10]], 60, 1, 0.3);
    p.line([[8.4, 6], [10.6, 0.6]], 0.6); p.line([[9.2, 3.2], [12.2, 4.2]], 0.4);
    for (const [wx, wy] of [[0.6, 10.6], [5, 11.4], [12, 11.2], [15, 10.4]]) p.line([[wx, wy], [wx + 2.4, wy - 0.4]], 0.4, PAL.blue); });
  def('lh-abbey', 20, 18, p => { p.shadow(10, 17.4, 9);   // a ruined abbey: roofless nave, broken arches
    p.poly([[2, 17], [2, 7], [3.4, 5], [4.8, 7], [4.8, 17]], PAL.paperFill, 0.6); p.poly([[14, 17], [14, 9], [15, 6.4], [16.6, 4], [18, 7.2], [18, 17]], PAL.paperFill, 0.6);
    for (let i = 0; i < 3; i++) { const ax = 5.6 + i * 2.8; p.ell(ax + 1.2, 11, 1.2, 1.6, null, 0.5, Math.PI, Math.PI * 2); p.line([[ax, 11], [ax, 17]], 0.6); }
    p.line([[1, 17.2], [19, 17.2]], 0.5); p.ell(16, 10, 0.8, 1.4, PAL.ink, 0); });

  // ---------------- smoke: an animated wisp, as a strip of frames (drawn on the overlay canvas, not by the map)
  function smokeFrames(n) {
    // a wisp of smoke in ink: overlapping soft grey puffs along a curl that leans with the wind, each with a fine pen
    // edge; the frames scroll the puffs upward, so the column seems to rise, swell and thin away
    const W = 22, H = 40, N = 11, out = [];
    for (let f = 0; f < n; f++) {
      const p = Pen(W, H, 77), t = f / n;
      for (let i = N - 1; i >= 0; i--) {
        const ph = (i + t) / N, y = H - 2.5 - ph * (H - 9), r = 1.1 + ph * 3.3;
        const a = Math.min(1, ph * 6) * Math.pow(1 - ph, 0.9);
        const xo = 6 + Math.sin(ph * 5.2 + 0.6) * (0.5 + ph * 2) + ph * ph * 9;
        p.x.globalAlpha = a * 0.85;
        p.ell(xo, y, r, r * 0.8, 'rgba(150,140,126,0.5)', 0);
        p.ell(xo, y, r, r * 0.8, null, 0.45, Math.PI * 0.95, Math.PI * 2.05, 'rgba(50,40,34,0.8)');   // a billow: the pen only round its top
      }
      out.push(p.c);
    }
    return out;
  }

  // ================= regional travellers (round 5)
  // The road life of each world region, chosen in js/ink-worker.js from the same region grid as the houses
  // (data/house_regions.json): skin tones, dress, loads and beasts as they are in each place. Europe keeps the drawings
  // above. Drawn only when a tile first asks for one (LAZY), so a view of Europe never pays for them.
  const LAZY = new Map();
  const ldef = (id, w, h, draw) => LAZY.set(id, [w, h, draw]);
  const SK = { mn: ['#C99A70', '#B98A62', '#D6AE86'], ca: ['#D9B48E', '#C8A07A', '#CDA27C'], af: ['#5C3A26', '#6E4630', '#4A2E1E', '#7A5036'], sh: ['#5A3A28', '#6A4430', '#4E3222'],
    sa: ['#9C6A46', '#8A5A3A', '#B07C56'], pk: ['#B58660', '#A07250', '#C49470'], ea: ['#EBCBA6', '#E0BC94', '#E6C49E'], se: ['#C4946A', '#B48258', '#BC8C62'], ml: ['#B88858', '#A87650', '#C29462'],
    am: ['#C8946A', '#A8754F', '#DDB28C', '#8A5A3A'], an: ['#A87450', '#9A6844', '#B07C56'], na: ['#F0D5BC', '#7A4E33', '#C8946A', '#E0BC94'] };
  // a regional figure: dress (robe, wrap, sari, dhoti, kurta, poncho, pollera, tunic), headwear, a load
  function figure(p, x, y, s, o) {
    o = o || {}; const k = s || 1, X = v => x + v * k, Y = v => y - v * k, skin = o.skin || PAL.skin, col = o.col || PAL.red;
    const step = o.walk === false ? 0.5 : 1.1, dress = o.dress || 'tunic';
    const legs = () => { p.line([[X(-0.2), Y(3.2)], [X(-step), Y(0)]], 0.75, o.legCol); p.line([[X(0.4), Y(3.2)], [X(step + 0.2), Y(0)]], 0.75, o.legCol); };
    if (dress === 'robe') { p.poly([[X(-1.8), Y(0.3)], [X(-1.3), Y(7.4)], [X(0), Y(8.4)], [X(1.4), Y(7.4)], [X(2.1), Y(0.3)]], col, 0.7); p.line([[X(-1), Y(0)], [X(-1.2), Y(0.4)]], 0.6); p.line([[X(1.2), Y(0)], [X(1.4), Y(0.4)]], 0.6); if (o.trim) p.line([[X(0.1), Y(8.2)], [X(0.2), Y(0.6)]], 0.35, o.trim); }
    else if (dress === 'wrap') { p.poly([[X(-1.7), Y(0.5)], [X(-1.5), Y(4.6)], [X(1.8), Y(4.6)], [X(2), Y(0.5)]], o.col2 || PAL.ochre, 0.65); p.line([[X(-1.4), Y(2.2)], [X(1.8), Y(2.8)]], 0.35, o.col3 || PAL.paper); p.poly([[X(-1.4), Y(4.6)], [X(-1.2), Y(7.4)], [X(0), Y(8.4)], [X(1.3), Y(7.4)], [X(1.7), Y(4.6)]], col, 0.65); p.line([[X(-0.6), Y(0)], [X(-0.6), Y(0.5)]], 0.6); p.line([[X(0.9), Y(0)], [X(0.9), Y(0.5)]], 0.6); }
    else if (dress === 'sari') { p.poly([[X(-1.8), Y(0.3)], [X(-1.3), Y(7.4)], [X(0), Y(8.4)], [X(1.4), Y(7.4)], [X(2.1), Y(0.3)]], col, 0.7); p.poly([[X(-1.3), Y(7.6)], [X(1.4), Y(3)], [X(2.1), Y(3.4)], [X(0.4), Y(8.6)]], o.col2 || PAL.ochre, 0.4); p.line([[X(-1.7), Y(1)], [X(2), Y(1)]], 0.45, o.col2 || PAL.ochre); }
    else if (dress === 'dhoti') { legs(); p.poly([[X(-1.5), Y(1.4)], [X(-1.4), Y(4.4)], [X(1.7), Y(4.4)], [X(1.8), Y(1.4)]], PAL.wool, 0.6); p.poly([[X(-1.5), Y(3.6)], [X(-1.2), Y(7.4)], [X(0), Y(8.4)], [X(1.3), Y(7.4)], [X(1.8), Y(3.6)]], col, 0.65); }
    else if (dress === 'kurta') { legs(); p.poly([[X(-1.7), Y(2.4)], [X(-1.2), Y(7.4)], [X(0), Y(8.4)], [X(1.3), Y(7.4)], [X(2), Y(2.4)]], col, 0.7); }
    else if (dress === 'poncho') { legs(); p.poly([[X(-2.4), Y(4)], [X(0), Y(8.4)], [X(2.6), Y(4)], [X(0.1), Y(3.4)]], col, 0.7); p.line([[X(-1.8), Y(4.9)], [X(2), Y(4.9)]], 0.4, o.col2 || PAL.ochre); p.line([[X(-1.3), Y(5.8)], [X(1.5), Y(5.8)]], 0.35, o.col3 || PAL.paper); }
    else if (dress === 'pollera') { p.poly([[X(-2.6), Y(0.6)], [X(-1.2), Y(5)], [X(1.6), Y(5)], [X(3), Y(0.6)]], col, 0.7); p.line([[X(-2.2), Y(1.6)], [X(2.6), Y(1.6)]], 0.4, o.col3 || PAL.paper); p.poly([[X(-1.4), Y(4.6)], [X(-1.3), Y(7.6)], [X(0), Y(8.4)], [X(1.4), Y(7.6)], [X(1.8), Y(4.6)]], o.col2 || PAL.blue, 0.6); }
    else { legs(); p.poly([[X(-1.6), Y(2.4)], [X(-1.2), Y(7.4)], [X(0), Y(8.4)], [X(1.3), Y(7.4)], [X(1.9), Y(2.4)]], col, 0.7); }
    if (o.belt) p.line([[X(-1.3), Y(5)], [X(1.5), Y(5)]], 0.5, o.belt === true ? PAL.ink : o.belt);
    // head
    const hat = o.hat;
    if (hat === 'scarf' || hat === 'abaya') { p.poly([[X(-1.5), Y(8.2)], [X(-1.4), Y(10.2)], [X(0.1), Y(11)], [X(1.4), Y(10.2)], [X(1.5), Y(8.4)], [X(0.4), Y(7.8)]], o.hatCol || PAL.blue, 0.6); p.ell(X(0.35), Y(9.4), 0.85 * k, 0.95 * k, skin, 0.45); return; }
    if (hat === 'veil') { p.ell(X(0.1), Y(9.5), 1.2 * k, 1.25 * k, o.hatCol || '#2E3E6E', 0.6); p.rect(X(-0.1), Y(9.9), 1.1 * k, 0.5 * k, skin, 0); p.poly([[X(-1.2), Y(9.8)], [X(0), Y(11.2)], [X(1.3), Y(10)]], o.hatCol || '#2E3E6E', 0.5); return; }
    p.ell(X(0.1), Y(9.5), 1.15 * k, 1.2 * k, skin, 0.6);
    const hc = o.hatCol || PAL.wool;
    if (hat === 'turban') p.ell(X(0.1), Y(10.5), 1.35 * k, 0.75 * k, hc, 0.5);
    else if (hat === 'keffiyeh') { p.poly([[X(-1.4), Y(7.6)], [X(-1.4), Y(10.2)], [X(0.1), Y(11)], [X(1.4), Y(10.4)], [X(0.6), Y(10)], [X(-0.6), Y(10)], [X(-0.8), Y(8)]], hc, 0.5); p.line([[X(-1.3), Y(10.4)], [X(1.3), Y(10.6)]], 0.45, PAL.ink); }
    else if (hat === 'conical') p.poly([[X(-2.6), Y(10)], [X(0.1), Y(12.2)], [X(2.8), Y(10)]], hc || PAL.straw, 0.5);
    else if (hat === 'straw') { p.ell(X(0.1), Y(10.4), 2.2 * k, 0.5 * k, hc || PAL.straw, 0.45); p.ell(X(0.1), Y(10.8), 0.9 * k, 0.6 * k, hc || PAL.straw, 0.4); }
    else if (hat === 'wide') { p.ell(X(0.1), Y(10.4), 2.5 * k, 0.55 * k, hc, 0.5); p.poly([[X(-0.9), Y(10.4)], [X(-0.6), Y(11.8)], [X(0.8), Y(11.8)], [X(1.1), Y(10.4)]], hc, 0.45); }
    else if (hat === 'bowler') { p.ell(X(0.1), Y(10.5), 1.5 * k, 0.35 * k, hc || PAL.ink, 0.35); p.ell(X(0.1), Y(10.9), 0.9 * k, 0.8 * k, hc || PAL.ink, 0.35, Math.PI, Math.PI * 2); }
    else if (hat === 'cap' || hat === 'doppa' || hat === 'songkok' || hat === 'topi' || hat === 'kufi') p.rect(X(-1), Y(11.2), 2.2 * k, 1 * k, hc, 0.4);
    else if (hat === 'chullo') { p.ell(X(0.1), Y(10.4), 1.25 * k, 1 * k, hc, 0.45, Math.PI, Math.PI * 2); p.line([[X(-1), Y(10.2)], [X(-1.1), Y(9)]], 0.5, hc); p.line([[X(1.2), Y(10.2)], [X(1.3), Y(9)]], 0.5, hc); }
    else if (hat === 'hood') p.poly([[X(-1.3), Y(9.2)], [X(-0.6), Y(11.2)], [X(0.9), Y(11)], [X(1.2), Y(9.6)], [X(0.4), Y(10.4)]], hc, 0.6);
    // loads
    if (o.load === 'head') { p.line([[X(1.2), Y(7.4)], [X(1.6), Y(11)]], 0.45, PAL.ink); p.poly([[X(-2.2), Y(10.8)], [X(-1.8), Y(12.2)], [X(2), Y(12.2)], [X(2.4), Y(10.8)]], o.loadCol || PAL.straw, 0.5); p.ell(X(0.1), Y(12.5), 1.4 * k, 0.55 * k, o.loadCol2 || PAL.ochre, 0.4); }
    else if (o.load === 'pot') { p.line([[X(1.2), Y(7.4)], [X(1.6), Y(11)]], 0.45, PAL.ink); const pc = o.loadCol || '#C9A040'; p.ell(X(0.1), Y(11.8), 1.6 * k, 0.95 * k, pc, 0.5); p.rect(X(-0.5), Y(13.2), 1.2 * k, 0.6 * k, pc, 0.35); p.line([[X(-1.3), Y(11.6)], [X(1.5), Y(11.6)]], 0.3, PAL.ink); }
    else if (o.load === 'pole') { p.line([[X(-4.6), Y(8.6)], [X(4.8), Y(8.2)]], 0.6, PAL.brown); for (const bx of [-4.4, 4.6]) { p.line([[X(bx), Y(8.4)], [X(bx - 0.8), Y(5)]], 0.3); p.line([[X(bx), Y(8.4)], [X(bx + 0.8), Y(5)]], 0.3); p.ell(X(bx), Y(4.4), 1.3 * k, 1 * k, o.loadCol || PAL.straw, 0.45); } }
    else if (o.load === 'back') p.ell(X(-1.8), Y(6.4), 1.4 * k, 1.8 * k, o.loadCol || PAL.red, 0.5);
    else if (o.load === 'baby') { p.ell(X(-1.7), Y(6.6), 1.2 * k, 1.5 * k, o.loadCol || PAL.ochre, 0.45); p.ell(X(-1.6), Y(8.4), 0.6 * k, 0.65 * k, skin, 0.35); }
    if (o.staff) p.line([[X(2.4), Y(-0.2)], [X(2.2), Y(11.6)]], 0.7, PAL.brown);
  }
  // a seated rider: (x, y) = the seat
  function seated(p, x, y, k, o) {
    const X = v => x + v * k, Y = v => y - v * k, skin = o.skin || PAL.skin;
    p.line([[X(0.6), Y(0)], [X(1.4), Y(-3)]], 0.75, o.legCol || PAL.ink);
    if (o.dress === 'robe') p.poly([[X(-1.4), Y(-1.6)], [X(-1), Y(4)], [X(0.4), Y(4.8)], [X(1.6), Y(4)], [X(2), Y(-1.6)]], o.col || PAL.wool, 0.65);
    else if (o.dress === 'poncho') p.poly([[X(-1.8), Y(1)], [X(0.4), Y(4.8)], [X(2.4), Y(1)], [X(0.4), Y(0.4)]], o.col || PAL.red, 0.65);
    else p.poly([[X(-1), Y(0)], [X(-0.8), Y(4)], [X(0.4), Y(4.8)], [X(1.6), Y(4)], [X(1.6), Y(0)]], o.col || PAL.blue, 0.65);
    figureHead(p, X(0.4), Y(6), k, o, skin);
    p.line([[X(1.4), Y(2.8)], [X(4.6), Y(2.4)]], 0.4);
  }
  function figureHead(p, cx, cy, k, o, skin) {
    const hat = o.hat, hc = o.hatCol || PAL.wool;
    if (hat === 'veil') { p.ell(cx, cy, 1.15 * k, 1.2 * k, hc, 0.55); p.rect(cx - 0.2, cy - 0.5, 1.1 * k, 0.5 * k, skin, 0); return; }
    if (hat === 'scarf') { p.ell(cx, cy, 1.3 * k, 1.35 * k, hc, 0.55); p.ell(cx + 0.25, cy + 0.1, 0.8 * k, 0.9 * k, skin, 0.4); return; }
    p.ell(cx, cy, 1.1 * k, 1.15 * k, skin, 0.55);
    if (hat === 'turban') p.ell(cx, cy - 1, 1.3 * k, 0.7 * k, hc, 0.45);
    else if (hat === 'keffiyeh') { p.poly([[cx - 1.4, cy + 1.8], [cx - 1.4, cy - 0.7], [cx, cy - 1.5], [cx + 1.3, cy - 0.9], [cx + 0.5, cy - 0.5], [cx - 0.7, cy - 0.5], [cx - 0.8, cy + 1.6]], hc, 0.45); p.line([[cx - 1.3, cy - 0.9], [cx + 1.2, cy - 1.1]], 0.4); }
    else if (hat === 'wide') { p.ell(cx, cy - 0.9, 2.5 * k, 0.5 * k, hc, 0.45); p.poly([[cx - 0.9, cy - 0.9], [cx - 0.6, cy - 2.2], [cx + 0.8, cy - 2.2], [cx + 1.1, cy - 0.9]], hc, 0.4); }
    else if (hat === 'conical') p.poly([[cx - 2.4, cy - 0.5], [cx, cy - 2.6], [cx + 2.6, cy - 0.5]], hc, 0.45);
    else if (hat === 'chullo') p.ell(cx, cy - 0.8, 1.2 * k, 0.9 * k, hc, 0.4, Math.PI, Math.PI * 2);
    else if (hat && hat !== 'none') p.rect(cx - 1, cy - 2, 2.1 * k, 1 * k, hc, 0.4);
  }
  // beasts, facing right; (x, y) = hind hoof on the ground
  function camel(p, x, y, k, o) {
    o = o || {}; const col = o.col || '#C8A06A', X = v => x + v * k, Y = v => y - v * k;
    for (const [a, b] of [[[1.6, 6], [1.2, 0]], [[3, 6], [3.4, 0]], [[9.4, 6], [9.6, 0]], [[10.6, 6], [11.2, 0]]]) p.line([[X(a[0]), Y(a[1])], [X(b[0]), Y(b[1])]], 0.7 * Math.max(0.8, k));
    const hump = o.two ? [[X(2.2), Y(9.6)], [X(3.8), Y(11.4)], [X(5.2), Y(9.8)], [X(6.6), Y(11.4)], [X(8.2), Y(9.6)]] : [[X(2.4), Y(9.6)], [X(3.6), Y(12)], [X(5.4), Y(13.2)], [X(7.2), Y(12)], [X(8.4), Y(9.6)]];
    p.poly([[X(0.6), Y(6.2)], [X(1), Y(9)]].concat(hump, [[X(10.2), Y(9.4)], [X(12), Y(11.6)], [X(12.6), Y(13.4)], [X(14.4), Y(13.2)], [X(14.6), Y(12.2)], [X(13.4), Y(12)], [X(12.2), Y(9)], [X(11), Y(6.2)]]), col, 0.7);
    p.line([[X(0.7), Y(8.6)], [X(-0.4), Y(6)]], 0.6, PAL.horseDark); p.dot(X(13.6), Y(12.8), 0.25 * k);
    p.hatch([[X(1), Y(6.4)], [X(10.6), Y(6.4)], [X(10.4), Y(7.6)], [X(1), Y(7.6)]], 0, 0.9 * k, 0.3);
    if (o.load) { p.rect(X(1.6), Y(10.2), 2.4 * k, 3 * k, o.load, 0.45); p.rect(X(7), Y(10.2), 2.4 * k, 3 * k, o.load, 0.45); p.line([[X(2.8), Y(10.4)], [X(5.4), Y(12.6)], [X(8.2), Y(10.4)]], 0.35); }
    if (o.saddle) p.poly([[X(3.6), Y(11.8)], [X(4.4), Y(13)], [X(7), Y(13)], [X(7.4), Y(11.6)]], o.saddle, 0.45);
  }
  function zebu(p, x, y, k, col, o) {
    o = o || {}; const X = v => x + v * k, Y = v => y - v * k;
    for (const lx of [0.8, 1.8, 5, 6]) p.line([[X(lx), Y(0)], [X(lx), Y(2.2)]], 0.55);
    p.poly([[X(0), Y(2.2)], [X(0.2), Y(4.6)], [X(4.4), Y(4.8)], [X(4.9), Y(6)], [X(5.9), Y(5.9)], [X(6.4), Y(4.8)], [X(7.2), Y(4.4)], [X(8.8), Y(4.4)], [X(9), Y(3)], [X(7.4), Y(2.8)], [X(6.8), Y(1.6)], [X(6.4), Y(2.2)]], col || '#D8CDB8', 0.6);
    p.line([[X(6.2), Y(2.6)], [X(6.6), Y(1.4)]], 0.4);   // dewlap
    if (o.long) { p.line([[X(7.6), Y(4.6)], [X(6.6), Y(6)], [X(6.8), Y(7.4)], [X(7.4), Y(8)]], 0.7, '#8A7454'); p.line([[X(8.2), Y(4.6)], [X(9.4), Y(6)], [X(9.4), Y(7.4)], [X(8.9), Y(8)]], 0.7, '#8A7454'); }
    else { p.line([[X(7.6), Y(4.6)], [X(7.2), Y(5.8)]], 0.5); p.line([[X(8.4), Y(4.6)], [X(8.8), Y(5.8)]], 0.5); }
    p.line([[X(0), Y(4.2)], [X(-0.7), Y(2)]], 0.45);
  }
  function buffalo(p, x, y, k) {
    const X = v => x + v * k, Y = v => y - v * k;
    for (const lx of [0.8, 1.8, 5.4, 6.4]) p.line([[X(lx), Y(0)], [X(lx), Y(2)]], 0.65);
    p.poly([[X(0), Y(2)], [X(0.2), Y(4.8)], [X(6.8), Y(5.2)], [X(7.4), Y(4.6)], [X(9.2), Y(4.2)], [X(9.4), Y(2.8)], [X(7.4), Y(2.4)], [X(7), Y(2)]], '#5E5A58', 0.6);
    p.line([[X(7.2), Y(5)], [X(5.8), Y(6.2)], [X(4.8), Y(5.8)]], 0.7); p.line([[X(8.2), Y(5)], [X(9.6), Y(6.4)], [X(10.6), Y(6)]], 0.7);
    p.line([[X(0), Y(4.4)], [X(-0.6), Y(2.2)]], 0.45);
  }
  function llama(p, x, y, k, col, load) {
    const X = v => x + v * k, Y = v => y - v * k;
    for (const lx of [0.6, 1.4, 4.4, 5.2]) p.line([[X(lx), Y(0)], [X(lx), Y(3)]], 0.5);
    p.poly([[X(0), Y(3)], [X(0.2), Y(5.4)], [X(5), Y(5.4)], [X(5.2), Y(9.4)], [X(5.6), Y(10.4)], [X(7.2), Y(10)], [X(7.2), Y(9.4)], [X(6.2), Y(9.2)], [X(6), Y(4.8)], [X(5.6), Y(3)]], col || '#E6DCC6', 0.55);
    p.line([[X(5.6), Y(10.3)], [X(5.4), Y(11.3)]], 0.4); p.line([[X(6), Y(10.3)], [X(6.1), Y(11.3)]], 0.4);
    if (load) { p.rect(X(1), Y(6.8), 3.4 * k, 1.6 * k, load, 0.4); p.line([[X(1), Y(6)], [X(4.4), Y(6)]], 0.35, PAL.red); }
    else p.dot(X(5.8), Y(10.6), 0.35, PAL.red);
  }
  function goat(p, x, y, k, col) { const X = v => x + v * k, Y = v => y - v * k; for (const lx of [0.6, 1.4, 3.6, 4.4]) p.line([[X(lx), Y(0)], [X(lx), Y(1.6)]], 0.45); p.poly([[X(0), Y(1.6)], [X(0.2), Y(3.2)], [X(4.4), Y(3.4)], [X(5.6), Y(4.6)], [X(6.4), Y(4)], [X(5.2), Y(2.8)], [X(4.6), Y(1.6)]], col || '#5A4636', 0.5); p.line([[X(5.4), Y(4.4)], [X(5), Y(5.4)]], 0.4); }
  function donkey(p, x, y, k, o) { o = o || {}; horse(p, x, y, k, { col: o.col || '#9C9182' }); const X = v => x + v * k, Y = v => y - v * k; p.line([[X(12.4), Y(11.4)], [X(12.2), Y(13.6)]], 0.5); p.line([[X(12.9), Y(11.4)], [X(13.2), Y(13.4)]], 0.5); if (o.load) { p.rect(X(2.4), Y(10.6), 5 * k, 3 * k, o.load, 0.5); p.line([[X(2.4), Y(9.2)], [X(7.4), Y(9.2)]], 0.3); } }
  const sk = (f, i) => SK[f][i % SK[f].length];

  // ---- North Africa and the Middle East: thobe, jalabiya, keffiyeh and turban; abaya and headscarf; camels, donkeys, goats
  ldef('lr-mn-camels', 46, 18, p => { p.shadow(23, 17.4, 21); for (let i = 0; i < 2; i++) camel(p, 3 + i * 16, 17, 0.95, { load: [PAL.red, PAL.ochre][i] }); figure(p, 41, 17, 0.9, { dress: 'robe', col: '#EDE6D4', hat: 'keffiyeh', hatCol: '#E8E0D0', skin: sk('mn', 0), staff: true }); });
  ldef('lr-mn-camelrider', 22, 22, p => { p.shadow(10, 21.4, 9); camel(p, 2, 21, 1, { saddle: PAL.red }); seated(p, 7.2, 12.6, 1, { dress: 'robe', col: '#D8CDB8', hat: 'turban', hatCol: '#F2EEE2', skin: sk('mn', 1) }); });
  ldef('lr-mn-donkey', 26, 16, p => { p.shadow(12, 15.4, 11); figure(p, 3.4, 15, 1, { dress: 'robe', col: '#6E8AA0', hat: 'turban', hatCol: '#F2EEE2', skin: sk('mn', 2), staff: true }); donkey(p, 8, 15, 0.72, { load: PAL.ochre }); });
  ldef('lr-mn-women', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'robe', col: '#2E2A30', hat: 'abaya', hatCol: '#2E2A30', skin: sk('mn', 0), load: 'head', loadCol: PAL.straw }); figure(p, 10.4, 14, 0.95, { dress: 'robe', col: '#7A4A5A', hat: 'scarf', hatCol: '#E9DFC6', skin: sk('mn', 2) }); });
  ldef('lr-mn-rider', 22, 20, p => { p.shadow(7, 19.3, 7); horse(p, 2, 19, 1, { col: '#E6DCC4' }); seated(p, 7.6, 11.6, 1, { dress: 'robe', col: '#F2EEE2', hat: 'keffiyeh', hatCol: '#C8483A', skin: sk('mn', 1) }); });
  ldef('lr-mn-walker', 10, 15, p => { p.shadow(5, 14.4, 3.5); figure(p, 4.6, 14, 1, { dress: 'robe', col: '#B8A07A', hat: 'turban', hatCol: '#F2EEE2', skin: sk('mn', 1), staff: true }); });
  ldef('lr-mn-goats', 30, 15, p => { p.shadow(15, 14.4, 13); for (const [gx, gy, c] of [[10, 14, '#5A4636'], [15, 12.6, '#E6DCC4'], [19, 14.2, '#3A2E26'], [23.4, 12.8, '#8A6A4E']]) goat(p, gx, gy, 1.1, c); figure(p, 4, 14, 1, { dress: 'robe', col: '#8A7A5A', hat: 'keffiyeh', hatCol: '#F2EEE2', skin: sk('mn', 0), staff: true }); });
  // ---- Central Asia: chapan and doppa; Bactrian camels, horses, fat-tailed sheep; women in long dresses and headscarves
  ldef('lr-ca-rider', 22, 20, p => { p.shadow(7, 19.3, 7); horse(p, 2, 19, 1, { col: PAL.horse }); seated(p, 7.6, 11.6, 1, { dress: 'robe', col: '#3E5A8A', hat: 'doppa', hatCol: '#2B2119', skin: sk('ca', 0) }); p.line([[9, 10.4], [9, 6]], 0.5, '#C8A040'); });
  ldef('lr-ca-camel', 22, 22, p => { p.shadow(10, 21.4, 9); camel(p, 2, 21, 1, { two: true, col: '#A87E52' }); seated(p, 7.6, 12.4, 1, { dress: 'robe', col: '#8A2E3A', hat: 'doppa', hatCol: '#2B2119', skin: sk('ca', 1) }); });
  ldef('lr-ca-donkey', 26, 16, p => { p.shadow(12, 15.4, 11); figure(p, 3.4, 15, 1, { dress: 'robe', col: '#4E6A4A', hat: 'doppa', hatCol: '#2B2119', skin: sk('ca', 2), staff: true }); donkey(p, 8, 15, 0.72, { load: PAL.red }); });
  ldef('lr-ca-women', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'robe', col: '#B4362A', trim: '#E3B23C', hat: 'scarf', hatCol: '#E3B23C', skin: sk('ca', 0) }); figure(p, 10.4, 14, 0.95, { dress: 'robe', col: '#3F6FB0', trim: '#F2EEE2', hat: 'scarf', hatCol: '#F2EEE2', skin: sk('ca', 1), load: 'pot' }); });
  ldef('lr-ca-sheep', 34, 15, p => { p.shadow(17, 14.4, 15); for (const [sx, sy] of [[12, 14], [17, 12.4], [21.4, 14.2], [26, 12.6], [15, 11]]) { sheep(p, sx, sy, 1.15); p.ell(sx - 0.2, sy - 2.2, 0.9, 1, '#C8B898', 0.4); } figure(p, 4, 14, 1, { dress: 'robe', col: '#5A4A3A', hat: 'doppa', hatCol: '#2B2119', skin: sk('ca', 1), staff: true }); });
  // ---- sub-Saharan Africa: wrappers and head-loads, zebu with long horns, donkeys, ox carts, goats
  ldef('lr-af-headload', 16, 17, p => { p.shadow(8, 16.4, 6.5); figure(p, 4, 16, 1, { dress: 'wrap', col: '#C8642E', col2: '#3F6FB0', col3: '#E3B23C', hat: 'scarf', hatCol: '#E3B23C', skin: sk('af', 0), load: 'head', loadCol: PAL.straw, loadCol2: '#4E8A52' }); figure(p, 10.6, 16, 0.95, { dress: 'wrap', col: '#E3B23C', col2: '#8A2E3A', hat: 'scarf', hatCol: '#8A2E3A', skin: sk('af', 1), load: 'baby', loadCol: '#3F6FB0' }); });
  ldef('lr-af-zebu', 40, 16, p => { p.shadow(18, 15.4, 16); zebu(p, 10, 15, 1.3, '#C8A07A', { long: true }); zebu(p, 21, 13.6, 1.2, '#E6DCC6', { long: true }); zebu(p, 25, 15.4, 1.3, '#6A4A36', { long: true }); figure(p, 4, 15, 1, { dress: 'robe', col: '#B4362A', skin: sk('af', 2), staff: true, hat: 'none' }); });
  ldef('lr-af-donkey', 26, 16, p => { p.shadow(12, 15.4, 11); figure(p, 3.4, 15, 1, { col: '#E6DCC6', legCol: PAL.ink, skin: sk('af', 3), staff: true, hat: 'kufi', hatCol: '#3F6FB0' }); donkey(p, 8, 15, 0.72, { load: '#D8B860' }); });
  ldef('lr-af-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { col: '#4E8A52', skin: sk('af', 1), staff: true }); figure(p, 10.4, 14, 0.95, { dress: 'wrap', col: '#B4362A', col2: '#E3B23C', hat: 'scarf', hatCol: '#B4362A', skin: sk('af', 0), load: 'pot' }); });
  ldef('lr-af-oxcart', 38, 16, p => { p.shadow(17, 15.4, 15); cart(p, 2, 15, 11, { load: 'sacks', shaft: 3.4 }); zebu(p, 16.4, 15, 1.2, '#C8A07A', { long: true }); zebu(p, 19, 14, 1.1, '#6A4A36', { long: true }); figure(p, 33.6, 15, 0.9, { col: '#3F6FB0', skin: sk('af', 3), staff: true }); });
  ldef('lr-af-goats', 30, 15, p => { p.shadow(15, 14.4, 13); for (const [gx, gy, c] of [[10, 14, '#5A4636'], [15, 12.6, '#F2EEE2'], [19, 14.2, '#3A2E26'], [23.4, 12.8, '#A07A4F']]) goat(p, gx, gy, 1.1, c); figure(p, 4, 14, 0.9, { col: '#E3B23C', skin: sk('af', 2), staff: true }); });
  // ---- the Sahel: boubou and turban, the indigo tagelmust of the Tuareg, Fulani herders with zebu, wrappers and head-loads
  ldef('lr-sh-camels', 46, 22, p => { p.shadow(23, 21.4, 21); camel(p, 3, 21, 0.95, { load: '#8A2E3A' }); camel(p, 19, 21, 1, { saddle: PAL.red }); seated(p, 24, 12.6, 1, { dress: 'robe', col: '#2E3E6E', hat: 'veil', hatCol: '#2E3E6E', skin: sk('sh', 0) }); });
  ldef('lr-sh-rider', 22, 20, p => { p.shadow(7, 19.3, 7); horse(p, 2, 19, 1, { col: '#E6DCC4' }); seated(p, 7.6, 11.6, 1, { dress: 'robe', col: '#3F6FB0', hat: 'turban', hatCol: '#F2EEE2', skin: sk('sh', 1) }); });
  ldef('lr-sh-donkey', 26, 16, p => { p.shadow(12, 15.4, 11); figure(p, 3.4, 15, 1, { dress: 'robe', col: '#E6DCC6', hat: 'kufi', hatCol: '#F2EEE2', skin: sk('sh', 2), staff: true }); donkey(p, 8, 15, 0.72, { load: '#B4362A' }); });
  ldef('lr-sh-women', 16, 17, p => { p.shadow(8, 16.4, 6.5); figure(p, 4, 16, 1, { dress: 'wrap', col: '#3F6FB0', col2: '#E3B23C', hat: 'scarf', hatCol: '#E3B23C', skin: sk('sh', 0), load: 'head', loadCol: '#C8A06A' }); figure(p, 10.6, 16, 0.95, { dress: 'robe', col: '#8A2E3A', hat: 'scarf', hatCol: '#E6DCC6', skin: sk('sh', 1), load: 'pot' }); });
  ldef('lr-sh-zebu', 40, 16, p => { p.shadow(18, 15.4, 16); zebu(p, 10, 15, 1.3, '#B86A3A', { long: true }); zebu(p, 21, 13.6, 1.2, '#E6DCC6', { long: true }); zebu(p, 25, 15.4, 1.3, '#8A4A2A', { long: true }); figure(p, 4, 15, 1, { col: '#E6DCC6', hat: 'conical', hatCol: '#C8A060', skin: sk('sh', 2), staff: true }); });
  // ---- South Asia: dhoti, kurta and turban, saris, bullock carts and zebu
  ldef('lr-sa-bullock', 38, 18, p => { p.shadow(17, 17.4, 15); cart(p, 2, 17, 11, { load: 'hay', shaft: 3.4 }); zebu(p, 16.4, 17, 1.25, '#E6DCC6'); zebu(p, 19.4, 16, 1.15, '#D8CDB8'); seated(p, 10.6, 11.6, 0.9, { col: '#F2EEE2', hat: 'turban', hatCol: '#D9701E', skin: sk('sa', 0) }); });
  ldef('lr-sa-zebu', 36, 15, p => { p.shadow(17, 14.4, 15); zebu(p, 10, 14, 1.25, '#E6DCC6'); zebu(p, 20, 12.8, 1.15, '#B8A890'); zebu(p, 23.4, 14.4, 1.2, '#D8CDB8'); figure(p, 4, 14, 1, { dress: 'dhoti', col: '#F2EEE2', hat: 'turban', hatCol: '#B4362A', skin: sk('sa', 1), staff: true }); });
  ldef('lr-sa-sari', 16, 17, p => { p.shadow(8, 16.4, 6.5); figure(p, 4, 16, 1, { dress: 'sari', col: '#C8326A', col2: '#E3B23C', hat: 'none', skin: sk('sa', 0), load: 'pot' }); figure(p, 10.6, 16, 0.95, { dress: 'sari', col: '#3F8A6A', col2: '#D9701E', hat: 'none', skin: sk('sa', 2), load: 'head', loadCol: PAL.straw }); });
  ldef('lr-sa-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'dhoti', col: '#F2EEE2', hat: 'turban', hatCol: '#E3B23C', skin: sk('sa', 1), staff: true }); figure(p, 10.4, 14, 0.95, { dress: 'kurta', col: '#3F6FB0', legCol: PAL.ink, hat: 'none', skin: sk('sa', 0) }); });
  ldef('lr-sa-pots', 16, 17, p => { p.shadow(8, 16.4, 6.5); figure(p, 4, 16, 1, { dress: 'sari', col: '#D9701E', col2: '#B4362A', skin: sk('sa', 2), load: 'pot' }); figure(p, 10.6, 16, 0.95, { dress: 'sari', col: '#5A4AA0', col2: '#E3B23C', skin: sk('sa', 1), load: 'pot', loadCol: '#B8B8B0' }); });
  // ---- Pakistan and Bangladesh: shalwar kameez with topi or turban, dupatta, bullock carts, donkeys
  ldef('lr-pk-bullock', 38, 18, p => { p.shadow(17, 17.4, 15); cart(p, 2, 17, 11, { load: 'sacks', shaft: 3.4 }); zebu(p, 16.4, 17, 1.25, '#D8CDB8'); zebu(p, 19.4, 16, 1.15, '#B8A890'); seated(p, 10.6, 11.6, 0.9, { col: '#E6DCC6', hat: 'topi', hatCol: '#F2EEE2', skin: sk('pk', 0) }); });
  ldef('lr-pk-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'kurta', col: '#E6DCC6', legCol: '#C8BBA0', hat: 'turban', hatCol: '#F2EEE2', skin: sk('pk', 1), staff: true }); figure(p, 10.4, 14, 0.95, { dress: 'kurta', col: '#5A7A9A', legCol: '#5A7A9A', hat: 'topi', hatCol: '#F2EEE2', skin: sk('pk', 2) }); });
  ldef('lr-pk-women', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'robe', col: '#3F8A6A', hat: 'scarf', hatCol: '#E3B23C', skin: sk('pk', 0) }); figure(p, 10.4, 14, 0.95, { dress: 'robe', col: '#B4362A', hat: 'scarf', hatCol: '#F2EEE2', skin: sk('pk', 2), load: 'pot', loadCol: '#B8B8B0' }); });
  ldef('lr-pk-donkey', 26, 16, p => { p.shadow(12, 15.4, 11); figure(p, 3.4, 15, 1, { dress: 'kurta', col: '#8A7A5A', legCol: '#8A7A5A', hat: 'turban', hatCol: '#F2EEE2', skin: sk('pk', 1), staff: true }); donkey(p, 8, 15, 0.72, { load: '#D8B860' }); });
  // ---- East Asia: carrying poles and straw hats, robes, ox carts, wheelbarrows, riders
  ldef('lr-ea-pole', 16, 15, p => { p.shadow(8, 14.4, 6); figure(p, 8, 14, 1, { col: '#5A6E86', legCol: PAL.ink, hat: 'conical', hatCol: PAL.straw, skin: sk('ea', 0), load: 'pole' }); });
  ldef('lr-ea-rider', 22, 20, p => { p.shadow(7, 19.3, 7); horse(p, 2, 19, 1, { col: PAL.horseDark }); seated(p, 7.6, 11.6, 1, { dress: 'robe', col: '#3E5A7A', hat: 'cap', hatCol: '#2B2119', skin: sk('ea', 1) }); });
  ldef('lr-ea-oxcart', 36, 16, p => { p.shadow(17, 15.4, 15); cart(p, 2, 15, 11, { load: 'sacks', shaft: 3.4 }); ox(p, 16.4, 15, 1.25); figure(p, 31.6, 15, 0.9, { col: '#8A7A5A', legCol: PAL.ink, hat: 'straw', hatCol: PAL.straw, skin: sk('ea', 2), staff: true }); });
  ldef('lr-ea-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'robe', col: '#5A6E86', hat: 'cap', hatCol: '#2B2119', skin: sk('ea', 0), staff: true }); figure(p, 10.4, 14, 0.95, { dress: 'robe', col: '#B4473A', trim: '#E3B23C', hat: 'none', skin: sk('ea', 1) }); });
  ldef('lr-ea-barrow', 18, 13, p => { p.shadow(9, 12.4, 7.5); p.ell(4, 10.8, 1.8, 1.8, PAL.paperFill, 0.6); p.poly([[1.6, 9], [9, 8.4], [9.4, 6.4], [2.2, 6.4]], PAL.brownSoft, 0.55); p.ell(5, 5.6, 2.6, 1.4, PAL.wool, 0.45); p.line([[9, 8.6], [12, 9.2]], 0.5); figure(p, 13.4, 12.6, 0.85, { col: '#5A6E86', legCol: PAL.ink, hat: 'straw', hatCol: PAL.straw, skin: sk('ea', 2) }); });
  // ---- Southeast Asia: water buffalo, conical hats, carrying poles, buffalo carts
  ldef('lr-se-buffalo', 22, 16, p => { p.shadow(9, 15.4, 9); buffalo(p, 3, 15, 1.4); seated(p, 7, 8.4, 0.85, { col: '#3E4A5A', hat: 'conical', hatCol: PAL.straw, skin: sk('se', 0) }); });
  ldef('lr-se-pole', 16, 15, p => { p.shadow(8, 14.4, 6); figure(p, 8, 14, 1, { col: '#3E4A5A', legCol: PAL.ink, hat: 'conical', hatCol: '#E0CC90', skin: sk('se', 1), load: 'pole', loadCol: '#6E8A4A' }); });
  ldef('lr-se-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { col: '#6A4A7A', legCol: PAL.ink, hat: 'conical', hatCol: '#E0CC90', skin: sk('se', 0), load: 'back', loadCol: PAL.straw }); figure(p, 10.4, 14, 0.95, { dress: 'wrap', col: '#F2EEE2', col2: '#8A2E3A', hat: 'conical', hatCol: '#E0CC90', skin: sk('se', 2) }); });
  ldef('lr-se-buffcart', 38, 16, p => { p.shadow(17, 15.4, 15); cart(p, 2, 15, 11, { load: 'hay', shaft: 3.4 }); buffalo(p, 16.4, 15, 1.3); figure(p, 33.4, 15, 0.9, { col: '#3E4A5A', legCol: PAL.ink, hat: 'conical', hatCol: '#E0CC90', skin: sk('se', 1), staff: true }); });
  // ---- Malaysia, Indonesia, Brunei: baju Melayu with songkok, baju kurung and headscarf
  ldef('lr-ml-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'kurta', col: '#3E7A8A', legCol: '#3E7A8A', belt: '#C9982E', hat: 'songkok', hatCol: '#2B2119', skin: sk('ml', 0) }); figure(p, 10.4, 14, 0.95, { dress: 'robe', col: '#C8642E', hat: 'scarf', hatCol: '#F2EEE2', skin: sk('ml', 1), load: 'head', loadCol: PAL.straw }); });
  ldef('lr-ml-buffalo', 22, 16, p => { p.shadow(9, 15.4, 9); buffalo(p, 3, 15, 1.4); seated(p, 7, 8.4, 0.85, { col: '#4E7A52', hat: 'songkok', hatCol: '#2B2119', skin: sk('ml', 2) }); });
  // ---- the Americas: ponchos and wide hats, pack mules, ox carts, vaqueros and cattle
  ldef('lr-am-rider', 22, 20, p => { p.shadow(7, 19.3, 7); horse(p, 2, 19, 1, { col: PAL.horse }); seated(p, 7.6, 11.6, 1, { dress: 'poncho', col: '#B4362A', col2: '#E3B23C', hat: 'wide', hatCol: '#D8C08A', skin: sk('am', 0) }); });
  ldef('lr-am-mules', 44, 18, p => { p.shadow(22, 17.4, 20); for (let i = 0; i < 3; i++) { const x0 = 3 + i * 12.5; donkey(p, x0, 17, 0.8, { col: ['#6A4A36', '#9C8466', '#4E3423'][i], load: [PAL.ochre, PAL.wool, PAL.red][i] }); } figure(p, 41, 17, 0.9, { dress: 'poncho', col: '#3F6FB0', col2: '#B4362A', hat: 'wide', hatCol: '#D8C08A', skin: sk('am', 1), staff: true }); });
  ldef('lr-am-oxcart', 38, 16, p => { p.shadow(17, 15.4, 15); cart(p, 2, 15, 11, { load: 'sacks', shaft: 3.4 }); ox(p, 16.4, 15, 1.3); ox(p, 19.4, 14, 1.2); figure(p, 33.6, 15, 0.9, { col: '#F2EEE2', legCol: PAL.ink, hat: 'wide', hatCol: '#D8C08A', skin: sk('am', 3), staff: true }); });
  ldef('lr-am-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'robe', col: '#8A2E3A', hat: 'scarf', hatCol: '#3F6FB0', skin: sk('am', 1), load: 'head', loadCol: PAL.straw, loadCol2: '#D9701E' }); figure(p, 10.4, 14, 0.95, { col: '#F2EEE2', legCol: PAL.ink, hat: 'wide', hatCol: '#D8C08A', skin: sk('am', 2) }); });
  ldef('lr-am-cattle', 40, 20, p => { p.shadow(18, 19.4, 16); cow(p, 12, 19, 1.3, PAL.brownSoft); cow(p, 23, 17.8, 1.2, '#E6DCC4'); cow(p, 26.4, 19.6, 1.3, '#6F4E37'); horse(p, 1, 19, 0.8, { col: PAL.horseDark }); seated(p, 5.4, 13, 0.85, { col: '#5A7A9A', hat: 'wide', hatCol: '#D8C08A', skin: sk('am', 3) }); });
  // ---- the Andes: llama trains, women in polleras with bowler hats and woven carrying cloths, herders in ponchos and chullos
  ldef('lr-an-llamas', 40, 15, p => { p.shadow(20, 14.4, 18); for (const [lx, ly, c, l] of [[11, 14, '#E6DCC6', '#B4362A'], [18.4, 12.8, '#8A6A4E', '#3F6FB0'], [24.6, 14.2, '#F2EEE2', '#E3B23C'], [30.6, 13, '#4E3A2A', '#4E8A52']]) llama(p, lx, ly, 1.1, c, l); figure(p, 4, 14, 1, { dress: 'poncho', col: '#B4362A', col2: '#3F6FB0', col3: '#E3B23C', hat: 'chullo', hatCol: '#E6DCC6', skin: sk('an', 0), staff: true }); });
  ldef('lr-an-women', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { dress: 'pollera', col: '#C8326A', col2: '#3F6FB0', hat: 'bowler', hatCol: '#3A2E26', skin: sk('an', 1), load: 'back', loadCol: '#D9701E' }); figure(p, 10.6, 14, 0.95, { dress: 'pollera', col: '#3F8A6A', col2: '#8A2E3A', hat: 'bowler', hatCol: '#5A4A3A', skin: sk('an', 2) }); });
  // ---- North America, Australia, New Zealand: a mix of riders and walkers of every background
  ldef('lr-na-rider', 22, 20, p => { p.shadow(7, 19.3, 7); horse(p, 2, 19, 1, { col: PAL.horse }); seated(p, 7.6, 11.6, 1, { col: '#5A7A9A', hat: 'wide', hatCol: '#8A6A4E', skin: sk('na', 2) }); });
  ldef('lr-na-walkers', 16, 15, p => { p.shadow(8, 14.4, 6.5); figure(p, 4, 14, 1, { col: '#6A4A36', legCol: PAL.ink, hat: 'wide', hatCol: '#5A4A3A', skin: sk('na', 1), staff: true }); figure(p, 10.4, 14, 0.95, { dress: 'robe', col: '#3F6FB0', hat: 'scarf', hatCol: '#F2EEE2', skin: sk('na', 3) }); });
  // names for the popups (js/ink-life.js)
  const LAZY_NAMES = { camels: 'Camel caravan', camelrider: 'Rider on a camel', camel: 'Rider on a camel', donkey: 'Traveller with a donkey', women: 'Women on the road', rider: 'Rider', walker: 'Traveller on foot', goats: 'Goatherd',
    sheep: 'Shepherd and flock', headload: 'Women carrying loads', zebu: 'Herder with zebu cattle', walkers: 'Travellers on foot', oxcart: 'Ox cart', bullock: 'Bullock cart', sari: 'Women in saris', pots: 'Women carrying water',
    pole: 'Porter with a carrying pole', barrow: 'Wheelbarrow', buffalo: 'Water buffalo and rider', buffcart: 'Buffalo cart', mules: 'Muleteer and pack mules', cattle: 'Vaquero with cattle', llamas: 'Herder with a llama train' };

  // ---------------- public API
  const SMOKE_AT = {};   // sprite id -> [x, y] of its chimney top, in logical px from the trimmed sprite's bottom-centre
  let cache = null;
  function build() {
    if (cache) return cache;
    cache = new Map();
    for (const [id, w, h, draw, o] of ART) {
      const p = Pen(w, h, hashStr(id)); draw(p);
      let c = o.noTrim ? p.c : trim(p.c);
      cache.set(id, c);
      // the chimney top relative to the bottom-centre of the trimmed sprite (where the map anchors it), in logical px
      if (o.smoke) SMOKE_AT[id] = [(o.smoke[0] * SC - (c._x0 || 0) - c.width / 2) / SC, o.smoke[1] - h];
      // travellers get a mirrored copy, for those going left
      if (id.startsWith('lr-') && id !== 'lr-train') cache.set(id + '-l', mirror(c));
    }
    return cache;
  }
  function addAll(map) {
    const C = build();
    for (const [id, c] of C) if (!map.hasImage(id)) map.addImage(id, c.getContext('2d').getImageData(0, 0, c.width, c.height), { pixelRatio: SC });
    return [...C.keys()];
  }
  // one sprite, when a tile first asks for it; "id-s" is its winter twin: the same drawing with snow lying on every upward
  // face (a white cap a couple of pixels deep wherever the ink meets open sky above it), made from the pixels, not redrawn
  const imgOf = c => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  function snowy(img) {
    const W = img.width, H = img.height, d = new Uint8ClampedArray(img.data), T = Math.round(1.7 * SC);
    for (let x = 0; x < W; x++) {
      let run = 0, prev = 0;
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4, a = d[i + 3];
        if (a > 90 && prev <= 90) run = T;
        if (a > 90 && run > 0) { const k = run === T ? 0.75 : 0.92; d[i] = d[i] * (1 - k) + 251 * k; d[i + 1] = d[i + 1] * (1 - k) + 250 * k; d[i + 2] = d[i + 2] * (1 - k) + 244 * k; run--; }
        else if (a <= 90) run = 0;
        prev = a;
      }
    }
    return new ImageData(d, W, H);
  }
  // a regional traveller (LAZY) is drawn, trimmed and mirrored the first time it is asked for
  function lazyGet(id) {
    const C = build(); if (C.has(id)) return C.get(id);
    const base = id.replace(/-l$/, ''), L = LAZY.get(base); if (!L) return null;
    const p = Pen(L[0], L[1], hashStr(base)); L[2](p); const c = trim(p.c);
    C.set(base, c); C.set(base + '-l', mirror(c));
    return C.get(id);
  }
  function addOne(map, id) {
    const win = /-s$/.test(id), c = lazyGet(win ? id.slice(0, -2) : id);
    if (!c || map.hasImage(id)) return !!c;
    map.addImage(id, win ? snowy(imgOf(c)) : imgOf(c), { pixelRatio: SC });
    return true;
  }
  function draw(id) { const c = lazyGet(id); if (!c) return null; const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0); o.style.width = (c.width / SC * 1.4) + 'px'; return o; }
  global.InkLifeArt = { addAll, addOne, draw, smokeFrames, SMOKE_AT, PAL, SC, ids: () => [...new Set([...build().keys()].concat([...LAZY.keys()].flatMap(i => [i, i + '-l'])))], NAMES: id => { const m = /^lr-[a-z]{2}-([a-z]+)/.exec(id); return m ? LAZY_NAMES[m[1]] : null; } };
})(window);
