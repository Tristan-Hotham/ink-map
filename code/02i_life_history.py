"""History layers for countryside and town life (js/ink-life.js), from the sister data studies.

Inputs (read in place; see each study's README for sources and licences):
  roman-roads/data/roads.geojson.gz      Itiner-e roads of the Roman Empire (de Soto et al. 2025), CC BY 4.0
  pilgrim-roads/data/routes.json, routes.csv   pilgrim route relations from OpenStreetMap, ODbL 1.0
  every-battle/data/battles.csv          battles from Wikidata, CC0
  ghost-towns/data/england_dmv.csv       England's deserted medieval villages (Beresford's Lost Villages, Univ. of Hull), CC BY-NC-SA 4.0
  ghost-towns/data/ghost_towns.csv       ghost towns and abandoned places from Wikidata, CC0
  holy-islands/data/houses.csv           monasteries, abbeys, priories and convents from Wikidata, CC0 (only those the heritage layer does not draw)
  world-shipwrecks/data/wrecks.csv       wrecks from Wikidata only (sources 0 to 2; Wikipedia list rows and AWOIS left out), CC0
Outputs: data/life/*.json (GeoJSON ; small, simplified, loaded by the page only when zoomed in far enough) and data/life/stats.json.
"""
import gzip, json, os, math
import pandas as pd
from shapely.geometry import LineString, shape, mapping
STUDIES = os.environ.get('INK_STUDIES', '/home/claude/studies')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'life'); os.makedirs(OUT, exist_ok=True)
stats = {}


def r4(v):
    return round(float(v), 4)


def r3(v):
    return round(float(v), 3)


def write(name, feats):
    p = os.path.join(OUT, name)
    with open(p, 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, ensure_ascii=False, separators=(',', ':'))
    stats[name] = {'features': len(feats), 'bytes': os.path.getsize(p)}
    print(name, len(feats), os.path.getsize(p))


def roman():
    g = json.load(gzip.open(os.path.join(STUDIES, 'roman-roads/data/roads.geojson.gz')))
    feats = []
    for f in g['features']:
        p = f['properties']; geom = shape(f['geometry']).simplify(0.004, preserve_topology=False)
        if geom.is_empty or geom.length == 0:
            continue
        nm = p.get('name') or ''
        nm = nm if isinstance(nm, str) and nm.lower().startswith('via ') else ''
        lines = [geom] if geom.geom_type == 'LineString' else list(geom.geoms)
        for ln in lines:
            cs = [[r3(x), r3(y)] for x, y in ln.coords]
            if len(cs) >= 2:
                feats.append({'type': 'Feature', 'properties': {'c': 1 if p.get('certainty') == 'Certain' else 0, 'n': nm}, 'geometry': {'type': 'LineString', 'coordinates': cs}})
    write('roman_roads.json', feats)


def pilgrim():
    R = json.load(open(os.path.join(STUDIES, 'pilgrim-roads/data/routes.json')))
    meta = pd.read_csv(os.path.join(STUDIES, 'pilgrim-roads/data/routes.csv'))
    names = {str(r.osm_relation): (r.name_en if isinstance(r.name_en, str) and r.name_en else r['name'] if isinstance(r['name'], str) else '') for _, r in meta.iterrows()}
    sc = R.get('scale', 10000.0); feats = []
    for rid, lines in R['lines'].items():
        for enc in lines:
            x, y = enc[0], enc[1]; cs = [[x / sc, y / sc]]
            for i in range(2, len(enc) - 1, 2):
                x += enc[i]; y += enc[i + 1]; cs.append([x / sc, y / sc])
            if len(cs) < 2:
                continue
            ln = LineString(cs).simplify(0.002)
            c2 = [[r3(a), r3(b)] for a, b in ln.coords]
            if len(c2) >= 2:
                feats.append({'type': 'Feature', 'properties': {'n': names.get(rid, '')[:60]}, 'geometry': {'type': 'LineString', 'coordinates': c2}})
    write('pilgrim_routes.json', feats)


def heritage_battles():
    # battlefields the heritage layer already draws with crossed swords (data/heritage, Wikidata): those get only their year here
    import glob
    hd = os.path.join(ROOT, 'data', 'heritage'); idx = json.load(open(os.path.join(hd, 'index.json')))
    bi = [i for i, n in enumerate(idx['icons']) if n == 'battle']; qs = set()
    for f in glob.glob(os.path.join(hd, '*_*.json')):
        for r in json.load(open(f)):
            if r[2] in bi and len(r) > 5 and r[5]:
                qs.add('Q%d' % r[5])
    return qs


def battles():
    have = heritage_battles(); stats['battles_heritage_overlap'] = 0
    b = pd.read_csv(os.path.join(STUDIES, 'every-battle/data/battles.csv'))
    b = b[b.lat.notna() & b.lon.notna() & b.label.notna()]
    feats = []
    for _, r in b.iterrows():
        sl = r.sitelinks if r.sitelinks == r.sitelinks else 0
        z = 6 if sl >= 30 else 7 if sl >= 15 else 8.5 if sl >= 6 else 10 if sl >= 2 else 11.5
        y = r.year_text if isinstance(r.year_text, str) else ''
        h = 1 if r.qid in have else 0; stats['battles_heritage_overlap'] += h
        feats.append({'type': 'Feature', 'properties': {'n': str(r.label)[:70], 'y': y.replace('BCE', 'BC'), 'q': r.qid, 'z': z, 'h': h}, 'geometry': {'type': 'Point', 'coordinates': [r3(r.lon), r3(r.lat)]}})
    feats.sort(key=lambda f: f['properties']['z'])
    write('battles.json', feats)


def lost():
    feats = []
    d = pd.read_csv(os.path.join(STUDIES, 'ghost-towns/data/england_dmv.csv'))
    d = d[d.lat.notna() & d.lon.notna()]
    for _, r in d.iterrows():
        feats.append({'type': 'Feature', 'properties': {'n': str(r['name'])[:60], 's': 'b', 'q': ''}, 'geometry': {'type': 'Point', 'coordinates': [r4(r.lon), r4(r.lat)]}})
    nb = len(feats)
    g = pd.read_csv(os.path.join(STUDIES, 'ghost-towns/data/ghost_towns.csv'))
    g = g[g.lat.notna() & g.lon.notna() & (g.scope == 'ghost') & (g.duplicate_of_beresford != True)]
    for _, r in g.iterrows():
        feats.append({'type': 'Feature', 'properties': {'n': str(r['name'])[:60], 's': 'w', 'q': r.wikidata}, 'geometry': {'type': 'Point', 'coordinates': [r4(r.lon), r4(r.lat)]}})
    stats['lost_beresford'] = nb; stats['lost_wikidata'] = len(feats) - nb
    write('lost_villages.json', feats)


def wrecks():
    w = pd.read_csv(os.path.join(STUDIES, 'world-shipwrecks/data/wrecks.csv'), low_memory=False)
    w = w[w.source.isin([0, 1, 2]) & w.lat.notna() & w.lon.notna() & w.name.notna()]
    w = w[~w.name.str.lower().str.startswith('unnamed') & ~w.name.str.lower().str.startswith('unknown')]
    feats = []
    for _, r in w.iterrows():
        sl = r.sitelinks if r.sitelinks == r.sitelinks else 0
        z = 7 if sl >= 3 else 8.5 if sl >= 1 else 10.5
        y = str(int(r.year)) if r.year == r.year else ''
        feats.append({'type': 'Feature', 'properties': {'n': str(r['name'])[:50], 'y': y, 'q': r['id'], 'z': z}, 'geometry': {'type': 'Point', 'coordinates': [r3(r.lon), r3(r.lat)]}})
    feats.sort(key=lambda f: f['properties']['z'])
    write('wrecks.json', feats)


def heritage_qids():
    import glob
    qs = set()
    for f in glob.glob(os.path.join(ROOT, 'data', 'heritage', '*_*.json')):
        for r in json.load(open(f)):
            if len(r) > 5 and r[5]:
                qs.add('Q%d' % r[5])
    return qs


def monasteries():
    h = pd.read_csv(os.path.join(STUDIES, 'holy-islands/data/houses.csv'))
    have = heritage_qids()
    h = h[~h.wikidata.isin(have) & h.lat.notna() & h.lon.notna() & h.label.notna()]
    feats = []
    for _, r in h.iterrows():
        gone = 1 if (r.former_or_ruin_class == 1 or r.dissolved == r.dissolved) else 0
        sl = r.sitelinks if r.sitelinks == r.sitelinks else 0
        feats.append({'type': 'Feature', 'properties': {'n': str(r.label)[:60], 'k': str(r.kind), 'd': gone, 'q': r.wikidata, 'z': 9 if sl >= 4 else 10.5},
                      'geometry': {'type': 'Point', 'coordinates': [r3(r.lon), r3(r.lat)]}})
    stats['monasteries_dissolved'] = sum(f['properties']['d'] for f in feats)
    write('monasteries.json', feats)


if __name__ == '__main__':
    roman(); pilgrim(); battles(); lost(); wrecks(); monasteries()
    json.dump(stats, open(os.path.join(OUT, 'stats.json'), 'w'), indent=1)
