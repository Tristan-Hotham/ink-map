/* Overpass QL: every town wall mapped in OpenStreetMap, run per region (bounding boxes in code/02d_features.py notes)
   and saved as /home/claude/newdata/raw12/cw*.json. */
[out:json][timeout:300];
(way["historic"="citywalls"]({{bbox}}); way["barrier"="city_wall"]({{bbox}}););
out tags geom;
