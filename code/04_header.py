"""Social card header.png (1200 x 630): an ink render of northern England with the title on parchment."""
import os, sys, importlib.util
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, QA
spec = importlib.util.spec_from_file_location('renders', os.path.join(ROOT, 'code', '03_renders.py'))
R = importlib.util.module_from_spec(spec); spec.loader.exec_module(R)

REF = os.environ.get('INK_REF_FONTS', '/home/claude/ref/fonts')
shot = os.path.join(QA, 'header_map.png')
if not os.environ.get('INK_SKIP_RENDER'):
    R.render([dict(out=shot, w=1500, h=630, dpr=2, lat=54.38, lon=-4.05, z=7.6, maponly=1, clean=1)], os.path.join(QA, 'console_header.txt'))
m = Image.open(shot).convert('RGB').resize((1500, 630), Image.LANCZOS)
card = Image.new('RGB', (1200, 630), '#F6EED8')
card.paste(m.crop((300, 0, 1500, 630)), (0, 0))
# a parchment panel fading in from the left, so the map shows on the right
fade = Image.new('L', (1200, 630), 0)
fd = ImageDraw.Draw(fade)
for x in range(1200):
    a = 255 if x < 470 else max(0, int(255 * (1 - (x - 470) / 190)))
    fd.line([(x, 0), (x, 630)], fill=a)
card.paste(Image.new('RGB', (1200, 630), '#F6EED8'), (0, 0), fade)
d = ImageDraw.Draw(card)
fr = ImageFont.truetype(os.path.join(REF, 'FrauncesVar.ttf'), 92)
try:
    fr.set_variation_by_axes([144, 900])
except Exception:
    pass
hand = ImageFont.truetype(os.path.join(ROOT, 'fonts', 'ttf', 'MedievalSharp.ttf'), 104)
body = ImageFont.truetype(os.path.join(REF, 'SourceSerif4-Regular.ttf'), 29)
mono = ImageFont.truetype(os.path.join(REF, 'IBMPlexMono-Regular.ttf'), 21)
d.text((48, 70), 'The', font=fr, fill='#2B2119')
d.text((44, 162), 'Inked', font=hand, fill='#A3261B')
d.text((48, 272), 'World', font=fr, fill='#2B2119')
y = 400
for line in ['A hand-inked style map of', 'everywhere, from open data.', 'Peaks placed from elevation.']:
    d.text((50, y), line, font=body, fill='#2B2119'); y += 40
d.text((50, 560), 'maps.tristanhotham.com/ink-map', font=mono, fill='#6E604E')
sm = ImageFont.truetype(os.path.join(REF, 'IBMPlexMono-Regular.ttf'), 13)
cr = '© OpenStreetMap contributors · OpenFreeMap · Terrain Tiles'
bb = d.textbbox((1188, 618), cr, font=sm, anchor='rd')
d.rectangle([bb[0] - 6, bb[1] - 4, bb[2] + 6, bb[3] + 4], fill='#F6EED8')
d.text((1188, 618), cr, font=sm, fill='#6E604E', anchor='rd')
card.save(os.path.join(ROOT, 'header.png'), optimize=True)
print('header.png', card.size)
