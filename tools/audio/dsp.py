"""Small synthesis toolkit: instruments, percussion, noise, filters, reverb, mixing."""
import numpy as np
from scipy import signal

SR = 44100
RNG = np.random.default_rng(7)


def n_(sec):
    return int(round(sec * SR))


def tt(n):
    return np.arange(n) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def nm(name):
    """'F4' -> midi number"""
    if name[1:2] in ('#', 'b'):
        p, o = name[:2], int(name[2:])
    else:
        p, o = name[:1], int(name[1:])
    return 12 * (o + 1) + NOTE[p]


def hz(name):
    return midi(nm(name))


# ---------- filters ----------
def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    b, a = signal.butter(order, fc / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    hi = min(hi, SR * 0.45)
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def sweep_lp(x, f0, f1, curve=1.0):
    """time-varying one-pole lowpass (cheap), cutoff from f0 to f1"""
    n = len(x)
    fc = f0 * (f1 / f0) ** (np.linspace(0, 1, n) ** curve)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros(n)
    s = 0.0
    for i in range(n):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def noise(n, color='white'):
    w = RNG.standard_normal(n)
    if color == 'white':
        return w
    if color == 'pink':
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        return signal.lfilter(b, a, w) * 3.0
    if color == 'brown':
        y = np.cumsum(w)
        y = hp(y, 20, 1)
        return y / (np.max(np.abs(y)) + 1e-9)
    return w


# ---------- envelopes ----------
def expdec(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, hold=None):
    env = np.zeros(n)
    A, D, R = n_(a), n_(d), n_(r)
    H = n - A - D - R if hold is None else n_(hold)
    H = max(0, H)
    i = 0
    seg = min(A, n - i); env[i:i + seg] = np.linspace(0, 1, A)[:seg]; i += seg
    seg = min(D, n - i); env[i:i + seg] = np.linspace(1, s, D)[:seg]; i += seg
    seg = min(H, n - i); env[i:i + seg] = s; i += seg
    seg = min(R, n - i); env[i:i + seg] = np.linspace(s, 0, R)[:seg]; i += seg
    return env


def attack(n, a):
    e = np.ones(n)
    A = min(n, max(1, n_(a)))
    e[:A] = np.linspace(0, 1, A) ** 0.7
    return e


# ---------- instruments ----------
def marimba(f, dur=1.4, vel=1.0):
    n = n_(dur)
    t = tt(n)
    x = (np.sin(2 * np.pi * f * t) * expdec(n, 0.55 * (440 / f) ** 0.3)
         + 0.32 * np.sin(2 * np.pi * f * 3.93 * t) * expdec(n, 0.11)
         + 0.08 * np.sin(2 * np.pi * f * 9.2 * t) * expdec(n, 0.03))
    mallet = lp(noise(n_(0.012)), 2500) * np.linspace(1, 0, n_(0.012))
    x[:len(mallet)] += 0.25 * mallet
    return x * attack(n, 0.002) * vel


def kalimba(f, dur=1.6, vel=1.0):
    n = n_(dur)
    t = tt(n)
    x = (np.sin(2 * np.pi * f * t) * expdec(n, 0.7)
         + 0.18 * np.sin(2 * np.pi * f * 2.0 * t) * expdec(n, 0.25)
         + 0.12 * np.sin(2 * np.pi * f * 5.95 * t) * expdec(n, 0.06))
    click = hp(noise(n_(0.004)), 3000) * np.linspace(1, 0, n_(0.004))
    x[:len(click)] += 0.15 * click
    return x * attack(n, 0.0015) * vel


def pluck(f, dur=1.6, vel=1.0, bright=1.0, pos=0.22):
    """nylon-ish plucked string (additive, harmonic decays grow with k)"""
    n = n_(dur)
    t = tt(n)
    x = np.zeros(n)
    for k in range(1, 16):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 9000:
            break
        amp = abs(np.sin(np.pi * k * pos)) / k ** (1.25 / bright)
        x += amp * np.sin(2 * np.pi * fk * t + RNG.random() * 0.3) * expdec(n, 0.9 / (1 + 0.35 * k * k ** 0.5))
    return x * attack(n, 0.003) * vel


def bell(f, dur=2.5, vel=1.0):
    n = n_(dur)
    t = tt(n)
    ratios = [0.5, 1.0, 1.183, 1.506, 2.0, 2.514, 2.662, 3.011]
    amps = [0.35, 1.0, 0.6, 0.45, 0.4, 0.25, 0.2, 0.12]
    x = np.zeros(n)
    for r, a in zip(ratios, amps):
        x += a * np.sin(2 * np.pi * f * r * t) * expdec(n, 1.6 / r ** 0.7)
    return x * attack(n, 0.002) * vel


def glock(f, dur=1.2, vel=1.0):
    n = n_(dur)
    t = tt(n)
    x = np.sin(2 * np.pi * f * t) * expdec(n, 0.5) + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * expdec(n, 0.12)
    return x * attack(n, 0.001) * vel


def saw_bl(f, t):
    x = np.zeros(len(t))
    k = 1
    while f * k < 7000:
        x += np.sin(2 * np.pi * f * k * t) / k
        k += 1
    return x


def pad(f, dur, vel=1.0, cutoff=1400, a=0.5, r=0.9):
    n = n_(dur + r)
    t = tt(n)
    x = np.zeros(n)
    for det in (-0.006, 0.0, 0.0065):
        x += saw_bl(f * (1 + det), t + RNG.random())
    x = lp(x, cutoff, 2)
    env = adsr(n, a=a, d=0.3, s=0.85, r=r, hold=max(0.0, dur - a - 0.3))
    return x * env * vel * 0.25


def strings(f, dur, vel=1.0, cutoff=2400):
    n = n_(dur + 0.25)
    t = tt(n)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.3, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    x = np.zeros(n)
    k = 1
    while f * k < 6000:
        x += np.sin(k * ph) / k
        k += 1
    x = lp(x, cutoff, 2)
    env = adsr(n, a=0.02, d=0.08, s=0.75, r=0.22, hold=max(0.0, dur - 0.1))
    return x * env * vel * 0.4


def bass(f, dur, vel=1.0):
    n = n_(dur + 0.2)
    t = tt(n)
    x = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = adsr(n, a=0.006, d=0.25, s=0.55, r=0.15, hold=max(0.0, dur - 0.26))
    return lp(x, 900) * env * vel


def flute(f, dur, vel=1.0):
    n = n_(dur + 0.15)
    t = tt(n)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.15) / 0.3, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    br = bp(noise(n), f * 0.9, f * 3) * 0.06
    env = adsr(n, a=0.06, d=0.1, s=0.8, r=0.12, hold=max(0.0, dur - 0.16))
    return (x + br) * env * vel * 0.6


# ---------- percussion ----------
def shaker(vel=1.0, dur=0.06):
    n = n_(dur)
    x = bp(noise(n), 5000, 11000) * (np.linspace(0, 1, n) ** 0.3) * expdec(n, dur * 0.35)
    return x * vel * 0.5


def kick(vel=1.0):
    n = n_(0.35)
    t = tt(n)
    f = 45 + 70 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * expdec(n, 0.12) * vel


def woodblock(f=900, vel=1.0):
    n = n_(0.12)
    t = tt(n)
    x = np.sin(2 * np.pi * f * t) * expdec(n, 0.03) + 0.4 * np.sin(2 * np.pi * f * 2.3 * t) * expdec(n, 0.015)
    return x * vel


def tom(f=110, vel=1.0):
    n = n_(0.5)
    t = tt(n)
    ff = f * (1 + 0.6 * np.exp(-t / 0.05))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    x = np.sin(ph) * expdec(n, 0.22) + 0.15 * lp(noise(n), 1500) * expdec(n, 0.05)
    return x * vel


def snap(vel=1.0):
    n = n_(0.15)
    x = bp(noise(n), 1200, 6000) * expdec(n, 0.03)
    return x * vel * 0.8


# ---------- mixing ----------
def place(buf, x, at, gain=1.0, pan=0.0):
    """add mono x into stereo buf at sample index `at` (wraps around for seamless loops)"""
    L = np.cos((pan + 1) * np.pi / 4) * gain
    R = np.sin((pan + 1) * np.pi / 4) * gain
    n = len(x)
    N = buf.shape[1]
    i0 = at % N
    end = i0 + n
    if end <= N:
        buf[0, i0:end] += x * L
        buf[1, i0:end] += x * R
    else:
        k = N - i0
        buf[0, i0:] += x[:k] * L
        buf[1, i0:] += x[:k] * R
        rest = x[k:]
        while len(rest):
            m = min(len(rest), N)
            buf[0, :m] += rest[:m] * L
            buf[1, :m] += rest[:m] * R
            rest = rest[m:]


def reverb_ir(rt60=1.5, length=2.2, damp=4000, seed=3):
    rng = np.random.default_rng(seed)
    n = n_(length)
    t = tt(n)
    env = np.exp(-6.91 * t / rt60)
    irs = []
    for ch in range(2):
        w = rng.standard_normal(n) * env
        # darker tail
        w = 0.5 * lp(w, damp) + 0.5 * lp(w, damp * 0.35)
        # early reflections
        for d, g in ((0.011, 0.5), (0.019, 0.35), (0.027, 0.25), (0.041, 0.2)):
            w[n_(d + 0.002 * ch)] += g
        irs.append(w / np.sqrt(np.sum(w ** 2)))
    return np.array(irs)


def apply_reverb(st, ir, wet=0.25, loop=False):
    out = np.zeros_like(st)
    N = st.shape[1]
    for ch in range(2):
        y = signal.fftconvolve(st[ch], ir[ch])
        if loop:
            full = y[:N].copy()
            tail = y[N:]
            while len(tail):
                m = min(len(tail), N)
                full[:m] += tail[:m]
                tail = tail[m:]
            y = full
        else:
            y = y[:N]
        out[ch] = st[ch] * (1 - wet) + y * wet
    return out


def soft_limit(x, ceiling=0.89):
    pk = np.max(np.abs(x)) + 1e-9
    x = x / pk * 1.05
    return np.tanh(x * 1.1) / np.tanh(1.1 * 1.05) * ceiling


def normalize(x, peak_db=-3.0):
    pk = np.max(np.abs(x)) + 1e-9
    return x / pk * 10 ** (peak_db / 20)


def fade(x, fin=0.002, fout=0.01):
    x = x.copy()
    a, b = n_(fin), n_(fout)
    if x.ndim == 1:
        if a: x[:a] *= np.linspace(0, 1, a)
        if b: x[-b:] *= np.linspace(1, 0, b)
    else:
        if a: x[:, :a] *= np.linspace(0, 1, a)
        if b: x[:, -b:] *= np.linspace(1, 0, b)
    return x
