"""Brand images from the game's own palette, font and sprites: logo, app icons, store feature graphic.
Run: python3 tools/art/brand.py   (after tools/art/build.py; the feature graphic also needs .cache/brand/scene.png)"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from pix import PAL, hex2rgba

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'out', 'assets')
REL = os.path.join(ROOT, 'out', 'release')
FONT = os.path.join(ROOT, 'node_modules', 'galmuri', 'dist')
C = {k: np.array(hex2rgba(v), dtype=np.uint8) for k, v in PAL.items() if v}


def mask(text, font, size, scale=1):
    f = ImageFont.truetype(os.path.join(FONT, font), size)
    m = f.getmask(text, mode='1')
    a = (np.array(m).reshape(m.size[1], m.size[0]) > 0)
    return np.kron(a, np.ones((scale, scale), dtype=bool)) if scale > 1 else a


def dilate(a, r, diag=True):
    out = a.copy()
    h, w = a.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if not diag and abs(dx) + abs(dy) > r:
                continue
            if dx == 0 and dy == 0:
                continue
            s = np.zeros_like(a)
            s[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
            out |= s
    return out


def pad(a, l, t, r, b):
    return np.pad(a, ((t, b), (l, r)))


def paint(img, m, col, ox=0, oy=0):
    h, w = m.shape
    region = img[oy:oy + h, ox:ox + w]
    region[m] = C[col]


def logo():
    """Native 136x58: chunky title with the tide rising up its letters, subtitle under it."""
    title = mask('물때 섬', 'Galmuri11-Bold.ttf', 12, 3)            # 33 x 123
    sub = mask('LOW TIDE ISLAND', 'Galmuri11-Bold.ttf', 12, 1)       # 11 x 112
    W, H = 136, 58
    img = np.zeros((H, W, 4), dtype=np.uint8)
    tx, ty = (W - title.shape[1]) // 2, 3
    T = np.zeros((H, W), dtype=bool)
    T[ty:ty + title.shape[0], tx:tx + title.shape[1]] = title
    out2 = dilate(T, 2)
    shadow = np.zeros_like(out2)
    shadow[2:, :] = out2[:-2, :]
    paint(img, shadow & ~out2, 'Q')
    paint(img, out2, 'o')
    # fill: sand on top, a wavy waterline across the lower third, sea below
    ys, xs = np.mgrid[0:H, 0:W]
    wl = ty + 22 + np.round(1.2 * np.sin(xs / 5.0)).astype(int)
    paint(img, T & (ys < wl - 7), 'y')
    paint(img, T & (ys >= wl - 7) & (ys < wl), 'Y')
    paint(img, T & (ys < ty + 3) , 'N')
    paint(img, T & (ys == wl), 't')
    paint(img, T & (ys > wl) & (ys <= wl + 4), 'p')
    paint(img, T & (ys > wl + 4), 'P')
    # little foam sparkles on the water inside the letters
    for x in range(tx + 3, tx + title.shape[1], 11):
        y = wl[0, x] + 3
        if T[y, x] and T[y, x + 1]:
            img[y, x] = C['t']
    # subtitle
    sx, sy = (W - sub.shape[1]) // 2, ty + title.shape[0] + 6
    S = np.zeros((H, W), dtype=bool)
    S[sy:sy + sub.shape[0], sx:sx + sub.shape[1]] = sub
    so = dilate(S, 1)
    ssh = np.zeros_like(so)
    ssh[1:, :] = so[:-1, :]
    paint(img, ssh & ~so, 'Q')
    paint(img, so, 'o')
    paint(img, S & (ys < sy + 6), 'C')
    paint(img, S & (ys >= sy + 6), 'A')
    return Image.fromarray(img, 'RGBA')


def atlas():
    sheet = Image.open(os.path.join(ASSETS, 'world.png')).convert('RGBA')
    fr = json.load(open(os.path.join(ROOT, 'src', 'data', 'atlas_world.json')))
    return lambda k: sheet.crop((fr[k][0], fr[k][1], fr[k][0] + fr[k][2], fr[k][1] + fr[k][3]))


def bayer(x, y):
    m = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    return m[y % 4][x % 4] / 16


def icon(N=32):
    """Native 32x32: the hero on a sand bar, the tide curling in right behind, the full sack on the back."""
    spr = atlas()
    img = Image.new('RGBA', (N, N))
    px = img.load()
    for y in range(N):
        for x in range(N):
            # waterline: a curl across the upper part, higher at the right
            wl = 15 + 2.2 * math.sin(x / 4.2 + 0.6) - x * 0.12
            if y < wl:
                d = (wl - y) / wl
                col = 'Q' if d > 0.55 + 0.12 * bayer(x, y) else 'q' if d > 0.22 + 0.15 * bayer(x, y) else 'P'
                if wl - y < 1.6:
                    col = 't'
                elif wl - y < 2.6 and (x + y) % 3 == 0:
                    col = 'p'
            else:
                d = (y - wl) / (N - wl)
                col = 'u' if d < 0.18 + 0.1 * bayer(x, y) else 'Y' if d < 0.5 + 0.2 * bayer(x, y) else 'y'
            px[x, y] = tuple(C[col])
    # foam flecks on the water
    for (x, y) in [(4, 4), (11, 2), (20, 6), (26, 3), (8, 8), (28, 9)]:
        px[x, y] = tuple(C['p'])
    sh = spr('shadow')
    img.alpha_composite(sh, (10, 27))
    sack = spr('sack3')
    img.alpha_composite(sack, (16, 11))
    hero = spr('p_down_idle0_happy')
    img.alpha_composite(hero, (8, 6))
    # a shell and a glass bead on the sand
    sh2 = spr('tinyshell')
    img.alpha_composite(sh2, (3, 26))
    img.alpha_composite(sh2, (26, 24))
    # rounded mask like an adaptive icon would crop: keep square; stores add their own mask
    return img


def race_frame():
    """a real frame of the first tide: the sea right behind the player (from the trailer capture), at native resolution"""
    seg = json.load(open(os.path.join(ROOT, '.cache', 'trailer', 'segments.json')))
    s = seg['run1b']
    t = next(e['t'] for e in seg['logs']['run1'] if e['k'] == 'sfx' and e['name'] == 'pick_glass') - s['start'] + 2.2
    f = min(s['frames'], key=lambda f: abs(f['t'] - t))
    im = Image.open(f['file']).convert('RGB')
    return im.resize((im.size[0] // 6, im.size[1] // 6), Image.NEAREST)  # 1080x1920 capture = 6x the 180x320 canvas


def feature():
    """1024x500 store feature graphic: logo, a small diorama of the grown island, and a real frame of a tide race.
    Built on a 512x250 grid shown at 2x; the logo sits at 3x."""
    spr = atlas()
    N = Image.new('RGBA', (512, 250))
    px = N.load()
    for y in range(250):
        for x in range(512):
            d = y / 250 + 0.08 * math.sin(x / 23.0)
            col = 'q' if d < 0.28 + 0.1 * bayer(x, y) else 'Q'
            if (y % 9 == 4 and (x + y * 3) % 23 < 5) or (y % 13 == 7 and (x * 2 + y) % 31 < 4):
                col = 'P' if col == 'q' else 'q'
            px[x, y] = tuple(C[col])
    # diorama island in the lower left
    cx, cy, rx, ry = 112, 218, 98, 26
    for y in range(180, 250):
        for x in range(0, 230):
            e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            g = ((x - cx) / (rx - 22)) ** 2 + ((y - cy + 8) / (ry - 10)) ** 2
            if e <= 1:
                col = 'y' if e < 0.55 + 0.15 * bayer(x, y) else 'Y' if e < 0.85 else 'u'
                if g <= 1:
                    col = 'V' if g < 0.7 + 0.2 * bayer(x, y) else 'z'
                px[x, y] = tuple(C[col])
            elif e <= 1.12:
                px[x, y] = tuple(C['t' if (x + y) % 5 else 'p'])
    for name, x, y in [('pine', 22, 186), ('b_cottage3', 40, 168), ('b_lighthouse2', 160, 148), ('decor_flowerbed', 98, 214),
                       ('decor_lantern', 136, 196), ('p_cheer0', 106, 192), ('sack4', 92, 200), ('decor_flag', 188, 196)]:
        N.alpha_composite(spr(name), (x, y))
    for name, x, y in [('item_shell', 70, 228), ('item_glass', 150, 230), ('item_shell', 196, 222)]:
        N.alpha_composite(spr(name), (x, y))
    # the race: a real frame, framed like a postcard
    rf = race_frame().crop((0, 40, 180, 254))
    fx, fy = 306, 16
    sh = Image.new('RGBA', (rf.size[0] + 8, rf.size[1] + 8), tuple(C['o'][:3]) + (110,))
    N.alpha_composite(sh, (fx - 1, fy + 3))
    frame = Image.new('RGBA', (rf.size[0] + 8, rf.size[1] + 8), tuple(C['o']))
    inner = Image.new('RGBA', (rf.size[0] + 4, rf.size[1] + 4), tuple(C['w']))
    frame.alpha_composite(inner, (2, 2))
    frame.paste(rf, (4, 4))
    N.alpha_composite(frame, (fx - 4, fy - 4))
    big = N.resize((1024, 500), Image.NEAREST)
    lg = logo()
    lg = lg.resize((lg.size[0] * 3, lg.size[1] * 3), Image.NEAREST)
    big.alpha_composite(lg, (44, 40))
    return big.convert('RGB')


def icon_safe(img, size):
    return img.resize((size, size), Image.NEAREST)


def main():
    os.makedirs(REL, exist_ok=True)
    lg = logo()
    lg.save(os.path.join(ASSETS, 'logo.png'), optimize=True)
    ic = icon()
    ic.save(os.path.join(ROOT, '.cache', 'icon-native.png'))
    icon_safe(ic, 512).save(os.path.join(ASSETS, 'icon-512.png'), optimize=True)
    icon_safe(ic, 192).save(os.path.join(ASSETS, 'icon-192.png'), optimize=True)
    icon_safe(ic, 512).convert('RGBA').save(os.path.join(REL, 'icon-512.png'), optimize=True)
    if os.path.exists(os.path.join(ROOT, '.cache', 'trailer', 'segments.json')):
        feature().save(os.path.join(REL, 'feature-1024x500.png'), optimize=True)
    print('logo', lg.size, 'icon', ic.size)


if __name__ == '__main__':
    main()
