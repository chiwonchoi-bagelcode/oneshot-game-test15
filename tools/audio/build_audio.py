"""Render all audio, encode to MP3 with ffmpeg, and write base64 packs for the game.
Run: python3 tools/audio/build_audio.py"""
import os, sys, json, base64, subprocess, wave
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from dsp import SR, normalize, fade, n_
import music, sfx

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TMP = os.path.join(ROOT, '.cache', 'audio')
os.makedirs(TMP, exist_ok=True)


def write_wav(path, x):
    x = np.asarray(x)
    if x.ndim == 1:
        x = x[None, :]
    x = np.clip(x, -1, 1)
    data = (x.T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(x.shape[0])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def encode(name, x, kbps, stereo):
    wav = os.path.join(TMP, name + '.wav')
    mp3 = os.path.join(TMP, name + '.mp3')
    write_wav(wav, x)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '2' if stereo else '1', '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', mp3], check=True)
    return mp3


def stats(name, x):
    x = np.asarray(x)
    pk = np.max(np.abs(x))
    rms = np.sqrt(np.mean(x ** 2))
    return f'{name:14s} {x.shape[-1] / SR:6.2f}s peak {20 * np.log10(pk + 1e-9):6.1f}dB rms {20 * np.log10(rms + 1e-9):6.1f}dB'


def main():
    report = []
    sfx_pack, music_pack, meta = {}, {}, {}
    S = {
        'pick_shell': (sfx.pick_shell(), -4), 'pick_wood': (sfx.pick_wood(), -4), 'pick_glass': (sfx.pick_glass(), -4),
        'pick_rope': (sfx.pick_rope(), -5), 'pick_pearl': (sfx.pick_pearl(), -4), 'pick_chest': (sfx.pick_chest(), -3),
        'combo': (sfx.combo(), -8), 'bag_heavy': (sfx.bag_heavy(), -6), 'bag_full': (sfx.bag_full(), -5), 'bloop': (sfx.bloop(), -8),
        'step_sand': (sfx.step_sand(), -10), 'step_mud': (sfx.step_mud(), -9), 'step_water': (sfx.step_water(), -8), 'step_board': (sfx.step_board(), -9),
        'bell': (sfx.bell_sfx(), -4), 'wave_crash': (sfx.wave_crash(), -3), 'arrive': (sfx.arrive(False), -3), 'arrive_close': (sfx.arrive(True), -2),
        'pour': (sfx.pour(), -7), 'swept': (sfx.swept(), -2), 'wash': (sfx.wash(), -4), 'shake_off': (sfx.shake_off(), -6), 'sigh': (sfx.sigh(), -7),
        'heartbeat': (sfx.heartbeat(), -4), 'tide_turn': (sfx.tide_turn(), -5), 'tide_out': (sfx.tide_out(), -5), 'build': (sfx.build(), -4),
        'ui_tap': (sfx.ui_tap(), -9), 'star': (sfx.star(), -5), 'gull1': (sfx.gull(0), -10), 'gull2': (sfx.gull(1), -10),
        'results': (music.jingle('results'), -3), 'results_soft': (music.jingle('results_soft'), -4), 'fanfare': (music.jingle('fanfare'), -3),
    }
    for name, (x, pk) in S.items():
        x = fade(normalize(np.asarray(x), pk), 0.0005, 0.02)
        stereo = x.ndim == 2
        mp3 = encode(name, x, 96 if stereo else 64, stereo)
        sfx_pack[name] = base64.b64encode(open(mp3, 'rb').read()).decode()
        report.append(stats(name, x))
    wv = sfx.waves_loop(16.0)
    mp3 = encode('waves', wv, 80, True)
    sfx_pack['waves'] = base64.b64encode(open(mp3, 'rb').read()).decode()
    meta['waves'] = {'loop': 16.0}
    report.append(stats('waves', wv))
    # music loops: render loop, then append the beginning again so the decoder delay can be skipped with loopStart
    for name, fn in (('island', music.island), ('run_base', music.run_base), ('run_tension', music.run_tension)):
        x, loop_len = fn()
        ext = np.concatenate([x, x[:, :n_(1.0)]], axis=1)
        mp3 = encode(name, ext, 96, True)
        music_pack[name] = base64.b64encode(open(mp3, 'rb').read()).decode()
        meta[name] = {'loop': round(x.shape[1] / SR, 5)}
        report.append(stats(name, x))
    out_dir = os.path.join(ROOT, 'out', 'assets')
    with open(os.path.join(out_dir, 'audio-sfx.js'), 'w') as f:
        f.write('window.__AUDIO_PACK__=' + json.dumps(sfx_pack) + ';window.__AUDIO_META__=Object.assign(window.__AUDIO_META__||{},' + json.dumps(meta) + ');')
    with open(os.path.join(out_dir, 'audio-music.js'), 'w') as f:
        f.write('window.__AUDIO_PACK__=' + json.dumps(music_pack) + ';window.__AUDIO_META__=Object.assign(window.__AUDIO_META__||{},' + json.dumps(meta) + ');')
    print('\n'.join(report))
    for fn in ('audio-sfx.js', 'audio-music.js'):
        print(fn, os.path.getsize(os.path.join(out_dir, fn)))


if __name__ == '__main__':
    main()
