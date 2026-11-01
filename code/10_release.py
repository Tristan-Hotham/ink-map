"""Blog post and meta (release/blog), Zenodo files and metadata (release/zenodo), Reddit post (reddit/post.md).
10.5281/zenodo.23860253, https://doi.org/10.5281/zenodo.23860253 and https://blog.tristanhotham.com/2026/10/31/ink-map/ stay as placeholders for the publisher. Every number comes from data/results.json."""
import json, os, re, shutil, sys, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, DATA

R = json.load(open(os.path.join(DATA, 'results.json')))
REL = os.path.join(ROOT, 'release'); NAME = 'Hotham_The_Inked_World'
PAGE, REPO = 'https://maps.tristanhotham.com/ink-map/', 'https://github.com/Tristan-Hotham/ink-map'
m, L, S, PW, P = R['method'], R['labels'], R['render_stats'], R['poster_world'], R['poster']
f = lambda n: f'{n:,}'


def para(t): return f'<!-- wp:paragraph -->\n<p>{t}</p>\n<!-- /wp:paragraph -->\n\n'
def h2(t): return f'<!-- wp:heading -->\n<h2 class="wp-block-heading">{t}</h2>\n<!-- /wp:heading -->\n\n'
def img(fn, alt, cap): return f'{{{{IMG|{fn}|{alt}|{cap}}}}}\n\n'
def buttons(items):
    b = ''.join(f'<!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="{u}">{t}</a></div>\n<!-- /wp:button -->\n' for t, u in items)
    return f'<!-- wp:buttons -->\n<div class="wp-block-buttons">{b.rstrip()}</div>\n<!-- /wp:buttons -->\n\n'


post = (
    '<!-- wp:paragraph -->\n<p><em>The maps at the front of fantasy novels draw one place at one scale, by hand. I wanted one that draws the whole world, at every zoom, '
    'from open data: little ink peaks on the real high ground, forests of tiny trees, rippled coasts and red lettering, from the Pacific down to a single Lakeland fell.</em></p>\n<!-- /wp:paragraph -->\n\n'
    + buttons([('Explore the interactive version', PAGE), ('Read the paper', 'https://doi.org/10.5281/zenodo.23860253')])
    + para('Everyone knows the look. Rows of small inked mountains marching across the land, clusters of trees for the forests, the coast traced again and again with thin lines '
           'as if the sea were lapping at it, and the names of kingdoms and seas lettered in red, spaced wide and bent along the land. It is the look of the map in the front '
           'of a fantasy novel, and of a lot of older printed maps too. It is lovely, and it is always made by hand, for one place, at one scale.')
    + para('Web maps are the opposite: they show anywhere, at any zoom, in one smooth modern style. So I tried to make a map that does both. Everything on it is drawn by a '
           'rule from open data, live in your browser. Nothing is traced from any artist\'s map.')
    + img('b_world.png', 'A world map on yellow parchment. Coasts are black ink lines with thin blue ripples out to sea; the Rockies, Andes, Alps, Himalaya and the ranges of central Asia are rows of small inked peaks; country, ocean and sea names are lettered in red',
          'The whole world, drawn by the rules. Every peak stands on real high ground.')
    + h2('Mountains from elevation')
    + para(f'The mountains come from a free elevation model, the AWS Terrain Tiles. The map lays a grid over the land, with cells about {m["cell_px_mountains"]} screen pixels across, and finds the '
           f'highest point in each cell. If that point rises far enough above the lowest ground around it, it gets a little inked peak; if it rises less, a rounded hill; if hardly at all, nothing. '
           f'The trick is that "far enough" depends on the scale. Zoomed right out, where a cell is about {m["cell_world_z2_lat30_km"]} km across, a range has to rise about '
           f'{f(m["threshold_world_z2_lat30_m"])} m above its surroundings to earn a peak. In the Lake District at zoom 11, where a cell is about {m["cell_lakes_z11_m"]} m across, '
           f'a crag needs about {m["threshold_lakes_z11_m"]} m.')
    + img('b_method.png', 'Two panels of shaded elevation over the central Lake District with a square grid. Left: a red dot on the highest point of each cell that rises above its surroundings. Right: the same points after spacing, shown as black triangles for mountains and dashes for hills',
          'The rule on real elevation in the Lake District: each cell\'s highest point, then the peaks that are kept.')
    + para('Each cell splits into four as you zoom in, and the highest point of a cell is always the highest point of one of its four children. So a peak drawn at one zoom is still there at the next. '
           'Zooming in never swaps the mountains out; it adds smaller ones between them, fading them in. The pen width, the size of the lettering, the number of ripples along the coast and '
           'the blue wash on the sea all change smoothly with the zoom, so it stays one drawing.')
    + img('b_zoom.png', 'Nine panels of the ink map centred on the Lake District from zoom 3 to zoom 11: north-west Europe, the British Isles, northern England, Cumbria, then the fells with named peaks, villages, lakes and woods',
          'One continuous zoom, from zoom 3 to zoom 11. The same hand at every scale.')
    + h2('The glyphs')
    + para('The little drawings are painted by the page itself when it loads, with a slight wobble in every stroke: eight mountains with hatched shadow sides, eight rounded hills, broadleaf and conifer trees, '
           'tufts of marsh grass in blue and of moorland in black, and small symbols for cities, towns and villages. Trees only grow inside woods mapped in OpenStreetMap, and tufts inside its '
           f'wetlands and heaths, so close in you can see the real forests (from zoom {m["trees_from_zoom"]}) and moors (from zoom {m["tufts_from_zoom"]}).')
    + img('b_glyphs.png', 'A sheet of hand-drawn style glyphs on parchment: eight inked mountains with hatched shading, eight rounded hills, broadleaf and conifer trees, blue marsh tufts, black moorland tufts, crescent dunes, grass tufts, rainforest crowns and a palm, small taiga conifers, blue ice hatching, and settlement symbols',
          'The glyph set. Each one is drawn with a slight wobble so no line is perfectly straight.')
    + h2('Lettering the world')
    + para(f'On a hand-drawn map the names matter as much as the mountains. Countries are lettered in red capitals along a gentle curve fitted to their shape, and for {L["country_curves_by_hand"]} awkward ones, '
           f'such as Russia, Chile, Norway and Indonesia, I drew the curve myself. I also placed {f(L["all_hand_placed"])} names by hand: {L["hand_placed_total"]} hills, moors and seas around Britain and Ireland, '
           f'and {L["world_total"]} oceans, seas, ranges and deserts around the world, from the Pacific and the Sahara to the Tian Shan. Ranges are lettered along their flanks, '
           'where a map maker would leave room, not on top of the peaks. Names are placed first and never overlap, and the mountains step aside wherever a name sits.')
    + img('b_asia.png', 'The ink map of central and South Asia: dense rows of inked peaks over the Himalaya, the Tibetan Plateau, the Tian Shan and the mountains of Iran and Afghanistan, with HIMALAYA, TIBETAN PLATEAU, TAKLAMAKAN DESERT and country names lettered in red',
          'Central and South Asia. Great ranges stay readable as ridges and summits.')
    + '<!-- wp:pullquote -->\n<figure class="wp-block-pullquote"><blockquote><p>Zooming in never swaps the mountains out. It adds smaller ones between them.</p></blockquote></figure>\n<!-- /wp:pullquote -->\n\n'
    + para('Great ranges were the hardest part. In the Himalaya every patch of ground is steep, so every cell earns a peak and the map turns into a solid block of ink. So where the ground is saturated '
           f'with strong relief, a mountain that has {["", "one", "two", "three", "four"][m["sat_higher"]]} or more higher mountains around it is left out. What remains are the ridges and summits. '
           'In hill country like the Lake District this almost never kicks in, so the fells stay as rich as they were. And no glyph is ever drawn on water: each tile reads the sea and lakes from '
           'OpenStreetMap, so a seamount, or a speck of an island too small to see, never puts a lone mountain in the middle of the ocean.')
    + h2('Only where the mountains are')
    + para('My first world map had a problem: it put peaks across the Sahara, Arabia and the Australian interior. Those places are high, and on coarse elevation tiles they rise a long way above the nearest lowland, but they are not mountains. So every candidate peak now also has to be rugged: the ground close around it must be steep, by a bar that rises as the elevation gets more detailed. '
           f'In {R["biomes"]["montane"]["ecoregions"]} ecoregions whose very names say mountains, like the High Atlas or the Tibesti, the bar is lower; in open deserts, steppe and forest it is higher. The Ahaggar and Tibesti keep their peaks; the sand seas, the Great Plains and the floor of the Tibetan Plateau do not.')
    + para('Between the ranges the map is drawn by biome, from the RESOLVE Ecoregions map of the world\'s 846 ecoregions: crescent dunes in the deserts, sparse tufts on the steppe and savanna, crowded round crowns and the odd palm in the rainforest, small pointed conifers across the taiga, and pale blue hatching on the ice of Greenland and Antarctica.')
    + img('b_sahara.png', 'The ink map of the Sahara: small crescent dune glyphs fill the desert, clusters of inked peaks stand on the Atlas, the Ahaggar and the Tibesti, grass tufts dot the Sahel and round rainforest crowns line the Gulf of Guinea',
          'The Sahara: dunes, with peaks only where there are real mountains.')
    + img('b_amazon.png', 'The ink map of the Amazon basin covered in small rounded rainforest crowns and palms, with the Andes drawn as dense rows of peaks to the west',
          'The Amazon in rainforest crowns, the Andes in peaks.')
    + h2('Down to a single fell')
    + para(f'Close in, the map fills up with what OpenStreetMap knows: villages with little ink houses, rivers and lakes named in blue, fells with their heights, faint dotted roads and tracks. '
           f'In the view of the central Lake District below there are {f(S["lakes"]["mountains"])} mountains, {f(S["lakes"]["hills"])} hills, {f(S["lakes"]["trees"])} trees and '
           f'{f(S["lakes"]["tufts"])} tufts of moorland and marsh, each one placed by a rule.')
    + img('b_lakes.png', 'Close-up of the ink map over the central Lake District: inked peaks over the fells with names and heights such as Helvellyn 950 m, blue rivers and lakes including Grasmere, red village names such as Ambleside, small trees in the valleys and moorland tufts',
          'The central fells at zoom 11.')
    + h2('How I did this')
    + para('The page uses MapLibre, with vector tiles of OpenStreetMap from OpenFreeMap, which is free and needs no key, and the AWS Terrain Tiles for elevation. A small background worker turns '
           'elevation and land cover into glyph positions for each tile as you pan and zoom, so the whole world works with nothing pre-rendered. The lettering uses the free MedievalSharp and IM Fell '
           'fonts. There is a layers panel, including a plain modern map to check where you are, search for places and peaks, and a full-screen button. The paper sets out every rule and its limits: '
           'peaks sit on the high points of grid cells rather than on named summits, their size shows local relief rather than height, and woods are only as complete as OpenStreetMap.')
    + buttons([('Explore the interactive version', PAGE), ('Read the paper', 'https://doi.org/10.5281/zenodo.23860253'), ('Data and code', REPO)])
    + '<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">Notes and sources</h3>\n<!-- /wp:heading -->\n\n'
    + '<!-- wp:list -->\n<ul class="wp-block-list">'
    + ''.join(f'<!-- wp:list-item -->\n<li>{t}</li>\n<!-- /wp:list-item -->\n' for t in [
        'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (Open Database Licence), as vector tiles from <a href="https://openfreemap.org/">OpenFreeMap</a> in the <a href="https://openmaptiles.org/">OpenMapTiles</a> schema.',
        'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>, built by Mapzen from SRTM, GMTED2010, ETOPO1 and other sources.',
        'Biomes: RESOLVE <a href="https://ecoregions.appspot.com/">Ecoregions 2017</a> (CC BY 4.0), Dinerstein et al. (2017) <a href="https://doi.org/10.1093/biosci/bix014">BioScience 67, 534 to 545</a>.',
        '<a href="https://www.naturalearthdata.com/">Natural Earth</a> country outlines, places and states (public domain), and ONS Local Authority District boundaries (Open Government Licence v3.0), used for the lettering and search.',
        'Fonts: MedievalSharp and the IM Fell types (SIL Open Font License). Map library: <a href="https://maplibre.org/">MapLibre GL JS</a>.',
        'The design is my own; it was inspired by the general look of hand-drawn maps, and no artwork, lettering or emblem from any map was traced or reused.',
        'I wrote the text, with drafting and editing assistance from Claude (Anthropic), which also helped prepare the analysis code. I reviewed and checked all text and results.'])
    + '</ul>\n<!-- /wp:list -->\n')

used = re.findall(r'\{\{IMG\|([^|]+)\|', post)
assert 5 <= len(used) <= 8, len(used)
for u in used:
    assert os.path.exists(os.path.join(REL, 'blog', u)), u
for fn in os.listdir(os.path.join(REL, 'blog')):
    if fn.startswith('b_') and fn not in used:
        os.remove(os.path.join(REL, 'blog', fn))
assert set(re.findall(r'\{\{(?!IMG)[^}]*\}\}', post)) <= {'https://doi.org/10.5281/zenodo.23860253'}
vis = re.sub(r'<!--.*?-->', '', post, flags=re.S)
for bad in ('—', '–', '--', 'DSIT', 'DCMS', 'civil serv'):
    assert bad not in vis, bad
open(os.path.join(REL, 'blog', 'post.html'), 'w', encoding='utf-8').write(post)
meta = {'title': 'The Inked World: a hand-drawn style map of everywhere, from open data',
        'slug': 'ink-map',
        'excerpt': 'A zoomable map of the whole world in the style of a hand-inked fantasy map: little peaks on the real high ground, forests of tiny trees, rippled coasts and red lettering, drawn by rules from open data, from the globe down to a single fell.',
        'seo_description': 'A zoomable fantasy-style ink map of the whole world, drawn by rules from open elevation and OpenStreetMap data, from continents to single hills.',
        'tags': ['maps', 'cartography', 'fantasy maps', 'OpenStreetMap', 'elevation', 'biomes', 'data visualisation', 'open data'],
        'header_alt': "Title card reading 'The Inked World' in black and red on parchment, beside an ink-style map of Cumbria and the Yorkshire Dales with rows of small inked peaks, blue-rippled coasts and red names such as North Pennines and Yorkshire Dales."}
assert len(meta['seo_description']) < 160, len(meta['seo_description'])
json.dump(meta, open(os.path.join(REL, 'blog', 'meta.json'), 'w'), indent=2, ensure_ascii=False)
words = len(re.sub(r'<[^>]+>|\{\{IMG\|[^}]*\}\}', ' ', vis).split())

# ---- Zenodo
Z = os.path.join(REL, 'zenodo'); os.makedirs(Z, exist_ok=True)
for fn in os.listdir(Z):
    os.remove(os.path.join(Z, fn))
shutil.copy(os.path.join(REL, 'paper', NAME + '.pdf'), os.path.join(Z, NAME + '.pdf'))
zp = os.path.join(Z, 'ink-map_data_and_code.zip')
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for d in ('code', 'data', 'js', 'qa_live'):
        for fn in sorted(os.listdir(os.path.join(ROOT, d))):
            p = os.path.join(ROOT, d, fn)
            if fn == '__pycache__' or fn.endswith('.pyc') or os.path.isdir(p):
                continue
            z.write(p, f'ink-map/{d}/{fn}')
    for fn in ('README.md', 'LICENSE', 'index.html'):
        z.write(os.path.join(ROOT, fn), f'ink-map/{fn}')
    for fn in ('collage.py', 'poster.html', 'poster_world.html'):
        z.write(os.path.join(ROOT, 'reddit', fn), f'ink-map/reddit/{fn}')
    for fn in sorted(os.listdir(os.path.join(ROOT, 'fonts', 'ttf'))):
        z.write(os.path.join(ROOT, 'fonts', 'ttf', fn), f'ink-map/fonts/ttf/{fn}')
ab = json.load(open(os.path.join(REL, 'paper', 'abstract.json')))['abstract'].replace('~', ' ')
zmeta = {'title': 'The Inked World: A Zoomable Map of the Whole World in the Style of a Hand-Inked Fantasy Map, Generated from Open Elevation and OpenStreetMap Data',
         'upload_type': 'publication', 'publication_type': 'workingpaper',
         'description': f'<p>{ab}</p><p>Interactive version: <a href="{PAGE}">{PAGE}</a>. Data and code: <a href="{REPO}">{REPO}</a>. Blog post: {{https://blog.tristanhotham.com/2026/10/31/ink-map/}}.</p>'
                        '<p>Data: map data © OpenStreetMap contributors (ODbL 1.0), via OpenFreeMap and OpenMapTiles; elevation from the AWS Terrain Tiles (Mapzen; SRTM, GMTED2010, ETOPO1); '
                        'RESOLVE Ecoregions 2017 (CC BY 4.0); Natural Earth (public domain); ONS Local Authority District boundaries (OGL v3.0). Fonts under the SIL Open Font License. The archive holds no tile data.</p>',
         'creators': [{'name': 'Hotham, Tristan', 'affiliation': 'Independent researcher', 'orcid': '0000-0003-4931-9349'}],
         'keywords': ['cartography', 'generative maps', 'fantasy maps', 'OpenStreetMap', 'digital elevation model', 'biomes', 'ecoregions', 'MapLibre', 'label placement', 'open data'],
         'license': 'cc-by-4.0', 'language': 'eng',
         'related_identifiers': [{'identifier': REPO, 'relation': 'isSupplementedBy', 'resource_type': 'software'},
                                 {'identifier': PAGE, 'relation': 'isSupplementedBy', 'resource_type': 'other'},
                                 {'identifier': 'https://www.openstreetmap.org/', 'relation': 'isDerivedFrom', 'resource_type': 'dataset'},
                                 {'identifier': 'https://registry.opendata.aws/terrain-tiles/', 'relation': 'isDerivedFrom', 'resource_type': 'dataset'},
                                 {'identifier': '10.1093/biosci/bix014', 'relation': 'isDerivedFrom', 'resource_type': 'publication-article', 'scheme': 'doi'},
                                 {'identifier': 'https://www.naturalearthdata.com/', 'relation': 'isDerivedFrom', 'resource_type': 'dataset'}],
         'files': sorted(os.listdir(Z))}
sj = json.dumps(zmeta, ensure_ascii=False) + json.dumps(meta, ensure_ascii=False)
assert '—' not in sj and '–' not in sj and '--' not in sj
json.dump(zmeta, open(os.path.join(Z, 'metadata.json'), 'w'), indent=2, ensure_ascii=False)
print('blog words', words, 'figures', len(used), '; zenodo', sorted(os.listdir(Z)), os.path.getsize(zp) // 1024, 'KB zip')

# ---- Reddit post
post_md = f"""## Title

[OC] I drew the whole world as a hand-inked fantasy map using only open data: {f(PW['mountains'])} ink mountains, each placed by a rule on real elevation, zoomable from continents to single hills

## Body

No hand drawing: every glyph is placed by a rule. The map lays a grid over the land and puts a little ink peak on the highest point of each cell that rises far enough above its surroundings (a rounded hill if it rises less), and the bar scales with the cell: about {f(m['threshold_world_z2_lat30_m'])} m of relief for a {m['cell_world_z2_lat30_km']} km cell far out, about {m['threshold_lakes_z11_m']} m for a {m['cell_lakes_z11_m']} m cell in the Lake District. Peaks also need rugged ground, so the Sahara, Arabia and the Australian interior stay bare apart from their real ranges; deserts get dunes, rainforest round crowns, taiga small conifers and ice blue hatching (biomes from RESOLVE Ecoregions 2017). Nothing is drawn on water, names are placed first ({f(L['all_hand_placed'])} of them lettered by hand on curves) and the glyphs give way to them. The inset is Britain and Ireland from the same map; the interactive version keeps the same drawn look all the way down to single fells, with trees in OpenStreetMap's woods. Caveat: peaks show local relief, not exact heights, and woods are only as complete as OpenStreetMap.

Interactive map: {PAGE}

## Source comment

Data: map data © OpenStreetMap contributors (ODbL), served as vector tiles by OpenFreeMap (OpenMapTiles schema); elevation from AWS Terrain Tiles (Mapzen; SRTM, GMTED2010, ETOPO1 and others); biomes from RESOLVE Ecoregions 2017 (CC BY 4.0); country outlines from Natural Earth (public domain); UK nation boundaries from the ONS (OGL v3).

Tools: MapLibre GL JS with a custom web worker that turns elevation and land cover into glyph positions; glyphs drawn on canvas; fonts MedievalSharp and IM Fell (SIL OFL); Playwright for the render.

Images: the_inked_world.png (world, with a Britain and Ireland inset) and britain_and_ireland_in_ink.png ({f(P['mountains'])} mountains and {f(P['trees'])} trees).

Interactive version: {PAGE}
Paper: {{https://doi.org/10.5281/zenodo.23860253}}
Blog post: {{https://blog.tristanhotham.com/2026/10/31/ink-map/}}
"""
for bad in ('—', '–', '--', 'DSIT', 'DCMS'):
    assert bad not in post_md, bad
open(os.path.join(ROOT, 'reddit', 'post.md'), 'w', encoding='utf-8').write(post_md)
print('post.md written')
