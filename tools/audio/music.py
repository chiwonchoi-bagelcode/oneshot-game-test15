"""Compose and render the music loops and jingles (seamless loops via wrap-around mixing)."""
import numpy as np
from dsp import *

CHORDS = {
    'F': ['F3', 'A3', 'C4', 'F4'], 'Dm': ['D3', 'A3', 'D4', 'F4'], 'Bb': ['Bb2', 'F3', 'Bb3', 'D4'],
    'C': ['C3', 'G3', 'C4', 'E4'], 'Am': ['A2', 'E3', 'A3', 'C4'],
    'G': ['G2', 'D3', 'G3', 'B3'], 'Em': ['E2', 'B2', 'E3', 'G3'], 'D': ['D3', 'A3', 'D4', 'F#4'],
}
ROOT = {'F': 'F2', 'Dm': 'D2', 'Bb': 'Bb1', 'C': 'C2', 'Am': 'A1', 'G': 'G1', 'Em': 'E2', 'D': 'D2'}


def island():
    bpm = 84
    beat = 60 / bpm
    bars = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'F', 'F']
    L = n_(beat * 4 * len(bars))
    buf = np.zeros((2, L))
    at = lambda bar, b: n_((bar * 4 + b) * beat)
    mel = {
        0: [('A4', 0, 1), ('C5', 1, 1), ('D5', 2, .5), ('C5', 2.5, .5), ('A4', 3, 1)],
        1: [('F4', 0, 1.5), ('A4', 1.5, .5), ('D5', 2, 2)],
        2: [('C5', 0, 1), ('D5', 1, .5), ('C5', 1.5, .5), ('A4', 2, 1), ('F4', 3, 1)],
        3: [('G4', 0, 1), ('A4', 1, 1), ('C5', 2, 2)],
        4: [('A4', 0, 1), ('C5', 1, 1), ('F5', 2, 1), ('D5', 3, 1)],
        5: [('C5', 0, 1.5), ('A4', 1.5, .5), ('C5', 2, 1), ('A4', 3, 1)],
        6: [('D5', 0, 1), ('C5', 1, 1), ('A4', 2, 1), ('F4', 3, 1)],
        7: [('G4', 0, 2), ('C5', 2, 1)],
        8: [('D5', 0, 1), ('F5', 1, 1), ('A5', 2, 1.5), ('G5', 3.5, .5)],
        9: [('F5', 0, 1), ('D5', 1, 1), ('F5', 2, 2)],
        10: [('C5', 0, 1), ('A4', 1, 1), ('C5', 2, 1), ('F5', 3, 1)],
        11: [('E5', 0, 1), ('G5', 1, 1), ('E5', 2, 2)],
        12: [('D5', 0, 1), ('F5', 1, 1), ('D5', 2, 1), ('Bb4', 3, 1)],
        13: [('C5', 0, 1), ('E5', 1, 1), ('G5', 2, 1), ('E5', 3, 1)],
        14: [('F5', 0, 2), ('C5', 2, 1), ('A4', 3, 1)],
        15: [('F4', 0, 3)],
    }
    for bi, ch in enumerate(bars):
        v = CHORDS[ch]
        # warm pad
        for k, note in enumerate(v[1:]):
            place(buf, pad(hz(note), beat * 4, vel=0.22, cutoff=1100), at(bi, 0), 0.5, pan=-0.3 + 0.3 * k)
        # fingerpicked guitar: eighths
        pat = [0, 2, 1, 3, 2, 1, 3, 2]
        for e in range(8):
            note = v[pat[e]]
            vel = 0.55 if e % 2 == 0 else 0.38
            place(buf, pluck(hz(note), 1.2, vel=vel, bright=0.9), at(bi, e * 0.5) + n_(0.004 * (e % 3)), 0.5, pan=0.25)
        # bass
        place(buf, bass(hz(ROOT[ch]), beat * 1.8, vel=0.7), at(bi, 0), 0.6)
        place(buf, bass(hz(ROOT[ch]) * (1.5 if ch not in ('Dm', 'Am', 'Em') else 1.5), beat * 0.9, vel=0.45), at(bi, 2.5), 0.6)
        # percussion
        place(buf, kick(0.5), at(bi, 0), 0.5)
        for e in range(8):
            place(buf, shaker(0.35 if e % 2 else 0.18), at(bi, e * 0.5 + 0.02), 0.6, pan=0.4)
        if bi >= 8:
            place(buf, woodblock(1100, 0.25), at(bi, 3.5), 0.5, pan=-0.4)
        # melody: marimba first half, kalimba second half
        for (note, b, d) in mel[bi]:
            inst = marimba(hz(note), 1.3, 0.8) if bi < 8 else kalimba(hz(note), 1.6, 0.75)
            place(buf, inst, at(bi, b), 0.55, pan=-0.15)
    ir = reverb_ir(1.7, 2.4, 3500)
    out = apply_reverb(buf, ir, wet=0.28, loop=True)
    return soft_limit(out, 0.85), len(bars) * 4 * beat


RUN_BARS = ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G']
RUN_BPM = 116


def run_base():
    beat = 60 / RUN_BPM
    bars = RUN_BARS
    L = n_(beat * 4 * len(bars))
    buf = np.zeros((2, L))
    at = lambda bar, b: n_((bar * 4 + b) * beat)
    mel = {
        0: [('B4', 0, .5), ('D5', .5, .5), ('E5', 1, 1), ('D5', 2, .5), ('B4', 2.5, .5), ('A4', 3, 1)],
        1: [('G4', 0, 1), ('B4', 1, 1), ('E5', 2, 1.5), ('D5', 3.5, .5)],
        2: [('E5', 0, .5), ('D5', .5, .5), ('B4', 1, 1), ('G4', 2, 1), ('E5', 3, 1)],
        3: [('D5', 0, 1.5), ('A4', 1.5, .5), ('D5', 2, 1), ('A4', 3, 1)],
        4: [('B4', 0, .5), ('D5', .5, .5), ('G5', 1, 1), ('E5', 2, 1), ('D5', 3, 1)],
        5: [('B4', 0, 1), ('E5', 1, 1), ('G5', 2, 1), ('E5', 3, 1)],
        6: [('E5', 0, 1), ('D5', 1, .5), ('B4', 1.5, .5), ('A4', 2, 1), ('D5', 3, 1)],
        7: [('G4', 0, 2), ('B4', 2.5, .5), ('D5', 3, .5), ('E5', 3.5, .5)],
        8: [('G5', 0, 1), ('E5', 1, .5), ('D5', 1.5, .5), ('B4', 2, 1), ('E5', 3, 1)],
        9: [('E5', 0, 1.5), ('G5', 1.5, .5), ('E5', 2, 1), ('C5', 3, 1)],
        10: [('D5', 0, .5), ('B4', .5, .5), ('G4', 1, 1), ('B4', 2, 1), ('D5', 3, 1)],
        11: [('A4', 0, 1), ('D5', 1, 1), ('F#5', 2, 1), ('A5', 3, 1)],
        12: [('G5', 0, 1), ('E5', 1, 1), ('C5', 2, 1), ('E5', 3, 1)],
        13: [('D5', 0, 1), ('F#5', 1, .5), ('E5', 1.5, .5), ('D5', 2, 1), ('A4', 3, 1)],
        14: [('B4', 0, .5), ('D5', .5, .5), ('G5', 1, 2)],
        15: [('D5', 2, .5), ('E5', 2.5, .5), ('G5', 3, 1)],
    }
    for bi, ch in enumerate(bars):
        v = CHORDS[ch]
        up = [v[1], v[2], v[3], hz_n(v[2], 12)]
        pat = [0, 1, 2, 3, 2, 1, 2, 1]
        for e in range(8):
            f = up[pat[e]] if isinstance(up[pat[e]], float) else hz(up[pat[e]])
            place(buf, kalimba(f * 2, 0.9, 0.42 if e % 2 else 0.6), at(bi, e * 0.5), 0.45, pan=0.35 if e % 2 else -0.2)
        place(buf, bass(hz(ROOT[ch]) * 2, beat * 0.9, 0.75), at(bi, 0), 0.6)
        place(buf, bass(hz(ROOT[ch]) * 2, beat * 0.9, 0.6), at(bi, 2), 0.6)
        place(buf, bass(hz(ROOT[ch]) * 4, beat * 0.4, 0.4), at(bi, 3.5), 0.5)
        place(buf, kick(0.75), at(bi, 0), 0.6)
        place(buf, kick(0.55), at(bi, 2), 0.6)
        place(buf, snap(0.35), at(bi, 1), 0.5, pan=0.1)
        place(buf, snap(0.35), at(bi, 3), 0.5, pan=0.1)
        for s16 in range(16):
            place(buf, shaker(0.32 if s16 % 4 == 2 else 0.16, 0.045), at(bi, s16 * 0.25), 0.55, pan=0.45)
        for (note, b, d) in mel[bi]:
            if bi < 8:
                place(buf, flute(hz(note), d * beat * 0.92, 0.55), at(bi, b), 0.5, pan=-0.1)
            else:
                place(buf, marimba(hz(note), 1.0, 0.85), at(bi, b), 0.55, pan=-0.1)
    ir = reverb_ir(1.1, 1.6, 4500)
    out = apply_reverb(buf, ir, wet=0.2, loop=True)
    return soft_limit(out, 0.8), len(bars) * 4 * beat


def hz_n(name, semis):
    return midi(nm(name) + semis)


def run_tension():
    """layer that fades in as the tide rises: driving low strings, toms, tremolo, risers"""
    beat = 60 / RUN_BPM
    bars = RUN_BARS
    L = n_(beat * 4 * len(bars))
    buf = np.zeros((2, L))
    at = lambda bar, b: n_((bar * 4 + b) * beat)
    for bi, ch in enumerate(bars):
        root = hz(ROOT[ch])
        for e in range(8):
            acc = 1.0 if e in (0, 3, 6) else 0.6
            place(buf, strings(root * 2, beat * 0.42, vel=0.55 * acc, cutoff=1500), at(bi, e * 0.5), 0.55, pan=-0.25)
            place(buf, strings(root * 4, beat * 0.42, vel=0.3 * acc, cutoff=2200), at(bi, e * 0.5), 0.4, pan=0.25)
        for b, v in ((0, 0.9), (1.5, 0.6), (3, 0.75), (3.5, 0.5)):
            place(buf, tom(95 if b != 1.5 else 120, v), at(bi, b), 0.55)
        # tremolo on the chord third, high
        v = CHORDS[ch]
        f3 = hz(v[2]) * 4 if ch in ('G', 'Em') else hz(v[3]) * 2
        n = n_(beat * 4)
        t = tt(n)
        trem = (0.55 + 0.45 * np.sin(2 * np.pi * 7.7 * t)) * adsr(n, 0.15, 0.1, 0.8, 0.3)
        place(buf, strings(f3, beat * 4, vel=0.22, cutoff=3000)[:n] * trem, at(bi, 0), 0.35, pan=0.4)
        if bi % 4 == 3:
            nn = n_(beat * 2)
            r = bp(noise(nn), 800, 6000) * np.linspace(0, 1, nn) ** 2 * 0.25
            place(buf, r, at(bi, 2), 0.5)
    ir = reverb_ir(1.0, 1.5, 4000)
    out = apply_reverb(buf, ir, wet=0.18, loop=True)
    return soft_limit(out, 0.75), len(bars) * 4 * beat


def jingle(kind):
    L = n_(3.6)
    buf = np.zeros((2, L))
    if kind == 'results':
        for i, nt in enumerate(['G4', 'B4', 'D5', 'G5']):
            place(buf, marimba(hz(nt), 1.4, 0.9), n_(i * 0.09), 0.6, pan=-0.3 + 0.2 * i)
        for nt in ['G3', 'D4', 'B4', 'G5']:
            place(buf, pluck(hz(nt), 2.4, 0.6), n_(0.42), 0.5)
            place(buf, pad(hz(nt), 1.6, 0.35, 1800, a=0.05, r=1.0), n_(0.42), 0.45)
        place(buf, glock(hz('B6'), 1.4, 0.5), n_(0.42), 0.4, pan=0.4)
        place(buf, glock(hz('D7'), 1.2, 0.4), n_(0.52), 0.35, pan=-0.4)
    elif kind == 'results_soft':
        seq = [('E4', 0), ('G4', 0.18), ('B4', 0.36), ('C5', 0.8), ('B4', 1.2), ('G4', 1.38), ('D5', 1.56)]
        for nt, s in seq:
            place(buf, kalimba(hz(nt), 1.6, 0.7), n_(s), 0.55)
        for nt in ['C3', 'G3', 'E4']:
            place(buf, pad(hz(nt), 0.8, 0.3, 1200, a=0.1, r=0.6), n_(0.8), 0.4)
        for nt in ['G2', 'D3', 'B3', 'G4']:
            place(buf, pad(hz(nt), 1.2, 0.32, 1300, a=0.1, r=1.2), n_(1.56), 0.45)
            place(buf, pluck(hz(nt), 2.0, 0.45), n_(1.56), 0.4)
    elif kind == 'fanfare':
        for i, nt in enumerate(['C5', 'E5', 'G5']):
            place(buf, marimba(hz(nt), 1.0, 0.85), n_(i * 0.11), 0.55)
        for nt in ['C4', 'E4', 'G4', 'C5', 'E5']:
            place(buf, pluck(hz(nt), 2.6, 0.55), n_(0.36), 0.45)
            place(buf, pad(hz(nt), 1.4, 0.3, 2000, a=0.04, r=1.2), n_(0.36), 0.4)
        place(buf, bell(hz('C6'), 2.4, 0.5), n_(0.36), 0.35, pan=0.3)
        place(buf, glock(hz('G6'), 1.2, 0.45), n_(0.5), 0.3, pan=-0.3)
        place(buf, kick(0.6), n_(0.36), 0.4)
    ir = reverb_ir(1.5, 2.0, 4500)
    out = apply_reverb(buf, ir, wet=0.25)
    return fade(normalize(out, -2.0), 0.001, 0.4)
