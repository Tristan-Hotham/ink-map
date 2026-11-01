// Live QA in headless Chromium (needs internet): node qa_live/run_live.js [page url] [out dir]
// Default page: https://maps.tristanhotham.com/ink-map/qa_live/?auto
// Writes one PNG per view and counts.json. Requires: npm install playwright && npx playwright install chromium
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'https://maps.tristanhotham.com/ink-map/qa_live/?auto';
  const out = process.argv[3] || 'inkqa_out'; fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 200)); });
  await page.goto(url.includes('auto') ? url : url + (url.includes('?') ? '&' : '?') + 'auto');
  await page.waitForFunction(() => /Done:/.test(document.getElementById('status').textContent), null, { timeout: 30 * 60 * 1000 });
  const figs = await page.$$eval('figure', fs2 => fs2.map(f => ({ id: f.querySelector('b').textContent, img: f.querySelector('img').src, text: f.querySelector('figcaption').innerText })));
  for (const f of figs) fs.writeFileSync(path.join(out, f.id + '.png'), Buffer.from(f.img.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(out, 'counts.json'), JSON.stringify(figs.map(f => ({ id: f.id, text: f.text })), null, 1));
  console.log('wrote', figs.length, 'views to', out);
  await browser.close();
})();
