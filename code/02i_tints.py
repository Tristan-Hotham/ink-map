"""Watercolour land tints and the deep-winter snow extent.

Inputs (read in place)
  TEOW                           RESOLVE Ecoregions 2017 polygons (BIOME_NUM of all 14 biomes, and Rock and Ice), CC BY 4.0
  RAW9/terrarium/4/{x}/{y}.png   AWS Terrain Tiles at zoom 4 (about 10 km a pixel at the equator)
  GEO/ne_50m_land.geojson        Natural Earth land (public domain)
Outputs
  data/biomes_tint.webp   2048 x 2048 web Mercator (the whole square, latitude +-85.05), RGBA: a soft, low-saturation wash
                          by biome and height, as on a hand-tinted antique map (alpha 0 at sea)
  data/biomes_snow.webp   the same grid: white snow with a cool blue shade on high ground, alpha = how snowy the place is
                          in deep winter
  data/biomes_snow.geojson  the snow extent as simplified polygons (snow at least half), used by the style's "within"
                          filters to pick snowy trees, peaks and roofs
  data/biomes_tint_stats.json  colours and thresholds

Snow in deep winter: a place is snowy where its latitude plus a height term passes a threshold latitude that depends on
how continental the region is (about 47 degrees in western Europe, so all of Britain is under snow; 43 in eastern Europe,
39 in North America and 38 in East Asia; 50 in the southern hemisphere), less 3 degrees for dry deserts. The height term is
a winter snow line falling from about 5,200 m at the equator to sea level at the threshold latitude. Tundra, taiga and
Rock and Ice are always snowy. The edges are feathered over about two degrees, and tropical and hot deserts stay clear.
"""
import glob, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from common import RAW9, GEO, DATA, merc, unmerc, dump

TEOW = os.environ.get('INK_TEOW', os.path.join(RAW9, 'teow_resolve2017', 'features'))
N = 2048

# ---- biomes (all 14 RESOLVE biomes; 99 = Rock and Ice), drawn at 2048
bimg = Image.new('L', (N, N), 0); bd = ImageDraw.Draw(bimg)
sandy_img = Image.new('L', (N, N), 0); sd = ImageDraw.Draw(sandy_img)
import re
SANDY = re.compile(r'desert|dune|erg\b|Sahara|Namib|Kalahari|Rub|sand|Taklimakan|Karakum|Kyzylkum|Thar|Gobi|Atacama|Sechura|Simpson|Gibson', re.I)
def ring_px(ring): return [(merc(lo, la)[0] * N, merc(lo, la)[1] * N) for lo, la, *_ in ring]
for fn in sorted(glob.glob(os.path.join(TEOW, '*.geojson'))):
    f = json.load(open(fn)); p = f['properties']
    b = 99 if p.get('ECO_NAME') == 'Rock and Ice' else int(p.get('BIOME_NUM') or 0)
    g = f['geometry']
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        r = ring_px(poly[0])
        if len(r) < 3: continue
        bd.polygon(r, fill=b)
        if b == 13 and SANDY.search(p.get('ECO_NAME') or ''): sd.polygon(r, fill=1)
B = np.asarray(bimg).astype(np.int32)
SANDYM = np.asarray(sandy_img) > 0

# ---- elevation (zoom 4 mosaic, 4096) brought to 2048 by max (so peaks are kept) and mean
Z = 4; M = 256 * 2 ** Z
E = np.zeros((M, M), np.float32)
for x in range(2 ** Z):
    for y in range(2 ** Z):
        a = np.asarray(Image.open(os.path.join(RAW9, 'terrarium', str(Z), str(x), f'{y}.png')).convert('RGB')).astype(np.float32)
        E[y * 256:(y + 1) * 256, x * 256:(x + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
E = np.maximum(E, 0)
Emean = E.reshape(N, 2, N, 2).mean(axis=(1, 3))
Emax = E.reshape(N, 2, N, 2).max(axis=(1, 3))

# ---- land mask from Natural Earth at 2048, with a 4x supersample for soft coasts
from shapely.geometry import shape
LS = 4
limg = Image.new('L', (N * LS, N * LS), 0); ld = ImageDraw.Draw(limg)
for f in json.load(open(os.path.join(GEO, 'ne_50m_land.geojson')))['features']:
    g = f['geometry']
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        r = [(merc(lo, la)[0] * N * LS, merc(lo, la)[1] * N * LS) for lo, la, *_ in poly[0]]
        if len(r) >= 3: ld.polygon(r, fill=255)
        for h in poly[1:]:
            if len(h) >= 3: ld.polygon([(merc(lo, la)[0] * N * LS, merc(lo, la)[1] * N * LS) for lo, la, *_ in h], fill=0)
LAND = np.asarray(limg.resize((N, N), Image.BOX)).astype(np.float32) / 255
# Antarctica below the Natural Earth cut and anything biome-coded counts as land too
LAND = np.maximum(LAND, (B > 0).astype(np.float32) * 0.0)

rows = np.arange(N) + 0.5
LAT = np.array([unmerc(0.5, r / N)[1] for r in rows])[:, None] * np.ones((1, N))
LON = (np.arange(N)[None, :] + 0.5) / N * 360 - 180 + np.zeros((N, 1))

# fill biome gaps (lakes in the ecoregions, coast slivers) from the nearest coded pixel
idx = ndimage.distance_transform_edt(B == 0, return_distances=False, return_indices=True)
Bf = B[idx[0], idx[1]]
SANDYf = SANDYM[idx[0], idx[1]]

# ---- tint colours: soft greens for forest and temperate lowland, sage for grassland and steppe, warm yellows and ochres for
# deserts and dry savanna, olive for Mediterranean scrub, deep green for rainforest, cool blue-grey for tundra, white for ice
COL = {
    1: (104, 146, 92), 2: (150, 160, 98), 3: (120, 150, 100), 4: (152, 178, 118), 5: (128, 158, 116), 6: (126, 150, 128),
    7: (214, 190, 112), 8: (180, 184, 128), 9: (150, 182, 160), 10: (172, 172, 132), 11: (170, 184, 192), 12: (176, 170, 104),
    13: (220, 186, 120), 14: (112, 156, 128), 99: (246, 246, 240), 0: (190, 180, 140),
}
STRENGTH = {1: 0.42, 2: 0.36, 3: 0.36, 4: 0.34, 5: 0.36, 6: 0.36, 7: 0.40, 8: 0.36, 9: 0.36, 10: 0.32, 11: 0.38, 12: 0.38, 13: 0.40, 14: 0.4, 99: 0.75, 0: 0.2}
rgb = np.zeros((N, N, 3), np.float32); st = np.zeros((N, N), np.float32)
for b, c in COL.items():
    m = Bf == b
    rgb[m] = c; st[m] = STRENGTH[b]
# sandy deserts warmer and stronger; high ground drifts to a warm grey-brown, the very high to a cool grey
sm = (Bf == 13) & SANDYf
rgb[sm] = (226, 180, 104); st[sm] = 0.46
hi = np.clip((Emean - 1500) / 2500, 0, 1)[..., None]
rgb = rgb * (1 - hi * 0.55) + np.array([176, 160, 132], np.float32) * hi * 0.55
# watercolour: blur the colour fields, then a slow blotchy noise in the strength, and pigment pooling along the edges
for k in range(3): rgb[..., k] = ndimage.gaussian_filter(rgb[..., k], 3.0)
stb = ndimage.gaussian_filter(st, 2.5)
rs = np.random.default_rng(11)
noise = sum(ndimage.gaussian_filter(rs.standard_normal((N, N)), s, mode='wrap') * w for s, w in [(24, 7), (8, 3), (3, 1.2)])
noise = (noise - noise.mean()) / noise.std()
edge = np.abs(st - ndimage.gaussian_filter(st, 6)) * 2.2      # where two washes meet, a little more pigment
landb = ndimage.gaussian_filter(LAND, 0.8)
coast = np.clip(landb - ndimage.gaussian_filter(LAND, 5), 0, 1)   # a deeper band just inside every coast, as a colourist laid it
alpha = np.clip(stb * (1 + 0.16 * noise) + edge * 0.25 + coast * 0.35, 0, 0.85) * landb
tint = np.dstack([np.clip(rgb, 0, 255), alpha[..., None] * 255]).astype(np.uint8)
Image.fromarray(tint, 'RGBA').save(os.path.join(DATA, 'biomes_tint.webp'), quality=72, method=6)

# ---- deep winter snow
alat = np.abs(LAT)
def thr_nh(lon):
    # threshold latitude by longitude (northern hemisphere): western Europe 47, eastern Europe 43, central Asia 42,
    # East Asia 38, North America 39 (smoothly blended)
    pts = [(-180, 41), (-140, 44), (-120, 41), (-100, 41), (-75, 40.5), (-60, 43), (-30, 48), (-12, 47), (10, 46), (22, 43), (60, 42), (100, 40),
           (120, 38), (145, 38), (180, 41)]
    xs, ys = zip(*pts)
    return np.interp(lon, xs, ys)
T = np.where(LAT >= 0, thr_nh(LON), 50.0)
T = T + np.where(Bf == 13, 3.0, 0.0) + np.where(Bf == 12, 2.0, 0.0)
T = ndimage.gaussian_filter(T, 6)
# winter snow line (m): 5200 at the equator, falling to sea level at the threshold latitude
sline = 5200 * np.clip((T - alat) / np.maximum(T, 1), 0, 1) ** 0.6
height = 0.6 * Emean + 0.4 * Emax
over = (height - sline) / 500 + np.clip((alat - T) / 2.0, -2, 2)
snow = np.clip(0.5 + over * 0.5, 0, 1)
snow = np.maximum(snow, np.isin(Bf, [6, 11, 99]).astype(np.float32))
snow[(Bf == 1) | (Bf == 14)] = np.minimum(snow[(Bf == 1) | (Bf == 14)], 0)   # rainforest and mangroves never
snow = ndimage.gaussian_filter(snow, 1.6)
snow = np.where(alat < 20, np.minimum(snow, np.clip((Emax - 4300) / 800, 0, 1)), snow)   # the tropics: only the highest summits
snow *= landb
# snow colour: white, a cool blue-grey shade on the high, rugged ground and a little blotchiness
shade = np.clip((Emax - Emean) / 1200, 0, 1) * 0.6 + np.clip((Emean - 2000) / 3000, 0, 1) * 0.3
scol = np.dstack([253 - 26 * shade, 253 - 18 * shade, 250 - 4 * shade])
salpha = np.clip(snow * (0.80 + 0.06 * noise), 0, 0.9)
snowimg = np.dstack([np.clip(scol, 0, 255), salpha[..., None] * 255]).astype(np.uint8)
Image.fromarray(snowimg, 'RGBA').save(os.path.join(DATA, 'biomes_snow.webp'), quality=72, method=6)

# ---- snow polygons for the style's within filters
import rasterio.features, rasterio.transform
from shapely.geometry import mapping, Polygon, MultiPolygon
from shapely.ops import unary_union
mask = (snow >= 0.5).astype(np.uint8)
mask = ndimage.binary_opening(mask, iterations=1).astype(np.uint8)
polys = []
for geom, val in rasterio.features.shapes(mask, mask=mask > 0, transform=rasterio.transform.Affine(1, 0, 0, 0, 1, 0)):
    if val != 1: continue
    def conv(ring): return [unmerc(min(max(x / N, 0), 1), min(max(y / N, 0), 1)) for x, y in ring]
    p = Polygon(conv(geom['coordinates'][0]), [conv(h) for h in geom['coordinates'][1:] if len(h) > 30])
    if p.area < 1.0: continue   # drop specks under about a square degree
    polys.append(p.buffer(0))
U = unary_union(polys).simplify(0.5, preserve_topology=True)
U = U if isinstance(U, MultiPolygon) else MultiPolygon([U])
U = MultiPolygon([p for p in U.geoms if p.area >= 1.0])
gj = mapping(U)
def rnd(o): return [rnd(v) for v in o] if isinstance(o, (list, tuple)) and o and isinstance(o[0], (list, tuple)) else [round(o[0], 2), round(o[1], 2)]
gj = {'type': 'MultiPolygon', 'coordinates': [[rnd(r) for r in poly] for poly in gj['coordinates']]}
nv = sum(len(r) for poly in gj['coordinates'] for r in poly)
dump({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {}, 'geometry': gj}]}, os.path.join(DATA, 'biomes_snow.geojson'))
json.dump({'size': N, 'tint_colours': {str(k): v for k, v in COL.items()}, 'snow_vertices': nv, 'snow_polygons': len(gj['coordinates']),
           'snow_share_of_land': round(float((snow * LAND).sum() / LAND.sum()), 3)}, open(os.path.join(DATA, 'biomes_tint_stats.json'), 'w'), indent=1)
print('tint, snow written; snow polygons', len(gj['coordinates']), 'vertices', nv)
