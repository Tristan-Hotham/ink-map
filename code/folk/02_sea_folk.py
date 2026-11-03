"""Add the hidden folk at sea (round 3) to data/folk/folk.json: sailors, castaways on islets, lone fishermen, a pearl
diver, a navigator's outrigger and drifting bottles with riddles. Every figure is an original drawing (js/ink-folk-art.js
with the sea pieces of js/ink-sea-art.js); every place is hand-placed on the water at a real, fitting spot.
They join the counter under their own region, "The seas and oceans", and show only at the closest zoom like all the folk.
Run after code/folk/01_folk.py (which rebuilds folk.json without them): python3 code/folk/02_sea_folk.py
"""
import os, sys, json, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from archetypes import P, F, spec

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'data', 'folk')
REGION = 'The seas and oceans'


def rower(c1, c2, hat, hatc, skin='fair', hair='brown', beard=None, boat='rowing'):
    return spec(22, 16, [P(11, 12, inBoat=boat, garb='tunic', c1=c1, c2=c2, hat=hat, hatc=hatc, prop='paddle', arms=['row', 'row'], skin=skin, hair=hair, beard=beard, pose='row')])


def sailors(c1, c3, skin='fair', hair='brown', boat='rowing'):
    # two sailors in a boat: one rowing, one at the stern
    return spec(24, 17, [P(12, 13, inBoat=boat, garb='tunic', c1=c1, c2='brown', hat='cap', hatc=c3, prop='paddle', arms=['row', 'row'], skin=skin, hair=hair, pose='row',
                          seats=[[-2.6, -2.0], [3.6, -2.0]], crew=[{'pose': 'row'}, {'pose': 'boat', 'arms': ['point', 'down'], 'prop': None, 'c1': c3, 'hat': 'felt', 'hatc': 'black', 'beard': 1}])])


def fisher(c1, c3, hat='straw', skin='fair', hair='brown', boat='rowing'):
    return spec(26, 17, [P(12, 13, inBoat=boat, garb='tunic', c1=c1, c2='brown', hat=hat, hatc=c3, prop='rod', lineTo=3.4, arms=['fwd', 'down'], skin=skin, hair=hair, pose='boat')])


def castaway(c1, skin='fair', hair='brown', beard=1):
    # a ragged castaway waving from an islet with one palm
    return spec(22, 20, [F('creature', 11, 17, k='islet'), P(8, 15.6, garb='tunic', c1=c1, c2='dun', hat=None, arms=['wave', 'down'], skin=skin, hair=hair, beard=beard, h=11)])


def bottle():
    return spec(14, 8, [F('creature', 7, 5, k='bottle')])


FOLK = [
    # sailors
    ('sea-sailors-solent', 'Sailors in a jolly boat', 'The Solent off Cowes, Isle of Wight', 50.7745, -1.2985, sailors('woad', 'madder'),
     'Between an island and the mainland, where racing yachts gather each August, two tars pull for the shore.'),
    ('sea-sailors-bosphorus', 'Boatmen on the Bosphorus', 'The Bosphorus, Istanbul', 41.0835, 29.0560, sailors('madder', 'white', skin='olive', hair='dark'),
     'Where Europe and Asia nearly touch, two boatmen row across the strait between them.'),
    ('sea-sailors-sydney', 'Sailors in Sydney Harbour', 'Port Jackson, Sydney', -33.8515, 151.2420, sailors('woadDk', 'ochre'),
     'In a great natural harbour of the south, two sailors row past the headland where the convict fleet anchored in 1788.'),
    ('sea-sailors-newyork', 'Sailors in the Upper Bay', 'Upper New York Bay', 40.6750, -74.0420, sailors('dun', 'madder'),
     'Two sailors row across the bay where the copper lady holds up her torch.'),
    ('sea-captain-whitby', 'A captain rowing out of Whitby', 'Whitby harbour mouth, North Yorkshire', 54.4935, -0.6098, rower('woadDk', 'brown', 'felt', 'black', beard=1),
     'From the port where a young collier\'s apprentice learned his trade before sailing round the world, a captain rows out between the piers.'),
    ('sea-ferryman-mersey', 'The Mersey ferryman', 'The River Mersey off Pier Head, Liverpool', 53.4045, -3.0010, rower('russet', 'brown', 'cap', 'woad'),
     'A ferryman rows across the river where the famous ferry crosses, between the Liver Birds and Birkenhead.'),
    ('sea-viking-scapa', 'Norse rowers in Scapa Flow', 'Scapa Flow, Orkney', 58.8900, -3.0800, spec(30, 20, [P(15, 15, inBoat='longship', garb='tunic', c1='madder', c2='brown', hat='nasal', hatc='steel', prop='paddle', arms=['row', 'row'], skin='fair', hair='blond', beard=1, pose='row', seats=[[-5, -2.6], [0, -2.6], [5, -2.6]])]),
     'In the great sheltered anchorage of the northern isles, where earls once ruled from Kirkwall, a longship pulls for home.'),
    # castaways on islets
    ('sea-castaway-rockall', 'The castaway of Rockall', 'Rockall, North Atlantic', 57.5960, -13.6880, castaway('dun'),
     'On the loneliest rock of the North Atlantic, a speck the shipping forecast names, someone waves a ragged sleeve.'),
    ('sea-castaway-juanfernandez', 'A castaway on Juan Fernández', 'Off Robinson Crusoe Island, Chile', -33.6420, -78.8550, castaway('russet'),
     'Off the island named after a novel, where a Scottish sailor lived alone for four years and four months, a castaway still waits.'),
    ('sea-castaway-scilly', 'A castaway in the Scillies', 'Western Rocks, Isles of Scilly', 49.8770, -6.4180, castaway('woad'),
     'Among the rocks west of England\'s last isles, where an admiral\'s fleet was wrecked in 1707, a castaway waves at passing ships.'),
    ('sea-castaway-tobago', 'A castaway on a sandy cay', 'Tobago Cays, Grenadines', 12.6340, -61.3560, castaway('ochre', skin='brown', hair='black', beard=None),
     'On a scrap of sand among turtles and reefs in the southern Grenadines, a castaway shades her eyes for a sail.'),
    ('sea-castaway-maldives', 'A castaway on a coral islet', 'North Malé Atoll, Maldives', 4.3010, 73.4250, castaway('white', skin='medium', hair='black', beard=None),
     'Among a thousand islands strung in rings of coral, one has a single palm and a single waving figure.'),
    ('sea-castaway-fiji', 'A castaway in the Mamanucas', 'Mamanuca Islands, Fiji', -17.6680, 177.1150, castaway('madder', skin='brown', hair='black'),
     'West of the largest island of a Pacific nation of three hundred islands, someone has been left on the smallest.'),
    # lone fishermen
    ('sea-fisher-galway', 'A lone fisherman in Galway Bay', 'Galway Bay, Ireland', 53.2350, -9.1200, fisher('dun', 'woadDk', 'cap'),
     'Where the sun goes down on a bay of song, one man sits patiently with a line over the side.'),
    ('sea-fisher-lofoten', 'A cod fisherman off Lofoten', 'Off Reine, Lofoten', 67.9200, 13.1000, fisher('madder', 'woadDk', 'hood'),
     'Below the sharp peaks of the northern islands, where cod come every winter to spawn, a lone fisherman waits for the skrei.'),
    ('sea-fisher-dingle', 'A fisherman in Dingle harbour', 'Dingle harbour mouth, Kerry', 52.1250, -10.2620, fisher('woad', 'ochre', 'cap'),
     'At the harbour mouth where a friendly dolphin greeted boats for thirty-seven years, a fisherman hopes for company.'),
    ('sea-fisher-sagami', 'A fisherman under the great wave', 'Off Kanagawa, Sagami Bay', 35.2900, 139.6000, fisher('indigo', 'straw', 'kasa', skin='golden', hair='black'),
     'Off the shore a woodblock master made famous, a fisherman rides the swell with the white mountain far behind.'),
    ('sea-fisher-nazare', 'A fisherman of Nazaré', 'Off Nazaré, Portugal', 39.6000, -9.0900, fisher('madder', 'black', 'cap', skin='olive', hair='dark'),
     'Off a town where surfers ride the tallest waves on Earth, a fisherman keeps well clear of the canyon.'),
    ('sea-fisher-galilee', 'A fisherman on the lake', 'Sea of Galilee', 32.8300, 35.5850, fisher('white', 'woad', 'headwrap', skin='olive', hair='dark'),
     'On a freshwater sea below sea level, where nets were famously cast on the other side, one more fisherman tries his luck.'),
    # boats of the wider world
    ('sea-pearl-diver', 'A pearl diver\'s dhow', 'Pearl banks off Muharraq, Bahrain', 26.3150, 50.6800, spec(26, 25, [P(13, 22, inBoat='dhow', garb='robe', skin='brown', c1='white', hat='headwrap', hatc='white', arms=['fwd', 'down'], pose='boat', seats=[[4, -1.8]], hair='black')]),
     'Off an island whose pearling path is on the World Heritage list, a dhow waits while a diver goes down for oysters.'),
    ('sea-navigator-tahiti', 'A navigator\'s outrigger', 'Matavai Bay, Tahiti', -17.4950, -149.5050, spec(30, 14, [P(15, 10, inBoat='waka', garb='loin', skin='medium', c1='brown', prop='paddle', arms=['row', 'row'], seats=[[-6, -1.6], [0, -1.6], [6, -1.6]], hair='black')]),
     'In the bay where Cook watched the transit of Venus, paddlers who steer by the stars and the swell head out to sea.'),
    ('sea-dhow-zanzibar', 'A dhow off Stone Town', 'Off Stone Town, Zanzibar', -6.1580, 39.1780, spec(22, 24, [P(11, 21, inBoat='felucca', garb='robe', skin='deep', c1='white', hat='cap', hatc='white', prop='paddle', pose='boat', seats=[[3.6, -1.2]], arms=['row', 'row'], hair='black')]),
     'A lateen sail carries a trader on the monsoon wind past the old stone town of a spice island.'),
    ('sea-sampan-hongkong', 'A sampan in the harbour', 'Victoria Harbour, Hong Kong', 22.2880, 114.1720, spec(24, 21, [P(14, 17, inBoat='sampan', garb='tunic', skin='golden', c1='indigo', c2='indigo', hat='conical', prop='pole', pose='stand', seats=[[-4, -1.8]], arms=['hold', 'hold'], hair='black', h=14)]),
     'Between a fragrant harbour\'s island and the mainland, under walls of towers, a sampan sculls across.'),
    # drifting bottles with riddles (the riddle is the message inside)
    ('sea-bottle-skagen', 'A bottle where two seas meet', 'Off Grenen, Skagen, Denmark', 57.7560, 10.6450, bottle(),
     '"Where two seas meet and never mix, at the tip of a land of bicycles and butter, I bob." Find the bottle.'),
    ('sea-bottle-capehorn', 'A bottle off the Horn', 'Off Cape Horn', -56.0200, -67.2500, bottle(),
     '"Rounded by clippers, feared by all, the southern cape of the furthest isles. I was thrown from a deck here." Find the bottle.'),
    ('sea-bottle-capecod', 'A bottle off the Cape', 'Off Cape Cod, Massachusetts', 41.6700, -69.9200, bottle(),
     '"I drift off the bent arm of a state of pilgrims, where the shoals took many a ship." Find the bottle.'),
    ('sea-bottle-bermuda', 'A bottle near Bermuda', 'Off St George\'s, Bermuda', 32.3900, -64.6500, bottle(),
     '"Near isles wrecked upon by a ship that gave a playwright his tempest, I float in a weedy sea." Find the bottle.'),
    ('sea-bottle-gibraltar', 'A bottle in the Strait', 'Strait of Gibraltar', 35.9700, -5.5000, bottle(),
     '"Between the two pillars of the old world\'s end, where one sea pours into the other, I spin." Find the bottle.'),
    ('sea-bottle-dover', 'A bottle in the Strait of Dover', 'Strait of Dover, off the white cliffs', 51.0950, 1.3950, bottle(),
     '"Under white cliffs, in the busiest sea lane on Earth, a message from France has nearly reached England." Find the bottle.'),
    ('sea-bottle-goodwin', 'A bottle on the Goodwin Sands', 'Goodwin Sands, Kent', 51.2550, 1.5500, bottle(),
     '"On the ship-swallowing sands off Deal, where a ghost ship is said to run aground every fifty years, I rest at low tide." Find the bottle.'),
    ('sea-bottle-hebrides', 'A bottle in the Minch', 'The Minch, off Stornoway', 58.1950, -6.3300, bottle(),
     '"In the strait between the Long Island and the mainland, near a town of tweed and kippers, I wash about." Find the bottle.'),
]

data = json.load(open(os.path.join(OUT, 'folk.json')))
data['folk'] = [f for f in data['folk'] if not f['id'].startswith('sea-')]
if REGION not in data['regions']: data['regions'].append(REGION)
for fid, name, place, lat, lon, art, riddle in FOLK:
    data['folk'].append({'id': fid, 'name': name, 'place': place, 'riddle': riddle, 'lat': lat, 'lon': lon, 'region': REGION, 'country': '', 'iso': '', 'art': art, 'sea': 1})
json.dump(data, open(os.path.join(OUT, 'folk.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

# the sources list and the summary
rows = [r for r in csv.DictReader(open(os.path.join(OUT, 'sources.csv'))) if not r['id'].startswith('sea-')]
fields = list(rows[0].keys())
for fid, name, place, lat, lon, art, riddle in FOLK:
    rows.append({'id': fid, 'name': name, 'place': place, 'lat': lat, 'lon': lon, 'country': '', 'region': REGION, 'archetype': fid.split('-')[1], 'hand_placed': 1, 'water': 'sea', 'source': 'hand-placed (round 3, at sea)'})
with open(os.path.join(OUT, 'sources.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
summ = json.load(open(os.path.join(OUT, 'folk_summary.json')))
summ['total'] = len(data['folk'])
summ['hand_placed'] = sum(1 for r in rows if str(r['hand_placed']) == '1')
summ['regions'][REGION] = len(FOLK)
summ['at_sea'] = len(FOLK)
summ['bytes'] = os.path.getsize(os.path.join(OUT, 'folk.json'))
json.dump(summ, open(os.path.join(OUT, 'folk_summary.json'), 'w'), indent=1, ensure_ascii=False)
print('sea folk', len(FOLK), 'total', len(data['folk']))
