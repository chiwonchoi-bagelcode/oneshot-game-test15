"""Store screenshots (1080x1920 PNG, 4 per language) from real captured frames with a headline banner.
Sources: trailer footage (.cache/trailer, .cache/trailer_en) and tools/qa/store-shots.mjs (.cache/store/<lang>).
python3 tools/release/screenshots.py"""
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.dirname(__file__) + '/../..')
OUT = os.path.join(ROOT, 'out', 'release', 'screenshots')
FONT_B = os.path.join(ROOT, 'node_modules', 'galmuri', 'dist', 'Galmuri11-Bold.ttf')
W, H = 1080, 1920

HEAD = {
    'pick': ('물이 빠지면,\n반짝이는 건 다 주워요', 'When the tide goes out,\ngrab what glitters'),
    'race': ('하나만 더?\n물이 발밑까지 따라와요', 'One more?\nThe tide is right behind you'),
    'swept': ('휩쓸려도 절반은 남고,\n이유를 알려 줘요', 'Swept away?\nKeep half, and see why'),
    'village': ('주워 온 것으로\n빈 섬을 마을로', 'Turn an empty island\ninto a village'),
}


def seg_frame(lang, seg, ev, off):
    d = os.path.join(ROOT, '.cache', 'trailer_en' if lang == 'en' else 'trailer')
    S = json.load(open(os.path.join(d, 'segments.json')))
    s = S[seg]
    log = S['logs']['run1']
    t_ev = next(e['t'] for e in log if e['k'] == 'sfx' and (e['name'] == ev or e['name'].startswith(ev + '_')) and e['t'] >= s['start'])
    t = t_ev - s['start'] + off
    best = min(s['frames'], key=lambda f: abs(f['t'] - t))
    return Image.open(best['file']).convert('RGB')


def nth_event_frame(lang, seg, ev, n, off):
    d = os.path.join(ROOT, '.cache', 'trailer_en' if lang == 'en' else 'trailer')
    S = json.load(open(os.path.join(d, 'segments.json')))
    s = S[seg]
    evs = [e['t'] for e in S['logs']['run1'] if e['k'] == 'sfx' and e['name'] == ev and e['t'] >= s['start']]
    t = evs[min(n, len(evs) - 1)] - s['start'] + off
    best = min(s['frames'], key=lambda f: abs(f['t'] - t))
    return Image.open(best['file']).convert('RGB')


def wrap(draw, text, font, max_w):
    words = text.split(' ')
    lines, cur = [], ''
    for w in words:
        nxt = (cur + ' ' + w).strip()
        if draw.textbbox((0, 0), nxt, font=font)[2] <= max_w or not cur:
            cur = nxt
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def banner(img, text):
    img = img.convert('RGBA')
    d0 = ImageDraw.Draw(img)
    # largest size at which every authored line fits on one line
    for size in (72, 66, 60, 56):
        font = ImageFont.truetype(FONT_B, size)
        lines = [l for part in text.split('\n') for l in wrap(d0, part, font, W - 100)]
        if len(lines) == len(text.split('\n')):
            break
    lh = 92
    bh = 70 + lh * len(lines) + 40
    over = Image.new('RGBA', (W, bh + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    d.rectangle((0, 0, W, bh), fill=(44, 99, 142, 240))
    d.rectangle((0, bh, W, bh + 12), fill=(43, 29, 20, 255))
    d.rectangle((0, bh - 8, W, bh), fill=(63, 141, 176, 255))
    for i, line in enumerate(lines):
        bb = d.textbbox((0, 0), line, font=font)
        x = (W - (bb[2] - bb[0])) // 2 - bb[0]
        y = 60 + i * lh - bb[1]
        for dx in range(-6, 7, 3):
            for dy in range(-6, 7, 3):
                d.text((x + dx, y + dy), line, font=font, fill=(43, 29, 20, 255))
        d.text((x, y + 6), line, font=font, fill=(43, 29, 20, 255))
        d.text((x, y), line, font=font, fill=(255, 246, 224, 255))
    img.alpha_composite(over, (0, 0))
    return img.convert('RGB')


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    for li, lang in enumerate(('ko', 'en')):
        src = {
            'pick': nth_event_frame(lang, 'run1a', 'pick_shell', 5, 0.12),
            'race': seg_frame(lang, 'run1b', 'pick_glass', 1.6),
            'swept': Image.open(os.path.join(ROOT, '.cache', 'store', lang, 'swept.png')).convert('RGB'),
            'village': Image.open(os.path.join(ROOT, '.cache', 'store', lang, 'village.png')).convert('RGB'),
        }
        for i, key in enumerate(('pick', 'race', 'swept', 'village'), 1):
            im = src[key]
            assert im.size == (W, H), (key, im.size)
            out = banner(im, HEAD[key][li])
            p = os.path.join(OUT, f'{lang}_{i:02d}_{key}.png')
            out.save(p, optimize=True)
            print(p, os.path.getsize(p))


if __name__ == '__main__':
    main()
