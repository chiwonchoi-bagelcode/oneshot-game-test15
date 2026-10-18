"""Colour-vision check: simulate protanopia / deuteranopia / tritanopia (Machado et al. 2009, severity 1.0)
on a real gameplay frame, and report the lightness (CIE L*) gaps between the surfaces a player must tell apart.
python3 tools/qa/cvd.py <frame.png|jpg> <out.jpg>"""
import sys
import numpy as np
from PIL import Image
sys.path.insert(0, 'tools/art')
from pix import PAL

M = {
    'protanopia': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deuteranopia': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritanopia': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def unlin(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


def sim(rgb, kind):
    if kind == 'normal':
        return rgb.astype(float)
    return unlin(lin(rgb.astype(float)) @ np.array(M[kind]).T)


def Lstar(rgb):
    l = lin(np.asarray(rgb, float))
    Y = l[..., 0] * 0.2126 + l[..., 1] * 0.7152 + l[..., 2] * 0.0722
    return np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)


def hexrgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


SURF = {'deep sea': PAL['Q'], 'sea': PAL['q'], 'shallow': PAL['P'], 'foam': PAL['t'], 'wet sand': PAL['u'], 'dry sand': PAL['y'],
        'mud': PAL['D'], 'grass': PAL['V']}
pairs = [('shallow', 'wet sand'), ('sea', 'dry sand'), ('foam', 'wet sand'), ('wet sand', 'dry sand'), ('mud', 'wet sand'), ('mud', 'sea'), ('grass', 'dry sand')]
print('lightness gap (L*) between surfaces; colour-blind simulations change hue, so lightness is what still separates them')
print('pair'.ljust(24) + ''.join(k.rjust(14) for k in ['normal'] + list(M)))
for a, b in pairs:
    row = []
    for kind in ['normal'] + list(M):
        ca, cb = sim(np.array([hexrgb(SURF[a])]), kind), sim(np.array([hexrgb(SURF[b])]), kind)
        row.append(abs(float(Lstar(ca)[0]) - float(Lstar(cb)[0])))
    print(f'{a} / {b}'.ljust(24) + ''.join(f'{v:14.1f}' for v in row))
if len(sys.argv) > 2:
    im = np.array(Image.open(sys.argv[1]).convert('RGB').resize((270, 480), Image.NEAREST))
    tiles = [Image.fromarray(np.uint8(np.clip(sim(im.reshape(-1, 3), k).reshape(im.shape), 0, 255))) for k in ['normal'] + list(M)]
    sheet = Image.new('RGB', (275 * len(tiles), 480), 'white')
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * 275, 0))
    sheet.save(sys.argv[2], quality=88)
