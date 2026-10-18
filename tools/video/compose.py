"""Assemble the trailer from captured real gameplay: cuts, dissolves, end card, captions, mixed audio.
Outputs (out/release): trailer.mp4 (soft ko/en subtitles), video/trailer_ko.mp4, video/trailer_en.mp4 (burned-in),
subtitles/trailer.ko.vtt|srt, trailer.en.vtt|srt."""
import json, os, sys, subprocess, wave, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.dirname(__file__) + '/../..')
WORK = os.path.join(ROOT, '.cache', 'trailer', 'compose')
REL = os.path.join(ROOT, 'out', 'release')
FPS = 30
W, H = 1080, 1920
SR = 44100
FONT_B = os.path.join(ROOT, 'node_modules', 'galmuri', 'dist', 'Galmuri11-Bold.ttf')
FONT = os.path.join(ROOT, 'node_modules', 'galmuri', 'dist', 'Galmuri11.ttf')
CAP_Y = 236  # caption top (px): just under the HUD, above the play area and every panel

# Clips cut from the captured segments. Times are seconds in the segment, or (event, offset) anchored to the
# first logged sound event of that name inside the segment, so both language captures cut at the same moments.
CLIPS = [
    ('A', 'run1a', 0.1, ('pick_wood', 1.0)),         # tide goes out, chain-picking shells, the bag gets heavy
    ('C1', 'run1b', ('tide_turn', -1.0), ('pick_glass', 0.35)),  # the tide turns: one more?
    ('C2', 'run1b', ('pick_glass', 0.35), ('arrive', 2.6)),    # race home, near miss, harvest pours out
    ('D', 'run1c', 0.2, 1.5),                           # results
    ('E', 'build', 0.0, 3.8),                           # the boardwalk is built
    ('F', 'run2', 0.75, 3.75),                          # next tide: across the creek on the new boardwalk
    ('G0', 'village0', 0.3, 0.95),
    ('G1', 'village1', 0.3, 0.95),
    ('G2', 'village2', 0.3, 0.95),
    ('G3', 'village3', 0.3, 3.3),
]
DISSOLVE = 0.25  # seconds, between village stages
# (from, to) as (clip, offset from clip start; negative = from clip end) or (clip, 'event', offset)
CAPTIONS = [
    (('A', 0.1), ('A', 'pick_shell', -0.15), '물이 빠졌다!', 'The tide is out!'),
    (('A', 'pick_shell', -0.05), ('A', 'bag_heavy', -0.3), '반짝이는 건 다 주워', 'Grab everything that glitters'),
    (('A', 'bag_heavy', -0.2), ('A', -0.05), '담을수록 무거워지고', 'A full bag slows you down'),
    (('C1', 0.1), ('C1', -0.05), '하나만 더…?', 'Just one more…?'),
    (('C2', 0.05), ('C2', 'arrive', -0.25), '물이 들어온다, 뛰어!', "Tide's coming. Run!"),
    (('C2', 'arrive', -0.1), ('C2', -0.05), '휴, 살았다!', 'Phew, made it!'),
    (('D', 0.15), ('E', -0.1), '주워 온 것으로 섬을 짓고', 'Build with what you bring back'),
    (('F', 0.1), ('F', -0.05), '못 가던 곳까지 닿는다', "Reach places you couldn't before"),
    (('G0', 0.05), ('G3', 0.4), '빈 섬이 마을이 될 때까지', 'Until the empty island is a village'),
]
END_CARD = 2.3  # seconds at the end (over the last village shot)


def load(lang):
    d = os.path.join(ROOT, '.cache', 'trailer_en' if lang == 'en' else 'trailer')
    return json.load(open(os.path.join(d, 'segments.json')))


def seg(S, name):
    if name.startswith('village'):
        return S['village'][int(name[7:])]
    return S[name]


LOGOF = {'run1a': 'run1', 'run1b': 'run1', 'run1c': 'run1', 'build': 'build', 'run2': 'run2'}


def ev_time(S, name, ev):
    """first logged sound event `ev` inside segment `name`, in segment time"""
    s = seg(S, name)
    end = s['start'] + s['frames'][-1]['t']
    for e in S['logs'][LOGOF[name]]:
        if e['k'] == 'sfx' and (e['name'] == ev or e['name'].startswith(ev + '_')) and s['start'] <= e['t'] <= end:
            return e['t'] - s['start']
    raise SystemExit(f'event {ev} not found in {name}')


def at(S, name, spec):
    if isinstance(spec, (int, float)):
        return float(spec)
    return ev_time(S, name, spec[0]) + spec[1]


def pick(frames, t):
    lo, hi = 0, len(frames) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if frames[mid]['t'] <= t:
            lo = mid
        else:
            hi = mid - 1
    return frames[lo]['file']


def build_timeline(S):
    """frames: per output frame a list of source files (two during a dissolve); place: clip placements"""
    out = []
    place = {}  # key -> (segment, seg_t0, seg_t1, trailer_start)
    order = []
    T = 0.0
    for ci, (key, name, a, b) in enumerate(CLIPS):
        fr = seg(S, name)['frames']
        a, b = at(S, name, a), at(S, name, b)
        start = T
        if name.startswith('village') and ci > 0 and CLIPS[ci - 1][1].startswith('village'):
            start = T - DISSOLVE
        n = int(round((b - a) * FPS))
        for i in range(n):
            out.append((start + i / FPS, pick(fr, a + i / FPS)))
        place[key] = (name, a, b, start)
        order.append(key)
        T = start + (b - a)
    by_slot = {}
    for t, f in sorted(out, key=lambda x: x[0]):
        by_slot.setdefault(int(round(t * FPS)), []).append(f)
    nframes = int(round(T * FPS))
    frames = [by_slot.get(k) or by_slot.get(k - 1) or by_slot.get(k + 1) for k in range(nframes)]
    return frames, place, order, T


def cap_times(S, place):
    def tt(spec):
        key = spec[0]
        name, a, b, start = place[key]
        if len(spec) == 3:
            return start + (ev_time(S, name, spec[1]) - a) + spec[2]
        off = spec[1]
        return start + off if off >= 0 else start + (b - a) + off
    return [(tt(f), tt(t), ko, en) for (f, t, ko, en) in CAPTIONS]


def caption_img(text, lang, size=64, max_w=980):
    """chunky outlined pixel caption; wraps to two balanced lines when it would not fit"""
    font = ImageFont.truetype(FONT_B, size)
    pad = 26
    d0 = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    width = lambda t: d0.textbbox((0, 0), t, font=font)[2] - d0.textbbox((0, 0), t, font=font)[0]
    lines = [text]
    if width(text) > max_w and ' ' in text:
        words = text.split(' ')
        best = None
        for i in range(1, len(words)):
            a, b = ' '.join(words[:i]), ' '.join(words[i:])
            m = max(width(a), width(b))
            if best is None or m < best[0]:
                best = (m, [a, b])
        lines = best[1]
    lh = size + 18
    tw = max(width(l) for l in lines)
    img = Image.new('RGBA', (tw + pad * 2 + 12, lh * len(lines) - 18 + size // 4 + pad * 2 + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for li, line in enumerate(lines):
        bb = d.textbbox((0, 0), line, font=font)
        x = pad + 6 + (tw - (bb[2] - bb[0])) // 2 - bb[0]
        y = pad + 6 + li * lh - bb[1] + (0 if li == 0 else 0)
        for dx in range(-6, 7, 3):
            for dy in range(-6, 7, 3):
                d.text((x + dx, y + dy), line, font=font, fill=(43, 29, 20, 255))
        d.text((x, y), line, font=font, fill=(255, 246, 224, 255))
    return img


def end_card(lang):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), fill=(20, 40, 60, 128))
    logo = Image.open(os.path.join(ROOT, 'out', 'assets', 'logo.png')).convert('RGBA')
    k = 6  # integer scale keeps the pixels square: 136 x 58 -> 816 x 348
    logo = logo.resize((logo.size[0] * k, logo.size[1] * k), Image.NEAREST)
    y = 600
    img.alpha_composite(logo, ((W - logo.size[0]) // 2, y))
    sub = '한 손으로, 물이 차기 전에.' if lang == 'ko' else 'One thumb. Back before the tide.'
    cap = caption_img(sub, lang, 52)
    img.alpha_composite(cap, ((W - cap.size[0]) // 2, y + logo.size[1] + 36))
    return img


def render_frames(frames, caps, lang, outdir):
    os.makedirs(outdir, exist_ok=True)
    imgs = [(a, b, caption_img(ko if lang == 'ko' else en, lang)) for (a, b, ko, en) in caps] if lang else []
    ec = end_card(lang or 'ko')
    total = len(frames) / FPS
    for k, fs in enumerate(frames):
        t = k / FPS
        if len(fs) == 1:
            im = Image.open(fs[0]).convert('RGB')
        else:
            a = Image.open(fs[0]).convert('RGB'); b = Image.open(fs[-1]).convert('RGB')
            im = Image.blend(a, b, 0.5)
        if im.size != (W, H):
            im = im.resize((W, H), Image.LANCZOS)
        im = im.convert('RGBA')
        for (a, b, c) in imgs:
            if a <= t <= b:
                fade = min(1, (t - a) / 0.12, (b - t) / 0.12)
                cc = c.copy()
                if fade < 1:
                    cc.putalpha(cc.split()[3].point(lambda v: int(v * fade)))
                im.alpha_composite(cc, ((W - c.size[0]) // 2, CAP_Y))
        if t >= total - END_CARD:
            f = min(1, (t - (total - END_CARD)) / 0.35)
            e = ec.copy()
            e.putalpha(e.split()[3].point(lambda v: int(v * f)))
            im.alpha_composite(e)
        im.convert('RGB').save(os.path.join(outdir, f'{k:05d}.jpg'), quality=93)


def read_wav(path):
    w = wave.open(path)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
    ch = w.getnchannels()
    x = x.reshape(-1, ch).T
    if ch == 1:
        x = np.vstack([x[0], x[0]])
    return x


def mix_audio(S, place, total, path):
    A = os.path.join(ROOT, '.cache', 'audio')
    N = int(total * SR) + SR
    mix = np.zeros((2, N), np.float32)
    cache = {}

    def snd(name):
        if name not in cache:
            p = os.path.join(A, name + '.wav')
            cache[name] = read_wav(p) if os.path.exists(p) else None
        return cache[name]

    def add(x, at, gain, rate=1.0):
        if x is None:
            return
        if abs(rate - 1) > 1e-3:
            n = int(x.shape[1] / rate)
            idx = np.clip((np.arange(n) * rate).astype(int), 0, x.shape[1] - 1)
            x = x[:, idx]
        i0 = int(at * SR)
        if i0 >= N:
            return
        n = min(x.shape[1], N - i0)
        mix[:, i0:i0 + n] += x[:, :n] * gain

    def bed(x, a, b, g, fade=0.6):
        n = int((b - a) * SR)
        y = np.tile(x, (1, int(np.ceil(n / x.shape[1])) + 1))[:, :n].copy()
        env = np.ones(n, np.float32)
        f = int(fade * SR)
        env[:f] = np.linspace(0, 1, f); env[-f:] = np.linspace(1, 0, f)
        add(y * env, a, g)

    # music bed: run music until the results, island music after (as in the game)
    run_end = place['D'][3]
    base, tens, isl = snd('run_base'), snd('run_tension'), snd('island')
    bed(base, 0, run_end + 0.4, 0.36)
    # tension layer swells while the tide comes back, drops at the arrival
    nT = int((run_end + 0.4) * SR)
    ty = np.tile(tens, (1, int(np.ceil(nT / tens.shape[1])) + 1))[:, :nT].copy()
    tt = np.arange(nT) / SR
    c1, c2 = place['C1'], place['C2']
    arrive_t = c2[3] + ev_time(S, 'run1b', 'arrive') - c2[1]
    env = np.clip((tt - c1[3]) / 1.2, 0, 1) * np.clip((arrive_t + 0.4 - tt) / 0.5, 0, 1)
    add(ty * env, 0, 0.42)
    bed(isl, run_end - 0.3, total, 0.38, fade=0.8)
    # sound effects from the real event logs, at the moments they happened
    for key, (name, a, b, start) in place.items():
        if name not in LOGOF:
            continue
        s = seg(S, name)
        a_abs, b_abs = s['start'] + a, s['start'] + b
        for e in S['logs'][LOGOF[name]]:
            if e['k'] != 'sfx' or not (a_abs <= e['t'] < b_abs):
                continue
            if e['name'] == 'heartbeat' and e['vol'] < 0.3:
                continue
            add(snd(e['name']), start + (e['t'] - a_abs), 0.9 * e['vol'] * 0.85, e['rate'])
    wv = snd('waves')
    if wv is not None:
        bed(wv, 0, total, 0.22, fade=0.5)
    add(snd('fanfare'), total - END_CARD + 0.1, 0.55)
    # master: normalise and a gentle soft clip
    pk = np.max(np.abs(mix)) + 1e-9
    mix = mix / pk * 0.97
    mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.92
    data = (np.clip(mix[:, :int(total * SR)].T, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())


def write_subs(lang, caps, total):
    os.makedirs(os.path.join(REL, 'subtitles'), exist_ok=True)

    def ts(t, sep):
        h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
        return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', sep)
    vtt = ['WEBVTT', '']
    srt = []
    rows = [(a, b, ko if lang == 'ko' else en) for (a, b, ko, en) in caps]
    rows.append((total - END_CARD + 0.2, total - 0.05, '물때 섬 — 한 손으로, 물이 차기 전에.' if lang == 'ko' else 'Low Tide Island — One thumb. Back before the tide.'))
    for i, (a, b, txt) in enumerate(rows, 1):
        # VTT cue placed near the top, where the burned-in captions sit (keeps the play area clear)
        vtt += [f'{ts(a, ".")} --> {ts(b, ".")} line:12% align:center', txt, '']
        srt += [str(i), f'{ts(a, ",")} --> {ts(b, ",")}', txt, '']
    open(os.path.join(REL, 'subtitles', f'trailer.{lang}.vtt'), 'w').write('\n'.join(vtt))
    open(os.path.join(REL, 'subtitles', f'trailer.{lang}.srt'), 'w').write('\n'.join(srt))


def encode(frames_dir, wav, out, subs=None, crf=21):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames_dir, '%05d.jpg'), '-i', wav]
    maps = ['-map', '0:v', '-map', '1:a']
    if subs:
        for i, (p, lang) in enumerate(subs):
            cmd += ['-i', p]
            maps += ['-map', f'{i + 2}:s']
    cmd += maps + ['-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', str(crf),
                   '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', '-shortest']
    if subs:
        cmd += ['-c:s', 'mov_text']
        for i, (p, lang) in enumerate(subs):
            cmd += [f'-metadata:s:s:{i}', f'language={"kor" if lang == "ko" else "eng"}', f'-metadata:s:s:{i}', f'title={"한국어" if lang == "ko" else "English"}']
        cmd += ['-disposition:s:0', 'default']
    cmd.append(out)
    subprocess.run(cmd, check=True)


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(os.path.join(REL, 'video'), exist_ok=True)
    built = {}
    for lang in ('ko', 'en'):
        if only and lang != {'clean': 'ko'}.get(only, only) and lang != 'ko':
            continue
        S = load(lang)
        frames, place, order, total = build_timeline(S)
        caps = cap_times(S, place)
        print(f'[{lang}] timeline {total:.2f}s, {len(frames)} frames; clips ' + ' '.join(f'{k}@{place[k][3]:.2f}' for k in order))
        for a, b, ko, en in caps:
            print(f'   {a:5.2f}-{b:5.2f} {ko if lang == "ko" else en}')
        assert total <= 30.0, 'trailer too long'
        wav = os.path.join(WORK, f'mix_{lang}.wav')
        mix_audio(S, place, total, wav)
        built[lang] = (frames, caps, wav, total)
    # the subtitle files go with trailer.mp4 (the Korean-footage cut), so both languages use its timing
    for lang in ('ko', 'en'):
        write_subs(lang, built['ko'][1], built['ko'][3])
    # the main trailer is the Korean cut with soft ko/en subtitle tracks; each language also gets a burned-in cut
    variants = [('clean', 'ko', None, os.path.join(REL, 'trailer.mp4')),
                ('ko', 'ko', 'ko', os.path.join(REL, 'video', 'trailer_ko.mp4')),
                ('en', 'en', 'en', os.path.join(REL, 'video', 'trailer_en.mp4'))]
    for tag, src, cap_lang, out in variants:
        if (only and tag != only) or src not in built:
            continue
        frames, caps, wav, total = built[src]
        d = os.path.join(WORK, f'frames_{tag}')
        shutil.rmtree(d, ignore_errors=True)
        render_frames(frames, caps, cap_lang, d)
        subs = [(os.path.join(REL, 'subtitles', 'trailer.ko.srt'), 'ko'), (os.path.join(REL, 'subtitles', 'trailer.en.srt'), 'en')] if tag == 'clean' else None
        encode(d, wav, out, subs)
        # poster for players: the end card of this cut
        poster = os.path.join(REL, 'video', f'poster_{tag}.jpg')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{total - 0.6:.2f}', '-i', out, '-frames:v', '1', '-vf', 'scale=540:960', '-q:v', '4', poster], check=True)
        print(out, os.path.getsize(out))


if __name__ == '__main__':
    main()
