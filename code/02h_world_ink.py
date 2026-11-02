"""World-scale ink for the far-out view (zoom 0.5 to 4): range "caterpillars", dune fields and tree bands.

Inputs (read in place)
  RAW9/terrarium/4/{x}/{y}.png   AWS Terrain Tiles (Terrarium encoding) for the whole world at zoom 4 (about 10 km a pixel)
  data/biomes.png                the biome mask from RESOLVE Ecoregions 2017 (code/02b_biomes.py)
  TEOW                           RESOLVE ecoregion polygons, to pick the great sand deserts by name
  GEO/ne_50m_land.geojson        Natural Earth land, so no glyph is placed at sea
Output
  data/world_ink.geojson   Point features: kind=range (little peaks every 9 screen pixels along the axis of each high, rugged
                           range; z = first zoom, s = size from its relief, v = variant) and kind=dune / rain / taiga
                           (z = first zoom, v = variant)
  data/world_ink_stats.json counts and thresholds

Ranges: relief is the highest minus the lowest ground within about 40 km on the ground (the window is widened towards the
poles to keep it 40 km). Ground that rises at least 1,000 m within that window and stands above 600 m is range country;
small patches are dropped, the rest is thinned to its centre line (skeleton), traced into lines, smoothed and simplified.
"""
import glob, json, math, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.morphology import skeletonize, remove_small_objects, disk
from shapely.geometry import shape, LineString, Point
from shapely.prepared import prep
from shapely.ops import unary_union
sys.path.insert(0, os.path.dirname(__file__))
from common import RAW9, GEO, DATA, merc, unmerc, dump

Z = 4
N = 256 * 2 ** Z
TEOW = os.environ.get('INK_TEOW', os.path.join(RAW9, 'teow_resolve2017', 'features'))

# ---- elevation mosaic
E = np.zeros((N, N), np.float32)
for x in range(2 ** Z):
    for y in range(2 ** Z):
        a = np.asarray(Image.open(os.path.join(RAW9, 'terrarium', str(Z), str(x), f'{y}.png')).convert('RGB')).astype(np.float32)
        E[y * 256:(y + 1) * 256, x * 256:(x + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
E = np.maximum(E, 0)
lat_row = np.array([unmerc(0.5, (j + 0.5) / N)[1] for j in range(N)])
km_px = 40075.0 / N * np.cos(np.radians(lat_row))

# ---- relief within about 40 km, band by band of latitude
REL = np.zeros_like(E)
B = 64
for j0 in range(0, N, B):
    w = int(np.clip(round(2 * 40 / max(km_px[j0:j0 + B].mean(), 0.5)) + 1, 3, 41))
    pad = w
    a0, a1 = max(0, j0 - pad), min(N, j0 + B + pad)
    blk = E[a0:a1]
    mx = ndimage.maximum_filter(blk, size=w, mode='wrap')
    mn = ndimage.minimum_filter(blk, size=w, mode='wrap')
    REL[j0:j0 + B] = (mx - mn)[j0 - a0:j0 - a0 + min(B, N - j0)]
high = ndimage.maximum_filter(E, size=5)


def range_mask(rel_min, elev_min, min_px):
    m = (REL >= rel_min) & (high >= elev_min)
    m[:int(N * 0.03)] = False; m[int(N * 0.965):] = False      # nothing in the far polar rows
    m = ndimage.binary_closing(m, structure=disk(3))
    m = ndimage.binary_opening(m, structure=disk(1))
    return remove_small_objects(m, max_size=min_px)


def prune(sk, n):
    """Remove short spurs: peel end pixels n times (main lines lose n pixels at each end)."""
    sk = sk.copy()
    k = np.ones((3, 3), int); k[1, 1] = 0
    for _ in range(n):
        nb = ndimage.convolve(sk.astype(int), k, mode='constant')
        sk &= ~((nb <= 1) & sk)
    return sk


# tier 1: the great ranges; tier 2: lower ranges (Appalachians, Urals, Great Dividing Range), kept only where long
mask1 = range_mask(1000, 600, 60)
mask2 = range_mask(650, 400, 120) & ~ndimage.binary_dilation(mask1, iterations=3)
mask = mask1 | mask2
sk = prune(skeletonize(mask1), 5) | prune(skeletonize(mask2), 5)

# ---- trace the skeleton into lines (break at junctions)
ys, xs = np.nonzero(sk)
S = set(zip(ys.tolist(), xs.tolist()))
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
deg = {p: sum(((p[0] + a, p[1] + b) in S) for a, b in NB) for p in S}
seen = set()
lines = []
def walk(p, q):
    path = [p, q]; seen.add((p, q)); seen.add((q, p))
    while deg.get(q, 0) == 2:
        nxt = [(q[0] + a, q[1] + b) for a, b in NB if (q[0] + a, q[1] + b) in S and (q[0] + a, q[1] + b) != path[-2]]
        if not nxt or (q, nxt[0]) in seen: break
        seen.add((q, nxt[0])); seen.add((nxt[0], q)); path.append(nxt[0]); q = nxt[0]
    return path
for p in S:
    if deg[p] != 2:
        for a, b in NB:
            q = (p[0] + a, p[1] + b)
            if q in S and (p, q) not in seen:
                lines.append(walk(p, q))
for p in S:   # closed loops
    if deg[p] == 2 and not any(((p, (p[0] + a, p[1] + b)) in seen) for a, b in NB):
        for a, b in NB:
            q = (p[0] + a, p[1] + b)
            if q in S:
                lines.append(walk(p, q)); break


def chaikin(P, k=2):
    for _ in range(k):
        Q = [P[0]]
        for a, b in zip(P, P[1:]):
            Q += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        Q.append(P[-1]); P = Q
    return P


land = prep(unary_union([shape(f['geometry']).buffer(0) for f in json.load(open(os.path.join(GEO, 'ne_50m_land.geojson')))['features']]))
feats = []
n_range = 0
for L in lines:
    if len(L) < 6:
        continue
    ls = LineString([(x + 0.5, y + 0.5) for y, x in L]).simplify(1.2)
    tier2 = mask2[min(N - 1, int(ls.interpolate(0.5, normalized=True).y)), min(N - 1, int(ls.interpolate(0.5, normalized=True).x))]
    if ls.length < (14 if tier2 else 9):   # shorter than about 90 km (140 km for the lower ranges): a spur, not a range
        continue
    pts = chaikin(list(ls.coords))
    rel = float(np.mean([REL[min(N - 1, int(y)), min(N - 1, int(x))] for x, y in pts]))
    km = ls.length * float(np.mean([km_px[min(N - 1, int(y))] for x, y in pts]))
    # the longest and highest ranges first: from zoom 0.5 for the great ranges to 2.6 for short ones
    zf = round(float(np.clip(3.0 - 1.1 * math.log10(max(km, 50) / 50) - (rel - 1000) / 2500 + (0.5 if tier2 else 0), 0.5, 2.8)), 1)
    coords = [[round(c, 3) for c in unmerc(x / N, y / N)] for x, y in pts]
    if abs(coords[0][0] - coords[-1][0]) > 180:
        continue
    feats.append({'type': 'Feature', 'properties': {'kind': 'range', 'z': zf, 's': round(float(np.clip(0.75 + (rel - 1000) / 3000, 0.65, 1.25)), 2), 'rl': int(rel)},
                  'geometry': {'type': 'LineString', 'coordinates': coords}})
    n_range += 1

# ---- dunes and tree bands from the biome mask (RESOLVE Ecoregions 2017)
bio = np.asarray(Image.open(os.path.join(DATA, 'biomes.png')))
BN = bio.shape[0]
cls = bio // 32
# the great sand deserts, by ecoregion name, drawn into their own mask
from PIL import ImageDraw
SAND = re.compile(r"Arabian sand desert|Arabian desert$|Sahara desert|Saharan Atlantic|Taklimakan|Kalahari xeric|Namib Desert|Great Victoria|Simpson desert|"
                  r"Great Sandy|Gibson desert|Thar desert|Eastern Gobi|Alashan|Central Asian southern desert|Registan|East Sahara|West Sahara|South Sahara", re.I)
sand_img = Image.new('L', (BN, BN), 0); dd = ImageDraw.Draw(sand_img)
sand_names = set()
for fn in sorted(glob.glob(os.path.join(TEOW, '*.geojson'))):
    f = json.load(open(fn)); nm = f['properties'].get('ECO_NAME') or ''
    if not SAND.search(nm):
        continue
    sand_names.add(nm)
    g = f['geometry']
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        ring = [(merc(lo, la)[0] * BN, merc(lo, la)[1] * BN) for lo, la, *_ in poly[0]]
        if len(ring) >= 3: dd.polygon(ring, fill=1)
sand = np.asarray(sand_img) > 0
# dunes lie in the flat parts of the sand seas: low relief on the zoom 4 mosaic, in patches (a smooth noise field)
rel_b = np.asarray(Image.fromarray(REL).resize((BN, BN), Image.BILINEAR))
rng = np.random.default_rng(7)
noise = ndimage.gaussian_filter(rng.standard_normal((BN, BN)), 10)
noise = (noise - noise.mean()) / noise.std()
dune_ok = sand & (rel_b < 450) & (noise > -0.2)
rain_ok = (cls == 3) & (rel_b < 1000)
taiga_ok = (cls == 4) & (rel_b < 1000)
mtn_b = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((BN, BN), Image.NEAREST)) > 0
mtn_b = ndimage.binary_dilation(mtn_b, iterations=2)


pts_feats = []
counts = {}
for kind, ok, cell, ranks, salt, keep in [('dune', dune_ok, 24, [0.5, 1.5, 2.5, 3.2], 1, 1.0), ('rain', rain_ok, 18, [0.5, 1.5, 2.5, 3.2], 2, 1.0),
                                          ('taiga', taiga_ok, 18, [0.5, 1.5, 2.5, 3.2], 3, 0.9)]:
    kept = []
    # build rank by rank so a coarse point keeps its place when finer ones join it
    from scipy.spatial import cKDTree
    for r in ranks:
        cw = cell / (512 * 2 ** r)
        n = int(math.ceil(1 / cw))
        ii, jj = np.meshgrid(np.arange(n), np.arange(n))
        h = np.modf(np.abs(np.sin(ii * 12.9898 + jj * 78.233 + salt * 3.1 + r) * 43758.5453))[0]
        h2 = np.modf(np.abs(np.sin(ii * 39.346 + jj * 11.135 + salt * 7.7 + r) * 24634.6345))[0]
        X = (ii + 0.15 + 0.7 * h2) * cw; Y = (jj + 0.15 + 0.7 * np.modf(h * 7.13)[0]) * cw
        sel = (h <= keep) & (X < 1) & (Y > 0.03) & (Y < 0.97)
        X, Y = X[sel], Y[sel]
        bx, by = (X * BN).astype(int), (Y * BN).astype(int)
        good = ok[by, bx] & ~mtn_b[by, bx]
        X, Y = X[good], Y[good]
        if kept:
            t = cKDTree(np.array([(a, b) for a, b, _ in kept]))
            d, _ = t.query(np.c_[X, Y])
            X, Y = X[d >= cw * 0.6], Y[d >= cw * 0.6]
        kept += [(float(a), float(b), r) for a, b in zip(X, Y)]
    n = 0
    for x, y, r in kept:
        lon, lat = unmerc(x, y)
        if not land.contains(Point(lon, lat)):
            continue
        v = int(((x * 9973 + y * 7919) * 1000) % 4)
        pts_feats.append({'type': 'Feature', 'properties': {'kind': kind, 'z': r, 'v': v},
                          'geometry': {'type': 'Point', 'coordinates': [round(lon, 3), round(lat, 3)]}})
        n += 1
    counts[kind] = n

# each range line becomes a row of little peaks: points every 9 screen pixels at zoom 2.6, every second one from 1.6 and every
# fourth from 0.6 (and never before the range's own first zoom), so the rows stay put and thin out evenly as you zoom out
SP = 9 / (512 * 2 ** 2.6)
range_pts = []
for f in feats:
    P = np.array([merc(*c) for c in f['geometry']['coordinates']])
    seg = np.hypot(*np.diff(P, axis=0).T); cum = np.r_[0, np.cumsum(seg)]; L = cum[-1]
    n = int(L / SP)
    if n < 1:
        continue
    off = (L - n * SP) / 2
    for i in range(n + 1):
        t = off + i * SP
        k = min(np.searchsorted(cum, t, side='right') - 1, len(seg) - 1)
        q = P[k] + (P[k + 1] - P[k]) * ((t - cum[k]) / seg[k] if seg[k] > 0 else 0)
        rank = 0.6 if i % 4 == 0 else 1.6 if i % 2 == 0 else 2.6
        lon, lat = unmerc(*q)
        range_pts.append({'type': 'Feature', 'properties': {'kind': 'range', 'z': round(max(rank, f['properties']['z']), 1), 's': f['properties']['s'], 'v': (i * 7 + int(f['properties']['rl'])) % 3},
                          'geometry': {'type': 'Point', 'coordinates': [round(lon, 3), round(lat, 3)]}})
out = {'type': 'FeatureCollection', 'features': range_pts + pts_feats}
dump(out, os.path.join(DATA, 'world_ink.geojson'))
stats = {'ranges': n_range, 'range_peaks': len(range_pts), 'range_relief_m': 1000, 'range_min_elev_m': 600, 'lower_range_relief_m': 650, 'lower_range_min_elev_m': 400, 'range_window_km': 40, **{k + 's': v for k, v in counts.items()},
         'sand_ecoregions': sorted(sand_names)}
json.dump(stats, open(os.path.join(DATA, 'world_ink_stats.json'), 'w'), indent=1)
print({k: v for k, v in stats.items() if k != 'sand_ecoregions'}, os.path.getsize(os.path.join(DATA, 'world_ink.geojson')) // 1024, 'KB')
