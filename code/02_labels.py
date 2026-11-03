"""Curved label lines and the search gazetteer.

Outputs
  data/labels_countries.geojson  one gently curved line per country (Natural Earth 1:50m), plus the four UK
                                 nations (ONS local authority boundaries dissolved), for hand-lettered names
  data/labels_regions.geojson    hand-placed curves for upland, lowland and sea names around Britain and Ireland
  data/gazetteer.json            names for the search box (Natural Earth places, countries, states; the curated names)
"""
import json, math, os, sys
import numpy as np
from shapely.geometry import shape, LineString, Polygon, MultiPolygon, Point
from shapely.ops import unary_union, transform
sys.path.insert(0, os.path.dirname(__file__))
from common import GEO, DATA, merc, unmerc, dump

os.makedirs(DATA, exist_ok=True)


def to_merc(g):
    return transform(lambda x, y, z=None: tuple(np.array(merc_vec(x, y))), g)


def merc_vec(lon, lat):
    lon = np.asarray(lon, float); lat = np.clip(np.asarray(lat, float), -85, 85)
    x = (lon + 180) / 360
    s = np.sin(np.radians(lat))
    y = 0.5 - np.log((1 + s) / (1 - s)) / (4 * np.pi)
    return x, y


def largest(g):
    if isinstance(g, MultiPolygon):
        return max(g.geoms, key=lambda p: p.area)
    return g


def arc_for(poly, max_angle=50):
    """Fit a gentle arc through the middle of a (Mercator) polygon, along its long axis."""
    poly = poly.buffer(0)
    minx, miny, maxx, maxy = poly.bounds
    # sample interior points for the principal axis
    n = 60
    xs = np.linspace(minx, maxx, n); ys = np.linspace(miny, maxy, n)
    X, Y = np.meshgrid(xs, ys)
    import shapely
    inside = shapely.contains_xy(poly, X, Y)
    if inside.sum() < 8:
        c = poly.representative_point()
        w = (maxx - minx) * 0.8
        return [(c.x - w / 2, c.y), (c.x + w / 2, c.y)]
    P = np.c_[X[inside], Y[inside]]
    mu = P.mean(0)
    C = np.cov((P - mu).T)
    ev, evec = np.linalg.eigh(C)
    ax = evec[:, 1]
    elong = math.sqrt(ev[1] / max(ev[0], 1e-18))
    ang = math.degrees(math.atan2(ax[1], ax[0]))
    if ang > 90: ang -= 180
    if ang < -90: ang += 180
    if elong < 1.5:
        ang = 0.0  # round-ish shapes: letter it level, like a hand-drawn map
    lim = 80 if elong > 3.2 else max_angle   # long thin countries are lettered along their length
    ang = max(-lim, min(lim, ang))
    a = math.radians(ang)
    u = np.array([math.cos(a), math.sin(a)]); v = np.array([-u[1], u[0]])
    pu = (P - mu) @ u
    u0, u1 = pu.min(), pu.max()
    diag = math.hypot(maxx - minx, maxy - miny)
    st, mids, wts = [], [], []
    for t in np.linspace(u0, u1, 36)[1:-1]:
        p0 = mu + u * t - v * diag; p1 = mu + u * t + v * diag
        seg = poly.intersection(LineString([p0, p1]))
        if seg.is_empty: continue
        segs = [seg] if seg.geom_type == 'LineString' else [s for s in getattr(seg, 'geoms', []) if s.geom_type == 'LineString']
        if not segs: continue
        s = max(segs, key=lambda s: s.length)
        m = np.array(s.interpolate(0.5, normalized=True).coords[0])
        st.append(t); mids.append((m - mu) @ v); wts.append(s.length)
    if len(st) < 4:
        return [tuple(mu + u * u0 * .8), tuple(mu + u * u1 * .8)]
    st, mids, wts = map(np.array, (st, mids, wts))
    keep = wts > 0.35 * wts.max()
    st, mids, wts = st[keep], mids[keep], wts[keep]
    if len(st) < 3:
        st = np.array([u0 * .7, 0, u1 * .7]); mids = np.zeros(3); wts = np.ones(3)
    # quadratic bow about the axis, no tilt term, so the name keeps the axis direction
    Aq = np.c_[st ** 2, np.ones_like(st)] * wts[:, None]
    sol = np.linalg.lstsq(Aq, mids * wts, rcond=None)[0]
    co = np.array([sol[0], 0.0, sol[1]])
    a0, a1 = st.min(), st.max()
    L = a1 - a0
    pad = 0.06 * L
    a0, a1 = a0 + pad, a1 - pad
    L = a1 - a0
    # limit the bow (sagitta) to 10% of the length so names stay legible
    sag = abs(co[0]) * (L / 2) ** 2
    if sag > 0.10 * L:
        co[0] *= 0.10 * L / sag
    ts = np.linspace(a0, a1, 24)
    vs = np.polyval(co, ts)
    pts = [tuple(mu + u * t + v * w) for t, w in zip(ts, vs)]
    if pts[0][0] > pts[-1][0]:
        pts = pts[::-1]
    return pts


def _resample(P, a, b, n):
    """points along polyline P (Mercator) between arc-length fractions a..b"""
    P = np.asarray(P); seg = np.hypot(*np.diff(P, axis=0).T); cum = np.r_[0, np.cumsum(seg)]; L = cum[-1]
    out = []
    for t in np.linspace(a * L, b * L, n):
        i = min(np.searchsorted(cum, t, side='right') - 1, len(seg) - 1)
        f = (t - cum[i]) / seg[i] if seg[i] > 0 else 0
        out.append(P[i] + (P[i + 1] - P[i]) * f)
    return out, L


MAXPX = 880   # longest label line (screen px) kept in one tile band, so tiles never cut a name in two

# Lettering sizes: these stops mirror js/ink-map.js (countries, regions-land, regions-sea layers).
SIZES = {
    'country': ([(1, 8.5), (2, 10), (3, 12.5), (4, 16), (5, 18), (7, 25), (9, 32)], [(1, .1), (3, .22), (5, .36), (8, .48)], 'MedievalSharp.ttf'),
    'up': ([(5, 10.5), (7, 14), (9, 18), (11, 21)], [(5, .25), (8, .4), (11, .5)], 'MedievalSharp.ttf'),
    'sea': ([(3, 11), (5, 14), (7, 17), (9, 20), (11, 22)], [(3, .3), (6, .45), (9, .6)], 'IMFeGPit28P.ttf'),
}
# oceans: a larger italic, from the world view
SIZES['ocean'] = ([(1, 12.5), (3, 16), (5, 20), (7, 23)], [(1, .32), (4, .48), (7, .6)], 'IMFeGPit28P.ttf')
SIZES['low'] = SIZES['up']
# the four nations of the United Kingdom (layer nations): smaller than country names, from zoom 4.5 (where
# "United Kingdom" gives way to them)
SIZES['nation'] = ([(4, 10), (5, 12), (6, 14), (7, 17), (9, 24)], [(5, .3), (7, .4), (9, .5)], 'MedievalSharp.ttf')
# ranges, deserts and regions beyond Britain and Ireland (layer regions-world): small far out, so the great ranges
# can be lettered from the world view
SIZES['world'] = ([(1, 8.5), (2, 9.5), (3, 11), (4, 13), (6, 16), (9, 19), (11, 21)], [(1, .16), (2, .2), (5, .3), (8, .4), (11, .5)], 'MedievalSharp.ttf')
# lakes lettered along their length (layer lake-names-ink)
SIZES['lake'] = ([(9, 12), (12, 14.5), (15, 15.5)], [(9, .12), (12, .1)], 'IMFeGPit28P.ttf')
TTF = os.environ.get('INK_TTF', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fonts', 'ttf'))
_fonts = {}


def _interp(stops, z):
    if z <= stops[0][0]: return stops[0][1]
    for (z0, v0), (z1, v1) in zip(stops, stops[1:]):
        if z <= z1: return v0 + (v1 - v0) * (z - z0) / (z1 - z0)
    return stops[-1][1]


def text_px(name, kind, z):
    """Width in px of a name at zoom z, as MapLibre lays it out (size and letter spacing at z)."""
    from fontTools.ttLib import TTFont
    sz, ls, ttf = SIZES[kind]
    if ttf not in _fonts:
        f = TTFont(os.path.join(TTF, ttf)); _fonts[ttf] = (f.getBestCmap(), f['hmtx'].metrics, f['head'].unitsPerEm)
    cmap, hm, upm = _fonts[ttf]
    size = _interp(sz, z); sp = _interp(ls, z)
    w = 0
    for ch in name:
        g = cmap.get(ord(ch)) or cmap.get(ord(' '))
        w += hm[g][0] / upm * size + sp * size
    return w


def _extend(P, need_frac):
    """Extend a polyline at both ends along its end tangents so its length grows by need_frac (e.g. 0.3 = 30%)."""
    P = [np.asarray(p, float) for p in P]
    seg = sum(np.hypot(*(b - a)) for a, b in zip(P, P[1:]))
    add = seg * need_frac / 2
    d0 = P[0] - P[1]; d0 = d0 / np.hypot(*d0)
    d1 = P[-1] - P[-2]; d1 = d1 / np.hypot(*d1)
    return [P[0] + d0 * add] + P + [P[-1] + d1 * add]


def line_feature(pts_merc, props, zfrom=0, zto=12, ext=1.6, ext_low=None):
    """One feature per integer zoom band. MapLibre fits a curved name using the line's length at the band's
    zoom and the text size one zoom higher, so each band gets a line just long enough: the central part of
    the curve when it is long, or the curve drawn out a little past its ends when the name is wider than
    the land (as a map maker letters a name across a small country). Bands where it would need more than
    `ext` times the curve are left out, so small places are named only once there is room."""
    _, L = _resample(pts_merc, 0, 1, 2)
    feats = []
    for zb in range(max(0, int(math.floor(zfrom))), zto + 1):
        need = text_px(props['name'], 'world' if props.get('uk') == 0 and props['kind'] in ('up', 'low') else props['kind'], zb + 1) * 1.08 + 16
        arc = L * 512 * 2 ** zb
        if need > MAXPX:
            continue
        target = max(need, min(arc, MAXPX))
        if target <= arc:
            frac = target / arc
            pts, _ = _resample(pts_merc, 0.5 - frac / 2, 0.5 + frac / 2, 18)
        else:
            if target > arc * (ext_low if ext_low and zb <= 2 else ext):
                continue
            pts, _ = _resample(_extend(pts_merc, target / arc - 1), 0, 1, 18)
        coords = [list(map(lambda q: round(q, 4), unmerc(x, y))) for x, y in pts]
        pr = dict(props); pr['zb'] = zb
        feats.append({'type': 'Feature', 'properties': pr, 'geometry': {'type': 'LineString', 'coordinates': coords}})
    zf = min([f['properties']['zb'] for f in feats], default=99)
    for f in feats:
        f['properties']['zf'] = zf if props['kind'] in ('country', 'nation') else max(zf, props.get('z', 0) - 0.5)  # names fade in from here
    return feats


def zoom_for_area(area_merc):
    # area of the largest part in normalised Mercator units -> zoom where the name is first lettered
    w = math.sqrt(area_merc)
    return round(max(1.0, min(7.0, math.log2(0.06 / w) + 1.0)), 1)


def smooth(pts, n=20):
    """Catmull-Rom through hand points; a two-point line gets a slight hand-drawn bow."""
    P = [np.array(merc(*p)) for p in pts]
    if len(P) == 2:
        a, b = P
        d = b - a; nrm = np.array([-d[1], d[0]])
        P = [a, (a + b) / 2 + nrm * 0.06, b]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=(i == len(P) - 3)):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if out[0][0] > out[-1][0]:
        out = out[::-1]
    return [tuple(q) for q in out]


# Hand-drawn curves for countries whose shape defeats a fitted arc (sprawling, split or very long):
COUNTRY_CURVES = {
    'RUS': [(44, 59.5), (68, 62.0), (95, 63.8), (122, 63.4)],
    'CAN': [(-120, 61.0), (-109, 62.6), (-98, 63.0)],
    'CHL': [(-71.4, -41.5), (-71.0, -33.5), (-70.3, -25.5)],
    'NOR': [(6.4, 61.2), (9.4, 63.3), (13.2, 66.0), (16.4, 68.4)],
    'IDN': [(102.5, -3.2), (109.5, -5.4), (117.0, -7.0)],
    'JPN': [(132.8, 34.5), (136.6, 35.8), (140.2, 38.6)],
    'NZL': [(168.6, -45.6), (172.2, -42.2), (175.6, -38.9)],
    'PHL': [(121.0, 17.3), (122.3, 13.6), (124.9, 9.6)],
    'ITA': [(10.3, 44.6), (13.3, 42.3), (15.9, 40.3)],
    'VNM': [(105.5, 21.4), (106.4, 18.4), (108.2, 15.0)],
    'USA': [(-112, 39.6), (-101, 40.4), (-90, 39.6)],
    'GRL': [(-44, 70.5), (-40, 74.5), (-36, 78)],
    'MYS': [(111.6, 2.6), (114.4, 3.6), (116.8, 5.2)],
    'ARG': [(-66.8, -40.5), (-65.2, -34.5), (-63.5, -28.5)],
    'MOZ': [(33.0, -22.5), (35.0, -18.5), (38.0, -15.0)],
    'SWE': [(13.3, 57.6), (14.8, 61.4), (17.6, 64.6)],
    'FIN': [(24.0, 61.6), (26.2, 64.2), (26.6, 67.0)],
}

feats = []
ne = json.load(open(os.path.join(GEO, 'ne_50m_admin_0_countries.geojson')))
for f in ne['features']:
    p = f['properties']
    name = p.get('NAME_EN') or p['NAME']
    if p['ADM0_A3'] in ('ATA',):
        continue
    g = shape(f['geometry'])
    gm = largest(to_merc(g))
    if gm.area <= 0:
        continue
    # Great Britain is lettered along the length of the island (its fitted axis is steeper than the usual limit)
    pts = smooth(COUNTRY_CURVES[p['ADM0_A3']]) if p['ADM0_A3'] in COUNTRY_CURVES else arc_for(gm, max_angle=80 if p['ADM0_A3'] == 'GBR' else 50)
    short = {'United States of America': 'United States', 'Democratic Republic of the Congo': 'DR Congo',
             'Central African Republic': 'Central African Rep.', 'Bosnia and Herzegovina': 'Bosnia',
             "People's Republic of China": 'China', 'Republic of the Congo': 'Congo',
             'The Bahamas': 'Bahamas', 'Federated States of Micronesia': 'Micronesia'}.get(name, name)
    zf = zoom_for_area(gm.area)
    feats += line_feature(pts, {'name': short.upper(), 'kind': 'country', 'iso': p['ADM0_A3'],
                                'z': zf, 'lr': p.get('LABELRANK', 5),
                                'uk': 1 if p['ADM0_A3'] == 'GBR' else 0}, 0, 9 if p['ADM0_A3'] != 'GBR' else 4, ext=1.9,
                          ext_low=2.4 if zf <= 2.4 else None)

# UK nations from ONS local authorities (Dec 2023), dissolved by the first letter of the code
lad = json.load(open(os.path.join(GEO, 'lad23_bsc.geojson')))
groups = {}
for f in lad['features']:
    groups.setdefault(f['properties']['LAD23CD'][0], []).append(shape(f['geometry']).buffer(0))
nations = {'E': 'ENGLAND', 'S': 'SCOTLAND', 'W': 'WALES', 'N': 'NORTHERN IRELAND'}
for k, nm in nations.items():
    u = unary_union(groups[k])
    gm = largest(to_merc(u))
    if k == 'N':
        # Northern Ireland is too small for its name on one line: lettered on two lines at its middle (layer nations-pt)
        c = largest(u).representative_point()
        feats.append({'type': 'Feature', 'properties': {'name': nm, 'kind': 'nation', 'z': 4.5, 'lr': 2, 'uk': 2, 'zf': 4.5},
                      'geometry': {'type': 'Point', 'coordinates': [round(c.x, 4), round(c.y, 4)]}})
        continue
    pts = arc_for(gm, max_angle=45)
    feats += line_feature(pts, {'name': nm, 'kind': 'nation', 'z': 4.5, 'lr': 2, 'uk': 2}, 4, 9, ext=1.6)

dump({'type': 'FeatureCollection', 'features': feats}, os.path.join(DATA, 'labels_countries.geojson'))
print('countries', len(feats), os.path.getsize(os.path.join(DATA, 'labels_countries.geojson')) // 1024, 'KB')

# ---- hand-placed names around Britain and Ireland: (name, kind, min zoom, [lon, lat, ...]) ----
# kind: up = uplands and hills, low = lowland country, sea = seas, firths and bays
R = [
    ('North West Highlands', 'up', 5.6, [(-5.45, 57.55), (-4.95, 57.95), (-4.55, 58.3)]),
    ('Grampian Mountains', 'up', 5.4, [(-5.25, 56.55), (-4.2, 56.86), (-3.05, 57.0)]),
    ('Cairngorms', 'up', 6.6, [(-3.95, 57.13), (-3.6, 57.16), (-3.25, 57.12)]),
    ('Monadhliath', 'up', 7.4, [(-4.45, 57.15), (-4.15, 57.22)]),
    ('Southern Uplands', 'up', 5.6, [(-4.55, 55.25), (-3.75, 55.43), (-2.95, 55.58)]),
    ('Galloway Hills', 'up', 7.2, [(-4.65, 55.06), (-4.3, 55.12)]),
    ('Cheviot Hills', 'up', 6.8, [(-2.6, 55.36), (-2.25, 55.44), (-1.98, 55.47)]),
    ('The Pennines', 'up', 5.4, [(-2.42, 54.95), (-2.22, 54.35), (-2.0, 53.75)], 6),
    ('North Pennines', 'up', 7.2, [(-2.55, 54.78), (-2.2, 54.72), (-1.95, 54.68)]),
    ('Lake District', 'up', 6.0, [(-3.32, 54.31), (-3.06, 54.37), (-2.8, 54.35)]),
    ('Howgill Fells', 'up', 8.2, [(-2.62, 54.39), (-2.48, 54.41)]),
    ('Yorkshire Dales', 'up', 6.9, [(-2.4, 54.18), (-2.05, 54.24), (-1.72, 54.18)]),
    ('North York Moors', 'up', 6.4, [(-1.3, 54.36), (-0.92, 54.43), (-0.55, 54.37)]),
    ('Forest of Bowland', 'up', 7.2, [(-2.75, 53.98), (-2.45, 54.0)]),
    ('Peak District', 'up', 6.6, [(-2.0, 53.33), (-1.75, 53.39), (-1.5, 53.33)]),
    ('Eryri', 'up', 6.6, [(-4.15, 52.98), (-3.8, 53.06)]),
    ('Cambrian Mountains', 'up', 6.0, [(-3.98, 52.0), (-3.78, 52.3), (-3.65, 52.58)]),
    ('Brecon Beacons', 'up', 6.6, [(-3.85, 51.86), (-3.5, 51.9), (-3.15, 51.88)]),
    ('Dartmoor', 'up', 7.0, [(-4.08, 50.57), (-3.82, 50.6)]),
    ('Exmoor', 'up', 7.4, [(-3.85, 51.13), (-3.55, 51.14)]),
    ('Bodmin Moor', 'up', 8.0, [(-4.68, 50.55), (-4.5, 50.56)]),
    ('Mendip Hills', 'up', 7.8, [(-2.9, 51.27), (-2.55, 51.25)]),
    ('The Cotswolds', 'up', 6.6, [(-2.3, 51.62), (-1.95, 51.84), (-1.7, 51.98)]),
    ('Chiltern Hills', 'up', 7.0, [(-1.1, 51.58), (-0.75, 51.72), (-0.45, 51.86)]),
    ('North Downs', 'up', 7.0, [(-0.8, 51.24), (-0.05, 51.29), (0.6, 51.27)]),
    ('South Downs', 'up', 7.0, [(-1.05, 50.97), (-0.45, 50.91), (0.1, 50.86)]),
    ('The Weald', 'low', 7.2, [(-0.25, 51.06), (0.2, 51.07), (0.58, 51.04)]),
    ('The Fens', 'low', 6.8, [(-0.25, 52.62), (0.08, 52.56), (0.32, 52.45)]),
    ('East Anglia', 'low', 5.8, [(0.45, 52.36), (0.85, 52.43), (1.25, 52.5)]),
    ('Lincolnshire Wolds', 'up', 7.6, [(-0.3, 53.27), (-0.05, 53.42), (0.12, 53.52)]),
    ('Yorkshire Wolds', 'up', 7.6, [(-0.75, 53.92), (-0.55, 54.03), (-0.3, 54.1)]),
    ('Vale of York', 'low', 7.2, [(-1.3, 54.22), (-1.2, 53.92)]),
    ('The Midlands', 'low', 5.8, [(-2.25, 52.6), (-1.6, 52.74), (-0.95, 52.72)]),
    ('Salisbury Plain', 'low', 7.8, [(-2.05, 51.24), (-1.75, 51.25)]),
    ('Mourne Mountains', 'up', 7.4, [(-6.15, 54.17), (-5.88, 54.21)]),
    ('Sperrin Mountains', 'up', 7.4, [(-7.3, 54.8), (-6.95, 54.84)]),
    ('Wicklow Mountains', 'up', 7.0, [(-6.55, 52.95), (-6.4, 53.12)]),
    ('Connemara', 'up', 7.0, [(-9.95, 53.45), (-9.55, 53.52)]),
    ('The Burren', 'up', 7.8, [(-9.25, 53.05), (-9.02, 53.07)]),
    ('Macgillycuddy\'s Reeks', 'up', 8.0, [(-9.85, 52.0), (-9.6, 52.01)]),
    # seas, firths and bays
    ('Atlantic Ocean', 'sea', 3.6, [(-13.2, 50.6), (-13.0, 53.6), (-11.8, 56.6)]),
    ('North Sea', 'sea', 4.0, [(1.0, 54.4), (2.0, 55.6), (2.8, 57.2)]),
    ('Irish Sea', 'sea', 5.0, [(-5.8, 52.95), (-4.95, 53.5), (-3.9, 53.95)]),
    ('English Channel', 'sea', 4.8, [(-4.0, 49.95), (-2.0, 50.15), (-0.4, 50.35)]),
    ('Celtic Sea', 'sea', 4.8, [(-9.0, 50.65), (-7.4, 50.95), (-5.9, 51.0)]),
    ('Bristol Channel', 'sea', 6.4, [(-4.75, 51.32), (-4.2, 51.4), (-3.7, 51.42)]),
    ("St George's Channel", 'sea', 6.0, [(-6.15, 52.05), (-5.75, 52.18), (-5.35, 52.35)]),
    ('North Channel', 'sea', 6.2, [(-6.05, 55.05), (-5.85, 55.25), (-5.6, 55.45)]),
    ('Cardigan Bay', 'sea', 6.8, [(-4.65, 52.33), (-4.45, 52.47), (-4.32, 52.6)]),
    ('Morecambe Bay', 'sea', 8.4, [(-3.12, 54.08), (-2.95, 54.11)]),
    ('Solway Firth', 'sea', 7.4, [(-3.85, 54.83), (-3.6, 54.88), (-3.38, 54.94)]),
    ('The Minch', 'sea', 6.4, [(-6.15, 57.75), (-5.95, 58.0), (-5.75, 58.22)]),
    ('Sea of the Hebrides', 'sea', 6.4, [(-7.3, 56.78), (-6.95, 56.98), (-6.6, 57.18)]),
    ('Moray Firth', 'sea', 6.8, [(-3.85, 57.8), (-3.45, 57.85), (-3.05, 57.83)]),
    ('Firth of Forth', 'sea', 7.4, [(-2.95, 56.11), (-2.65, 56.13), (-2.35, 56.1)]),
    ('Firth of Clyde', 'sea', 7.6, [(-5.05, 55.45), (-4.98, 55.68)]),
    ('The Wash', 'sea', 7.8, [(0.2, 52.93), (0.38, 52.98)]),
    ('Liverpool Bay', 'sea', 7.4, [(-3.65, 53.52), (-3.35, 53.56)]),
    ('Strait of Dover', 'sea', 7.4, [(1.18, 50.88), (1.45, 51.03)]),
    ('Lyme Bay', 'sea', 7.8, [(-3.25, 50.55), (-2.85, 50.6)]),
    ('Galway Bay', 'sea', 7.6, [(-9.4, 53.17), (-9.1, 53.2)]),
    ('Donegal Bay', 'sea', 7.6, [(-8.75, 54.47), (-8.45, 54.52)]),
]


# ---- the world: oceans and seas, great ranges, deserts, basins and regions ----
# (name, kind, min zoom, points, last zoom band); kind ocean / sea / up / low as above
WORLD = [
    ('North Atlantic Ocean', 'ocean', 1.0, [(-50, 29), (-39, 34), (-28, 38)], 7),
    ('South Atlantic Ocean', 'ocean', 1.0, [(-30, -17), (-19, -24), (-8, -29)], 7),
    ('North Pacific Ocean', 'ocean', 1.0, [(-172, 31), (-155, 34), (-138, 31)], 7),
    ('South Pacific Ocean', 'ocean', 1.0, [(-140, -24), (-122, -29), (-104, -29)], 7),
    ('Indian Ocean', 'ocean', 1.0, [(62, -16), (76, -21), (90, -18)], 7),
    ('Arctic Ocean', 'ocean', 1.6, [(-172, 75.5), (-158, 76.5), (-144, 75.8)], 7),
    ('Southern Ocean', 'ocean', 1.4, [(18, -55.5), (50, -57), (82, -55.5)], 7),
    ('Mediterranean Sea', 'sea', 2.6, [(4.5, 38.1), (12.0, 35.4), (21.0, 34.1)], 8),
    ('Caribbean Sea', 'sea', 2.6, [(-81, 14.8), (-74.5, 14.2), (-68, 14.9)], 8),
    ('Gulf of Mexico', 'sea', 2.6, [(-94.5, 25.3), (-90.5, 25.9), (-86.5, 25.4)], 8),
    ('Baltic Sea', 'sea', 3.4, [(19.4, 55.6), (20.1, 57.3), (20.7, 58.9)], 8),
    ('Black Sea', 'sea', 3.0, [(31.2, 43.3), (34.5, 43.1), (37.8, 42.6)], 8),
    ('Red Sea', 'sea', 3.6, [(36.4, 24.2), (38.2, 21.0), (40.2, 17.0)], 8),
    ('Arabian Sea', 'sea', 2.6, [(59.5, 14.0), (64.0, 15.2), (68.5, 14.0)], 8),
    ('Bay of Bengal', 'sea', 2.8, [(84.4, 15.2), (88.0, 16.2), (91.6, 15.4)], 8),
    ('South China Sea', 'sea', 2.6, [(110.0, 11.5), (113.5, 13.6), (117.0, 15.6)], 8),
    ('East China Sea', 'sea', 3.4, [(122.8, 27.8), (125.2, 29.4), (127.4, 30.9)], 8),
    ('Sea of Japan', 'sea', 3.2, [(131.8, 38.4), (134.4, 40.0), (136.6, 41.8)], 8),
    ('Philippine Sea', 'sea', 3.0, [(127.5, 18.0), (133.0, 19.2), (138.5, 18.2)], 8),
    ('Coral Sea', 'sea', 2.8, [(149.6, -14.6), (153.8, -16.4), (158.0, -18.6)], 8),
    ('Tasman Sea', 'sea', 2.8, [(155.0, -37.6), (160.0, -38.8), (165.0, -38.0)], 8),
    ('Caspian Sea', 'sea', 3.6, [(51.3, 38.6), (51.0, 40.8), (50.3, 43.1)], 8),
    ('Hudson Bay', 'sea', 2.8, [(-89.5, 58.4), (-85.5, 59.6), (-81.5, 59.0)], 8),
    ('Gulf of Alaska', 'sea', 3.0, [(-151, 55.8), (-145.5, 56.7), (-140, 56.3)], 8),
    ('Bering Sea', 'sea', 3.0, [(-178, 57.4), (-174, 58.6), (-170, 58.2)], 8),
    ('Sea of Okhotsk', 'sea', 3.0, [(145, 53.4), (148.5, 54.6), (152, 54.0)], 8),
    ('Barents Sea', 'sea', 3.0, [(34, 72.8), (40.5, 73.8), (47, 73.4)], 8),
    ('Norwegian Sea', 'sea', 3.0, [(-3, 66.6), (1.5, 68.4), (6, 70.0)], 8),
    ('Greenland Sea', 'sea', 3.2, [(-9, 74.8), (-3.5, 75.8), (2, 76.3)], 8),
    ('Labrador Sea', 'sea', 3.0, [(-56.5, 57.6), (-52.5, 59.0), (-49.0, 60.6)], 8),
    ('Baffin Bay', 'sea', 3.2, [(-67, 72.8), (-62, 74.0), (-57.5, 74.6)], 8),
    ('Gulf of Guinea', 'sea', 3.2, [(-2.5, 2.4), (2.0, 1.8), (6.5, 2.2)], 8),
    ('Sargasso Sea', 'sea', 3.6, [(-67, 27.6), (-62, 28.4), (-57, 27.8)], 8),
    ('Great Australian Bight', 'sea', 3.6, [(125.5, -35.6), (130, -36.0), (134.5, -35.6)], 8),
    ('Arafura Sea', 'sea', 3.8, [(132.5, -9.6), (135.8, -9.8), (139.0, -9.4)], 8),
    ('Persian Gulf', 'sea', 4.4, [(49.4, 28.0), (51.4, 26.9), (53.4, 25.9)], 9),
    ('Gulf of Aden', 'sea', 4.6, [(45.6, 12.3), (47.8, 12.6), (50.0, 12.6)], 9),
    ('Adriatic Sea', 'sea', 4.4, [(14.0, 44.0), (15.6, 43.0), (17.2, 42.0)], 9),
    ('Aegean Sea', 'sea', 5.0, [(24.6, 39.6), (25.0, 38.4), (25.3, 37.2)], 9),
    ('Tyrrhenian Sea', 'sea', 4.6, [(10.9, 40.7), (12.4, 39.9), (13.9, 39.3)], 9),
    ('Bay of Biscay', 'sea', 4.6, [(-6.6, 45.4), (-4.6, 45.6), (-2.6, 45.1)], 9),
    ('Java Sea', 'sea', 5.0, [(107.5, -5.0), (110.6, -4.6), (113.6, -5.0)], 9),
    ('Yellow Sea', 'sea', 4.2, [(121.6, 34.6), (123.0, 35.8), (124.0, 37.0)], 9),
    ('Andaman Sea', 'sea', 4.4, [(95.6, 10.2), (96.5, 11.9), (97.0, 13.6)], 9),
    ('Gulf of California', 'sea', 4.8, [(-112.9, 28.6), (-111.2, 26.6), (-109.6, 24.8)], 9),
    # great ranges: lettered along the flank, where a map maker would leave room, not on the crest
    ('Alps', 'up', 2.4, [(6.2, 46.6), (8.4, 47.25), (11.0, 47.6), (13.6, 47.75)], 9),
    ('Pyrenees', 'up', 3.2, [(-1.2, 43.25), (0.9, 43.05), (2.6, 42.85)], 9),
    ('Carpathians', 'up', 2.8, [(19.6, 49.9), (23.6, 49.3), (26.2, 47.4), (26.2, 45.9)], 9),
    ('Caucasus', 'up', 2.8, [(40.0, 44.3), (43.2, 43.7), (46.8, 42.8)], 9),
    ('Ural Mountains', 'up', 2.2, [(57.3, 52.5), (57.6, 56.5), (58.0, 61.0), (59.0, 65.0)], 9),
    ('Himalaya', 'up', 1.6, [(78.6, 32.4), (82.0, 30.6), (86.0, 29.5), (90.0, 29.0), (94.0, 29.3)], 9),
    ('Karakoram', 'up', 3.0, [(74.6, 35.4), (76.5, 34.7), (78.0, 34.1)], 9),
    ('Hindu Kush', 'up', 2.8, [(68.6, 35.0), (70.6, 35.8), (72.6, 36.4)], 9),
    ('Pamir', 'up', 5.2, [(72.2, 38.6), (74.0, 38.2)], 9),
    ('Tian Shan', 'up', 2.4, [(73.0, 41.3), (78.0, 42.2), (83.0, 42.8), (87.0, 43.3)], 9),
    ('Kunlun Mountains', 'up', 2.6, [(80.0, 37.4), (85.0, 37.4), (90.0, 37.5), (95.0, 37.0)], 9),
    ('Altai', 'up', 2.8, [(86.0, 50.0), (89.0, 49.0), (92.0, 47.6)], 9),
    ('Zagros Mountains', 'up', 2.6, [(46.0, 35.0), (48.5, 32.5), (51.5, 30.0), (54.0, 28.3)], 9),
    ('Taurus Mountains', 'up', 4.8, [(30.0, 37.0), (33.0, 36.8), (36.0, 37.6)], 9),
    ('Atlas Mountains', 'up', 2.4, [(-8.5, 31.0), (-5.2, 32.2), (-1.5, 33.4), (3.0, 34.6)], 9),
    ('Ethiopian Highlands', 'up', 2.6, [(36.4, 8.0), (38.0, 10.4), (38.8, 12.9)], 9),
    ('Drakensberg', 'up', 3.0, [(26.6, -30.8), (28.0, -28.9), (29.4, -27.4)], 9),
    ('Rocky Mountains', 'up', 1.4, [(-106, 37), (-110, 43), (-115, 48.5), (-120, 53.5), (-125, 58)], 9),
    ('Sierra Nevada', 'up', 5.2, [(-119.4, 39.0), (-118.4, 37.4), (-117.6, 36.0)], 9),
    ('Sierra Madre Occidental', 'up', 2.8, [(-108.6, 30.0), (-106.4, 26.0), (-104.6, 23.0)], 9),
    ('Appalachian Mountains', 'up', 2.6, [(-84.8, 34.6), (-81.2, 37.2), (-78.2, 39.6), (-75.5, 41.5)], 9),
    ('Brooks Range', 'up', 2.8, [(-158, 69.0), (-151, 69.3), (-145, 69.4)], 9),
    ('Andes', 'up', 1.4, [(-69.3, -33.0), (-68.3, -27.0), (-68.2, -22.0), (-69.0, -18.0)], 9),
    ('Guiana Highlands', 'up', 4.4, [(-66.0, 4.6), (-62.0, 5.0), (-58.0, 4.2)], 9),
    ('Brazilian Highlands', 'up', 4.2, [(-48.0, -16.0), (-45.0, -18.0), (-42.0, -20.0)], 9),
    ('Great Dividing Range', 'up', 2.2, [(145.4, -36.8), (148.6, -32.0), (149.6, -27.0), (145.8, -21.5), (143.8, -17.4)], 9),
    ('Southern Alps', 'up', 3.0, [(169.6, -45.0), (171.2, -43.9), (172.6, -42.9)], 9),
    ('Scandinavian Mountains', 'up', 2.4, [(8.6, 61.6), (12.4, 63.6), (15.0, 66.4), (18.2, 68.6)], 9),
    ('Apennines', 'up', 4.8, [(10.0, 44.2), (12.5, 43.2), (14.5, 41.6), (16.0, 40.4)], 9),
    ('Dinaric Alps', 'up', 4.8, [(16.4, 45.2), (18.3, 43.9), (20.2, 42.8)], 9),
    ('Verkhoyansk Range', 'up', 3.0, [(128, 67.5), (130, 65.0), (134, 62.5)], 9),
    # deserts, basins and regions
    ('Sahara', 'low', 2.0, [(-10, 23.5), (0, 24.6), (12, 24.6), (24, 23.0)], 8),
    ('Sahel', 'low', 3.2, [(-5, 15.0), (5, 15.3), (15, 14.5), (25, 13.8)], 8),
    ('Arabian Desert', 'low', 3.2, [(43, 23.0), (47, 22.5), (51, 21.0)], 8),
    ('Gobi Desert', 'low', 3.2, [(98, 43.0), (104, 43.6), (110, 43.2)], 8),
    ('Taklamakan Desert', 'low', 3.6, [(78.5, 38.9), (83, 38.9), (87.5, 39.5)], 8),
    ('Tibetan Plateau', 'low', 3.2, [(82, 33.2), (87, 33.6), (92, 33.2)], 8),
    ('Karakum Desert', 'low', 4.2, [(58.0, 39.5), (60.5, 39.6), (63.0, 39.2)], 8),
    ('Thar Desert', 'low', 4.4, [(70.5, 26.8), (72.0, 27.3), (73.5, 27.6)], 8),
    ('Deccan Plateau', 'low', 4.0, [(75.0, 17.5), (77.5, 17.8), (80.0, 17.5)], 8),
    ('Kazakh Steppe', 'low', 3.6, [(62, 49.0), (68, 50.0), (74, 49.5)], 8),
    ('Siberia', 'low', 2.2, [(88, 57.6), (100, 58.6), (112, 58.0)], 6),
    ('Anatolia', 'low', 4.2, [(32, 39.3), (35, 39.6), (38, 39.3)], 8),
    ('Kalahari Desert', 'low', 3.6, [(20.0, -22.5), (22.5, -23.5), (25.0, -23.8)], 8),
    ('Namib Desert', 'low', 4.6, [(14.7, -21.0), (15.3, -24.0), (15.8, -26.5)], 8),
    ('Congo Basin', 'low', 3.2, [(17, 0.6), (21, 0.9), (25, 0.4)], 8),
    ('Amazon Basin', 'low', 2.6, [(-70, -4.0), (-63, -4.8), (-56, -4.0)], 8),
    ('Atacama Desert', 'low', 4.6, [(-69.6, -20.5), (-69.7, -23.0), (-70.0, -25.5)], 8),
    ('Patagonia', 'low', 3.4, [(-70.5, -44.0), (-68.5, -46.0), (-67.5, -48.5)], 8),
    ('Pampas', 'low', 4.2, [(-64.0, -35.0), (-61.5, -35.5), (-59.0, -35.0)], 8),
    ('Gran Chaco', 'low', 4.4, [(-62.0, -22.5), (-60.5, -23.5), (-59.5, -24.8)], 8),
    ('Llanos', 'low', 4.4, [(-71.0, 6.5), (-68.5, 7.2), (-66.0, 7.6)], 8),
    ('Great Plains', 'low', 3.4, [(-104.5, 41.5), (-101.0, 42.0), (-97.5, 41.5)], 8),
    ('Great Basin', 'low', 4.8, [(-118.0, 39.5), (-116.5, 40.0), (-115.0, 39.6)], 8),
    ('Labrador', 'low', 4.2, [(-66, 54.0), (-63.5, 54.6), (-61, 54.2)], 8),
    ('The Outback', 'low', 2.8, [(127, -24.6), (133, -24.2), (139, -24.8)], 6),
    ('Great Sandy Desert', 'low', 4.0, [(121, -20.5), (124, -20.8), (127, -20.5)], 8),
    ('Great Victoria Desert', 'low', 4.0, [(124, -28.5), (128, -29.0), (132, -29.0)], 8),
    ('Nullarbor Plain', 'low', 4.8, [(126.5, -31.0), (129.0, -31.0), (131.5, -31.0)], 8),
    ('Kamchatka', 'low', 4.4, [(158.6, 53.6), (159.6, 55.6), (161.0, 57.6)], 8),
]
for w in WORLD:
    w[3][:] = w[3]
R_UK = list(R)
R = R + [(n, k, z, p, zm) for n, k, z, p, zm in WORLD]

reg = []
uk_set = {r[0] for r in R_UK}
for name, kind, z, pts, *zmax in R:
    reg += line_feature(smooth(pts), {'name': name.upper(), 'kind': kind, 'z': z, 'uk': 1 if name in uk_set else 0}, z - 1, zmax[0] if zmax else 12, ext=2.0 if kind in ('sea', 'ocean') else 2.2)
# the seas round Great Britain are too narrow for a curved name at zoom 4 to 5, where the four nations are first lettered:
# there they are lettered straight at a point, on two lines where need be (layer regions-sea-pt)
for name, lon, lat in [('Irish Sea', -4.45, 53.9), ('English Channel', -2.6, 50.05), ('Celtic Sea', -7.6, 50.65)]:
    reg.append({'type': 'Feature', 'properties': {'name': name.upper(), 'kind': 'sea', 'z': 4.4, 'uk': 1, 'zb': 4, 'zf': 4.4},
                'geometry': {'type': 'Point', 'coordinates': [lon, lat]}})
dump({'type': 'FeatureCollection', 'features': reg}, os.path.join(DATA, 'labels_regions.geojson'))
print('regions', len(reg))

# ---- gazetteer: [name, lon, lat, zoom, kind, context] ----
gz = []
for f in ne['features']:
    p = f['properties']
    g = shape(f['geometry'])
    lg = largest(g)
    c = lg.representative_point()
    minx, miny, maxx, maxy = lg.bounds
    span = max(maxx - minx, (maxy - miny) * 1.4, 0.3)
    zz = round(max(2.0, min(8.5, math.log2(360 / span) + 0.2)), 1)
    gz.append([p.get('NAME_EN') or p['NAME'], round(c.x, 3), round(c.y, 3), zz, 'country', ''])
pp = json.load(open(os.path.join(GEO, 'ne_10m_populated_places_simple.geojson')))
for f in pp['features']:
    p = f['properties']
    pop = p.get('pop_max') or 0
    zz = 11 if pop < 100000 else 10 if pop < 1e6 else 9
    gz.append([p['name'], round(p['longitude'], 4), round(p['latitude'], 4), zz, 'place',
               ', '.join([x for x in (p.get('adm1name'), p.get('adm0name')) if x])])
a1 = json.load(open(os.path.join(GEO, 'ne_10m_admin_1_states_provinces.geojson')))
for f in a1['features']:
    p = f['properties']
    if not p.get('name'): continue
    try:
        g = largest(shape(f['geometry']))
    except Exception:
        continue
    c = g.representative_point(); minx, miny, maxx, maxy = g.bounds
    span = max(maxx - minx, (maxy - miny) * 1.4, 0.05)
    zz = round(max(3.0, min(11, math.log2(360 / span) + 0.3)), 1)
    gz.append([p['name'], round(c.x, 3), round(c.y, 3), zz, 'region', p.get('admin') or ''])
uk_names = {r[0] for r in R_UK}
for name, kind, z, pts, *_ in R:
    lon = float(np.mean([q[0] for q in pts])); lat = float(np.mean([q[1] for q in pts]))
    uk = name in uk_names
    zz = (max(7.5, z + 1.2) if uk else z + 1.4) if kind in ('up', 'low') else z + 0.6
    gz.append([name, round(lon, 3), round(lat, 3), round(zz, 1),
               {'up': 'hills', 'low': 'country', 'sea': 'sea', 'ocean': 'sea'}[kind], 'Britain and Ireland' if uk else ''])

# names lettered by hand: the page hides OpenStreetMap's own label for the same sea (and its usual variants)
ALIAS = {'Persian Gulf': ['Arabian Gulf'], 'Sea of Japan': ['East Sea', 'Japan Sea'], 'Strait of Dover': ['Dover Strait'],
         'Gulf of Mexico': ['Golfo de México', 'Gulf of America'], 'Arctic Ocean': ['Arctic Ocean'], 'Bay of Bengal': ['Bay of Bengal']}
zf_of = {f['properties']['name']: f['properties']['zf'] for f in reg}
cur = {}
for n, k, *_ in R:
    if k in ('sea', 'ocean'):
        for a in [n] + ALIAS.get(n, []):
            cur[a] = zf_of.get(n.upper(), 99)

# ---- the lakes of the Lake District, lettered in blue italic along their length (data/lakes_lettered.geojson) ----
# Each line is the long axis of the lake, fitted to its OpenStreetMap water polygon in the saved zoom 12 (or zoom 10)
# tiles when they are on disk (RAW9), otherwise the hand-placed line below; 'osm' lists the names OpenStreetMap uses,
# whose own label the page then hides.
LAKES = [
    ('Windermere', ['Windermere'], [(-2.962, 54.415), (-2.942, 54.36), (-2.955, 54.275)]),
    ('Ullswater', ['Ullswater'], [(-2.935, 54.548), (-2.885, 54.585), (-2.82, 54.613)]),
    ('Derwentwater', ['Derwent Water', 'Derwentwater'], [(-3.145, 54.588), (-3.152, 54.566), (-3.16, 54.55)]),
    ('Coniston Water', ['Coniston Water'], [(-3.072, 54.375), (-3.06, 54.34), (-3.045, 54.31)]),
    ('Bassenthwaite', ['Bassenthwaite Lake', 'Bassenthwaite'], [(-3.19, 54.632), (-3.212, 54.66), (-3.232, 54.688)]),
    ('Wast Water', ['Wast Water', 'Wastwater'], [(-3.265, 54.455), (-3.295, 54.44), (-3.322, 54.427)]),
    ('Ennerdale Water', ['Ennerdale Water'], [(-3.423, 54.522), (-3.395, 54.518), (-3.367, 54.514)]),
    ('Buttermere', ['Buttermere'], [(-3.284, 54.544), (-3.27, 54.537), (-3.256, 54.529)]),
    ('Crummock Water', ['Crummock Water'], [(-3.318, 54.567), (-3.305, 54.555), (-3.293, 54.542)]),
    ('Thirlmere', ['Thirlmere'], [(-3.062, 54.522), (-3.065, 54.54), (-3.07, 54.562)]),
    ('Haweswater', ['Haweswater Reservoir', 'Haweswater'], [(-2.828, 54.495), (-2.8, 54.512), (-2.776, 54.527)]),
    ('Loweswater', ['Loweswater'], [(-3.372, 54.582), (-3.36, 54.578), (-3.348, 54.574)]),
    ('Grasmere', ['Grasmere'], [(-3.032, 54.453), (-3.026, 54.449), (-3.02, 54.446)]),
    ('Rydal Water', ['Rydal Water'], [(-3.008, 54.449), (-2.999, 54.448), (-2.99, 54.447)]),
    ('Esthwaite Water', ['Esthwaite Water'], [(-2.988, 54.372), (-2.986, 54.363), (-2.984, 54.354)]),
]


def _osm_water(z, lon0, lat0, lon1, lat1):
    """Water polygons (lon/lat) from saved OpenFreeMap tiles in RAW9, or [] if none are on disk."""
    try:
        import mapbox_vector_tile as mvt
        from common import RAW9
    except Exception:
        return []
    n = 2 ** z
    x0, y0 = merc(lon0, lat1); x1, y1 = merc(lon1, lat0)
    out = []
    for tx in range(int(x0 * n), int(x1 * n) + 1):
        for ty in range(int(y0 * n), int(y1 * n) + 1):
            fn = os.path.join(RAW9, 'ofm', str(z), str(tx), f'{ty}.pbf')
            if not os.path.exists(fn):
                continue
            t = mvt.decode(open(fn, 'rb').read(), default_options={'y_coord_down': True})
            if 'water' not in t:
                continue
            E = t['water']['extent']
            for f in t['water']['features']:
                if f['properties'].get('class') != 'lake':
                    continue
                g = f['geometry']
                polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
                for pp in polys:
                    rings = [[unmerc((tx + a / E) / n, (ty + b / E) / n) for a, b in r] for r in pp]
                    try:
                        out.append(Polygon(rings[0], rings[1:]).buffer(0))
                    except Exception:
                        pass
    return out


lake_feats = []
_W = {z: _osm_water(z, -3.5, 54.2, -2.7, 54.75) for z in (12, 10)}
_W = {z: unary_union(v) if v else None for z, v in _W.items()}
n_fitted = 0
for name, osm, pts in LAKES:
    seed = Point(pts[len(pts) // 2])
    line = None
    for z in (12, 10):
        U = _W.get(z)
        if U is None:
            continue
        parts = list(U.geoms) if hasattr(U, 'geoms') else [U]
        hit = [g for g in parts if g.distance(seed) < 0.004]
        if hit:
            poly = max(hit, key=lambda g: g.area)
            fit = arc_for(to_merc(poly), max_angle=89)
            # keep the fitted axis only if it runs inside the lake for most of its length
            ll = LineString([unmerc(*q) for q in fit])
            if ll.length > 0 and poly.buffer(0.0005).intersection(ll).length / ll.length > 0.8:
                line = fit
                n_fitted += 1
            break
    if line is None:
        line = smooth(pts)
    props = {'name': name, 'kind': 'lake', 'osm': '|'.join(osm)}
    # zoom 8 to 11: along the lake (drawn out a little past its ends where the name is longer than the lake)
    fe = line_feature(line, props, 8, 11, ext=2.4)
    lake_feats += fe
    # where the lake is still too short for its name (zoom 9 to 11), lettered straight at its middle (layer lake-names-ink-pt)
    mid = unmerc(*_resample(line, 0.5, 0.5, 1)[0][0])
    for zb in range(9, 12):
        if zb not in {f['properties']['zb'] for f in fe}:
            lake_feats.append({'type': 'Feature', 'properties': dict(props, zb=zb, zf=zb), 'geometry': {'type': 'Point', 'coordinates': [round(mid[0], 5), round(mid[1], 5)]}})
    # zoom 12 to 16: the whole axis once, lettered along it wherever it shows on screen (layer lake-names-ink-l, line placement)
    whole, _ = _resample(line, 0, 1, 24)
    lake_feats.append({'type': 'Feature', 'properties': dict(props, zb=12, zf=12, whole=1), 'geometry': {'type': 'LineString', 'coordinates': [[round(c, 5) for c in unmerc(x, y)] for x, y in whole]}})
dump({'type': 'FeatureCollection', 'features': lake_feats}, os.path.join(DATA, 'lakes_lettered.geojson'))
print('lettered lakes', len(LAKES), 'fitted to OpenStreetMap', n_fitted, 'features', len(lake_feats))
lake_osm = sorted({a for _, osm, _ in LAKES for a in osm})

# hand-lettered land names, with the names OpenStreetMap and Wikidata use for the same place (national parks and so on):
# the page hides those duplicates while the hand lettering shows
LAND_ALIAS = {'Lake District': ['Lake District National Park', 'English Lake District', 'The Lake District'],
              'Peak District': ['Peak District National Park'], 'Yorkshire Dales': ['Yorkshire Dales National Park'],
              'North York Moors': ['North York Moors National Park'], 'Dartmoor': ['Dartmoor National Park'],
              'Exmoor': ['Exmoor National Park'], 'Cairngorms': ['Cairngorms National Park', 'Cairngorm Mountains'],
              'Eryri': ['Eryri National Park', 'Snowdonia', 'Snowdonia National Park'],
              'Brecon Beacons': ['Bannau Brycheiniog', 'Bannau Brycheiniog National Park', 'Brecon Beacons National Park'],
              'The Cotswolds': ['Cotswolds', 'Cotswolds National Landscape', 'Cotswolds Area of Outstanding Natural Beauty'],
              'South Downs': ['South Downs National Park'], 'North Pennines': ['North Pennines National Landscape'],
              'Forest of Bowland': ['Forest of Bowland National Landscape'], 'The Pennines': ['Pennines'],
              'Mourne Mountains': ['Mournes', 'Mourne Mountains National Landscape'], 'Wicklow Mountains': ['Wicklow Mountains National Park'],
              'Connemara': ['Connemara National Park'], 'The Burren': ['Burren', 'Burren National Park'], 'The Fens': ['Fens']}
lettered = {}
for n, k, *_ in R:
    if k in ('up', 'low'):
        zf = zf_of.get(n.upper(), 99)
        for a in [n] + LAND_ALIAS.get(n, []):
            lettered[a] = zf
open(os.path.join(os.path.dirname(DATA), 'js', 'curated.js'), 'w').write(
    '/* Generated by code/02_labels.py: sea names lettered by hand, with the zoom from which the hand lettering\n'
    '   fits; from there on, OpenStreetMap\'s own label for the same sea is hidden. */\n'
    'window.INK_CURATED = ' + json.dumps(cur, ensure_ascii=False, sort_keys=True) + ';\n'
    '/* hand-lettered land names and their aliases, with the zoom from which the lettering shows (duplicates are hidden) */\n'
    'window.INK_LETTERED = ' + json.dumps(lettered, ensure_ascii=False, sort_keys=True) + ';\n'
    '/* OpenStreetMap names of the lakes lettered along their length (data/lakes_lettered.geojson) */\n'
    'window.INK_LAKES = ' + json.dumps(lake_osm, ensure_ascii=False) + ';\n')
print('curated sea names', len(cur))
dump(gz, os.path.join(DATA, 'gazetteer.json'))
print('gazetteer', len(gz), os.path.getsize(os.path.join(DATA, 'gazetteer.json')) // 1024, 'KB')
