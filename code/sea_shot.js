// Sprite sheet of the sea drawings: node code/sea_shot.js <out.png> [scale]
const path = require('path'); const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, 'sea_sheet.html') + '?k=' + (process.argv[3] || 2.5)); await p.waitForFunction(() => window.__done);
  await p.screenshot({ path: process.argv[2], fullPage: true }); console.log(errs.join('\n') || 'no errors'); await b.close(); })();
