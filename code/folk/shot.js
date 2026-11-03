// node shot.js <url> <out.png> [width]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +(process.argv[4] || 1280), height: 800 }, deviceScaleFactor: +(process.argv[5] || 1) });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(process.argv[2]); await p.waitForFunction(() => window.__done, null, { timeout: 30000 }).catch(() => {});
  await p.screenshot({ path: process.argv[3], fullPage: true }); if (errs.length) console.log(errs.join('\n')); await b.close();
})();
