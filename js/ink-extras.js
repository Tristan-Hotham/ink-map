/* The Inked World: the page's ink scale bar, compass rose, decorative border and the "Ink your home" poster.
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const INK = '#2B2119', PAPER = '#F3E5BF', RED = '#A3261B', GOLD = '#B8862B';
  const SERIF = '"Source Serif 4", Georgia, "Times New Roman", serif', HAND = 'MedievalSharp, "Fraunces", Georgia, serif';

  // ---------------- scale: a "nice" length that fits in maxPx at the centre of the view
  function metresPerPx(map) {
    const lat = map.getCenter().lat;
    return 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
  }
  function niceScale(mpp, maxPx) {
    const maxM = mpp * maxPx, p = Math.pow(10, Math.floor(Math.log10(maxM)));
    let m = p; for (const k of [1, 2, 5]) if (k * p <= maxM) m = k * p;
    const km = m >= 1000;
    return { m, px: m / mpp, label: km ? (m / 1000).toLocaleString('en-GB') + ' km' : m.toLocaleString('en-GB') + ' m', half: km ? (m / 2000).toLocaleString('en-GB') : (m / 2).toLocaleString('en-GB') };
  }
  // drawn on a 2D canvas context: four segments, ink and paper by turns, between two hairlines, with figures above
  function drawScale(ctx, x, y, mpp, maxPx, s) {
    const sc = niceScale(mpp, maxPx), w = sc.px, h = 5 * s, seg = w / 4;
    ctx.save();
    ctx.fillStyle = 'rgba(243,229,191,0.82)'; ctx.fillRect(x - 6 * s, y - 15 * s, w + 34 * s, h + 20 * s);
    ctx.lineWidth = 1 * s; ctx.strokeStyle = INK;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? PAPER : INK; ctx.fillRect(x + i * seg, y, seg, h); }
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath(); ctx.moveTo(x, y + h + 2 * s); ctx.lineTo(x + w, y + h + 2 * s); ctx.lineWidth = 0.6 * s; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `italic ${10 * s}px ${SERIF}`; ctx.textBaseline = 'bottom';
    ctx.textAlign = 'center'; ctx.fillText('0', x, y - 2 * s); ctx.fillText(sc.half, x + w / 2, y - 2 * s);
    ctx.textAlign = 'left'; ctx.fillText(sc.label, x + w - 4 * s, y - 2 * s);
    ctx.restore();
    return sc;
  }
  function scaleBar(map, el) {
    const c = document.createElement('canvas'); el.appendChild(c);
    const upd = () => {
      const dpr = window.devicePixelRatio || 1, W = 190, H = 34;
      c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const sc = drawScale(ctx, 8, 20, metresPerPx(map), 130, 1);
      c.setAttribute('aria-label', 'Scale: ' + sc.label);
    };
    map.on('move', upd); upd();
    return c;
  }

  // ---------------- compass rose: eight points, half inked and half paper, a red north and a double ring
  function compassSVG(size) {
    const r = 46, pts = [];
    const tri = (a, len, wid, side) => { const ax = Math.cos(a), ay = Math.sin(a), bx = Math.cos(a + side * Math.PI / 2), by = Math.sin(a + side * Math.PI / 2); return `M50,50 L${50 + ax * len},${50 + ay * len} L${50 + bx * wid},${50 + by * wid} Z`; };
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 4, big = k % 2 === 0, len = big ? 44 : 27, wid = big ? 7 : 5;
      const fillA = k === 0 ? RED : INK;
      pts.push(`<path d="${tri(a, len, wid, -1)}" fill="${fillA}" stroke="${INK}" stroke-width="0.9"/>`);
      pts.push(`<path d="${tri(a, len, wid, 1)}" fill="#FBF3DC" stroke="${INK}" stroke-width="0.9"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -14 100 114" width="${size}" height="${size * 1.14}" aria-hidden="true">` +
      `<circle cx="50" cy="50" r="${r - 12}" fill="rgba(243,229,191,0.75)" stroke="${INK}" stroke-width="1.1"/><circle cx="50" cy="50" r="${r - 15}" fill="none" stroke="${INK}" stroke-width="0.5"/>` +
      Array.from({ length: 32 }, (_, i) => { const a = i * Math.PI / 16, r0 = r - 15, r1 = r - (i % 4 ? 13.5 : 12); return `<line x1="${50 + Math.cos(a) * r0}" y1="${50 + Math.sin(a) * r0}" x2="${50 + Math.cos(a) * r1}" y2="${50 + Math.sin(a) * r1}" stroke="${INK}" stroke-width="0.6"/>`; }).join('') +
      pts.join('') + `<circle cx="50" cy="50" r="3" fill="${GOLD}" stroke="${INK}" stroke-width="0.8"/>` +
      `<text x="50" y="2" text-anchor="middle" font-family="MedievalSharp, Georgia, serif" font-size="14" fill="${RED}">N</text></svg>`;
  }
  function svgImage(svg) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  }

  // ---------------- decorative border: a chequered band between two ink rules, with corner blocks, as on old printed maps
  function drawFrame(ctx, x, y, w, h, s) {
    const b = 9 * s, seg = 22 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(243,229,191,0.92)';
    ctx.fillRect(x, y, w, b); ctx.fillRect(x, y + h - b, w, b); ctx.fillRect(x, y, b, h); ctx.fillRect(x + w - b, y, b, h);
    ctx.fillStyle = INK;
    const band = (x0, y0, len, horiz) => { for (let t = b, i = 0; t < len - b; t += seg, i++) { if (i % 2) continue; const L = Math.min(seg, len - b - t); if (horiz) ctx.fillRect(x0 + t, y0 + b * 0.32, L, b * 0.36); else ctx.fillRect(x0 + b * 0.32, y0 + t, b * 0.36, L); } };
    band(x, y, w, true); band(x, y + h - b, w, true); band(x, y, h, false); band(x + w - b, y, h, false);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6 * s; ctx.strokeRect(x + 0.8 * s, y + 0.8 * s, w - 1.6 * s, h - 1.6 * s);
    ctx.lineWidth = 0.9 * s; ctx.strokeRect(x + b, y + b, w - 2 * b, h - 2 * b);
    for (const [cx, cy] of [[x, y], [x + w - b, y], [x, y + h - b], [x + w - b, y + h - b]]) { ctx.fillStyle = RED; ctx.fillRect(cx + b * 0.2, cy + b * 0.2, b * 0.6, b * 0.6); ctx.strokeRect(cx + b * 0.2, cy + b * 0.2, b * 0.6, b * 0.6); }
    ctx.restore();
  }
  function frameOverlay(host) {
    const c = document.createElement('canvas'); c.className = 'ink-frame'; c.setAttribute('aria-hidden', 'true'); host.appendChild(c);
    const draw = () => {
      const dpr = window.devicePixelRatio || 1, W = host.clientWidth, H = host.clientHeight;
      c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); drawFrame(ctx, 0, 0, W, H, 1);
    };
    new ResizeObserver(draw).observe(host); draw();
    return c;
  }

  // ---------------- "Ink your home": the current view re-drawn at two or three times the screen's pixels, framed as a poster
  const CREDIT = 'Map data © OpenStreetMap contributors (ODbL) · Tiles: OpenFreeMap, © OpenMapTiles · Elevation: AWS Terrain Tiles (Mapzen; SRTM, GMTED2010, ETOPO1 and others) · ' +
    'Biomes: RESOLVE Ecoregions 2017 (CC BY 4.0) · Heritage and summits: Wikidata (CC0) · Lettering lines: Natural Earth, ONS (OGL v3) · Ship lanes: CLIWOC · ' +
    'The Inked World, Dr Tristan Hotham, maps.tristanhotham.com/ink-map';
  function wrapText(ctx, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  async function poster(map, opt) {
    opt = opt || {};
    const host = map.getContainer(), W = host.clientWidth, H = host.clientHeight;
    let pr = opt.scale || 2;
    try { const gl = map.painter.context.gl; const mx = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096; pr = Math.max(1, Math.min(pr, Math.floor(Math.min(mx, 8192) / Math.max(W, H)))); } catch (e) {}
    while (pr > 1 && W * H * pr * pr > 36e6) pr--;
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;left:-${W + 200}px;top:0;width:${W}px;height:${H}px;pointer-events:none;opacity:0`;
    document.body.appendChild(div);
    const status = opt.onStatus || (() => {});
    status('Drawing the map at ' + pr + ' times the pixels…');
    let pm = null;
    try {
      pm = await InkMap.create(div, Object.assign({}, map.__inkOpts || {}, { mapOptions: { center: map.getCenter(), zoom: map.getZoom(), bearing: 0, pitch: 0, pixelRatio: pr,
        preserveDrawingBuffer: true, interactive: false, attributionControl: false, fadeDuration: 0 } }));
      for (const l of map.getStyle().layers) { try { pm.setLayoutProperty(l.id, 'visibility', map.getLayoutProperty(l.id, 'visibility') || 'visible'); } catch (e) {} }
      await new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; const chk = () => { if (pm.loaded() && pm.areTilesLoaded()) setTimeout(fin, 600); else pm.once('idle', chk); }; pm.once('idle', chk); setTimeout(fin, 90000); });
      status('Framing the poster…');
      const src = pm.getCanvas(), Wp = src.width, Hp = src.height, s = pr;
      const m = Math.round(28 * s), foot = Math.round(34 * s);
      const C = document.createElement('canvas'); C.width = Wp + 2 * m; C.height = Hp + 2 * m + foot;
      const x = C.getContext('2d');
      x.fillStyle = PAPER; x.fillRect(0, 0, C.width, C.height);
      x.drawImage(src, m, m);
      // frame
      if (opt.border !== false) drawFrame(x, m - 12 * s, m - 12 * s, Wp + 24 * s, Hp + 24 * s, s);
      else { x.strokeStyle = INK; x.lineWidth = 1.6 * s; x.strokeRect(m, m, Wp, Hp); }
      try { await document.fonts.load(`${30 * s}px MedievalSharp`); await document.fonts.load(`italic ${12 * s}px "Source Serif 4"`); } catch (e) {}
      // cartouche with the title
      const title = (opt.title || 'My corner of the world').slice(0, 60);
      const c = map.getCenter(), sub = `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lng).toFixed(2)}° ${c.lng >= 0 ? 'E' : 'W'} · drawn by The Inked World`;
      x.font = `${30 * s}px ${HAND}`; const tw = x.measureText(title).width; x.font = `italic ${12 * s}px ${SERIF}`; const sw = x.measureText(sub).width;
      const bw = Math.max(tw, sw) + 44 * s, bh = 76 * s, bx = m + 22 * s, by = m + 22 * s;
      x.fillStyle = 'rgba(251,243,220,0.95)'; x.fillRect(bx, by, bw, bh);
      x.strokeStyle = INK; x.lineWidth = 2 * s; x.strokeRect(bx, by, bw, bh); x.lineWidth = 0.8 * s; x.strokeRect(bx + 5 * s, by + 5 * s, bw - 10 * s, bh - 10 * s);
      x.fillStyle = RED; for (const [cx, cy] of [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]) { x.beginPath(); x.arc(cx, cy, 4 * s, 0, 7); x.fill(); x.stroke(); }
      x.fillStyle = RED; x.font = `${30 * s}px ${HAND}`; x.textBaseline = 'alphabetic'; x.textAlign = 'center'; x.fillText(title, bx + bw / 2, by + 42 * s);
      x.fillStyle = INK; x.font = `italic ${12 * s}px ${SERIF}`; x.fillText(sub, bx + bw / 2, by + 62 * s);
      // compass rose and scale bar
      const rose = await svgImage(compassSVG(80));
      const rs = 74 * s; x.drawImage(rose, m + 22 * s, m + Hp - rs * 1.14 - 18 * s, rs, rs * 1.14);
      drawScale(x, m + 22 * s + rs + 20 * s, m + Hp - 30 * s, metresPerPx(map) / s, 150 * s, s);
      // the credits in small print
      x.textAlign = 'left'; x.textBaseline = 'top'; x.fillStyle = INK; x.font = `${8.6 * s}px ${SERIF}`;
      const lines = wrapText(x, CREDIT, Wp);
      const fs = lines.length > 2 ? 7.4 : 8.6; x.font = `${fs * s}px ${SERIF}`;
      wrapText(x, CREDIT, Wp).slice(0, 3).forEach((ln, i) => x.fillText(ln, m, m + Hp + 16 * s + i * (fs + 2.2) * s));
      status('Saving…');
      const blob = await new Promise(res => C.toBlob(res, 'image/png'));
      return { blob, width: C.width, height: C.height, pixelRatio: pr };
    } finally {
      try { pm && pm.remove(); } catch (e) {}
      div.remove();
    }
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  global.InkExtras = { scaleBar, compassSVG, frameOverlay, drawFrame, drawScale, poster, download, metresPerPx, niceScale, CREDIT };
})(window);
