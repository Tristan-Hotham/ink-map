/* The Inked World: countryside and town life.
 * Registers the life sprites (js/ink-life-art.js) and the layers that draw what js/ink-worker.js generates from the
 * OpenStreetMap tiles: hedgerows, drystone walls and ditches round the fields, ricks, folds, grouse butts and peat hags,
 * reeds and windpumps, early industry, the modern world turned medieval (cartwrights for car dealers, coaching inns for
 * stations, tourney grounds for stadiums and so on), travellers on the roads, steam trains, barges and towpaths.
 * An overlay canvas animates chimney smoke and a few travellers moving along the roads (cheap: a few hundred sprite
 * draws a frame at most, paused when hidden). History layers from the sister data studies load lazily.
 * Usage: InkLife.attach(map) once the map is created (before the layers panel is wired up).
 * Dr Tristan Hotham, Independent researcher, 2026. MIT licence. */
(function (global) {
  'use strict';
  const A = () => global.InkLifeArt;
  const iz = (...p) => { const e = ['interpolate', ['linear'], ['zoom']]; for (let i = 0; i < p.length; i += 2) e.push(p[i], p[i + 1]); return e; };
  // fade a point in over the zoom before its rank (the same rule as the trees)
  // (a rank-r point comes in over the first 0.4 of the zoom before its rank: crisp sprites, no long ghostly fade)
  const fadeR = (hi) => { const e = ['interpolate', ['linear'], ['zoom']]; for (let z = 8; z <= 17; z += 0.2) { const zz = Math.round(z * 10) / 10; e.push(zz, ['*', hi, ['max', 0, ['min', 1, ['*', 2.5, ['-', zz + 1, ['get', 'r']]]]]]); } return e; };
  const PANEL = [
    ['lifeland', 'Hedges, walls, moors, fens and ricks', true],
    ['lifeind', 'Early industry: mills, kilns, forges', true],
    ['lifetown', 'Town life: inns, markets, tourneys', true],
    ['liferoad', 'Travellers, carts, trains and barges', true],
    ['lifesmoke', 'Chimney smoke', true],
    ['lifehist', 'Roman roads, pilgrim ways, battles, lost villages, abbeys, wrecks', true],
  ];
  const ORIG = {   // popup text: what the drawing stands for in the modern world (from OpenStreetMap)
    'lm-cartwright': ["Cartwright's yard", 'A car dealer or garage'], 'lm-stable': ['Stables and horse trough', 'A fuel station'],
    'lm-market': ['Market stalls', 'A supermarket, market or department store'], 'lm-coachinginn': ['Coaching inn', 'A railway station'],
    'lm-carriers': ["Carrier's yard", 'A bus station'], 'lm-stage': ["Players' stage", 'A cinema or theatre'], 'lm-tourney': ['Tourney ground', 'A stadium'],
    'lm-butts': ['Archery butts', 'A sports centre'], 'lm-infirmary': ['Infirmary', 'A hospital'], 'lm-school': ['Grammar school', 'A school'],
    'lm-college': ['College', 'A university or college'], 'lm-counting': ["Moneylender's counting house", 'A bank'], 'lm-messenger': ["Messenger's stable", 'A post office'],
    'lm-wagonyard': ['Wagon yard', 'A car park'], 'lm-innsign': ['Inn', 'A pub'], 'lm-innsign2': ['Inn', 'A pub'], 'lm-innsign3': ['Inn', 'A pub'],
    'lm-watchhouse': ["Watchman's house", 'A police station'], 'lm-stocks': ['The stocks', 'A police station'], 'lm-firewatch': ['Fire watch', 'A fire station'],
    'lm-scriptorium': ['Scriptorium', 'A library'], 'lm-cabinet': ['Cabinet of curiosities', 'A museum'], 'lm-hostelry': ['Hostelry', 'A hotel'],
    'li-brickworks': ['Brickworks', 'Industrial land'], 'li-bottlekiln': ['Bottle kiln', 'Industrial land'], 'li-watermill': ['Watermill', 'Industrial land by water'],
    'li-quay': ["Merchants' quay", 'Industrial land by water'], 'li-forge': ['Forge', 'Industrial land'], 'li-brewery': ['Brewery', 'Industrial land'],
    'li-distillery': ['Distillery', 'Industrial land'], 'li-tannery': ['Tannery', 'Industrial land'], 'li-glassworks': ['Glassworks', 'Industrial land'],
    'li-works': ['Works', 'Industrial land'], 'li-mine': ['Mine', 'Industrial land in the uplands'], 'li-windmill': ['Windmill', 'Flat farmland'],
    'lf-windpump': ['Drainage windpump', 'Fen or polder farmland'], 'lf-rick': ['Hayrick', 'Farmland or meadow'], 'lf-stooks': ['Stooks', 'Farmland'],
    'lf-scarecrow': ['Scarecrow', 'Farmland'], 'lf-beehives': ['Beehives', 'Farmland'], 'lf-fold': ['Sheepfold', 'Upland pasture or moor'],
    'lf-shepherd': ['Shepherd and flock', 'Pasture or moor'], 'lf-butt': ['Grouse butts', 'Heather moor'], 'lf-hag': ['Peat hags', 'High moor'],
    'lf-cairn': ['Cairn', 'High moor'], 'lf-heron': ['Heron', 'Marsh by open water'], 'lf-wildfowl': ['Wildfowl', 'Water in a marsh'],
    'lr-coble': ['Fishing boat', 'A harbour or marina'], 'lr-pots': ['Lobster pots', 'A harbour or marina'], 'lr-boat': ['Fishing boat', 'A harbour or marina'],
    'lr-train': ['Steam train', 'A railway line'], 'lr-barge': ['Barge', 'A canal'],
  };
  const MOVE_SPRITES = new Set();
  let overlay = null;

  function addSprites(map) {
    if (!A()) return;
    // the life sprites are drawn when a tile first asks for one (styleimagemissing, below), not before the first frame
    // a hedgerow as a line pattern: a row of round bushes with a dark edge
    const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); draw(x); return x.getImageData(0, 0, w, h); };
    if (!map.hasImage('lf-hedgepat')) map.addImage('lf-hedgepat', mk(36, 18, x => {
      for (const [cx, r, col] of [[6, 5.6, '#93A06A'], [18, 6.6, '#A2AC74'], [30, 5.2, '#8A9862']]) {
        x.beginPath(); x.arc(cx, 9.5, r, 0, 7); x.fillStyle = col; x.fill(); x.lineWidth = 1.5; x.strokeStyle = 'rgba(43,33,25,0.85)'; x.stroke();
        x.beginPath(); x.arc(cx + r * 0.35, 9.5 + r * 0.3, r * 0.45, 0, 7); x.fillStyle = 'rgba(43,33,25,0.22)'; x.fill();
      }
    }), { pixelRatio: 3 });
  }

  function addLayers(map) {
    const has = id => !!map.getLayer(id);
    const before = (...ids) => ids.find(has);
    const add = (l, g, b) => { l.metadata = Object.assign({ group: g }, l.metadata || {}); if (!has(l.id)) map.addLayer(l, b); };
    const L = ['get', 'k'], G = ['get', 'g'], T = ['get', 't'];
    // ---- flat things under the rivers: field boundaries, railways, towpaths
    const flat = before('rivers', 'roads-track-case', 'roads');
    add({ id: 'life-ditch', type: 'line', source: 'ink', 'source-layer': 'lifeline', minzoom: 11, filter: ['==', L, 'd'],
      paint: { 'line-color': '#3D6E9E', 'line-width': iz(11, 0.5, 14, 1, 16, 1.6), 'line-opacity': iz(11, 0, 12, 0.7) } }, 'lifeland', flat);
    add({ id: 'life-wall', type: 'line', source: 'ink', 'source-layer': 'lifeline', minzoom: 11, filter: ['==', L, 'w'], layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': '#4E4538', 'line-width': iz(11, 0.6, 13, 1.0, 15, 1.7, 16, 2.2), 'line-dasharray': [1.6, 0.6], 'line-opacity': iz(11, 0, 12, 0.75, 14, 0.9) } }, 'lifeland', flat);
    add({ id: 'life-hedge', type: 'line', source: 'ink', 'source-layer': 'lifeline', minzoom: 11, filter: ['==', L, 'h'], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-pattern': 'lf-hedgepat', 'line-width': iz(11, 1.6, 13, 3, 15, 5, 16, 6.5), 'line-opacity': iz(11, 0, 12, 0.85, 14, 0.95) } }, 'lifeland', flat);
    const RAIL = ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]];
    add({ id: 'life-rail', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 8, filter: RAIL,
      paint: { 'line-color': '#2B2119', 'line-width': iz(8, 0.4, 12, 0.8, 16, 1.4), 'line-opacity': iz(8, 0, 9, 0.6, 12, 0.8) } }, 'liferoad', flat);
    add({ id: 'life-rail-ties', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 10, filter: RAIL,
      paint: { 'line-color': '#2B2119', 'line-width': iz(10, 2.4, 13, 3.6, 16, 5.5), 'line-dasharray': [0.18, 1.6], 'line-opacity': iz(10, 0, 11, 0.6, 13, 0.75) } }, 'liferoad', flat);
    add({ id: 'life-towpath', type: 'line', source: 'ofm', 'source-layer': 'waterway', minzoom: 12, filter: ['==', ['get', 'class'], 'canal'],
      paint: { 'line-color': '#8A6A45', 'line-width': iz(12, 0.6, 16, 1.2), 'line-offset': iz(12, 2.2, 16, 6), 'line-dasharray': [2, 1.4], 'line-opacity': iz(12, 0, 12.6, 0.8) } }, 'liferoad', flat);
    // ---- standing things, under the drawn towns' walls and every name
    // above the drawn towns (a stable or an inn stands among the houses) and below every name
    const NAMES = ['city-marks', 'beasts', 'quarries', 'harbours', 'heritage', 'airports', 'wall-names', 'hills'];
    const upright = before(...NAMES, 'town');
    // in winter, inside the snow (sz, set by the worker), each drawing gets its snowy twin (id + "-s"; js/ink-life-art.js);
    // InkMap.setWinter swaps the expression (metadata.wlayout), as for the map's own glyphs
    const WIN = ['case', ['==', ['get', 'sz'], 1], ['concat', T, '-s'], T];
    const winterOn = global.InkMap && global.InkMap.isWinter ? global.InkMap.isWinter(map) : true;
    const sym = (id, filter, g, size, extra) => add({ id, type: 'symbol', source: 'ink', 'source-layer': 'life', minzoom: 9, filter,
      metadata: { wlayout: { 'icon-image': [WIN, T] } },
      layout: Object.assign({ 'icon-image': winterOn ? WIN : T, 'icon-size': size, 'icon-anchor': 'bottom', 'icon-overlap': 'never', 'icon-ignore-placement': true, 'icon-padding': 0,
        'symbol-z-order': 'viewport-y', 'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport' }, extra || {}),
      paint: { 'icon-opacity': fadeR(0.97) } }, g, upright);
    sym('life-land', ['all', ['==', G, 'land']], 'lifeland', iz(9, 0.7, 11, 0.9, 13, 1.2, 15, 1.6, 16, 2.0));
    sym('life-ind', ['==', G, 'ind'], 'lifeind', iz(9, 0.6, 11, 0.8, 13, 1.1, 15, 1.55, 16, 1.95));
    sym('life-town', ['==', G, 'life'], 'lifetown', iz(11, 0.75, 13, 1.05, 15, 1.5, 16, 1.9));
    sym('life-road', ['==', G, 'road'], 'liferoad', iz(9, 0.8, 11, 0.9, 13, 1.05, 15, 1.35, 16, 1.7));
    sym('life-train', ['==', G, 'rail'], 'liferoad', iz(11, 0.75, 13, 1.0, 16, 1.5), { 'icon-anchor': 'center', 'icon-rotate': ['get', 'a'], 'icon-rotation-alignment': 'map' });
    // hedgerow trees along the hedges (bare and snowy in winter), and barges on the canals
    const HSZ = ['==', ['get', 'sz'], 1];
    const HT0 = ['step', ['zoom'], 'lf-htree0', 14, 'lf-htree1'], HTW = ['step', ['zoom'], ['case', HSZ, 'lf-htree0-s', 'lf-htree0'], 14, ['case', HSZ, 'lf-htree1-s', 'lf-htree1']];
    add({ id: 'life-htrees', type: 'symbol', source: 'ink', 'source-layer': 'lifeline', minzoom: 12.5, filter: ['==', L, 'h'],
      metadata: { wlayout: { 'icon-image': [HTW, HT0] } },
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 110, 'icon-image': winterOn ? HTW : HT0, 'icon-size': iz(12.5, 0.9, 16, 1.7), 'icon-anchor': 'bottom',
        'icon-rotation-alignment': 'viewport', 'icon-overlap': 'never', 'icon-ignore-placement': true, 'icon-padding': 1 },
      paint: { 'icon-opacity': iz(12.5, 0, 13.2, 0.95) } }, 'lifeland', upright);
    add({ id: 'life-barges', type: 'symbol', source: 'ofm', 'source-layer': 'waterway', minzoom: 12.5, filter: ['==', ['get', 'class'], 'canal'],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 520, 'icon-image': 'lr-barge', 'icon-size': iz(12.5, 0.85, 16, 1.7), 'icon-rotation-alignment': 'viewport',
        'icon-overlap': 'never', 'icon-ignore-placement': true, 'icon-anchor': 'center' },
      paint: { 'icon-opacity': iz(12.5, 0, 13, 0.97) } }, 'liferoad', upright);
  }

  // ---------------- history layers from the sister data studies, loaded only when first needed
  const HIST = [
    // id, file, first zoom, attribution
    // (each is cut into 5 degree cells, data/life/<name>/, loaded round the view: js/ink-map.js gridSource)
    ['roman', 'roman', 5.5, 'Roman roads: Itiner-e (de Soto et al. 2025, CC BY 4.0)'],
    ['pilgrim', 'pilgrim', 6, 'Pilgrim routes: © OpenStreetMap contributors (ODbL)'],
    ['battles', 'battles', 6, 'Battles: Wikidata (CC0)'],
    ['dmv', 'dmv', 9, 'Lost villages: Beresford\'s Lost Villages, University of Hull (CC BY-NC-SA 4.0); Wikidata (CC0)'],
    ['wrecks', 'wrecks', 7, 'Shipwrecks: Wikidata (CC0)'],
    ['monks', 'monks', 9, 'Monastic houses: Wikidata (CC0)'],
  ];
  function histLayers(map, key) {
    const has = id => !!map.getLayer(id), upright = ['town', 'relief'].find(has), flat = ['rivers', 'roads'].find(has);
    const add = (l, b) => { l.metadata = { group: 'lifehist' }; if (!has(l.id)) map.addLayer(l, b); const box = document.querySelector('input[data-g="lifehist"]'); if (box && !box.checked) map.setLayoutProperty(l.id, 'visibility', 'none'); };
    const src = 'life-' + key;
    if (key === 'roman') {
      add({ id: 'life-roman', type: 'line', source: src, minzoom: 5.5, layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#7A2E1F', 'line-width': iz(5.5, 0.6, 9, 1.1, 14, 2), 'line-dasharray': [0.1, 2.2], 'line-opacity': iz(5.5, 0, 6.5, ['case', ['==', ['get', 'c'], 1], 0.8, 0.5], 13, ['case', ['==', ['get', 'c'], 1], 0.85, 0.55]) } }, flat);
      add({ id: 'life-roman-ms', type: 'symbol', source: src, minzoom: 9, layout: { 'symbol-placement': 'line', 'symbol-spacing': 260, 'icon-image': 'lh-milestone', 'icon-size': iz(9, 0.6, 14, 1.1), 'icon-anchor': 'bottom', 'icon-rotation-alignment': 'viewport', 'icon-overlap': 'never', 'icon-ignore-placement': true },
        paint: { 'icon-opacity': iz(9, 0, 9.6, 0.9) } }, upright);
      add({ id: 'life-roman-names', type: 'symbol', source: src, minzoom: 8, filter: ['!=', ['get', 'n'], ''], layout: { 'symbol-placement': 'line', 'symbol-spacing': 700, 'text-field': ['get', 'n'], 'text-font': ['Ink Italic'], 'text-size': iz(8, 10, 13, 12), 'text-letter-spacing': 0.12, 'text-offset': [0, -0.8], 'text-max-angle': 20, 'text-optional': true },
        paint: { 'text-color': '#7A2E1F', 'text-halo-color': 'rgba(243,229,191,0.9)', 'text-halo-width': 1.3, 'text-opacity': iz(8, 0, 8.6, 0.85) } }, upright);
    } else if (key === 'pilgrim') {
      add({ id: 'life-pilgrim', type: 'line', source: src, minzoom: 6, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#A3261B', 'line-width': iz(6, 0.5, 10, 0.9, 14, 1.5), 'line-dasharray': [3, 2], 'line-opacity': iz(6, 0, 7, 0.45, 12, 0.6) } }, flat);
      add({ id: 'life-pilgrim-shells', type: 'symbol', source: src, minzoom: 9.5, layout: { 'symbol-placement': 'line', 'symbol-spacing': 340, 'icon-image': 'lh-scallop', 'icon-size': iz(9.5, 0.6, 14, 1), 'icon-rotation-alignment': 'viewport', 'icon-overlap': 'never', 'icon-ignore-placement': true },
        paint: { 'icon-opacity': iz(9.5, 0, 10, 0.9) } }, upright);
      add({ id: 'life-pilgrim-names', type: 'symbol', source: src, minzoom: 8, filter: ['!=', ['get', 'n'], ''], layout: { 'symbol-placement': 'line', 'symbol-spacing': 900, 'text-field': ['get', 'n'], 'text-font': ['Ink Italic'], 'text-size': iz(8, 10, 13, 12), 'text-offset': [0, 0.9], 'text-max-angle': 20, 'text-optional': true, 'text-letter-spacing': 0.08 },
        paint: { 'text-color': '#A3261B', 'text-halo-color': 'rgba(243,229,191,0.9)', 'text-halo-width': 1.3, 'text-opacity': iz(8, 0, 8.6, 0.75) } }, upright);
    } else if (key === 'battles') {
      // battlefields the heritage layer already draws keep its crossed swords; here they get their year beneath
      add({ id: 'life-battles', type: 'symbol', source: src, minzoom: 6, filter: ['<=', ['get', 'z'], ['+', ['zoom'], 0.5]],
        layout: { 'icon-image': ['case', ['==', ['get', 'h'], 1], '', 'lh-swords'], 'icon-size': iz(6, 0.75, 10, 1, 14, 1.3), 'icon-overlap': 'never', 'icon-padding': 2, 'symbol-sort-key': ['get', 'z'],
          'text-field': ['step', ['zoom'], '', 8, ['get', 'y'], 11, ['case', ['==', ['get', 'h'], 1], ['get', 'y'], ['concat', ['get', 'n'], '\n', ['get', 'y']]]], 'text-font': ['Ink Italic'], 'text-size': iz(8, 9, 12, 11),
          'text-anchor': 'top', 'text-offset': ['case', ['==', ['get', 'h'], 1], ['literal', [0, 0.9]], ['literal', [0, 0.8]]], 'text-optional': true, 'text-max-width': 9 },
        paint: { 'icon-opacity': iz(6, 0, 6.6, 0.95), 'text-color': '#8A1F16', 'text-halo-color': 'rgba(243,229,191,0.92)', 'text-halo-width': 1.3 } }, upright);
    } else if (key === 'dmv') {
      add({ id: 'life-dmv', type: 'symbol', source: src, minzoom: 9, layout: { 'icon-image': 'lh-dmv', 'icon-size': iz(9, 0.6, 13, 1, 16, 1.4), 'icon-overlap': 'never', 'icon-ignore-placement': true,
          'text-field': ['step', ['zoom'], '', 11.5, ['get', 'n']], 'text-font': ['Ink Italic'], 'text-size': iz(11.5, 9.5, 15, 11.5), 'text-anchor': 'top', 'text-offset': [0, 0.6], 'text-optional': true },
        paint: { 'icon-opacity': iz(9, 0, 9.6, 0.85), 'text-color': '#7A5634', 'text-halo-color': 'rgba(243,229,191,0.9)', 'text-halo-width': 1.2 } }, upright);
    } else if (key === 'monks') {
      // monastic houses the heritage layer does not already draw: a ruined abbey where the house was dissolved or is a ruin
      add({ id: 'life-monks', type: 'symbol', source: src, minzoom: 9, filter: ['<=', ['get', 'z'], ['+', ['zoom'], 0.5]],
        layout: { 'icon-image': ['case', ['==', ['get', 'd'], 1], 'lh-abbey', 'h-monastery'], 'icon-size': iz(9, 0.75, 13, 1.05, 16, 1.4), 'icon-overlap': 'never', 'icon-padding': 2, 'symbol-sort-key': ['get', 'z'],
          'text-field': ['step', ['zoom'], '', 11.5, ['get', 'n']], 'text-font': ['Ink Italic'], 'text-size': iz(11.5, 9.5, 15, 11.5), 'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-optional': true, 'text-max-width': 9 },
        paint: { 'icon-opacity': iz(9, 0, 9.6, 0.92), 'text-color': '#A3261B', 'text-halo-color': 'rgba(243,229,191,0.9)', 'text-halo-width': 1.2 } }, upright);
    } else if (key === 'wrecks') {
      add({ id: 'life-wrecks', type: 'symbol', source: src, minzoom: 7, filter: ['<=', ['get', 'z'], ['+', ['zoom'], 0.5]],
        layout: { 'icon-image': 'lh-wreck', 'icon-size': iz(7, 0.6, 11, 0.9, 15, 1.2), 'icon-overlap': 'never', 'icon-padding': 2, 'symbol-sort-key': ['get', 'z'],
          'text-field': ['step', ['zoom'], '', 10, ['get', 'n']], 'text-font': ['Ink Italic'], 'text-size': iz(10, 9.5, 14, 11), 'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-optional': true, 'text-max-width': 8 },
        paint: { 'icon-opacity': iz(7, 0, 7.6, 0.9), 'text-color': '#3D6E9E', 'text-halo-color': 'rgba(243,229,191,0.9)', 'text-halo-width': 1.2 } }, upright);
    }
  }
  function setupHistory(map, base) {
    const loaded = new Set();
    const check = () => {
      const z = map.getZoom();
      for (const [key, file, z0, attrib] of HIST) {
        if (loaded.has(key) || z < z0 - 0.5) continue;
        loaded.add(key);
        if (!map.getSource('life-' + key)) map.addSource('life-' + key, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: attrib, tolerance: 0.4 });
        histLayers(map, key);
        if (global.InkMap && global.InkMap.gridSource) global.InkMap.gridSource(map, 'life-' + key, file, z0 - 0.5, base, null);
      }
    };
    map.on('zoomend', check); map.on('moveend', check); check();
  }

  // ---------------- overlay: chimney smoke and moving travellers
  function hashLL(a, b) { let h = Math.imul(Math.round(a * 1e5) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(b * 1e5) | 0, 0x165667b1); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  function setupOverlay(map) {
    if (!A()) return;
    const cv = document.createElement('canvas');
    cv.className = 'ink-life-overlay';
    cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none';
    map.getCanvasContainer().appendChild(cv);
    const ctx = cv.getContext('2d');
    const FR = A().smokeFrames(10), SC = A().SC;
    const sprites = new Map();
    const spr = id => { if (!sprites.has(id)) sprites.set(id, global.InkLifeArt.draw(id)); return sprites.get(id); };
    const st = { smoke: true, movers: true, srcs: [], movers_: [], last: 0, labelsAt: 0, raf: 0 };
    overlay = st;
    { const sb = document.querySelector('input[data-g="lifesmoke"]'), rb = document.querySelector('input[data-g="liferoad"]'); if (sb) st.smoke = sb.checked; if (rb) st.movers = rb.checked; }
    const NAME_LAYERS = () => map.getStyle().layers.filter(l => l.type === 'symbol' && l.layout && l.layout['text-field'] && !l.id.startsWith('life-')).map(l => l.id);
    let nameLayers = null;
    function resize() {
      const c = map.getCanvas(), dpr = global.devicePixelRatio || 1;
      cv.width = Math.round(c.clientWidth * dpr); cv.height = Math.round(c.clientHeight * dpr);
      cv.style.width = c.clientWidth + 'px'; cv.style.height = c.clientHeight + 'px';
    }
    resize(); map.on('resize', resize);
    // gather the sources of smoke and the tracks for travellers from the tiles in view (after every move)
    function gather() {
      const z = map.getZoom(), srcs = [], movers = [];
      const visible = id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none';
      if (z >= 8.5) {
        const SM = A().SMOKE_AT;
        // industry and inns: from their chimneys
        if (z >= 10.5) for (const f of map.querySourceFeatures('ink', { sourceLayer: 'life' })) {
          const t = f.properties.t; if (!SM[t]) continue;
          if (!visible(f.properties.g === 'ind' ? 'life-ind' : 'life-town')) continue;
          const c = f.geometry.coordinates; srcs.push({ ll: c, t, off: SM[t], ph: hashLL(c[0], c[1]), k: 'spr' });
        }
        // townhouses: about one in six has a fire lit
        if (z >= 12.2 && visible('town')) for (const f of map.querySourceFeatures('ink', { sourceLayer: 'town' })) {
          const t = f.properties.t; if (!t || t[0] !== 't' || t[1] !== 'h') continue;
          const c = f.geometry.coordinates, h = hashLL(c[0], c[1]); if (h > 0.09) continue;
          srcs.push({ ll: c, ph: h * 6.1, k: 'house' });
        }
        // further out: a few wisps over every town and village
        if (z < 12.4) for (const f of map.querySourceFeatures('ofm', { sourceLayer: 'place' })) {
          const cl = f.properties.class; if (!['city', 'town', 'village'].includes(cl) || f.geometry.type !== 'Point') continue;
          const c = f.geometry.coordinates, nW = cl === 'city' ? 4 : cl === 'town' ? 3 : 1;
          for (let i = 0; i < nW; i++) srcs.push({ ll: c, ph: hashLL(c[0] + i, c[1]), k: 'place', dx: (hashLL(c[1], c[0] + i) - 0.5) * 34, dy: -6 - hashLL(c[0] - i, c[1] + i) * 16 });
        }
      }
      // dedupe (tiles overlap at their edges) and cap
      const seen = new Set(), out = [];
      for (const s of srcs) { const k = s.ll[0].toFixed(5) + ',' + s.ll[1].toFixed(5) + ',' + (s.dx || 0).toFixed(1); if (seen.has(k)) continue; seen.add(k); out.push(s); }
      st.srcs = out.slice(0, 150);
      // travellers moving along a few main roads
      if (z >= 11.5 && visible('life-road')) {
        const seenT = new Set();
        for (const f of map.querySourceFeatures('ink', { sourceLayer: 'lifetrack' })) {
          const g = f.geometry, lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
          for (const ln of lines) {
            if (ln.length < 2) continue;
            const key = ln[0][0].toFixed(5) + ln[0][1].toFixed(5); if (seenT.has(key)) continue; seenT.add(key);
            // cumulative length in Mercator units, for an even pace on screen
            const P = ln.map(c => maplibregl.MercatorCoordinate.fromLngLat(c)), cum = [0];
            for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
            movers.push({ ln, P, cum, len: cum[cum.length - 1], t: f.properties.t, v: f.properties.v || 1, ph: hashLL(ln[0][0], ln[0][1]), hide: false });
            if (movers.length >= 24) break;
          }
          if (movers.length >= 24) break;
        }
      }
      st.movers_ = movers; st.labelsAt = 0;
      if (st.start) st.start();
    }
    let gt = null;
    // (debounced, and never while the map is still moving: a pan in short steps would gather at every step)
    const regather = () => { clearTimeout(gt); gt = setTimeout(() => { if (map.isMoving()) regather(); else gather(); }, 350); };
    map.on('moveend', regather); map.on('idle', regather); map.on('sourcedata', e => { if (e.sourceId === 'ink' && e.isSourceLoaded) regather(); });
    // hide a traveller that would cross a name: the anchors of the names on screen are gathered when the map comes to
    // rest (one query), and each traveller is checked against them a few times a second (no queries while animating)
    let anchors = [];
    function gatherNames() {
      if (!nameLayers) nameLayers = NAME_LAYERS();
      const fs = map.queryRenderedFeatures({ layers: nameLayers.filter(id => map.getLayer(id)) });
      anchors = [];
      for (const f of fs) {
        if (f.geometry.type !== 'Point') continue;
        const nm = f.properties.name || f.properties.n || f.properties.name_en || '';
        anchors.push({ ll: f.geometry.coordinates, hw: Math.min(90, 4 + String(nm).length * 3.6) });
        if (anchors.length > 400) break;
      }
      st.labelsAt = 0;
    }
    map.on('idle', () => { if (map.getZoom() >= 11.5) gatherNames(); });
    function checkLabels(now) {
      if (now - st.labelsAt < 300) return; st.labelsAt = now;
      const P = anchors.map(a => { const p = map.project(a.ll); return [p.x, p.y, a.hw]; });
      for (const m of st.movers_) {
        if (!m.pt) continue;
        m.hide = P.some(q => Math.abs(q[0] - m.pt[0]) < q[2] + 14 && m.pt[1] > q[1] - 12 && m.pt[1] - 28 < q[1] + 12);
      }
    }
    // the loop runs only while something animates on screen: it stops while the map moves (the canvas is cleared, so
    // nothing swims against the map) and when there is no smoke or traveller in view, and restarts when the map rests
    const active = () => map.getZoom() >= 8.5 && ((st.smoke && st.srcs.length) || (st.movers && st.movers_.length && map.getZoom() >= 11.5));
    function clear() { if (st.dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); st.dirty = false; } }
    // (an empty canvas over the map still costs a full-screen blend every frame, so it is hidden while stopped)
    function stop() { if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; clear(); cv.style.display = 'none'; }
    function start() { if (!st.raf && !st.moving && active() && !document.hidden) { cv.style.display = ''; st.raf = requestAnimationFrame(frame); } else if (!active()) stop(); }
    st.start = start; st.stop = stop;
    map.on('movestart', () => { st.moving = true; stop(); });
    map.on('moveend', () => { st.moving = false; start(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    function frame(now) {
      st.raf = requestAnimationFrame(frame);
      if (now - st.last < 50) return;   // about 20 frames a second
      st.last = now;
      if (!active()) { stop(); return; }
      const tf0 = performance.now();
      try { draw(now); } finally { const d = performance.now() - tf0; st.frames = (st.frames || 0) + 1; st.ms = (st.ms || 0) + d; st.maxMs = Math.max(st.maxMs || 0, d); }
    }
    function draw(now) {
      const dpr = global.devicePixelRatio || 1, z = map.getZoom();
      if (st.dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); st.dirty = false; }
      if (z < 8.5 || !(st.smoke || st.movers)) return;
      st.dirty = true;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = cv.width / dpr, H = cv.height / dpr;
      // smoke: frames of a rising wisp, each source at its own phase, all drifting with one wind
      if (st.smoke && st.srcs.length) {
        const sz = z < 12 ? 0.75 + (z - 8.5) * 0.09 : Math.min(1.6, 1.07 + (z - 12) * 0.16);
        const lifeSize = z < 11 ? 0.8 : z < 13 ? 0.8 + (z - 11) * 0.15 : z < 15 ? 1.1 + (z - 13) * 0.225 : Math.min(1.95, 1.55 + (z - 15) * 0.4);
        const houseSize = z < 13 ? 1.15 + (z - 12) * 0.15 : z < 14 ? 1.3 + (z - 13) * 0.2 : Math.min(2, 1.5 + (z - 14) * 0.25);
        const fw = FR[0].width / SC * sz, fh = FR[0].height / SC * sz;
        ctx.globalAlpha = z < 9.5 ? Math.max(0, (z - 8.5) * 0.9) : 0.9;
        // the smoke leans with the shared wind (js/ink-palette.js InkWind): the wisps are drawn leaning east, mirrored when
        // the wind blows towards the west (looked up once a second at the centre of the view)
        if (!st.windAt || now - st.windAt > 1000) { st.windAt = now; try { const c = map.getCenter(); st.windW = global.InkWind ? global.InkWind.at(c.lng, c.lat).to[0] < 0 : false; } catch (e) { st.windW = false; } }
        for (const s of st.srcs) {
          const p = map.project(s.ll);
          let x = p.x, y = p.y;
          if (s.k === 'spr') { x += s.off[0] * lifeSize; y += s.off[1] * lifeSize; }
          else if (s.k === 'house') { y -= 7.5 * houseSize; x += 2 * houseSize; }
          else { x += s.dx; y += s.dy; }
          if (x < -40 || y < -60 || x > W + 40 || y > H + 60) continue;
          const f = Math.floor(((now / 1000) * 1.6 + s.ph * 10) % FR.length);
          if (st.windW) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(FR[f], -fw / 2, y - fh, fw, fh); ctx.restore(); }
          else ctx.drawImage(FR[f], x - fw / 2, y - fh, fw, fh);
        }
        ctx.globalAlpha = 1;
      }
      // travellers: there and back again along their road
      if (st.movers && st.movers_.length && z >= 11.5) {
        checkLabels(now);
        const sz = z < 13 ? 0.85 + (z - 11.5) * 0.1 : z < 15 ? 1.0 + (z - 13) * 0.175 : Math.min(1.7, 1.35 + (z - 15) * 0.35);
        // a steady walking pace on screen (about 9 to 16 px a second), whatever the zoom
        const pxUnit = 512 * Math.pow(2, z);
        ctx.globalAlpha = Math.min(1, (z - 11.5) * 2);
        for (const m of st.movers_) {
          const speed = 9 * (0.7 + m.v * 0.5) / pxUnit;
          const L = m.len; if (L <= 0) continue;
          const tt = ((now / 1000) * speed + m.ph * L * 2) % (2 * L), back = tt > L, d = back ? 2 * L - tt : tt;
          let i = 1; while (i < m.cum.length - 1 && m.cum[i] < d) i++;
          const a = m.P[i - 1], b = m.P[i], seg = m.cum[i] - m.cum[i - 1] || 1, u = (d - m.cum[i - 1]) / seg;
          const mc = new maplibregl.MercatorCoordinate(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0);
          const p = map.project(mc.toLngLat()); m.pt = [p.x, p.y];
          if (m.hide || p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
          const left = ((b.x - a.x) < 0) !== back;
          const c = spr(left ? m.t + '-l' : m.t); if (!c) continue;
          const w = c.width / SC * sz, h = c.height / SC * sz;
          // a gentle bob as they go
          const bob = Math.abs(Math.sin(now / 160 + m.ph * 9)) * 0.8 * sz;
          ctx.drawImage(c, p.x - w / 2, p.y - h - bob, w, h);
        }
        ctx.globalAlpha = 1;
      }
    }
    st.gather = gather;
    gather();
  }

  // ---------------- the layers panel, the key and popups
  function setupPanel(map) {
    const lp = document.getElementById('lp'); if (!lp) return;
    const anchor = lp.querySelector('input[data-g="hillshade"]');
    const at = anchor ? anchor.closest('label') : null;
    for (const [g, label, on] of PANEL) {
      if (lp.querySelector(`input[data-g="${g}"]`)) continue;
      const l = document.createElement('label'); l.innerHTML = `<input type="checkbox" data-g="${g}"${on ? ' checked' : ''}> ${label}`;
      if (at) at.parentNode.insertBefore(l, at); else lp.appendChild(l);
    }
    const sm = lp.querySelector('input[data-g="lifesmoke"]'), rd = lp.querySelector('input[data-g="liferoad"]');
    if (sm) sm.addEventListener('change', () => { if (overlay) { overlay.smoke = sm.checked; overlay.stop(); overlay.start(); } });
    if (rd) rd.addEventListener('change', () => { if (overlay) { overlay.movers = rd.checked; overlay.stop(); overlay.start(); } });
  }
  function setupKey() {
    const el = document.getElementById('key'); if (!el || !A() || el.querySelector('.ink-life-key')) return;
    const K = [
      ['Country and town life (zoom 10 and closer)', [['lr-oxcart', 'Travellers, drovers and carts on the roads'], ['lr-train', 'Railway, with a steam train'], ['lr-barge', 'Barge on a canal'],
        ['lf-rick', 'Rick or stooks on farmland'], ['lf-butt', 'Grouse butts on the moor'], ['lf-hag', 'Peat hags on high moor'], ['lf-reed1', 'Reeds in marsh and salt marsh'], ['lf-windpump', 'Windpump in the fens'],
        ['li-brickworks', 'Works and kilns on industrial land'], ['li-watermill', 'Mill by water'], ['lm-coachinginn', 'Coaching inn (a railway station)'], ['lm-cartwright', "Cartwright's yard (a car dealer)"],
        ['lm-stable', 'Stables (a fuel station)'], ['lm-market', 'Market stalls (a supermarket)'], ['lm-tourney', 'Tourney ground (a stadium)'], ['lm-innsign', 'Inn sign (a pub)']]],
      ['History (from the sister data studies)', [['lh-milestone', 'Roman road, with milestones'], ['lh-scallop', 'Pilgrim route'], ['lh-swords', 'Battle, with its year'], ['lh-dmv', 'Lost village'], ['lh-abbey', 'Dissolved or ruined monastery'], ['lh-wreck', 'Shipwreck']]],
    ];
    for (const [h, items] of K) {
      const hd = document.createElement('h3'); hd.textContent = h; hd.className = 'ink-life-key'; el.appendChild(hd);
      for (const [id, label] of items) {
        const c = A().draw(id); if (!c) continue;
        c.style.width = ''; const d = document.createElement('div'); d.appendChild(c); const sp = document.createElement('span'); sp.textContent = label; d.appendChild(sp); el.appendChild(d);
      }
    }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  function setupPopups(map) {
    const IDS = ['life-town', 'life-ind', 'life-land', 'life-road', 'life-train', 'life-barges', 'life-battles', 'life-dmv', 'life-wrecks', 'life-monks', 'life-roman', 'life-pilgrim'];
    const ROADT = { 'lr-wagon': 'Covered wagon', 'lr-coach': 'Travelling coach', 'lr-rider': 'Rider', 'lr-rider2': 'Rider', 'lr-messenger': 'Messenger at the gallop', 'lr-knight': 'Knight errant',
      'lr-packtrain': 'Packhorse train', 'lr-cart': 'Carter', 'lr-cattledrove': 'Drover with cattle', 'lr-sheepdrove': 'Drover with sheep', 'lr-pilgrims': 'Pilgrims', 'lr-timber': 'Timber wagon',
      'lr-oxcart': 'Ox cart', 'lr-walker': 'Traveller on foot', 'lr-pedlar': 'Pedlar with his donkey', 'lr-friars': 'Friars', 'lr-handcart': 'Handcart', 'lr-geese': 'Goose girl and geese', 'lr-sledge': 'Sledge' };
    map.on('click', e => {
      const ids = IDS.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      const fs = map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ids });
      if (!fs.length) return;
      const f = fs[0], p = f.properties, id = f.layer.id; let h = '';
      const t = String(p.t || '').replace(/-l$/, '').replace(/^lf-reed\d$/, 'lf-reed');
      if (id === 'life-road') h = `<b class="t">${esc(ROADT[t] || (A() && A().NAMES && A().NAMES(t)) || 'Traveller')}</b>On a road mapped in OpenStreetMap; busier roads carry more traffic. A picture, not a census.`;
      else if (id === 'life-battles') h = `<b class="t">${esc(p.n)}</b>Battle, ${esc(p.y)} (Wikidata).${p.q ? `<br><a href="https://www.wikidata.org/wiki/${esc(p.q)}" target="_blank" rel="noopener">Wikidata ${esc(p.q)}</a>` : ''}`;
      else if (id === 'life-dmv') h = `<b class="t">${esc(p.n)}</b>Lost or deserted village (Wikidata).${p.q ? `<br><a href="https://www.wikidata.org/wiki/${esc(p.q)}" target="_blank" rel="noopener">Wikidata ${esc(p.q)}</a>` : ''}`;
      else if (id === 'life-wrecks') h = `<b class="t">${esc(p.n)}</b>Shipwreck${p.y ? ', ' + esc(p.y) : ''} (Wikidata).${p.q ? `<br><a href="https://www.wikidata.org/wiki/${esc(p.q)}" target="_blank" rel="noopener">Wikidata ${esc(p.q)}</a>` : ''}`;
      else if (id === 'life-monks') h = `<b class="t">${esc(p.n)}</b>${esc(String(p.k || 'monastery').replace(/^./, c => c.toUpperCase()))}${p.d === 1 ? ', dissolved or in ruins' : ''} (Wikidata).${p.q ? `<br><a href="https://www.wikidata.org/wiki/${esc(p.q)}" target="_blank" rel="noopener">Wikidata ${esc(p.q)}</a>` : ''}`;
      else if (id === 'life-roman') h = `<b class="t">${esc(p.n || 'Roman road')}</b>Roman road (${p.c === 1 ? 'certain or likely' : 'conjectured'}), from Itiner-e.`;
      else if (id === 'life-pilgrim') h = `<b class="t">${esc(p.n || 'Pilgrim route')}</b>Pilgrim route mapped in OpenStreetMap.`;
      else if (/^lf-mud\d$/.test(t)) h = `<b class="t">Mudflats</b>Wetland mapped in OpenStreetMap where it lies below the line of the coast: tidal flats and salt marsh.`;
      else if (t === 'lf-reed') h = `<b class="t">Reeds</b>Marsh, reed bed or salt marsh in OpenStreetMap.`;
      else { const o = ORIG[t]; if (!o) return; h = `<b class="t">${esc(o[0])}</b>${esc(o[1])}${id === 'life-town' ? ' in OpenStreetMap, drawn as its medieval equivalent.' : id === 'life-ind' ? ' in OpenStreetMap, drawn as an early works.' : ' (from OpenStreetMap).'}`; }
      const mine = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'ink-life-pop' }).setLngLat(e.lngLat).setHTML(h).addTo(map);
      // the page's own handler may open a popup for the townhouses or glyphs underneath: the drawing on top wins
      setTimeout(() => { for (const el of document.querySelectorAll('.maplibregl-popup')) if (el !== mine.getElement()) el.remove(); }, 0);
    });
    let mt = 0;
    map.on('mousemove', e => {
      const now = performance.now(); if (now - mt < 80) return; mt = now;
      const ids = IDS.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      const hit = map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: ids }).length > 0;
      if (hit) setTimeout(() => { map.getCanvas().style.cursor = 'pointer'; }, 0);
    });
  }

  function lazyArt(map) {
    if (map.__lifeLazy) return; map.__lifeLazy = true;
    map.on('styleimagemissing', e => { if (/^l[rfimh]-/.test(e.id) && A() && !map.hasImage(e.id)) A().addOne(map, e.id); });
  }
  // run fn once the key below the map comes near the screen (it is drawn on demand, see index.html)
  function whenKeyShown(fn) {
    const el = document.getElementById('key');
    if (!el || !('IntersectionObserver' in global)) { setTimeout(fn, 5000); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(fn, 0); } }, { rootMargin: '600px' });
    io.observe(el);
  }
  function attach(map, opts) {
    opts = opts || {};
    const base = opts.base || new URL('./', location.href).href;
    try { addSprites(map); addLayers(map); } catch (e) { console.warn('ink life layers', e); }
    lazyArt(map);
    try { setupPanel(map); } catch (e) { console.warn('ink life panel', e); }
    try { setupPopups(map); } catch (e) { console.warn('ink life popups', e); }
    // the history data (several MB), the animated overlay and the key entries wait until the map has drawn its first view
    const later = () => {
      try { setupHistory(map, base); } catch (e) { console.warn('ink life history', e); }
      try { setupOverlay(map); } catch (e) { console.warn('ink life overlay', e); }
    };
    if (map.loaded()) setTimeout(later, 300); else map.once('idle', () => setTimeout(later, 300));
    whenKeyShown(() => { try { setupKey(); } catch (e) { console.warn('ink life key', e); } });
  }
  // the "Ink your home" poster draws a second map with InkMap.create: give it the same life layers (not the animation)
  if (global.InkMap && !global.InkMap.__life) {
    const orig = global.InkMap.create;
    global.InkMap.create = async function (container) {
      const m = await orig.apply(this, arguments);
      if (container !== 'map') { try { lazyArt(m); addSprites(m); addLayers(m); setupHistory(m, new URL('./', location.href).href); } catch (e) { console.warn('ink life poster', e); } }
      return m;
    };
    global.InkMap.__life = true;
  }
  global.InkLife = { attach, state: () => overlay };
})(window);
