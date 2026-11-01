"""QA and figure renders against the offline test tiles (OpenFreeMap vector tiles and Terrarium elevation
tiles saved under RAW9). Starts a local file server, drives code/qa_render.js (Playwright + Chromium) and
builds the zoom-sequence montage.

Usage: python3 code/03_renders.py [zoom|views|phone|all]
Needs: node with playwright, and maplibre-gl@4.7.1 installed (path in $MAPLIBRE_DIST).
"""
import json, os, subprocess, sys, time, socket, tempfile
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, RAW9, QA

PORT = 8765
TMP = os.environ.get('INK_TMP', tempfile.gettempdir())
MAPLIBRE = os.environ.get('MAPLIBRE_DIST', os.path.join(TMP, 'npm/node_modules/maplibre-gl/dist'))
NODE_PATH = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
os.makedirs(QA, exist_ok=True)
IMG = os.path.join(ROOT, 'img'); os.makedirs(IMG, exist_ok=True)


def server():
    s = socket.socket()
    if s.connect_ex(('127.0.0.1', PORT)) != 0:
        subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', '/'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5)
    s.close()
    tj = json.load(open(os.path.join(RAW9, 'openfreemap_tilejson.json')))
    tj['tiles'] = [f'http://localhost:{PORT}{RAW9}/ofm/{{z}}/{{x}}/{{y}}.pbf']
    path = os.path.join(TMP, 'ink_tj_local.json'); json.dump(tj, open(path, 'w'))
    return {'base': f'http://localhost:{PORT}{ROOT}', 'tj': f'http://localhost:{PORT}{path}',
            'dem': f'http://localhost:{PORT}{RAW9}/terrarium/{{z}}/{{x}}/{{y}}.png', 'demMax': 12, 'maplibre': MAPLIBRE}


def render(shots, errlog):
    cfg = server(); cfg['shots'] = shots; cfg['errlog'] = errlog
    p = os.path.join(TMP, 'ink_shots.json'); json.dump(cfg, open(p, 'w'))
    env = dict(os.environ, NODE_PATH=NODE_PATH)
    subprocess.run(['node', os.path.join(ROOT, 'code', 'qa_render.js'), p], check=True, env=env)


def font(sz, it=False):
    return ImageFont.truetype(os.path.join(ROOT, 'fonts', 'ttf', 'IMFeGPit28P.ttf' if it else 'IMFeENrm28P.ttf'), sz)


ZOOMS = [3, 4, 5, 6, 7, 8, 9, 10, 11]
CENTRE = (54.47, -3.03)


def zoom_sequence():
    shots = [dict(out=os.path.join(QA, f'zoom_z{z}.png'), w=760, h=560, lat=CENTRE[0], lon=CENTRE[1], z=z, maponly=1, clean=1, stats=1) for z in ZOOMS]
    render(shots, os.path.join(QA, 'console_zoom.txt'))
    W, H, pad, cap = 760, 560, 18, 46
    sheet = Image.new('RGB', (3 * W + 4 * pad, 3 * (H + cap) + 4 * pad + 70), '#F6EED8')
    d = ImageDraw.Draw(sheet)
    d.text((pad, 18), 'The Inked World: one continuous zoom over the Lake District, zoom 3 to 11', font=font(40), fill='#2B2119')
    for i, z in enumerate(ZOOMS):
        im = Image.open(os.path.join(QA, f'zoom_z{z}.png')).convert('RGB').resize((W, H))
        x = pad + (i % 3) * (W + pad); y = 70 + pad + (i // 3) * (H + cap + pad)
        sheet.paste(im, (x, y)); d.rectangle([x, y, x + W - 1, y + H - 1], outline='#2B2119')
        d.text((x + 4, y + H + 6), f'zoom {z}', font=font(30, True), fill='#A3261B')
    sheet.save(os.path.join(QA, 'zoom_sequence.png'), optimize=True)
    st = {}
    for z in ZOOMS:
        d = json.load(open(os.path.join(QA, f'zoom_z{z}.stats.json')))
        st[str(z)] = {k: d.get(k) for k in ('relief', 'mountains', 'hills', 'trees', 'tufts')}
    json.dump(st, open(os.path.join(ROOT, 'data', 'zoom_sequence_stats.json'), 'w'), indent=1)
    for z in (4, 6, 8, 9, 10, 11):
        Image.open(os.path.join(QA, f'zoom_z{z}.png')).convert('RGB').save(os.path.join(IMG, f'zoom_z{z}.jpg'), quality=86)


VIEWS = [('world', 22, 10, 1.4), ('europe', 52, 10, 3.6), ('gb', 54.6, -3.3, 5.3), ('yorkshire', 54.15, -1.6, 8.2),
         ('lakes_z9', 54.47, -3.05, 9.0), ('lakes_z11', 54.45, -3.04, 11.0), ('lakes_z12', 54.46, -3.02, 12.3)]


def views():
    shots = [dict(out=os.path.join(QA, f'view_{n}.png'), w=1280, h=860, lat=a, lon=b, z=c, maponly=1, stats=1) for n, a, b, c in VIEWS]
    render(shots, os.path.join(QA, 'console_views.txt'))


def page():
    shots = [dict(out=os.path.join(QA, 'page_desktop.png'), w=1280, h=900, full=1, stats=1),
             dict(out=os.path.join(QA, 'page_phone.png'), w=390, h=844, dpr=2, full=1, stats=1),
             dict(out=os.path.join(QA, 'page_phone_map.png'), w=390, h=844, dpr=2, scroll='#map',
                  eval="document.getElementById('lyrBtn').click()"),
             dict(out=os.path.join(QA, 'page_desktop_dark.png'), w=1280, h=900, scheme='dark'),
             dict(out=os.path.join(QA, 'page_modern.png'), w=1280, h=860, maponly=1, lat=54.47, lon=-3.03, z=9.5,
                  eval="document.getElementById('modern').click()")]
    render(shots, os.path.join(QA, 'console_page.txt'))


FIGS = os.path.join(ROOT, 'release', 'figs')
FIG_VIEWS = [('world', 20, 10, 1.6, 1600, 1000, {}), ('asia', 31, 84, 3.5, 1500, 1000, {}), ('europe', 50, 12, 3.8, 1500, 1000, {}),
             ('gb', 54.6, -3.3, 5.3, 1300, 1000, {}), ('yorkshire', 54.15, -1.6, 8.2, 1500, 1000, {}), ('lakes', 54.45, -3.04, 11, 1500, 1000, {}),
             ('stress', 54.47, -3.05, 9, 1500, 1000, {'demScale': 6}),
             ('sahara', 22, 12, 3.45, 1500, 1000, {}), ('amazon', -6, -62, 3.45, 1500, 1000, {}), ('greenland', 70, -40, 3.1, 1500, 1000, {})]


def figs():
    os.makedirs(FIGS, exist_ok=True)
    shots = [dict(out=os.path.join(FIGS, f'{n}.png'), w=w, h=h, lat=a, lon=b, z=z, maponly=1, clean=1, stats=1, wk=wk or None)
             for n, a, b, z, w, h, wk in FIG_VIEWS]
    for s in shots:
        if not s['wk']: s.pop('wk')
    shots.append(dict(out=os.path.join(FIGS, 'glyphs.png'), w=1600, h=900, page='code/sprites.html'))
    render(shots, os.path.join(TMP, 'ink_figs_console.txt'))
    st = {}
    for n, *_ in FIG_VIEWS:
        p = os.path.join(FIGS, f'{n}.stats.json'); d = json.load(open(p)); os.remove(p)
        st[n] = {k: d.get(k) for k in ('zoom', 'relief', 'mountains', 'hills', 'trees', 'tufts')}
    json.dump(st, open(os.path.join(ROOT, 'data', 'render_stats.json'), 'w'), indent=1)


def carpet():
    """Ink cap test: the Lake District at zoom 9 with relief x12, thinning and ruggedness off, with and without the cap."""
    base = dict(lat=54.47, lon=-3.05, z=9, w=1200, h=800, maponly=1, clean=1, stats=1)
    off = {'demScale': 12, 'SAT_NB': 99, 'G0': 0.0001}
    shots = [dict(base, out=os.path.join(TMP, 'carpet_nocap.png'), wk=dict(off, CAP_M=9, CAP_SAT=9)),
             dict(base, out=os.path.join(ROOT, 'release', 'figs', 'carpet.png'), wk=off)]
    render(shots, os.path.join(TMP, 'ink_carpet_console.txt'))
    a = json.load(open(os.path.join(TMP, 'carpet_nocap.stats.json')))
    b = json.load(open(os.path.join(ROOT, 'release', 'figs', 'carpet.stats.json')))
    os.remove(os.path.join(ROOT, 'release', 'figs', 'carpet.stats.json'))
    json.dump({'uncapped': a['mountains'], 'capped': b['mountains']}, open(os.path.join(ROOT, 'data', 'carpet_test.json'), 'w'))


def interact():
    cfg = server(); p = os.path.join(TMP, 'ink_interact.json'); json.dump(cfg, open(p, 'w'))
    subprocess.run(['node', os.path.join(ROOT, 'code', 'qa_interact.js'), p, QA], check=True, env=dict(os.environ, NODE_PATH=NODE_PATH))


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('zoom', 'all'): zoom_sequence()
    if what in ('views', 'all'): views()
    if what in ('page', 'all'): page()
    if what in ('interact', 'all'): interact()
    if what in ('figs', 'all'): figs()
    if what in ('carpet', 'all'): carpet()
    if what == 'adhoc':   # python3 code/03_renders.py adhoc '[{"out": "...", "lat": .., "lon": .., "z": ..}]'
        shots = json.loads(sys.argv[2])
        for s in shots: s.setdefault('w', 1280); s.setdefault('h', 860); s.setdefault('maponly', 1); s.setdefault('stats', 1)
        render(shots, os.path.join(TMP, 'ink_adhoc_console.txt'))
