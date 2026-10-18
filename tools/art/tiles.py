"""Terrain tileset. Dual-grid autotiling: every layer has 16 corner-mask tiles (TL=1,TR=2,BL=4,BR=8).
Layer order (bottom->top): bed, mud, sand, dry, grass."""
from pix import parse, blank, paste, outline, hex2rgba, PAL
from PIL import Image
import math

T = 16
LAYERS = ['bed', 'mud', 'sand', 'dry', 'grass']


def h2(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def vnoise(x, y, period, seed, cell=4):
    """Tileable value noise with given period (pixels)."""
    gx, gy = x / cell, y / cell
    x0, y0 = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - x0, gy - y0
    p = period // cell

    def g(i, j):
        return h2(i % p, j % p, seed)
    sx = fx * fx * (3 - 2 * fx)
    sy = fy * fy * (3 - 2 * fy)
    a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx
    b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx
    return a + (b - a) * sy


def tex(layer, x, y, var):
    """Return palette key for a texture pixel (seamless over 16px)."""
    n = vnoise(x, y, 16, 11 + var * 7 + LAYERS.index(layer) * 31, 4)
    r = h2(x, y, 97 + var * 13 + LAYERS.index(layer))
    if layer == 'bed':
        # wet, dark creek floor with faint ripple lines
        ripple = (y + int(2 * math.sin((x + var * 5) / 16 * 2 * math.pi))) % 6 == 0
        if ripple:
            return 'D'
        return 'd' if n > 0.62 else ('D' if n < 0.25 else 'd') if r > 0.5 else ('D' if n < 0.45 else 'd')
    if layer == 'mud':
        n2 = vnoise(x * 0.5, y * 2, 16, 41 + var, 4)
        if r > 0.988:
            return 'X'  # crab hole
        if n2 > 0.78 and n > 0.4:
            return 'd'  # glossy streak
        if n < 0.16:
            return 'X'
        return 'x'
    if layer == 'sand':
        rip = (y + int(1.6 * math.sin((x + var * 3) / 16 * 2 * math.pi * 2))) % 5 == 0
        if rip:
            return 'u'
        if r > 0.97:
            return 'U'
        if n > 0.7:
            return 'y'
        return 'Y'
    if layer == 'dry':
        if r > 0.975:
            return 'u'
        if r < 0.02:
            return 'Y'
        return 'y' if n > 0.35 else 'Y' if n < 0.12 else 'y'
    if layer == 'grass':
        if r > 0.93:
            return 'v'
        if r < 0.05:
            return 'z'
        return 'V' if n > 0.3 else 'z'
    return 'o'


RIM = {  # (rim key, lip key south-facing)
    'mud': ('X', 'X'),
    'sand': ('u', 'U'),
    'dry': ('Y', 'u'),
    'grass': ('Z', 'D'),
}


def field(mask, x, y):
    tl = 1.0 if mask & 1 else 0.0
    tr = 1.0 if mask & 2 else 0.0
    bl = 1.0 if mask & 4 else 0.0
    br = 1.0 if mask & 8 else 0.0
    u, v = (x + 0.5) / T, (y + 0.5) / T
    f = tl * (1 - u) * (1 - v) + tr * u * (1 - v) + bl * (1 - u) * v + br * u * v
    if 0 <= x < T and 0 <= y < T:
        w = math.sin(math.pi * (x + 0.5) / T) * math.sin(math.pi * (y + 0.5) / T)
        f += (vnoise(x, y, 16, 5 + mask, 4) - 0.5) * 0.28 * w
    return f


def make_tile(layer, mask, var=0):
    img = blank(T, T)
    px = img.load()
    rim, lip = RIM.get(layer, ('o', 'o'))
    for y in range(T):
        for x in range(T):
            if mask != 15 and field(mask, x, y) <= 0.5:
                continue
            key = tex(layer, x, y, var)
            if mask != 15:
                inside = lambda xx, yy: field(mask, xx, yy) > 0.5
                if not (inside(x - 1, y) and inside(x + 1, y) and inside(x, y - 1)):
                    key = rim
                if not inside(x, y + 1):
                    key = lip if layer != 'grass' else 'Z'
                elif layer == 'grass' and (not inside(x, y + 2) or not inside(x, y + 3)):
                    key = 'U' if not inside(x, y + 2) else 'u'
                elif layer == 'sand' and not inside(x, y + 2):
                    key = 'u'
            px[x, y] = hex2rgba(PAL[key])
    return img


def tile_frames():
    out = {}
    for layer in LAYERS:
        for var in range(3):
            out[f't_{layer}_full{var}'] = make_tile(layer, 15, var)
        if layer == 'bed':
            continue
        for mask in range(1, 15):
            out[f't_{layer}_{mask}'] = make_tile(layer, mask, 0)
    return out


def rocks():
    out = {}
    r1 = [
        "................",
        "................",
        ".....oooooo.....",
        "...oo655556oo...",
        "..o65555556676o.",
        "..o5555665667o..",
        ".o65556677677o..",
        ".o6556677777766o",
        ".o6667777i77778o",
        "..o677777777788o",
        "..oo7877787888o.",
        "..oqoo888888oo..",
        "...qqqoooooo....",
        "................",
        "................",
        "................",
    ]
    r1 = [r[:16].ljust(16, '.') for r in r1]
    out['rock0'] = parse(r1)
    r2 = [
        "................",
        "................",
        "................",
        "......oooo......",
        "....oo5566oo....",
        "...o655667i6o...",
        "..o6556667776o..",
        "..o5667776777o..",
        ".o6676777i77778o",
        ".o6777777777788o",
        "..o7787787788o..",
        "..oo88888888oo..",
        "....oooooooo....",
        "................",
        "................",
        "................",
    ]
    out['rock1'] = parse([r[:16].ljust(16, '.') for r in r2])
    # oyster bed: cluster of shells on a low rock
    r3 = [
        "................",
        "................",
        "................",
        "................",
        ".....oo..oo.....",
        "...oo56oo65oo...",
        "..o5i67o6i76o...",
        "..o6766o6667oo..",
        ".o6o776676o67o..",
        ".o6576o675i66o..",
        ".o677776777776o.",
        "..o78878878878o.",
        "...oooooooooo...",
        "................",
        "................",
        "................",
    ]
    out['rock2'] = parse([r[:16].ljust(16, '.') for r in r3])
    return out


def boardwalk():
    out = {}
    # vertical boardwalk, planks laid across. 16x16 seamless vertically
    rows = []
    for y in range(16):
        if y % 4 == 3:
            rows.append("o4o4444444444o4o"[:16])
        else:
            base = '1' if y % 4 == 0 else '2'
            rows.append(("o3" + base * 12 + "3o"))
    img = parse(rows)
    px = img.load()
    # nail dots and grain
    for y in range(16):
        if y % 4 == 1:
            px[3, y] = hex2rgba(PAL['3'])
            px[12, y] = hex2rgba(PAL['3'])
        if y % 4 == 2 and y % 8 == 2:
            px[7, y] = hex2rgba(PAL['3'])
    out['board_mid'] = img
    # post caps on the sides (drawn over water at the bottom of planks)
    post = parse([
        "oooo",
        "o32o",
        "o32o",
        "o43o",
        "o43o",
        "o44o",
        "oooo",
    ])
    out['board_post'] = post
    # end cap with rope rail
    end = img.copy()
    paste(end, parse(["oooooooooooooooo", "o11111111111111o", "o22222222222222o", "oooooooooooooooo"]), 0, 0)
    out['board_end'] = end
    return out


def props():
    out = {}
    out['tuft0'] = parse([
        "........",
        "...v....",
        ".v.vz.v.",
        ".vzvzvz.",
        "..zZzZ..",
    ])
    out['tuft1'] = parse([
        "........",
        "..u..u..",
        ".uYu.uY.",
        "..uUuU..",
    ])  # beach grass (dry)
    out['flower0'] = parse([
        ".!.....",
        "!*!.!..",
        ".!.!*!.",
        ".z..!..",
        ".zz.z..",
    ])
    out['flower1'] = parse([
        ".n.....",
        "n*n..n.",
        ".n..n*n",
        ".z...n.",
        ".zz..z.",
    ])
    out['pebble0'] = parse([".oo.", "o56o", "o67o", ".oo."])
    out['pebble1'] = parse(["..oo..", ".o56o.", "o5677o", ".oooo."])
    out['tinyshell'] = parse([".oo.", "oiIo", ".oo."])
    out['crabhole'] = parse([".XX.", "XooX", ".XX."])
    out['seaweed'] = parse([
        "..z...",
        ".zZ.z.",
        ".Zz.Zz",
        "..ZzZ.",
        "...Z..",
    ])
    # pine tree 24x32
    pine = [
        "...........oo...........",
        "..........oZZo..........",
        ".........oZzzZo.........",
        "........oZzVzzZo........",
        ".......oZzVVzzzZo.......",
        "......oZZzzzzzZZZo......",
        ".......ooZzzzZZoo.......",
        "......oZzzVVzzzZo.......",
        ".....oZzVVVzzzzZZo......",
        "....oZzzVzzzzzzZZZo.....",
        "...oZZzzzzzzzzZZZZZo....",
        "....ooZZzzzzzZZZZoo.....",
        ".....oZzzVVzzzzZZo......",
        "....oZzVVVVzzzzZZZo.....",
        "...oZzzVVzzzzzzZZZZo....",
        "..oZzzzzzzzzzzZZZZZZo...",
        ".oZZZzzzzzzzzZZZZZZZZo..",
        "..ooZZZZZZZZZZZZZZZoo...",
        "....ooooooo3oooooooo....",
        "..........o33o..........",
        "..........o32o..........",
        "..........o32o..........",
        "..........o33o..........",
        ".........oo334o.........",
        "........oooooooo........",
    ]
    out['pine'] = parse([r[:24].ljust(24, '.') for r in pine])
    # camellia bush 16x14
    bush = [
        "................",
        ".....oooooo.....",
        "...ooVzzVzzoo...",
        "..oVz!zzVz!zZo..",
        ".oVzz@!zzz!@zZo.",
        ".ozVzzzzVzzzZZo.",
        "oVz!zzVzz!zzzZZo",
        "ozz@!zzzz@!zZZZo",
        "oZzzzzz!zzzzZZZo",
        ".oZZzzz@!zZZZZo.",
        "..ooZZZZZZZZoo..",
        "....oooooooo....",
    ]
    out['bush'] = parse([r[:16].ljust(16, '.') for r in bush])
    return out
