"""Contact sheet of a captured segment: one frame every `step` seconds, labelled with its time."""
import json, sys
from PIL import Image, ImageDraw
segs = json.load(open('.cache/trailer/segments.json'))
name, step, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
seg = segs[name] if not name.startswith('village') else segs['village'][int(name[7:])]
fr = seg['frames']
picks, t = [], 0.0
for f in fr:
    if f['t'] >= t:
        picks.append(f); t += step
w = 216; h = 384; cols = 8
rows = (len(picks) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h))
for i, f in enumerate(picks):
    im = Image.open(f['file']).resize((w, h))
    d = ImageDraw.Draw(im); d.rectangle((0, h - 16, 60, h), fill=(0, 0, 0)); d.text((3, h - 14), f"{f['t']:.1f}s", fill=(255, 255, 0))
    S.paste(im, ((i % cols) * w, (i // cols) * h))
S.save(out)
print(len(picks))
