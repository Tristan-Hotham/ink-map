"""Build data/folk/folk.json: the hidden folk of "Where's the Cartographer?".

Places come from data the map already ships (heritage sites from Wikidata in data/heritage/, the famous landmarks),
Natural Earth (countries, admin-1, populated places, land, lakes and rivers, all public domain), and the sister
studies (monastic houses from holy-islands, deserted medieval villages from ghost-towns, pilgrimage sites from
pilgrim-roads). Hand-placed figures are in curated.py; the rest are chosen here, spread out, one or more in every
country, with more in Britain, Ireland and the rest of Europe.

Run: python3 code/folk/01_folk.py   (writes data/folk/folk.json, data/folk/folk_summary.json, data/folk/sources.csv)
"""
import csv, glob, hashlib, json, math, os, random, re, sys
from collections import Counter, defaultdict
import numpy as np
import shapely
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from archetypes import ARCH, V          # noqa: E402
from curated import C as CURATED        # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'folk')
GEO = os.environ.get('INK_GEO', '/home/claude/newdata/raw/geo')
NE3 = os.environ.get('INK_NE3', '/home/claude/newdata/raw3')
STUDIES = os.environ.get('INK_STUDIES', '/home/claude/studies')
os.makedirs(OUT, exist_ok=True)


def seed(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def slug(s):
    s = s.lower().replace("'", '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:40]


def offset(lat, lon, de, dn):
    return lat + dn / 111320.0, lon + de / (111320.0 * math.cos(math.radians(lat)))


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


# ------------------------------------------------------------------ geography
print('loading geography')
countries = json.load(open(os.path.join(GEO, 'ne_10m_admin_0_countries.geojson')))['features']
KEEP_TYPES = {'Sovereign country', 'Country', 'Sovereignty'}
KEEP_EXTRA = {'ISR', 'PSX', 'KOS', 'SAH', 'GRL', 'FRO', 'PRI', 'NCL', 'PYF', 'BMU', 'FLK', 'ATA'}
C_GEOM, C_PROP = [], []
for f in countries:
    p = f['properties']
    C_GEOM.append(shape(f['geometry']))
    C_PROP.append(dict(iso=p['ADM0_A3'], name=p['NAME'], admin=p['ADMIN'], type=p['TYPE'], cont=p['CONTINENT'], sub=p['SUBREGION'],
                       counts=(p['TYPE'] in KEEP_TYPES or p['ADM0_A3'] in KEEP_EXTRA), pop=p['POP_EST'] or 0))
C_TREE = STRtree(C_GEOM)
land = shapely.union_all([shape(f['geometry']) for f in json.load(open(os.path.join(NE3, 'shared-rivers/ne/ne_10m_land.geojson')))['features']])
shapely.prepare(land)
lakes_fc = json.load(open(os.path.join(NE3, 'borders/ne_10m_lakes.geojson')))['features']
try:
    lakes_fc += json.load(open(os.path.join(NE3, 'borders/ne_10m_lakes_europe.geojson')))['features']
except Exception:
    pass
lakes = shapely.union_all([shape(f['geometry']).buffer(0) for f in lakes_fc])
shapely.prepare(lakes)
rivers = [shape(f['geometry']) for f in json.load(open(os.path.join(NE3, 'borders/ne_10m_rivers_lake_centerlines.geojson')))['features'] if f['geometry']]
R_TREE = STRtree(rivers)
adm1 = json.load(open(os.path.join(GEO, 'ne_10m_admin_1_states_provinces.geojson')))['features']
A1_GEOM = [shape(f['geometry']) for f in adm1]
A1_NAME = [(f['properties'].get('name') or '', f['properties'].get('adm0_a3') or '') for f in adm1]
A1_TREE = STRtree(A1_GEOM)
pp = [f['properties'] for f in json.load(open(os.path.join(GEO, 'ne_10m_populated_places_simple.geojson')))['features']]


def country_of(lat, lon):
    pt = Point(lon, lat)
    for i in C_TREE.query(pt, predicate='intersects'):
        return C_PROP[i]
    i = C_TREE.nearest(pt)
    return C_PROP[i]


def admin1_of(lat, lon):
    pt = Point(lon, lat)
    for i in A1_TREE.query(pt, predicate='intersects'):
        return A1_NAME[i][0]
    return ''


def on_land(lat, lon):
    pt = Point(lon, lat)
    return land.contains(pt) and not lakes.contains(pt)


REGIONS = [
    ('Britain and Ireland', {'GBR', 'IRL', 'IMN', 'JEY', 'GGY'}),
    ('Northern Europe', {'NOR', 'SWE', 'DNK', 'FIN', 'ISL', 'FRO', 'EST', 'LVA', 'LTU', 'ALD'}),
    ('Western Europe', {'FRA', 'BEL', 'NLD', 'LUX', 'DEU', 'CHE', 'AUT', 'LIE', 'MCO'}),
    ('Southern Europe', {'ESP', 'PRT', 'ITA', 'GRC', 'MLT', 'CYP', 'AND', 'SMR', 'VAT', 'GIB', 'CYN'}),
    ('Central and Eastern Europe', {'POL', 'CZE', 'SVK', 'HUN', 'SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'MKD', 'ALB', 'BGR', 'ROU', 'MDA', 'UKR', 'BLR', 'RUS', 'KOS'}),
    ('Middle East and North Africa', {'TUR', 'SYR', 'LBN', 'ISR', 'PSX', 'JOR', 'IRQ', 'IRN', 'SAU', 'YEM', 'OMN', 'ARE', 'QAT', 'BHR', 'KWT', 'EGY', 'LBY', 'TUN', 'DZA', 'MAR', 'SAH'}),
    ('Central Asia and the Caucasus', {'KAZ', 'UZB', 'TKM', 'KGZ', 'TJK', 'AFG', 'MNG', 'GEO', 'ARM', 'AZE'}),
    ('South Asia', {'IND', 'PAK', 'BGD', 'NPL', 'BTN', 'LKA', 'MDV'}),
    ('East Asia', {'CHN', 'JPN', 'KOR', 'PRK', 'TWN', 'HKG', 'MAC'}),
    ('South-East Asia', {'THA', 'MMR', 'LAO', 'KHM', 'VNM', 'MYS', 'SGP', 'IDN', 'PHL', 'BRN', 'TLS'}),
    ('North America', {'USA', 'CAN', 'GRL', 'BMU', 'SPM'}),
    ('Mexico, Central America and the Caribbean', {'MEX', 'GTM', 'BLZ', 'HND', 'SLV', 'NIC', 'CRI', 'PAN', 'CUB', 'JAM', 'HTI', 'DOM', 'BHS', 'TTO', 'BRB', 'LCA', 'VCT', 'GRD', 'ATG', 'KNA', 'DMA', 'PRI'}),
    ('South America', {'BRA', 'ARG', 'CHL', 'PER', 'BOL', 'ECU', 'COL', 'VEN', 'GUY', 'SUR', 'PRY', 'URY', 'FLK'}),
    ('Oceania', {'AUS', 'NZL', 'PNG', 'FJI', 'SLB', 'VUT', 'WSM', 'TON', 'KIR', 'TUV', 'NRU', 'MHL', 'FSM', 'PLW', 'NCL', 'PYF'}),
    ('Antarctica', {'ATA'}),
]
REGION_OF = {iso: r for r, s in REGIONS for iso in s}


def region_of(c):
    r = REGION_OF.get(c['iso'])
    if r:
        return r
    cont = c['cont']
    if cont == 'Africa':
        return 'Middle East and North Africa' if c['sub'] == 'Northern Africa' else 'Sub-Saharan Africa'
    if cont == 'Europe':
        return 'Central and Eastern Europe'
    if cont == 'Oceania':
        return 'Oceania'
    if cont == 'South America':
        return 'South America'
    if cont == 'North America':
        return 'Mexico, Central America and the Caribbean' if c['sub'] in ('Caribbean', 'Central America') else 'North America'
    if cont == 'Asia':
        return {'Western Asia': 'Middle East and North Africa', 'Southern Asia': 'South Asia', 'Eastern Asia': 'East Asia', 'South-Eastern Asia': 'South-East Asia', 'Central Asia': 'Central Asia and the Caucasus'}.get(c['sub'], 'East Asia')
    return 'Oceania'


# ------------------------------------------------------------------ the map's own heritage sites and landmarks
print('loading heritage')
idx = json.load(open(os.path.join(DATA, 'heritage/index.json')))
ICONS = idx['icons']
HER = []
for fn in glob.glob(os.path.join(DATA, 'heritage/*_*.json')):
    for r in json.load(open(fn)):
        HER.append((r[1] / 1e5, r[0] / 1e5, ICONS[r[2]], r[3] / 10, r[4], r[5]))
LANDMARKS = [(f['geometry']['coordinates'][1], f['geometry']['coordinates'][0], f['properties'].get('n')) for f in json.load(open(os.path.join(DATA, 'landmarks.geojson')))['features']]


def lookup(q, near=None):
    ql = q.lower()
    hits = [r for r in HER if r[4].lower() == ql] or [r for r in HER if ql in r[4].lower()]
    hits += [(la, lo, 'landmark', 2, n, None) for la, lo, n in LANDMARKS if n and (n.lower() == ql or ql in n.lower())]
    if not hits:
        return None
    if near:
        hits.sort(key=lambda r: km((r[0], r[1]), near))
    else:
        hits.sort(key=lambda r: r[3])
    return hits[0]


def snap_river(lat, lon, maxkm=3):
    pt = Point(lon, lat)
    i = R_TREE.nearest(pt)
    g = rivers[i]
    q = g.interpolate(g.project(pt))
    if km((lat, lon), (q.y, q.x)) <= maxkm:
        return q.y, q.x
    return lat, lon


def find_water(lat, lon, kind, maxm=4000):
    """Nudge a water figure onto water (sea: off the Natural Earth land; lake: inside a Natural Earth lake)."""
    ok = (lambda la, lo: not land.contains(Point(lo, la))) if kind == 'sea' else (lambda la, lo: lakes.contains(Point(lo, la)))
    if ok(lat, lon):
        return lat, lon, 0
    for r in range(150, maxm, 150):
        for a in range(0, 360, 15):
            la, lo = offset(lat, lon, r * math.cos(math.radians(a)), r * math.sin(math.radians(a)))
            if ok(la, lo):
                return la, lo, r
    return lat, lon, -1


def find_land(lat, lon, maxm=3000):
    if on_land(lat, lon):
        return lat, lon, 0
    for r in range(100, maxm, 100):
        for a in range(0, 360, 20):
            la, lo = offset(lat, lon, r * math.cos(math.radians(a)), r * math.sin(math.radians(a)))
            if on_land(la, lo):
                return la, lo, r
    return lat, lon, -1


# ------------------------------------------------------------------ words for riddles
CW = {'madder': 'red', 'madderDk': 'dark red', 'rose': 'rose', 'ochre': 'ochre', 'ochreLt': 'gold', 'saffron': 'saffron', 'woad': 'blue', 'woadDk': 'dark blue',
      'indigo': 'indigo', 'sage': 'sage green', 'green': 'green', 'moss': 'moss green', 'undyed': 'undyed wool', 'wool': 'oatmeal', 'russet': 'russet',
      'brown': 'brown', 'dun': 'dun', 'black': 'black', 'white': 'white', 'grey': 'grey', 'slate': 'slate', 'murrey': 'murrey', 'purple': 'purple',
      'teal': 'teal', 'gold': 'gold', 'jade': 'jade green', 'vermilion': 'vermilion', 'crimson': 'crimson', 'steel': 'steel'}


def cw(c):
    return CW.get(c, c if c and not str(c).startswith('#') else 'plain')


def first_person(sp):
    for f in sp['figs']:
        if f.get('t') == 'person':
            return f
    return {}


# ------------------------------------------------------------------ resolve the hand-placed list
entries, log = [], []
for e in CURATED:
    arch = e['arch']
    kw = {}
    if isinstance(arch, tuple):
        arch, kind = arch
        kw = {'kind': kind} if arch == 'monk' else {'dwarf': True} if arch == 'smith' else {}
    if e.get('sheep') is not None and arch == 'shepherd':
        kw['sheep'] = e['sheep']
    if e.get('robe') and arch == 'monk_saffron':
        kw['robe'] = e['robe']
    if e.get('her') and arch == 'knight':
        kw['her'] = e['her']
    fn = ARCH[arch]
    sp = fn(V(seed(e['id'])), **kw)
    src = 'hand-placed'
    if e.get('q'):
        hit = lookup(e['q'], e.get('near'))
        if not hit:
            raise SystemExit('lookup failed: ' + e['q'])
        lat, lon = hit[0], hit[1]
        de, dn = e['off'] if e.get('off') else (0, 0)
        lat, lon = offset(lat, lon, de, dn)
        src = 'Wikidata via the map\'s heritage layer (Q%s), offset %d m' % (hit[5], round(math.hypot(de, dn))) if hit[5] else 'the map\'s landmark layer'
    else:
        lat, lon = e['at']
    moved = 0
    w = e.get('water')
    if w == 'river':
        lat2, lon2 = snap_river(lat, lon, 2.5)
        moved = round(km((lat, lon), (lat2, lon2)) * 1000); lat, lon = lat2, lon2
    elif w in ('sea', 'lake'):
        lat2, lon2, moved = find_water(lat, lon, w, 12000 if w == 'sea' else 3000)
        if moved > 0:
            lat, lon = lat2, lon2
    # land figures: hand-placed coordinates are trusted (Natural Earth's coastline misses small islands and coves)
    if moved:
        log.append(f"{e['id']}: moved {moved} m to {'water' if w else 'land'}")
    c = country_of(lat, lon)
    if e.get('iso'):
        c = next(x for x in C_PROP if x['iso'] == e['iso'])
    entries.append(dict(id=e['id'], name=e['name'], place=e['place'], riddle=e['riddle'], lat=round(lat, 5), lon=round(lon, 5), iso=c['iso'], country=c['admin'],
                        region=region_of(c), arch=arch, art=sp, src=src, water=w or None, big=bool(e.get('big')), curated=True))
print(len(entries), 'hand-placed')

# ------------------------------------------------------------------ fillers
def taken_near(lat, lon, rkm):
    return any(km((lat, lon), (x['lat'], x['lon'])) < rkm for x in entries)


# country lookup for the heritage candidates (vectorised)
print('assigning heritage sites to countries')
GOOD = {'castle', 'cathedral', 'monastery', 'church', 'palace', 'mansion', 'ruins', 'hillfort', 'barrow', 'stone_circle', 'standing_stone', 'windmill', 'bridge',
        'spring', 'cave', 'waterfall', 'lighthouse', 'temple', 'mosque', 'pagoda', 'pyramid', 'tower', 'gorge', 'pass', 'cityhall', 'synagogue', 'monument', 'natpark'}
cand = [r for r in HER if r[2] in GOOD and r[3] <= 11.1 and not re.search(r'\d{2,}m |barrow \d|Bowl barrow|bell barrow|round barrow|Round barrows|cairn \d|Ring cairn|field system|enclosure', r[4], re.I)]
pts = shapely.points([r[1] for r in cand], [r[0] for r in cand])
pi, ci = C_TREE.query(pts, predicate='intersects')
CISO = {}
for a, b in zip(pi, ci):
    CISO.setdefault(int(a), C_PROP[int(b)]['iso'])
BY_ISO = defaultdict(list)
for i, r in enumerate(cand):
    iso = CISO.get(i)
    if iso:
        BY_ISO[iso].append(r)
for iso in BY_ISO:
    BY_ISO[iso].sort(key=lambda r: (r[3], r[4]))
print('candidate sites', len(cand))

EU = {'GBR', 'IRL', 'IMN', 'JEY', 'GGY'} | {iso for r, s in REGIONS[1:5] for iso in s}

# archetype by site type in Europe; flavour by country
EU_BY_ICON = {
    'castle': ['knight', 'watchman', 'archer', 'falconer', 'knight', 'messenger'], 'palace': ['falconer', 'minstrel', 'merchant', 'jester'],
    'mansion': ['falconer', 'minstrel', 'rider', 'goosegirl'], 'cathedral': [('monk', 'walk'), 'nun', 'pilgrims', 'scholar', 'stall', 'minstrel', 'merchant', 'jester'],
    'monastery': [('monk', 'walk'), ('monk', 'garden'), 'nun', 'friar', ('monk', 'bell')], 'church': ['friar', 'pilgrims', 'stall', 'goosegirl', 'pedlar', 'minstrel', 'milkmaid', 'swineherd', 'oxcart', ('monk', 'walk')],
    'windmill': ['miller', 'miller', 'oxcart'], 'bridge': ['pedlar', 'fisher', 'merchant', 'trollbare'], 'spring': ['hedgewitch', 'milkmaid', 'pilgrims'],
    'stone_circle': ['fairyring', 'wisp', 'piper'], 'standing_stone': ['shepherd', 'fairyring', 'wisp'], 'barrow': ['shepherd', 'wight', 'lostsheep'],
    'hillfort': ['shepherd', 'watchman', 'archer'], 'cave': ['hermit', 'miner', 'goblins'], 'waterfall': ['fisher', 'hermit', 'woodcutter'],
    'lighthouse': ['watchman', 'smugglers'], 'battle': ['ghostknight', 'knight'], 'ruins': ['shepherd', 'cockatrice', 'goblins', 'scholar', 'swineherd'],
    'tower': ['watchman', 'scholar', 'archer'], 'gorge': ['hermit', 'woodcutter'], 'pass': ['pedlar', 'messenger', 'pilgrimhorse'], 'cityhall': ['merchant', 'stall', 'minstrel'],
    'monument': ['pedlar', 'stall', 'minstrel'], 'natpark': ['woodcutter', 'shepherd', 'wolves', 'swineherd', 'archer'], 'temple': ['pilgrims'], 'mosque': ['merchant'],
    'synagogue': ['scholar'], 'pyramid': ['cartographer_world'], 'pagoda': ['pilgrims'],
}
EU_FLAVOUR = {
    'NLD': ['skaters', 'miller'], 'BEL': ['skaters', 'merchant'], 'CHE': ['alphorn', 'shepherd'], 'AUT': ['alphorn', 'tatzelwurm', 'miner'],
    'NOR': ['vikingfoot', 'trollbare', 'sledge'], 'SWE': ['vikingfoot', 'sledge', 'reindeerherder'], 'DNK': ['vikingfoot', 'merchant'], 'ISL': ['vikingfoot', 'trollbare'],
    'FIN': ['reindeerherder', 'sledge', 'skaters'], 'FRO': ['vikingfoot', 'shepherd'], 'RUS': ['sledge', 'babahut', 'skaters'], 'UKR': ['cossack', 'shepherd'],
    'BLR': ['sledge', 'woodcutter'], 'HUN': ['horsearcher_hu', 'shepherd'], 'POL': ['knight', 'sledge'], 'FRA': ['vintner', 'pilgrims'], 'ITA': ['vintner', 'pilgrims'],
    'ESP': ['pilgrims', 'vintner'], 'PRT': ['vintner', 'pilgrims'], 'GRC': ['shepherd', ('monk', 'walk')], 'ROU': ['shepherd', 'woodcutter'], 'DEU': ['woodcutter', 'skaters', 'miner'],
    'CZE': ['miner', 'minstrel'], 'SVK': ['miner', 'shepherd'], 'EST': ['merchant', 'sledge'], 'LVA': ['merchant', 'knight'], 'LTU': ['knight', 'sledge'],
    'GBR': ['shepherd', 'goosegirl', 'swineherd', 'ploughman', 'oxcart'], 'IRL': ['shepherd', 'fairyring', 'banshee', 'brownie'],
}

WORLD = {   # archetypes by country, region-appropriate (land only for fillers)
    'MAR': ['caravan', 'marketwoman_mena', 'scholar_tk'], 'DZA': ['tuareg', 'caravan'], 'TUN': ['caravan', 'scholar_mena'], 'LBY': ['tuareg', 'basilisk', 'caravan'],
    'EGY': ['caravan', 'bedouin', 'scholar_mena'], 'SAH': ['tuareg'], 'TUR': ['caravan', 'ca_merchant', 'shepherd_ol'], 'SYR': ['caravan', 'bedouin'], 'LBN': ['merchant_ol', 'shepherd_ol'],
    'ISR': ['pilgrims', 'shepherd_ol'], 'PSX': ['pilgrims', 'shepherd_ol'], 'JOR': ['bedouin', 'caravan'], 'IRQ': ['caravan', 'scholar_mena'], 'IRN': ['caravan', 'ca_merchant'],
    'SAU': ['bedouin', 'caravan', 'falconer_ar'], 'YEM': ['caravan', 'scholar_mena'], 'OMN': ['falconer_ar', 'caravan'], 'ARE': ['falconer_ar', 'bedouin'], 'QAT': ['falconer_ar'],
    'BHR': ['falconer_ar'], 'KWT': ['falconer_ar'], 'AFG': ['ca_merchant', 'caravan'], 'KAZ': ['eaglehunter', 'ca_merchant'], 'KGZ': ['eaglehunter', 'mongol'], 'UZB': ['ca_merchant', 'caravan'],
    'TKM': ['ca_merchant', 'caravan'], 'TJK': ['ca_merchant', 'porter'], 'MNG': ['mongol', 'eaglehunter'], 'GEO': ['shepherd_ol', 'monk_ol'], 'ARM': ['monk_ol', 'shepherd_ol'], 'AZE': ['caravan', 'ca_merchant'],
    'IND': ['elephant', 'in_pilgrim', 'in_sari', 'caravan_in'], 'PAK': ['caravan_in', 'porter'], 'BGD': ['in_sari', 'rice_sa'], 'NPL': ['porter', 'monk_saffron'], 'BTN': ['monk_maroon', 'porter'],
    'LKA': ['monk_saffron', 'elephant'], 'MDV': ['fisher_beach'],
    'CHN': ['cn_scholar', 'cn_farmer', 'rice', 'watchman_cn'], 'TWN': ['cn_farmer', 'rice'], 'HKG': ['cn_farmer'], 'MAC': ['cn_scholar'], 'JPN': ['samurai', 'jp_pilgrim', 'jp_farmer'],
    'KOR': ['kr_scholar', 'rice'], 'PRK': ['kr_scholar', 'rice'],
    'THA': ['monk_saffron', 'rice'], 'MMR': ['monk_russet', 'rice'], 'LAO': ['monk_saffron', 'rice'], 'KHM': ['monk_saffron', 'rice'], 'VNM': ['rice', 'cn_farmer'],
    'MYS': ['rice', 'fisher_beach'], 'SGP': ['fisher_beach'], 'IDN': ['rice', 'fisher_beach'], 'PHL': ['rice', 'fisher_beach'], 'BRN': ['fisher_beach'], 'TLS': ['fisher_beach', 'rice'],
    'USA': ['cartographer_world', 'wildman', 'drover_us', 'sleeper'], 'CAN': ['cartographer_world', 'wildman', 'sledge_ca'], 'GRL': ['sledge_gl'], 'BMU': ['fisher_beach_eu'],
    'MEX': ['aztec', 'maya', 'gaucho_mx'], 'GTM': ['maya'], 'BLZ': ['maya'], 'HND': ['maya'], 'SLV': ['maya', 'fisher_beach_am'], 'NIC': ['fisher_beach_am'], 'CRI': ['fisher_beach_am'],
    'PAN': ['fisher_beach_am'], 'CUB': ['fisher_beach_am'], 'JAM': ['fisher_beach_am'], 'HTI': ['fisher_beach_am'], 'DOM': ['fisher_beach_am'], 'BHS': ['fisher_beach_am'], 'TTO': ['fisher_beach_am'],
    'PRI': ['watchman_es'], 'BRA': ['fisher_beach_am', 'gaucho', 'cartographer_world'], 'ARG': ['gaucho', 'llamaherder'], 'CHL': ['gaucho', 'llamaherder'], 'PER': ['chasqui', 'llamaherder'],
    'BOL': ['llamaherder', 'chasqui'], 'ECU': ['llamaherder'], 'COL': ['llamaherder', 'fisher_beach_am'], 'VEN': ['fisher_beach_am', 'gaucho'], 'GUY': ['fisher_beach_am'], 'SUR': ['fisher_beach_am'],
    'PRY': ['gaucho', 'friar'], 'URY': ['gaucho'], 'FLK': ['shepherd'],
    'AUS': ['drover', 'cartographer_world', 'dutchsailor'], 'NZL': ['shepherd', 'cartographer_world'], 'PNG': ['fisher_beach_pac'], 'FJI': ['fisher_beach_pac'], 'SLB': ['fisher_beach_pac'], 'VUT': ['fisher_beach_pac'],
    'WSM': ['fisher_beach_pac'], 'TON': ['fisher_beach_pac'], 'KIR': ['fisher_beach_pac'], 'TUV': ['fisher_beach_pac'], 'NRU': ['fisher_beach_pac'], 'MHL': ['fisher_beach_pac'], 'FSM': ['fisher_beach_pac'],
    'PLW': ['fisher_beach_pac'], 'NCL': ['fisher_beach_pac'], 'PYF': ['fisher_beach_pac'],
    # Africa
    'MRT': ['tuareg', 'scholar_tk'], 'MLI': ['griot', 'marketwoman', 'scholar_tk'], 'NER': ['tuareg', 'sahel_horseman'], 'TCD': ['sahel_horseman', 'tuareg'], 'SDN': ['caravan_af', 'scholar_tk'],
    'SEN': ['griot', 'marketwoman'], 'GMB': ['griot'], 'GNB': ['marketwoman'], 'GIN': ['griot'], 'SLE': ['marketwoman'], 'LBR': ['marketwoman'], 'CIV': ['marketwoman', 'griot'], 'BFA': ['griot', 'sahel_horseman'],
    'GHA': ['marketwoman', 'griot'], 'TGO': ['marketwoman'], 'BEN': ['marketwoman', 'sahel_horseman'], 'NGA': ['sahel_horseman', 'marketwoman', 'griot'], 'CMR': ['sahel_horseman', 'marketwoman'],
    'CAF': ['marketwoman'], 'GNQ': ['marketwoman'], 'GAB': ['marketwoman'], 'COG': ['marketwoman'], 'COD': ['marketwoman', 'ankole'], 'AGO': ['zebuherder_af', 'marketwoman'], 'ZMB': ['zebuherder_af'],
    'MWI': ['marketwoman'], 'MOZ': ['marketwoman', 'zebuherder_af'], 'ZWE': ['zebuherder_af', 'marketwoman'], 'BWA': ['zebuherder_af'], 'NAM': ['zebuherder_af'], 'ZAF': ['zulu', 'nguni'], 'LSO': ['basotho'],
    'SWZ': ['nguni'], 'MDG': ['zebuherder'], 'COM': ['fisher_beach_af'], 'MUS': ['fisher_beach_af'], 'SYC': ['fisher_beach_af'], 'KEN': ['maasai'], 'TZA': ['maasai', 'marketwoman'], 'UGA': ['ankole'],
    'RWA': ['ankole'], 'BDI': ['ankole'], 'SSD': ['zebuherder_af'], 'ETH': ['et_pilgrim', 'zebuherder_af'], 'ERI': ['et_pilgrim'], 'DJI': ['caravan_af'], 'SOM': ['caravan_af'], 'SOL': ['caravan_af'],
    'STP': ['fisher_beach_af'], 'CPV': ['fisher_beach_af'], 'ATA': ['explorer_penguins'],
}
EXTRA_N = {'USA': 7, 'CAN': 4, 'BRA': 4, 'CHN': 6, 'IND': 6, 'RUS': 7, 'AUS': 4, 'ARG': 2, 'MEX': 3, 'IDN': 3, 'JPN': 3, 'IRN': 2, 'TUR': 3, 'EGY': 2, 'PER': 2, 'ZAF': 2, 'KAZ': 2,
           'PAK': 2, 'NGA': 2, 'ETH': 2, 'SAU': 2, 'DZA': 2, 'COD': 2, 'MAR': 2, 'CHL': 2, 'COL': 2, 'MNG': 2, 'THA': 2, 'VNM': 2, 'PHL': 2, 'NZL': 2, 'KEN': 2, 'TZA': 2, 'MYS': 2}
EU_N = {'GBR': 150, 'IRL': 26, 'FRA': 30, 'DEU': 26, 'ITA': 24, 'ESP': 22, 'PRT': 8, 'NLD': 7, 'BEL': 5, 'CHE': 7, 'AUT': 7, 'CZE': 7, 'POL': 12, 'SWE': 9, 'NOR': 9, 'DNK': 5, 'FIN': 6,
        'GRC': 9, 'HUN': 5, 'ROU': 7, 'BGR': 4, 'HRV': 5, 'SRB': 4, 'UKR': 7, 'RUS': 12, 'BLR': 3, 'LTU': 3, 'LVA': 3, 'EST': 3, 'SVK': 3, 'SVN': 3, 'BIH': 2, 'ISL': 3, 'MLT': 2, 'CYP': 2,
        'ALB': 2, 'MKD': 2, 'MNE': 2, 'MDA': 2, 'LUX': 1, 'KOS': 1, 'IMN': 2, 'JEY': 1, 'GGY': 1}

# extra archetypes for fillers that wrap the main ones with regional dress
import archetypes as A   # noqa: E402


def _wrap(base, **ov):
    def f(v):
        sp = A.ARCH[base](v)
        for fg in sp['figs']:
            if fg.get('t') == 'person':
                fg.update({k: (val(v) if callable(val) else val) for k, val in ov.items()})
        return sp
    return f


def a_fisher_beach(v, skin=None, c1=None):
    sk = skin or v.pick(['brown', 'medium', 'tan'])
    return A.spec(28, 18, [A.F('ground', 14, 16, x0=-13, x1=13, k='water'), A.F('boat', 20, 15.2, k='canoe', c='russet', s=0.75), A.P(7, 16, garb='tunic', skin=sk, c1=c1 or v.pick(['white', 'madder', 'ochre', 'woad', 'jade']), c2=sk, hose=sk, hat=v.pick([None, 'straw', 'headwrap']), hatc=v.pick(['white', 'straw', 'madder']), prop='net', arms=['out', 'down'], hair='black')])


EXTRA_ARCH = {
    'marketwoman_mena': _wrap('marketwoman', skin=lambda v: v.pick(['tan', 'olive', 'medium'])),
    'scholar_mena': _wrap('scholar_tk', skin=lambda v: v.pick(['tan', 'olive'])),
    'shepherd_ol': _wrap('shepherd', skin=lambda v: v.pick(['olive', 'tan']), hair='black'),
    'merchant_ol': _wrap('merchant', skin='olive', hair='black'),
    'monk_ol': _wrap('monk', skin='olive'),
    'monk_maroon': lambda v: A.a_monk_saffron(v, robe='murrey'),
    'monk_russet': lambda v: A.a_monk_saffron(v, robe='russet'),
    'caravan_in': lambda v: A.a_caravan(v, ppl='medium', hat='headwrap', two=False),
    'caravan_af': lambda v: A.a_caravan(v, ppl='brown', hat='turban', two=False),
    'rice_sa': lambda v: A.a_rice(v, ppl='medium'),
    'fisher_beach': a_fisher_beach,
    'fisher_beach_am': lambda v: a_fisher_beach(v, skin=v.pick(['copper', 'brown', 'medium', 'olive'])),
    'fisher_beach_pac': lambda v: a_fisher_beach(v, skin=v.pick(['medium', 'brown']), c1=v.pick(['madder', 'white', 'ochre'])),
    'fisher_beach_af': lambda v: a_fisher_beach(v, skin=v.pick(['deep', 'brown', 'ebony'])),
    'fisher_beach_eu': lambda v: a_fisher_beach(v, skin='fair'),
    'zebuherder_af': lambda v: A.a_zebuherder(v, ppl=v.pick(['deep', 'brown', 'ebony'])),
    'drover_us': A.a_drover, 'gaucho_mx': A.a_gaucho, 'sledge_ca': A.a_sledge,
    'sledge_gl': _wrap('sledge', skin='copper', hair='black', hat='fur'),
    'watchman_es': _wrap('watchman', skin='olive'),
}
ALL_ARCH = dict(ARCH, **EXTRA_ARCH)

# riddles for fillers: by archetype, with the site, the area and the figure's colours
def riddle_for(arch, sp, site, area, v):
    p = first_person(sp)
    c1, c3, hat = cw(p.get('c1')), cw(p.get('c3') or p.get('hatc')), p.get('hat')
    her = p.get('her') or {}
    ban = f"{cw(her.get('c1'))} and {cw(her.get('c2'))}" if her else 'bright colours'
    T = {
        'knight': [f'By {site} in {area}, a knight rides out under a banner of {ban}.', f'A knight in {ban} has business at {site}. Look along the road outside.'],
        'watchman': [f'A watchman with a lantern keeps his post at {site}, {area}.', f'At {site} a guard in {c1} leans on his weapon and watches the road.'],
        'archer': [f'Near {site} in {area}, an archer in {c1} takes aim at something only he can see.'],
        'falconer': [f'At {site}, {area}, a falconer in {c1} shows off a hawk on a gloved fist.'],
        'messenger': [f'A messenger in {c1} gallops past {site} blowing a horn. Make way!'],
        'rider': [f'A rider in a {c1} gown trots along the lanes near {site}, {area}.'],
        'minstrel': [f'A minstrel in {c1} sings for a coin by {site}, {area}.'],
        'jester': [f'A jester in red and gold tumbles about near {site}.'],
        'merchant': [f'A merchant in a {c1} gown, with a cart and horse, has just done a deal near {site}, {area}.'],
        'goosegirl': [f'Three geese and a girl with a stick are on their way past {site}, {area}.'],
        'monk': [f'A monk in {c1} hurries along by {site}, {area}.', f'Near {site}, a monk keeps a book safe under his arm.'],
        'nun': [f'A nun in black carries something precious past {site}, {area}.'],
        'friar': [f'A friar with a little bell begs for alms near {site}, {area}.'],
        'pilgrims': [f'Two pilgrims with staffs and scallop shells pass {site} on their way to somewhere holier.', f'Pilgrims in {c1} have stopped to rest near {site}, {area}.'],
        'pilgrimhorse': [f'A pilgrim on a slow mule plods over the pass by {site}.'],
        'scholar': [f'A scholar in a {c1} gown hurries past {site}, {area}, late for a lecture.'],
        'stall': [f'A woman sets out her market stall near {site}, {area}. The apples look good.'],
        'miller': [f'By {site}, {area}, a dusty miller heaves a sack of flour.'],
        'oxcart': [f'An ox cart piled high creaks along the lane near {site}, {area}.'],
        'ploughman': [f'A ploughman drives his ox across the fields near {site}, {area}.'],
        'pedlar': [f'A pedlar with a donkey and a pack of ribbons rests at {site}, {area}.'],
        'fisher': [f'Somebody is fishing quietly near {site}, {area}. Nothing is biting.'],
        'trollbare': [f'Something large and grey with a club lurks near {site}, {area}.'],
        'hedgewitch': [f'At {site}, {area}, a witch in a tall hat stirs her cauldron.'],
        'milkmaid': [f'A milkmaid carries two pails on a yoke beside her cow, near {site}.'],
        'fairyring': [f'A ring of red toadstools and two tiny dancers, near {site}, {area}.'],
        'wisp': [f'Strange lights float in the dusk near {site}, {area}.'],
        'piper': [f'A piper plays for no one near {site}, {area}.'],
        'shepherd': [f'A shepherd in a {cw(p.get("hatc") or "straw")} hat leans on his crook near {site}, {area}.', f'Sheep, and a shepherd shading his eyes, near {site}.'],
        'wight': [f'A pale crowned thing keeps watch by {site}, {area}. Do not linger.'],
        'lostsheep': [f'One sheep has strayed and is grazing all alone near {site}, {area}.'],
        'hermit': [f'A hermit with a long white beard has a cave near {site}, {area}.'],
        'miner': [f'A miner in white heads into the hill near {site}, {area}.'],
        'goblins': [f'Little green folk with lanterns are up to no good near {site}, {area}.'],
        'woodcutter': [f'A woodcutter swings his axe at a tree near {site}, {area}.'],
        'smugglers': [f'Barrels by lantern light: smugglers are busy near {site}, {area}.'],
        'ghostknight': [f'A pale knight still walks the field of the {site}.'],
        'cockatrice': [f'A cockerel with a serpent\'s tail roosts in the ruins at {site}, {area}.'],
        'swineherd': [f'A swineherd and his pigs root about near {site}, {area}.'],
        'banshee': [f'A pale woman keens on the hill near {site}, {area}.'],
        'brownie': [f'A little brown helper with a broom sweeps up near {site}, {area}.'],
        'wolves': [f'Wolves watch the village from the woods near {site}, {area}.'],
        'cartographer_world': [f'A travelling mapmaker with a staff and a sheet of paper is measuring {site}, {area}.'],
        'skaters': [f'Two skaters glide on the ice near {site}, {area}.'],
        'sledge': [f'Someone in a fur hat drags a sledge through the snow near {site}, {area}.'],
        'vikingfoot': [f'A bearded Norseman with a round shield strolls near {site}, {area}.'],
        'reindeerherder': [f'A herder in blue walks with a reindeer near {site}, {area}.'],
        'alphorn': [f'A long low note: someone is blowing a horn near {site}, {area}.'],
        'tatzelwurm': [f'A stumpy worm with a cat\'s face hides among the stones near {site}, {area}.'],
        'vintner': [f'A vintner in a straw hat picks grapes near {site}, {area}.'],
        'cossack': [f'A horseman waving a sabre gallops near {site}, {area}.'],
        'horsearcher_hu': [f'A horse archer turns in the saddle near {site}, {area}.'],
        'babahut': [f'In the forest near {site}, a hut stands on bird legs.'],
        'caravan': [f'A camel caravan arrives at {site}, {area}, after a long dusty road.'],
        'bedouin': [f'A man in a white robe and headscarf leads his camel near {site}, {area}.'],
        'tuareg': [f'Riders veiled in indigo lead their camels past {site}, {area}.'],
        'falconer_ar': [f'A falconer in white with a hooded falcon waits near {site}, {area}.'],
        'ca_merchant': [f'A Silk Road merchant leads a two-humped camel past {site}, {area}.'],
        'eaglehunter': [f'A rider with a golden eagle on his arm passes {site}, {area}.'],
        'mongol': [f'A horse archer of the steppe gallops past {site}, {area}.'],
        'elephant': [f'An elephant with a red and gold canopy sways past {site}, {area}.'],
        'in_pilgrim': [f'A pilgrim carries a pot of holy water near {site}, {area}.'],
        'in_sari': [f'A woman in a bright sari walks with a water jug near {site}, {area}.'],
        'porter': [f'A porter with a heavy load climbs the path near {site}, {area}.'],
        'monk_saffron': [f'A monk in a {cw(p.get("c1"))} robe walks with his bowl near {site}, {area}.'],
        'cn_scholar': [f'A scholar in a black hat stands on a bridge near {site}, {area}.'],
        'cn_farmer': [f'A farmer in a conical hat carries two buckets on a pole near {site}, {area}.'],
        'watchman_cn': [f'A guard with a halberd stands watch near {site}, {area}.'],
        'rice': [f'A farmer in a conical hat works the paddy near {site}, {area}, with a buffalo close by.'],
        'samurai': [f'A samurai with his hand on his sword walks the road near {site}, {area}.'],
        'jp_pilgrim': [f'A pilgrim in white with a straw hat walks near {site}, {area}.'],
        'jp_farmer': [f'A farmer in a straw hat bends over the field near {site}, {area}.'],
        'kr_scholar': [f'A scholar in a wide black hat strolls near {site}, {area}.'],
        'aztec': [f'A runner in a white cape carries news past {site}, {area}.'],
        'maya': [f'A scribe with a folded book walks near {site}, {area}.'],
        'chasqui': [f'A relay runner blows a conch shell near {site}, {area}.'],
        'llamaherder': [f'A herder in a poncho and knitted cap leads a llama near {site}, {area}.'],
        'gaucho': [f'A horseman in a poncho rides across the grass near {site}, {area}.'],
        'drover': [f'A drover on horseback moves sheep along near {site}, {area}.'],
        'dutchsailor': [f'A sailor with a hammer and a post has landed near {site}, {area}.'],
        'wildman': [f'Something tall and hairy hides behind a tree near {site}, {area}.'],
        'sleeper': [f'A man with a grey beard is fast asleep under a tree near {site}, {area}.'],
        'griot': [f'A griot plays a many-stringed harp near {site}, {area}.'],
        'marketwoman': [f'A trader in bright cloth sets out her pots near {site}, {area}.'],
        'sahel_horseman': [f'A horseman with a spear and a richly covered horse rides near {site}, {area}.'],
        'scholar_tk': [f'A scholar in a turban carries a precious book near {site}, {area}.'],
        'maasai': [f'A herder in red with his cattle near {site}, {area}.'],
        'ankole': [f'A herder walks beside a cow with enormous horns near {site}, {area}.'],
        'et_pilgrim': [f'A pilgrim in white carries a cross near {site}, {area}.'],
        'zulu': [f'Two warriors with cowhide shields walk the hills near {site}, {area}.'],
        'nguni': [f'A herder walks beside a patterned cow near {site}, {area}.'],
        'basotho': [f'A rider in a blanket and a woven hat crosses the grassland near {site}, {area}.'],
        'zebuherder': [f'A herder brings a humped zebu along the road near {site}, {area}.'],
        'explorer_penguins': [f'An explorer is being inspected by penguins near {site}.'],
        'basilisk': [f'Something scaly with a crest and a deadly stare lies in the sand near {site}, {area}.'],
        'friar': [f'A friar with a little bell walks near {site}, {area}.'],
    }
    base = arch.split('_')[0] if arch not in T else arch
    for k in (arch, base, re.sub(r'_(eu|af|am|pac|mena|ol|in|sa|us|mx|ca|gl|es)$', '', arch)):
        if k in T:
            return v.pick(T[k])
    if arch.startswith('fisher_beach'):
        return f'A fisher mends a net beside a canoe drawn up on the shore near {site}, {area}.'
    if arch.startswith('zebuherder'):
        return T['zebuherder'][0]
    if arch.startswith('monk'):
        return T['monk_saffron'][0] if 'saffron' in arch or 'maroon' in arch or 'russet' in arch else T['monk'][0]
    return f'Someone is hiding near {site}, {area}.'


NAMES = {'knight': 'Knight', 'watchman': 'Watchman', 'archer': 'Archer', 'falconer': 'Falconer', 'messenger': 'Messenger', 'rider': 'Rider', 'minstrel': 'Minstrel', 'jester': 'Jester',
         'merchant': 'Merchant', 'goosegirl': 'Goose girl', 'monk': 'Monk', 'nun': 'Nun', 'friar': 'Friar', 'pilgrims': 'Pilgrims', 'pilgrimhorse': 'Pilgrim on a mule', 'scholar': 'Scholar',
         'stall': 'Market stall', 'miller': 'Miller', 'oxcart': 'Ox cart', 'ploughman': 'Ploughman', 'pedlar': 'Pedlar', 'fisher': 'Angler', 'trollbare': 'Troll', 'hedgewitch': 'Hedge-witch',
         'milkmaid': 'Milkmaid', 'fairyring': 'Fairy ring', 'wisp': "Will-o'-the-wisp", 'piper': 'Piper', 'shepherd': 'Shepherd', 'wight': 'Barrow-wight', 'lostsheep': 'Lost sheep',
         'hermit': 'Hermit', 'miner': 'Miner', 'goblins': 'Goblins', 'woodcutter': 'Woodcutter', 'smugglers': 'Smugglers', 'ghostknight': 'Ghost knight', 'cockatrice': 'Cockatrice',
         'swineherd': 'Swineherd', 'banshee': 'Banshee', 'brownie': 'Brownie', 'wolves': 'Wolf pack', 'cartographer_world': 'Travelling mapmaker', 'skaters': 'Skaters', 'sledge': 'Sledge',
         'vikingfoot': 'Norseman', 'reindeerherder': 'Reindeer herder', 'alphorn': 'Horn player', 'tatzelwurm': 'Tatzelwurm', 'vintner': 'Vintner', 'cossack': 'Cossack rider',
         'horsearcher_hu': 'Horse archer', 'babahut': 'Hut on bird legs', 'caravan': 'Caravan', 'bedouin': 'Bedouin', 'tuareg': 'Tuareg caravan', 'falconer_ar': 'Falconer',
         'ca_merchant': 'Silk Road merchant', 'eaglehunter': 'Eagle hunter', 'mongol': 'Horse archer', 'elephant': 'Elephant procession', 'in_pilgrim': 'Pilgrim', 'in_sari': 'Water carrier',
         'porter': 'Porter', 'monk_saffron': 'Monk', 'cn_scholar': 'Scholar on a bridge', 'cn_farmer': 'Farmer with buckets', 'watchman_cn': 'Guard', 'rice': 'Rice farmer', 'samurai': 'Samurai',
         'jp_pilgrim': 'Pilgrim', 'jp_farmer': 'Farmer', 'kr_scholar': 'Scholar', 'aztec': 'Runner', 'maya': 'Scribe', 'chasqui': 'Relay runner', 'llamaherder': 'Llama herder', 'gaucho': 'Horseman',
         'drover': 'Drover', 'dutchsailor': 'Sailor', 'wildman': 'Wild man of the woods', 'sleeper': 'Sleeper', 'griot': 'Griot', 'marketwoman': 'Market trader', 'sahel_horseman': 'Horseman',
         'scholar_tk': 'Scholar', 'maasai': 'Herder', 'ankole': 'Herder', 'et_pilgrim': 'Pilgrim', 'zulu': 'Warriors', 'nguni': 'Herder', 'basotho': 'Horseman', 'zebuherder': 'Zebu herder',
         'explorer_penguins': 'Explorer', 'basilisk': 'Basilisk', 'fisher_beach': 'Fisher'}


def name_for(arch):
    for k in (arch, re.sub(r'_(eu|af|am|pac|mena|ol|in|sa|us|mx|ca|gl|es|maroon|russet)$', '', arch)):
        if k in NAMES:
            return NAMES[k]
    if arch.startswith('fisher_beach'):
        return 'Fisher'
    if arch.startswith('monk'):
        return 'Monk'
    return arch.replace('_', ' ').capitalize()


def clean_site(n):
    n = re.sub(r'\s*\(.*?\)', '', n).strip()
    return n


coast = land.boundary
CO_TREE = None


def near_coast(lat, lon, kmax=2.5):
    pt = Point(lon, lat)
    return coast.distance(pt) * 111 * max(0.3, math.cos(math.radians(lat))) < kmax


RURAL = {'natpark', 'ruins', 'hillfort', 'barrow', 'standing_stone', 'stone_circle', 'cave', 'waterfall', 'gorge', 'pass', 'spring', 'windmill', 'bridge', 'dmv', 'battle', 'lighthouse', 'monastery'}
RURAL_ONLY = {'babahut', 'tatzelwurm', 'trollbare', 'reindeerherder', 'alphorn', 'sledge', 'shepherd', 'woodcutter', 'wolves', 'lostsheep', 'wight', 'fairyring', 'wisp',
              'hermit', 'goblins', 'miner', 'ploughman', 'oxcart', 'zebuherder', 'nguni', 'ankole', 'maasai', 'llamaherder', 'gaucho', 'drover', 'basotho', 'eaglehunter', 'mongol', 'rice', 'jp_farmer', 'wildman', 'sleeper', 'tuareg', 'basilisk'}
COAST_ONLY = {'smugglers', 'fisher_beach', 'fisher_beach_am', 'fisher_beach_pac', 'fisher_beach_af', 'fisher_beach_eu', 'dutchsailor'}


def suits(arch, ic, la, lo):
    a = arch[0] if isinstance(arch, tuple) else arch
    if a in COAST_ONLY and not near_coast(la, lo):
        return False
    if a in RURAL_ONLY and ic not in RURAL and ic != 'town':
        return False
    return True


BUSHES = ['bush', 'bush', 'tree', 'reeds', 'rock']


def tuck(sp, v, p=0.35):
    """Put a bush, small tree or rock in front of some figures, so they are partly hidden."""
    if not v.chance(p) or any(f.get('t') == 'boat' or f.get('inBoat') or f.get('t') == 'water' for f in sp['figs']):
        return sp
    tgt = next((f for f in sp['figs'] if f.get('t') in ('person', 'beast')), None)
    if not tgt:
        return sp
    k = v.pick(BUSHES)
    fx = tgt['x'] + v.u(-3.5, 3.5)
    sp.setdefault('front', []).append({'t': 'set', 'k': k, 'x': round(fx, 2), 'y': round(tgt['y'] + 0.3, 2), 's': round(v.u(0.55, 0.8), 2), 'c': v.pick(['leaf', 'green', 'moss'])})
    return sp


def add_filler(iso, site, arch, kind_src, rng_seed, rkm, off_m=(70, 170)):
    v = V(rng_seed)
    if isinstance(arch, tuple):
        a, k = arch
        sp = ALL_ARCH[a](v, kind=k) if a == 'monk' else ALL_ARCH[a](v)
        arch = a
    else:
        sp = ALL_ARCH[arch](v)
    tuck(sp, v)
    lat, lon, nm = site
    ang = v.u(0, 2 * math.pi); d = v.u(*off_m)
    if not on_land(lat, lon):       # a site on a small island or the shore that Natural Earth misses: stay close
        d = min(d, 45)
    lat2, lon2 = offset(lat, lon, d * math.cos(ang), d * math.sin(ang))
    if on_land(lat, lon):
        lat2, lon2, moved = find_land(lat2, lon2, 600)
        if moved < 0:
            return False
    c = country_of(lat2, lon2)
    area = admin1_of(lat2, lon2) or c['admin']
    if area == nm:
        area = c['admin']
    site_n = clean_site(nm)
    rid = slug(name_for(arch) + '-' + site_n)
    base = rid; k = 2
    while any(x['id'] == rid for x in entries):
        rid = f'{base}-{k}'; k += 1
    entries.append(dict(id=rid, name=f'{name_for(arch)} at {site_n}' if len(site_n) < 48 else name_for(arch), place=(f'{site_n}, {area}' if area and area not in site_n else site_n)[:1].upper() + (f'{site_n}, {area}' if area and area not in site_n else site_n)[1:],
                        riddle=(lambda r: r[:1].upper() + r[1:])(riddle_for(arch, sp, site_n, area, v)), lat=round(lat2, 5), lon=round(lon2, 5), iso=c['iso'], country=c['admin'], region=region_of(c),
                        arch=arch, art=sp, src=kind_src, water=None, big=False, curated=False))
    return True


def pick_sites(iso, n, rkm, icons=None, extra=None):
    """Spread-out famous sites in a country (heritage first, then sister-study lists, then towns)."""
    out = []
    pool = [(r[0], r[1], r[4], r[2], 'Wikidata via the map\'s heritage layer (Q%s)' % r[5]) for r in BY_ISO.get(iso, []) if icons is None or r[2] in icons]
    if extra:
        pool = extra + pool
    for la, lo, nm, ic, src in pool:
        if len(out) >= n:
            break
        if len(nm) > 60 or nm.lower().startswith(('list of', 'site of')):
            continue
        if taken_near(la, lo, rkm) or any(km((la, lo), (o[0], o[1])) < rkm for o in out):
            continue
        out.append((la, lo, nm, ic, src))
    return out


# --- Europe (and Britain and Ireland): by site type, with each country's flavour
print('europe fillers')
dmv = []
try:
    for r in csv.DictReader(open(os.path.join(STUDIES, 'ghost-towns/data/england_dmv.csv'))):
        if r['confidence'] == 'high' and r['lat'] and r['type'] == 'DMV':
            dmv.append((float(r['lat']), float(r['lon']), f"the deserted village of {r['name']}", 'dmv', 'Beresford\'s gazetteer of deserted medieval villages, via the ghost-towns study'))
except Exception as ex:
    print('dmv', ex)
houses = defaultdict(list)
try:
    for r in csv.DictReader(open(os.path.join(STUDIES, 'holy-islands/data/houses.csv'))):
        if r['lat'] and int(r['sitelinks'] or 0) >= 4:
            houses[r['country']].append((int(r['sitelinks']), float(r['lat']), float(r['lon']), r['label'], r['wikidata']))
except Exception as ex:
    print('houses', ex)
for k in houses:
    houses[k].sort(reverse=True)

for iso, n in EU_N.items():
    have = sum(1 for x in entries if x['iso'] == iso)
    need = max(0, n - have)
    if not need:
        continue
    rkm = 9 if iso == 'GBR' else 14 if iso == 'IRL' else 22
    extra = []
    if iso == 'GBR':
        R0 = random.Random(7)
        d2 = dmv[:]; R0.shuffle(d2)
        extra = d2[:40]
    hs = [(la, lo, nm, 'monastery', f'holy-islands study (Wikidata {q})') for _, la, lo, nm, q in houses.get(iso, [])[:12]]
    sites = pick_sites(iso, need, rkm, extra=None)
    # interleave: heritage sites, monastic houses, deserted villages
    more = pick_sites(iso, need, rkm, icons=set(), extra=hs + extra)
    allsites = []
    for a, b in zip(sites, more + [None] * len(sites)):
        allsites.append(a)
        if b:
            allsites.append(b)
    allsites += more[len(sites):]
    used = 0
    v = V(seed(iso))
    flav = EU_FLAVOUR.get(iso, [])
    for la, lo, nm, ic, src in allsites:
        if used >= need:
            break
        if taken_near(la, lo, rkm):
            continue
        if ic == 'dmv':
            arch = v.pick(['shepherd', 'ploughman', 'goosegirl', 'swineherd', 'lostsheep', 'oxcart', 'milkmaid'])
        else:
            opts = [a for a in EU_BY_ICON.get(ic, ['pedlar', 'shepherd', 'stall']) if suits(a, ic, la, lo)] or ['pedlar', 'stall']
            fl = [a for a in flav if suits(a, ic, la, lo)]
            arch = v.pick(fl) if fl and v.chance(0.28) else v.pick(opts)
        if add_filler(iso, (la, lo, nm), arch, src, seed(iso + nm), rkm):
            used += 1

# --- medieval battlefields (every-battle study): ghost knights, a few per country
try:
    bat = []
    for r in csv.DictReader(open(os.path.join(STUDIES, 'every-battle/data/battles.csv'))):
        try:
            y = int(r['year']); sl = int(r['sitelinks'] or 0)
        except Exception:
            continue
        if 1000 <= y <= 1550 and r['lat'] and r['continent'] == 'Europe' and r['coord_from'] == 'own' and sl >= 12 and r['at_sea'] == 'no':
            bat.append((sl, float(r['lat']), float(r['lon']), r['label'], y, r['qid']))
    bat.sort(reverse=True)
    nb = 0
    for sl, la, lo, nm, y, q in bat:
        if nb >= 26:
            break
        if taken_near(la, lo, 25):
            continue
        v = V(seed(nm))
        sp = ARCH['ghostknight'](v) if v.chance(0.6) else ARCH['knight'](v)
        c = country_of(la, lo)
        lat2, lon2 = offset(la, lo, v.u(-150, 150), v.u(-150, 150))
        field = nm.replace('Battle of ', '')
        entries.append(dict(id=slug('field-' + field), name=f'On the field of {field}', place=f'{nm} ({y}), {admin1_of(la, lo) or c["admin"]}', riddle=v.pick([
            f'Where the {nm} was fought in {y}, a knight has never quite left the field.', f'In {y} two armies met at {field}. One knight is still looking for his horse, or his head.',
            f'Across the field of {field}, {y}: a knight in steel, pale as mist.']), lat=round(lat2, 5), lon=round(lon2, 5), iso=c['iso'], country=c['admin'], region=region_of(c),
            arch='ghostknight', art=sp, src=f'every-battle study (Wikidata {q})', water=None, big=False, curated=False))
        nb += 1
except Exception as ex:
    print('battles', ex)

# --- every country at least one; the big ones a few
print('world fillers')
capitals = defaultdict(list)
for p in pp:
    capitals[p['adm0_a3']].append(p)
for iso in capitals:
    capitals[iso].sort(key=lambda p: (-(p['adm0cap'] or 0), -(p['pop_max'] or 0)))
counted = sorted({c['iso'] for c in C_PROP if c['counts']})
for iso in counted:
    have = sum(1 for x in entries if x['iso'] == iso)
    want = max(1, EXTRA_N.get(iso, 1)) if iso not in EU_N else 1
    need = want - have
    if need <= 0:
        continue
    archs = WORLD.get(iso)
    if not archs:
        reg = REGION_OF.get(iso)
        archs = ['pedlar', 'shepherd', 'stall', 'knight'] if reg in ('Northern Europe', 'Western Europe', 'Southern Europe', 'Central and Eastern Europe') else ['cartographer_world']
    rkm = 120 if iso in ('USA', 'CAN', 'RUS', 'CHN', 'BRA', 'AUS', 'IND') else 40
    sites = pick_sites(iso, need, rkm)
    if any(a in COAST_ONLY for a in archs) and all(a in COAST_ONLY or a in RURAL_ONLY for a in archs):
        coastal = [s_ for s_ in pick_sites(iso, need * 6, rkm) if near_coast(s_[0], s_[1])]
        sites = (coastal + [s_ for s_ in sites if s_ not in coastal])[:max(need, 1)]
    if len(sites) < need:
        for p in capitals.get(iso, []):
            if len(sites) >= need:
                break
            la, lo = p['latitude'], p['longitude']
            if not taken_near(la, lo, rkm / 2) and not any(km((la, lo), (s[0], s[1])) < rkm / 2 for s in sites):
                sites.append((la, lo, p['name'], 'town', 'Natural Earth populated places'))
    if not sites and iso == 'ATA':
        continue
    v = V(seed(iso))
    for i, (la, lo, nm, ic, src) in enumerate(sites[:need]):
        ok = [a for a in archs if suits(a, ic, la, lo)]
        if not ok:
            ok = [a for a in archs if a not in COAST_ONLY] or ['cartographer_world']
            ok = [a for a in ok if a not in RURAL_ONLY] or ok
        arch = ok[i % len(ok)]
        add_filler(iso, (la, lo, nm), arch, src, seed(iso + nm + str(i)), rkm / 2, off_m=(90, 220))

# ------------------------------------------------------------------ treasure trails
TRAILS = [
    ('pages', "The Cartographer's lost pages", [
        ('cartographer', 'The Cartographer has dropped a page. It blew east, over the Pennines, to a green road where a pedlar walks his donkey above the Vale of York.'),
        ('pedlar-hambleton', 'The pedlar picked up the page and swapped it for a goose egg with a monk in the valley below. The goose was not consulted.'),
        ('monk-goose', 'The page is not here: the monk used it to wrap a gift for a shepherd far to the south-west, on a granite moor.'),
        ('shepherd-dartmoor', 'The shepherd tucked the page into his lost sheep\'s fleece for safe keeping. Now find the sheep.'),
        ('lostsheep-dartmoor', 'The page fell out by a stone hound. A traveller took it north to a bridge the Devil built over the Lune, and paid the toll with it.'),
        ('troll-kirkby', 'The troll cannot read and sent the page south in a hurry. It ended under a dragon asleep round a roundabout. Good luck.'),
        ('slough-dragon', 'You found every page. The map is whole again. The Cartographer thanks you, and asks if you know the way down.'),
    ]),
    ('pilgrim', 'The Pilgrim Road', [
        ('pilgrims-canterbury', 'From the shrine of the martyr, cross the sea and find the hill in Burgundy where crusades were preached.'),
        ('pilgrims-vezelay', 'Walk south to the town of volcanic needles where a chapel stands on a rock.'),
        ('pilgrims-lepuy', 'Over the Pyrenees by the pass where a hero blew his horn too late.'),
        ('pilgrims-roncesvalles', 'Westward across Spain to the last great climb, where the thatched round houses stand.'),
        ('pilgrims-cebreiro', 'Only a few days more, to the city of the apostle.'),
        ('pilgrims-santiago', 'Journey\'s end. Some pilgrims walk on to the sea at the end of the world. You may rest.'),
    ]),
    ('silk', 'The Silk Road', [
        ('gondolier-venice', 'A Venetian merchant set out east. Follow him to a great stone inn a day out of Konya.'),
        ('caravan-sultanhani', 'East again, across Persia to a fortified inn on the salt desert road to Isfahan.'),
        ('caravan-isfahan', 'Over the mountains to the square of three tiled madrasas in Samarkand.'),
        ('caravan-samarkand', 'Through the passes to the caves of a thousand buddhas at the edge of the Gobi.'),
        ('merchant-dunhuang', 'Down to the city of gardens and canals where a scholar composes on a bridge.'),
        ('scholar-suzhou', 'The silk has arrived. The scholar would like to know who ordered it.'),
    ]),
    ('dragons', 'Dragons of the North', [
        ('dragon-wawel', 'This dragon has a cousin who sleeps on a hoard by the mounds of the old Swedish kings.'),
        ('dragon-uppsala', 'Its own cousin crossed the North Sea to sleep by a ship burial in Suffolk.'),
        ('dragon-suttonhoo', 'In Wales, a red one still circles the hill where two dragons were found fighting.'),
        ('wyvern-emrys', 'A smaller one lives in a Somerset cave. A very small knight has found it.'),
        ('knight-wookey', 'The last of them was beaten on a flat hill below a white horse. Find the saint.'),
        ('stgeorge-uffington', 'Every dragon found. Saint George is relieved; the dragons less so.'),
    ]),
    ('sea', 'Round the World by Sea', [
        ('vikings-lindisfarne', 'The longship sails north to the island whirlpool, where something with many arms waits.'),
        ('kraken-lofoten', 'West past Iceland to the icebergs of Disko Bay, where a hunter paddles a kayak.'),
        ('kayak-ilulissat', 'South and inland, to voyageurs singing on the old fur route.'),
        ('kayak-quebec', 'All the way round to the far side of the world, a great canoe in a bay of islands.'),
        ('waka-waitangi', 'Home by way of the Nile, where a white sail leans in the wind at Luxor.'),
        ('felucca-luxor', 'You have sailed round the world. Even the kraken is impressed.'),
    ]),
]
by_id = {e['id']: e for e in entries}
for tid, tname, steps in TRAILS:
    for i, (eid, clue) in enumerate(steps):
        if eid not in by_id:
            raise SystemExit('trail step missing: ' + eid)
        by_id[eid].setdefault('trails', []).append({'t': tid, 'n': i + 1, 'of': len(steps), 'next': steps[i + 1][0] if i + 1 < len(steps) else None, 'clue': clue})

# ------------------------------------------------------------------ checks and output
ids = Counter(e['id'] for e in entries)
assert all(n == 1 for n in ids.values()), [k for k, n in ids.items() if n > 1]
bad = re.compile('[—–]|--|DSIT|DCMS')
for e in entries:
    for k in ('name', 'place', 'riddle'):
        assert not bad.search(e[k]), (e['id'], e[k])
missing = [c['admin'] for c in C_PROP if c['counts'] and not any(e['iso'] == c['iso'] for e in entries)]
reg = Counter(e['region'] for e in entries)
cont = Counter(country_of(e['lat'], e['lon'])['cont'] for e in entries)
print('total', len(entries), 'hand-placed', sum(e['curated'] for e in entries))
print('regions', reg.most_common())
print('missing countries', missing)
for l in log:
    print(' ', l)

TRAIL_META = [{'id': t, 'name': n, 'steps': [s[0] for s in st]} for t, n, st in TRAILS]
REG_ORDER = [r for r, _ in REGIONS[:5]] + ['Middle East and North Africa', 'Sub-Saharan Africa', 'Central Asia and the Caucasus', 'South Asia', 'East Asia', 'South-East Asia', 'North America', 'Mexico, Central America and the Caribbean', 'South America', 'Oceania', 'Antarctica']
out = {'version': 1, 'regions': [r for r in REG_ORDER if reg.get(r)], 'trails': TRAIL_META,
       'folk': [{k: e[k] for k in ('id', 'name', 'place', 'riddle', 'lat', 'lon', 'region', 'country', 'iso')} | {'art': e['art']} | ({'big': 1} if e['big'] else {}) | ({'trails': e['trails']} if e.get('trails') else {}) for e in entries]}
json.dump(out, open(os.path.join(OUT, 'folk.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(OUT, 'sources.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'name', 'place', 'lat', 'lon', 'country', 'region', 'archetype', 'hand_placed', 'water', 'source'])
    for e in entries:
        w.writerow([e['id'], e['name'], e['place'], e['lat'], e['lon'], e['country'], e['region'], e['arch'], int(e['curated']), e['water'] or '', e['src']])
summary = {'total': len(entries), 'hand_placed': sum(e['curated'] for e in entries), 'countries': len({e['iso'] for e in entries}), 'regions': dict(reg),
           'continents': dict(cont), 'trails': len(TRAILS), 'missing_countries': missing, 'bytes': os.path.getsize(os.path.join(OUT, 'folk.json'))}
json.dump(summary, open(os.path.join(OUT, 'folk_summary.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps(summary, ensure_ascii=False)[:600])
