"""Checks out/ against the delivery spec. python3 tools/release/speccheck.py"""
import glob, json, os, subprocess
from PIL import Image
R = os.path.join(os.path.dirname(__file__), '..', '..', 'out')
ok = True


def check(cond, msg):
    global ok
    print(('OK   ' if cond else 'FAIL ') + msg)
    ok = ok and cond


check(os.path.isfile(f'{R}/index.html'), 'out/index.html (game entry)')
store = sorted(glob.glob(f'{R}/release/store/*.md'))
check(len(store) == 2 and {os.path.basename(p) for p in store} == {'ko.md', 'en.md'}, f'release/store/*.md: {[os.path.basename(p) for p in store]}')
im = Image.open(f'{R}/release/icon-512.png')
check(im.size == (512, 512), f'icon-512.png {im.size}')
im = Image.open(f'{R}/release/feature-1024x500.png')
check(im.size == (1024, 500) and im.mode == 'RGB', f'feature-1024x500.png {im.size} {im.mode}')
shots = sorted(glob.glob(f'{R}/release/screenshots/*.png'))
dims = {Image.open(p).size for p in shots}
check(1 <= len(shots) <= 8, f'screenshots: {len(shots)} files, sizes {dims}')
v = f'{R}/release/trailer.mp4'
j = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,format_name:stream=codec_name,codec_type', '-of', 'json', v]))
dur, size = float(j['format']['duration']), int(j['format']['size'])
vc = [s['codec_name'] for s in j['streams'] if s['codec_type'] == 'video']
check('mp4' in j['format']['format_name'] and vc == ['h264'], f"trailer.mp4 container {j['format']['format_name']}, video {vc}")
check(size <= 20_000_000, f'trailer.mp4 size {size:,} bytes (<= 20,000,000)')
check(dur <= 30.0, f'trailer.mp4 duration {dur:.2f}s (<= 30.0)')
subs = sorted(glob.glob(f'{R}/release/subtitles/*'))
names = [os.path.basename(p) for p in subs]
check(2 <= len(subs) <= 4 and all(n.endswith(('.vtt', '.srt')) for n in names) and any('.ko.' in n for n in names) and any('.en.' in n for n in names), f'subtitles: {names}')
for f in ['plan.md', 'report.md', 'index.html']:
    check(os.path.isfile(f'{R}/release/{f}'), f'release/{f}')
print('ALL OK' if ok else 'SOME CHECKS FAILED')
