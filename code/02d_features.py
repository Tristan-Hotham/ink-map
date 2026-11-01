"""Feature layers for the ink map: landmarks, heritage, famous peaks, linear monuments and decoration.

Inputs (read in place)
  code/02c_curated.py                     hand-compiled landmarks, peaks, walls, animals, whales, ports, hubs, balloons
  STUDIES/architecture-styles/data/buildings.csv.gz   Wikidata buildings with type and sitelinks (CC0)
  STUDIES/tallest-buildings/data/points.json          Wikidata tall buildings with heights (CC0)
  STUDIES/lighthouses/data/lighthouses.csv            Wikidata lighthouses (CC0)
  RAW/raw8/battles/wikidata_battles.tsv               Wikidata battles (CC0)
  RAW/raw2/monasteries.tsv                            Wikidata monasteries (CC0)
  RAW/raw10/*.tsv (optional)                          Wikidata heritage queries from /home/claude/xfer/tools/ink_sparql
  RAW/raw10/linear_monuments_overpass.json (optional)  OpenStreetMap walls, dykes and aqueducts via Overpass (ODbL)
  RAW/raw10/parks.tsv, government.tsv, palaces.tsv    Wikidata parks, parliaments and town halls, palaces (CC0)
  STUDIES/ships-before-steam/data/passages.geojson    CLIWOC ship tracks 1750 to 1850 (sea lanes for the ships)
  GEO/ne_50m_land.geojson                             Natural Earth land (keeps ships and whales at sea)
Outputs
  data/landmarks.geojson, data/heritage/{x}_{y}.json (zoom-6 tiles) and index.json, data/peaks_famous.geojson, data/walls.geojson, data/decor.geojson,
  data/features_summary.json
"""
import collections, csv, gzip, importlib.util, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, DATA, GEO, dump as _dump


def dump(obj, path):
    # visible names never carry en or em dashes (house style); Wikipedia titles are reached through their hyphen redirects
    for f in obj['features']:
        for k, v in f['properties'].items():
            if isinstance(v, str): f['properties'][k] = v.replace('\u2013', '-').replace('\u2014', '-')
    _dump(obj, path)
from shapely.geometry import shape, Point
from shapely.prepared import prep
from shapely.ops import unary_union

STUDIES = os.environ.get('INK_STUDIES', '/home/claude/studies')
RAW = os.environ.get('INK_RAW', '/home/claude/newdata')
spec = importlib.util.spec_from_file_location('cur', os.path.join(ROOT, 'code', '02c_curated.py'))
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
r4 = lambda v: round(v, 4)
feat = lambda lon, lat, p: {'type': 'Feature', 'properties': p, 'geometry': {'type': 'Point', 'coordinates': [r4(lon), r4(lat)]}}
land = prep(unary_union([shape(f['geometry']) for f in json.load(open(os.path.join(GEO, 'ne_50m_land.geojson')))['features']]))
summary = {}

# ---- landmarks (bespoke drawings for the famous ones)
lm = [feat(lon, lat, {'n': n, 'i': ic, 'z': z, 'w': w}) for n, lon, lat, ic, z, w in C.LANDMARKS]
dump({'type': 'FeatureCollection', 'features': lm}, os.path.join(DATA, 'landmarks.geojson'))
summary['landmarks'] = len(lm)
LM_NAMES = {n.lower() for n, *_ in C.LANDMARKS}

# ---- famous peaks with snow caps
pk = [feat(lon, lat, {'n': n, 'e': e, 'z': z, 'w': w}) for n, lon, lat, e, z, w in C.PEAKS]
hp = os.path.join(RAW, 'raw10', 'highest_points.tsv')
if os.path.exists(hp):
    seen = {round(f['geometry']['coordinates'][0], 1) * 1000 + round(f['geometry']['coordinates'][1], 1) for f in pk}
    for row in csv.DictReader(open(hp), delimiter='\t'):
        m = re.search(r'POINT\(([-\d.]+) ([-\d.]+)\)', row.get('?coord', '') or row.get('coord', ''))
        if not m: continue
        lon, lat = float(m.group(1)), float(m.group(2))
        key = round(lon, 1) * 1000 + round(lat, 1)
        try: e = round(float(row.get('?elev') or row.get('elev')))
        except Exception: continue
        if key in seen or e < 300: continue
        seen.add(key)
        name = (row.get('?peakLabel') or row.get('peakLabel') or '').strip('"').split('"@')[0]
        z = 6.5 if (row.get('?areaType') or '').strip('"') == 'country' else 8
        pk.append(feat(lon, lat, {'n': name, 'e': e, 'z': z, 'w': (row.get('?enwiki') or '').strip('"').split('"@')[0]}))
dump({'type': 'FeatureCollection', 'features': pk}, os.path.join(DATA, 'peaks_famous.geojson'))
summary['famous_peaks'] = len(pk)

# ---- linear monuments
walls = [{'type': 'Feature', 'properties': {'n': n, 'z': z, 'w': w, 'k': 'wall', 'src': 'approximate course, hand-drawn'},
          'geometry': {'type': 'LineString', 'coordinates': [[r4(a), r4(b)] for a, b in pts]}} for n, z, w, pts in C.WALLS]
lmg = os.path.join(RAW, 'raw10', 'linear_monuments_overpass.json')
if os.path.exists(lmg):
    # OpenStreetMap ways (ODbL): grouped by name, merged, simplified, tiny fragments dropped
    from shapely.geometry import LineString, MultiLineString
    from shapely.ops import linemerge
    groups = collections.defaultdict(list)
    for e in json.load(open(lmg))['elements']:
        if e['type'] != 'way' or len(e.get('geometry') or []) < 2: continue
        t = e.get('tags', {}); nm = t.get('name:en') or t.get('name')
        if not nm: continue
        if re.search(r'Great Wall', nm): nm = 'Great Wall of China'
        groups[(nm, t.get('wikidata', ''))].append(LineString([(g['lon'], g['lat']) for g in e['geometry']]))
    BIG = {"Great Wall of China": 3.5, "Hadrian's Wall": 6.5, 'Antonine Wall': 7, "Offa's Dyke": 7, "Wat's Dyke": 8.5, "Trajan's Wall": 7.5,
           'Aurelian Walls': 9, "Grim's Ditch": 9, "Devil's Dyke": 9.5, 'London Wall': 10.5}
    osm_walls = []
    for (nm, qid), ls in groups.items():
        g = linemerge(MultiLineString(ls)) if len(ls) > 1 else ls[0]
        parts = list(g.geoms) if g.geom_type == 'MultiLineString' else [g]
        tol = 0.004 if nm == 'Great Wall of China' else 0.0004
        keep = [q.simplify(tol) for q in parts if q.length * 111 > (2.0 if nm == 'Great Wall of China' else 0.15)]
        if not keep: continue
        kind = 'aqueduct' if re.search(r'aque|acque|acued|Wasserleitung|Υδραγωγ', nm, re.I) else 'dyke' if re.search(r'dyke|ditch|dike', nm, re.I) else 'wall'
        z = BIG.get(nm, 10.5)
        coords = [[[r4(a), r4(b)] for a, b in q.coords] for q in keep]
        walls.append({'type': 'Feature', 'properties': {'n': nm, 'z': z, 'w': '', 'q': qid, 'k': kind, 'src': 'OpenStreetMap'},
                      'geometry': {'type': 'MultiLineString', 'coordinates': coords}})
    have = {w['properties']['n'] for w in walls if w['properties'].get('src') == 'OpenStreetMap'}
    walls = [w for w in walls if w['properties'].get('src') == 'OpenStreetMap' or w['properties']['n'] not in have]
    summary['walls_osm'] = len(have)
dump({'type': 'FeatureCollection', 'features': walls}, os.path.join(DATA, 'walls.geojson'))
summary['walls'] = len(walls)

# ---- heritage points (type icons), min zoom from fame (sitelinks)
TYPE = [(r'parliament|legislat|capitol|senate|national assembly|official residence|presidential|seat of the', 'parliament'),
        (r'town hall|city hall|rathaus|courthouse|guildhall|opera|theatre|theater', 'cityhall'),
        (r'national park', 'natpark'), (r'nature reserve|country park|regional park', 'natpark'),
        (r'botanical|\bpark\b|garden|royal park|urban park', 'park'),
        (r'hillfort|hill fort', 'hillfort'), (r'pyramid', 'pyramid'),
        (r'cathedral|basilica|minster', 'cathedral'), (r'mosque', 'mosque'), (r'pagoda|stupa', 'pagoda'),
        (r'temple|shrine|kofun', 'temple'), (r'synagogue', 'synagogue'), (r'church|chapel', 'church'),
        (r'monastery|abbey|priory|convent|friary', 'monastery'), (r'castle|fortress|fort\b|citadel|tower house|keep', 'castle'),
        (r'palace|château|chateau|residenz', 'palace'), (r'manor|country house|stately|historic house|villa', 'mansion'),
        (r'lighthouse', 'lighthouse'), (r'windmill|watermill', 'windmill'), (r'bridge|viaduct|aqueduct', 'bridge'),
        (r'skyscraper', 'skyscraper'), (r'tower', 'tower'), (r'ruin|archaeological|ancient city', 'ruins'), (r'stone circle|henge', 'stone_circle'),
        (r'standing stone|menhir|megalith|dolmen|stone row', 'standing_stone'), (r'cairn', 'cairn'), (r'barrow|tumulus', 'barrow'),
        (r'monument|statue|memorial|obelisk', 'monument'), (r'battle', 'battle'),
        (r'waterfall', 'waterfall'), (r'cave', 'cave'), (r'spring', 'spring'), (r'mountain pass|\bpass\b', 'pass'),
        (r'gorge|canyon', 'gorge'), (r'glacier', 'glacier_mark')]
icon_of = lambda t: next((ic for pat, ic in TYPE if re.search(pat, t or '', re.I)), None)
zoom_of = lambda sl, base=12.5: round(max(6.0, min(base, base - 1.45 * math.log2(1 + (sl or 0)))), 1)
pts, seen = [], set()


def add(lon, lat, name, ic, sl, qid='', kind='', base=12.5):
    if not ic or not name: return
    name = re.sub(r'"?@[A-Za-z-]+$', '', name.strip()).strip('"').replace('\u2013', '-').replace('\u2014', '-').replace('--', '-')
    k = (round(lon, 3), round(lat, 3), ic)
    if k in seen or (qid and qid in seen): return
    if name.lower() in LM_NAMES or re.fullmatch(r'Q\d+', name): return
    # campaigns and air or sea battles over a whole region carry one arbitrary point in Wikidata: leave them out
    if ic == 'battle' and re.match(r'Battle of (Britain|the Atlantic|France|Normandy|the Bulge|Berlin|Germany|Moscow|Stalingrad|the Mediterranean|the Pacific)$', name): return
    seen.add(k); seen.add(qid)
    p = {'n': name[:60], 'i': ic, 'z': zoom_of(sl, base), 'q': qid}
    if kind: p['t'] = kind
    pts.append(feat(lon, lat, p))


with gzip.open(os.path.join(STUDIES, 'architecture-styles', 'data', 'buildings.csv.gz'), 'rt') as fh:
    for r in csv.DictReader(fh):
        ic = icon_of(r['type'])
        if ic: add(float(r['lon']), float(r['lat']), r['label'], ic, int(r['sitelinks'] or 0), r['qid'], r['type'])
tb = json.load(open(os.path.join(STUDIES, 'tallest-buildings', 'data', 'points.json')))
for lat, lon, h, yr, *_rest in tb:
    name, qid, sl = _rest[3], _rest[6], _rest[8]
    if h and h >= 150:
        add(lon, lat, name, 'skyscraper', sl + (10 if h >= 300 else 0), qid, f'tall building, {round(h)} m', base=11.5)
for r in csv.DictReader(open(os.path.join(STUDIES, 'lighthouses', 'data', 'lighthouses.csv'))):
    add(float(r['lon']), float(r['lat']), r['name'], 'lighthouse', int(r['sitelinks'] or 0), r['qid'], 'lighthouse')
coord = lambda s: re.search(r'POINT\(([-\d.e]+) ([-\d.e]+)\)', s or '')
lab = lambda s: re.sub(r'"?@[A-Za-z-]+$', '', (s or '').strip()).strip('"')
for r in csv.DictReader(open(os.path.join(RAW, 'raw8', 'battles', 'wikidata_battles.tsv')), delimiter='\t'):
    m = coord(r['?coord'])
    if m: add(float(m.group(1)), float(m.group(2)), lab(r['?bL']), 'battle', int(r['?sl'] or 0), r['?b'].rsplit('/', 1)[-1].strip('>'), 'battlefield', base=12)
for r in csv.DictReader(open(os.path.join(RAW, 'raw2', 'monasteries.tsv')), delimiter='\t'):
    m = coord(r['?coord'])
    if m: add(float(m.group(1)), float(m.group(2)), lab(r['?l']), 'monastery', int(r['?sl'] or 0), r['?m'].rsplit('/', 1)[-1].strip('>'), 'monastery')
# raw10 Wikidata heritage queries (when present)
R10 = os.path.join(RAW, 'raw10'); raw10_used = []
for fn in ('world_heritage', 'landmarks', 'government', 'palaces', 'parks', 'castles', 'houses', 'cathedrals_abbeys', 'churches', 'churches_ukie', 'prehistoric', 'ruins', 'ruins_ukie', 'natural'):
    p = os.path.join(R10, fn + '.tsv')
    if not os.path.exists(p): continue
    raw10_used.append(fn)
    for r in csv.DictReader(open(p), delimiter='\t'):
        g = lambda k: r.get('?' + k, r.get(k, ''))
        m = coord(g('coord'))
        if not m: continue
        t = lab(g('clsLabel')) or lab(g('types'))
        if fn == 'government' and re.search(r'seat of government', t): continue          # whole towns, not buildings
        if fn == 'landmarks' and re.search(r'\b(city|town|village|municipality|commune|region|island|mountain|river|lake|country|state)\b', t): continue
        ic = icon_of(t) or {'world_heritage': 'ruins', 'palaces': 'palace', 'parks': 'park'}.get(fn)
        try: sl = int(lab(g('sl')) or 0)
        except ValueError: sl = 0
        if fn == 'world_heritage': sl += 25
        if fn in ('government', 'palaces') and ic in ('parliament', 'palace'): sl += 6     # prominent in capitals
        add(float(m.group(1)), float(m.group(2)), lab(g('label')), ic, sl, g('item').rsplit('/', 1)[-1].strip('>'), t)
# thinning: everything in Britain and Ireland; elsewhere, the commoner kinds need more Wikipedia articles (lower min zoom)
NEED = {'park': 9.7, 'cityhall': 9.7,'church': 9.7, 'spring': 9.0, 'glacier_mark': 9.0, 'pass': 9.7, 'cave': 9.7, 'gorge': 9.7, 'waterfall': 9.7, 'ruins': 9.7,
        'mansion': 9.7, 'palace': 9.7, 'castle': 10.3, 'monastery': 10.3, 'battle': 10.3}
uk = lambda c: -11 < c[0] < 2 and 49.8 < c[1] < 61
pts = [f for f in pts if uk(f['geometry']['coordinates']) or f['properties']['z'] <= NEED.get(f['properties']['i'], 11.1)]
pts.sort(key=lambda f: f['properties']['z'])
# ship as tiles on a zoom-6 grid, read by the ink worker: rows [lon*1e5, lat*1e5, icon index, min zoom*10, name, Wikidata number]
ICONS = sorted({f['properties']['i'] for f in pts})
HT = os.path.join(DATA, 'heritage'); os.makedirs(HT, exist_ok=True)
for fn in os.listdir(HT): os.remove(os.path.join(HT, fn))
from common import merc
bins = collections.defaultdict(list)
for f in pts:
    lon, lat = f['geometry']['coordinates']; x, y = merc(lon, lat)
    p = f['properties']; q = p.get('q', '')
    bins[(int(x * 64), int(min(0.9999, y) * 64))].append([round(lon * 1e5), round(lat * 1e5), ICONS.index(p['i']), round(p['z'] * 10), p['n'][:40],
                                                          int(q[1:]) if q[1:].isdigit() else 0])
for (bx, by), rows in bins.items():
    json.dump(rows, open(os.path.join(HT, f'{bx}_{by}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({'icons': ICONS, 'grid': 6, 'tiles': sorted(f'{a}_{b}' for a, b in bins)}, open(os.path.join(HT, 'index.json'), 'w'), separators=(',', ':'))
sizes = [os.path.getsize(os.path.join(HT, f)) for f in os.listdir(HT)]
summary['heritage_files'] = len(sizes); summary['heritage_mb'] = round(sum(sizes) / 1e6, 1); summary['heritage_max_file_kb'] = max(sizes) // 1024
import collections
summary['heritage'] = len(pts)
summary['heritage_by_icon'] = dict(collections.Counter(f['properties']['i'] for f in pts).most_common())
summary['raw10_used'] = raw10_used

# ---- decoration: animals, whales, serpents, ships, balloons, airport hubs
dec = []
for sp, ic, lon, lat, rng in C.ANIMALS:
    dec.append(feat(lon, lat, {'k': 'animal', 'i': 'a_' + ic, 'n': sp, 'd': 'native range: ' + rng, 'h': 0}))
for sp, ic, lon, lat, place, spout in C.WHALES:
    assert not land.contains(Point(lon, lat)), sp + place
    dec.append(feat(lon, lat, {'k': 'whale', 'i': 'a_' + ic + ('_s' if spout else ''), 'n': sp, 'd': 'gathers here: ' + place, 'h': 0}))
for n, lon, lat in C.SERPENTS:
    dec.append(feat(lon, lat, {'k': 'serpent', 'i': 'a_serpent', 'n': n, 'd': 'a decoration in the manner of old maps; not a real animal', 'h': 0}))
for n, lon, lat in C.BALLOONS:
    dec.append(feat(lon, lat, {'k': 'balloon', 'i': 'balloon', 'n': 'Hot-air balloon over ' + n, 'd': 'decorative', 'h': 0}))
for n, lon, lat, hd, w in C.HUBS:
    # the flying machine sits a little way off the runway end, climbing out on the runway heading
    a = math.radians(hd); dlon = 0.03 * math.sin(a) / math.cos(math.radians(lat)); dlat = 0.03 * math.cos(a)
    dec.append(feat(lon + dlon, lat + dlat, {'k': 'flyer', 'i': 'ornithopter', 'n': n, 'd': 'one of the busiest airports, drawn as a flying machine taking off', 'h': hd, 'w': w}))
# ships: leave each port along the CLIWOC passages that start or end near it
P = json.load(open(os.path.join(STUDIES, 'ships-before-steam', 'data', 'passages.geojson')))['features']


def hav(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1]); dl = math.radians(b[0] - a[0])
    return 6371 * 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dl / 2) ** 2))


def bearing(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1]); dl = math.radians(b[0] - a[0])
    return (math.degrees(math.atan2(math.sin(dl) * math.cos(la2), math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(dl))) + 360) % 360


tracks = []
for f in P:
    g = f['geometry']
    lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
    for l in lines:
        if len(l) >= 3: tracks.append(l)
ships = 0
for port, lon, lat, fb in C.PORTS:
    out = []
    for l in tracks:
        for seq in (l, l[::-1]):
            if hav(seq[0], (lon, lat)) < 350:
                # walk outward 250 to 700 km along the track; the ship sits there, heading onward
                d = 0
                for a, b in zip(seq, seq[1:]):
                    d += hav(a, b)
                    if d > 250:
                        if not land.contains(Point(b[0], b[1])) and not land.contains(Point(a[0], a[1])):
                            out.append((a, b))
                        break
    picks = []
    for a, b in out:
        if all(hav(a, q[0]) > 250 for q in picks): picks.append((a, b))
        if len(picks) >= 2: break
    if not picks:   # no logbook track (Pacific ports): sail out on the fallback heading
        for dist in (60, 120, 200):
            la = lat + dist / 111 * math.cos(math.radians(fb)); lo = lon + dist / 111 * math.sin(math.radians(fb)) / math.cos(math.radians(lat))
            if not land.contains(Point(lo, la)):
                picks.append(((lo, la), (lo + 0.1 * math.sin(math.radians(fb)), la + 0.1 * math.cos(math.radians(fb))))); break
    for k, (a, b) in enumerate(picks):
        dec.append(feat(a[0], a[1], {'k': 'ship', 'i': 'ship', 'n': f'Sailing ship out of {port}', 'd': 'on a sea lane from CLIWOC logbooks, 1750 to 1850' if out else 'leaving harbour',
                                     'h': round(bearing(a, b)), 'z0': 2.5 if k == 0 else 3.5}))
        ships += 1
    # a ship close in, just outside the harbour, on its way out
    la = lat + 12 / 111 * math.cos(math.radians(fb)); lo = lon + 12 / 111 * math.sin(math.radians(fb)) / math.cos(math.radians(lat))
    if not land.contains(Point(lo, la)):
        dec.append(feat(lo, la, {'k': 'ship', 'i': 'ship', 'n': f'Sailing ship leaving {port}', 'd': 'leaving harbour', 'h': fb, 'z0': 6.5})); ships += 1
dump({'type': 'FeatureCollection', 'features': dec}, os.path.join(DATA, 'decor.geojson'))
summary['decor'] = dict(collections.Counter(f['properties']['k'] for f in dec)); summary['ships'] = ships
json.dump(summary, open(os.path.join(DATA, 'features_summary.json'), 'w'), indent=1)
for fn in ('landmarks', 'peaks_famous', 'walls', 'decor'):
    print(fn, os.path.getsize(os.path.join(DATA, fn + '.geojson')) // 1024, 'KB')
print(json.dumps(summary)[:800])
