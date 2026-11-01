"""Shared paths and helpers for the ink map.

Raw inputs (read in place, not redistributed):
  GEO   /home/claude/newdata/raw/geo/      Natural Earth (public domain) and ONS boundaries (OGL v3)
  RAW9  /home/claude/newdata/raw9/         offline test tiles: ofm/{z}/{x}/{y}.pbf (OpenFreeMap) and
                                           terrarium/{z}/{x}/{y}.png (AWS Terrain Tiles), used only for QA renders
  TTF   fonts from github.com/google/fonts (OFL), fetched by code/00_fetch_fonts.sh into $INK_TTF
"""
import os, json, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.environ.get('INK_GEO', '/home/claude/newdata/raw/geo')
RAW9 = os.environ.get('INK_RAW9', '/home/claude/newdata/raw9')
DATA = os.path.join(ROOT, 'data')
QA = os.path.join(ROOT, 'qa')

LIVE_TILEJSON = 'https://tiles.openfreemap.org/planet'
LIVE_DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'


def merc(lon, lat):
    """lon/lat -> normalised Web Mercator (0..1, y down)."""
    lat = max(-85.05, min(85.05, lat))
    x = (lon + 180.0) / 360.0
    s = math.sin(math.radians(lat))
    y = 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)
    return x, y


def unmerc(x, y):
    lon = x * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y))))
    return lon, lat


def dump(obj, path, nd=None):
    with open(path, 'w') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    return path
