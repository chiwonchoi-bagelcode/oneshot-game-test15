"""Assemble the trailer from captured real gameplay: cuts, dissolves, end card, captions, mixed audio.
Outputs (out/release): trailer.mp4 (soft ko/en subtitles), video/trailer_ko.mp4, video/trailer_en.mp4 (burned-in),
subtitles/trailer.ko.vtt|srt, trailer.en.vtt|srt."""
import json, os, sys, subprocess, wave, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SEG = json.load(open(os.path.join(ROOT, '.cache', 'trailer', 'segments.json')))
WORK = os.path.join(ROOT, '.cache', 'trailer', 'compose')
REL = os.path.join(ROOT, 'out', 'release')
FPS = 30
W, H = 1080, 1920
SR = 44100
FONT_B = os.path.join(ROOT, 'node_modules', 'galmuri', 'dist', 'Galmuri11-Bold.ttf')
FONT = os.path.join(ROOT, 'node_modules', 'galmuri', 'dist', 'Galmuri11.ttf')

# (segment, t0, t1) in the segment's own time; village stages get dissolves
CLIPS = [
    ('run1a', 0.25, 6.15),
    ('run1a', 6.9, 9.0),
    ('run1b', 3.0, 7.3),
    ('run1b', 7.3, 11.6),
    ('run1c', 0.25, 1.45),
    ('build', 0.0, 3.9),
    ('run2', 0.75, 4.0),
    ('village0', 0.3, 0.95),
    ('village1', 0.3, 0.95),
    ('village2', 0.3, 0.95),
    ('village3', 0.3, 3.3),
]
DISSOLVE = 0.25  # seconds, between village stages
CAPTIONS = [  # trailer time (s), ko, en
    (0.35, 2.6, '물이 빠졌다!', 'The tide is out!'),
    (2.75, 5.85, '반짝이는 갯벌을 줍고', 'Grab what glitters'),
    (6.0, 8.0, '하나만 더…?', 'Just one more…?'),
    (8.2, 10.3, '물이 들어온다!', 'Here comes the tide!'),
    (10.4, 12.3, '빨리 돌아가!', 'Run back!'),
    (12.6, 15.0, '휴, 아슬아슬!', 'Phew, just made it!'),
    (16.6, 20.3, '주워 온 것으로 섬을 짓고', 'Build your island from what you bring back'),
    (20.6, 23.6, '지난번엔 못 가던 곳으로', "Reach places you couldn't before"),
    (23.8, 26.4, '빈 섬이 마을이 될 때까지', 'Until the empty island becomes a village'),
]
END_CARD = 2.3  # seconds at the end (over the last village shot)


def seg(name):
    if name.startswith('village'):
        return SEG['village'][int(name[7:])]
    return SEG[name]


def pick(frames, t):
    lo, hi = 0, len(frames) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if frames[mid]['t'] <= t:
            lo = mid
        else:
            hi = mid - 1
    return frames[lo]['file']


def build_timeline():
    """returns list of (trailer_time, file or (fileA, fileB, k)), and clip placements for audio"""
    out = []
    place = []  # (segment, seg_t0, seg_t1, trailer_start)
    T = 0.0
    for ci, (name, a, b) in enumerate(CLIPS):
        s = seg(name)
        fr = s['frames']
        dur = b - a
        start = T
        if name.startswith('village') and ci > 0 and CLIPS[ci - 1][0].startswith('village'):
            start = T - DISSOLVE
        n = int(round(dur * FPS))
        for i in range(n):
            t = start + i / FPS
            f = pick(fr, a + i / FPS)
            out.append((t, f))
        place.append((name, a, b, start))
        T = start + dur
    # resolve overlapping times (dissolves) into blends
    out.sort(key=lambda x: x[0])
    frames = []
    total = T
    nframes = int(round(total * FPS))
    by_slot = {}
    for t, f in out:
        k = int(round(t * FPS))
        by_slot.setdefault(k, []).append(f)
    for k in range(nframes):
        fs = by_slot.get(k) or by_slot.get(k - 1) or by_slot.get(k + 1)
        frames.append(fs)
    return frames, place, total


def caption_img(text, lang, size=64):
    font = ImageFont.truetype(FONT_B, size)
    pad = 26
    tmp = Image.new('RGBA', (10, 10))
    bbox = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    img = Image.new('RGBA', (tw + pad * 2 + 12, th + pad * 2 + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # chunky pixel outline
    for dx in range(-6, 7, 3):
        for dy in range(-6, 7, 3):
            d.text((pad + 6 + dx - bbox[0], pad + 6 + dy - bbox[1]), text, font=font, fill=(43, 29, 20, 255))
    d.text((pad + 6 - bbox[0], pad + 6 - bbox[1]), text, font=font, fill=(255, 246, 224, 255))
    return img


def end_card(lang):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, H), fill=(20, 40, 60, 120))
    logo = Image.open(os.path.join(ROOT, 'out', 'assets', 'logo.png')).convert('RGBA')
    lw = 864
    logo = logo.resize((lw, int(logo.size[1] * lw / logo.size[0])), Image.NEAREST)
    img.alpha_composite(logo, ((W - lw) // 2, 560))
    sub = '한 손으로, 물이 차기 전에.' if lang == 'ko' else 'One thumb. Back before the tide.'
    cap = caption_img(sub, lang, 54)
    img.alpha_composite(cap, ((W - cap.size[0]) // 2, 560 + logo.size[1] + 40))
    return img


def render_frames(frames, lang, outdir):
    os.makedirs(outdir, exist_ok=True)
    caps = {}
    if lang:
        for (a, b, ko, en) in CAPTIONS:
            caps[(a, b)] = caption_img(ko if lang == 'ko' else en, lang)
    ec = end_card(lang or 'ko') if True else None
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
        for (a, b), c in caps.items():
            if a <= t <= b:
                fade = min(1, (t - a) / 0.15, (b - t) / 0.15)
                cc = c.copy()
                if fade < 1:
                    alpha = cc.split()[3].point(lambda v: int(v * fade))
                    cc.putalpha(alpha)
                im.alpha_composite(cc, ((W - c.size[0]) // 2, int(H * 0.70)))
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


def mix_audio(place, total, path):
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

    # music bed: run music until the build, island music after
    run_end = place[5][3]
    base, tens, isl = snd('run_base'), snd('run_tension'), snd('island')
    def bed(x, a, b, g, fade=0.6):
        n = int((b - a) * SR)
        y = np.tile(x, (1, int(np.ceil(n / x.shape[1])) + 1))[:, :n].copy()
        env = np.ones(n, np.float32)
        f = int(fade * SR)
        env[:f] = np.linspace(0, 1, f); env[-f:] = np.linspace(1, 0, f)
        add(y * env, a, g)
    bed(base, 0, run_end + 0.4, 0.36)
    # tension layer swells with the danger in the race home
    nT = int((run_end + 0.4) * SR)
    ty = np.tile(tens, (1, int(np.ceil(nT / tens.shape[1])) + 1))[:, :nT].copy()
    tt = np.arange(nT) / SR
    race = place[2][3]
    env = np.clip((tt - (race - 1.0)) / 2.0, 0, 1) * np.clip((place[4][3] + 0.3 - tt) / 0.8, 0, 1)
    add(ty * env, 0, 0.42)
    bed(isl, run_end - 0.3, total, 0.38, fade=0.8)
    # sound effects from the real event logs
    logs = SEG['logs']
    which = {'run1a': 'run1', 'run1b': 'run1', 'run1c': 'run1', 'build': 'build', 'run2': 'run2'}
    for (name, a, b, start) in place:
        if name not in which:
            continue
        s = seg(name)
        a_abs = s['start'] + a
        b_abs = s['start'] + b
        for e in logs[which[name]]:
            if e['k'] != 'sfx' or not (a_abs <= e['t'] < b_abs):
                continue
            if e['name'] in ('heartbeat',) and e['vol'] < 0.3:
                continue
            add(snd(e['name']), start + (e['t'] - a_abs), 0.9 * e['vol'] * 0.85, e['rate'])
    # waves under everything, and a closing jingle
    wv = snd('waves')
    if wv is not None:
        bed(wv, 0, total, 0.22, fade=0.5)
    add(snd('fanfare'), total - END_CARD + 0.1, 0.55)
    # master: gentle limiter
    pk = np.max(np.abs(mix)) + 1e-9
    mix = mix / pk * 0.97
    mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.92
    data = (np.clip(mix[:, :int(total * SR)].T, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())


def write_subs(lang, total):
    os.makedirs(os.path.join(REL, 'subtitles'), exist_ok=True)
    def ts(t, sep):
        h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
        return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', sep)
    vtt = ['WEBVTT', '']
    srt = []
    rows = [(a, b, ko if lang == 'ko' else en) for (a, b, ko, en) in CAPTIONS]
    rows.append((total - END_CARD + 0.2, total - 0.05, '물때 섬 — 한 손으로, 물이 차기 전에.' if lang == 'ko' else 'Low Tide Island — One thumb. Back before the tide.'))
    for i, (a, b, txt) in enumerate(rows, 1):
        vtt += [f'{ts(a, ".")} --> {ts(b, ".")}', txt, '']
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
    frames, place, total = build_timeline()
    print(f'timeline {total:.2f}s, {len(frames)} frames')
    assert total <= 30.0, 'trailer too long'
    wav = os.path.join(WORK, 'mix.wav')
    os.makedirs(WORK, exist_ok=True)
    mix_audio(place, total, wav)
    for lang in ('ko', 'en'):
        write_subs(lang, total)
    os.makedirs(os.path.join(REL, 'video'), exist_ok=True)
    variants = [(None, os.path.join(REL, 'trailer.mp4')), ('ko', os.path.join(REL, 'video', 'trailer_ko.mp4')), ('en', os.path.join(REL, 'video', 'trailer_en.mp4'))]
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for lang, out in variants:
        if only and (lang or 'clean') != only:
            continue
        d = os.path.join(WORK, f'frames_{lang or "clean"}')
        shutil.rmtree(d, ignore_errors=True)
        render_frames(frames, lang, d)
        subs = [(os.path.join(REL, 'subtitles', 'trailer.ko.srt'), 'ko'), (os.path.join(REL, 'subtitles', 'trailer.en.srt'), 'en')] if lang is None else None
        encode(d, wav, out, subs)
        print(out, os.path.getsize(out))


if __name__ == '__main__':
    main()
