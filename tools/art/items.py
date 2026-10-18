"""Collectible items, effects and small props."""
from pix import parse, blank, paste, flip, outline, hex2rgba, PAL
from PIL import Image
import math

ITEMS = {
    # scallop shell: pink fan with ridges
    'shell': [
        "............",
        "....oooo....",
        "...oiiiio...",
        "..oiIiIiIo..",
        ".oiIiIiIiIo.",
        ".oIiIiIiIio.",
        ".oiIiIiIiIo.",
        "..oKiKiKio..",
        "...oKKKKo...",
        "...oiKKio...",
        "....oooo....",
        "............",
    ],
    # driftwood: a bleached log with a knot
    'wood': [
        "................",
        "................",
        "..........ooo...",
        "........oo112o..",
        "......oo1122o3o.",
        "....oo11212o33o.",
        "..oo1122123o3o..",
        ".o1122223oo3o...",
        ".o22232233o.....",
        ".o3233o33o......",
        "..o33o.oo.......",
        "...oo...........",
    ],
    # sea glass: rounded teal pebble with shine
    'glass': [
        "............",
        "....oooo....",
        "...oTTLLo...",
        "..oTNTLLLo..",
        "..oTTLLLLMo.",
        ".oTLLLLLLMo.",
        ".oLLLLLLMMo.",
        "..oLLLLMMo..",
        "..oMLMMMMo..",
        "...ooMMoo...",
        ".....oo.....",
        "............",
    ],
    # rope: a coiled rope
    'rope': [
        "..............",
        "....oooooo....",
        "...oYYYYYUo...",
        "..oYUooooUUo..",
        ".oYUoUUUUoUUo.",
        ".oYoUoooUUoUo.",
        ".oYoUoYYoUoUo.",
        ".oUoUoooUUoUo.",
        ".oUUoUUUUoUUo.",
        "..oUUooooUUo..",
        "...oUUUUUUo...",
        "....oooooo....",
    ],
    # pearl in an oyster
    'pearl': [
        "..............",
        "..............",
        "....oooooo....",
        "...o676767o...",
        "..o67oooo76o..",
        "..o7oNN9oo7o..",
        "..o7oN990o7o..",
        "..o67o00o76o..",
        "..oo676767oo..",
        ".o6767676767o.",
        "..o77777777o..",
        "...oooooooo...",
    ],
    # treasure chest
    'chest': [
        "................",
        "................",
        "...oooooooooo...",
        "..o2121121212o..",
        ".o212nnnn2121o..",
        ".o33333333333o..",
        ".onnnnnnnnnnnno.",
        ".o3233nCCn3323o.",
        ".o2323nccn2332o.",
        ".o3233onno3233o.",
        ".o2323333332323o"[:16],
        "..oooooooooooo..",
    ],
    # message bottle (collection)
    'bottle': [
        "..............",
        "..........oo..",
        ".........o33o.",
        "........oLLo..",
        "......ooLLo...",
        "....ooLwwLo...",
        "...oLLwWwLo...",
        "..oLLwwwLo....",
        "..oLLLLLLo....",
        "..oMLLLMo.....",
        "...oMMMo......",
        "....ooo.......",
    ],
    # starfish (daily event)
    'starfish': [
        "............",
        ".....oo.....",
        "....o++o....",
        "....o++o....",
        ".ooo+++=ooo.",
        "o++++=+++++o",
        ".o=++++++=o.",
        "..o++++++o..",
        "..o+=oo=+o..",
        ".o+=o..o=+o.",
        ".o=o....o=o.",
        "..o......o..",
    ],
}
ITEMS['chest'][10] = ".o2323333332323o"
ITEMS['chest'] = [r[:16].ljust(16, '.') for r in ITEMS['chest']]


def item_frames():
    out = {}
    for k, rows in ITEMS.items():
        w = max(len(r) for r in rows)
        img = parse([r.ljust(w, '.') for r in rows])
        out[f'item_{k}'] = img
    # shadow blob under items
    sh = blank(12, 4)
    px = sh.load()
    for y in range(4):
        for x in range(12):
            dx, dy = (x + 0.5 - 6) / 6, (y + 0.5 - 2) / 2
            if dx * dx + dy * dy <= 1:
                px[x, y] = (40, 25, 15, 70)
    out['shadow'] = sh
    big = blank(20, 6)
    px = big.load()
    for y in range(6):
        for x in range(20):
            dx, dy = (x + 0.5 - 10) / 10, (y + 0.5 - 3) / 3
            if dx * dx + dy * dy <= 1:
                px[x, y] = (40, 25, 15, 70)
    out['shadow_big'] = big
    return out


def fx_frames():
    out = {}
    W = hex2rgba('#ffffff')
    Y = hex2rgba('#fff3b0')
    # sparkle 7x7, 4 frames
    shapes = [
        ["...", ".N.", "..."],
        [".....", "..N..", ".NNN.", "..N..", "....."],
        ["...N...", "...N...", "..*N*..", "NNNNNNN", "..*N*..", "...N...", "...N..."],
        [".....", "..*..", ".*N*.", "..*..", "....."],
    ]
    for i, s in enumerate(shapes):
        img = blank(7, 7)
        g = parse(s)
        paste(img, g, (7 - g.size[0]) // 2, (7 - g.size[1]) // 2)
        out[f'fx_sparkle{i}'] = img
    # pickup ring: expanding circle 16x16
    for i, r in enumerate([3, 5, 7]):
        img = blank(16, 16)
        px = img.load()
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
                if abs(d - r) < 0.6:
                    px[x, y] = W if i < 2 else (255, 255, 255, 150)
        out[f'fx_ring{i}'] = img
    # dust puff 8x8 3 frames
    puffs = [
        ["........", "........", "...yy...", "..yYYy..", "..yYYy..", "...yy...", "........", "........"],
        ["........", "..yy.y..", ".yYYyYy.", ".yYuuYy.", ".yYuuYy.", "..yYYy..", "...yy...", "........"],
        [".y....y.", "........", "..y..y..", ".y....y.", "........", "..y..y..", ".y....y.", "........"],
    ]
    for i, p in enumerate(puffs):
        out[f'fx_dust{i}'] = parse(p)
    # splash 16x12, 4 frames
    spl = [
        ["................", "................", "................", "................", "................",
         "................", "......t..t......", ".....tptptpt....", "....tpppppppt...", "...tpPPPPPPpt...", "....tttttttt....", "................"],
        ["................", "................", "................", ".....t....t.....", "....t..tt..t....",
         "...t.tptpt.t....", "..t.tpppppt.t...", "...tpPPPPPpt....", "..tpPPPPPPPpt...", "...tpppppppt....", "....tttttttt....", "................"],
        ["................", "...t........t...", "..t..t....t..t..", ".....t.tt.t.....", "..t..........t..",
         "....t......t....", ".......tt.......", "....tpppppt.....", "...tpPPPPPpt....", "....tpppppt.....", ".....ttttt......", "................"],
        ["................", "..t..........t..", "................", "t..............t", "................",
         "................", "................", "................", ".....tpppt......", "....tpPPPpt.....", ".....ttttt......", "................"],
    ]
    for i, s in enumerate(spl):
        out[f'fx_splash{i}'] = parse(s)
    # bubble 5x5
    out['fx_bubble'] = parse([".ttt.", "tp.pt", "t...t", "tp..t", ".ttt."])
    # sweat drop 3x5
    out['fx_sweat'] = parse([".p.", ".p.", "pPp", "pPp", ".p."])
    # exclamation bubble 9x11
    out['fx_alert'] = parse([
        ".ooooooo.",
        "oiiiiiiio",
        "oiiirriio",
        "oiiirriio",
        "oiiirriio",
        "oiiiiiiio",
        "oiiirriio",
        "oiiiiiiio",
        ".ooo.ooo.",
        "....o.o..",
        ".....o...",
    ])
    out['fx_full'] = parse([
        ".ooooooooo.",
        "oiiiiiiiiio",
        "oiiijjjiiio",
        "oiijgggjiio",
        "oiijgGgjiio",
        "oiiijjjiiio",
        "oiiiiiiiiio",
        ".ooo.ooooo.",
        "....o.o....",
        ".....o.....",
    ])
    # petal / confetti 3x3 in several colors
    for i, c in enumerate(['I', 'n', 'L', 'v', '+']):
        out[f'fx_petal{i}'] = parse([f".{c}.", f"{c}{c}{c}", f".{c}."])
    # star burst 11x11
    out['fx_star'] = parse([
        ".....o.....",
        "....oCo....",
        "....oCo....",
        "ooooCCCoooo",
        "oCCCCCCCCCo",
        ".oCCCCCCCo.",
        "..oCCCCCo..",
        "..oCCoCCo..",
        ".oCCo.oCCo.",
        ".oCo...oCo.",
        ".oo.....oo.",
    ])
    # foam crash arc 32x16, 5 frames (drawn procedurally)
    for i in range(5):
        img = blank(32, 16)
        px = img.load()
        t = (i + 1) / 5
        for x in range(32):
            hgt = int((1 - abs(x - 16) / 16) * 12 * math.sin(t * math.pi * 0.9 + 0.2))
            for y in range(16 - hgt, 16):
                edge = y == 16 - hgt
                if edge or (x + y + i) % 5 == 0:
                    px[x, y] = hex2rgba(PAL['t'])
                elif (x * 7 + y * 3 + i) % 4 == 0:
                    px[x, y] = hex2rgba(PAL['p'], 200)
        out[f'fx_crash{i}'] = img
    # footprints (2 small marks) 6x4
    out['footprint'] = parse(["UU..UU", "UU..UU", ".U...U", "......"])
    out['footprint_mud'] = parse(["XX..XX", "XX..XX", ".X...X", "......"])
    # ripple ring around wading legs 14x5
    out['ripple0'] = parse(["...tttttttt...", ".tt........tt.", "t............t", ".tt........tt.", "...tttttttt..."])
    out['ripple1'] = parse(["..............", "..tttttttttt..", ".t..........t.", "..tttttttttt..", ".............."])
    # mud sled (뻘배) 16x8 seen from above-ish
    out['sled'] = parse([
        "................",
        ".oooooooooooooo.",
        "o1111111111112o",
        "o2222222222223o",
        "o3333333333334o",
        ".oooooooooooooo.",
        "..o..........o..",
        "................",
    ][:0] or [
        "................",
        ".oooooooooooooo.",
        "o11111111111112o",
        "o22222222222223o",
        "o33333333333334o",
        ".oooooooooooooo.",
        "...o........o...",
        "................",
    ])
    return out


GLYPHS = {
    '0': ["NNN", "N.N", "N.N", "N.N", "NNN"],
    '1': [".N.", "NN.", ".N.", ".N.", "NNN"],
    '2': ["NNN", "..N", "NNN", "N..", "NNN"],
    '3': ["NNN", "..N", ".NN", "..N", "NNN"],
    '4': ["N.N", "N.N", "NNN", "..N", "..N"],
    '5': ["NNN", "N..", "NNN", "..N", "NNN"],
    '6': ["NNN", "N..", "NNN", "N.N", "NNN"],
    '7': ["NNN", "..N", ".N.", ".N.", ".N."],
    '8': ["NNN", "N.N", "NNN", "N.N", "NNN"],
    '9': ["NNN", "N.N", "NNN", "..N", "NNN"],
    'plus': ["...", ".N.", "NNN", ".N.", "..."],
    'x': ["...", "N.N", ".N.", "N.N", "..."],
    'bang': [".N.", ".N.", ".N.", "...", ".N."],
    'm': ["...", "NNN", "NNN", "N.N", "N.N"],
}


def glyph_frames():
    out = {}
    for k, rows in GLYPHS.items():
        for col, suffix in (('N', ''), ('C', '_gold'), ('T', '_teal')):
            g = parse([r.replace('N', col) for r in rows])
            from pix import outline as _ol
            big = blank(5, 7)
            paste(big, g, 1, 1)
            out[f'g_{k}{suffix}'] = _ol(big)
    return out
