"""Landmarks only (round 4): rebuild data/landmarks.geojson from the LANDMARKS list in code/02c_curated.py, exactly as
code/02d_features.py does, and drop from the heritage grid any row named like a landmark (as 02d does when it builds the grid),
so a monument with its own drawing is never drawn twice. Lets the landmark list grow without rerunning the whole of 02d
(whose heritage inputs are large).
Outputs: data/landmarks.geojson; data/heritage/{x}_{y}.json rewritten only where a row is dropped.
"""
import glob, importlib.util, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, DATA, dump as _dump

spec = importlib.util.spec_from_file_location('cur', os.path.join(ROOT, 'code', '02c_curated.py'))
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)


def dump(obj, path):
    for f in obj['features']:
        for k, v in f['properties'].items():
            if isinstance(v, str): f['properties'][k] = v.replace('–', '-').replace('—', '-')
    _dump(obj, path)


r4 = lambda v: round(v, 4)
feat = lambda lon, lat, p: {'type': 'Feature', 'properties': p, 'geometry': {'type': 'Point', 'coordinates': [r4(lon), r4(lat)]}}
lm = [feat(lon, lat, {'n': n, 'i': ic, 'z': z, 'w': w}) for n, lon, lat, ic, z, w in C.LANDMARKS]
dump({'type': 'FeatureCollection', 'features': lm}, os.path.join(DATA, 'landmarks.geojson'))
LM_NAMES = {n.lower() for n, *_ in C.LANDMARKS}
dropped = 0
for fn in sorted(glob.glob(os.path.join(DATA, 'heritage', '*_*.json'))):
    rows = json.load(open(fn))
    keep = [r for r in rows if str(r[4]).lower() not in LM_NAMES]
    if len(keep) != len(rows):
        dropped += len(rows) - len(keep)
        with open(fn, 'w') as f: json.dump(keep, f, separators=(',', ':'), ensure_ascii=False)
print('landmarks', len(lm), 'heritage rows dropped as landmarks', dropped)
