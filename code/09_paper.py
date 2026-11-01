"""Build the paper: fill code/paper_template.tex from data/results.json and compile with xelatex.
Output: release/paper/Hotham_The_Inked_World.pdf and .tex (figures f_*.png beside them, from code/08_figures.py).
The DOI is 10.5281/zenodo.23860253."""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, DATA

R = json.load(open(os.path.join(DATA, 'results.json')))
OUT = os.path.join(ROOT, 'release', 'paper'); NAME = 'Hotham_The_Inked_World'
PAGE, REPO = 'https://maps.tristanhotham.com/ink-map/', 'https://github.com/Tristan-Hotham/ink-map'
m, L, S, MF = R['method'], R['labels'], R['render_stats'], R['method_figure']
f = lambda n: f'{n:,}'
abstract = (f"I describe a Tolkien-inspired map of the modern Earth. Hand-drawn maps, with rows of inked mountains, clusters of tiny trees, coasts traced with thin parallel lines and names lettered in red, "
            f"are made for one place at one scale. This is a zoomable map of the whole world in that style, generated in the reader's browser from open data: "
            f"OpenStreetMap vector tiles from OpenFreeMap and the AWS Terrain Tiles elevation model. Mountains and hills are placed on the highest points of a nested grid "
            f"of cells, where the relief clears a bar that grows with the size of the cell on the ground, from about {f(m['threshold_world_z2_lat30_m'])}~m for cells of "
            f"{m['cell_world_z2_lat30_km']}~km at zoom 2 to about {m['threshold_lakes_z11_m']}~m for cells of {m['cell_lakes_z11_m']}~m at zoom 11. Because the highest "
            f"point of a cell is also the highest point of one of its children, peaks persist as one zooms in and new ones fade in between them. A spacing rule keeps "
            f"glyphs off plain slopes, a ruggedness test keeps peaks off high flat plateaus and deserts, and a thinning rule keeps great ranges readable. Between the ranges, "
            f"dunes, grass, rainforest, taiga and ice glyphs follow the RESOLVE Ecoregions biomes; trees fill OpenStreetMap woods, nothing is drawn on water, and names are placed "
            f"before glyphs: {L['countries']} countries along fitted or hand-drawn curves, and {L['all_hand_placed']} hand-placed oceans, seas, ranges, deserts and "
            f"regions, cut to fit their text at every zoom. Every visual parameter is interpolated over zoom, so the map reads as one drawing from the globe to a single hill. "
            f"I set out the rules, show the result from the world to the Lake District, and discuss the limits.")
T = R['threshold_table_lat45']
rows = ''.join(f"{t['zoom']} & {t['cell_km']:.2f} & {t['mountain_m']:,} & {t['hill_m']:,}\\\\\n" for t in T)
table = ("\\begin{table}[tbp]\\centering\\small\\caption{Relief needed for a mountain and a hill, by rank (the zoom at which a cell is " + str(m['cell_px_mountains']) +
         " screen pixels across), for a cell at latitude 45 degrees.}\\label{tab:thresholds}\\begin{tabular}{rrrr}\\toprule Rank & Cell (km) & Mountain (m) & Hill (m)\\\\\\midrule\n" +
         rows + "\\bottomrule\\end{tabular}\\end{table}")
rmax_m = round([t for t in T if t['zoom'] == m['rank_max']][0]['cell_km'] * 1000, -1)
tok = {'ABSTRACT': abstract, 'TABLE': table, 'PAGE': PAGE, 'REPO': REPO, 'CELLPX': m['cell_px_mountains'], 'EXP': m['relief_exponent'],
       'A': int(m['relief_A_m']), 'HILLPC': round(m['hill_fraction'] * 100), 'SATNB': m['sat_neighbours'], 'SATHI': m['sat_higher'], 'SATQ': m['sat_q'],
       'RMAX': m['rank_max'], 'RMAXM': int(rmax_m), 'TREEZ': m['trees_from_zoom'], 'TUFTZ': m['tufts_from_zoom'], 'CT': m['cell_px_trees'], 'CU': m['cell_px_tufts'],
       'MONTN': R['biomes']['montane']['ecoregions'], 'GT': ', '.join(f'{g:g}' for g in m['rugged_bar_by_dem_zoom']), 'GHPC': round(m['hill_rugged_fraction'] * 100),
       'CAPM': m['cap_m'], 'CAPT': m['cap_t'], 'CAPSAT': m['cap_sat'], 'SATINK': m['sat_ink'], 'PLAT': m['plateau_factor'],
       'CARPET0': f(R['carpet_test']['uncapped']), 'CARPET1': f(R['carpet_test']['capped']),
       'MONT': m['montane_factor'], 'OPEN': m['open_biome_factor'], 'CB': 20,
       'CURVES': L['country_curves_by_hand'], 'HANDTOTAL': f(L['all_hand_placed']), 'UKTOTAL': L['hand_placed_total'], 'WORLDTOTAL': L['world_total'],
       'MF_CELL': MF['cell_m'], 'MF_RANK': MF['rank'], 'MF_T': MF['T_m'], 'MF_HILL': MF['hill_m'],
       'W_M': f(S['world']['mountains']), 'W_H': f(S['world']['hills']), 'A_M': f(S['asia']['mountains']), 'A_H': f(S['asia']['hills']),
       'L_M': f(S['lakes']['mountains']), 'L_H': f(S['lakes']['hills']), 'L_T': f(S['lakes']['trees']), 'L_U': f(S['lakes']['tufts'])}
t = open(os.path.join(ROOT, 'code', 'paper_template.tex'), encoding='utf-8').read()
for k, v in tok.items():
    t = t.replace('@@' + k + '@@', str(v))
assert '@@' not in t.replace('@@DOILINK@@', ''), re.findall(r'@@\w+@@', t)
for bad in ('--', '—', '–', 'DSIT', 'DCMS', 'civil serv'):
    assert bad not in t, bad
t = t.replace('@@DOILINK@@', '\\url{https://doi.org/10.5281/zenodo.23860253}')
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, NAME + '.tex'), 'w', encoding='utf-8').write(t)
for _ in range(2):
    r = subprocess.run(['xelatex', '-interaction=nonstopmode', NAME + '.tex'], cwd=OUT, capture_output=True, text=True)
log = open(os.path.join(OUT, NAME + '.log'), encoding='utf-8', errors='ignore').read()
print([l for l in log.splitlines() if 'Missing character' in l or 'undefined' in l.lower() or 'Overfull' in l][:10])
for ext in ('.aux', '.log', '.out', '.bbl', '.blg'):
    q = os.path.join(OUT, NAME + ext)
    if os.path.exists(q): os.remove(q)
txt = subprocess.run(['pdftotext', os.path.join(OUT, NAME + '.pdf'), '-'], capture_output=True, text=True).stdout
pages = subprocess.run(['pdfinfo', os.path.join(OUT, NAME + '.pdf')], capture_output=True, text=True).stdout
print('paper', r.returncode, len(txt.split()), 'words;', [l for l in pages.splitlines() if l.startswith('Pages')])
json.dump({'abstract': abstract}, open(os.path.join(OUT, 'abstract.json'), 'w'))
