"""Light first-stage files for the map's lazily loaded layers (run after 02e/02g).

The page first loads a small file for each of these sources and swaps in the full one only when you zoom in to where the
detail shows (js/ink-map.js, LAZY):
  data/walls_major.geojson   the walls drawn before zoom 10 (Great Wall, Hadrian's Wall, the long dykes...), from walls.geojson
  data/forts_points.geojson  one point per star fort (the symbol and name further out), from forts.geojson; the outlines
                             come with the full file from zoom 10.5
  data/walls_boxes.json      the bounding box (normalised Web Mercator) of every town wall, which is all js/ink-worker.js needs
                             to leave a drawn ring wall out where a real one runs (it used to fetch the whole 5 MB file)
"""
import json, os
from common import DATA, dump, merc

w = json.load(open(os.path.join(DATA, 'walls.geojson')))
major = [f for f in w['features'] if f['properties']['z'] < 10.5]
dump({'type': 'FeatureCollection', 'features': major}, os.path.join(DATA, 'walls_major.geojson'))
f = json.load(open(os.path.join(DATA, 'forts.geojson')))
pts = [x for x in f['features'] if x['geometry']['type'] == 'Point']
dump({'type': 'FeatureCollection', 'features': pts}, os.path.join(DATA, 'forts_points.geojson'))
print('walls', len(w['features']), '->', len(major), '; forts', len(f['features']), '->', len(pts))
boxes = []
for x in w['features']:
    if x['properties'].get('k') != 'wall':
        continue
    g = x['geometry']; ls = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
    xy = [merc(c[0], c[1]) for l in ls for c in l]
    boxes.append([round(min(p[0] for p in xy), 7), round(min(p[1] for p in xy), 7), round(max(p[0] for p in xy), 7), round(max(p[1] for p in xy), 7)])
dump(boxes, os.path.join(DATA, 'walls_boxes.json'))
print('wall boxes', len(boxes))
