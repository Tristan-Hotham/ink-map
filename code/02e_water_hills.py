"""River and lake names from Natural Earth, and named hills from Wikidata, for the ink map.

Inputs (read in place)
  RAW/raw3/borders/ne_10m_rivers_lake_centerlines.geojson   Natural Earth 1:10m rivers and lake centrelines (public domain)
  RAW/raw3/borders/ne_10m_lakes.geojson (+ _europe, _north_america)   Natural Earth 1:10m lakes (public domain)
  RAW/raw10/hills_mountains.tsv                              Wikidata hills, mountains and summits with elevation (CC0)
Outputs
  data/rivers.geojson        named river lines, merged by name and simplified; props n (name), z (first zoom for the name)
  data/lakes.geojson         a label point inside each named lake; props n, z
  data/hills/{x}_{y}.json    named hills on a zoom-6 grid: rows [lon*1e5, lat*1e5, elevation m (0 if unknown), first zoom*10, name]
  data/hills/index.json
"""
import collections, csv, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, merc, dump
from shapely.geometry import shape, mapping, MultiLineString, LineString
from shapely.ops import linemerge

RAW = os.environ.get('INK_RAW', '/home/claude/newdata')
NE = os.path.join(RAW, 'raw3', 'borders')
clean = lambda s: (s or '').replace('–', '-').replace('—', '-').strip()
summary = {}

# ---- rivers: merge the pieces of each named river, simplify, keep the zoom Natural Earth suggests for its label
riv = json.load(open(os.path.join(NE, 'ne_10m_rivers_lake_centerlines.geojson')))['features']
groups = collections.defaultdict(list); zmin = {}
for f in riv:
    p = f['properties']; n = clean(p.get('name_en') or p.get('name'))
    if not n or not f['geometry']: continue
    g = shape(f['geometry'])
    groups[n].extend(list(g.geoms) if g.geom_type == 'MultiLineString' else [g])
    zmin[n] = min(zmin.get(n, 99), float(p.get('min_label') or p.get('min_zoom') or 6))
out = []
for n, ls in groups.items():
    m = linemerge(MultiLineString(ls)); m = m.simplify(0.01, preserve_topology=False)
    if m.is_empty or m.length < 0.3: continue
    # a name every so often along the river: MapLibre repeats it by symbol spacing, so each line is kept whole
    z = max(3.0, min(8.0, zmin[n] - 0.5))
    geom = mapping(m)
    geom = json.loads(json.dumps(geom, default=list))
    def rnd(c): return [round(c[0], 3), round(c[1], 3)]
    if geom['type'] == 'LineString': geom['coordinates'] = [rnd(c) for c in geom['coordinates']]
    else: geom['coordinates'] = [[rnd(c) for c in l] for l in geom['coordinates']]
    out.append({'type': 'Feature', 'properties': {'n': n, 'z': z}, 'geometry': geom})
dump({'type': 'FeatureCollection', 'features': out}, os.path.join(DATA, 'rivers.geojson'))
summary['rivers'] = len(out)

# ---- lakes: one label point well inside each named lake
lk, seen = [], set()
for fn in ('ne_10m_lakes.geojson', 'ne_10m_lakes_europe.geojson', 'ne_10m_lakes_north_america.geojson'):
    p = os.path.join(NE, fn)
    if not os.path.exists(p): continue
    for f in json.load(open(p))['features']:
        pr = f['properties']; n = clean(pr.get('name_en') or pr.get('name'))
        if not n or not f['geometry']: continue
        g = shape(f['geometry']); c = g.representative_point()
        k = (n, round(c.x), round(c.y))
        if k in seen: continue
        seen.add(k)
        z = max(3.5, min(8.5, float(pr.get('min_label') or 7) - 0.5))
        lk.append({'type': 'Feature', 'properties': {'n': n, 'z': z}, 'geometry': {'type': 'Point', 'coordinates': [round(c.x, 4), round(c.y, 4)]}})
dump({'type': 'FeatureCollection', 'features': lk}, os.path.join(DATA, 'lakes.geojson'))
summary['lakes'] = len(lk)

# ---- hills: every named hill in Britain and Ireland; elsewhere those with two or more Wikipedia articles, or high ones
uk = lambda lon, lat: -11 < lon < 2 and 49.8 < lat < 61
rows = collections.defaultdict(list); seen = set(); n_uk = n_all = 0
for r in csv.DictReader(open(os.path.join(RAW, 'raw10', 'hills_mountains.tsv')), delimiter='\t'):
    m = re.search(r'POINT\(([-\d.e]+) ([-\d.e]+)\)', r['?coord'] or '')
    if not m or r['?item'] in seen: continue
    seen.add(r['?item'])
    lon, lat = float(m.group(1)), float(m.group(2))
    name = clean(re.sub(r'"?@[A-Za-z-]+$', '', r['?label'].strip()).strip('"'))
    if not name or re.fullmatch(r'Q\d+', name): continue
    try: ele = round(float(r['?elev'])) if r['?elev'] else 0
    except ValueError: ele = 0
    if ele < 0 or ele > 9000: ele = 0
    sl = int(r['?sl'] or 0)
    if uk(lon, lat): z = 10.0; n_uk += 1
    elif sl >= 2 or (ele >= 1500 and sl >= 1):
        z = round(max(10.0, min(12.5, 12.5 - 0.6 * math.log2(1 + sl) - ele / 4000)), 1)
    else: continue
    n_all += 1
    x, y = merc(lon, lat)
    rows[(int(x * 64), int(min(0.9999, y) * 64))].append([round(lon * 1e5), round(lat * 1e5), ele, round(z * 10), name[:40]])
HD = os.path.join(DATA, 'hills'); os.makedirs(HD, exist_ok=True)
for fn in os.listdir(HD): os.remove(os.path.join(HD, fn))
for (bx, by), rr in rows.items():
    rr.sort(key=lambda r: (r[3], -r[2]))
    json.dump(rr, open(os.path.join(HD, f'{bx}_{by}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({'grid': 6, 'tiles': sorted(f'{a}_{b}' for a, b in rows)}, open(os.path.join(HD, 'index.json'), 'w'), separators=(',', ':'))
sizes = [os.path.getsize(os.path.join(HD, f)) for f in os.listdir(HD)]
summary.update(hills=n_all, hills_uk_ie=n_uk, hills_files=len(sizes), hills_mb=round(sum(sizes) / 1e6, 1), hills_max_file_kb=max(sizes) // 1024)
fs = os.path.join(DATA, 'features_summary.json')
S = json.load(open(fs)) if os.path.exists(fs) else {}
S['water_hills'] = summary
json.dump(S, open(fs, 'w'), indent=1)
for fn in ('rivers', 'lakes'): print(fn, os.path.getsize(os.path.join(DATA, fn + '.geojson')) // 1024, 'KB')
print(summary)
