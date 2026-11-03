"""The lively sea (round 3): everything drawn at sea, built from open data and a few hand-placed legends.

Writes data/sea/:
  life.json      sea life on a nested grid over the open sea (whales, dolphins, flying fish, serpents, krakens, icebergs,
                 sea ice), one point per cell of 140 to 280 screen pixels at the zoom where it first appears (zoom 1 to 6),
                 each kept at every closer zoom, so the drawing only ever adds; kinds chosen by latitude and distance
                 from land (Natural Earth 1:50m land, rasterised at 0.1 degree)
  sea.geojson    named things: compass roses, islands of legend, whirlpools, ghost ships, mermaids, fishing fleets on
                 real banks, pirate ships at the reported piracy hotspots (and a few hand-placed historic ones),
                 notable shipwrecks (Wikidata, NOAA AWOIS) with treasure chests on the sailing-era ones, the kraken
  rhumb.geojson  portolan rhumb lines from the compass roses, straight on the Mercator chart (as real rhumb lines are),
                 clipped to the sea
  lanes.json     merchant passages from CLIWOC logbooks (1750 to 1854) for the ships that sail across the map
  wind.json      prevailing wind by 5 degree square from the CLIWOC logbooks (the ships-before-steam study), all year,
                 December to February and June to August
  stats.json     counts for the README
Inputs (read in place): Natural Earth 1:50m land; the sister studies world-shipwrecks, piracy-hotspots, ships-before-steam.
Run: python3 code/02m_sea.py
"""
import os, sys, json, math, csv, hashlib
import numpy as np
from shapely.geometry import shape, LineString, box, mapping, Point
from shapely.ops import unary_union
from shapely.prepared import prep
from scipy.ndimage import distance_transform_edt
import rasterio.features, rasterio.transform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import GEO, DATA, merc, unmerc, dump

STUDIES = os.environ.get('INK_STUDIES', '/home/claude/studies')
WRECKS = os.path.join(STUDIES, 'world-shipwrecks/data/wrecks.csv')
PIRACY = os.path.join(STUDIES, 'piracy-hotspots/data/hotspots_by_era.csv')
SBS = os.path.join(STUDIES, 'ships-before-steam/data')
OUT = os.path.join(DATA, 'sea')
os.makedirs(OUT, exist_ok=True)


def h01(*a):
    """A stable hash of the arguments in [0, 1)."""
    s = hashlib.md5(('|'.join(str(x) for x in a)).encode()).digest()
    return int.from_bytes(s[:6], 'big') / 2 ** 48


# ---------------------------------------------------------------- land mask and distance to land
land_geoms = [shape(f['geometry']) for f in json.load(open(os.path.join(GEO, 'ne_50m_land.geojson')))['features']]
LAND = unary_union(land_geoms)
LANDP = prep(LAND)
RES = 0.1
W, H = int(360 / RES), int(180 / RES)
tr = rasterio.transform.from_origin(-180, 90, RES, RES)
mask = rasterio.features.rasterize(((g, 1) for g in land_geoms), out_shape=(H, W), transform=tr, all_touched=True, dtype='uint8')
# distance to land in km: an exact Euclidean distance transform per 5 degree band of latitude, each with its own
# east-west cell size (a cell is narrower on the ground towards the poles)
DKM = np.zeros(mask.shape, dtype='float32')
sea_cells = mask == 0
for b0 in range(0, H, 50):
    b1 = min(H, b0 + 50); pad = 60
    r0, r1 = max(0, b0 - pad), min(H, b1 + pad)
    lat_mid = 90 - (b0 + b1) / 2 * RES
    d = distance_transform_edt(sea_cells[r0:r1], sampling=(RES * 111.2, RES * 111.2 * max(0.05, math.cos(math.radians(lat_mid)))))
    DKM[b0:b1] = d[b0 - r0:b1 - r0]

def cell(lon, lat):
    i = min(H - 1, max(0, int((90 - lat) / RES))); j = int((lon + 180) / RES) % W
    return i, j


def is_sea(lon, lat):
    i, j = cell(lon, lat)
    return mask[i, j] == 0


def dist_km(lon, lat):
    """Distance to land in km (to within the band's 60 cells, about 660 km, beyond which it reads as at least that)."""
    i, j = cell(lon, lat)
    return float(DKM[i, j])


def sea_near(lon, lat, max_km=60, min_dist=0.0):
    """The sea point nearest (lon, lat) that is at least min_dist km from land (spiral search on the 0.1 degree grid)."""
    if is_sea(lon, lat) and dist_km(lon, lat) >= min_dist:
        return lon, lat
    best = None
    for r in range(1, int(max_km / 11) + 2):
        for a in range(0, 360, 12):
            x = lon + r * RES * math.cos(math.radians(a)) / max(0.2, math.cos(math.radians(lat))); y = lat + r * RES * math.sin(math.radians(a))
            if is_sea(x, y) and dist_km(x, y) >= min_dist:
                d = math.hypot((x - lon) * math.cos(math.radians(lat)), y - lat)
                if best is None or d < best[0]: best = (d, x, y)
        if best: return round(best[1], 4), round(best[2], 4)
    return None


stats = {}

# ---------------------------------------------------------------- 1. sea life on a nested grid
KINDS = ['whale', 'dolphin', 'flyfish', 'serpent', 'kraken', 'berg', 'floe']
LEV0, LEV1 = 1, 6
CELLPX = {1: 120, 2: 140, 3: 160, 4: 190, 5: 230, 6: 280}   # a little denser far out, so the open ocean is never empty
rows, pts = [], []                     # pts: every point kept so far (lon, lat as Mercator x, y)
for z in range(LEV0, LEV1 + 1):
    n = int(round(512 * 2 ** z / CELLPX[z]))   # cells across the world at this zoom
    occupied = {(int(px * n), int(py * n)) for px, py in pts}   # a point from a coarser zoom keeps its cell
    for cy in range(n):
        for cx in range(n):
            if (cx, cy) in occupied: continue
            # the cell's candidate: a stable jitter inside it
            jx, jy = h01('x', z, cx, cy), h01('y', z, cx, cy)
            mx, my = (cx + 0.15 + 0.7 * jx) / n, (cy + 0.15 + 0.7 * jy) / n
            lon, lat = unmerc(mx, my)
            if lat > 82 or lat < -76: continue
            # distance from land grows with the size of the drawing on the ground at this zoom
            need = min(500, 90 * 2 ** (6 - z)) * max(0.3, math.cos(math.radians(lat)))   # a sprite covers less ground towards the poles
            if not is_sea(lon, lat): continue
            d = dist_km(lon, lat)
            if d < need: continue
            r = h01('k', z, cx, cy); alat = abs(lat)
            k, w = None, 0
            north_ice = lat > 74 or (lat > 66 and -75 < lon < -10)
            south_ice = lat < -65
            if north_ice or south_ice:
                k, w = ('floe', 1) if r < 0.3 else ('berg', 0) if r < 0.42 else ('whale', 0) if r < 0.5 else (None, 0)
            elif lat > 58 or lat < -52:
                k = 'berg' if r < 0.3 else 'whale' if r < 0.55 else None
                w = 1 if (k == 'berg' and (lat < 62 and lat > -58)) else 0
            elif 42 < lat < 58 and -60 < lon < -38 and r < 0.3:
                k, w = 'berg', 1                                   # iceberg alley off Newfoundland, in a hard winter
            elif alat < 24:
                k = 'flyfish' if r < 0.24 else 'dolphin' if (r < 0.44 and d < 700) else 'whale' if r < 0.54 else 'serpent' if (r < 0.565 and d > 500) else 'kraken' if (r < 0.61 and d > 900) else None
            else:
                k = 'whale' if r < 0.22 else 'dolphin' if (r < 0.46 and d < 600) else 'serpent' if (r < 0.49 and d > 450) else 'kraken' if (r < 0.535 and d > 800) else None
            if not k: continue
            v = int(h01('v', z, cx, cy) * 3)
            rows.append([round(lon, 3), round(lat, 3), KINDS.index(k), v, z, w]); pts.append((mx, my))
dump({'cols': ['lon', 'lat', 'kind', 'variant', 'first_zoom', 'winter_only'], 'kinds': KINDS, 'rows': rows}, os.path.join(OUT, 'life.json'))
from collections import Counter
stats['life'] = {KINDS[k]: c for k, c in sorted(Counter(r[2] for r in rows).items())}
stats['life_total'] = len(rows)
print('life', len(rows), stats['life'])

# ---------------------------------------------------------------- 2. named things at sea
feats = []


def add(k, lon, lat, n, d, z0, z1=12, i=None, src='', min_dist=0.0, exact=False, **extra):
    p = sea_near(lon, lat, 80, min_dist) if not (exact or k in ('legend', 'atlantis')) else (lon, lat)
    if not p:
        print('  no sea near', k, n, lon, lat); return
    props = {'k': k, 'i': i or k, 'n': n, 'd': d, 'z0': z0, 'z1': z1, 'src': src}
    props.update(extra)
    feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(p[0], 4), round(p[1], 4)]}, 'properties': props})


# compass roses on the open ocean (the centres of the rhumb lines below)
ROSES = [(-40, 26, 'North Atlantic'), (-18, -24, 'South Atlantic'), (74, -22, 'Indian Ocean'), (-148, 24, 'North Pacific'),
         (-118, -32, 'South Pacific'), (160, 8, 'Western Pacific'), (5, 72, 'Norwegian and Barents seas')]
for lon, lat, nm in ROSES:
    add('rose', lon, lat, 'Compass rose', f'A compass rose in the {nm}, with rhumb lines running out from it as on a portolan chart: straight lines of constant bearing, which are straight on this Mercator map too. Decoration.', 0.5, 4.8, i='sea-rose', src='decoration')

# islands of legend, where old charts put them (marked as legend everywhere)
LEGENDS = [
    (-14.6, 51.6, 'Hy-Brasil', 'An island of Irish legend said to rise from the sea west of Ireland once every seven years, drawn on charts from 1325 until the 1800s. Never found.'),
    (-19.6, 28.6, "St Brendan's Isle", "The island the monk Brendan is said to have reached on his voyage; in the Canaries it is San Borondón, sighted west of La Palma and never found."),
    (-26.0, 61.2, 'Frisland', 'A phantom island south of Iceland on the Zeno map of 1558, copied onto many charts for over a century.'),
    (-28.5, 57.3, 'Buss Island', 'Reported by one of Frobisher\'s ships in 1578, searched for until the 1800s and then said to have sunk: "the Sunken Land of Buss".'),
    (-53.4, 52.6, 'Isle of Demons', 'An island of 16th century charts off Newfoundland, said to be full of wailing spirits; perhaps a real island with a grim story attached.'),
    (-41.0, 31.0, 'Antillia, the Isle of Seven Cities', 'A great rectangular island on 15th century Atlantic charts, said to be settled by seven bishops fleeing Iberia.'),
]
for lon, lat, n, d in LEGENDS:
    add('legend', lon, lat, n + ' (legend)', d, 2.6, 11, i='sea-legend' + str(int(h01(n) * 3)), src='legend, hand-placed')
add('atlantis', -31.0, 37.6, 'Atlantis (legend)', "Plato's island beyond the Pillars of Hercules, sunk in a single day and night. A story, not a place: lettered here in a cartouche as old maps did.", 2.2, 8, i='sea-atlantis', src='legend, hand-placed')

# whirlpools
WHIRL = [
    (-5.722, 56.154, 'Corryvreckan', 'The whirlpool in the Gulf of Corryvreckan between Jura and Scarba, where the flood tide runs over a pinnacle of rock; one of the largest in the world.'),
    (12.82, 67.815, 'Moskstraumen, the Maelstrom', 'The tidal whirlpools off the tip of Lofoten, written up by Olaus Magnus and later by Poe and Verne as the Maelstrom.'),
    (15.628, 38.252, 'Charybdis, Strait of Messina', 'The whirling currents of the Strait of Messina, the Charybdis of the Odyssey, opposite the rock of Scylla.'),
    (14.62, 67.235, 'Saltstraumen', 'One of the strongest tidal currents in the world, near Bodø, with whirlpools up to 10 m across.'),
    (134.655, 34.238, 'Naruto whirlpools', 'Tidal whirlpools in the Naruto Strait between Shikoku and Awaji, painted by Hiroshige.'),
    (-66.993, 44.925, 'Old Sow', 'The largest whirlpool in the western hemisphere, in the channel between Deer Island, New Brunswick, and Eastport, Maine.'),
]
for lon, lat, n, d in WHIRL:
    add('whirl', lon, lat, n, d, 5.5, 15, i='sea-whirl', src='hand-placed', exact=True)   # placed by hand in the strait itself

# ghost ships of legend
GHOST = [
    (18.3, -35.3, 'The Flying Dutchman', 'The phantom ship of legend doomed to sail for ever off the Cape of Good Hope; a sighting is said to bring bad luck.'),
    (-17.25, 38.33, 'Mary Celeste', 'Found drifting with no one aboard between the Azores and Portugal in 1872; the crew were never found. (Wikidata places her wreck elsewhere: she was later lost off Haiti.)'),
    (1.57, 51.255, 'The Lady Lovibond', 'Said to have run on to the Goodwin Sands in 1748 and to return every fifty years; a legend without a record.'),
    (-74.4, -42.6, 'Caleuche', 'The glowing ghost ship of Chiloé folklore, crewed by the drowned.'),
    (-157.2, 71.55, 'SS Baychimo', 'A cargo steamer abandoned in the ice off Alaska in 1931 and sighted drifting for decades after.'),
    (-71.62, 41.12, 'The Palatine light', 'A burning ship said to appear off Block Island, Rhode Island, after a wreck of 1738.'),
    (-75.35, 35.15, 'Carroll A. Deering', 'A schooner found aground on Diamond Shoals, North Carolina, in 1921 with no one aboard.'),
]
for lon, lat, n, d in GHOST:
    add('ghost', lon, lat, n, d, 3.6, 11, i='sea-ghost', src='legend, hand-placed', min_dist=8)

# mermaids where the stories put them
MERMAIDS = [
    (-5.578, 50.199, 'The mermaid of Zennor', 'Cornish legend: a mermaid who lured the chorister Mathey Trewella into the sea at Pendour Cove; she is carved on a bench end in Zennor church.'),
    (-4.938, 50.558, 'The mermaid of Padstow', 'Cornish legend: a mermaid shot at by a local man cursed the harbour, and the Doom Bar sandbank rose across its mouth.'),
    (12.600, 55.6935, 'The Little Mermaid', "Hans Christian Andersen's tale of 1837; Edvard Eriksen's statue has sat on her rock in Copenhagen harbour since 1913."),
    (7.731, 50.140, 'The Lorelei', 'A rock above the narrowest bend of the Rhine, where a siren combing her golden hair lured boatmen to their wreck (Brentano, Heine).'),
    (21.018, 52.250, 'The mermaid of Warsaw', 'Syrenka, the mermaid of the Vistula who swore to defend the city; she has been on its arms since the 1300s.'),
    (-7.42, 57.44, 'The mermaid of Benbecula', 'A small mermaid said to have been found on the shore of Benbecula in 1830 and given a burial at Nunton.'),
    (14.43, 40.578, 'The sirens of Li Galli', 'The rocky islets off Positano known since antiquity as the Sirenuse, the islands of the sirens.'),
]
for lon, lat, n, d in MERMAIDS:
    river = n in ('The Lorelei', 'The mermaid of Warsaw')        # on the Rhine and the Vistula: placed as given
    add('mermaid', lon, lat, n, d, 7.5 if not river else 9.5, 15, i='sea-mermaid', src='legend, hand-placed', exact=True)   # each placed by hand just offshore (or on the river)

# the kraken off Norway, from the sea lore Pontoppidan wrote down
add('kraken', 6.0, 68.6, 'The kraken', 'The sea monster of Norwegian fishermen\'s tales, described by Bishop Erik Pontoppidan in his Natural History of Norway (1752 to 1753) as an island-sized beast off this coast.', 2.4, 9, i='sea-kraken2', src='legend, hand-placed')

# fishing fleets on real banks
BANKS = [
    (2.3, 54.8, 'Dogger Bank', 'A great sandbank in the North Sea, fished for cod and herring since the Middle Ages; the Dutch "dogger" boats gave it its name.'),
    (-50.5, 45.3, 'Grand Banks of Newfoundland', 'Shallow banks where the Labrador Current meets the Gulf Stream; Basque, Portuguese, French and English fleets fished their cod from the 1500s.'),
    (-67.6, 41.4, 'Georges Bank', 'A rich bank east of Cape Cod, fished by New England schooners for centuries.'),
    (-45.0, 47.0, 'Flemish Cap', 'An outlying bank east of the Grand Banks, fished for cod and redfish.'),
    (-13.7, 57.6, 'Rockall Bank', 'A bank round the lonely rock of Rockall, fished for haddock.'),
    (14.6, 68.05, 'Lofoten cod fishery', 'Every winter the skrei, the spawning Arctic cod, come to the Vestfjord; fished here for over a thousand years and dried as stockfish.'),
    (4.8, 56.8, 'Great Fisher Bank', 'A large bank in the middle of the North Sea.'),
    (21.0, -35.4, 'Agulhas Bank', 'The broad shelf south of Africa, fished for hake and sardine.'),
    (-21.0, 63.4, 'Selvogsbanki, Iceland', 'Spawning grounds of Icelandic cod off the south-west coast.'),
    (-61.0, 43.9, 'Sable Island Bank', 'One of the Scotian Shelf banks, fished for cod and haddock.'),
    (-77.9, -12.4, 'Peruvian anchoveta grounds', 'The cold, rich Humboldt Current waters off Peru, one of the most productive fisheries on Earth.'),
    (19.0, 74.0, 'Bear Island bank', 'Cod and haddock grounds round Bjørnøya in the Barents Sea.'),
]
for lon, lat, n, d in BANKS:
    add('fleet', lon, lat, n, d, 4.4, 12, i='sea-fleet' + str(int(h01(n) * 2)), src='hand-placed', min_dist=10)

# pirate ships at the reported hotspots (one per hotspot cell across all eras) and a few historic haunts
hot = {}
for r in csv.DictReader(open(PIRACY)):
    key = (int(r['cell_lat_from']), int(r['cell_lon_from']))
    e = hot.setdefault(key, {'name': r['name'], 'attacks': 0, 'eras': []})
    e['attacks'] += int(r['attacks']); e['eras'].append(r['era'])
for (la, lo), e in hot.items():
    eras = sorted(set(e['eras']))
    d = f"A hotspot of pirate attacks reported to the IMB and NGA: {e['attacks']} attacks in this square in its top-ranked periods ({', '.join(eras)}), from the Crime at Sea database (Benden et al. 2021). Drawn as an old pirate ship."
    add('pirate', lo + 0.5, la + 0.5, e['name'], d, 3.4, 11, i='sea-pirate', src='Crime at Sea (CC BY 4.0) via piracy-hotspots', min_dist=10)
HISTORIC_PIRATES = [
    (-77.6, 25.4, 'Nassau, the Bahamas', 'The pirate republic of the early 1700s, home port of Blackbeard and Bellamy until 1718.'),
    (-72.8, 20.2, 'Tortuga', 'The island off Hispaniola used by buccaneers in the 1600s.'),
    (-76.85, 17.85, 'Port Royal', 'The buccaneers\' harbour of Jamaica, much of which sank in the earthquake of 1692.'),
    (3.2, 37.0, 'The Barbary coast', 'The corsairs of Algiers, Tunis, Tripoli and Salé raided shipping and coasts as far as Iceland from the 1500s to the 1800s.'),
    (50.0, -16.9, 'Île Sainte-Marie, Madagascar', 'A haven of pirates of the Indian Ocean in the late 1600s and early 1700s.'),
    (100.0, 4.0, 'Strait of Malacca', 'A narrow sea lane where piracy has been reported for centuries, and still is.'),
]
for lon, lat, n, d in HISTORIC_PIRATES:
    add('pirate', lon, lat, n + ' (historic)', d, 3.4, 11, i='sea-pirate', src='hand-placed (historic)', min_dist=10)

# notable shipwrecks (Wikidata and NOAA AWOIS only: the Wikipedia-list rows are CC BY-SA and are left out)
wn = 0
seen_w = []
for r in csv.DictReader(open(WRECKS)):
    if int(r['source']) >= 4: continue
    sl = int(r['sitelinks'] or 0)
    if sl < 8: continue
    nm = r['name']
    if not nm or nm.startswith('(no ') or nm.lower().startswith('unnamed'): continue
    lon, lat = float(r['lon']), float(r['lat'])
    if not is_sea(lon, lat):
        p = sea_near(lon, lat, 25)
        if not p: continue
        lon, lat = p
    if any(abs(lon - a) < 0.05 and abs(lat - b) < 0.05 for a, b in seen_w): continue
    seen_w.append((lon, lat))
    yr = int(float(r['year'])) if r['year'] else None
    tl = (r['type_labels'] or '').lower()
    sail = int(r['type']) == 3 or any(t in tl for t in ('galleon', 'carrack', 'east indiaman', 'sailing', 'frigate', 'ship of the line', 'brig', 'barque', 'pirate', 'fluyt', 'merchant vessel')) or (yr is not None and yr < 1840)
    chest = sail and (yr is None or yr < 1900)
    z0 = 3.0 if sl >= 40 else 3.8 if sl >= 25 else 4.6 if sl >= 15 else 5.4
    d = 'Shipwreck' + (f', {yr}' if yr else '') + (f' ({r["type_labels"]})' if r['type_labels'] else '') + '. From Wikidata' + (' and NOAA AWOIS' if r['source'] == '3' else '') + '.'
    if chest: d += ' The treasure chest is decoration, drawn on the sailing-era wrecks.'
    feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 4), round(lat, 4)]},
                  'properties': {'k': 'wreck', 'i': 'sea-wreckchest' if chest else 'sea-wreck', 'n': nm, 'd': d, 'z0': z0, 'z1': 7.6, 'q': r['id'] if r['id'].startswith('Q') else '', 'src': 'Wikidata (CC0)' if r['source'] != '3' else 'NOAA AWOIS (public domain)'}})
    wn += 1
stats['wrecks'] = wn
stats['wreck_chests'] = sum(1 for f in feats if f['properties']['i'] == 'sea-wreckchest')

json.dump({'type': 'FeatureCollection', 'features': feats}, open(os.path.join(OUT, 'sea.geojson'), 'w'), ensure_ascii=False, separators=(',', ':'))
stats['named'] = dict(Counter(f['properties']['k'] for f in feats))
print('named', stats['named'])

# ---------------------------------------------------------------- 3. rhumb lines from the compass roses, clipped to the sea
SEA = box(-180, -85, 180, 85).difference(LAND)
lines = []
for lon0, lat0, nm in ROSES:
    x0, y0 = merc(lon0, lat0)
    for k in range(32):
        a = k * math.pi / 16
        L = 0.28                                                     # length in Mercator units (a quarter of the world)
        pts = []
        for t in np.linspace(0, 1, 60):
            x, y = x0 + math.sin(a) * L * t, y0 - math.cos(a) * L * t
            if not (0 <= x <= 1 and 0.03 <= y <= 0.97): break
            pts.append(unmerc(x, y))
        if len(pts) < 2: continue
        seg = LineString(pts).intersection(SEA)
        if seg.is_empty: continue
        rank = 0 if k % 4 == 0 else 1 if k % 2 == 0 else 2          # the eight winds, the half winds, the quarter winds
        geom = mapping(seg.simplify(0.05))
        lines.append({'type': 'Feature', 'geometry': geom, 'properties': {'r': rank}})
json.dump({'type': 'FeatureCollection', 'features': lines}, open(os.path.join(OUT, 'rhumb.geojson'), 'w'), separators=(',', ':'))
stats['rhumb_lines'] = len(lines)

# ---------------------------------------------------------------- 4. merchant passages (CLIWOC), kept only where they stay at sea
G = json.load(open(os.path.join(SBS, 'passages.geojson')))
cands = []
for f in G['features']:
    c = f['geometry']['coordinates']
    if len(c) < 20: continue
    km = sum(math.hypot((c[i][0] - c[i - 1][0]) * math.cos(math.radians(c[i][1])), c[i][1] - c[i - 1][1]) * 111 for i in range(1, len(c)))
    if km < 3000: continue
    # every leg must stay at sea (checked every 0.1 degree), and no daily jump is longer than 600 km
    ok = True
    for i in range(1, len(c)):
        a, b = c[i - 1], c[i]
        if abs(b[0] - a[0]) > 180 or math.hypot(b[0] - a[0], b[1] - a[1]) > 6: ok = False; break
        n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1))
        for t in range(n + 1):
            if not is_sea(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n): ok = False; break
        if not ok: break
    if not ok: continue
    p = f['properties']
    cands.append((h01('lane', p['passage']), p, c, km))
cands.sort(key=lambda t: t[0])
lanes, cellsused = [], Counter()
for _, p, c, km in cands:
    # spread them out: at most three passages starting in the same 10 degree square
    k = (int(c[0][0] // 10), int(c[0][1] // 10))
    if cellsused[k] >= 3: continue
    cellsused[k] += 1
    pts = LineString(c).simplify(0.15).coords
    lanes.append({'s': p['ship'].title(), 'n': p['nation'], 'y': p['start'][:4], 'c': [[round(x, 2), round(y, 2)] for x, y in pts]})
    if len(lanes) >= 90: break
dump({'source': 'CLIWOC 2.1 logbook passages via the ships-before-steam study', 'lanes': lanes}, os.path.join(OUT, 'lanes.json'))
stats['lanes'] = len(lanes)

# ---------------------------------------------------------------- 5. the prevailing wind (CLIWOC logbooks, 5 degree squares)
WA = json.load(open(os.path.join(SBS, 'wind_arrows.json')))
wind = {k: [[r[0], r[1], round(r[2]), round(r[3], 2)] for r in v] for k, v in WA.items()}
dump({'cols': ['lon_centre', 'lat_centre', 'from_deg', 'steadiness'], 'source': 'CLIWOC 2.1 via ships-before-steam (wind_arrows.json)', **wind}, os.path.join(OUT, 'wind.json'))
stats['wind_squares'] = {k: len(v) for k, v in wind.items()}

stats['bytes'] = {f: os.path.getsize(os.path.join(OUT, f)) for f in sorted(os.listdir(OUT)) if f != 'stats.json'}
json.dump(stats, open(os.path.join(OUT, 'stats.json'), 'w'), indent=1)
print(json.dumps(stats))
