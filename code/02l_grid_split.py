"""Cut the big point and line layers into 5 degree cells, so the page loads only the part of the world in view.

Run after 02e, 02g, 02i and 02k. Each feature goes to the cell of its middle point (the middle vertex of a line, the first
vertex of a polygon); the page loads the cells round the view, with a margin, once you zoom in to where they show.
  data/grid/index.json                 {layer: {"dir": folder, "cells": ["i_j", ...]}} of the cells that hold anything (i = floor((lon + 180) / 5),
                                       j = floor((lat + 90) / 5))
  data/grid/walls/i_j.json             town walls and other walls drawn from zoom 10 (walls.geojson stays whole as well, and
                                       data/walls_major.geojson holds the long walls drawn further out)
  data/grid/forts/i_j.json             star fort outlines (forts.geojson stays whole as well; data/forts_points.geojson holds
                                       the points)
  data/life/<layer>/i_j.json           the history layers from the sister studies (Roman roads, pilgrim routes, battles,
                                       lost villages, wrecks, monastic houses); these replace the whole-world files that
                                       code/02i_life_history.py writes, which are removed here (the cells hold the same rows)
"""
import json, os, glob, math
from common import DATA, dump

CELL = 5


def mid(g):
    t, c = g['type'], g['coordinates']
    if t == 'Point':
        return c
    if t == 'LineString':
        return c[len(c) // 2]
    if t == 'MultiLineString':
        l = max(c, key=len); return l[len(l) // 2]
    if t == 'Polygon':
        return c[0][0]
    if t == 'MultiPolygon':
        return c[0][0][0]
    raise ValueError(t)


def split(feats, outdir):
    os.makedirs(outdir, exist_ok=True)
    for f in glob.glob(os.path.join(outdir, '*.json')):
        os.remove(f)
    cells = {}
    for f in feats:
        lon, lat = mid(f['geometry'])
        k = '%d_%d' % (math.floor((lon + 180) / CELL), math.floor((max(-89.9, min(89.9, lat)) + 90) / CELL))
        cells.setdefault(k, []).append(f)
    for k, fs in cells.items():
        dump({'type': 'FeatureCollection', 'features': fs}, os.path.join(outdir, k + '.json'))
    return {'dir': os.path.relpath(outdir, os.path.dirname(DATA)) + '/', 'cells': sorted(cells)}


index = {}
w = json.load(open(os.path.join(DATA, 'walls.geojson')))['features']
index['walls'] = split([f for f in w if f['properties']['z'] >= 10.5], os.path.join(DATA, 'grid', 'walls'))
fo = json.load(open(os.path.join(DATA, 'forts.geojson')))['features']
index['forts'] = split([f for f in fo if f['geometry']['type'] != 'Point'], os.path.join(DATA, 'grid', 'forts'))
LIFE = {'roman': 'roman_roads', 'pilgrim': 'pilgrim_routes', 'battles': 'battles', 'dmv': 'lost_villages', 'wrecks': 'wrecks', 'monks': 'monasteries'}
for key, name in LIFE.items():
    whole = os.path.join(DATA, 'life', name + '.json')
    if os.path.exists(whole):
        feats = json.load(open(whole))['features']
        index[key] = split(feats, os.path.join(DATA, 'life', name))
        os.remove(whole)
    else:   # already split: keep the cells as they are
        index[key] = {'dir': 'data/life/%s/' % name, 'cells': sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(DATA, 'life', name, '*.json')))}
dump(index, os.path.join(DATA, 'grid', 'index.json'))
for k, v in index.items():
    print(k, v['dir'], len(v['cells']), 'cells')
