"""Figure explaining the mountain rule, computed from real elevation over the central Lake District.

A Python transcription of reliefPoints() in js/ink-worker.js for one rank (cells of 14 screen px at zoom 10,
about 0.6 km), without the spacing and saturation steps. Panel a: shaded elevation with the grid; panel b: each
cell's highest point marked as a mountain (relief at least T), a hill (at least 0.4 T) or nothing.
Input: Terrarium tiles z11 from RAW9 (offline copies of the AWS Terrain Tiles).
Output: release/figs/method.png and data/method_cells.csv
"""
import os, sys, math, csv
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from matplotlib import font_manager as fm
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, RAW9, DATA, merc

OUT = os.path.join(ROOT, 'release', 'figs'); os.makedirs(OUT, exist_ok=True)
REF = os.environ.get('INK_REF_FONTS', '/home/claude/ref/fonts')
for f in ('SourceSerif4-Regular.ttf', 'IBMPlexMono-Regular.ttf'):
    fm.fontManager.addfont(os.path.join(REF, f))
fm.fontManager.addfont(os.path.join(ROOT, 'fonts', 'ttf', 'IMFeENrm28P.ttf'))
plt.rcParams.update({'font.family': 'IBM Plex Mono', 'font.size': 9})

W = open(os.path.join(ROOT, 'js', 'ink-worker.js')).read()
import re
A = float(re.search(r'\bA:\s*([0-9.]+)', W).group(1)); C = float(re.search(r'\bC:\s*([0-9.]+)', W).group(1))
HILL = float(re.search(r'\bHILL:\s*([0-9.]+)', W).group(1))

Z = 11
tiles = sorted((int(x), int(y[:-4])) for x in os.listdir(f'{RAW9}/terrarium/{Z}') for y in os.listdir(f'{RAW9}/terrarium/{Z}/{x}'))
xs = sorted({t[0] for t in tiles}); ys = sorted({t[1] for t in tiles})
E = np.zeros((256 * len(ys), 256 * len(xs)), np.float32)
for i, x in enumerate(xs):
    for j, y in enumerate(ys):
        a = np.asarray(Image.open(f'{RAW9}/terrarium/{Z}/{x}/{y}.png').convert('RGB')).astype(np.float32)
        E[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
px0, py0 = xs[0] * 256, ys[0] * 256
S = 256 * 2 ** Z

rank = 10
cell = C / (512 * 2 ** rank)                       # normalised Mercator units
cpx = cell * S                                      # DEM pixels per cell (7 * 2 = 14 here)
ny_mid = (py0 + E.shape[0] / 2) / S
lat_mid = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ny_mid))))
km = cell * 40075 * math.cos(math.radians(lat_mid))
T = A * km ** 0.3
nI, nJ = int(E.shape[1] // cpx), int(E.shape[0] // cpx)
mx = np.full((nJ, nI), -1e9); mn = np.full((nJ, nI), 1e9); arg = np.zeros((nJ, nI, 2))
for J in range(nJ):
    for I in range(nI):
        blk = E[int(J * cpx):int((J + 1) * cpx), int(I * cpx):int((I + 1) * cpx)]
        mx[J, I] = blk.max(); mn[J, I] = blk.min()
        k = np.unravel_index(blk.argmax(), blk.shape)
        arg[J, I] = (I * cpx + k[1], J * cpx + k[0])
kinds = np.full((nJ, nI), -1); rel = np.zeros((nJ, nI)); cand = np.zeros((nJ, nI), bool)
for J in range(1, nJ - 1):
    for I in range(1, nI - 1):
        lo = max(mn[J - 1:J + 2, I - 1:I + 2].min(), 0)
        rel[J, I] = mx[J, I] - lo
        if mx[J, I] < 3: continue
        kinds[J, I] = 0 if rel[J, I] >= T else 1 if rel[J, I] >= HILL * T else -1
cand = kinds >= 0
# spacing rule: drop a point when a neighbouring cell's higher point lies within `sep` of a cell width
sep = 0.55 if km >= 1 else 1.0 if km <= 0.1 else 0.55 + 0.45 * (1 - (math.log10(km) + 1))
for J in range(1, nJ - 1):
    for I in range(1, nI - 1):
        if kinds[J, I] < 0: continue
        for dj in (-1, 0, 1):
            for di in (-1, 0, 1):
                if not (di or dj): continue
                b = (J + dj, I + di)
                if mx[b] > mx[J, I] and np.hypot(*(arg[b] - arg[J, I])) < sep * cpx:
                    kinds[J, I] = -2
with open(os.path.join(DATA, 'method_cells.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['cell_i', 'cell_j', 'highest_m', 'relief_m', 'kind'])
    for J in range(1, nJ - 1):
        for I in range(1, nI - 1):
            w.writerow([I, J, round(float(mx[J, I])), round(float(rel[J, I])), {0: 'mountain', 1: 'hill', -1: '', -2: 'spaced out'}[int(kinds[J, I])]])

# window: about 12 by 12 cells around the central fells
cx, cy = (np.array(merc(-3.08, 54.48)) * S - [px0, py0])
win = 20 * cpx
x0, x1, y0, y1 = int(cx - win / 2), int(cx + win / 2), int(cy - win / 2), int(cy + win / 2)
sub = E[y0:y1, x0:x1]
ls = LightSource(azdeg=315, altdeg=40)
from matplotlib.colors import LinearSegmentedColormap
cm = LinearSegmentedColormap.from_list('parch', ['#E9D9AE', '#F6EED8', '#FFFDF5'])
shade = ls.shade(sub, cmap=cm, vert_exag=1.6, blend_mode='soft', vmin=0, vmax=950)
fig, axs = plt.subplots(1, 2, figsize=(10, 5.8), facecolor='#F6EED8')
for ax in axs:
    ax.imshow(shade, extent=(x0, x1, y1, y0)); ax.set_xlim(x0, x1); ax.set_ylim(y1, y0)
    ax.set_xticks([]); ax.set_yticks([])
    for J in range(int(y0 // cpx), int(y1 // cpx) + 2):
        ax.axhline(J * cpx, color='#2B2119', lw=0.4, alpha=0.5)
    for I in range(int(x0 // cpx), int(x1 // cpx) + 2):
        ax.axvline(I * cpx, color='#2B2119', lw=0.4, alpha=0.5)
nm = nh = 0
for J in range(nJ):
    for I in range(nI):
        gx, gy = arg[J, I]
        if not (x0 <= gx < x1 and y0 <= gy < y1): continue
        if cand[J, I]:
            axs[0].plot(gx, gy, 'o', color='#A3261B', ms=3.2)
        if kinds[J, I] == 0:
            axs[1].plot(gx, gy, marker='^', color='#2B2119', ms=8, mec='#F6EED8', mew=0.6); nm += 1
        elif kinds[J, I] == 1:
            axs[1].plot(gx, gy, marker=(2, 0, 90), color='#2B2119', ms=7, mew=1.6); nh += 1
axs[0].set_title(f'a  Highest point of each cell that rises at least\n   {HILL * T:.0f} m above the lowest ground around it', loc='left', fontsize=9.5)
axs[1].set_title(f'b  After the spacing rule: mountains (at least\n   {T:.0f} m) and hills', loc='left', fontsize=9.5)
fig.text(0.01, 0.015, f'Central Lake District. Cells {km * 1000:.0f} m across (14 screen pixels at zoom {rank}); elevation from AWS Terrain Tiles. '
         f'{int(cand[int(y0 // cpx):int(y1 // cpx) + 1, int(x0 // cpx):int(x1 // cpx) + 1].sum())} candidates; {nm} mountains and {nh} hills kept.', fontsize=7.5, color='#6E604E')
fig.tight_layout(rect=(0, 0.04, 1, 0.98))
fig.savefig(os.path.join(OUT, 'method.png'), dpi=180, facecolor=fig.get_facecolor())
print('method.png', round(km * 1000), 'm cells, T', round(T), 'mountains', nm, 'hills', nh)
import json
json.dump({'rank': rank, 'cell_m': round(km * 1000), 'T_m': round(T), 'hill_m': round(HILL * T), 'mountains': nm, 'hills': nh},
          open(os.path.join(DATA, 'method_figure.json'), 'w'))
