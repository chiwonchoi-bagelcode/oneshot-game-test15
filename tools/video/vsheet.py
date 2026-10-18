"""Contact sheet of a rendered video: one frame every `step` seconds between t0 and t1, labelled with its time.
python3 tools/video/vsheet.py video.mp4 t0 t1 step out.jpg"""
import subprocess, sys, os, tempfile
from PIL import Image, ImageDraw
src, t0, t1, step, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
w, h, cols = 216, 384, 8
tmp = tempfile.mkdtemp()
times = []
t = t0
while t <= t1 + 1e-6:
    times.append(round(t, 2)); t += step
ims = []
for i, t in enumerate(times):
    p = os.path.join(tmp, f'{i}.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', src, '-frames:v', '1', '-y', p], check=True)
    if os.path.exists(p):
        im = Image.open(p).convert('RGB').resize((w, h))
        d = ImageDraw.Draw(im); d.rectangle((0, h - 16, 52, h), fill=(0, 0, 0)); d.text((3, h - 14), f'{t:.1f}s', fill=(255, 255, 0))
        ims.append(im)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h))
for i, im in enumerate(ims):
    S.paste(im, ((i % cols) * w, (i // cols) * h))
S.save(out, quality=85)
print(len(ims), 'frames')
