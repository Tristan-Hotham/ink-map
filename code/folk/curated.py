"""Hand-placed hidden folk. Each entry: id, name, arch (archetype key, or a custom spec), place (shown once found),
q (look up in the map's own heritage or landmark data) and/or at (lat, lon, placed by hand), riddle, optional
off (metres east, north from the looked-up site), water (True: the figure sits on water, never offset onto land).
Coordinates 'at' are hand-placed from the named place and are approximate to a few hundred metres."""

C = []


def add(id, name, arch, place, riddle, at=None, q=None, off=None, water=False, **kw):
    C.append(dict(id=id, name=name, arch=arch, place=place, riddle=riddle, at=at, q=q, off=off, water=water, **kw))


# ------------------------------------------------------------------ Britain and Ireland
add('cartographer', 'The lost Cartographer', 'cartographer', 'High fells near Scafell Pike, Lake District',
    'High on the roof of England, among crags and screes, a mapmaker sits with half a map and no idea which way is down.', at=(54.4521, -3.2072))
add('pedlar-hambleton', 'Pedlar and donkey', 'pedlar', 'The old drove road over the Hambleton Hills, North Yorkshire',
    'Where Scots cattle once tramped south along a green road on the hill tops above Thirsk, a pedlar walks his patient donkey.', at=(54.3367, -1.2345))
add('monk-goose', 'The monk and the runaway goose', ('monk', 'goose'), 'Rievaulx Abbey, North Yorkshire',
    'In a quiet valley of the Rye, below the great roofless abbey, a monk has lost all dignity chasing a goose.', q='Rievaulx Abbey', off=(160, 60))
add('shepherd-dartmoor', 'Shepherd seeking one lost sheep', 'shepherd', 'Haytor Rocks, Dartmoor',
    'Under the granite tor most climbed on the moor, a shepherd counts his flock and counts again: one is missing.', at=(50.5811, -3.7525), sheep=1)
add('lostsheep-dartmoor', 'The lost sheep', 'lostsheep', 'Hound Tor, Dartmoor',
    'The shepherd of Haytor will not rest: his stray grazes alone by a tor named for a pack of hounds turned to stone.', q='Hound Tor Deserted Medieval Village', off=(-220, 260))
add('witch-holywell', 'Hedge-witch at the holy well', 'hedgewitch', "St Winefride's Well, Holywell, Flintshire",
    'At the well that has drawn pilgrims for thirteen hundred years, a hedge-witch stirs something green and does not share the recipe.', q="St Winefride's Well", off=(70, -90))
add('witch-pendle', 'A witch on Pendle Hill', 'hedgewitch', 'Pendle Hill, Lancashire',
    'On the big end of the hill that gave its name to a famous trial, a cauldron bubbles by the summit wall.', at=(53.8687, -2.2985))
add('captain-thames', 'Sea captain rowing up the river', 'rower_captain', 'The Thames at Greenwich',
    'His ship is far behind him, but a bearded captain still rows upstream past the old naval college, determined to reach London by oar.', at=(51.4871, -0.0078), water='fixed')
add('troll-kirkby', 'The toll-troll', 'troll', 'Devil\'s Bridge, Kirkby Lonsdale, Cumbria',
    'Under the three ribbed arches over the Lune, said to be the Devil\'s own work, someone large and grey charges a penny a crossing.', at=(54.2010, -2.6022))
add('highwaymen-hounslow', 'Highwaymen on the heath', 'highwaymen', 'Hounslow Heath, west London',
    '"Stand and deliver!" On the heath once feared by every coach out of London, two shady figures wait with a lantern and a blade.', q='Hounslow Heath', off=(-120, 40))
add('serpent-ness', 'The sulking serpent', 'serpent', 'Loch Ness, off Urquhart Castle',
    'Off the ruined castle on the long dark loch, three humps and a sulky face: it is tired of being photographed.', at=(57.3178, -4.4300), water='lake')
add('smugglers-prussia', 'Smugglers in the cove', 'smugglers', 'Prussia Cove, Cornwall',
    'In the cove named after a smuggler who called himself a king, barrels come ashore by lantern light.', at=(50.1012, -5.4195))
add('wolves-findhorn', 'A wolf pack eyeing a village', 'wolves', 'The Findhorn valley, Moray',
    'Legend says the last wolf in Scotland was killed by the Findhorn. Three more are watching the village, all the same.', at=(57.4280, -3.8840))
add('knight-wookey', 'The knight and the cross little dragon', 'knightcave', 'Wookey Hole Caves, Somerset',
    'At the mouth of the cave where a witch was turned to stone, a very small knight has met a very cross lizard.', q='Wookey Hole Caves', off=(40, 30))
add('slough-dragon', 'Here be Roundabouts', 'slough', 'A roundabout in Slough, Berkshire',
    'Here be roundabouts. A great green dragon sleeps curled round one on the edge of a famous Berkshire town, and a tiny knight dare not wake it.', at=(51.5086, -0.5990), big=True)
add('wayland', "Wayland the Smith", 'wayland', "Wayland's Smithy, Oxfordshire",
    'Leave your horse and a silver coin by the long barrow on the Ridgeway, and the smith of legend will shoe it by morning.', q="Wayland's Smithy", off=(60, -40))
add('herne', 'Herne the Hunter', 'herne', 'Windsor Great Park, Berkshire',
    'An antlered rider with a hound and a horn haunts the oaks of the royal park by the castle. Keep to the paths.', q='Windsor Great Park', off=(-300, 200))
add('wight-kennet', 'The barrow-wight', 'wight', 'West Kennet Long Barrow, Wiltshire',
    'A pale crowned figure keeps the long barrow above the Kennet, where the dead of five thousand years ago were laid.', q='West Kennet Long Barrow', off=(40, 30))
add('wodewose-wistman', 'The wodewose', 'wodewose', "Wistman's Wood, Dartmoor",
    'Among stunted mossy oaks and tumbled granite in the West Dart valley, a hairy wild man of the woods leans on his club.', q="Wistman's Wood", off=(20, 40))
add('orcs-rannoch', 'Orcs camped on the moor', 'orcs', 'Rannoch Moor, Highlands',
    'On the bleakest moor in Scotland, all bog and lochan and sky, a tusked warband warms itself at a smoky fire.', at=(56.6260, -4.7380))
add('giant-cerne', 'The giant out for a walk', 'giant', 'Above Cerne Abbas, Dorset',
    'The chalk giant on the hillside has a cousin, fully dressed, striding over the downs above the village.', q='Cerne Abbas Giant', off=(380, 120))
add('unicorn-glencoe', 'The unicorn of the glen', 'unicorn', 'Glen Coe, Highlands',
    'The kingdom\'s own beast grazes quietly where the glen is deepest, under the Three Sisters.', at=(56.6710, -5.0480))
add('mermaid-zennor', 'The mermaid of Zennor', 'mermaid', 'Pendour Cove, Zennor, Cornwall',
    'She lured a chorister of St Senara\'s down to the sea; she sits on a rock in the cove below the church to this day.', at=(50.1991, -5.5705))
add('wisp-wicken', "Will-o'-the-wisp", 'wisp', 'Wicken Fen, Cambridgeshire',
    'Lights over the last wild fen. Do not follow them across the sedge.', q='Wicken Fen', off=(-200, 100))
add('fairies-ditchling', 'Fairy ring on the downs', 'fairyring', 'Ditchling Beacon, South Downs',
    'On the high chalk downs above the Weald, a ring of red toadstools and two very small dancers.', at=(50.9012, -0.1080))
add('cockatrice-corfe', 'The cockatrice in the ruins', 'cockatrice', 'Corfe Castle, Dorset',
    'Half cockerel, half serpent, wholly bad tempered: it roosts in the slighted ruins in the gap of the Purbeck hills.', q='Corfe Castle', off=(60, -50))
add('wyvern-emrys', 'Wyvern over Wales', 'wyvern', 'Dinas Emrys, Snowdonia',
    'Where a red dragon and a white were found fighting under a hill fort, a red wyvern still circles.', q='Dinas Emrys', off=(80, 40))
add('giant-causeway', 'The giant at the causeway', 'giant', "Giant's Causeway, County Antrim",
    'A giant who built a road of stone columns across the sea to Scotland is out on the causeway again.', at=(55.2412, -6.5110))
add('shuck-overstrand', 'Black Shuck', 'blackdog', 'The cliffs at Overstrand, Norfolk',
    'A huge black dog with one fiery eye pads the cliff path along the north Norfolk coast. Do not look back.', at=(52.9175, 1.3405))
add('knockers-botallack', 'Knockers in the tin mine', 'knockers', 'Botallack, Cornwall',
    'By the engine houses on the cliffs of the far west, the little knockers of the mines tap and tap.', at=(50.1396, -5.6855))
add('selkie-skaill', 'The selkie', 'selkie', 'Bay of Skaill, Orkney',
    'By the Stone Age village in the bay, someone has left a sealskin on the rocks and is sitting very still.', at=(59.0495, -3.3440))
add('kelpie-lomond', 'The kelpie', 'kelpie', 'Loch Lomond',
    'A grey horse with a weedy mane waits in the shallows of the bonnie loch. Do not climb on.', at=(56.0820, -4.5880), water='lake')
add('banshee-leap', 'The banshee', 'banshee', 'Leap Castle, County Offaly',
    'At the castle said to be the most haunted in Ireland, a pale woman keens on the hill.', q='Leap Castle', off=(-80, 60))
add('leprechaun-gullion', 'The little shoemaker', 'leprechaun', 'Slieve Gullion, County Armagh',
    'On the mountain of the old stories a tiny cobbler taps away beside his pots. If you catch him, do not look away.', at=(54.1220, -6.4330))
add('brownie-traquair', 'The brownie', 'brownie', 'Traquair House, Scottish Borders',
    'At the old house in the Borders where the gates stay shut, a little helper sweeps the yard at night.', q='Traquair House', off=(60, 70))
add('greenman-rosslyn', 'The Green Man', 'greenman', 'Rosslyn Chapel, Midlothian',
    'The chapel is carved with a hundred leafy faces. One has stepped outside into the glen.', q='Rosslyn Chapel, Roslin', off=(90, -80))
add('ghost-bosworth', 'Ghost knight at Bosworth', 'ghostknight', 'Bosworth Field, Leicestershire',
    'A pale knight still walks the field where the last English king to die in battle fell.', q='Battle of Bosworth Field', off=(60, 40))
add('halflings-picnic', 'Halflings at a picnic', 'halflings_picnic', 'Near Broadway Tower, Cotswolds',
    'Below the folly on the Cotswold edge, a family of small folk has spread a cloth: second breakfast.', q='Broadway Tower', off=(-160, -120))
add('halfling-cheese', 'The runaway cheese', 'halfling_cheese', "Cooper's Hill, Gloucestershire",
    'On the steepest slope in the Cotswolds a cheese is winning the race. A small person in red is losing.', at=(51.8337, -2.1629))
add('halfling-fisher', 'The halfling and the heron', 'halfling_fisher', 'Ashness Bridge, above Derwentwater',
    'On the little packhorse bridge over Barrow Beck, a halfling dangles a line while a heron eyes the catch.', at=(54.5726, -3.1223))
add('halfling-sleep', 'A nap in the orchard', 'halfling_sleep', 'Cider orchards near Much Marcle, Herefordshire',
    'Among the apple trees of the cider country, someone small has had too much of last year\'s pressing.', at=(51.9965, -2.4940))
add('dragon-suttonhoo', 'The dragon of the hoard', 'dragonhoard', 'Sutton Hoo, Suffolk',
    'By the royal burial mounds above the Deben, a dragon sleeps on the gold the diggers did not find.', q='Sutton Hoo', off=(90, 60))
add('piper-maidens', 'The Merry Maidens\' piper', 'piper', 'The Merry Maidens, Cornwall',
    'Nineteen maidens danced on the Sabbath and were turned to stone; their piper is still playing nearby.', q='The Merry Maidens', off=(140, 40))
add('surveyor-longman', 'Surveying the Long Man', 'cartographer_world', 'The Long Man of Wilmington, East Sussex',
    'A surveyor with map and staff is measuring the tall outline on the downs. He has counted to sixty metres and given up.', at=(50.8100, 0.1880))
add('stgeorge-uffington', 'Saint George on Dragon Hill', 'stgeorge', 'Dragon Hill, Uffington, Oxfordshire',
    'Grass will not grow where the dragon\'s blood was spilt, they say, on the flat hill below the White Horse.', at=(51.5800, -1.5677))
add('outlaw-sherwood', 'An outlaw in the greenwood', 'archer', 'The Major Oak, Sherwood Forest',
    'Under the great oak of the forest, a hooded archer in green takes aim. Guess who.', at=(53.2047, -1.0720))
add('vikings-lindisfarne', 'Longship off Holy Island', 'viking', 'Off Lindisfarne, Northumberland',
    'Off the holy island of the north-east, a striped sail. The monks will not like this.', at=(55.6800, -1.7550), water='sea')
add('monks-lindisfarne', 'Monks of Lindisfarne', ('monk', 'walk'), 'Lindisfarne Priory, Northumberland',
    'Beside the priory where a famous gospel book was made, a monk hurries indoors with a book under his arm.', q='Lindisfarne Priory', off=(-60, 40))
add('viking-jorvik', 'A Viking in Jorvik', 'vikingfoot', 'Coppergate, York',
    'In the old Norse town on the Ouse, under the street called the cup-makers\' way, a bearded settler strolls.', at=(53.9573, -1.0805))
add('nun-whitby', 'The abbess\'s nun', 'nun', 'Whitby Abbey, North Yorkshire',
    'On the headland of the 199 steps, a nun of Abbess Hild\'s house carries a candle against the sea wind.', q='Whitby Abbey', off=(80, -40))
add('monk-durham', 'Monk at Durham', ('monk', 'walk'), 'Durham Cathedral',
    'On the rock in the loop of the Wear, a monk of the cathedral priory carries a lantern for Saint Cuthbert.', at=(54.7735, -1.5770))
add('pilgrims-canterbury', 'Pilgrims riding to Canterbury', 'pilgrimhorse', 'Canterbury',
    'They tell each other stories all the way from Southwark; this one has reached the city of the martyr at last.', at=(51.2795, 1.0760))
add('piper-edinburgh', 'Piper on the Mile', 'piper', 'The Royal Mile, Edinburgh',
    'Between the castle on its rock and the palace at the bottom, a piper fills the old town with noise.', at=(55.9497, -3.1910))
add('fairies-skye', 'Fairies in the glen', 'fairyring', 'The Fairy Glen, Uig, Isle of Skye',
    'Little cones of green hills, rings of stones, and something very small dancing in Skye\'s smallest glen.', q='Fairy Glen', near=(57.58, -6.32), off=(30, 30))
add('knight-bamburgh', 'Knight at Bamburgh', 'knight', 'Bamburgh Castle, Northumberland',
    'Below the great fortress on its rock above the dunes, a knight rides out under his banner.', at=(55.6085, -1.7120))
add('watch-clitheroe', 'Watchman at Clitheroe', 'watchman', 'Clitheroe Castle, Lancashire',
    'On the limestone knoll above the little Lancashire town, by one of the smallest keeps in England, a watchman stands his post.', q='Clitheroe Castle', off=(40, -40))
add('falconer-malham', 'Falconer at the cove', 'falconer', 'Malham Cove, Yorkshire Dales',
    'Where peregrines nest on a great curved cliff of limestone, a falconer has come to admire the competition.', at=(54.0712, -2.1580))
add('monk-glastonbury', 'Monk on the Tor', ('monk', 'walk'), 'Glastonbury Tor, Somerset',
    'On the green hill with the lonely tower above the Somerset Levels, a monk climbs towards the old chapel of Saint Michael.', at=(51.1443, -2.6985))
add('swineherd-bath', 'Bladud\'s swineherd', 'swineherd', 'Bath',
    'A prince with an ailment kept pigs, the story goes, and found the hot springs when his pigs wallowed. His swine are still near the abbey.', q='Bath Abbey', off=(-120, -60))
add('worm-lambton', 'The Lambton Worm', 'tatzelwurm', 'Penshaw Hill, County Durham',
    'A worm that grew too big for its well wound itself round a hill by the Wear. A temple stands there now, but the worm has not left.', q='Penshaw Monument', off=(-90, -60))
add('gelert', 'Gelert the faithful hound', 'hound_alone', 'Beddgelert, Gwynedd',
    'In the village where the rivers meet, a faithful hound waits by a prince\'s grave.', at=(53.0098, -4.1034))
add('lady-fanfach', 'The Lady of the Lake', 'lakelady', 'Llyn y Fan Fach, Carmarthenshire',
    'Under the dark scarp of the Black Mountain, a lady stands at the edge of a small lake. She once married a farmer here.', at=(51.8870, -3.7415))
add('fairies-newgrange', 'The fair folk at Brú na Bóinne', 'fairyring', 'Newgrange, County Meath',
    'The great mound by the Boyne was a house of the gods, they say. Its people still dance on the grass outside.', at=(53.6940, -6.4745))
add('monk-cashel', 'Monk on the Rock', ('monk', 'bell'), 'Rock of Cashel, County Tipperary',
    'On the rock the Devil bit out of a mountain, a monk rings a bell among the ruins of the kings of Munster.', q='Rock of Cashel Cathedral', off=(70, 50))
add('monk-skellig', 'Monk of Skellig', ('monk', 'walk'), 'Skellig Michael, County Kerry',
    'Six hundred steps up a needle of rock in the Atlantic, a monk climbs to his beehive cell.', q='Skellig Michael', off=(-20, 30))
add('hermit-glendalough', 'Hermit of the glen of two lakes', 'hermit', 'Glendalough, County Wicklow',
    'A holy man left the world for a cave above the upper lake. A blackbird nested in his open hand, they say.', q='Glendalough', off=(-900, -150))
add('fairies-man', 'At the Fairy Bridge', 'fairyring', 'The Fairy Bridge, Isle of Man',
    'Say hello to the little people as you cross the bridge on the road from Douglas, or bad luck will follow.', at=(54.1230, -4.5945))
add('watch-orgueil', 'Watchman at Mont Orgueil', 'watchman', 'Mont Orgueil, Jersey',
    'Above the harbour at Gorey, a watchman looks east towards Normandy from the proud mountain of a castle.', q='Mont Orgueil', off=(40, -40))
add('shepherd-helvellyn', 'Shepherd under Helvellyn', 'shepherd', 'Glenridding, below Helvellyn',
    'Below the great fell with the knife-edge ridge, a shepherd brings the flock down to Ullswater.', at=(54.5449, -2.9652))
add('giant-stonehenge', 'A giant with a bluestone', 'giant', 'Near Stonehenge, Wiltshire',
    'The old story says giants carried the stones from far away. One of them is still looking for a spot.', at=(51.1810, -1.8300))
add('fairies-avebury', 'Dancers in the great circle', 'fairyring', 'Avebury, Wiltshire',
    'Inside the biggest stone circle of all, with a village in the middle, a ring of toadstools has a circle of its own.', at=(51.4285, -1.8520))
add('dwarf-ingleborough', 'A miner of the Dales', 'miner', 'Ingleborough Cave, Yorkshire Dales',
    'Beneath the flat-topped mountain of the Dales, someone with a pick has found the way into the hill.', q='Ingleborough Cave', off=(40, -30))
add('pilgrims-walsingham', 'Pilgrims to Walsingham', 'pilgrims', 'Walsingham, Norfolk',
    'Barefoot along the holy mile to England\'s Nazareth, two pilgrims with staffs and scallop shells.', at=(52.8935, 0.8735))
add('knight-tintagel', 'Watcher at Tintagel', 'watchman', 'Tintagel, Cornwall',
    'On the headland of a king who may never have been, a guard watches the Atlantic for ships that never come.', q='Tintagel Castle', off=(-40, 60))
add('watch-housesteads', 'On the Wall', 'watchman', 'Hadrian\'s Wall at Housesteads, Northumberland',
    'Long after the legions left, a lonely guard still walks the great wall across the north.', q='Housesteads Roman Fort', off=(60, 70))
add('hermit-cheddar', 'Hermit in the gorge', 'hermit', 'Cheddar Gorge, Somerset',
    'In the deepest gorge in Britain, where a famous cheese was once kept cool in the caves, a hermit sits with his lantern.', at=(51.2828, -2.7590))
add('banshee-moher', 'Keening on the cliffs', 'banshee', 'Cliffs of Moher, County Clare',
    'Two hundred metres above the Atlantic on the edge of Clare, a pale figure in the wind.', at=(52.9720, -9.4260))
add('orcs-kinder', 'A warband on Kinder', 'orcs', 'Kinder Scout, Peak District',
    'Among the peat groughs on the dark plateau where ramblers once trespassed, an ugly camp has been pitched.', at=(53.3850, -1.8700))
add('climber-stanage', 'Archer at Stanage', 'archer', 'Stanage Edge, Peak District',
    'Along the gritstone edge where millstones lie abandoned, an outlaw practises in Hathersage country.', at=(53.3640, -1.6380))
add('cat-bodmin', 'The beast of the moor', 'blackdog', 'Bodmin Moor, Cornwall',
    'Something large and black is seen on Cornwall\'s high moor, near the Cheesewring\'s stacked rocks.', at=(50.5240, -4.4600))
add('scholar-oxford', 'Scholar at Oxford', 'scholar', 'Radcliffe Square, Oxford',
    'In the city of dreaming spires, a scholar hurries past the great domed library, late for a lecture.', at=(51.7533, -1.2537))
add('scholar-cambridge', 'Scholar at Cambridge', 'scholar', "King's Parade, Cambridge",
    'Under the pinnacles of the famous chapel on the Cam, a student in a long gown clutches a book.', at=(52.2040, 0.1180))
add('miller-cley', 'The miller of Cley', 'miller', 'Cley windmill, Norfolk',
    'By the windmill above the salt marshes of the north Norfolk coast, a dusty miller heaves a sack.', at=(52.9550, 1.0435))
add('vintner-bolney', 'A Sussex vintner', 'vintner', 'The vineyards of the South Downs, Sussex',
    'English wine is not a new idea: the monks had vines. A vintner picks grapes on a chalk slope in the Weald.', at=(50.9870, -0.1850))
add('pedlar-ludlow', 'Pedlar at Ludlow', 'pedlar', 'Ludlow, Shropshire',
    'Below the castle of the Marches and the tall church tower, a pedlar comes into town for market day.', at=(52.3665, -2.7225))
add('knight-conwy', 'Knight at Conwy', 'knight', 'Conwy, Gwynedd',
    'By the eight towers on the estuary, a knight under a banner rides out of the walled town.', at=(53.2795, -3.8270))
add('knight-caernarfon', 'Guard at Caernarfon', 'watchman', 'Caernarfon Castle, Gwynedd',
    'By the castle with banded walls by the Menai, a guard keeps an eye on the strait.', at=(53.1390, -4.2780))
add('skaters-ouse', 'Skaters on the frozen fen', 'skaters', 'Bury Fen, Cambridgeshire',
    'When the fens freeze hard, the old fen skaters come out on the washes by the Ouse.', at=(52.3640, 0.0510))
add('ploughman-laxton', 'Ploughing the open field', 'ploughman', 'Laxton, Nottinghamshire',
    'In the last village in England still farmed in open strips, a ploughman drives his ox along a furlong.', at=(53.1960, -0.9200))
add('goosegirl-nottingham', 'Goose girl at the fair', 'goosegirl', 'Goose Fair, Nottingham',
    'Geese were once walked to the great October fair here; this girl and her flock are still on their way.', at=(52.9640, -1.1650))
add('cheese-wensleydale', 'Dairymaid of the dale', 'milkmaid', 'Hawes, Wensleydale',
    'In the dale of a famous crumbly cheese, a milkmaid carries her pails home along the green road.', at=(54.3045, -2.1960))

# ------------------------------------------------------------------ Europe
add('pilgrims-cebreiro', 'Pilgrims on the Camino', 'pilgrims', 'O Cebreiro, Galicia',
    'On the last great climb of the Way of Saint James, where the old round thatched houses stand, two pilgrims plod on with their shells.', at=(42.7078, -7.0432))
add('pilgrims-santiago', 'Pilgrims arrive', 'pilgrims', 'Santiago de Compostela',
    'At journey\'s end, in front of the great cathedral of the apostle, two pilgrims have finally stopped walking.', at=(42.8806, -8.5458))
add('pilgrims-roncesvalles', 'Over the pass', 'pilgrimhorse', 'Roncesvalles, Navarre',
    'Over the pass where a famous horn was blown in vain, a pilgrim on a mule comes down into Spain.', at=(43.0093, -1.3195))
add('pilgrims-lepuy', 'Setting out from Le Puy', 'pilgrims', 'Le Puy-en-Velay, Auvergne',
    'Among the volcanic needles topped with chapels, two pilgrims set out on the long road south-west.', at=(45.0440, 3.8850))
add('pilgrims-vezelay', 'From Vézelay', 'pilgrims', 'Vézelay, Burgundy',
    'From the basilica on its hill in Burgundy, where crusades were preached, pilgrims walk down to the road.', at=(47.4650, 3.7440))
add('pilgrims-msm', 'Crossing the bay', 'pilgrims', 'The sands of Mont-Saint-Michel',
    'Two pilgrims hurry across the sands towards the abbey on its island before the tide comes in like a galloping horse.', at=(48.6280, -1.5110))
add('knight-carcassonne', 'Knight at Carcassonne', 'knight', 'Carcassonne, Occitanie',
    'Under the double walls and fifty-two towers of the fairy-tale city, a knight rides out.', at=(43.2070, 2.3640))
add('scholar-paris', 'Scholar on the Île de la Cité', 'scholar', 'Notre-Dame de Paris',
    'Under the twin towers by the Seine, a scholar of the schools of Paris argues with nobody in particular.', at=(48.8525, 2.3485))
add('wisp-broceliande', 'Lights in Brocéliande', 'wisp', 'Forest of Paimpont (Brocéliande), Brittany',
    'In the forest of an enchanter of legend, lights drift over the pools at dusk.', at=(48.0030, -2.2070))
add('lorelei', 'The singer on the rock', 'mermaid', 'The Lorelei, Rhine',
    'High above the narrowest bend of the Rhine a fair singer combs her hair, and boatmen forget to steer.', at=(50.1405, 7.7300))
add('witch-brocken', 'Witch on the Brocken', 'hedgewitch', 'The Brocken, Harz',
    'On the bald summit of the Harz where witches gather on Walpurgis night, one has come early to get the cauldron going.', at=(51.8000, 10.6170))
add('dwarves-goslar', 'Dwarf smiths of the Harz', ('smith', 'dwarf'), 'Rammelsberg, Goslar, Harz',
    'Under the hill that gave a thousand years of silver and copper, small bearded smiths hammer by the forge.', at=(51.8920, 10.4200))
add('piper-hamelin', 'The piper and the rats', 'pipedpiper', 'Hamelin, Lower Saxony',
    'In the town on the Weser that would not pay its bill, a piper in red and yellow leads a parade of rats.', at=(52.1040, 9.3590))
add('musicians-bremen', 'The town musicians', 'musicians', 'Bremen',
    'A donkey, a dog, a cat and a cockerel set out to make music in this Hanseatic city and never quite arrived.', at=(53.0760, 8.8070))
add('woodcutter-blackforest', 'Woodcutter of the Black Forest', 'woodcutter', 'The Black Forest near Triberg',
    'Among the dark firs where cuckoo clocks are carved, a woodcutter swings his axe.', at=(48.1290, 8.2300))
add('knight-neuschwanstein', 'The swan knight', 'knight', 'Below Neuschwanstein, Bavaria',
    'Below the white castle of a dreaming king, a knight under a banner rides along the lake.', at=(47.5550, 10.7400))
add('skaters-kinderdijk', 'Skaters at the windmills', 'skaters', 'Kinderdijk, South Holland',
    'Nineteen windmills drain the polder; when the canals freeze, everyone in the village is out on the ice.', at=(51.8850, 4.6380))
add('miller-zaanse', 'Miller of the Zaan', 'miller', 'Zaanse Schans, North Holland',
    'Among the green wooden houses and windmills on the Zaan, a dusty miller shoulders a sack.', at=(52.4740, 4.8170))
add('merchant-bruges', 'Merchant of Bruges', 'merchant', 'Bruges',
    'In the great cloth town on its canals, a merchant in a red hood has just done very well at the market.', at=(51.2085, 3.2245))
add('alphorn-rigi', 'Alphorn on the Rigi', 'alphorn', 'The Rigi, Lucerne',
    'On the queen of mountains above the lake of the four cantons, a long low note rolls across the valley.', at=(47.0565, 8.4850))
add('tatzelwurm-tyrol', 'The tatzelwurm', 'tatzelwurm', 'High pastures near Kufstein, Tyrol',
    'A stumpy-legged worm with a cat\'s face lives under the alpine stones of the Kaisergebirge. Herders swear to it.', at=(47.5650, 12.2650))
add('griffin-matterhorn', 'Griffin on the peak', 'griffin', 'Below the Matterhorn, Zermatt',
    'Half eagle, half lion, guarding gold under the most famous pyramid of rock in the Alps.', at=(45.9890, 7.6720))
add('miner-hallstatt', 'Salt miner of Hallstatt', 'miner', 'Hallstatt, Upper Austria',
    'Above the lake village where salt has been mined for seven thousand years, a miner heads into the mountain.', at=(47.5590, 13.6380))
add('gondolier-venice', 'Gondolier', 'gondolier', 'The Grand Canal, Venice',
    'Under the Rialto bridge a gondolier leans on his oar. He has heard every song.', at=(45.4380, 12.3355), water='canal')
add('friar-gubbio', 'The friar and the wolf', 'friar_wolf', 'Gubbio, Umbria',
    'A wolf terrorised this hill town until a friar from Assisi had a word with it. They have been friends ever since.', at=(43.3520, 12.5780))
add('pilgrim-rome', 'Pilgrim in Rome', 'pilgrims', "St Peter's Square, Rome",
    'All roads lead here. Two pilgrims have walked from the north to stand in the great colonnaded square.', at=(41.9023, 12.4570))
add('guard-vatican', 'A guard of the smallest state', 'watchman', 'Vatican City',
    'In the smallest country in the world, a guard in a striped uniform keeps the gate by the gardens.', at=(41.9030, 12.4540), iso='VAT')
add('wolves-abruzzo', 'Wolves in the Apennines', 'wolves', 'Pescasseroli, Abruzzo',
    'In the high national park where wolves never died out, a pack watches the village from the beech woods.', at=(41.8100, 13.7950))
add('scylla-messina', 'Monster of the strait', 'kraken', 'Strait of Messina',
    'Between the rock and the whirlpool, sailors of old met a monster with many arms. Keep to the middle.', at=(38.2350, 15.6380), water='sea')
add('quixote-consuegra', 'Tilting at windmills', 'quixote', 'The windmills of Consuegra, La Mancha',
    'On the ridge of white windmills in La Mancha, a thin knight on a thinner horse charges at a giant. His squire sighs.', at=(39.4500, -3.6070))
add('smith-toledo', 'Swordsmith of Toledo', 'smith', 'Toledo',
    'In the city on the Tagus famous for its blades, a smith tests an edge on the anvil.', at=(39.8570, -4.0230))
add('minstrel-alhambra', 'Minstrel at the Alhambra', 'minstrel', 'The Alhambra, Granada',
    'In the red palace above Granada, a minstrel plays beside fountains that sing back.', at=(37.1765, -3.5880))
add('navigator-belem', 'Navigator at Belém', 'cogship', 'Belém, Lisbon',
    'From the tower on the Tagus the great voyages set out. A ship with a red cross on its sail heads for the open sea.', at=(38.6900, -9.2150), water='river')
add('monks-meteora', 'Monks of the Meteora', ('monk', 'walk'), 'Meteora, Thessaly',
    'Monasteries perch on pillars of rock in mid-air; one monk has come down for supplies and dreads the climb.', at=(39.7140, 21.6290))
add('shepherd-olympus', 'Shepherd on Olympus', 'shepherd', 'Mount Olympus, Greece',
    'On the mountain of the gods, a shepherd minds his flock and pays the gods no attention.', at=(40.0890, 22.3700))
add('kraken-lofoten', 'Kraken of the Maelstrom', 'kraken', 'The Moskstraumen, Lofoten',
    'Off the end of the islands where the great whirlpool turns, many arms rise from the sea.', at=(67.8150, 12.7800), water='sea')
add('longship-sogne', 'Longship in the fjord', 'viking', 'The Sognefjord, Norway',
    'In the longest and deepest fjord of Norway, a striped sail glides between walls of rock.', at=(61.1050, 6.6400), water='sea')
add('trolls-trollstigen', 'Trolls at the ladder', 'trollbare', 'Trollstigen, Romsdal',
    'Where the road climbs the troll\'s ladder in hairpin bends, a troll has come down to watch the traffic.', at=(62.4560, 7.6700))
add('dragon-uppsala', 'The dragon in the king\'s mound', 'dragonhoard', 'Gamla Uppsala, Sweden',
    'By the great royal mounds of the old kings of the Swedes, a dragon guards a hoard, as dragons in the old poems do.', at=(59.8980, 17.6320))
add('herder-jokkmokk', 'Reindeer herder of Sápmi', 'reindeerherder', 'Jokkmokk, Swedish Lapland',
    'Just north of the Arctic Circle, where a winter market has been held for four hundred years, a herder walks with his reindeer.', at=(66.6070, 19.8230))
add('prince-kronborg', 'A brooding prince', 'scholar', 'Kronborg, Helsingør',
    'On the battlements of the castle at the narrows of the Sound, a young man in black is having a very bad week.', at=(56.0390, 12.6210))
add('stonetrolls-reynis', 'Trolls turned to stone', 'stonetrolls', 'Reynisdrangar, Iceland',
    'They were dragging a ship ashore when the sun rose. Now they stand in the sea off the black beach for ever.', at=(63.4040, -19.0445), water='sea')
add('viking-thingvellir', 'At the Law Rock', 'vikingfoot', 'Þingvellir, Iceland',
    'Where the old parliament of the north met in a rift between two continents, a chieftain waits to speak.', at=(64.2560, -21.1250))
add('herder-rovaniemi', 'Herder by the Arctic Circle', 'reindeerherder', 'Rovaniemi, Lapland',
    'Where the Kemi meets the Ounas on the edge of the Arctic, a herder brings his reindeer through the snow.', at=(66.5100, 25.7300))
add('dragon-wawel', 'The Wawel dragon', 'wawel', 'Wawel Hill, Kraków',
    'In a cave under the royal castle by the Vistula lived a dragon, until a cobbler fed it a sheep stuffed with sulphur.', at=(50.0530, 19.9335))
add('knight-malbork', 'Knight of the castle on the Nogat', 'knight', 'Malbork Castle, Poland',
    'By the largest brick castle in the world, a knight in a white surcoat with a black cross rides out.', at=(54.0400, 19.0270), her={'d': 'cross', 'c1': 'white', 'c2': 'black'})
add('miner-kutna', 'Silver miner of Kuttenberg', 'miner', 'Kutná Hora, Bohemia',
    'In the silver town whose mines paid for a kingdom and a cathedral of the miners, a miner in white heads down the shaft.', at=(49.9480, 15.2680))
add('minstrel-charles', 'Minstrel on the bridge', 'minstrel', 'Charles Bridge, Prague',
    'Among the statues of the old stone bridge over the Vltava, a minstrel sings for a coin.', at=(50.0865, 14.4110))
add('jester-krumlov', 'The jester of Krumlov', 'jester', 'Český Krumlov, Bohemia',
    'In the castle town in the loop of the Vltava, a jester in red and gold tumbles over the cobbles.', at=(48.8120, 14.3150))
add('archer-hortobagy', 'Horse archer of the puszta', 'horsearcher_hu', 'The Hortobágy, Hungary',
    'Across the flat great plain of the Hortobágy, a horseman draws his bow at full gallop.', at=(47.5830, 21.1500))
add('shepherd-carpathians', 'Shepherd in the Carpathians', 'shepherd', 'Bucegi Mountains, Romania',
    'High in the Carpathians above the old castle road, a shepherd and his flock graze the summer pastures.', at=(45.4050, 25.4600))
add('monk-rila', 'Monk of Rila', ('monk', 'walk'), 'Rila Monastery, Bulgaria',
    'In the striped arcades of the great monastery deep in the mountains, a monk walks to prayer.', at=(42.1340, 23.3410))
add('merchant-dubrovnik', 'Merchant of Ragusa', 'merchant', 'Dubrovnik',
    'Inside the white walls of the old merchant republic, a trader counts his luck.', at=(42.6410, 18.1080))
add('pedlar-mostar', 'At the old bridge', 'pedlar', 'Stari Most, Mostar',
    'By the high single arch over the green Neretva, a pedlar and his donkey rest before the climb.', at=(43.3375, 17.8150))
add('babayaga', 'Baba Yaga\'s hut', 'babahut', 'Forest near Sergiyev Posad, Russia',
    'Deep in the birch and pine north of Moscow, a hut turns round on two great bird legs. Say the right words.', at=(56.3500, 38.0500))
add('firebird-suzdal', 'The firebird', 'firebird', 'Suzdal, Russia',
    'Among the white monasteries and onion domes of the old town, a bird of flame has landed in the orchard.', at=(56.4190, 40.4490))
add('sledge-kizhi', 'Sledge to Kizhi', 'sledge', 'Kizhi Island, Lake Onega',
    'Across the frozen lake to the wooden church with twenty-two domes, a sledge is pulled over the ice.', at=(62.0670, 35.2240))
add('cossack-khortytsia', 'Cossack of the island', 'cossack', 'Khortytsia, Zaporizhzhia',
    'On the rocky island in the Dnipro where the Cossack host had its stronghold, a rider waves his sabre.', at=(47.8300, 35.0900))
add('monk-lavra', 'Monk of the caves', ('monk', 'walk'), 'Kyiv Pechersk Lavra',
    'Above the Dnipro, where monks once lived in caves under the hill, a monk carries a lantern below ground.', at=(50.4345, 30.5575))
add('knight-valletta', 'Knight of Malta', 'knight', 'Valletta, Malta',
    'In the fortress city built after the great siege, a knight in red with a white cross rides by.', at=(35.8985, 14.5135), her={'d': 'cross', 'c1': 'madder', 'c2': 'white'})
add('caravan-sultanhani', 'Caravan at Sultanhanı', 'caravan', 'Sultanhanı caravanserai, Anatolia',
    'A day\'s camel walk out of Konya on the road to Aksaray, a caravan reaches the great stone inn for the night.', at=(38.2475, 33.5475))
add('watch-trakai', 'At the island castle', 'watchman', 'Trakai Island Castle, Lithuania',
    'On an island in Lake Galvė, a guard of the grand dukes looks out across the water.', at=(54.6520, 24.9330))
add('merchant-tallinn', 'Hanseatic merchant', 'merchant', 'Old Town, Tallinn',
    'In the walled Hanseatic town above the Baltic, a merchant has a cart full of furs and wax.', at=(59.4370, 24.7450))

# ------------------------------------------------------------------ the wider world
add('samurai-himeji', 'Samurai on the castle road', 'samurai', 'Himeji Castle, Hyōgo',
    'On the road below the white heron castle, a samurai walks with one hand on his sword.', at=(34.8360, 134.6920))
add('ninja-iga', 'Ninja on the roof', 'ninja', 'Iga Ueno Castle, Mie',
    'In the old home of the shinobi among the hills of Iga, someone in black is crouching on a roof. You probably will not see them.', at=(34.7715, 136.1250))
add('pilgrim-kumano', 'Pilgrim on the Kumano Kodo', 'jp_pilgrim', 'Kumano Hongū Taisha, Wakayama',
    'On the old pilgrim paths through the cedar forests of the Kii mountains, a pilgrim in white walks to the great shrine.', at=(33.8410, 135.7720))
add('farmer-kyoto', 'Rice farmer near Kyoto', 'jp_farmer', 'Ōhara, Kyoto',
    'In the quiet valley north of the old capital, a farmer in a straw hat bends to the paddy.', at=(35.1190, 135.8340))
add('scholar-suzhou', 'Scholar on the bridge', 'cn_scholar', 'The canals of Suzhou',
    'On a humpbacked bridge in the city of gardens and canals, a scholar stops to compose a poem.', at=(31.3170, 120.6290))
add('watch-mutianyu', 'Watch on the Great Wall', 'watchman_cn', 'The Great Wall at Mutianyu',
    'Along the wall that snakes over the hills north of Beijing, a guard walks between the watchtowers.', at=(40.4330, 116.5650))
add('farmer-longji', 'Rice terraces of Longji', 'rice', 'Longji rice terraces, Guangxi',
    'On the dragon\'s backbone terraces, a farmer in a conical hat works with a water buffalo.', at=(25.7550, 110.1150))
add('merchant-dunhuang', 'Merchant on the Silk Road', 'ca_merchant', 'Dunhuang, Gansu',
    'By the caves of a thousand buddhas on the edge of the desert, a merchant leads a two-humped camel west.', at=(40.0420, 94.8040))
add('fisher-lijiang', 'Boatman on the Li', 'sampan', 'The Li River at Xingping, Guangxi',
    'Among the limestone peaks of the Li, a boatman poles his little craft downstream.', at=(24.9230, 110.5130), water='river')
add('archer-karakorum', 'Mongol horse archer', 'mongol', 'Kharkhorin (Karakorum), Mongolia',
    'By the walls of the monastery on the site of the great khans\' capital, a horse archer turns in the saddle to shoot.', at=(47.2000, 102.8460))
add('scholar-gyeongbok', 'Scholar of Seoul', 'kr_scholar', 'Gyeongbokgung, Seoul',
    'Before the great palace of the Joseon kings, a scholar in a wide black hat walks with his fan.', at=(37.5780, 126.9770))
add('kayak-ilulissat', 'Hunter in a kayak', 'kayak', 'Disko Bay, off Ilulissat, Greenland',
    'Among the icebergs that drift out of the ice fjord, a hunter paddles a skin kayak.', at=(69.2250, -51.1500), water='sea')
add('waka-waitangi', 'Waka crew', 'waka', 'Bay of Islands, Aotearoa New Zealand',
    'Across the bay where a famous treaty was signed, a great carved canoe is paddled by a crew in perfect time.', at=(-35.2600, 174.1050), water='sea')
add('runner-tenochtitlan', 'Runner on the causeway', 'aztec', 'Mexico City (Tenochtitlan)',
    'Along the old causeway into the island city on the lake, a messenger runs with news for the great speaker.', at=(19.4300, -99.1330))
add('canoe-xochimilco', 'On the chinampas', 'dugout_mx', 'Xochimilco, Mexico City',
    'On the canals between the floating gardens, a farmer paddles a canoe full of flowers.', at=(19.2570, -99.1040), water='canal')
add('chasqui-machupicchu', 'Chasqui on the Inca road', 'chasqui', 'The Inca Trail near Machu Picchu',
    'Along the stone road high above the Urubamba, a relay runner blows a conch to warn the next station.', at=(-13.1650, -72.5400))
add('llama-cusco', 'Llama herder at Cusco', 'llamaherder', 'Sacsayhuamán, Cusco',
    'Below the zigzag walls of giant stones above the old Inca capital, a herder leads a llama.', at=(-13.5090, -71.9820))
add('reedboat-titicaca', 'Reed boat on Titicaca', 'reedboat', 'Lake Titicaca, near Isla del Sol',
    'On the highest great lake in the world, a boatman poles a boat made of totora reeds.', at=(-16.0300, -69.1600), water='lake')
add('caravan-isfahan', 'Persian caravan', 'caravan', 'Maranjab caravanserai, Iran',
    'On the salt desert road to Isfahan, a caravan arrives at a fortified inn by the dunes.', at=(34.2990, 51.8240))
add('felucca-luxor', 'Felucca on the Nile', 'felucca', 'The Nile at Luxor',
    'On the river between the temples of Karnak and the valley of the kings, a white sail leans in the north wind.', at=(25.7030, 32.6330), water='river')
add('elephant-amber', 'Elephant procession', 'elephant', 'Amber Fort, Jaipur',
    'Up the ramp to the honey-coloured fort above the lake, an elephant carries a canopy of red and gold.', at=(26.9840, 75.8530))
add('tuareg-ahaggar', 'Tuareg caravan', 'tuareg', 'The Ahaggar, near Tamanrasset',
    'Between oases in the black mountains of the Sahara, a rider veiled in indigo leads his camels.', at=(22.7900, 5.5300))
add('zulu-kzn', 'Warriors in the hills', 'zulu', 'The Valley of a Thousand Hills, KwaZulu-Natal',
    'Across the green rolling hills above the Umgeni, two warriors carry cowhide shields.', at=(-29.7400, 30.6900))
add('nguni-kzn', 'Herder with Nguni cattle', 'nguni', 'Near Eshowe, KwaZulu-Natal',
    'In the hills of Zululand, a herder walks beside a beautifully patterned cow.', at=(-28.8900, 31.4700))
add('basotho-lesotho', 'Basotho horseman', 'basotho', 'Near Semonkong, Lesotho',
    'In the mountain kingdom, a rider in a blanket and a woven conical hat crosses the high grassland.', at=(-29.8450, 28.0500))
add('maasai-mara', 'Herder in the Mara', 'maasai', 'Maasai Mara, Kenya',
    'On the grass plains of the great migration, a herder in red leans on his staff beside his cattle.', at=(-1.4900, 35.1400))
add('dhow-zanzibar', 'Dhow off Stone Town', 'dhow', 'Off Stone Town, Zanzibar',
    'Off the old trading town of coral stone, a dhow with a great triangular sail runs before the monsoon.', at=(-6.1600, 39.1800), water='sea')
add('pilgrim-lalibela', 'Pilgrim at Lalibela', 'et_pilgrim', 'Lalibela, Ethiopia',
    'Among churches carved downward out of the living rock, a pilgrim in white carries a cross.', at=(12.0315, 39.0420))
add('scholar-timbuktu', 'Scholar of Timbuktu', 'scholar_tk', 'Timbuktu, Mali',
    'In the city of mud mosques and great libraries on the edge of the Sahara, a scholar carries a manuscript.', at=(16.7750, -3.0070))
add('market-djenne', 'Market at Djenné', 'marketwoman', 'Djenné, Mali',
    'On market day before the great mosque of mud, a trader sets out her pots.', at=(13.9060, -4.5550))
add('horseman-kano', 'Horseman of Kano', 'sahel_horseman', 'Kano, Nigeria',
    'In the old walled city of the Hausa, a horseman in quilted cloth rides with a spear, as at the great durbar.', at=(12.0000, 8.5170))
add('griot-saintlouis', 'A griot', 'griot', 'Saint-Louis, Senegal',
    'On the island town at the mouth of the Senegal, a griot plays the kora and sings the old histories.', at=(16.0280, -16.5040))
add('mokoro-okavango', 'Mokoro in the delta', 'dugout', 'Okavango Delta, Botswana',
    'Through the reed channels of the great inland delta, a poler steers a dugout past the lilies.', at=(-19.2500, 22.9000), water='delta')
add('dugout-congo', 'Dugout on the Congo', 'dugout', 'The Congo River at Kisangani',
    'On the great river below the Boyoma falls, a fisherman paddles a long dugout.', at=(0.5150, 25.1900), water='river')
add('zebu-madagascar', 'Zebu herder', 'zebuherder', 'Near Ambalavao, Madagascar',
    'In the highlands where the great zebu market is held, a herder brings his humped cattle along the road.', at=(-21.8300, 46.9300))
add('ankole-rwanda', 'Herder with long-horned cattle', 'ankole', 'Near Nyanza, Rwanda',
    'In the land of a thousand hills, a herder walks beside cattle with the longest horns you have seen.', at=(-2.3500, 29.7400))
add('felucca-aswan', 'Boatman at Aswan', 'felucca', 'The Nile at Aswan',
    'Among the granite islands of the first cataract, a white sail turns past the old Nubian villages.', at=(24.0920, 32.8880), water='river')
add('bedouin-petra', 'Bedouin at Petra', 'bedouin', 'Petra, Jordan',
    'Out of the narrow red canyon, past the treasury carved in the rock, a Bedouin leads his camel.', at=(30.3270, 35.4440))
add('falconer-liwa', 'Falconer of the desert', 'falconer_ar', 'Liwa Oasis, Abu Dhabi',
    'On the edge of the great dunes of the Empty Quarter, a falconer in white holds a hooded falcon.', at=(23.1330, 53.7700))
add('caravan-samarkand', 'At the Registan', 'ca_merchant', 'Registan, Samarkand',
    'Before three great tiled madrasas, a merchant from the east leads his camel into the square.', at=(39.6545, 66.9750))
add('eagle-issykkul', 'Eagle hunter', 'eaglehunter', 'Near Bokonbayevo, Issyk-Kul, Kyrgyzstan',
    'By the great lake that never freezes, a rider holds a golden eagle on his arm.', at=(42.1100, 76.9900))
add('monk-angkor', 'Monk at Angkor Wat', 'monk_saffron', 'Angkor Wat, Cambodia',
    'Across the moat and causeway of the greatest temple of all, a monk in saffron walks with his bowl.', at=(13.4110, 103.8650))
add('monk-bagan', 'Monk of Bagan', 'monk_saffron', 'Bagan, Myanmar',
    'Across a plain of two thousand temples by the Irrawaddy, a monk in red-brown walks at dawn.', at=(21.1720, 94.8600), robe='russet')
add('porter-namche', 'Porter on the trail', 'porter', 'Namche Bazaar, Nepal',
    'On the trail to the highest mountain in the world, a porter climbs with a load bigger than he is.', at=(27.8060, 86.7120))
add('monk-taktsang', 'Monk at the Tiger\'s Nest', 'monk_saffron', 'Paro Taktsang, Bhutan',
    'On the path to a monastery clinging to a cliff, a monk in maroon pauses to look up.', at=(27.4900, 89.3600), robe='murrey')
add('pilgrim-varanasi', 'Pilgrim at the ghats', 'in_pilgrim', 'Dashashwamedh Ghat, Varanasi',
    'On the steps down to the Ganges in the holiest city, a pilgrim carries a pot of river water.', at=(25.3070, 83.0110))
add('sari-agra', 'By the river at Agra', 'in_sari', 'Mehtab Bagh, Agra',
    'In the garden across the Yamuna from the white tomb, a woman walks with a water jug.', at=(27.1795, 78.0420))
add('kayak-quebec', 'Voyageurs on the river', 'voyageurs', 'The Ottawa River near Mattawa',
    'On the old fur route west, paddlers in red caps sing to keep time.', at=(46.3200, -78.7000), water='river')
add('norse-lanse', 'Norse at L\'Anse aux Meadows', 'norse', 'L\'Anse aux Meadows, Newfoundland',
    'At the tip of Newfoundland, by the sod houses of the only known Norse settlement in America, a Greenlander lands.', at=(51.5960, -55.5330))
add('haida-gwaii', 'Canoe off Haida Gwaii', 'haida', 'Off Skidegate, Haida Gwaii',
    'Off the islands of the northern Pacific coast, a great red and black canoe crosses the strait.', at=(53.2400, -131.9700), water='sea')
add('rip-catskills', 'A long nap in the mountains', 'sleeper', 'The Catskill Mountains, New York',
    'A man fell asleep in these mountains and woke twenty years later with a very long beard. He is still at it.', at=(42.1300, -74.2200))
add('giant-bemidji', 'The giant logger and the blue ox', 'giantox', 'Bemidji, Minnesota',
    'On the shore of a northern lake, a giant woodsman stands beside an ox the colour of the sky.', at=(47.4720, -94.8800))
add('headless-sleepyhollow', 'The headless horseman', 'headless', 'Sleepy Hollow, New York',
    'Near the old Dutch church on the Pocantico, a rider gallops by at midnight. He has misplaced his head.', at=(41.0940, -73.8620))
add('surveyor-grandcanyon', 'Surveying the canyon', 'cartographer_world', 'South Rim, Grand Canyon',
    'On the rim of the great canyon, a surveyor tries to fit a mile of depth onto one small sheet of paper.', at=(36.0580, -112.1100))
add('wildman-olympic', 'The wild man of the woods', 'wildman', 'The Hoh Rain Forest, Washington',
    'In the mossiest forest of the Pacific north-west, something tall and hairy is hiding behind a tree.', at=(47.8600, -123.9350))
add('dutch-hartog', 'Dutch sailor with a pewter plate', 'dutchsailor', 'Cape Inscription, Dirk Hartog Island',
    'In 1616 a Dutch skipper nailed a pewter plate to a post on this wild western cape. One of his sailors has the hammer.', at=(-25.4790, 112.9780))
add('drover-outback', 'Drover in the outback', 'drover', 'Near Alice Springs, Northern Territory',
    'Under the red ranges in the middle of the continent, a drover moves sheep along a dusty stock route.', at=(-23.6900, 133.8700))
add('gaucho-pampas', 'Gaucho on the pampas', 'gaucho', 'San Antonio de Areco, Buenos Aires',
    'In the old gaucho town of the pampas, a horseman in a poncho rides out to the grass.', at=(-34.2470, -59.4700))
add('eldorado-guatavita', 'The gilded one', 'eldorado', 'Lake Guatavita, Colombia',
    'On the round lake in the hills where a new chief was covered in gold dust and offered treasure to the waters, a raft drifts.', at=(4.9775, -73.7765), water='lake')
add('canoe-manaus', 'Canoe at the meeting of the waters', 'dugout', 'Meeting of the Waters, near Manaus',
    'Where the black Rio Negro and the sandy Solimões run side by side without mixing, a fisherman paddles a dugout.', at=(-3.1360, -59.9000), water='river')
add('maya-palenque', 'Scribe at Palenque', 'maya', 'Palenque, Chiapas',
    'Below the temple of the inscriptions in the forest, a scribe carries a folded book of bark paper.', at=(17.4840, -92.0460))
add('pirates-portroyal', 'Pirates at Port Royal', 'pirates', 'Off Port Royal, Jamaica',
    'Off the sandspit town that was once the wickedest in the Caribbean, a black ship with a red sail rides at anchor.', at=(17.9300, -76.8500), water='sea')
add('outrigger-anakena', 'Canoe at Rapa Nui', 'outrigger', 'Anakena, Rapa Nui (Easter Island)',
    'Off the white beach where the first canoes landed, below the great stone heads, a fisherman paddles out.', at=(-27.0700, -109.3220), water='sea')
add('apprentice-ross', 'The Cartographer\'s apprentice', 'cartographer_apprentice', 'Ross Island, Antarctica',
    'Under a smoking volcano at the bottom of the world, the Cartographer\'s apprentice has wisely brought a sledge.', at=(-77.8450, 166.7600))
add('frostgiant-antarctica', 'The sleeping frost giant', 'frostgiant', 'The Antarctic Peninsula',
    'On the long icy arm reaching towards South America, a frost giant sleeps where nobody will disturb him.', at=(-64.8250, -62.8600))
add('explorer-penguins', 'Explorer with penguins', 'explorer_penguins', 'Cape Adare, Antarctica',
    'At the cape where the first winter hut on the continent was built, an explorer is being inspected by penguins.', at=(-71.3050, 170.2300))
