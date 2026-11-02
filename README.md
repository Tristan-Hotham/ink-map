# A Tolkien-style map of the whole world (The Inked World)

A Tolkien-style map of the whole real world: a zoomable map of the whole world in the style of a hand-inked fantasy map, built only from open data: little ink peaks set on the real high ground, forests of tiny trees, black coasts with thin ripple lines and a soft blue wash, blue rivers and red hand-lettered names. It runs live in the browser on MapLibre GL JS, so it works everywhere from the whole world down to a single fell, with no tiles to host. 194 countries are lettered along curves (17 drawn by hand), and 167 oceans, seas, ranges, deserts, uplands and regions are lettered by hand: 105 around the world and 62 around Britain and Ireland.

Interactive page: https://maps.tristanhotham.com/ink-map/
Paper: https://doi.org/10.5281/zenodo.23860253
Blog post: https://blog.tristanhotham.com/2026/10/31/ink-map/
Code and data: https://github.com/Tristan-Hotham/ink-map

## What it does

- **Mountains and hills from elevation.** A background worker reads Terrarium elevation tiles, lays a grid of cells about 14 screen pixels across at the zoom where they first appear, and puts a peak on the highest point of each cell that rises far enough above the ground around it; lower rises get a rounded hill (at least 40% of the bar). The bar is relative relief and scales with the size of the cell on the ground: about 477 m for a 237 km cell at zoom 2 (measured on the coarse tiles used that far out), about 313 m for a 9.9 km cell over northern England at zoom 6, and about 130 m for a 311 m cell in the Lake District at zoom 11.
- **Rugged, not just high.** Each candidate peak is also tested on the mean slope of the ground close around it (metres per km on the elevation tiles), against a bar that rises with the detail of the tiles (4, 4.5, 5.5, 7.5, 10, 12, 13, 22, 30, 38, 48, 60, 70 for elevation zoom 0 to 12). In the 181 ecoregions named for mountains the bar is cut to 30%; in deserts, steppe, rainforest, taiga and tundra it is raised by 50%. So high flat plateaus and deserts get no peaks, while the Ahaggar, Tibesti and Atlas keep theirs.
- **Biomes.** Between the ranges the world is drawn by biome from RESOLVE Ecoregions 2017: crescent dunes (deserts), grass tufts (grassland, savanna and steppe), round crowns and palms (tropical rainforest), small conifers (boreal forest), blue hatching (ice, plus OpenStreetMap glaciers), marsh and tundra tufts. The mask ships as `data/biomes.png` (2048 pixels, web Mercator). Rainforest and taiga glyphs give way to OpenStreetMap woods from zoom 7.
- **Ink cap.** Within each patch (a sixth of a tile each way), mountains are taken coarsest rank and most prominent first until their summed footprints, at the size the style draws them, reach 0.75 of the patch, or 0.45 where candidates would ink it more than 1.6 times over (a great range); hills fill up to 1.05. On the Tibetan Plateau ecoregions the ruggedness bar is multiplied by 2.5, so only the ranges are peaked. Dunes are drawn only in sandy and true deserts (by ecoregion name) or on OpenStreetMap sand; shrub steppes get grass tufts.
- **Readable great ranges.** A spacing rule keeps glyphs off plain slopes. Where the ground is saturated with strong relief (at least 6 mountain neighbours, 3 of them higher, mean relief at least 2.2 times the bar, cells under 30 km), flank mountains are left out, so the Himalaya reads as ridges and summits rather than a solid mass. In hill country this almost never applies.
- **One drawing at every zoom.** Each cell splits into four at the next zoom and the highest point of a cell is also the highest point of one of its children, so the peaks drawn at one zoom are all still there at the next. New peaks fade in between them; glyph size, ink widths, letter size and spacing, the number of coastal ripples and the blue wash all change through interpolated expressions. `qa/zoom_sequence.png` (not in the repository) and the page figure show zooms 3 to 11.
- **Forests, marsh and moor.** Tree glyphs on a nested jittered grid inside OpenStreetMap woods (mostly conifers in woods tagged as forest), and tufts inside wetland and heath, from zoom 7 and 9.
- **Nothing on water.** Every glyph is checked against the OpenStreetMap water layer of its tile; mountains and hills also keep clear of the water's edge and stand above sea level, so seamounts and tiny islands far out never draw a lone peak in the ocean.
- **Names first.** Names never overlap each other and glyphs give way wherever a name sits. Curved names are stored once per zoom band and cut, or drawn out a little, to fit their text at that zoom; ranges are lettered along their flanks. OpenStreetMap's own label for a hand-lettered sea is hidden from the zoom where the hand lettering fits (`js/curated.js`).
- **Heritage.** 256,650 heritage sites from Wikidata (castles, palaces, parliaments, churches, cathedrals, monasteries, great houses, ruins, stone circles, barrows, hillforts, battlefields, lighthouses, windmills, tall buildings, parks and natural features) are drawn as small pictograms, each from a zoom set by its number of Wikipedia articles, with names in red italic about a zoom and a half later. They ship as 1,196 JSON files on a zoom 6 grid (14.9 MB in all) read by the worker. 156 world-famous monuments have drawings of their own and show from zoom 2 to 5; Walls, dykes and aqueducts follow their OpenStreetMap lines, including every town wall mapped in OpenStreetMap (historic=citywalls or barrier=city_wall, as ways or as relations such as the Roman walls of Lugo), drawn with crenellations and towers. About a thousand star forts (bastion forts) have a drawing of their own (`code/02g_forts.py`): their real outline from OpenStreetMap forts, town walls and moats (pieces joined and tested for the arrowhead bastions of the trace italienne), with a blue moat outside and a hachured rampart inside, and a star-fort symbol further out, joined by a further thousand star forts and sconces from Wikidata that have no outline mapped.
- **Great summits and snow.** 535 summits (each country's and region's highest point and the famous peaks) get a larger drawing with name, height and a red flourish. Mountains above a snow line set by latitude get white caps with fine snow lines, and high rugged ground well above it is hatched pale blue.
- **Rivers, lakes and hills.** 1,057 named rivers and lake centrelines and 2,029 lakes from Natural Earth 1:10m are lettered in blue out to zoom 9 (`data/rivers.geojson`, `data/lakes.geojson`); OpenStreetMap's own names take over from zoom 9. 90,658 named hills from Wikidata (8,401 in Britain and Ireland, all of them; elsewhere those with two or more Wikipedia articles or above 1,500 m) are lettered with heights from zoom 10 where OpenStreetMap has no summit (`data/hills/`, 3.8 MB). Villages and hamlets in Britain and Ireland from Wikidata fill the places OpenStreetMap's tiles leave out (such as Blagdon Hill in Somerset), and named beaches worldwide from Wikidata are lettered along the shore in blue, from zoom 10 to 12; the worker drops any village the tile already names (`data/places/`).
- **Drawn towns.** From zoom 12 the worker lines the real streets with small townhouses facing them, densest round a market square and church at each place's centre and thinning outward with the buildings and built-up land in the tile (houses are placed from the centre outward, so the cap per tile only ever thins the edges). Every house is drawn from the same bird's-eye viewpoint, as on sixteenth-century town plans, with red tile and blue-grey slate roofs, and every village and hamlet gets a cluster of its own; capitals and large cities get a wall and towers round the old core.
- **Animals, ships and flight.** 63 animals in their native ranges and 19 whales where they gather (zoom 2 to 7), 3 decorative sea serpents at world zoom, 62 sailing ships leaving historic ports along CLIWOC passages, 11 busy airports drawn as flying machines taking off, other airports as small sketches, and 10 decorative balloons.
- **The world view.** Far out, 2,068 range lines found in the elevation itself (ground rising at least 1,000 m within about 40 km and standing above 600 m, plus long lower ranges from 650 m and 400 m, thinned to their centre lines on the zoom 4 Terrain Tiles) are drawn as rows of little peaks, 6,642 in all, nested so the rows thin evenly as you zoom out; 221 dune fields sit in the flat parts of the great sand seas (picked by RESOLVE ecoregion name) and 461 rainforest and 1,871 taiga tree marks band the forests (`data/world_ink.geojson`, `code/02h_world_ink.py`). They fade out between zoom 3 and 4 as the tile-by-tile glyphs take over. Countries and the great ranges are lettered smaller far out, so many more are named from zoom 1.5.
- **Britain's lettering.** "United Kingdom" runs along the island to zoom 5; England, Scotland and Wales are lettered on curves from zoom 5 and Northern Ireland on two lines. Capitals are placed before every other name, on a ribbon with a small shield, and the great cities on a banner; a drawn walled city marks them from zoom 6.5. Names lettered by hand hide their duplicates in Wikidata and OpenStreetMap (such as "Lake District National Park") while the lettering shows (`js/curated.js`).
- **Lakes.** The 15 lakes of the Lake District are lettered along their length in blue italic (`data/lakes_lettered.geojson`; the long axis fitted to the OpenStreetMap lake where the saved tiles have it), and OpenStreetMap's lake names are lettered along their centre lines elsewhere from zoom 9.
- **Countryside and parks.** From zoom 7 farmland and meadow get a faint wash; from about zoom 10 fields are hatched in ploughed strips (one of eight directions and tints per field, by its OpenStreetMap id), vineyards in rows of stakes, orchards as small trees, allotments as plots and meadows with tufts; parks and gardens get a green wash, trees, a railing line and parterres. National parks are named along the inside of their boundary. Main roads are pale tracks from zoom 8; quarries get a pick and shovel, harbours an anchor, piers an ink line. Lighthouses all show from zoom 8.
- **Beasts.** Deer, boar, sheep, cattle, eagles, herons and fish (and bears, wolves and reindeer in the taiga) are sprinkled in country that suits them from zoom 6 to 14, at most six a tile, in a bestiary style on a gilt ground; the far-out animals have the same treatment.
- **Smooth zooming.** Each tile keeps exactly the mountains its parent tile drew (carrying over any that the finer elevation would have measured differently), finished tiles are cached in the worker, names that are not yet visible no longer push glyphs aside, and symbols cross-fade over 0.4 s.
- **Edges of the world.** OpenFreeMap tiles at the left and right edges of the world are rewritten on the way in, so the polygon cuts along the antimeridian no longer draw grey lines down the Pacific.
- **Ink your home.** A button saves the current view as a PNG poster drawn again at two or three times the screen's pixels, with a title cartouche, compass rose, ink scale bar, optional decorative border and the credits for every source (`js/ink-extras.js`).
- **Page tools.** The map fills the screen at the top of the page with the title as a cartouche on it (folded on phones), and the essay below. Full-screen button, an ink scale bar and compass rose, layers panel (ink mountains, forests, rivers, names, borders, roads, sea shading, heritage, drawn towns, animals and ships, flight, hill shading and a plain modern map), a key drawn with the map's own pictograms, search over 12,340 names plus every place and peak in the loaded tiles, start views (World, Europe, Great Britain, Yorkshire, Lake District), and a popup for every name and glyph, with a short extract, a picture and a link from English Wikipedia for places, sights, hills, rivers and beaches (looked up live when clicked).

## Images

- `reddit/the_inked_world.png` (3840 x 2400 px): the world at zoom 2.64 with 2,035 mountains and 2,053 hills, and Britain and Ireland as an inset.
- `reddit/britain_and_ireland_in_ink.png` (3600 x 4500 px): Britain and Ireland at zoom 7.14: 4,303 mountain glyphs, 8,868 hill glyphs and 2,507 trees.

## Files

| File | What it is |
|---|---|
| `index.html` | The interactive page (MapLibre GL JS 4.7.1 from jsDelivr; live OpenFreeMap vector tiles and AWS Terrain Tiles). |
| `js/ink-map.js` | The style, the glyph sprites (drawn on canvas in the browser), the paper texture and the `ink://` protocol. |
| `js/ink-worker.js` | Web worker: elevation, land cover and water to glyph points, returned as vector tiles. |
| `js/ink-icons.js` | Every pictogram (settlements, townhouses, heritage, landmarks, summits, snow, animals, ships, flight), drawn on canvas at load time. |
| `js/curated.js` | Hand-lettered sea and land names (with aliases) and the zoom from which they replace OpenStreetMap's and Wikidata's labels, and the lettered lakes (generated). |
| `js/ink-extras.js` | The ink scale bar, compass rose, decorative border and the "Ink your home" poster. |
| `fonts/` | SDF glyph sets for MapLibre ("Ink Caps", "Ink Roman", "Ink Italic", "Ink SC") made from MedievalSharp and IM Fell (SIL OFL 1.1); source TTFs and licences in `fonts/ttf/`. |
| `data/labels_countries.geojson` | Curved lettering lines for 194 countries and the 4 UK nations, one per zoom band. |
| `data/labels_regions.geojson` | The 167 hand-placed names, one line per zoom band (7 oceans, 38 seas, 31 ranges and 29 deserts and regions worldwide; 40 land and 22 sea names around Britain and Ireland). |
| `data/world_ink.geojson`, `data/world_ink_stats.json` | World view: range peaks along the axes of the high ranges, dune fields and tree bands, with first zooms; counts and thresholds. |
| `data/lakes_lettered.geojson` | Curved lettering lines for the 15 lakes of the Lake District, one per zoom band. |
| `data/biomes.png`, `data/biomes_legend.json` | Biome mask from RESOLVE Ecoregions 2017 (CC BY 4.0): pixel value 32 x class + 16 for ecoregions named for mountains; legend with classes and pixel counts. |
| `data/heritage/` | Heritage sites on a zoom 6 grid (`{x}_{y}.json`, rows of longitude and latitude times 100,000, icon, first zoom times 10, name, Wikidata number) and `index.json`. |
| `data/landmarks.geojson`, `data/peaks_famous.geojson`, `data/walls.geojson`, `data/decor.geojson` | Famous monuments, great summits, walls and dykes, and the animals, whales, serpents, ships, balloons and flying machines. |
| `data/places/` | Villages and hamlets of Britain and Ireland, and beaches worldwide, from Wikidata on a zoom 6 grid (rows of longitude and latitude times 100,000, kind (1 village or town, 2 hamlet or suburb, 3 beach), first zoom times 10, name, English Wikipedia title). |
| `data/rivers.geojson`, `data/lakes.geojson`, `data/hills/` | River and lake names from Natural Earth; named hills from Wikidata on a zoom 6 grid (rows of longitude and latitude times 100,000, elevation, first zoom times 10, name). |
| `data/features_summary.json` | Counts for the feature layers. |
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
python3 code/02_labels.py                 # curved lettering lines, lake lettering, gazetteer, js/curated.js
python3 code/02b_biomes.py                # biome mask from RESOLVE Ecoregions 2017
python3 code/02h_world_ink.py             # world view: range peaks (Terrarium zoom 4), dune fields and tree bands
python3 code/02g_forts.py                 # star forts (run before 02d, which leaves their walls to it)
python3 code/02d_features.py              # heritage, landmarks, summits, walls, animals and ships (lists in code/02c_curated.py)
python3 code/02e_water_hills.py           # river and lake names (Natural Earth) and named hills (Wikidata)
python3 code/02f_places.py                # villages and hamlets of Britain and Ireland, and beaches worldwide (Wikidata; queries in code/sparql/)
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
- Wikidata (CC0), queried in 2026, for heritage sites, landmarks, summits and seats of government, with the architecture styles, tallest buildings, lighthouses, battles and monasteries data sets built from it.
- CLIWOC, Climatological Database for the World's Oceans 1750 to 1850 (ship passages for the drawn ships).
- Natural Earth 1:10m rivers and lake centrelines and lakes (public domain), for river and lake names; Wikidata hills, mountains and summits, and villages and hamlets of Britain and Ireland (CC0).
- Natural Earth (public domain): 1:50m admin 0 countries, 1:10m populated places and states and provinces.
- Office for National Statistics, Local Authority Districts (2023), Open Government Licence v3.0; contains OS data © Crown copyright and database right 2023.
- Fonts: MedievalSharp, IM Fell English, IM Fell English SC, IM Fell Great Primer Italic (SIL Open Font License 1.1).
- MapLibre GL JS (BSD 3-Clause).

Code is MIT; text, figures and the derived label files are CC BY 4.0; fonts OFL; renders contain OpenStreetMap data (ODbL). See `LICENSE`.

Topics: Tolkien-inspired map, fantasy cartography, hand-drawn map style, fantasy map, world map, generative cartography, OpenStreetMap, elevation, biomes, MapLibre.

The design is my own, made from drawing rules applied to data. It was inspired by the general look of hand-drawn maps, Tolkien's among them, and is not connected with or endorsed by the Tolkien Estate; no artwork, lettering, cartouche or emblem from any map was traced or reused.

## Citation

Hotham, T. (2026) The Inked World: a zoomable map of the whole world in the style of a hand-inked fantasy map, generated from open elevation and OpenStreetMap data. Zenodo. https://doi.org/10.5281/zenodo.23860253

Dr Tristan Hotham, Independent researcher. ORCID 0000-0003-4931-9349.

I wrote the text, with drafting and editing assistance from Claude (Anthropic), which also helped prepare the analysis code. I reviewed and checked all text and results.
