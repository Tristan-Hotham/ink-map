// Build MapLibre SDF glyph ranges (fonts/<stack>/<start>-<end>.pbf) from open-licence TTFs.
// Usage: node code/01_glyphs.js <ttf_dir>   (needs `npm install fontnik`)
const fs = require('fs'), path = require('path');
const fontnik = require(process.env.FONTNIK || 'fontnik');
const ttfDir = process.argv[2];
const out = path.join(__dirname, '..', 'fonts');
const stacks = {
  'Ink Caps': 'MedievalSharp.ttf',          // countries, regions (MedievalSharp, OFL)
  'Ink Italic': 'IMFeGPit28P.ttf',          // seas, rivers, lakes (IM Fell Great Primer Italic, OFL)
  'Ink Roman': 'IMFeENrm28P.ttf',           // towns, villages, peaks (IM Fell English, OFL)
  'Ink SC': 'IMFeENsc28P.ttf',              // cities, national parks (IM Fell English SC, OFL)
};
(async () => {
  for (const [stack, file] of Object.entries(stacks)) {
    const font = fs.readFileSync(path.join(ttfDir, file));
    const dir = path.join(out, stack); fs.mkdirSync(dir, { recursive: true });
    let n = 0, bytes = 0;
    for (let s = 0; s < 65536; s += 256) {
      const pbf = await new Promise((res, rej) => fontnik.range({ font, start: s, end: s + 255 }, (e, d) => e ? rej(e) : res(d)));
      fs.writeFileSync(path.join(dir, `${s}-${s + 255}.pbf`), pbf); n++; bytes += pbf.length;
    }
    console.log(stack, n, 'ranges', (bytes / 1024).toFixed(0), 'KB');
  }
})();
