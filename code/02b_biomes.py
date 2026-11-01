"""Biome mask for the map's biome glyphs, from RESOLVE Ecoregions 2017 (CC BY 4.0).

Input  TEOW: the 847 ecoregion polygons of RESOLVE Ecoregions 2017, simplified at 0.005 degrees, as one GeoJSON file per
       ecoregion (CatalogueOfLife/col-gazetteers, folder teow/, a conversion of
       https://storage.googleapis.com/teow2016/Ecoregions2017.zip; Dinerstein et al. 2017).
Output data/biomes.png: a 2048 x 2048 web Mercator raster (the whole square, latitude +-85.05) whose pixel values are 32 x class + 16 if the ecoregion is montane + 8 if it is a high plateau:
         0 none (temperate forests, Mediterranean, dry tropical forests: no biome glyphs), 1 desert, 2 grassland and steppe,
         3 tropical rainforest, 4 boreal forest (taiga), 5 ice (Rock and Ice), 6 flooded grassland (marsh), 7 tundra
       data/biomes_legend.json: classes, source biomes and pixel counts
"""
import glob, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, DATA, merc

TEOW = os.environ.get('INK_TEOW', '/home/claude/newdata/raw9/teow_resolve2017/features')
N = 2048
CLASSES = {1: ('desert', [13]), 2: ('grassland', [7, 8, 10]), 3: ('rainforest', [1]), 4: ('taiga', [6]),
           5: ('ice', []), 6: ('marsh', [9]), 7: ('tundra', [11])}
by_biome = {b: c for c, (_, bs) in CLASSES.items() for b in bs}

img = Image.new('L', (N, N), 0)
d = ImageDraw.Draw(img)


def ring_px(ring):
    out = []
    for lon, lat, *_ in ring:
        x, y = merc(lon, lat)
        out.append((x * N, y * N))
    return out


import re
# ecoregions named for mountains: a hint that relief there is a real range, used to relax the ruggedness bar (x0.3)
MONTANE = re.compile(r'montane|mountain|highland|alpine|\bAtlas\b|Hindu Kush|Himalaya|\bAlps\b|Andes|Andean|Puna|Rock(y|ies)|\bRange\b|Sierra|ramo|'
                     r'Drakensberg|Ethiopian|Tibesti|Pyrenees|Caucasus|Carpathian|Karakoram|Pamir|Tian Shan|Altai|Zagros|Hajar|Yungas|Cordillera|'
                     r'Rwenzori|Albertine|Eastern Arc', re.I)
NOT_MONTANE = re.compile(r'Plateau|North Arabian highland', re.I)
# the high plateaus, whose floor is rough on coarse tiles but is not a range: the ruggedness bar is doubled there
PLATEAU = re.compile(r'Tibet|Yarlung|Changtang|Qaidam', re.I)
# deserts & xeric shrublands: only the sandy and true deserts get dunes; shrub steppes and xeric scrub get sparse tufts
SANDY = re.compile(r'desert|dune|erg\b|Sahara|Namib|Kalahari|Rub|sand|Taklimakan|Karakum|Kyzylkum|Thar|Gobi|Atacama|Sechura|Simpson|Gibson', re.I)
feats = []
n_montane = 0
for fn in sorted(glob.glob(os.path.join(TEOW, '*.geojson'))):
    f = json.load(open(fn))
    p = f['properties']
    if p.get('ECO_NAME') == 'Rock and Ice':
        cls = 5
    else:
        cls = by_biome.get(int(p.get('BIOME_NUM') or 0), 0)
        if cls == 1 and not SANDY.search(p.get('ECO_NAME') or ''):
            cls = 2
    plat = 1 if PLATEAU.search(p.get('ECO_NAME') or '') else 0
    mont = 1 if MONTANE.search(p.get('ECO_NAME') or '') and not NOT_MONTANE.search(p.get('ECO_NAME') or '') else 0
    n_montane += mont
    feats.append((cls * 32 + mont * 16 + plat * 8, f['geometry']))
# draw "none" first so that every class wins over it where simplified edges overlap
for cls, g in sorted(feats, key=lambda t: t[0] != 0):  # cls here is the pixel value
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        outer = ring_px(poly[0])
        if len(outer) < 3:
            continue
        # split rings that cross the antimeridian are already split in the source
        d.polygon(outer, fill=cls)
        for hole in poly[1:]:
            if len(hole) >= 3:
                d.polygon(ring_px(hole), fill=0)
img.save(os.path.join(DATA, 'biomes.png'), optimize=True)
a = np.asarray(img) // 32
mont_px = int(((np.asarray(img) % 32) // 16 == 1).sum())
plat_px = int(((np.asarray(img) % 16) // 8 == 1).sum())
legend = {'source': 'RESOLVE Ecoregions 2017 (Dinerstein et al. 2017), CC BY 4.0', 'size': N, 'projection': 'web Mercator, whole square',
          'classes': {str(c): {'name': n, 'resolve_biomes': bs, 'pixels': int((a == c).sum())} for c, (n, bs) in CLASSES.items()}}
legend['classes']['5']['resolve_biomes'] = ['Rock and Ice']
legend['plateau'] = {'pixels': plat_px, 'pattern': PLATEAU.pattern}
legend['sandy_desert_pattern'] = SANDY.pattern
legend['montane'] = {'ecoregions': n_montane, 'pixels': mont_px, 'pattern': MONTANE.pattern, 'excluded': NOT_MONTANE.pattern}
json.dump(legend, open(os.path.join(DATA, 'biomes_legend.json'), 'w'), indent=1)
print('biomes.png', os.path.getsize(os.path.join(DATA, 'biomes.png')) // 1024, 'KB', {v['name']: v['pixels'] for v in legend['classes'].values()})
