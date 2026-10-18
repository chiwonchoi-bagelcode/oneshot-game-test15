"""Build all sprite atlases into out/assets and frame metadata into src/data.
Run: python3 tools/art/build.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from pix import Atlas, PAL, hex2rgba
import chars, items, tiles, buildings, ui

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'out', 'assets')
DATA = os.path.join(ROOT, 'src', 'data')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, 'ui'), exist_ok=True)


def collect_world():
    fr = {}
    fr.update(chars.player_frames())
    fr.update(chars.sack_frames())
    fr.update(chars.villager_frames())
    fr.update(items.item_frames())
    fr.update(items.fx_frames())
    fr.update(items.glyph_frames())
    fr.update(tiles.tile_frames())
    fr.update(tiles.rocks())
    fr.update(tiles.boardwalk())
    fr.update(tiles.props())
    fr.update(buildings.building_frames())
    u = ui.ui_frames()
    for k in ('joy_ring', 'joy_knob', 'arrow_home'):
        fr[k] = u[k]
    return fr


def collect_ui():
    fr = ui.ui_frames()
    it = items.item_frames()
    for k, v in it.items():
        if k.startswith('item_'):
            fr['i_' + k[5:]] = v
    return fr


def structural_check(frames, tag):
    """Asset structure checks: size, transparent background, palette conformity, animation frame sizes."""
    allowed = {hex2rgba(v)[:3] for v in PAL.values() if v}
    problems = []
    groups = {}
    for name, img in frames.items():
        w, h = img.size
        if w == 0 or h == 0 or w > 128 or h > 128:
            problems.append(f'{name}: bad size {w}x{h}')
        px = img.load()
        off = 0
        opaque = 0
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                opaque += 1
                if a == 255 and (r, g, b) not in allowed:
                    off += 1
        if opaque == 0:
            problems.append(f'{name}: fully transparent')
        if off and not name.startswith(('shadow', 'fx_crash', 'fx_ring')):
            problems.append(f'{name}: {off} off-palette pixels')
        # tiles must be exactly 16x16; sprites must have a transparent background somewhere
        if name.startswith('t_') and (w, h) != (16, 16):
            problems.append(f'{name}: tile not 16x16')
        if not name.startswith(('t_', 'board_', 'panel_', 'btn_')) and opaque == w * h:
            problems.append(f'{name}: no transparent background')
        # animation groups must share frame size
        base = name.rstrip('0123456789')
        for part in ('_normal', '_happy', '_strain', '_panic', '_dazed', '_worried'):
            base = base.replace(part, '')
        import re
        key = re.sub(r'\d+', '#', name)
        groups.setdefault(key, set()).add((w, h))
    for key, sizes in groups.items():
        if len(sizes) > 1 and '#' in key and not key.startswith(('t_', 'sack', 'b_', 'rock', 'fx_petal', 'decor', 'pebble', 'tuft', 'flower', 'fx_sparkle')):
            problems.append(f'animation group {key} has mixed sizes {sizes}')
    print(f'[{tag}] {len(frames)} frames, {len(problems)} problems')
    for p in problems:
        print('   -', p)
    return problems


def main():
    world = collect_world()
    uifr = collect_ui()
    probs = structural_check(world, 'world') + structural_check(uifr, 'ui')
    a = Atlas(512)
    for k, v in world.items():
        a.add(k, v)
    sheet, placed = a.pack()
    sheet.save(os.path.join(OUT, 'world.png'), optimize=True)
    json.dump({k: list(v) for k, v in sorted(placed.items())}, open(os.path.join(DATA, 'atlas_world.json'), 'w'), separators=(',', ':'))
    # UI atlas: icons + items (DOM sprites)
    b = Atlas(256)
    for k, v in uifr.items():
        if k.startswith(('panel_', 'btn_')):
            v.save(os.path.join(OUT, 'ui', k + '.png'), optimize=True)
            continue
        b.add(k, v)
    sheet2, placed2 = b.pack()
    sheet2.save(os.path.join(OUT, 'ui.png'), optimize=True)
    json.dump({k: list(v) for k, v in sorted(placed2.items())}, open(os.path.join(DATA, 'atlas_ui.json'), 'w'), separators=(',', ':'))
    print('world atlas', sheet.size, 'ui atlas', sheet2.size)
    if probs:
        sys.exit(1)


if __name__ == '__main__':
    main()
