"""Archetypes for the hidden folk: each returns an art spec (sprite size in CSS px and a list of layered figures)
that js/ink-folk-art.js draws. Variation (colours, hair, headgear, props, facing, height) comes from a seeded RNG,
so every one of the figures is its own drawing but the whole set is reproducible.
All designs are original. European folk are drawn with fair skin, as in medieval manuscript illumination;
figures elsewhere have region-appropriate skin tones and dress, drawn plainly and respectfully."""
import random

EU_CLOTH = ['madder', 'ochre', 'woad', 'sage', 'undyed', 'russet', 'green', 'murrey', 'wool', 'dun', 'moss', 'woadDk', 'saffron', 'brown', 'grey']
EU_SKIN = ['fair', 'pale', 'ruddy']
EU_HAIR = ['blond', 'fair', 'brown', 'dark', 'red', 'auburn', 'grey', 'black', 'brown', 'dark']
HER = ['pale', 'fess', 'bend', 'chevron', 'cross', 'chief', 'quarterly', 'saltire', 'roundel']
TINCT = ['madder', 'woad', 'ochreLt', 'green', 'black', 'white', 'murrey', 'saffron']


def P(x, y, **kw):
    d = {'t': 'person', 'x': round(x, 2), 'y': round(y, 2)}
    d.update({k: v for k, v in kw.items() if v is not None})
    return d


def F(t, x, y, **kw):
    d = {'t': t, 'x': round(x, 2), 'y': round(y, 2)}
    d.update({k: v for k, v in kw.items() if v is not None})
    return d


class V:
    """Seeded variation helper."""
    def __init__(self, seed):
        self.r = random.Random(seed)

    def pick(self, a):
        return a[self.r.randrange(len(a))]

    def two(self, a):
        x = self.pick(a)
        y = self.pick([c for c in a if c != x])
        return x, y

    def three(self, a):
        x, y = self.two(a)
        z = self.pick([c for c in a if c not in (x, y)])
        return x, y, z

    def u(self, a, b):
        return a + (b - a) * self.r.random()

    def chance(self, p):
        return self.r.random() < p

    def dir(self):
        return self.pick([1, -1])

    def her(self):
        a, b = self.two(TINCT)
        return {'d': self.pick(HER), 'c1': a, 'c2': b}

    def eu(self, **kw):
        """A European commoner's look."""
        c1, c2, c3 = self.three(EU_CLOTH)
        d = dict(skin=self.pick(EU_SKIN), hair=self.pick(EU_HAIR), c1=c1, c2=c2, c3=c3, h=round(self.u(16.5, 18.8), 1))
        d.update(kw)
        return d


def spec(w, h, figs, **kw):
    d = {'w': w, 'h': h, 'figs': figs}
    d.update(kw)
    return d


# ------------------------------------------------------------------ European folk
def a_cartographer(v):
    return spec(22, 24, [F('ground', 11, 22, x0=-9, x1=9), P(10, 22, garb='gown', c1='woad', c3='madder', cloak=True, hat='chaperon', hatc='madder', prop='map', prop2='quill', arms=['chest', 'hold'], beard=1, hair='grey', skin='ruddy')])


def a_pilgrims(v, n=2):
    figs, x = [], 7
    for i in range(n):
        lk = v.eu()
        female = v.chance(0.45)
        figs.append(P(x, 22, pose='walk', garb='kirtle' if female else 'gown', c1=v.pick(['dun', 'brown', 'grey', 'wool', 'russet', 'sage']), c3=v.pick(['brown', 'dun', 'black', 'undyed']), cloak=v.pick([True, 'short']),
                      hat='kerchief' if female else 'pilgrim', hatc=v.pick(['black', 'brown', 'dun']), prop='pilgrim', arms=['fwd', 'back'], skin=lk['skin'], hair=lk['hair'], h=lk['h'] - (1.2 if female else 0), pack=v.pick([None, 'wool', 'dun'])))
        x += 11
    return spec(x - 2, 25, figs)


def a_monk(v, kind='walk'):
    c = v.pick(['black', 'brown', 'white', 'grey', 'black'])
    if kind == 'goose':
        return spec(30, 22, [P(9, 20, pose='run', garb='habit', c1=c, hat='cowl', hatc=c, arms=['reach', 'back'], skin=v.pick(EU_SKIN)), F('goose', 24, 20)])
    if kind == 'bell':
        return spec(18, 23, [P(8, 21, pose='walk', garb='habit', c1=c, hat='cowl', hatc=c, prop='bell', arms=['out', 'back'], skin=v.pick(EU_SKIN))])
    if kind == 'garden':
        return spec(24, 22, [F('set', 17, 20, k='bush', s=0.9), P(8, 20, pose='bend', garb='habit', c1=c, hat='tonsure', prop='hoe', arms=['low', 'low'], skin=v.pick(EU_SKIN), hair=v.pick(EU_HAIR))])
    return spec(18, 23, [P(8, 21, pose='walk', garb='habit', c1=c, hat='cowl', hatc=c, prop=v.pick(['book', 'rosary', 'lantern', 'staff']), arms=['chest', 'back'], skin=v.pick(EU_SKIN))])


def a_nun(v):
    return spec(18, 22, [P(8, 21, pose='walk', garb='habit', c1='black', hat='wimple', hatc='black', prop=v.pick(['book', 'basket', 'candle']), arms=['chest', 'back'], skin=v.pick(EU_SKIN), h=17)])


def a_shepherd(v, sheep=2):
    lk = v.eu()
    figs = [P(7, 21, garb='tunic', c1=lk['c1'], c2='brown', c3=v.pick(['sage', 'wool', 'dun', 'russet']), cloak='short', hat=v.pick(['straw', 'hood', 'felt']), hatc=lk['c3'], prop='crook', arms=['hold', 'shade'], skin=lk['skin'], hair=lk['hair'], h=lk['h'])]
    for i in range(sheep):
        figs.append(F('beast', 18 + i * 8, 21 - (i % 2) * 1.5, k='sheep', dir=v.dir()))
    return spec(14 + sheep * 8, 23, figs)


def a_lostsheep(v):
    return spec(12, 10, [F('beast', 6, 8, k='sheep', dir=v.dir())])


def a_hedgewitch(v):
    return spec(26, 24, [F('set', 18, 22, k='cauldron'), P(8, 22, garb='gown', c1=v.pick(['moss', 'sage', 'russet', 'murrey']), c3='black', cloak=True, hat='witch', hatc=v.pick(['black', 'brown', 'moss']), prop='cauldronspoon', arms=['low', 'down'], hair=v.pick(['grey', 'white', 'red']), hairLong=1, skin='pale')])


def a_pedlar(v):
    lk = v.eu()
    return spec(32, 22, [F('beast', 22, 20, k=v.pick(['donkey', 'donkey', 'mule']), panniers=v.pick(['straw', 'russet', 'wool']), led=1), P(8, 20, pose='walk', garb='tunic', c1=lk['c1'], c2=lk['c2'], hat='felt', hatc=lk['c3'], pack='wool', prop='staff', arms=['fwd', 'back'], skin=lk['skin'], hair=lk['hair'])])


def a_rower(v, captain=False):
    lk = v.eu()
    return spec(22, 16, [P(11, 12, inBoat='rowing', garb='tunic', c1='woadDk' if captain else lk['c1'], c2=lk['c2'], hat='felt' if captain else v.pick(['cap', 'hood', None]), hatc='black' if captain else lk['c3'], prop='paddle', arms=['row', 'row'], skin=lk['skin'], hair=lk['hair'], beard=1 if captain else None, pose='row')])


def a_knight(v, mounted=True, banner=True, her=None):
    her = her or v.her()
    if mounted:
        return spec(26, 28, [P(13, 26, mount='horse', mountOpt={'caparison': her, 'coat': v.pick(['grey', 'white', 'bay', 'black'])}, garb='armour', c1=her['c1'], her=her, hat=v.pick(['bascinet', 'greathelm', 'kettle', 'plume']), prop='banner' if banner else 'spear', arms=['hold', 'down'])])
    return spec(18, 24, [P(8, 22, garb='armour', c1=her['c1'], her=her, hat=v.pick(['bascinet', 'kettle', 'nasal']), prop=v.pick(['sword', 'spear', 'halberd']), prop2=None, arms=['hold', 'down'])])


def a_knightcave(v):
    her = v.her()
    return spec(36, 18, [F('set', 26, 16, k='cave'), F('creature', 25, 16, k='dragon', s=0.45, awake=1, wing=False), P(10, 16, h=14, pose='crouch', garb='armour', c1=her['c1'], her=her, hat='kettle', prop='sword', arms=['hold', 'down'])])


def a_messenger(v):
    lk = v.eu()
    return spec(26, 26, [P(13, 24, mount='horse', mountOpt={'coat': v.pick(['bay', 'chestnut', 'black', 'dun']), 'walk': 1}, garb='tunic', c1=lk['c1'], c2=lk['c2'], c3=lk['c3'], cloak='short', hat=v.pick(['cap', 'felt', 'hood']), hatc=lk['c3'], prop=v.pick(['horn', 'scroll']), arms=['up', 'down'], skin=lk['skin'], hair=lk['hair'])])


def a_rider(v):
    lk = v.eu()
    return spec(26, 26, [P(13, 24, mount='horse', mountOpt={'coat': v.pick(['bay', 'chestnut', 'grey', 'dun', 'black']), 'walk': v.pick([0, 1])}, garb=v.pick(['tunic', 'gown']), c1=lk['c1'], c2=lk['c2'], c3=lk['c3'], cloak=v.pick([True, 'short', None]), hat=v.pick(['felt', 'chaperon', 'hood', 'cap']), hatc=lk['c3'], arms=['fwd', 'down'], skin=lk['skin'], hair=lk['hair'])])


def a_highwaymen(v):
    return spec(30, 22, [P(8, 20, garb='tunic', c1='black', c2='black', c3=v.pick(['murrey', 'madderDk', 'black']), cloak=True, hat='felt', hatc='black', prop='sword', arms=['out', 'down'], skin='pale'), P(20, 20, garb='tunic', c1=v.pick(['brown', 'russet']), c2='grey', hat='hood', hatc='black', prop='lantern', arms=['fwd', 'down'], skin='ruddy')])


def a_smugglers(v):
    return spec(32, 20, [F('set', 16, 18, k='barrels'), P(6, 18, pose='bend', garb='tunic', c1=v.pick(['woadDk', 'brown', 'grey']), c2='brown', hat='cap', hatc='madder', prop='sack', arms=['low', 'low'], skin='ruddy'), P(26, 18, dir=-1, garb='tunic', c1='black', c2='woadDk', hat='hood', hatc='brown', prop='lantern', arms=['fwd', 'down'], skin='fair', beard=1)])


def a_wolves(v, n=3):
    figs = [F('beast', 6 + i * 9, 11 - (i % 2), k='wolf', walk=i % 2, dir=v.pick([1, 1, -1])) for i in range(n)]
    return spec(6 + n * 9, 13, figs)


def a_troll(v):
    return spec(30, 26, [F('set', 15, 9, k='bridgeArch', w=28), F('creature', 11, 24, k='troll', s=0.8)])


def a_trollbare(v):
    return spec(18, 22, [F('creature', 7, 20, k='troll', s=v.u(0.85, 1.0))])


def a_serpent(v):
    return spec(34, 14, [F('creature', 16, 10, k='serpent')])


def a_miller(v):
    lk = v.eu()
    return spec(22, 22, [F('set', 16, 20, k='barrels'), P(7, 20, garb='tunic', c1='undyed', c2=lk['c2'], apron='white', hat=v.pick(['coif', 'cap']), hatc='white', prop='sack', arms=['carry', 'down'], skin=lk['skin'], hair=lk['hair'])])


def a_ploughman(v):
    lk = v.eu()
    return spec(32, 20, [F('beast', 22, 18, k='ox', yoke=1, walk=1), P(8, 18, pose='walk', garb='tunic', c1=lk['c1'], c2=lk['c2'], hat='hood', hatc=lk['c3'], prop='stick', arms=['fwd', 'back'], skin=lk['skin'], hair=lk['hair'])])


def a_oxcart(v):
    lk = v.eu()
    return spec(40, 22, [F('set', 10, 20, k='cart', load=v.pick(['straw', 'wool', 'russet'])), F('beast', 24, 20, k='ox', yoke=1), P(35, 20, dir=-1, garb='tunic', c1=lk['c1'], c2=lk['c2'], hat=v.pick(['straw', 'hood']), hatc=lk['c3'], prop='stick', arms=['hold', 'down'], skin=lk['skin'], hair=lk['hair'], h=16.5)])


def a_fisher(v, bank=True):
    lk = v.eu()
    return spec(26, 18, [F('water', 16, 16, x0=-8, x1=10), P(7, 14, pose='sit', garb='tunic', c1=lk['c1'], c2=lk['c2'], hat=v.pick(['straw', 'hood', 'cap']), hatc=lk['c3'], prop='rod', lineTo=2.6, arms=['fwd', 'down'], skin=lk['skin'], hair=lk['hair'])])


def a_woodcutter(v):
    lk = v.eu()
    return spec(24, 22, [F('set', 18, 20, k='tree', s=0.95), P(7, 20, garb='tunic', c1=lk['c1'], c2=lk['c2'], hat='hood', hatc=lk['c3'], prop='axe', arms=['raise', 'down'], skin=lk['skin'], hair=lk['hair'], beard=v.pick([None, 1]))])


def a_watchman(v):
    lk = v.eu()
    return spec(16, 24, [P(7, 22, garb='tunic', c1=lk['c1'], c2=lk['c2'], c3=lk['c3'], cloak='short', hat=v.pick(['kettle', 'nasal', 'hood']), prop=v.pick(['halberd', 'spear', 'pike']), prop2='lantern', arms=['hold', 'fwd'], skin=lk['skin'], hair=lk['hair'])])


def a_archer(v):
    lk = v.eu()
    return spec(18, 22, [P(8, 20, garb='tunic', c1=v.pick(['green', 'moss', 'sage', 'russet']), c2='brown', hat=v.pick(['hood', 'felt']), hatc=v.pick(['green', 'brown']), prop='bow', arms=['bow', 'draw'], skin=lk['skin'], hair=lk['hair'])])


def a_minstrel(v):
    lk = v.eu()
    return spec(18, 22, [P(8, 20, garb='tunic', c1=lk['c1'], c2=lk['c2'], c3=lk['c3'], cloak='short', hat=v.pick(['felt', 'chaperon', 'jester']), hatc=lk['c3'], prop='lute', arms=['chest', 'chest'], skin=lk['skin'], hair=lk['hair'])])


def a_falconer(v):
    lk = v.eu()
    return spec(18, 22, [P(8, 20, garb='gown', c1=lk['c1'], c3=lk['c3'], cloak=True, hat='chaperon', hatc=lk['c3'], prop='hawk', arms=['out', 'down'], gloves='brown', skin=lk['skin'], hair=lk['hair'])])


def a_swineherd(v):
    lk = v.eu()
    return spec(32, 20, [P(6, 18, garb='tunic', c1=lk['c1'], c2=lk['c2'], hat='hood', hatc=lk['c3'], prop='stick', arms=['hold', 'down'], skin=lk['skin'], hair=lk['hair'], h=16.5), F('beast', 17, 18, k='pig'), F('beast', 27, 18, k=v.pick(['pig', 'boar']), dir=-1)])


def a_goosegirl(v):
    lk = v.eu()
    return spec(32, 20, [P(6, 19, pose='walk', garb='kirtle', c1=lk['c1'], c3=lk['c3'], apron='white', hat='kerchief', hatc='white', prop='stick', arms=['fwd', 'back'], skin=lk['skin'], hair=lk['hair'], h=16), F('goose', 16, 19), F('goose', 22, 18), F('goose', 28, 19)])


def a_milkmaid(v):
    lk = v.eu()
    return spec(28, 22, [P(8, 20, pose='walk', garb='kirtle', c1=lk['c1'], c3=lk['c3'], apron='white', hat='kerchief', hatc='white', prop='yoke', arms=['carry', 'carry'], skin=lk['skin'], hair=lk['hair'], h=16.8), F('beast', 21, 20, k='cow', dir=-1)])


def a_smith(v, dwarf=False):
    if dwarf:
        return spec(28, 20, [F('set', 18, 18, k='anvil'), F('set', 25, 18, k='hearth'), P(9, 18, h=13, broad=2, headScale=1.15, garb='tunic', c1=v.pick(['madder', 'woad', 'russet', 'green']), c2='brown', apron='brown', hat=v.pick(['phrygian', 'hood', 'cap']), hatc=v.pick(['woad', 'madder', 'ochre']), beard='long', hair=v.pick(['red', 'grey', 'brown', 'black', 'white']), prop='hammer', arms=['raise', 'hold'], skin='ruddy')])
    lk = v.eu()
    return spec(26, 22, [F('set', 18, 20, k='anvil'), P(8, 20, garb='tunic', c1=lk['c1'], c2=lk['c2'], apron='brown', hat='coif', hatc='white', prop='hammer', arms=['raise', 'hold'], skin=lk['skin'], hair=lk['hair'], beard=1, broad=1)])


def a_hermit(v):
    return spec(24, 20, [F('set', 16, 18, k='cave'), P(5, 18, garb='robe', c1=v.pick(['dun', 'grey', 'brown']), hat='cowl', hatc=v.pick(['dun', 'brown']), prop='lantern', arms=['fwd', 'down'], beard='long', hair='white', skin='pale', h=16.5)])


def a_friar(v):
    return spec(18, 23, [P(8, 21, pose='walk', garb='habit', c1=v.pick(['grey', 'brown', 'black']), hat='cowl', hatc=v.pick(['grey', 'brown']), prop='bell', arms=['out', 'back'], skin=v.pick(EU_SKIN))])


def a_merchant(v):
    lk = v.eu()
    return spec(40, 22, [F('set', 26, 20, k='cart', load='russet'), F('beast', 37, 20, k='horse', s=0.85), P(9, 20, garb='gown', c1=v.pick(['murrey', 'woadDk', 'madder', 'green']), c3=lk['c3'], cloak=True, hat='chaperon', hatc=v.pick(['black', 'madder', 'murrey']), prop='scroll', arms=['chest', 'down'], skin=lk['skin'], hair=lk['hair'], beard=v.pick([None, 1]))])


def a_stall(v):
    lk = v.eu()
    return spec(24, 22, [F('set', 14, 20, k='stall', c=v.pick(['madder', 'woad', 'ochre', 'green'])), P(5, 20, garb='kirtle', c1=lk['c1'], c3=lk['c3'], apron='white', hat='kerchief', hatc='white', prop='basket', arms=['hold', 'down'], skin=lk['skin'], hair=lk['hair'], h=16.5)])


def a_scholar(v):
    lk = v.eu()
    return spec(18, 22, [P(8, 21, pose='walk', garb='robe', c1=v.pick(['black', 'murrey', 'woadDk', 'madder']), hat=v.pick(['cap', 'chaperon']), hatc='black', prop='book', arms=['chest', 'back'], skin=lk['skin'], hair=lk['hair'])])


def a_pilgrimhorse(v):
    lk = v.eu()
    return spec(26, 26, [P(13, 24, mount=v.pick(['mule', 'pony']), garb='gown', c1=v.pick(['dun', 'brown', 'grey']), hat='pilgrim', hatc='black', prop='pilgrim', arms=['hold', 'down'], skin=lk['skin'], hair=lk['hair'])])


def a_skaters(v):
    a, b = v.eu(), v.eu()
    return spec(28, 22, [F('ground', 14, 20, x0=-13, x1=13, k='snow'), P(8, 20, pose='walk', lean=0.22, garb='tunic', c1=a['c1'], c2=a['c2'], c3=a['c3'], cloak='short', hat='hood', hatc=a['c3'], arms=['out', 'back'], skin=a['skin'], hair=a['hair']), P(20, 20, pose='walk', lean=0.18, garb='kirtle', c1=b['c1'], c3=b['c3'], cloak=True, hat='kerchief', hatc='white', arms=['back', 'out'], skin=b['skin'], hair=b['hair'], h=16.5)])


def a_sledge(v):
    lk = v.eu()
    return spec(30, 20, [F('set', 9, 18, k='sledge'), P(21, 18, pose='walk', lean=0.3, garb='tunic', c1=lk['c1'], c2=lk['c2'], c3=lk['c3'], cloak='short', hat='fur', hatc='dun', arms=['back', 'back'], skin=lk['skin'], hair=lk['hair'])])


def a_viking(v):
    return spec(34, 22, [F('boat', 16, 18, k='longship')])


def a_vikingfoot(v):
    lk = v.eu(hair=v.pick(['blond', 'fair', 'red', 'auburn']))
    return spec(18, 23, [P(8, 21, garb='tunic', c1=lk['c1'], c2=lk['c2'], c3=lk['c3'], cloak='short', hat=v.pick(['hornhelm', 'nasal', None]), prop='roundshield', her={'d': 'quarterly', 'c1': v.pick(['madder', 'woad', 'ochreLt']), 'c2': 'white'}, prop2='axe', arms=['fwd', 'hold'], skin=lk['skin'], hair=lk['hair'], beard='long')])


def a_piper(v):
    lk = v.eu()
    return spec(18, 22, [P(8, 21, garb='tunic', c1=v.pick(['madder', 'green', 'woad']), c2='brown', c3=v.pick(['moss', 'madder', 'woadDk']), cloak='short', hat='cap', hatc='woadDk', prop='bagpipe', propFront=1, arms=['chest', 'hold'], skin=lk['skin'], hair=lk['hair'], stripe='black')])


def a_alphorn(v):
    lk = v.eu()
    return spec(26, 20, [P(6, 19, garb='tunic', c1=lk['c1'], c2=lk['c2'], hat='felt', hatc='black', prop='alphorn', arms=['fwd', 'fwd'], skin=lk['skin'], hair=lk['hair'])])


def a_vintner(v):
    lk = v.eu()
    return spec(24, 21, [F('set', 17, 19, k='bush', s=0.8, c='green'), P(7, 19, garb='tunic', c1=lk['c1'], c2=lk['c2'], apron='white', hat='straw', prop='basket', arms=['hold', 'down'], skin=lk['skin'], hair=lk['hair'])])


def a_gondolier(v):
    return spec(26, 22, [P(13, 13, inBoat='gondola', garb='tunic', c1=v.pick(['black', 'woadDk']), c2='black', hat='straw', prop='pole', arms=['hold', 'hold'], pose='stand', seats=[[-4, -1.2]], skin='olive', hair='dark')])


def a_reindeerherder(v):
    return spec(30, 22, [P(7, 20, garb='tunic', c1='woad', c2='woadDk', stripe='madder', belt='madder', hat='cap', hatc='woad', prop='stick', arms=['hold', 'down'], skin='fair', hair='fair'), F('beast', 20, 20, k='reindeer', dir=-1)])


def a_cossack(v):
    return spec(26, 26, [P(13, 24, mount='horse', mountOpt={'coat': 'bay', 'walk': 1}, garb='coat', c1=v.pick(['woad', 'madder', 'green']), c2='madder', hat='fur', hatc='black', prop='sword', arms=['up', 'down'], skin='fair', hair='dark', sash='madder')])


def a_horsearcher_hu(v):
    return spec(26, 26, [P(13, 24, mount='horse', mountOpt={'coat': v.pick(['bay', 'dun', 'black']), 'walk': 1}, garb='coat', c1=v.pick(['madder', 'woad']), c2='brown', hat='fur', hatc='dun', prop='bow', arms=['bow', 'draw'], skin='fair', hair='dark')])


def a_miner(v):
    lk = v.eu()
    return spec(24, 20, [F('set', 17, 18, k='cave'), P(6, 18, garb='tunic', c1='white', c2=lk['c2'], hat='hood', hatc='white', prop='pick', arms=['raise', 'down'], skin=lk['skin'], hair=lk['hair'], apron='brown')])


def a_knockers(v):
    figs = [F('set', 16, 18, k='cave')]
    for i in range(2):
        figs.append(P(6 + i * 7, 18, h=10.5, broad=2, garb='tunic', c1=v.pick(['moss', 'russet', 'dun']), c2='brown', hat='cap', hatc=v.pick(['madder', 'moss']), skin='green', ears=1, prop=v.pick(['pick', 'lantern', 'hammer']), arms=['raise', 'down'] if i == 0 else ['fwd', 'down'], hair='black', beard=1))
    return spec(26, 20, figs)


def a_goblins(v):
    figs = []
    for i in range(3):
        figs.append(P(5 + i * 7, 18, h=10, garb='tunic', c1=v.pick(['moss', 'russet', 'dun', 'brown']), c2='brown', hat=v.pick([None, 'cap', 'hood']), hatc=v.pick(['madder', 'moss']), skin='green', ears=1, prop=v.pick(['lantern', 'stick', 'sack', 'pick']), arms=[v.pick(['fwd', 'raise', 'hold']), 'down'], hair='black', dir=v.dir()))
    return spec(26, 20, figs)


def a_orcs(v):
    figs = [F('set', 17, 22, k='fire'), F('set', 30, 22, k='tent', c='dun')]
    for i, x in enumerate([8, 22]):
        figs.append(P(x, 22, dir=1 if i == 0 else -1, broad=1, h=17, skin='green', tusks=1, garb='tunic', c1=v.pick(['brown', 'russet', 'black']), c2=v.pick(['dun', 'black']), sleeve='steelDk', hat=v.pick(['nasal', None, 'hornhelm']), hair='black', prop=v.pick(['axe', 'spear', 'sword']), arms=['hold', 'down'], lean=0.12))
    return spec(36, 24, figs)


def a_wight(v):
    return spec(26, 22, [F('set', 13, 20, k='barrow'), P(13, 19, h=13, garb='robe', c1='ghost', c3='grey', skin='ghost', hat='crown', prop='sword', arms=['hold', 'down'], hair='white', beard='long')])


def a_wodewose(v):
    return spec(22, 24, [F('set', 16, 22, k='tree', s=1.1, c='moss'), P(7, 22, garb='bare', skin='russet', hair='brown', hairLong=1, beard='long', prop='stick', arms=['hold', 'down'], hose='russet', c1='russet', sleeve='russet', belt=False, furry=1)])


def a_herne(v):
    return spec(24, 28, [P(12, 26, mount='horse', mountOpt={'coat': 'black'}, garb='robe', c1='moss', c3='black', cloak=True, hat=None, hair='dark', prop='horn', arms=['up', 'down'], skin='pale', antlers=1), F('beast', 3, 26, k='hound', s=0.8)])


def a_wayland(v):
    return spec(28, 22, [F('set', 18, 20, k='anvil'), F('set', 25, 20, k='hearth'), P(8, 20, broad=1, garb='tunic', c1='russet', c2='brown', apron='brown', hat=None, hair='red', beard='long', prop='hammer', arms=['raise', 'hold'], skin='ruddy', h=19)])


def a_giant(v):
    return spec(26, 40, [P(13, 38, h=36, pose='walk', garb='tunic', c1=v.pick(['russet', 'sage', 'dun']), c2='brown', c3='moss', cloak='short', hair='brown', beard='long', prop='staff', arms=['fwd', 'back'], skin='ruddy')])


def a_dragonhoard(v):
    return spec(34, 18, [F('creature', 17, 16, k='dragon', hoard=1)])


def a_wyvern(v):
    return spec(26, 18, [F('creature', 13, 16, k='wyvern')])


def a_kraken(v):
    return spec(30, 16, [F('creature', 15, 12, k='kraken')])


def a_griffin(v):
    return spec(24, 20, [F('set', 12, 18, k='rock', s=1.4), F('creature', 11, 12, k='griffin')])


def a_unicorn(v):
    return spec(22, 18, [F('beast', 10, 16, k='unicorn')])


def a_mermaid(v):
    return spec(20, 16, [F('creature', 8, 13, k='mermaid')])


def a_wisp(v):
    return spec(16, 14, [F('creature', 8, 12, k='wisp')])


def a_fairyring(v):
    return spec(20, 14, [F('set', 10, 10, k='mushrooms'), F('creature', 7, 6, k='fairy', c='green'), F('creature', 13, 5, k='fairy', c='madder')])


def a_basilisk(v):
    return spec(22, 12, [F('creature', 10, 10, k='basilisk')])


def a_cockatrice(v):
    return spec(18, 14, [F('creature', 10, 12, k='cockatrice')])


def a_blackdog(v):
    return spec(16, 12, [F('beast', 8, 10, k='blackdog')])


def a_babahut(v):
    return spec(16, 20, [F('set', 8, 18, k='chickenhut')])


def a_tatzelwurm(v):
    return spec(18, 10, [F('creature', 8, 8, k='tatzelwurm')])


def a_stonetrolls(v):
    return spec(26, 18, [F('set', 7, 14, k='stack', face=1), F('set', 18, 14, k='stack', face=1)])


def a_selkie(v):
    return spec(16, 12, [F('set', 8, 10, k='rock', s=1.0), P(7, 8, pose='sit', garb='robe', c1='grey', skin='pale', hair='dark', hairLong=1, arms=['down', 'down'], h=14)])


def a_kelpie(v):
    return spec(22, 18, [F('water', 11, 16, x0=-10, x1=10), F('beast', 11, 15, k='horse', coat='grey', manec='#5E7F66', tailc='#5E7F66')])


def a_banshee(v):
    return spec(16, 22, [P(8, 21, garb='robe', c1='ghost', c3='grey', cloak=True, skin='ghost', hair='white', hairLong=1, arms=['raise', 'raise'], h=18)])


def a_brownie(v):
    return spec(16, 14, [P(7, 13, h=10, garb='tunic', c1='brown', c2='brown', hat='hood', hatc='brown', prop='broom', arms=['hold', 'down'], skin='ruddy', hair='brown', beard=1)])


def a_leprechaun(v):
    return spec(18, 14, [F('set', 13, 12, k='pots'), P(5, 12, h=10, garb='tunic', c1='green', c2='green', hat='felt', hatc='green', prop='hammer', arms=['raise', 'down'], skin='ruddy', hair='red', beard=1)])


def a_greenman(v):
    return spec(18, 22, [F('set', 9, 20, k='tree', s=1.2, c='leaf'), P(8, 20, h=15, garb='bare', skin='green', hair='green', c1='leaf', hose='leaf', sleeve='leaf', hat='wreath', arms=['down', 'down'])])


def a_ghostknight(v):
    return spec(18, 24, [P(8, 22, garb='armour', c1='ghost', her={'d': 'cross', 'c1': 'ghost', 'c2': 'grey'}, hat='greathelm', prop='sword', arms=['hold', 'down'])], ghost=1)


def a_pipedpiper(v):
    figs = [P(6, 20, pose='walk', garb='tunic', c1='madder', c2='ochre', sleeve='ochre', c3='ochre', hat='felt', hatc='madder', prop='horn', arms=['chest', 'chest'], skin='fair', hair='red')]
    for i in range(3):
        figs.append(F('beast', 16 + i * 5, 20, k='rat', coat=v.pick(['grey', 'brown', 'dun'])))
    return spec(30, 22, figs)


def a_musicians(v):   # donkey, dog, cat and cockerel stacked: the musicians of a certain northern German town
    return spec(18, 28, [F('beast', 9, 26, k='donkey'), F('beast', 9, 19.5, k='dog', s=0.9), F('beast', 9, 15.5, k='cat', s=0.9), F('hen', 9, 12.5)])


def a_wawel(v):
    return spec(30, 18, [F('set', 6, 16, k='cave'), F('creature', 20, 16, k='dragon', s=0.6, awake=1)])


def a_firebird(v):
    return spec(20, 16, [F('bird', 12, 14, fire=1, s=1.3)])


def a_halflings_picnic(v):
    figs = [F('set', 15, 20, k='picnic')]
    for i, (x, pose) in enumerate([(5, 'sit'), (14, 'sit'), (24, 'stand')]):
        figs.append(P(x, 20, h=11.5, pose=pose, dir=1 if i < 2 else -1, garb='tunic' if i != 1 else 'kirtle', c1=v.pick(['green', 'ochre', 'madder', 'woad', 'russet']), c2=v.pick(['ochre', 'brown', 'dun']), hat=v.pick([None, 'straw', None]), hair=v.pick(['auburn', 'brown', 'red', 'blond']), skin='ruddy', bare=1, arms=['fwd', 'down'], prop='cup' if i == 2 else None))
    return spec(30, 22, figs)


def a_halfling_cheese(v):
    return spec(22, 16, [F('set', 17, 13, k='wheelcheese'), P(7, 14, h=11, pose='run', garb='tunic', c1='madder', c2='ochre', hair='auburn', skin='ruddy', bare=1, arms=['reach', 'back'])])


def a_halfling_fisher(v):
    return spec(28, 20, [F('set', 14, 10, k='bridgeArch', w=26), P(10, 6, h=11, pose='sitbank', garb='tunic', c1='green', c2='ochre', hat='straw', hair='brown', skin='ruddy', bare=1, prop='rod', lineTo=12, arms=['fwd', 'down']), F('bird', 22, 18, c='grey', s=0.9)])


def a_halfling_sleep(v):
    return spec(26, 20, [F('set', 6, 18, k='tree', fruit=1), P(17, 18, pose='lie', h=12, c1=v.pick(['green', 'ochre', 'madder']), c2='ochre', hair='auburn', hat='straw')])


def a_slough(v):
    return spec(96, 74, [F('creature', 48, 40, k='dragonRing', r=26), P(84, 70, h=8, garb='armour', c1='woad', her={'d': 'cross', 'c1': 'woad', 'c2': 'white'}, hat='kettle', prop='spear', arms=['hold', 'down'], dir=-1, pose='walk')])


# ------------------------------------------------------------------ the wider world (region-appropriate dress, drawn respectfully)
def a_samurai(v):
    return spec(20, 24, [P(9, 22, pose='walk', garb='kimono', skin='golden', c1=v.pick(['indigo', 'black', 'woadDk', 'murrey']), c2='black', hat=v.pick(['kabuto', 'topknot', 'jingasa']), hair='black', prop='katana', arms=['hold', 'back'], belt=v.pick(['madder', 'white', 'saffron']))])


def a_ninja(v):
    return spec(16, 14, [P(7, 13, pose='crouch', garb='tunic', c1='black', c2='black', sleeve='black', hat='hood_ninja', hatc='black', skin='golden', arms=['fwd', 'down'], h=15)])


def a_jp_pilgrim(v):
    return spec(18, 24, [P(8, 22, pose='walk', garb='robe', skin='golden', c1='white', hat='kasa', hatc='straw', prop='staff', arms=['fwd', 'back'], hair='black')])


def a_jp_farmer(v):
    return spec(26, 20, [P(7, 19, pose='bend', garb='tunic', skin='golden', c1=v.pick(['indigo', 'woad', 'brown']), c2='indigo', hat='kasa', prop='hoe', arms=['low', 'low'], hair='black'), F('set', 19, 19, k='reeds')])


def a_cn_scholar(v):
    return spec(28, 22, [F('set', 14, 12, k='bridgeArch', w=26), P(12, 8.2, h=13, garb='robe', skin='golden', c1=v.pick(['jade', 'woad', 'murrey', 'indigo']), hat='futou', hatc='black', prop=v.pick(['scroll', 'fan', 'book']), arms=['chest', 'down'], hair='black', beard=v.pick([None, 'long']))])


def a_cn_farmer(v):
    return spec(26, 22, [P(8, 20, pose='walk', garb='tunic', skin='golden', c1=v.pick(['indigo', 'woad', 'dun', 'brown']), c2='indigo', hat='conical', hatc='straw', prop='yoke', arms=['carry', 'carry'], hair='black')])


def a_kr_scholar(v):
    return spec(18, 24, [P(8, 22, pose='walk', garb='robe', skin='golden', c1='white', hat='jingasa', hatc='black', prop='fan', arms=['chest', 'back'], hair='black', beard=1)])


def a_mongol(v):
    return spec(26, 26, [P(13, 24, mount='pony', mountOpt={'coat': v.pick(['dun', 'bay', 'grey', 'black']), 'walk': 1}, garb='deel', skin='golden', c1=v.pick(['madder', 'woad', 'ochre', 'jade']), c2='brown', hat='mongol', hatc=v.pick(['madder', 'woad']), prop='bow', arms=['bow', 'draw'], belt=v.pick(['saffron', 'ochre']), hair='black')])


def a_ca_merchant(v):
    return spec(32, 28, [F('beast', 21, 26, k='bactrian', load=v.pick(['madder', 'wool', 'russet']), led=1), P(7, 26, pose='walk', garb='kaftan', skin='tan', c1=v.pick(['madder', 'woad', 'jade', 'ochre']), c3='indigo', hat=v.pick(['turban', 'fur']), hatc=v.pick(['white', 'dun']), prop='staff', arms=['fwd', 'back'], hair='black', beard=1, stripe='ochre')])


def a_caravan(v, ppl='tan', hat='turban', c1=None, two=True):
    figs = [F('beast', 18, 27, k='camel', load=v.pick(['madder', 'wool', 'russet', 'ochre']), led=1), P(5, 27, pose='walk', garb='robe', skin=ppl, c1=c1 or v.pick(['white', 'woad', 'madder', 'dun']), hat=hat, hatc=v.pick(['white', 'indigo', 'madder']), prop='staff', arms=['fwd', 'back'], hair='black', beard=1)]
    if two:
        figs.append(F('beast', 32, 27, k='camel', load='wool'))
    return spec(42 if two else 28, 29, figs)


def a_tuareg(v):
    return spec(40, 30, [P(13, 28, mount='camel', saddle='madder', garb='robe', skin='brown', c1='indigo', hat='tagelmust', hatc='indigo', prop='stick', arms=['fwd', 'down']), F('beast', 30, 28, k='camel', load='madder', b={'c': 'camel'})])


def a_bedouin(v):
    return spec(30, 28, [P(6, 26, garb='thobe', skin='tan', c1='white', hat='keffiyeh', hatc=v.pick(['white', 'madder']), prop='staff', arms=['hold', 'down'], hair='black', beard=1), F('beast', 20, 26, k='camel', dir=-1)])


def a_felucca(v):
    return spec(22, 22, [P(11, 19, inBoat='felucca', garb='robe', skin=v.pick(['tan', 'medium', 'olive']), c1=v.pick(['woad', 'white', 'dun']), hat='headwrap', hatc='white', prop='paddle', pose='boat', seats=[[3.6, -1.2]], arms=['row', 'row'], hair='black')])


def a_dhow(v):
    return spec(26, 22, [P(13, 19, inBoat='dhow', garb='robe', skin=v.pick(['brown', 'medium', 'deep']), c1='white', hat='cap', hatc='white', arms=['fwd', 'down'], pose='boat', seats=[[4, -1.8]], hair='black')])


def a_elephant(v):
    return spec(28, 28, [P(13, 27, mount='elephant', mountOpt={'howdah': 1}, garb='robe', skin='medium', c1='white', hat='headwrap', hatc=v.pick(['saffron', 'madder', 'vermilion']), prop='stick', arms=['fwd', 'down'], hair='black', beard=1)])


def a_in_pilgrim(v):
    return spec(18, 22, [P(8, 21, pose='walk', garb='robe', skin=v.pick(['medium', 'brown', 'tan']), c1=v.pick(['saffron', 'white', 'vermilion']), hat=v.pick(['headwrap', None]), hatc='white', prop='jug', arms=['hold', 'back'], hair='black', beard=v.pick([None, 1]))])


def a_in_sari(v):
    return spec(18, 22, [P(8, 21, pose='walk', garb='sari', skin=v.pick(['medium', 'brown', 'tan']), c1=v.pick(['vermilion', 'saffron', 'jade', 'murrey', 'woad']), c3=v.pick(['saffron', 'madder', 'gold']), hair='black', hairLong=1, prop='jug', arms=['carry', 'back'], h=16.5)])


def a_porter(v):
    return spec(18, 22, [P(8, 21, pose='walk', lean=0.2, garb='tunic', skin=v.pick(['tan', 'medium']), c1=v.pick(['dun', 'madder', 'woad']), c2='brown', hat='cap', hatc=v.pick(['madder', 'woad', 'ochre']), pack='russet', prop='stick', arms=['fwd', 'back'], hair='black')])


def a_monk_saffron(v, robe='saffron'):
    return spec(18, 22, [P(8, 21, pose='walk', garb='robe', skin=v.pick(['tan', 'medium', 'golden']), c1=robe, hat=None, hair=None, prop='jug', arms=['chest', 'down'], bald=1)])


def a_sampan(v):
    return spec(24, 16, [P(14, 12, inBoat='sampan', garb='tunic', skin='golden', c1=v.pick(['indigo', 'dun', 'brown']), c2='indigo', hat='conical', prop='pole', pose='stand', seats=[[-4, -1.8]], arms=['hold', 'hold'], hair='black', h=14)])


def a_rice(v, ppl='golden', buffalo=True):
    figs = [P(7, 19, pose='bend', garb='tunic', skin=ppl, c1=v.pick(['indigo', 'dun', 'brown', 'woad']), c2='indigo', hat='conical', hatc='straw', arms=['low', 'low'], hair='black'), F('set', 13, 19, k='reeds')]
    if buffalo:
        figs.append(F('beast', 24, 19, k='ox', coat='slate', b={'horns': 'long'}))
    return spec(32 if buffalo else 20, 21, figs)


def a_outrigger(v, ppl='medium'):
    return spec(24, 16, [P(12, 12, inBoat='canoe', garb='loin', skin=ppl, c1=v.pick(['madder', 'ochre', 'white']), prop='paddle', arms=['row', 'row'], hair='black', seats=[[0, -1.2]]), F('ground', 12, 13.6, k='none')])


def a_waka(v):
    return spec(30, 14, [P(15, 10, inBoat='waka', garb='loin', skin='medium', c1='brown', prop='paddle', arms=['row', 'row'], seats=[[-6, -1.6], [0, -1.6], [6, -1.6]], hair='black')])


def a_kayak(v):
    return spec(26, 16, [P(13, 12, inBoat='kayak', garb='tunic', skin='copper', c1='dun', hat='fur', hatc='dun', prop='paddle', arms=['row', 'row'], hair='black')])


def a_voyageurs(v):
    return spec(28, 16, [P(14, 12, inBoat='canoe', boatOpt={'c': 'ochreLt'}, garb='tunic', skin='fair', c1=v.pick(['woad', 'white', 'madder']), hat='phrygian', hatc='madder', prop='paddle', arms=['row', 'row'], seats=[[-4, -1.2], [3, -1.2]], hair='dark', sash='madder')])


def a_aztec(v):
    return spec(18, 22, [P(8, 21, pose='run', garb='loin', skin='copper', c1='white', c3='white', cloak='short', hair='black', prop='scroll', arms=['fwd', 'back'], belt='madder', bare=1)])


def a_maya(v):
    return spec(18, 22, [P(8, 21, garb='robe', skin='copper', c1='white', stripe='madder', hat='headwrap', hatc='jade', prop='book', arms=['chest', 'down'], hair='black')])


def a_chasqui(v):
    return spec(18, 22, [P(8, 21, pose='run', garb='tunic', skin='copper', c1=v.pick(['madder', 'ochre']), c2='copper', hose='copper', hat='feather', hatc='white', prop='horn', arms=['up', 'back'], hair='black', bare=1)])


def a_llamaherder(v):
    return spec(26, 22, [F('beast', 18, 20, k='llama', load=v.pick(['madder', 'ochre', 'woad'])), P(7, 20, pose='walk', garb='poncho', skin='copper', c1=v.pick(['madder', 'woad', 'ochre']), c2='brown', c3=v.pick(['madder', 'vermilion', 'woad']), hat='chullo', hatc=v.pick(['ochre', 'madder', 'white']), prop='stick', arms=['fwd', 'back'], hair='black')])


def a_reedboat(v):
    return spec(24, 18, [P(12, 14, inBoat='reed', garb='poncho', skin='copper', c1='madder', c3='madder', hat='chullo', hatc='ochre', prop='pole', pose='stand', seats=[[-2, -1.6]], arms=['hold', 'hold'], hair='black', h=14)])


def a_gaucho(v):
    return spec(26, 26, [P(13, 24, mount='horse', mountOpt={'coat': v.pick(['bay', 'chestnut', 'dun', 'black'])}, garb='poncho', skin='olive', c1='white', c2='black', c3=v.pick(['madder', 'woad', 'russet']), hat='felt', hatc='black', arms=['fwd', 'down'], hair='black')])


def a_dugout(v, ppl='brown'):
    return spec(24, 16, [P(12, 12, inBoat='canoe', boatOpt={'c': 'russet'}, garb='tunic', skin=ppl, c1=v.pick(['white', 'madder', 'ochre', 'woad']), prop='paddle', arms=['row', 'row'], seats=[[1, -1.2]], hair='black')])


def a_eldorado(v):
    return spec(26, 22, [P(13, 18, inBoat='reed', garb='bare', skin='#D9B54A', c1='gold', hose='#D9B54A', sleeve='#D9B54A', hat='feather', hatc='gold', pose='stand', seats=[[0, -1.6]], arms=['raise', 'raise'], hair='black', h=14)])


def a_griot(v):
    return spec(18, 22, [P(8, 21, garb='robe', skin=v.pick(['deep', 'ebony', 'brown']), c1=v.pick(['indigo', 'white', 'saffron', 'woad']), hat='cap', hatc=v.pick(['white', 'madder', 'indigo']), prop='lute', arms=['chest', 'chest'], hair='black')])


def a_marketwoman(v):
    return spec(26, 22, [F('set', 18, 20, k='pots'), P(8, 21, garb='sari', skin=v.pick(['deep', 'ebony', 'brown']), c1=v.pick(['vermilion', 'saffron', 'indigo', 'jade', 'madder']), c3=v.pick(['ochre', 'saffron', 'woad']), hat='headwrap', hatc=v.pick(['saffron', 'madder', 'indigo']), prop='basket', arms=['hold', 'down'], hair='black', h=16.5)])


def a_sahel_horseman(v):
    return spec(26, 28, [P(13, 26, mount='horse', mountOpt={'caparison': {'d': v.pick(['fess', 'pale', 'chevron']), 'c1': v.pick(['madder', 'indigo', 'saffron']), 'c2': v.pick(['white', 'ochreLt'])}, 'coat': v.pick(['white', 'grey', 'bay'])}, garb='robe', skin=v.pick(['deep', 'brown', 'ebony']), c1=v.pick(['white', 'indigo']), hat='turban', hatc=v.pick(['white', 'indigo']), prop='spear', arms=['hold', 'down'], hair='black')])


def a_maasai(v):
    return spec(28, 22, [P(6, 21, garb='robe', skin='deep', c1='madder', stripe='woad', hair='black', prop='staff', arms=['hold', 'down'], h=19), F('beast', 19, 21, k='zebu', dir=-1)])


def a_et_pilgrim(v):
    return spec(18, 24, [P(8, 22, garb='robe', skin=v.pick(['brown', 'medium']), c1='white', c3='white', cloak=True, hat=v.pick([None, 'headwrap']), hatc='white', prop='cross', arms=['hold', 'down'], hair='black', beard=v.pick([None, 1]))])


def a_zulu(v, n=2):
    figs = []
    for i in range(n):
        figs.append(P(8 + i * 11, 22, garb='loin', skin=v.pick(['deep', 'ebony']), c1=v.pick(['brown', 'russet', 'black']), hose=None, hat='feather', hatc='white', prop='shieldhide', prop2='spear', arms=['fwd', 'down'], belt='white', hair='black', bands='white'))
    return spec(8 + n * 11, 24, figs)


def a_nguni(v):
    return spec(30, 22, [F('beast', 18, 20, k='nguni'), P(5, 20, garb='loin', skin=v.pick(['deep', 'ebony']), c1='russet', hair='black', prop='staff', arms=['hold', 'down'], bands='white')])


def a_basotho(v):
    return spec(26, 26, [P(13, 24, mount='pony', mountOpt={'coat': v.pick(['bay', 'grey', 'dun'])}, garb='poncho', skin='deep', c1='brown', c2='brown', c3=v.pick(['madder', 'woad', 'ochre']), hat='conical', hatc='straw', arms=['fwd', 'down'], hair='black')])


def a_zebuherder(v, ppl='brown'):
    return spec(30, 22, [P(6, 21, garb='tunic', skin=ppl, c1=v.pick(['white', 'ochre', 'madder']), c2=ppl, hose=ppl, hat=v.pick(['straw', None]), prop='staff', arms=['hold', 'down'], hair='black'), F('beast', 20, 21, k='zebu', dir=-1)])


def a_norse(v):
    return a_vikingfoot(v)


def a_dutchsailor(v):
    return spec(22, 22, [F('set', 16, 20, k='sign', c='steel'), P(7, 20, garb='tunic', skin='fair', c1=v.pick(['woadDk', 'black']), c2='grey', hat='felt', hatc='black', prop='hammer', arms=['raise', 'down'], hair='fair', beard=1)])


def a_drover(v):
    return spec(30, 26, [P(9, 24, mount='horse', mountOpt={'coat': v.pick(['bay', 'chestnut'])}, garb='tunic', skin='fair', c1=v.pick(['dun', 'woad', 'white']), c2='brown', hat='felt', hatc='dun', arms=['fwd', 'down'], hair='brown'), F('beast', 22, 24, k='sheep'), F('beast', 27, 23, k='sheep', dir=-1)])


def a_pirates(v):
    return spec(26, 24, [F('boat', 12, 20, k='cog', c='black'), F('text', 0, 0, s='')])


def a_cartographer_apprentice(v):
    return spec(30, 20, [F('ground', 15, 18, x0=-14, x1=14, k='snow'), F('set', 22, 18, k='sledge'), P(9, 18, garb='gown', c1='woad', c3='madder', cloak=True, hat='fur', hatc='white', prop='map', arms=['fwd', 'down'], skin='ruddy', hair='red')])


def a_frostgiant(v):
    return spec(30, 16, [F('ground', 15, 14, x0=-14, x1=14, k='snow'), P(17, 14, pose='lie', h=20, c1='ice', c2='woad', hair='white', zzz=True)])


def a_explorer_penguins(v):
    return spec(26, 22, [P(7, 20, garb='gown', c1='madder', c3='dun', cloak=True, hat='fur', hatc='white', prop='staff', arms=['hold', 'shade'], skin='ruddy', hair='blond', beard=1), F('bird', 18, 20, penguin=1, s=1.1), F('bird', 23, 20, penguin=1, s=1.0, dir=-1), F('bird', 21, 20.5, penguin=1, s=0.8)])


def a_haida(v):
    return spec(30, 16, [P(15, 12, inBoat='waka', boatOpt={'c': 'russet', 's': 0.9}, garb='robe', skin='copper', c1='madder', c3='black', prop='paddle', arms=['row', 'row'], seats=[[-4, -1.6], [4, -1.6]], hair='black')])


def a_wildman(v):
    return spec(20, 26, [F('set', 15, 24, k='tree', s=1.2, c='green'), P(7, 24, h=22, garb='bare', skin='brown', hair='brown', hairLong=1, beard='long', c1='brown', hose='brown', sleeve='brown', arms=['hold', 'down'], belt=False, furry=1)])


def a_cartographer_world(v, ppl='fair'):
    """A travelling surveyor with a measuring rod: a neutral, original figure for places with no fitting folk story."""
    lk = v.eu()
    return spec(18, 24, [P(8, 22, garb='gown', c1=v.pick(['woad', 'madder', 'green', 'murrey']), c3=lk['c3'], cloak=True, hat=v.pick(['chaperon', 'felt']), hatc=lk['c3'], prop='map', prop2='staff', arms=['chest', 'hold'], skin=lk['skin'], hair=lk['hair'])])




# ------------------------------------------------------------------ extra set pieces used by the hand-placed list
def a_rower_captain(v):
    return a_rower(v, captain=True)


def a_stgeorge(v):
    her = {'d': 'cross', 'c1': 'white', 'c2': 'madder'}
    return spec(40, 28, [P(12, 26, mount='horse', mountOpt={'caparison': her, 'coat': 'white', 'walk': 1}, garb='armour', c1='white', her=her, hat='greathelm', prop='spear', arms=['fwd', 'down']), F('creature', 30, 26, k='dragon', s=0.5, awake=1, dir=-1)])


def a_hound_alone(v):
    return spec(14, 10, [F('beast', 7, 8, k='hound', dir=-1)])


def a_lakelady(v):
    return spec(22, 22, [F('water', 15, 21, x0=-7, x1=7), P(7, 21, garb='gown', c1='white', c3='woad', cloak=True, hat='crown', skin='pale', hair='blond', hairLong=1, arms=['out', 'down'], h=17.5)])


def a_friar_wolf(v):
    return spec(28, 23, [P(8, 21, garb='habit', c1='grey', hat='cowl', hatc='grey', prop='rosary', arms=['out', 'down'], skin='fair'), F('beast', 21, 21, k='wolf', dir=-1)])


def a_quixote(v):
    return spec(42, 28, [P(11, 26, mount='horse', mountOpt={'coat': 'dun', 'b': {'L': 9.6, 'Hb': 3.6}}, garb='armour', c1='dun', her={'d': 'pale', 'c1': 'dun', 'c2': 'white'}, hat='kettle', prop='spear', arms=['fwd', 'down'], beard='long', hair='grey'), P(31, 26, mount='donkey', garb='tunic', c1='russet', c2='brown', hat='straw', arms=['fwd', 'down'], broad=1, h=16, skin='ruddy', hair='dark', beard=1)])


def a_cogship(v):
    return spec(26, 24, [F('boat', 12, 20, k='cog', c='brown')])


def a_jester(v):
    return spec(18, 22, [P(8, 21, pose='walk', garb='tunic', c1='madder', c2='ochre', sleeve='ochre', hose='madder', hat='jester', hatc='ochre', prop='bell', arms=['wave', 'out'], skin='fair', hair='brown')])


def a_watchman_cn(v):
    return spec(16, 24, [P(7, 22, garb='coat', skin='golden', c1=v.pick(['madder', 'woadDk', 'black']), c2='black', hat='kettle', prop='halberd', arms=['hold', 'down'], hair='black')])


def a_dugout_mx(v):
    return spec(24, 16, [P(12, 12, inBoat='canoe', boatOpt={'c': 'russet'}, garb='tunic', skin='copper', c1='white', prop='paddle', arms=['row', 'row'], seats=[[1, -1.2]], hair='black'), F('creature', 18, 9.5, k='fairy', c='madder')])


def a_falconer_ar(v):
    return spec(18, 22, [P(8, 21, garb='thobe', skin='tan', c1='white', hat='keffiyeh', hatc='white', prop='hawk', arms=['out', 'down'], gloves='brown', hair='black', beard=1)])


def a_scholar_tk(v):
    return spec(18, 22, [P(8, 21, pose='walk', garb='robe', skin=v.pick(['deep', 'brown', 'ebony']), c1=v.pick(['indigo', 'white', 'woad']), hat='turban', hatc=v.pick(['white', 'indigo']), prop='book', arms=['chest', 'back'], hair='black', beard=1)])


def a_eaglehunter(v):
    return spec(26, 28, [P(13, 26, mount='pony', mountOpt={'coat': v.pick(['bay', 'dun', 'grey'])}, garb='deel', skin='golden', c1=v.pick(['woad', 'madder', 'jade']), c2='brown', hat='fur', hatc='russet', prop='hawk', arms=['out', 'down'], gloves='brown', hair='black')])


def a_ankole(v):
    return spec(30, 22, [P(5, 21, garb='robe', skin='deep', c1=v.pick(['white', 'ochre', 'madder']), hair='black', prop='staff', arms=['hold', 'down']), F('beast', 19, 21, k='nguni', dir=-1, b={'c': 'russet', 'horns': 'long'}, coat='russet')])


def a_sleeper(v):
    return spec(28, 20, [F('set', 6, 18, k='tree', s=1.0), P(18, 18, pose='lie', h=16, c1='woadDk', c2='brown', c3='russet', cloak=True, hair='grey')])


def a_giantox(v):
    return spec(40, 40, [P(10, 38, h=34, garb='tunic', c1='madder', c2='woadDk', hat='cap', hatc='black', hair='black', beard='long', prop='axe', arms=['hold', 'down'], skin='ruddy'), F('beast', 28, 38, k='ox', coat='#7FA9CF', s=1.4)])


def a_headless(v):
    return spec(26, 26, [P(13, 24, mount='horse', mountOpt={'coat': 'black', 'walk': 1}, garb='coat', c1='black', c2='black', c3='black', cloak=True, wind=2.4, arms=['up', 'down'], prop='torch', headless=1)])


ARCH = {k[2:]: f for k, f in globals().items() if k.startswith('a_') and callable(f)}
