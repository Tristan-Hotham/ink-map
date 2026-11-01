# The Inked World

A zoomable map of the whole world in the style of a hand-inked fantasy map, built only from open data: little ink peaks set on the real high ground, forests of tiny trees, black coasts with thin ripple lines and a soft blue wash, blue rivers and red hand-lettered names. It runs live in the browser on MapLibre GL JS, so it works everywhere from the whole world down to a single fell, with no tiles to host. 194 countries are lettered along curves (17 drawn by hand), and 167 oceans, seas, ranges, deserts, uplands and regions are lettered by hand: 105 around the world and 62 around Britain and Ireland.

Interactive page: https://maps.tristanhotham.com/ink-map/
Paper: https://doi.org/10.5281/zenodo.23860253
Blog post: https://blog.tristanhotham.com/2026/10/31/ink-map/
Code and data: https://github.com/Tristan-Hotham/ink-map

## What it does

- **Mountains and hills from elevation.** A background worker reads Terrarium elevation tiles, lays a grid of cells about 14 screen pixels across at the zoom where they first appear, and puts a peak on the highest point of each cell that rises far enough above the ground around it; lower rises get a rounded hill (at least 40% of the bar). The bar is relative relief and scales with the size of the cell on the ground: about 477 m for a 237 km cell at zoom 2 (measured on the coarse tiles used that far out), about 313 m for a 9.9 km cell over northern England at zoom 6, and about 130 m for a 311 m cell in the Lake District at zoom 11.
- **Rugged, not just high.** Each candidate peak is also tested on the mean slope of the ground close around it (metres per km on the elevation tiles), against a bar that rises with the detail of the tiles (4, 4.5, 5.5, 7.5, 10, 12, 13, 22, 30, 38, 48, 60, 70 for elevation zoom 0 to 12). In the 181 ecoregions named for mountains the bar is cut to 30%; in deserts, steppe, rainforest, taiga and tundra it is raised by 50%. So high flat plateaus and deserts get no peaks, while the Ahaggar, Tibesti and Atlas keep theirs.
- **Biomes.** Between the ranges the world is drawn by biome from RESOLVE Ecoregions 2017: crescent dunes (deserts), grass tufts (grassland, savanna and steppe), round crowns and palms (tropical rainforest), small conifers (boreal forest), blue hatching (ice, plus OpenStreetMap glaciers), marsh and tundra tufts. The mask ships as `data/biomes.png` (2048 pixels, web Mercator). Rainforest and taiga glyphs give way to OpenStreetMap woods from zoom 7.
- **Readable great ranges.** A spacing rule keeps glyphs off plain slopes. Where the ground is saturated with strong relief (at least 6 mountain neighbours, 3 of them higher, mean relief at least 2.2 times the bar, cells under 30 km), flank mountains are left out, so the Himalaya reads as ridges and summits rather than a solid mass. In hill country this almost never applies.
- **One drawing at every zoom.** Each cell splits into four at the next zoom and the highest point of a cell is also the highest point of one of its children, so the peaks drawn at one zoom are all still there at the next. New peaks fade in between them; glyph size, ink widths, letter size and spacing, the number of coastal ripples and the blue wash all change through interpolated expressions. `qa/zoom_sequence.png` (not in the repository) and the page figure show zooms 3 to 11.
- **Forests, marsh and moor.** Tree glyphs on a nested jittered grid inside OpenStreetMap woods (mostly conifers in woods tagged as forest), and tufts inside wetland and heath, from zoom 7 and 9.
- **Nothing on water.** Every glyph is checked against the OpenStreetMap water layer of its tile; mountains and hills also keep clear of the water's edge and stand above sea level, so seamounts and tiny islands far out never draw a lone peak in the ocean.
- **Names first.** Names never overlap each other and glyphs give way wherever a name sits. Curved names are stored once per zoom band and cut, or drawn out a little, to fit their text at that zoom; ranges are lettered along their flanks. OpenStreetMap's own label for a hand-lettered sea is hidden from the zoom where the hand lettering fits (`js/curated.js`).
- **Page tools.** Full-screen button, layers panel (ink mountains, forests, rivers, names, borders, roads, sea shading, hill shading and a plain modern map), search over 12,340 names plus every place and peak in the loaded tiles, start views (World, Europe, Great Britain, Yorkshire, Lake District), and a popup for every name and glyph.

## Images

- `reddit/the_inked_world.png` (3840 x 2400 px): the world at zoom 2.64 with 2,330 mountains and 2,056 hills, and Britain and Ireland as an inset.
- `reddit/britain_and_ireland_in_ink.png` (3600 x 4500 px): Britain and Ireland at zoom 7.14: 5,518 mountain glyphs, 10,433 hill glyphs and 2,920 trees.

## Files

| File | What it is |
|---|---|
| `index.html` | The interactive page (MapLibre GL JS 4.7.1 from jsDelivr; live OpenFreeMap vector tiles and AWS Terrain Tiles). |
| `js/ink-map.js` | The style, the glyph sprites (drawn on canvas in the browser), the paper texture and the `ink://` protocol. |
| `js/ink-worker.js` | Web worker: elevation, land cover and water to glyph points, returned as vector tiles. |
| `js/curated.js` | Hand-lettered sea names and the zoom from which they replace OpenStreetMap's labels (generated). |
| `fonts/` | SDF glyph sets for MapLibre ("Ink Caps", "Ink Roman", "Ink Italic", "Ink SC") made from MedievalSharp and IM Fell (SIL OFL 1.1); source TTFs and licences in `fonts/ttf/`. |
| `data/labels_countries.geojson` | Curved lettering lines for 194 countries and the 4 UK nations, one per zoom band. |
| `data/labels_regions.geojson` | The 167 hand-placed names, one line per zoom band (7 oceans, 38 seas, 31 ranges and 29 deserts and regions worldwide; 40 land and 22 sea names around Britain and Ireland). |
| `data/biomes.png`, `data/biomes_legend.json` | Biome mask from RESOLVE Ecoregions 2017 (CC BY 4.0): pixel value 32 x class + 16 for ecoregions named for mountains; legend with classes and pixel counts. |
| `data/gazetteer.json` | Search names: Natural Earth countries, populated places and states, and the hand-placed names. |
| `data/results.json` | Every number quoted on the page, in this README, the paper, the blog and the Reddit post. |
| `data/*_stats.json`, `data/method_cells.csv` | Glyph counts in the renders; the cells behind the method figure. |
| `img/` | Page figures. |
| `qa_live/` | Live QA: `index.html` steps one map through views in the Alps, Himalaya, Rockies, Andes, Sahara, Japan, New Zealand, Norway and Britain and keeps snapshots and counts; `run_live.js` does the same headless with Playwright; `views.json` lists the views. |
| `code/` | Scripts, run in order (below), and the paper template. |
| `release/` | Paper PDF and LaTeX source, blog post and figures, Zenodo files. |
| `reddit/` | Poster pages, `collage.py`, the two images and `post.md`. |

## Live QA

After publishing, open https://maps.tristanhotham.com/ink-map/qa_live/ and press "Run all views" (or add `?auto`; `?only=alps` runs a subset). Each view shows a snapshot, glyph and label counts, and what to look for. Headless: `node qa_live/run_live.js` writes the snapshots and `counts.json`.

## How to rerun

Needs Python 3 with numpy, shapely, fontTools, matplotlib and Pillow; xelatex and pdftotext; Node 22 with `fontnik` and Playwright with Chromium; `maplibre-gl@4.7.1` from npm for offline renders (set `MAPLIBRE_DIST`). Raw inputs are read in place (paths in `code/common.py`): Natural Earth and ONS boundaries, the RESOLVE ecoregion polygons (`INK_TEOW`), and for the offline renders saved OpenFreeMap tiles (world z0 to 3, the UK z4 to 8, North Yorkshire and the Lakes z9 to 10, the Lake District z11 to 12) and Terrarium tiles for the same areas plus the world at z0 to 4. The page always uses the live services.

```
node code/01_glyphs.js <folder of TTFs>   # SDF glyph ranges into fonts/
python3 code/02_labels.py                 # curved lettering lines, gazetteer, js/curated.js
python3 code/02b_biomes.py                # biome mask from RESOLVE Ecoregions 2017
python3 code/03_renders.py zoom           # zoom sequence (offline tiles)
python3 code/03_renders.py figs           # figure renders into release/figs
python3 code/03_renders.py views          # QA views; also: page, interact
python3 code/07_method_figure.py          # method figure
python3 reddit/collage.py                 # world poster and UK poster
python3 code/04_header.py                 # header.png
INK_RESULTS_ONLY=1 python3 code/05_results.py   # results.json
python3 code/08_figures.py                # paper and blog figures
python3 code/09_paper.py                  # paper PDF
python3 code/06_readme.py                 # this README
python3 code/10_release.py                # blog post, Zenodo files, Reddit post
python3 code/05_results.py                # checks every quoted number and the house rules
```

## Limits

- Peaks sit on the highest point of each grid cell, not on every named summit; their size shows local relief, not height. Far out the elevation tiles are coarse and smooth the summits, so the bar is lowered there.
- The thresholds and the thinning were tuned by eye in Britain and checked worldwide at low zoom and with a stress test (the Lake District with its relief multiplied by six); the high-zoom views of other ranges are for the live QA page.
- Woods only appear from zoom 7, because the vector tiles carry no land cover further out, and they are only as complete as OpenStreetMap.
- The biome mask is coarse (about 20 km per pixel at the equator) and its classes are broad; biome edges are soft, not surveyed. The montane hint comes from ecoregion names.
- The hand-placed names are my selection; smaller seas, bays and regions elsewhere come from OpenStreetMap, lettered straight.
- The glyphs are computed in the browser, so a new area takes a second or two, and very old browsers without OffscreenCanvas in workers show the map without glyphs.

## Sources and licences

- Map data © OpenStreetMap contributors (https://www.openstreetmap.org/copyright), Open Database Licence 1.0, as vector tiles from OpenFreeMap (https://openfreemap.org) in the OpenMapTiles schema (© OpenMapTiles). The repository holds no tile data; renders that show it carry the credit.
- AWS Terrain Tiles (https://registry.opendata.aws/terrain-tiles/), Terrarium encoding, by Mapzen from SRTM, GMTED2010, ETOPO1, NED, the Canadian DEM and other sources.
- RESOLVE Ecoregions 2017 (Dinerstein, E. et al. 2017, An ecoregion-based approach to protecting half the terrestrial realm, BioScience 67(6), 534 to 545, https://doi.org/10.1093/biosci/bix014; https://ecoregions.appspot.com/), CC BY 4.0; read from the simplified copy in CatalogueOfLife/col-gazetteers (teow/). The biome mask is a derived raster under CC BY 4.0.
- Natural Earth (public domain): 1:50m admin 0 countries, 1:10m populated places and states and provinces.
- Office for National Statistics, Local Authority Districts (2023), Open Government Licence v3.0; contains OS data © Crown copyright and database right 2023.
- Fonts: MedievalSharp, IM Fell English, IM Fell English SC, IM Fell Great Primer Italic (SIL Open Font License 1.1).
- MapLibre GL JS (BSD 3-Clause).

Code is MIT; text, figures and the derived label files are CC BY 4.0; fonts OFL; renders contain OpenStreetMap data (ODbL). See `LICENSE`.

The design is my own, made from drawing rules applied to data. It was inspired by the general look of hand-drawn maps; no artwork, lettering, cartouche or emblem from any map was traced or reused.

## Citation

Hotham, T. (2026) The Inked World: a zoomable map of the whole world in the style of a hand-inked fantasy map, generated from open elevation and OpenStreetMap data. Zenodo. https://doi.org/10.5281/zenodo.23860253

Dr Tristan Hotham, Independent researcher. ORCID 0000-0003-4931-9349.

I wrote the text, with drafting and editing assistance from Claude (Anthropic), which also helped prepare the analysis code. I reviewed and checked all text and results.
