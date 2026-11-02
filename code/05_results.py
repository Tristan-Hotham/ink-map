"""data/results.json: every number quoted on the page, in the README and in the Reddit post, with checks.

Method parameters are read from js/ink-worker.js (the code that draws the map), label counts from data/,
render counts from data/poster_stats.json (written by reddit/collage.py).
"""
import json, math, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, DATA, dump

W = open(os.path.join(ROOT, 'js', 'ink-worker.js')).read()
par = lambda k: float(re.search(r'\b' + k + r':\s*([0-9.]+)', W).group(1))
C, CT, CU, A = par('C'), par('CT'), par('CU'), par('A')
EXP = float(re.search(r'Math\.pow\(km, ([0-9.]+)\)', W).group(1))
HILL = par('HILL')
MONT, OPEN, GH = par('MONT'), par('OPEN'), par('GH')
GT = [float(v) for v in re.search(r'GT: \[([^\]]*)\]', W).group(1).split(',')]
SAT_NB, SAT_HI, SAT_Q, RMAX = int(par('SAT_NB')), int(par('SAT_HI')), par('SAT_Q'), int(par('RMAX'))


def threshold(rank, lat):
    # as in reliefPoints(): a rank-r point drawn from the tile at zoom r, elevation zoom d, coarse-DEM factor
    cw = C / (512 * 2 ** rank)
    km = max(0.05, cw * 40075 * math.cos(math.radians(lat)))
    d = rank + 1 if rank <= 9 else rank
    f = 0.5 if d <= 4 else 0.68 if d <= 6 else 0.85 if d <= 8 else 1
    return A * km ** EXP * f, km


t_world, km_world = threshold(2, 30)        # zoom 2, e.g. the Himalaya
t_gb, km_gb = threshold(6, 54.5)            # zoom 6, northern England
t_lakes, km_lakes = threshold(11, 54.5)     # zoom 11, the Lake District

countries = json.load(open(os.path.join(DATA, 'labels_countries.geojson')))['features']
regions = json.load(open(os.path.join(DATA, 'labels_regions.geojson')))['features']
names_c = {f['properties']['name'] for f in countries if f['properties']['kind'] == 'country'}
names_n = {f['properties']['name'] for f in countries if f['properties']['kind'] == 'nation'}
reg_land = {f['properties']['name'] for f in regions if f['properties']['kind'] in ('up', 'low') and f['properties']['uk'] == 1}
reg_sea = {f['properties']['name'] for f in regions if f['properties']['kind'] in ('sea', 'ocean') and f['properties']['uk'] == 1}
w_ocean = {f['properties']['name'] for f in regions if f['properties']['kind'] == 'ocean' and f['properties']['uk'] == 0}
w_sea = {f['properties']['name'] for f in regions if f['properties']['kind'] == 'sea' and f['properties']['uk'] == 0}
w_up = {f['properties']['name'] for f in regions if f['properties']['kind'] == 'up' and f['properties']['uk'] == 0}
w_low = {f['properties']['name'] for f in regions if f['properties']['kind'] == 'low' and f['properties']['uk'] == 0}
src02 = open(os.path.join(ROOT, 'code', '02_labels.py')).read()
n_curves = len(re.findall(r"'[A-Z]{3}': \[\(", src02[src02.index('COUNTRY_CURVES = {'):src02.index('\n}', src02.index('COUNTRY_CURVES = {'))]))
gaz = json.load(open(os.path.join(DATA, 'gazetteer.json')))

TT = []
for rk in range(1, 13):
    t, km = threshold(rk, 45)
    TT.append({'zoom': rk, 'cell_km': round(km, 2), 'mountain_m': round(t), 'hill_m': round(t * HILL)})

R = {
    'threshold_table_lat45': TT,
    'method': {
        'cell_px_mountains': int(C), 'cell_px_trees': int(CT), 'cell_px_tufts': int(CU),
        'relief_A_m': A, 'relief_exponent': EXP, 'hill_fraction': HILL,
        'threshold_world_z2_lat30_m': round(t_world), 'cell_world_z2_lat30_km': round(km_world),
        'threshold_gb_z6_m': round(t_gb), 'cell_gb_z6_km': round(km_gb, 1),
        'threshold_lakes_z11_m': round(t_lakes), 'cell_lakes_z11_m': round(km_lakes * 1000),
        'trees_from_zoom': 7, 'tufts_from_zoom': 9,
        'rugged_bar_by_dem_zoom': GT, 'montane_factor': MONT, 'open_biome_factor': OPEN, 'hill_rugged_fraction': GH,
        'cap_m': par('CAP_M'), 'cap_t': par('CAP_T'), 'cap_sat': par('CAP_SAT'), 'sat_ink': par('SAT_INK'), 'plateau_factor': par('PLAT'),
        'sat_neighbours': SAT_NB, 'sat_higher': SAT_HI, 'sat_q': SAT_Q, 'rank_max': RMAX,
    },
    'labels': {'countries': len(names_c), 'uk_nations': len(names_n), 'hand_placed_land': len(reg_land),
               'hand_placed_sea': len(reg_sea), 'hand_placed_total': len(reg_land) + len(reg_sea), 'gazetteer_entries': len(gaz),
               'world_oceans': len(w_ocean), 'world_seas': len(w_sea), 'world_ranges': len(w_up), 'world_regions': len(w_low),
               'world_total': len(w_ocean) + len(w_sea) + len(w_up) + len(w_low),
               'all_hand_placed': len(reg_land) + len(reg_sea) + len(w_ocean) + len(w_sea) + len(w_up) + len(w_low),
               'country_curves_by_hand': n_curves},
    'fonts': ['MedievalSharp', 'IM Fell English', 'IM Fell English SC', 'IM Fell Great Primer Italic'],
}
ps = os.path.join(DATA, 'poster_stats.json')
if os.path.exists(ps):
    P = json.load(open(ps))
    R['poster'] = {'mountains': P.get('mountains'), 'hills': P.get('hills'), 'glyphs': P.get('relief'), 'trees': P.get('trees'),
                   'zoom': round(P['zoom'], 2)}
R['biomes'] = json.load(open(os.path.join(DATA, 'biomes_legend.json')))
pw = os.path.join(DATA, 'poster_world_stats.json')
if os.path.exists(pw):
    P = json.load(open(pw))
    R['poster_world'] = {'mountains': P.get('mountains'), 'hills': P.get('hills'), 'glyphs': P.get('relief'), 'zoom': round(P['zoom'], 2)}
ct = os.path.join(DATA, 'carpet_test.json')
if os.path.exists(ct):
    R['carpet_test'] = json.load(open(ct))
mf = os.path.join(DATA, 'method_figure.json')
if os.path.exists(mf):
    R['method_figure'] = json.load(open(mf))
st = os.path.join(DATA, 'render_stats.json')
if os.path.exists(st):
    R['render_stats'] = json.load(open(st))
zs = {}
zp = os.path.join(DATA, 'zoom_sequence_stats.json')
if os.path.exists(zp):
    zs = json.load(open(zp))
R['zoom_sequence_glyphs_on_screen'] = zs
wi = os.path.join(DATA, 'world_ink_stats.json')
if os.path.exists(wi):
    W2 = json.load(open(wi))
    R['world_ink'] = {k: W2[k] for k in ('ranges', 'range_peaks', 'range_relief_m', 'range_min_elev_m', 'lower_range_relief_m', 'lower_range_min_elev_m',
                                         'range_window_km', 'dunes', 'rains', 'taigas')}
ll = os.path.join(DATA, 'lakes_lettered.geojson')
if os.path.exists(ll):
    R['labels']['lakes_lettered'] = len({f['properties']['name'] for f in json.load(open(ll))['features']})
dump(R, os.path.join(DATA, 'results.json'))

# ---- checks: every number in the public text must come from here
fmt = lambda n: f'{n:,}'
page = open(os.path.join(ROOT, 'index.html')).read()
m = R['method']
for needle in [f"about {m['cell_px_mountains']} screen pixels", f"about {fmt(m['threshold_world_z2_lat30_m'])} m", f"about {m['threshold_lakes_z11_m']} m",
               f"about {m['cell_world_z2_lat30_km']} km", f"about {m['cell_lakes_z11_m']} m across", f"{round(m['hill_fraction'] * 100)}% of that",
               f"{R['labels']['hand_placed_total']} names", f"({R['labels']['world_total']} names beyond", f"{R['labels']['world_total']} oceans",
               f"so are {R['labels']['country_curves_by_hand']} countries", f"cut to {round(MONT * 100)}%", f"{['', 'one', 'two', 'three', 'four'][m['sat_higher']]} or more higher mountains"]:
    assert needle in page, ('page', needle)
assert m['cap_m'] == 0.75 and 'three quarters of the patch' in page and m['cap_sat'] < 0.5 and 'under half' in page
assert m['plateau_factor'] == 2.5 and 'two and a half times' in page
if 'world_ink' in R:
    w = R['world_ink']
    for needle in [f"at least {fmt(w['range_relief_m'])} m within about {w['range_window_km']} km", f"above {w['range_min_elev_m']} m", f"count from {w['lower_range_relief_m']} m"]:
        assert needle in page, ('page', needle)
readme = os.path.join(ROOT, 'README.md')
if os.path.exists(readme) and 'poster' in R and not os.environ.get('INK_RESULTS_ONLY'):
    t = open(readme).read()
    for needle in ([fmt(R['poster']['mountains']), fmt(R['poster']['hills']), fmt(R['poster']['trees']), f"{m['threshold_lakes_z11_m']} m",
                   fmt(R['poster_world']['mountains']), fmt(R['labels']['all_hand_placed'])]
                  + ([fmt(R['world_ink']['ranges']), fmt(R['world_ink']['range_peaks']), f"{R['labels']['lakes_lettered']} lakes"] if 'world_ink' in R else [])):
        assert needle in t, ('readme', needle)
post = os.path.join(ROOT, 'reddit', 'post.md')
if os.path.exists(post) and 'poster' in R and not os.environ.get('INK_RESULTS_ONLY'):
    t = open(post).read()
    for needle in [fmt(R['poster']['mountains']), fmt(R['poster']['trees'])]:
        assert needle in t, ('post', needle)
# house rules on visible text
for path in ['index.html', 'README.md', 'reddit/post.md', 'reddit/poster.html', 'reddit/poster_world.html', 'release/blog/post.html', 'qa_live/index.html']:
    p = os.path.join(ROOT, path)
    if not os.path.exists(p): continue
    t = open(p).read()
    vis = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', t, flags=re.S)
    for bad in ['—', '–', ' -- ', 'DSIT', 'DCMS', 'civil serv']:
        assert bad not in vis, (path, bad)
print(json.dumps(R, indent=1)[:1500])
