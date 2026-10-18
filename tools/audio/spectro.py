"""Render spectrogram contact sheet for a list of rendered wavs (visual sanity check of the sound design)."""
import sys, os, wave, numpy as np
from PIL import Image, ImageDraw
from scipy import signal
names = sys.argv[1:]
tiles = []
for nm in names:
    w = wave.open(f'.cache/audio/{nm}.wav')
    x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768
    if w.getnchannels() == 2: x = x.reshape(-1, 2).mean(axis=1)
    f, t, S = signal.spectrogram(x, 44100, nperseg=1024, noverlap=768)
    S = 10 * np.log10(S + 1e-12)
    S = np.clip((S + 100) / 80, 0, 1)
    S = S[f < 12000][::-1]
    img = Image.fromarray((S * 255).astype('uint8')).resize((300, 160))
    d = ImageDraw.Draw(img); d.text((4, 4), nm, fill=255)
    tiles.append(img)
cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('L', (cols * 300, rows * 160))
for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * 300, (i // cols) * 160))
sheet.save('/tmp/claude-0/spectro.png')
