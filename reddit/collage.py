"""Reddit poster: Britain and Ireland in the ink style, rendered with Playwright from reddit/poster.html
against the offline test tiles, at 3600 x 4500 px.

Usage: python3 reddit/collage.py
"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'code'))
from common import ROOT
import importlib.util
spec = importlib.util.spec_from_file_location('renders', os.path.join(ROOT, 'code', '03_renders.py'))
R = importlib.util.module_from_spec(spec); spec.loader.exec_module(R)
from PIL import Image

OUT = os.path.join(ROOT, 'reddit', 'britain_and_ireland_in_ink.png')
W, H, DPR = 3000, 3750, 1.2   # css px; 3600 x 4500 device px

OUT_W = os.path.join(ROOT, 'reddit', 'the_inked_world.png')

if __name__ == '__main__':
    import sys as _s
    if 'uk' not in _s.argv[1:]:
        # main collage: the world, with Britain and Ireland as an inset (3840 x 2400 px)
        R.render([dict(out=OUT_W, w=3200, h=2000, dpr=1.2, page='reddit/poster_world.html', stats=1)], os.path.join(ROOT, 'qa', 'console_poster_world.txt'))
        im = Image.open(OUT_W).convert('RGB'); im.save(OUT_W, optimize=True)
        im.resize((im.width // 3, im.height // 3), Image.LANCZOS).save(os.path.join(ROOT, 'qa', 'poster_world_preview.png'))
        os.replace(OUT_W.replace('.png', '') + '.stats.json', os.path.join(ROOT, 'data', 'poster_world_stats.json'))
        print(OUT_W, im.size, os.path.getsize(OUT_W) // 1024, 'KB')
    if 'world' in _s.argv[1:]:
        raise SystemExit
    shot = dict(out=OUT, w=W, h=H, dpr=DPR, page='reddit/poster.html', stats=1)
    R.render([shot], os.path.join(ROOT, 'qa', 'console_poster.txt'))
    im = Image.open(OUT).convert('RGB')
    im.save(OUT, optimize=True)
    small = im.resize((im.width // 3, im.height // 3), Image.LANCZOS)
    small.save(os.path.join(ROOT, 'qa', 'poster_preview.png'))
    os.replace(OUT.replace('.png', '') + '.stats.json', os.path.join(ROOT, 'data', 'poster_stats.json'))
    print(OUT, im.size, os.path.getsize(OUT) // 1024, 'KB')
