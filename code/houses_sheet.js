// Screenshot the regional sprite sheet: node code/houses_sheet.js <out.png> [part=houses|towers|folk] [snow]
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2], part = process.argv[3] || 'houses', snow = process.argv[4] ? '&snow=1' : '';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2250, height: 1200 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, 'houses_sheet.html') + '?part=' + part + snow + (process.env.SC ? '&sc=' + process.env.SC : '') + (process.env.FSC ? '&fsc=' + process.env.FSC : ''));
  try { await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); } catch (e) { console.log('errors:', errs.join('\n')); throw e; }
  await p.waitForTimeout(200);
  await (await p.$('#s')).screenshot({ path: out });
  if (errs.length) console.log('errors:', errs.slice(0, 10).join('\n'));
  await b.close();
})();
