"""Star forts (bastion forts, trace italienne) for the ink map.

Inputs (all OpenStreetMap ODbL or Wikidata CC0):
  raw13/fort_*.json        Overpass: ways and relations tagged historic=fort or fortification_type=*, with geometry (code/sparql/forts.overpassql)
  raw13/relwalls.json      Overpass: town walls mapped as relations
  raw12/cw*.json           Overpass: town walls mapped as ways
  raw13/starforts_wd.tsv   QLever/Wikidata: star forts, sconces, polygonal forts and fortified towns with coordinates and sitelinks
Output:
  data/forts.geojson       one Polygon per star fort outline (rings clockwise, so the map can put the moat outside and the
                           rampart inside with line-offset), plus one Point per fort for the symbol and name further out
  raw13/star_wall_ways.json ids of town-wall ways that are drawn as star forts instead of plain walls

A ring counts as a bastioned (star) outline when, after simplifying it to 4 m, it has at least four salient points (convex corners
sharper than 115 degrees that stick out from the centre) and fills less than 92% of its convex hull. Forts named or catalogued as
star forts or sconces need only three salients.
"""
import json, glob, os, re, math, csv, collections
from shapely.geometry import Polygon, LineString, Point, mapping
from shapely.ops import polygonize, unary_union, transform

RAW = '/home/claude/newdata'
ROOT = os.path.join(os.path.dirname(__file__), '..')

def proj(lat0):
    k = 111320 * math.cos(math.radians(lat0))
    return (lambda x, y: ((x) * k, y * 110540)), (lambda x, y: (x / k, y / 110540))

def shape_stats(ring_m):
    """salients: sharp (<100 deg) convex corners that stick out from the centre; their spread (coefficient of variation of
    their distance from the centre); and the number of re-entrant (concave) corners"""
    pts = list(ring_m.exterior.coords)[:-1]
    n = len(pts)
    cx, cy = ring_m.centroid.x, ring_m.centroid.y
    orient = 1 if ring_m.exterior.is_ccw else -1
    sal, conc = [], 0
    for i in range(n):
        ax, ay = pts[i - 1]; bx, by = pts[i]; qx, qy = pts[(i + 1) % n]
        v1 = (ax - bx, ay - by); v2 = (qx - bx, qy - by)
        l1 = math.hypot(*v1); l2 = math.hypot(*v2)
        if l1 < 3 or l2 < 3: continue
        ang = math.degrees(math.acos(max(-1, min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)))))
        cross = (bx - ax) * (qy - by) - (by - ay) * (qx - bx)
        if cross * orient > 0 and ang < 100:
            d = math.hypot(bx - cx, by - cy)
            if d >= math.hypot(ax - cx, ay - cy) and d >= math.hypot(qx - cx, qy - cy): sal.append(d)
        elif cross * orient < 0 and ang < 150: conc += 1
    if not sal: return 0, 9, conc
    m = sum(sal) / len(sal)
    return len(sal), (sum((x - m) ** 2 for x in sal) / len(sal)) ** 0.5 / m, conc

NOT_STAR = re.compile(r'castle|castillo|castelo|castello|château|chateau|burg\b|vár|kalaja|kalesi|monast|great wall|kremlin|кремль|rocca|ring ?fort|castro|hillfort|missile|城|qila|killa|fort$', re.I)

def is_star(poly_ll, hint=False, wall=False, name=''):
    if name and NOT_STAR.search(name) and not hint: return False
    lat0 = poly_ll.centroid.y
    f, _ = proj(lat0)
    pm = transform(f, poly_ll)
    if not pm.is_valid: pm = pm.buffer(0)
    if pm.geom_type != 'Polygon': return False
    per = pm.exterior.length
    if per < 250 or per > 20000: return False
    ps = pm.simplify(4)
    if ps.geom_type != 'Polygon': return False
    fill = ps.area / ps.convex_hull.area
    if fill < 0.45 or fill > 0.93: return False
    s, cv, conc = shape_stats(ps)
    need = 3 if hint else 4
    if wall: return s >= need and cv <= 0.3 and s <= conc <= 6 * s + 10
    return s >= need and cv <= 0.25 and s <= conc <= 4 * s + 6

def rings_from(el):
    """outer rings (lon/lat Polygons) from a way or relation with geometry"""
    if el['type'] == 'way':
        g = el.get('geometry') or []
        if len(g) >= 4 and (g[0]['lon'], g[0]['lat']) == (g[-1]['lon'], g[-1]['lat']):
            return [Polygon([(p['lon'], p['lat']) for p in g])]
        return []
    lines = [LineString([(p['lon'], p['lat']) for p in m['geometry']]) for m in el.get('members', [])
             if m.get('type') == 'way' and m.get('role') != 'inner' and len(m.get('geometry') or []) >= 2]
    if not lines: return []
    return [p for p in polygonize(unary_union(lines))]

# ---- Wikidata catalogue (star fort, sconce, polygonal fort, fortified town)
WD = {}
STARCLS = {'Q12797', 'Q91203', 'Q6653030', 'Q92080'}
for r in csv.reader(open(f'{RAW}/raw13/starforts_wd.tsv'), delimiter='\t'):
    if not r or not r[0].startswith('<'): continue
    q = r[0].rsplit('/', 1)[1].rstrip('>'); cls = r[1].rsplit('/', 1)[1].rstrip('>')
    m = re.match(r'"?POINT\(([-\d.eE]+) ([-\d.eE]+)\)', r[3].strip('"').split('^^')[0])
    if not m: continue
    name = re.sub(r'@[a-z-]+$', '', r[2].split('"@')[0].strip('"')) if r[2] else ''   # a bare language tag too
    sl = int(r[6].split('^^')[0].strip('"')) if r[6] else 0
    import urllib.parse
    en = urllib.parse.unquote(r[7].strip('<>').rsplit('/', 1)[1]).replace('_', ' ') if len(r) > 7 and r[7] else ''
    w = WD.setdefault(q, {'q': q, 'cls': set(), 'lon': float(m.group(1)), 'lat': float(m.group(2)), 'n': name, 'sl': sl, 'en': en})
    w['cls'].add(cls)

NAME_HINT = re.compile(r'vesting|schans|sconce|star fort|sternschanze|festung|cittadella|citadel|zitadelle|citadelle|bastion|fortaleza|forte|fort ', re.I)

cands = []        # (polygon, tags, src ids)
for f in sorted(glob.glob(f'{RAW}/raw13/fort_*.json')):
    for el in json.load(open(f))['elements']:
        if el['type'] not in ('way', 'relation'): continue
        for p in rings_from(el): cands.append((p, el.get('tags', {}), [(el['type'], el['id'])], False))
walls_src = sorted(glob.glob(f'{RAW}/raw12/cw[0-9]*.json')) + [f'{RAW}/raw13/relwalls.json']
for f in walls_src:
    if not os.path.exists(f): continue
    for el in json.load(open(f))['elements']:
        if el['type'] not in ('way', 'relation'): continue
        ids = [('way', el['id'])] if el['type'] == 'way' else [('way', m['ref']) for m in el.get('members', []) if m.get('type') == 'way']
        for p in rings_from(el): cands.append((p, el.get('tags', {}), ids, True))

# town walls broken into many short ways (gates, towers): join the pieces near each other into one ring.
# Each 1-degree cell: buffer every wall way by about 15 m, union, fill the holes, and shrink back by the same amount.
from shapely.strtree import STRtree
cells = collections.defaultdict(list)
for f in walls_src:
    if not os.path.exists(f): continue
    for el in json.load(open(f))['elements']:
        segs = [(el['id'], el['geometry'])] if el['type'] == 'way' and el.get('geometry') else \
               [(m['ref'], m['geometry']) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry')]
        for wid, g in segs:
            if len(g) < 2: continue
            ls = LineString([(p['lon'], p['lat']) for p in g])
            cells[(int(math.floor(ls.centroid.x)), int(math.floor(ls.centroid.y)))].append((wid, ls))
B = 0.00016
JOINS = [dict(), dict(join_style=2, mitre_limit=6)]          # round and mitred joins: each catches forts the other misses
for key, segs in cells.items():
    tree = STRtree([ls for _, ls in segs])
    for J in JOINS:
        merged = unary_union([ls.buffer(B, **J) for _, ls in segs])
        for mp in (merged.geoms if merged.geom_type == 'MultiPolygon' else [merged]):
            filled = Polygon(mp.exterior).buffer(-B, **J)
            if filled.is_empty: continue
            if filled.geom_type == 'MultiPolygon': filled = max(filled.geoms, key=lambda g: g.area)
            ids = [segs[i][0] for i in tree.query(mp) if segs[i][1].intersects(mp)]
            if len(ids) < 2: continue
            cands.append((filled, {}, [('way', i) for i in ids], True))
# moats (water=moat) often trace a star fort better than anything else, but are mapped in pieces: join the pieces of each
# cell (buffer 22 m, union), fill the holes and take the outer edge
mcells = collections.defaultdict(list)
for f in sorted(glob.glob(f'{RAW}/raw13/moat_*.json')):
    for el in json.load(open(f))['elements']:
        parts = []
        if el['type'] == 'way' and len(el.get('geometry') or []) >= 2: parts = [LineString([(q['lon'], q['lat']) for q in el['geometry']])]
        elif el['type'] == 'relation': parts = [LineString([(q['lon'], q['lat']) for q in m['geometry']]) for m in el.get('members', []) if len(m.get('geometry') or []) >= 2]
        for ls in parts:
            g = Polygon(ls.coords) if ls.is_ring and len(ls.coords) >= 4 else ls
            mcells[(int(math.floor(ls.centroid.x)), int(math.floor(ls.centroid.y)))].append(g)
MB = 0.0002
for key, gs in mcells.items():
    for J in JOINS:
        u = unary_union([g.buffer(MB, **J) for g in gs if g.is_valid])
        for mp in (u.geoms if u.geom_type == 'MultiPolygon' else [u]):
            filled = Polygon(mp.exterior).buffer(-MB * 0.7, **J).buffer(-0.00028, **J).buffer(0.00028, **J)   # drop canals and ditches leading away
            if filled.is_empty: continue
            if filled.geom_type == 'MultiPolygon': filled = max(filled.geoms, key=lambda g: g.area)
            cands.append((filled, {}, [], True))

forts, wall_skip = [], set()
seenc = []
for p, t, ids, wall in cands:
    if not p.is_valid: p = p.buffer(0)
    if p.geom_type != 'Polygon' or p.area <= 0: continue
    q = t.get('wikidata', '')
    nm = t.get('name:en') or t.get('name') or ''
    hint = (q in WD and WD[q]['cls'] & STARCLS) or bool(NAME_HINT.search(nm + ' '))
    if not is_star(p, bool(hint), wall, nm): continue
    c = p.centroid
    if any(abs(c.x - a) < 0.0012 and abs(c.y - b) < 0.0008 for a, b in seenc): continue
    seenc.append((c.x, c.y))
    for ty, i in ids:
        if ty == 'way': wall_skip.add(i)
    forts.append((p, nm, q))

# ---- features
def zof(q, named):
    sl = WD.get(q, {}).get('sl', 0)
    return 5 if sl >= 25 else 6.5 if sl >= 12 else 8 if sl >= 5 else 9.5 if (q or named) else 11

feats, have_q = [], set()
def r5(v): return round(v, 5)
for p, nm, q in forts:
    p = p.simplify(0.00002)
    ring = list(p.exterior.coords)
    if Polygon(ring).exterior.is_ccw: ring = ring[::-1]     # clockwise: right of travel is inside
    if not nm and q in WD: nm = WD[q]['n']
    w = WD.get(q, {}).get('en', '')
    feats.append({'type': 'Feature', 'properties': {'n': nm, 'q': q, 'w': w}, 'geometry': {'type': 'Polygon', 'coordinates': [[[r5(a), r5(b)] for a, b in ring]]}})
    c = p.representative_point()
    feats.append({'type': 'Feature', 'properties': {'n': nm, 'q': q, 'w': w, 'z': zof(q, bool(nm))}, 'geometry': {'type': 'Point', 'coordinates': [r5(c.x), r5(c.y)]}})
    if q: have_q.add(q)
# catalogued star forts with no outline in OpenStreetMap: symbol only
extra = 0
for q, w in WD.items():
    if q in have_q or not (w['cls'] & STARCLS): continue
    feats.append({'type': 'Feature', 'properties': {'n': w['n'], 'q': q, 'w': w['en'], 'z': zof(q, True)}, 'geometry': {'type': 'Point', 'coordinates': [r5(w['lon']), r5(w['lat'])]}})
    extra += 1
json.dump({'type': 'FeatureCollection', 'features': feats}, open(os.path.join(ROOT, 'data', 'forts.geojson'), 'w'), separators=(',', ':'), ensure_ascii=False)
json.dump(sorted(wall_skip), open(f'{RAW}/raw13/star_wall_ways.json', 'w'))
print('candidates', len(cands), 'star outlines', len(forts), 'catalogue-only', extra, 'wall ways moved', len(wall_skip),
      'size', os.path.getsize(os.path.join(ROOT, 'data', 'forts.geojson')))
