"""Subset Galmuri fonts to the characters the game actually uses and emit an inline @font-face CSS."""
import json, glob, os, base64, sys, io
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
chars = set(chr(c) for c in range(32, 127))
chars |= set('·…→←↑↓×—–‘’“”★☆①②③°%')
for f in glob.glob(os.path.join(ROOT, 'src', 'data', 'i18n', '*.json')):
    for v in json.load(open(f)).values():
        chars |= set(str(v))
chars |= set('한국어English')
text = ''.join(sorted(chars))
out_css = []
for fam, fn in (('Galmuri11', 'Galmuri11.ttf'), ('Galmuri11B', 'Galmuri11-Bold.ttf')):
    src = os.path.join(ROOT, 'node_modules', 'galmuri', 'dist', fn)
    font = TTFont(src)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    data = buf.getvalue()
    out_css.append("@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2');font-display:block;}" % (fam, base64.b64encode(data).decode()))
    print(fam, len(data), 'bytes,', len(text), 'chars', file=sys.stderr)
os.makedirs(os.path.join(ROOT, '.cache'), exist_ok=True)
open(os.path.join(ROOT, '.cache', 'fonts.css'), 'w').write('\n'.join(out_css))
