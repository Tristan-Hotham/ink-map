/* Overpass QL: forts and fortifications with geometry, run per region (15 boxes) and saved as /home/claude/newdata/raw13/fort_<box>.json;
   and town walls mapped as relations, saved as raw13/relwalls.json. */
[out:json][timeout:600];
(way["historic"="fort"]({{bbox}}); rel["historic"="fort"]({{bbox}}); way["fortification_type"]({{bbox}}); rel["fortification_type"]({{bbox}}););
out geom;
/* relwalls */
[out:json][timeout:600];
rel[~"^(historic|barrier)$"~"^(citywalls|city_wall)$"];
out geom;
