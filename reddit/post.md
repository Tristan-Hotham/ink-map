## Title

I made a Tolkien-inspired map of the whole modern Earth from open data, zoomable from continents down to single hills [OC]

## Body

No hand drawing: every glyph is placed by a rule. The map lays a grid over the land and puts a little ink peak on the highest point of each cell that rises far enough above its surroundings (a rounded hill if it rises less), and the bar scales with the cell: about 477 m of relief for a 237 km cell far out, about 130 m for a 311 m cell in the Lake District. Peaks also need rugged ground, so the Sahara, Arabia and the Australian interior stay bare apart from their real ranges; deserts get dunes, rainforest round crowns, taiga small conifers and ice blue hatching (biomes from RESOLVE Ecoregions 2017). Castles, churches, stone circles and other heritage sites from Wikidata appear as you zoom, famous monuments get their own drawings, animals stand in their native ranges and old sailing ships leave historic ports. Nothing is drawn on water, names are placed first (167 of them lettered by hand on curves) and the glyphs give way to them. The inset is Britain and Ireland from the same map; the interactive version keeps the same drawn look all the way down to single fells, with trees in OpenStreetMap's woods. Caveat: peaks show local relief, not exact heights, and woods are only as complete as OpenStreetMap.

Interactive map: https://maps.tristanhotham.com/ink-map/

## Source comment

Data: map data © OpenStreetMap contributors (ODbL), served as vector tiles by OpenFreeMap (OpenMapTiles schema); elevation from AWS Terrain Tiles (Mapzen; SRTM, GMTED2010, ETOPO1 and others); biomes from RESOLVE Ecoregions 2017 (CC BY 4.0); heritage sites and summits from Wikidata (CC0); ship lanes from CLIWOC logbooks; country outlines from Natural Earth (public domain); UK nation boundaries from the ONS (OGL v3).

Tools: MapLibre GL JS with a custom web worker that turns elevation and land cover into glyph positions; glyphs drawn on canvas; fonts MedievalSharp and IM Fell (SIL OFL); Playwright for the render.

Images: the_inked_world.png (world, with a Britain and Ireland inset) and britain_and_ireland_in_ink.png (4,303 mountains and 2,507 trees).

Interactive version: https://maps.tristanhotham.com/ink-map/
Paper: https://doi.org/10.5281/zenodo.23860253
Blog post: https://blog.tristanhotham.com/2026/10/31/ink-map/
