"""Regional architecture grid for the drawn towns (round 5).

A 0.25 degree grid of the world (1440 x 720 cells, lon -180..180, lat 90..-90), each cell holding the key of an
architectural style region. js/ink-worker.js reads it (data/house_regions.json, run-length coded rows) to choose each
town's house drawings, its church or temple, its tall "medieval skyscrapers" and the travellers on its roads.

Countries come from Natural Earth (1:10m admin 0, ADM0_A3); a few regions are split inside a country:
  - the Cyclades (a box round the islands) inside Greece;
  - the Andean highlands: cells of Colombia, Ecuador, Peru, Bolivia, Chile and Argentina above 2,300 m (Terrarium
    elevation tiles at zoom 4, about 10 km a pixel);
  - West Africa: the Sahel north of 10.5 N (Hausa lands in northern Nigeria and southern Niger), the forest and coast south;
  - the Swahili coast: cells of Kenya, Tanzania, northern Mozambique and Somalia within about 70 km of the sea.
Cells with no country (the sea, and places not listed) take the region of the nearest listed cell.
"""
import json, os, math
import numpy as np
import rasterio.features
from rasterio.transform import from_origin
from scipy import ndimage
from PIL import Image
from common import DATA

GEO = '/home/claude/newdata/raw/geo/ne_10m_admin_0_countries.geojson'
DEM = '/home/claude/newdata/raw9/terrarium/4/{x}/{y}.png'
RES = 0.25
W, H = int(360 / RES), int(180 / RES)

KEYS = ['w', 'nl', 'na', 'de', 'al', 'sc', 'no', 'ru', 'ua', 'med', 'gr', 'cyc', 'bk', 'bkm', 'tr', 'cau', 'mn', 'il', 'mg', 'ca',
        'sh', 'ha', 'wa', 'sw', 'et', 'eaf', 'za', 'zw', 'in', 'np', 'pk', 'lk', 'cn', 'kr', 'jp', 'vn', 'th', 'mm', 'ml', 'ph',
        'pc', 'mx', 'sa', 'an']
C = {
    'w': 'GBR IRL FRA IMN JEY GGY MCO',
    'nl': 'NLD BEL LUX',
    'na': 'USA CAN AUS NZL SPM BMU NFK',
    'de': 'DEU POL CZE SVK HUN DNK EST LVA LTU SVN',
    'al': 'CHE AUT LIE',
    'sc': 'SWE FIN ISL FRO GRL ALD',
    'no': 'NOR',
    'ru': 'RUS BLR',
    'ua': 'UKR MDA',
    'med': 'ESP PRT ITA MLT AND SMR VAT GIB HRV',
    'gr': 'GRC CYP',
    'bk': 'SRB MNE MKD BGR ROU',
    'bkm': 'ALB KOS BIH',
    'tr': 'TUR CYN',
    'cau': 'GEO ARM',
    'mn': 'EGY SDN LBY JOR LBN SYR IRQ IRN SAU YEM OMN ARE QAT BHR KWT AZE DJI SOL SOM',
    'il': 'ISR PSX',
    'mg': 'MAR SAH DZA TUN',
    'ca': 'UZB TKM TJK KGZ KAZ AFG',
    'sh': 'MRT MLI NER TCD BFA SEN GMB CPV',
    'wa': 'GIN GNB SLE LBR CIV GHA TGO BEN NGA CMR COD COG GAB GNQ CAF STP',
    'eaf': 'SDS KEN UGA TZA RWA BDI MWI ZMB MOZ AGO NAM BWA MDG',
    'sw': 'COM SYC MUS',
    'et': 'ETH ERI',
    'za': 'ZAF LSO SWZ',
    'zw': 'ZWE',
    'in': 'IND',
    'np': 'NPL BTN',
    'pk': 'PAK BGD MDV',
    'lk': 'LKA',
    'cn': 'CHN TWN HKG MAC MNG PRK',
    'kr': 'KOR',
    'jp': 'JPN',
    'vn': 'VNM',
    'th': 'THA LAO KHM',
    'mm': 'MMR',
    'ml': 'MYS IDN BRN SGP',
    'ph': 'PHL TLS GUM MNP',
    'pc': 'PNG SLB VUT FJI NCL WSM TON',
    'mx': 'MEX GTM BLZ SLV HND NIC CRI PAN CUB DOM HTI PRI JAM',
    'sa': 'BRA ARG URY PRY VEN COL ECU PER BOL CHL GUY SUR',
}
iso2key = {iso: k for k, v in C.items() for iso in v.split()}
idx = {k: i + 1 for i, k in enumerate(KEYS)}   # 0 = unassigned

g = json.load(open(GEO))
shapes = []
for f in g['features']:
    a3 = f['properties']['ADM0_A3']
    k = iso2key.get(a3)
    if k:
        shapes.append((f['geometry'], idx[k]))
tr = from_origin(-180, 90, RES, RES)
grid = rasterio.features.rasterize(shapes, out_shape=(H, W), transform=tr, fill=0, dtype='uint8', all_touched=True)
land = rasterio.features.rasterize([(f['geometry'], 1) for f in g['features']], out_shape=(H, W), transform=tr, fill=0, dtype='uint8', all_touched=True)
iso = rasterio.features.rasterize([(f['geometry'], i + 1) for i, f in enumerate(g['features'])], out_shape=(H, W), transform=tr, fill=0, dtype='int32', all_touched=False)
a3of = {i + 1: f['properties']['ADM0_A3'] for i, f in enumerate(g['features'])}

lon = -180 + (np.arange(W) + 0.5) * RES
lat = 90 - (np.arange(H) + 0.5) * RES
LON, LAT = np.meshgrid(lon, lat)
isin = lambda codes: np.isin(np.vectorize(lambda v: a3of.get(v, ''))(iso), codes.split())

# the Cyclades
cyc = (grid == idx['gr']) & (LON > 24.2) & (LON < 26.1) & (LAT > 36.3) & (LAT < 37.75)
grid[cyc] = idx['cyc']

# West Africa: the Sahel north of 10.5 N, the Hausa lands of northern Nigeria and southern Niger
wa = isin('GIN GNB SLE LBR CIV GHA TGO BEN NGA CMR')
grid[wa & (LAT >= 10.5)] = idx['sh']
grid[(isin('NGA') & (LAT >= 10.0)) | (isin('NER') & (LAT < 15.0) & (LON > 5.5))] = idx['ha']

# the Swahili coast: within about 70 km of the sea
sea = land == 0
near_sea = ndimage.binary_dilation(sea, iterations=3)
sw = near_sea & (isin('KEN TZA SOM') | (isin('MOZ') & (LAT > -17)))
grid[sw] = idx['sw']

# the Andean highlands, from Terrarium elevation (zoom 4 mosaic, Web Mercator)
Z = 4; N = 2 ** Z
mos = np.zeros((N * 256, N * 256), dtype=np.float32)
for x in range(N):
    for y in range(N):
        p = DEM.format(x=x, y=y)
        if os.path.exists(p):
            a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)
            mos[y * 256:(y + 1) * 256, x * 256:(x + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
andes = isin('COL ECU PER BOL CHL ARG')
ys, xs = np.nonzero(andes)
mx_ = ((lon[xs] + 180) / 360 * N * 256).astype(int).clip(0, N * 256 - 1)
la = np.radians(lat[ys])
my_ = ((1 - np.log(np.tan(la) + 1 / np.cos(la)) / math.pi) / 2 * N * 256).astype(int).clip(0, N * 256 - 1)
hi = mos[my_, mx_] >= 2300
grid[ys[hi], xs[hi]] = idx['an']

# everything else: the nearest listed cell
_, (iy, ix) = ndimage.distance_transform_edt(grid == 0, return_indices=True)
grid = grid[iy, ix]

rows = []
for r in grid:
    out, cur, n = [], int(r[0]), 0
    for v in r:
        v = int(v)
        if v == cur: n += 1
        else: out += [cur - 1, n]; cur, n = v, 1
    out += [cur - 1, n]
    rows.append(','.join(map(str, out)))
doc = {'res': RES, 'w': W, 'h': H, 'keys': KEYS, 'rows': rows}
path = os.path.join(DATA, 'house_regions.json')
json.dump(doc, open(path, 'w'), separators=(',', ':'))
cnt = {k: int((grid == idx[k]).sum()) for k in KEYS}
print('house regions', os.path.getsize(path) // 1024, 'kB;', 'andes cells', int(hi.sum()), '; cells', cnt)
# a small preview for checking by eye
pal = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in
                [('%06x' % (hash(k) & 0xFFFFFF)) for k in KEYS]], dtype=np.uint8)
rs = np.random.RandomState(3); pal = rs.randint(40, 230, (len(KEYS), 3)).astype(np.uint8)
img = pal[grid - 1]; img[sea & (grid > 0)] = (img[sea & (grid > 0)] * 0.35 + 160).astype(np.uint8)
os.makedirs(os.path.join(os.path.dirname(DATA), 'qa'), exist_ok=True)
Image.fromarray(img).save(os.path.join(os.path.dirname(DATA), 'qa', 'house_regions.png'))
