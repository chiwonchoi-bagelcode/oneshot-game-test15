"""UI: 9-slice panels/buttons and a 16x16 icon set in the game palette."""
from pix import parse, blank, paste, outline, hex2rgba, PAL, flip
from buildings import G
import math


def rounded_panel(w, h, border, fill, inner_hi=None, shadow=None, r=3):
    g = G(w, h)
    for y in range(h):
        for x in range(w):
            # rounded corners
            cx = min(x, w - 1 - x)
            cy = min(y, h - 1 - y)
            if cx < r and cy < r and (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > r * r:
                continue
            g.p(x, y, fill)
    # outline ring
    img = g.img(do_outline=False)
    return img


def panel9(kind):
    """24x24 source for CSS border-image (slice 8)."""
    S = 24
    g = G(S, S)
    if kind == 'parch':
        frame, frame2, fill, hi = '3', '2', 'y', 'i'
    elif kind == 'wood':
        frame, frame2, fill, hi = '4', '3', '2', '1'
    elif kind == 'dark':
        frame, frame2, fill, hi = 'o', 'O', 'O', 'x'
    for y in range(S):
        for x in range(S):
            cx = min(x, S - 1 - x)
            cy = min(y, S - 1 - y)
            d = min(cx, cy)
            corner = cx < 3 and cy < 3 and (3 - cx - 0.5) ** 2 + (3 - cy - 0.5) ** 2 > 9
            if corner:
                continue
            if d == 0:
                k = 'o'
            elif d <= 2:
                k = frame2 if d == 1 else frame
            elif d == 3:
                k = hi if (y < S / 2) else ('Y' if kind == 'parch' else frame)
            else:
                k = fill
            # bottom inner shadow line
            if kind == 'parch' and d == 3 and y > S / 2:
                k = 'Y'
            g.p(x, y, k)
    # re-round corners for outline consistency
    img = g.img(do_outline=False)
    return img


def button9(kind, pressed=False):
    """24x26 source (slice 8 top/sides, 10 bottom) with a 3px bottom lip."""
    W, H = 24, 26
    colors = {
        'primary': ('C', 'n', 'A', 'c'),     # warm yellow
        'go': ('?', '?', '/', 'z'),          # green
        'sea': ('T', 'L', 'M', 'Q'),         # teal
        'plain': ('i', 'y', 'Y', 'u'),       # parchment
        'wood': ('1', '2', '3', '4'),
    }[kind]
    hi, base, shade, lip = colors
    g = G(W, H)
    top = 3 if pressed else 0
    body_h = H - 3
    for y in range(H):
        for x in range(W):
            yy = y - top
            if yy < 0:
                continue
            cx = min(x, W - 1 - x)
            cy_top = yy
            cy_bot = (H - 1 - top) - yy
            r = 4
            cy = min(cy_top, cy_bot)
            if cx < r and cy < r and (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > r * r:
                continue
            k = base
            if yy >= body_h - (3 if not pressed else 0) - top:
                k = lip
            elif cy_top <= 2:
                k = hi
            elif cy_bot <= 5:
                k = shade
            if cx == 0 or cy == 0 or (cx < r and cy < r and (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > (r - 1) ** 2):
                k = 'o'
            g.p(x, y, k)
    return g.img(do_outline=False)


ICONS = {
    'gear': [
        "................",
        ".......oo.......",
        "...oo.o66o.oo...",
        "..o66o6556o66o..",
        "..o6556665566o..",
        "...o66oooo66o...",
        ".oo66o....o66oo.",
        "o6556o....o6556o",
        "o6566o....o6656o",
        ".oo66o....o66oo.",
        "...o66oooo67o...",
        "..o6677777776o..",
        "..o77o7777o77o..",
        "...oo.o77o.oo...",
        ".......oo.......",
        "................",
    ],
    'calendar': [
        "................",
        "...o.......o....",
        "..oooooooooooo..",
        ".o!!!!!!!!!!!!o.",
        ".o@@@@@@@@@@@@o.",
        ".oiiiiiiiiiiiio.",
        ".oiPPiiiPPiiiio.",
        ".oiPPiiiPPiPPio.",
        ".oiiiiiiiiiiiio.",
        ".oiPPiPPiiiPPio.",
        ".oiPPiPPiiiPPio.",
        ".oiiiiiiiiiiiio.",
        ".oiiPPiiiPPiiio.",
        ".oyyyyyyyyyyyyo.",
        "..oooooooooooo..",
        "................",
    ],
    'book': [
        "................",
        "................",
        ".oooooo..oooooo.",
        "o$$$$$$oo$$$$$$o",
        "o$wwwww$$wwwww$o",
        "o$wWWWw$$wWWWw$o",
        "o$wwwww$$wwwww$o",
        "o$wWWWw$$wWWWw$o",
        "o$wwwww$$wwwww$o",
        "o$wWWww$$wWWww$o",
        "o$wwwww$$wwwww$o",
        "o%%%%%%%%%%%%%%o",
        "o&&&&&&oo&&&&&&o",
        ".oooooo..oooooo.",
        "................",
        "................",
    ],
    'home': [
        "................",
        ".......oo.......",
        "......o!!o......",
        ".....o!!!!o.....",
        "....o!!!!!!o....",
        "...o!!!!!!!!o...",
        "..o@@@@@@@@@@o..",
        ".oooiiiiiiiiooo.",
        "...oiiiiiiiio...",
        "...oiPPioooio...",
        "...oiPPio43io...",
        "...oiiiio43io...",
        "...oiiiio44io...",
        "...oooooooooo...",
        "................",
        "................",
    ],
    'close': [
        "................",
        "................",
        "...oo......oo...",
        "..o!!o....o!!o..",
        "..o!!!o..o!!!o..",
        "...o!!!oo!!!o...",
        "....o!!!!!!o....",
        ".....o!!!!o.....",
        ".....o!!!!o.....",
        "....o!!!!!!o....",
        "...o!!!oo!!!o...",
        "..o!!!o..o!!!o..",
        "..o@@o....o@@o..",
        "...oo......oo...",
        "................",
        "................",
    ],
    'music': [
        "................",
        "......ooooooo...",
        "......o$$$$$$o..",
        "......o%oooo$o..",
        "......o%o..o$o..",
        "......o%o..o$o..",
        "......o%o..o$o..",
        "......o%o..o$o..",
        "...oooo%o.oo$o..",
        "..o$$$$%oo$$$o..",
        "..o$$$$$oo$$$$o.",
        "..o%%%%%o.o%%%o.",
        "...ooooo...ooo..",
        "................",
        "................",
        "................",
    ],
    'sound': [
        "................",
        "................",
        ".......oo.......",
        "......o6o...o...",
        ".....o66o..o.o..",
        ".oooo666o.o..o..",
        ".o66666o6o.o.o..",
        ".o6666o66o.o..o.",
        ".o6666o66o.o..o.",
        ".o77777o7o.o.o..",
        ".oooo777o.o..o..",
        ".....o77o..o.o..",
        "......o7o...o...",
        ".......oo.......",
        "................",
        "................",
    ],
    'vibrate': [
        "................",
        "....oooooooo....",
        "....o888888o....",
        "o.o.o8PPPP8o.o.o",
        "o.o.o8PPPP8o.o.o",
        ".o..o8PPPP8o..o.",
        "o.o.o8PPPP8o.o.o",
        "o.o.o8PPPP8o.o.o",
        ".o..o8PPPP8o..o.",
        "o.o.o8PPPP8o.o.o",
        "....o8PPPP8o....",
        "....o888888o....",
        "....o886688o....",
        "....oooooooo....",
        "................",
        "................",
    ],
    'globe': [
        "................",
        ".....oooooo.....",
        "...ooPPzzPPoo...",
        "..oPPzzzzPPPPo..",
        ".oPPPzzzPPPzzPo.",
        ".oPPPPzPPPzzzPo.",
        "oPPPPPPPPzzzzzPo",
        "oPzzPPPPPPzzzPPo",
        "oPzzzPPPPPPzPPPo",
        "oPPzzzPPPPPPPPPo",
        ".oPPzzPPPPPzzPo.",
        ".oPPPPPPPPzzzPo.",
        "..oPPPPPPPPPPo..",
        "...ooPPPPPPoo...",
        ".....oooooo.....",
        "................",
    ],
    'star': [
        "................",
        ".......oo.......",
        "......oCCo......",
        "......oCCo......",
        ".....oCCCCo.....",
        "ooooooCCCCoooooo",
        "oCCCCCCCCCCCCCno",
        ".oCCCCCCCCCCCno.",
        "..onCCCCCCCCno..",
        "...onCCCCCCno...",
        "...oCCCnnCCCo...",
        "..oCCCnoonCCCo..",
        "..oCCnoo.onnCo..",
        ".oCnoo....oonCo.",
        ".ooo........ooo.",
        "................",
    ],
    'lock': [
        "................",
        ".....oooooo.....",
        "....o666666o....",
        "...o66oooo66o...",
        "...o6o....o6o...",
        "...o6o....o6o...",
        "..oooooooooooo..",
        "..onnnnnnnnnnCo.",
        "..onCCCCCCCCCo..",
        "..onCCCooCCCCo..",
        "..onCCCooCCCCo..",
        "..onCCCCoCCCCo..",
        "..onCCCCCCCCCo..",
        "..oCcccccccccco.",
        "..oooooooooooo..",
        "................",
    ],
    'check': [
        "................",
        "................",
        "............oo..",
        "...........o??o.",
        "..........o??/o.",
        ".........o??/o..",
        "..oo....o??/o...",
        ".o??o..o??/o....",
        ".o/??oo??/o.....",
        "..o/????/o......",
        "...o/??/o.......",
        "....o//o........",
        ".....oo.........",
        "................",
        "................",
        "................",
    ],
    'bag': [
        "................",
        "......oooo......",
        ".....oJJJJo.....",
        "......oJJo......",
        "....ooggggoo....",
        "...ogggYgggGo...",
        "..ogYYgggggGGo..",
        ".oggYgggggggGGo.",
        ".ogggggggggGGGo.",
        ".oggggjggjgGGjo.",
        ".oGggggggggGGjo.",
        ".oGGgggggGGGjjo.",
        "..ojGGGGGGjjjo..",
        "...oojjjjjjoo...",
        ".....oooooo.....",
        "................",
    ],
    'wave': [
        "................",
        "................",
        "................",
        "......ooo.......",
        "....oottto......",
        "...otppppto.....",
        "..otpPPoopo.....",
        ".otpPPo..o......",
        ".opPPo....oo....",
        "otpPPo...otto...",
        "opPPPPoootpPPo..",
        "oPPqqPPPPPPqqPoo",
        "oqqqQqqqqqqqQqqo",
        "oQQQQQQQQQQQQQQo",
        ".oooooooooooooo.",
        "................",
    ],
    'hammer': [
        "................",
        "................",
        "....oooooo......",
        "...o677776o.....",
        "..o66777778o....",
        "..o6777777888o..",
        "...oo7778o.ooo..",
        ".....o23o.......",
        ".....o23o.......",
        ".....o23o.......",
        ".....o23o.......",
        ".....o23o.......",
        ".....o34o.......",
        ".....o34o.......",
        "......oo........",
        "................",
    ],
    'retry': [
        "................",
        "................",
        ".....ooooo.o....",
        "....o?????o?o...",
        "...o??ooo???o...",
        "..o??o..o????o..",
        "..o?o...oooooo..",
        "..o?o...........",
        "..o?o.......o...",
        "..o??o.....o?o..",
        "...o??ooooo??o..",
        "....o/??????o...",
        ".....oo////o....",
        ".......oooo.....",
        "................",
        "................",
    ],
    'play': [
        "................",
        "................",
        "....oo..........",
        "....o?oo........",
        "....o??/oo......",
        "....o????/oo....",
        "....o??????/oo..",
        "....o????????/o.",
        "....o???????//o.",
        "....o?????///o..",
        "....o???///o....",
        "....o?///oo.....",
        "....o//oo.......",
        "....ooo.........",
        "................",
        "................",
    ],
    'back': [
        "................",
        "................",
        "......oo........",
        ".....o2o........",
        "....o12o........",
        "...o112oooooo...",
        "..o11122222223o.",
        ".o1111111111123o",
        "..o22222222223o.",
        "...o223oooooo...",
        "....o23o........",
        ".....o3o........",
        "......oo........",
        "................",
        "................",
        "................",
    ],
    'gift': [
        "................",
        "....oo...oo.....",
        "...o!!o.o!!o....",
        "...o!@!o!@!o....",
        "....o!!!!!o.....",
        ".ooooooooooooo..",
        ".o$$$$$!!$$$$o..",
        ".o%%%%%!!%%%%o..",
        ".oooooooooooooo.",
        "..o$$$$!!$$$o...",
        "..o$$$$!!$$$o...",
        "..o$$$$!!$$$o...",
        "..o%%%%!!%%%o...",
        "..o&&&&@@&&&o...",
        "..oooooooooooo..",
        "................",
    ],
    'letter': [
        "................",
        "................",
        "................",
        ".oooooooooooooo.",
        ".oiiiiiiiiiiiio.",
        ".oWiiiiiiiiiiWo.",
        ".oiWiiiiiiiiWio.",
        ".oiiWiiiiiiWiio.",
        ".oiiiWi!!iWiiio.",
        ".oiiiiW!!Wiiiio.",
        ".oiiiWiiiiWiiio.",
        ".oiiWiiiiiiWiio.",
        ".oWWWWWWWWWWWWo.",
        ".oooooooooooooo.",
        "................",
        "................",
    ],
    'info': [
        "................",
        ".....oooooo.....",
        "...oo$$$$$$oo...",
        "..o$$$$ww$$$$o..",
        "..o$$$$ww$$$$o..",
        ".o$$$$$$$$$$$$o.",
        ".o$$$$www$$$$%o.",
        ".o$$$$$ww$$$$%o.",
        ".o$$$$$ww$$$$%o.",
        ".o$$$$$ww$$$%%o.",
        "..o$$$wwww$%%o..",
        "..o%$$$$$$%%%o..",
        "...oo%%%%%%oo...",
        ".....oooooo.....",
        "................",
        "................",
    ],
    'boot': [
        "................",
        "................",
        "......ooooo.....",
        "......o!!!o.....",
        "......o!!@o.....",
        "......o!!@o.....",
        "......o!!@o.....",
        "......o!!@o.....",
        "......o!!@oo....",
        ".....o!!!!@@oo..",
        "....o!!!!!!!@@o.",
        "....o!!!!!!!!@o.",
        "....o#########o.",
        ".....ooooooooo..",
        "................",
        "................",
    ],
    'flag': [
        "................",
        "...oo...........",
        "...o3ooooooo....",
        "...o3!!!!!!!o...",
        "...o3!!!!!!!!o..",
        "...o3!!!!!!!o...",
        "...o3@@@@@@o....",
        "...o3ooooooo....",
        "...o3o..........",
        "...o3o..........",
        "...o3o..........",
        "...o3o..........",
        "..oo34oo........",
        "..o4444o........",
        "..oooooo........",
        "................",
    ],
    'pause': [
        "................",
        "................",
        "...oooo..oooo...",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oiiYo.oiiYo..",
        "...oYYYo.oYYYo..",
        "...oooo..oooo...",
        "................",
        "................",
    ],
    'clock': [
        "................",
        ".....oooooo.....",
        "...oowwwwwwoo...",
        "..owwwwowwwwWo..",
        ".owwwwwowwwwwWo.",
        ".owwwwwowwwwwWo.",
        "owwwwwwowwwwwwWo",
        "owwwwwwoooowwwWo",
        "owwwwwwwwwwwwwWo",
        "owwwwwwwwwwwwWWo",
        ".owwwwwwwwwwwWo.",
        ".oWwwwwwwwwwWWo.",
        "..oWWwwwwwWWWo..",
        "...ooWWWWWWoo...",
        ".....oooooo.....",
        "................",
    ],
}
# fix the 'back' row widths and 'lock' etc. to 16
for k, rows in ICONS.items():
    ICONS[k] = [r[:16].ljust(16, '.') for r in rows]


def icon_frames():
    out = {}
    for k, rows in ICONS.items():
        out[f'i_{k}'] = parse(rows)
    # empty star = outline-only version
    star = ICONS['star']
    empty = [''.join('Y' if c in 'Cn' else c for c in r) for r in star]
    out['i_star_empty'] = parse(empty)
    # sound off / music off variants: overlay a red slash
    for base in ('sound', 'music', 'vibrate'):
        img = out[f'i_{base}'].copy()
        px = img.load()
        for i in range(2, 14):
            for dx in (0, 1):
                px[i + dx - 1 if i + dx - 1 < 16 else 15, i] = hex2rgba(PAL['!'])
            px[min(15, i + 1), i] = hex2rgba(PAL['o'])
        out[f'i_{base}_off'] = img
    return out


def ui_frames():
    out = {}
    for k in ('parch', 'wood', 'dark'):
        out[f'panel_{k}'] = panel9(k)
    for k in ('primary', 'go', 'sea', 'plain', 'wood'):
        out[f'btn_{k}'] = button9(k)
        out[f'btn_{k}_down'] = button9(k, pressed=True)
    out.update(icon_frames())
    out.update(treasure_frames())
    # joystick ring & knob
    ring = G(40, 40)
    for y in range(40):
        for x in range(40):
            d = math.hypot(x + 0.5 - 20, y + 0.5 - 20)
            if 17 <= d < 19:
                ring.p(x, y, 'i')
            elif 19 <= d < 20:
                ring.p(x, y, 'o')
    out['joy_ring'] = ring.img(do_outline=False)
    knob = G(16, 16)
    knob.ellipse(8, 8, 7, 7, 'i')
    knob.ellipse(8, 9, 6, 5, 'y')
    out['joy_knob'] = outline(knob.img(do_outline=False))
    # home arrow indicator (points down)
    arr = [
        "....oooooo....",
        "....oCCCCo....",
        "....oCCCCo....",
        "....oCCCCo....",
        "oooooCCCCooooo",
        "oCCCCCCCCCCCCo",
        ".oCCCCCCCCCCo.",
        "..oCCCCCCCCo..",
        "...onCCCCno...",
        "....onCCno....",
        ".....onno.....",
        "......oo......",
    ]
    out['arrow_home'] = parse(arr)
    # tide gauge pieces
    return out


TREASURES = {
    'compass': [
        "................",
        ".....oooooo.....",
        "...oo222222oo...",
        "..o22nnnnnn22o..",
        ".o2nnn!nnnnnn2o.",
        ".o2nnn!!nnnnn2o.",
        "o2nnnn!!!nnnnn2o",
        "o2nnnnnoonnnnn2o",
        "o2nnnnnoonnnnn2o",
        "o2nnnnn777nnnn2o",
        ".o2nnnnn77nnn2o.",
        ".o2nnnnnn7nnn2o.",
        "..o22nnnnnn22o..",
        "...oo222222oo...",
        ".....oooooo.....",
        "................",
    ],
    'spoon': [
        "................",
        "..........ooo...",
        ".........o555o..",
        "........o55556o.",
        "........o55566o.",
        ".........o566o..",
        "........o56oo...",
        ".......o56o.....",
        "......o56o......",
        ".....o56o.......",
        "....o56o........",
        "...o56o.........",
        "..o66o..........",
        "..ooo...........",
        "................",
        "................",
    ],
    'bell': [
        "................",
        ".......oo.......",
        "......oCCo......",
        ".....onnnno.....",
        "....onnnnnCo....",
        "....onnnnnCo....",
        "...onnnnnnnCo...",
        "...onnnnnnnCo...",
        "..onnnnnnnnnCo..",
        "..onnnnnnnnnCo..",
        ".oCCCCCCCCCCCCo.",
        ".oooooooooooooo.",
        "......o44o......",
        ".......oo.......",
        "................",
        "................",
    ],
    'comb': [
        "................",
        "................",
        "..oooooooooooo..",
        ".o$iTTiiTTii$$o.",
        ".o$TiiTTiiTTi$o.",
        ".o$$$$$$$$$$$$o.",
        ".o3o3o3o3o3o3o..",
        ".o3o3o3o3o3o3o..",
        ".o3o3o3o3o3o3o..",
        ".o4o4o4o4o4o4o..",
        "..o.o.o.o.o.o...",
        "................",
        "................",
        "................",
        "................",
        "................",
    ],
    'coin': [
        "................",
        ".....oooooo.....",
        "...ooCCCCCCoo...",
        "..oCCnnnnnnCCo..",
        ".oCnnnnnnnnnnCo.",
        ".oCnnnoooonnnCo.",
        "oCnnnno..onnnnCo",
        "oCnnnno..onnnnCo",
        "oCnnnno..onnnnCo",
        "oCnnnnoooonnnnCo",
        ".oCnnnnnnnnnnCo.",
        ".oCCnnnnnnnnCCo.",
        "..oCCCCCCCCCCo..",
        "...oooooooooo...",
        "................",
        "................",
    ],
    'marble': [
        "................",
        "................",
        ".....oooooo.....",
        "....oTTLLLLo....",
        "...oTNTLL$$Lo...",
        "..oTNTL$$$LLLo..",
        "..oTTL$$LLLLLo..",
        "..oLL$$LLL!!Lo..",
        "..oLLLLLL!!LMo..",
        "..oLLLLLLLLMMo..",
        "...oLLLLLMMMo...",
        "....oMMMMMMo....",
        ".....oooooo.....",
        "................",
        "................",
        "................",
    ],
    'whistle': [
        "................",
        "................",
        "................",
        "..oooooooooo....",
        ".o1111111112o...",
        ".o122222222oo...",
        ".o1222o2222o....",
        ".o2222o22223o...",
        ".o3333333333o...",
        "..oooooooo33o...",
        "..........o3o...",
        "...........oo...",
        "................",
        "................",
        "................",
        "................",
    ],
    'teacup': [
        "................",
        "................",
        "................",
        "..oooooooooo....",
        ".owwwwwwwwwwo...",
        ".oW3333333Wwooo.",
        ".owwwww$wwwwo.o.",
        ".owww$$$wwwwo.o.",
        ".oWwww$wwwwWooo.",
        "..oWwwwwwwWo....",
        "...oWWWWWWo.....",
        ".oooooooooooo...",
        ".oWWWWWWWWWWo...",
        "..oooooooooo....",
        "................",
        "................",
    ],
    'key': [
        "................",
        "................",
        "..oooo..........",
        ".o3223o.........",
        "o32oo23o........",
        "o2o..o2oooooooo.",
        "o2o..o22222222o.",
        "o32oo23oooo3o3o.",
        ".o3223o....o.o..",
        "..oooo..........",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
    ],
    'goggles': [
        "................",
        "................",
        "................",
        "..oooo....oooo..",
        ".o8888o..o8888o.",
        "o8TTTT8oo8TTTT8o",
        "o8TNTT8888TNTT8o",
        "o8TTTL8oo8TTTL8o",
        "o8TTLL8..8TTLL8o",
        ".o8888o..o8888o.",
        "..oooo....oooo..",
        "................",
        "................",
        "................",
        "................",
        "................",
    ],
    'pen': [
        "................",
        "............oo..",
        "...........owwo.",
        "..........owWWo.",
        ".........owWWo..",
        "........owWWo...",
        ".......owWWo....",
        "......owWWo.....",
        ".....owWWo......",
        "....owWWo.......",
        "....oWWo........",
        "...o44o.........",
        "...o4o..........",
        "..oo............",
        "................",
        "................",
    ],
    'model': [
        "......oooo......",
        ".....o!!@@o.....",
        "....oo8888oo....",
        ".....o*nn*o.....",
        "....oooooooo....",
        ".....owwwWo.....",
        ".....o!!!@o.....",
        ".....owwwWo.....",
        "....owwwwWWo....",
        "....o!!!!!@o....",
        "....owwwwwWo....",
        "...owwwwwwWWo...",
        "...o!!!!!!!@o...",
        "..o7777777777o..",
        "..oooooooooooo..",
        "................",
    ],
}


def treasure_frames():
    return {f'i_tr_{k}': parse([r[:16].ljust(16, '.') for r in rows]) for k, rows in TREASURES.items()}
