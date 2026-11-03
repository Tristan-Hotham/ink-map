// Draw a list of icons (InkIcons ids) on one sheet and screenshot it: node code/sheet_shot.js <out.png> <scale> id,id,...
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const [out, sc, list] = [process.argv[2], +process.argv[3], process.argv[4].split(',')];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const root = path.resolve(__dirname, '..');
  await p.goto('file://' + root + '/code/sprites.html');
  await p.evaluate(([ids, sc]) => {
    document.getElementById('s').innerHTML = '';
    const r = document.createElement('div'); r.className = 'row'; r.style.background = '#EDEAE2'; r.style.padding = '10px'; document.getElementById('s').appendChild(r);
    for (const id of ids) { const c = InkIcons.draw(id, InkMap.sprites.mountainSprite); if (!c) continue; const d = document.createElement('canvas'); const k = 1.5; d.width = c.width / k * sc; d.height = c.height / k * sc; const g = d.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, d.width, d.height); d.title = id; r.appendChild(d); }
  }, [list, sc]);
  await p.waitForTimeout(300);
  const el = await p.$('.row'); await el.screenshot({ path: out }); await b.close();
})();
