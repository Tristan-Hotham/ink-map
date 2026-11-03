"""Write every archetype (a few seeds each) to a review sheet for sheet.html?src=sheet_all.js"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from archetypes import ARCH, V
n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
out = []
for k, f in ARCH.items():
    if k in ('slough',): continue
    for s in range(n):
        out.append([k, f(V(hash(k) % 1000 + s))])
open(os.path.join(os.path.dirname(__file__), 'sheet_all.js'), 'w').write('window.SPECS=' + json.dumps(out) + ';')
print(len(out))
