"""Paper and blog figures from the renders in release/figs (made by code/03_renders.py figs and
code/07_method_figure.py) and the zoom sequence in qa/ (code/03_renders.py zoom).

Output: release/paper/f_*.png, release/blog/b_*.png, img/world.jpg (page figure)
"""
import os, sys, shutil
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, QA

F = os.path.join(ROOT, 'release', 'figs')
P = os.path.join(ROOT, 'release', 'paper'); B = os.path.join(ROOT, 'release', 'blog')
os.makedirs(P, exist_ok=True); os.makedirs(B, exist_ok=True)


def crop_content(im, bg=(243, 229, 191), pad=24):
    """Trim the empty parchment below and right of the glyph sheet."""
    px = im.convert('RGB').load(); w, h = im.size
    xs = [x for x in range(w) for y in range(0, h, 4) if sum(abs(a - b) for a, b in zip(px[x, y], bg)) > 40]
    ys = [y for y in range(h) for x in range(0, w, 4) if sum(abs(a - b) for a, b in zip(px[x, y], bg)) > 40]
    return im.crop((0, 0, min(w, max(xs) + pad), min(h, max(ys) + pad)))


def save(im, path, width):
    im = im.convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if path.endswith('.jpg'):
        im.save(path, quality=86, optimize=True)
    else:   # blog figures: a 160 colour palette keeps parchment and ink and cuts the size by about two thirds
        im.quantize(colors=160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)


src = {n: Image.open(os.path.join(F, n + '.png')) for n in ('world', 'asia', 'europe', 'gb', 'yorkshire', 'lakes', 'stress', 'method', 'sahara', 'amazon', 'greenland')}
src['glyphs'] = crop_content(Image.open(os.path.join(F, 'glyphs.png')))
src['zoom'] = Image.open(os.path.join(QA, 'zoom_sequence.png'))
paper = {'world': 'f_world', 'asia': 'f_asia', 'europe': 'f_europe', 'gb': 'f_gb', 'lakes': 'f_lakes', 'stress': 'f_stress',
         'method': 'f_method', 'glyphs': 'f_glyphs', 'zoom': 'f_zoom', 'sahara': 'f_sahara', 'amazon': 'f_amazon', 'greenland': 'f_greenland'}
for fn in os.listdir(P):
    if fn.startswith('f_'): os.remove(os.path.join(P, fn))
for k, n in paper.items():
    save(src[k], os.path.join(P, n + ('.png' if k in ('method', 'glyphs') else '.jpg')), 1800)
blog = {'world': 'b_world', 'zoom': 'b_zoom', 'glyphs': 'b_glyphs', 'method': 'b_method', 'asia': 'b_asia', 'lakes': 'b_lakes', 'sahara': 'b_sahara', 'amazon': 'b_amazon'}
for k, n in blog.items():
    save(src[k], os.path.join(B, n + '.png'), 1400)
w = src['world'].convert('RGB'); w = w.resize((1400, round(w.height * 1400 / w.width)), Image.LANCZOS)
w.save(os.path.join(ROOT, 'img', 'world.jpg'), quality=84)
print('figures written')
