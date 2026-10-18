"""Tiny pixel-art toolkit: palette, ASCII sprite parsing, compositing, outlines, atlas packing."""
from PIL import Image
import json, math, random

# ---- Palette (shared by every sprite, tile, icon and UI piece) ----
PAL = {
    '.': None,
    'o': '#2b1d14',  # outline (dark brown, never pure black)
    'O': '#4a3022',  # soft outline
    # straw hat
    'a': '#ffe08a', 'A': '#f2c45a', 'c': '#c99633',
    'r': '#e0574a', 'R': '#b33c33',
    # hair / skin / face
    'H': '#5a3a26', 'h': '#7a5236',
    's': '#ffd7b0', 'S': '#eaa983',
    'e': '#2b1d14', 'E': '#ffffff', 'k': '#f59a8a', 'm': '#a8463c',
    # clothes
    'w': '#f4efe4', 'W': '#d4c9b4',
    'b': '#4a7fb8', 'B': '#335a8a', 'l': '#6fa8dc', 'n': '#ffd75e',
    'f': '#6b4129', 'F': '#4a2c1c',
    # sack
    'g': '#e2c48a', 'G': '#bf9a5e', 'j': '#94703f', 'J': '#6b4a2a',
    # wood
    '1': '#e3ad72', '2': '#bf8048', '3': '#8f5a32', '4': '#5e3820',
    # stone
    '5': '#d6d0c2', '6': '#a8a196', '7': '#79736a', '8': '#524d46',
    # sand / mud / grass
    'y': '#f8e6b8', 'Y': '#ecd09a', 'u': '#d9b47a', 'U': '#b8905a',
    'd': '#9b8468', 'D': '#7c6750', 'x': '#5f4d3b', 'X': '#47392b',
    'v': '#b4d968', 'V': '#86bd48', 'z': '#5b9638', 'Z': '#3c6d2c',
    # water
    'p': '#9fe2dc', 'P': '#62bccb', 'q': '#3f8db0', 'Q': '#2c638e', 't': '#f4fffb',
    # shell pink, glass teal, pearl, gold, rope
    'i': '#fff1ec', 'I': '#f7c0b4', 'K': '#d98d86',
    'T': '#a9f2dc', 'L': '#5fd0b2', 'M': '#2f9c86',
    'N': '#ffffff', '9': '#e6e0f2', '0': '#b7acd0',
    'C': '#ffe16a', 'G2': '#d9a52b',
    'g2': '#a8741c',
    # roofs & accents
    '!': '#d65a4a', '@': '#a83f36', '#': '#74302a',
    '$': '#6a94d4', '%': '#4a6fb0', '&': '#36508a',
    '*': '#fff6c8',  # warm light
    '+': '#ff9f45', '=': '#e06a2c',  # orange (starfish, lantern)
    '-': '#9a6ad0', '~': '#6f48a8',  # purple accents
    '?': '#7fd36e', '/': '#4ea64a',  # bright green (positive)
}
# multi-char keys are not usable in ASCII grids; expose by name
NAMED = {
    'gold': '#ffd75e', 'gold2': '#d9a52b', 'gold3': '#a8741c',
}


def hex2rgba(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def parse(rows, pal=None, w=None):
    """ASCII rows -> RGBA image. Each char is a palette key."""
    pal = pal or PAL
    h = len(rows)
    w = w or max(len(r) for r in rows)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        if len(row) != w:
            raise ValueError(f'row {y} has length {len(row)} != {w}: {row!r}')
        for x, ch in enumerate(row):
            col = pal.get(ch, 'MISSING')
            if col == 'MISSING':
                raise ValueError(f'unknown palette key {ch!r} in row {y}: {row!r}')
            if col is not None:
                px[x, y] = hex2rgba(col)
    return img


def sym(half_rows):
    """Mirror left-half rows to build symmetric sprites."""
    return [r + r[::-1] for r in half_rows]


def blank(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def paste(dst, src, x, y):
    dst.alpha_composite(src, (x, y))
    return dst


def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def outline(img, color='#2b1d14', diag=False):
    """Add 1px outline around opaque pixels (outside only)."""
    w, h = img.size
    src = img.load()
    out = img.copy()
    o = out.load()
    c = hex2rgba(color)
    for y in range(h):
        for x in range(w):
            if src[x, y][3] > 0:
                continue
            nb = [(1, 0), (-1, 0), (0, 1), (0, -1)]
            if diag:
                nb += [(1, 1), (-1, -1), (1, -1), (-1, 1)]
            for dx, dy in nb:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 0:
                    o[x, y] = c
                    break
    return out


def tint(img, rgb, amount):
    """Blend opaque pixels toward rgb."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (int(r + (rgb[0] - r) * amount), int(g + (rgb[1] - g) * amount), int(b + (rgb[2] - b) * amount), a)
    return out


def silhouette(img, color):
    out = img.copy()
    px = out.load()
    c = hex2rgba(color)
    w, h = out.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                px[x, y] = c
    return out


class Atlas:
    """Shelf packer. Frames keep 1px transparent padding to avoid bleeding."""

    def __init__(self, width=512, pad=1):
        self.width = width
        self.pad = pad
        self.items = []  # (name, img)

    def add(self, name, img):
        self.items.append((name, img))

    def pack(self):
        items = sorted(self.items, key=lambda t: (-t[1].size[1], -t[1].size[0]))
        x = y = 0
        shelf_h = 0
        placed = {}
        for name, img in items:
            w, h = img.size
            if x + w + self.pad * 2 > self.width:
                x = 0
                y += shelf_h
                shelf_h = 0
            placed[name] = (x + self.pad, y + self.pad, w, h)
            x += w + self.pad * 2
            shelf_h = max(shelf_h, h + self.pad * 2)
        total_h = y + shelf_h
        hh = 1
        while hh < total_h:
            hh *= 2
        sheet = Image.new('RGBA', (self.width, hh), (0, 0, 0, 0))
        lookup = dict(self.items)
        for name, (px, py, w, h) in placed.items():
            sheet.alpha_composite(lookup[name], (px, py))
        return sheet, placed


def preview(images, scale=6, cols=8, bg=(60, 70, 80, 255), label=False):
    """Contact sheet for visual review."""
    cw = max(i.size[0] for i in images) * scale + 8
    ch = max(i.size[1] for i in images) * scale + 8
    rows = math.ceil(len(images) / cols)
    sheet = Image.new('RGBA', (cw * cols, ch * rows), bg)
    for n, img in enumerate(images):
        big = img.resize((img.size[0] * scale, img.size[1] * scale), Image.NEAREST)
        sheet.alpha_composite(big, ((n % cols) * cw + 4, (n // cols) * ch + 4))
    return sheet
