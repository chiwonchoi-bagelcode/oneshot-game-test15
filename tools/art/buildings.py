"""Buildings, plots and decorations drawn on a palette-key grid, then outlined."""
from pix import parse, blank, paste, outline, hex2rgba, PAL, flip
import math


class G:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [['.'] * w for _ in range(h)]

    def p(self, x, y, k):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = k

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.g[y][x]
        return '.'

    def rect(self, x, y, w, h, k):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.p(xx, yy, k)

    def hline(self, x, y, w, k):
        self.rect(x, y, w, 1, k)

    def vline(self, x, y, h, k):
        self.rect(x, y, 1, h, k)

    def box(self, x, y, w, h, k):
        self.hline(x, y, w, k)
        self.hline(x, y + h - 1, w, k)
        self.vline(x, y, h, k)
        self.vline(x + w - 1, y, h, k)

    def ellipse(self, cx, cy, rx, ry, k):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.p(x, y, k)

    def img(self, do_outline=True):
        im = parse([''.join(r) for r in self.g])
        return outline(im) if do_outline else im


def plank_wall(g, x, y, w, h, light='1', base='2', line='3'):
    g.rect(x, y, w, h, base)
    for xx in range(x, x + w):
        if (xx - x) % 4 == 3:
            g.vline(xx, y, h, line)
    g.hline(x, y, w, light)
    for yy in range(y + 2, y + h, 5):
        for xx in range(x + ((yy // 5) % 2) * 2, x + w, 7):
            if g.get(xx, yy) == base:
                g.p(xx, yy, line)


def thatch_roof(g, x0, x1, y0, y1, pal=('a', 'A', 'c')):
    """Trapezoid straw roof from (x0..x1) at bottom y1 up to a ridge at y0."""
    hgt = y1 - y0
    cx = (x0 + x1) / 2
    for i, y in enumerate(range(y0, y1 + 1)):
        t = i / max(1, hgt)
        half = (x1 - x0) / 2 * (0.35 + 0.65 * t)
        a, b = int(cx - half), int(math.ceil(cx + half))
        for x in range(a, b):
            k = pal[1]
            if (x * 3 + y * 5) % 7 == 0 or (x + y) % 9 == 0:
                k = pal[2]
            if i < 2 or (x - a) < 1:
                k = pal[0]
            if y >= y1 - 1:
                k = pal[2]
            g.p(x, y, k)


def tile_roof(g, x0, x1, y0, y1, keys=('!', '@', '#')):
    hgt = y1 - y0
    cx = (x0 + x1) / 2
    for i, y in enumerate(range(y0, y1 + 1)):
        t = i / max(1, hgt)
        half = (x1 - x0) / 2 * (0.25 + 0.75 * t)
        a, b = int(cx - half), int(math.ceil(cx + half))
        for x in range(a, b):
            k = keys[0]
            if (y - y0) % 3 == 2:
                k = keys[1]
            elif (x + (y // 3) * 2) % 4 == 0:
                k = keys[1]
            if x >= cx + half - 2:
                k = keys[2] if (y - y0) % 3 != 0 else keys[1]
            if y == y1:
                k = keys[2]
            g.p(x, y, k)


def window(g, x, y, w=6, h=6, lit=False):
    g.rect(x, y, w, h, '3')
    g.rect(x + 1, y + 1, w - 2, h - 2, '*' if lit else 'P')
    g.vline(x + w // 2, y + 1, h - 2, '3')
    g.hline(x + 1, y + h // 2, w - 2, '3')
    if not lit:
        g.p(x + 1, y + 1, 'p')


def door(g, x, y, w=6, h=10):
    g.rect(x, y, w, h, '3')
    g.rect(x + 1, y + 1, w - 2, h - 1, '4')
    for yy in range(y + 2, y + h, 3):
        g.hline(x + 1, yy, w - 2, '3')
    g.p(x + w - 2, y + h // 2, 'n')


def cottage(level):
    if level == 1:
        g = G(40, 34)
        plank_wall(g, 7, 17, 26, 15)
        door(g, 17, 22, 6, 10)
        window(g, 9, 21, 6, 6)
        window(g, 26, 21, 5, 6)
        thatch_roof(g, 3, 37, 4, 18)
        g.rect(29, 6, 4, 6, '6')  # little chimney stone
        g.rect(29, 6, 4, 1, '5')
        g.hline(6, 32, 28, '4')
        return g.img()
    if level == 2:
        g = G(44, 40)
        g.rect(7, 20, 30, 18, 'w')
        for xx in (7, 36):
            g.vline(xx, 20, 18, '3')
        g.hline(7, 20, 30, '3')
        g.hline(7, 28, 30, 'W')
        door(g, 19, 27, 6, 11)
        window(g, 10, 24, 6, 6, lit=True)
        window(g, 28, 24, 6, 6, lit=True)
        g.rect(10, 30, 6, 2, '3')
        for i in range(6):
            g.p(10 + i, 29, '!' if i % 2 == 0 else 'z')
        g.rect(28, 30, 6, 2, '3')
        for i in range(6):
            g.p(28 + i, 29, 'n' if i % 2 == 0 else 'z')
        tile_roof(g, 2, 42, 5, 21)
        g.rect(31, 2, 5, 10, '7')
        g.rect(31, 2, 5, 1, '6')
        g.vline(33, 4, 8, '8')
        g.hline(6, 38, 32, '4')
        return g.img()
    g = G(48, 46)
    g.rect(6, 22, 36, 22, 'w')
    for xx in (6, 41):
        g.vline(xx, 22, 22, '3')
    g.hline(6, 22, 36, '3')
    g.hline(6, 32, 36, 'W')
    door(g, 21, 32, 6, 12)
    window(g, 9, 26, 7, 7, lit=True)
    window(g, 32, 26, 7, 7, lit=True)
    # porch
    g.rect(15, 42, 18, 2, '2')
    g.hline(15, 41, 18, '1')
    g.vline(15, 31, 11, '3')
    g.vline(32, 31, 11, '3')
    g.hline(14, 30, 20, '2')
    g.hline(14, 29, 20, '1')
    # lantern on porch
    g.rect(33, 33, 3, 4, 'n')
    g.p(34, 34, '*')
    tile_roof(g, 2, 46, 3, 23, keys=('$', '%', '&'))
    # attic window
    window(g, 21, 11, 6, 6, lit=True)
    g.rect(35, 0, 5, 12, '7')
    g.rect(35, 0, 5, 1, '6')
    for i in range(7):
        g.p(9 + i, 34, '!' if i % 2 else 'z')
        g.p(32 + i, 34, '-' if i % 2 else 'z')
    g.hline(5, 44, 38, '4')
    return g.img()


def haenyeo_house():
    g = G(44, 36)
    # basalt walls
    g.rect(6, 17, 32, 17, '7')
    for y in range(17, 34):
        for x in range(6, 38):
            r = (x * 13 + y * 7) % 11
            if r == 0:
                g.p(x, y, '8')
            elif r == 5:
                g.p(x, y, '6')
    for y in range(19, 34, 4):
        for x in range(6 + (y % 8) // 2, 38, 6):
            g.p(x, y, '8')
    door(g, 19, 23, 6, 11)
    window(g, 9, 21, 6, 5)
    # thatch roof with rope grid (Jeju style)
    thatch_roof(g, 2, 42, 4, 18, pal=('a', 'A', 'c'))
    for x in range(4, 41, 5):
        for y in range(5, 18):
            if g.get(x, y) in 'aAc':
                g.p(x, y, 'U')
    for y in range(7, 18, 4):
        for x in range(2, 42):
            if g.get(x, y) in 'aAc':
                g.p(x, y, 'U')
    # floats (tewak) hanging
    for i, (fx, fy) in enumerate([(29, 22), (34, 24), (31, 27)]):
        g.ellipse(fx + 1.5, fy + 1.5, 2.2, 2.2, '+')
        g.p(fx + 1, fy + 1, 'n')
    g.hline(5, 34, 34, '4')
    return g.img()


def shed(level):
    g = G(40, 32)
    # back wall dark interior
    g.rect(5, 12, 30, 18, '4')
    g.rect(5, 12, 30, 2, '3')
    # posts
    for x in (5, 19, 34):
        g.vline(x, 12, 18, '3')
        g.vline(x + 1 if x < 34 else x - 1, 12, 18, '2')
    # slanted plank roof
    for i, y in enumerate(range(3, 14)):
        for x in range(2, 38):
            k = '2' if (x // 4) % 2 else '3'
            if y == 3 or y == 4:
                k = '1'
            if y == 13:
                k = '4'
            g.p(x, y, k)
    # mud sled leaning
    for i in range(12):
        g.p(9 + i // 3, 27 - i, '1')
        g.p(10 + i // 3, 27 - i, '2')
        g.p(11 + i // 3, 27 - i, '3')
    # bucket
    g.rect(24, 24, 6, 6, '6')
    g.hline(24, 24, 6, '5')
    g.rect(25, 25, 4, 1, 'X')
    if level >= 2:
        for i in range(12):
            g.p(14 + i // 3, 27 - i, '1')
            g.p(15 + i // 3, 27 - i, '2')
        # little flag
        g.vline(36, 0, 6, '3')
        g.rect(37, 0, 3, 3, '$')
    g.hline(3, 30, 34, 'X')
    return g.img()


def lighthouse(level):
    g = G(26, 64)
    # tower body tapered
    for y in range(14, 60):
        t = (y - 14) / 46
        half = 5 + 3.5 * t
        a, b = int(13 - half), int(math.ceil(13 + half))
        stripe = ((y - 14) // 8) % 2 == 1
        for x in range(a, b):
            k = '!' if stripe else 'w'
            if x >= b - 3:
                k = '@' if stripe else 'W'
            if x == a:
                k = '!' if stripe else 'i'
            g.p(x, y, k)
    # door
    g.rect(11, 52, 5, 8, '3')
    g.rect(12, 53, 3, 7, '4')
    # small windows
    g.rect(12, 30, 3, 4, '3')
    g.rect(13, 31, 1, 2, 'P')
    g.rect(12, 42, 3, 4, '3')
    g.rect(13, 43, 1, 2, 'P')
    # balcony
    g.hline(5, 14, 16, '8')
    g.hline(6, 13, 14, '7')
    for x in range(6, 20, 2):
        g.p(x, 12, '8')
    # lamp room
    g.rect(8, 6, 10, 7, '8')
    g.rect(9, 7, 8, 5, '*' if level >= 2 else 'n')
    g.vline(13, 7, 5, '8')
    # dome roof
    for i, y in enumerate(range(1, 6)):
        half = 2 + i * 1.3
        for x in range(int(13 - half), int(math.ceil(13 + half))):
            g.p(x, y, '!' if x < 14 else '@')
    g.p(13, 0, '8')
    if level >= 2:
        g.vline(19, 0, 6, '3')
        g.rect(20, 0, 4, 3, 'n')
    g.hline(3, 60, 20, '7')
    g.hline(4, 61, 18, '8')
    return g.img()


def stilt_hut():
    g = G(36, 46)
    # stilts
    for x in (7, 16, 27):
        g.rect(x, 26, 2, 18, '3')
        g.vline(x, 26, 18, '2')
    # cross braces
    for i in range(10):
        g.p(9 + i, 30 + i // 2, '3')
        g.p(26 - i, 30 + i // 2, '3')
    # deck
    g.rect(3, 24, 30, 3, '2')
    g.hline(3, 24, 30, '1')
    # hut body
    plank_wall(g, 7, 13, 22, 11)
    door(g, 15, 15, 5, 9)
    window(g, 22, 16, 5, 5, lit=True)
    thatch_roof(g, 4, 32, 2, 14)
    # bell
    g.vline(31, 14, 4, '3')
    g.rect(30, 18, 3, 3, 'n')
    g.p(31, 21, '3')
    # ladder
    for y in range(27, 44, 3):
        g.hline(20, y, 4, '1')
    g.vline(20, 27, 17, '3')
    g.vline(23, 27, 17, '3')
    return g.img()


def rowboat():
    g = G(28, 12)
    for y in range(2, 10):
        t = abs(y - 6) / 4
        a, b = int(2 + t * 4), int(26 - t * 4)
        for x in range(a, b):
            g.p(x, y, '2' if y < 6 else '3')
    g.hline(3, 3, 22, '1')
    g.rect(6, 4, 16, 3, '4')
    g.hline(12, 4, 4, '2')
    return g.img()


def plot_sign():
    g = G(16, 20)
    g.rect(2, 3, 12, 8, '2')
    g.hline(2, 3, 12, '1')
    g.hline(2, 10, 12, '3')
    g.vline(7, 11, 8, '3')
    g.vline(8, 11, 8, '2')
    # hammer icon on sign
    g.rect(5, 5, 5, 2, '7')
    g.vline(7, 7, 3, '4')
    return g.img()


def stakes():
    """Rope-and-stake outline corner piece for building plots (8x10)."""
    g = G(6, 10)
    g.vline(2, 2, 7, '3')
    g.vline(3, 2, 7, '2')
    g.hline(2, 1, 2, '1')
    return g.img()


def decor():
    out = {}
    # flower bed
    g = G(18, 10)
    g.rect(1, 4, 16, 5, '3')
    g.rect(2, 4, 14, 4, 'X')
    for i, x in enumerate(range(2, 16, 2)):
        g.p(x, 3, 'z')
        g.p(x, 2, ['!', 'n', '-', 'I'][i % 4])
        g.p(x + 1, 3, 'z')
    out['decor_flowerbed'] = g.img()
    # lantern post
    g = G(10, 22)
    g.vline(4, 6, 14, '3')
    g.vline(5, 6, 14, '2')
    g.rect(2, 1, 6, 6, '8')
    g.rect(3, 2, 4, 4, '*')
    g.hline(1, 0, 8, '8')
    g.rect(2, 20, 6, 2, '7')
    out['decor_lantern'] = g.img()
    # bench
    g = G(18, 10)
    g.rect(1, 2, 16, 2, '2')
    g.hline(1, 2, 16, '1')
    g.rect(1, 5, 16, 2, '2')
    g.hline(1, 5, 16, '1')
    for x in (2, 15):
        g.vline(x, 7, 3, '3')
    g.vline(2, 3, 3, '3')
    g.vline(15, 3, 3, '3')
    out['decor_bench'] = g.img()
    # flag
    g = G(14, 24)
    g.vline(2, 1, 22, '3')
    for y in range(2, 9):
        w = 9 - abs(y - 5)
        g.hline(3, y, w, '$' if y < 5 else '%')
    g.p(5, 4, 'w')
    g.p(6, 5, 'w')
    g.p(5, 6, 'w')
    out['decor_flag'] = g.img()
    # wind chime with shells
    g = G(12, 18)
    g.hline(1, 2, 10, '3')
    g.vline(5, 0, 3, '3')
    for i, x in enumerate((2, 5, 8)):
        g.vline(x, 3, 6 + i, 'W')
        g.rect(x - 1, 9 + i, 3, 3, 'I')
        g.p(x, 9 + i, 'i')
    out['decor_chime'] = g.img()
    # shell path
    g = G(16, 12)
    for (cx, cy) in [(3, 3), (9, 2), (13, 6), (5, 8), (11, 10)]:
        g.ellipse(cx, cy, 2.2, 1.6, '5')
        g.p(int(cx) - 1, int(cy) - 1, 'i')
    out['decor_path'] = g.img(do_outline=False)
    # little well / stone lamp
    g = G(16, 20)
    g.rect(2, 10, 12, 8, '7')
    for y in range(10, 18, 2):
        for x in range(2 + (y % 4), 14, 4):
            g.p(x, y, '8')
    g.hline(2, 10, 12, '6')
    g.rect(4, 11, 8, 2, 'Q')
    g.vline(3, 2, 8, '3')
    g.vline(12, 2, 8, '3')
    g.rect(1, 0, 14, 3, '!')
    g.hline(1, 2, 14, '@')
    out['decor_well'] = g.img()
    return out


def building_frames():
    out = {}
    for lv in (1, 2, 3):
        out[f'b_cottage{lv}'] = cottage(lv)
    out['b_haenyeo1'] = haenyeo_house()
    out['b_shed1'] = shed(1)
    out['b_shed2'] = shed(2)
    out['b_lighthouse1'] = lighthouse(1)
    out['b_lighthouse2'] = lighthouse(2)
    out['b_stilt1'] = stilt_hut()
    out['rowboat'] = rowboat()
    out['plot_sign'] = plot_sign()
    out['stake'] = stakes()
    out.update(decor())
    return out
