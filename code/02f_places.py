"""Villages and hamlets in Britain and Ireland, and named beaches worldwide, from Wikidata, to fill places the OpenStreetMap tiles leave out.
Input:  /home/claude/newdata/raw12/settlements_ukie.tsv (QLever, query in code/sparql/settlements_ukie.rq)
Input:  /home/claude/newdata/raw12/beaches.tsv (QLever, query in code/sparql/beaches.rq)
Output: data/places/{x}_{y}.json  rows [lon*1e5, lat*1e5, kind (1 village/town, 2 hamlet/suburb, 3 beach), first zoom*10, name, English Wikipedia title]
        data/places/index.json
The map's worker drops any of these whose name the OpenStreetMap tile already carries, so each place is lettered once."""
import csv, json, math, os, re, collections
SRC = '/home/claude/newdata/raw12/settlements_ukie.tsv'
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'places')
VIL = {'village', 'town', 'market town', 'small burgh', 'county town', 'township', 'human settlement', 'community', 'locality', 'townland', 'Gaeltacht'}
HAM = {'hamlet', 'suburb', 'neighborhood', 'area of London', 'inner suburb', 'housing estate', 'residential area', 'quarter', 'housing development'}
rows = []
with open(SRC, encoding='utf-8') as f:
    next(f)
    for line in f:
        p = line.rstrip('\n').split('\t')
        if len(p) < 5: continue
        m = re.match(r'POINT\(([-\d.]+) ([-\d.]+)\)', p[2]); t = re.match(r'"(.*)"@en', p[3] or '')
        nm = re.match(r'"(.*)"@en', p[1])
        if not (m and t and nm): continue
        t = t.group(1); name = nm.group(1).replace('\\"', '"')
        if t in VIL: k = 1
        elif t in HAM: k = 2
        else: continue
        if re.search(r'[,(]|\d', name) or len(name) > 28: continue
        lon, lat = float(m.group(1)), float(m.group(2))
        if not (-11 < lon < 2.2 and 49.8 < lat < 61): continue
        sl = int(re.sub(r'\D', '', p[4]) or 0)
        z = (10.5 if sl >= 4 else 11) if k == 1 else (11.5 if sl >= 3 else 12)
        rows.append([round(lon * 1e5), round(lat * 1e5), k, int(z * 10), name, ''])
# named beaches, worldwide
with open('/home/claude/newdata/raw12/beaches.tsv', encoding='utf-8') as f:
    next(f)
    for line in f:
        p = line.rstrip('\n').split('\t')
        if len(p) < 4: continue
        m = re.match(r'POINT\(([-\d.]+) ([-\d.]+)\)', p[2]); nm = re.match(r'"(.*)"@en', p[1])
        if not (m and nm): continue
        name = nm.group(1).replace('\\"', '"')
        if re.search(r'\d', name) or len(name) > 34: continue
        sl = int(re.sub(r'\D', '', p[3]) or 0)
        w = re.match(r'"(.*)"@en', p[4]).group(1) if len(p) > 4 and p[4].startswith('"') else ''
        z = 10 if sl >= 10 else 11 if sl >= 3 else 12
        rows.append([round(float(m.group(1)) * 1e5), round(float(m.group(2)) * 1e5), 3, z * 10, name, w])
# drop duplicates: the same name within 1.5 km
rows.sort(key=lambda r: (r[3], r[2]))
seen = collections.defaultdict(list); keep = []
for r in rows:
    key = r[4].lower()
    if any(abs(r[0] - q[0]) < 2300 and abs(r[1] - q[1]) < 1400 for q in seen[key]): continue
    seen[key].append(r); keep.append(r)
def tile(lon, lat, z=6):
    n = 2 ** z; x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return x, y
T = collections.defaultdict(list)
for r in keep: T['%d_%d' % tile(r[0] / 1e5, r[1] / 1e5)].append(r)
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
for k, v in T.items(): json.dump(v, open(os.path.join(OUT, k + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({'tiles': sorted(T), 'n': len(keep), 'source': 'Wikidata (CC0) via QLever'}, open(os.path.join(OUT, 'index.json'), 'w'))
print(len(rows), 'rows', len(keep), 'kept', len(T), 'tiles', collections.Counter(r[2] for r in keep))
