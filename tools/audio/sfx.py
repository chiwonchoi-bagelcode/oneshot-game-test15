"""Sound effects. Each returns a mono (or stereo) float array."""
import numpy as np
from dsp import *


def mono_rev(x, rt=0.6, wet=0.18):
    st = np.vstack([x, x])
    ir = reverb_ir(rt, rt * 1.3, 5000, seed=9)
    pad_ = np.zeros((2, len(x) + n_(rt * 1.3)))
    pad_[:, :len(x)] = st
    out = apply_reverb(pad_, ir, wet=wet)
    return out.mean(axis=0)


def pick_shell():
    n = n_(0.35)
    t = tt(n)
    x = np.sin(2 * np.pi * 1568 * t) * expdec(n, 0.09) + 0.45 * np.sin(2 * np.pi * 2350 * t) * expdec(n, 0.05)
    x += 0.2 * np.sin(2 * np.pi * 3136 * t) * expdec(n, 0.03)
    x[:n_(0.003)] += hp(noise(n_(0.003)), 4000) * 0.3
    return mono_rev(x * attack(n, 0.001), 0.4, 0.15)


def pick_wood():
    x = woodblock(620, 1.0)
    n = n_(0.2)
    th = np.sin(2 * np.pi * 170 * tt(n)) * expdec(n, 0.05)
    y = np.zeros(n)
    y[:len(x)] += x
    y += 0.7 * th
    return mono_rev(y, 0.3, 0.12)


def pick_glass():
    n = n_(0.6)
    t = tt(n)
    x = np.sin(2 * np.pi * 2637 * t) * expdec(n, 0.14) + 0.7 * np.sin(2 * np.pi * 3530 * t) * expdec(n, 0.1)
    x += 0.4 * np.sin(2 * np.pi * 5274 * t + 0.3) * expdec(n, 0.05)
    # second tiny clink
    d = n_(0.055)
    x[d:] += 0.5 * (np.sin(2 * np.pi * 3136 * t[:n - d]) * expdec(n - d, 0.08))
    return mono_rev(x * attack(n, 0.001), 0.6, 0.22)


def pick_rope():
    n = n_(0.28)
    sw = bp(noise(n), 300, 3000) * np.sin(np.linspace(0, np.pi, n)) ** 2
    th = np.sin(2 * np.pi * 140 * tt(n)) * expdec(n, 0.06) * 0.6
    return mono_rev(sw * 0.6 + th, 0.3, 0.1)


def pick_pearl():
    n = n_(0.9)
    x = np.zeros(n)
    for i, f in enumerate([1318.5, 1661.2, 1975.5, 2637.0]):
        k = n_(0.055 * i)
        tk = tt(n - k)
        x[k:] += (0.9 - 0.12 * i) * np.sin(2 * np.pi * f * tk) * expdec(n - k, 0.22)
    sh = hp(noise(n), 6000) * expdec(n, 0.25) * 0.08
    return mono_rev(x + sh, 0.9, 0.3)


def pick_chest():
    n = n_(1.0)
    t = tt(n)
    thud = np.sin(2 * np.pi * (70 + 60 * np.exp(-t / 0.03)) * t) * expdec(n, 0.12)
    rattle = bp(noise(n), 400, 2500) * expdec(n, 0.06) * 0.5
    x = thud + rattle
    for i in range(7):
        k = n_(0.08 + 0.045 * i + RNG.random() * 0.02)
        f = 2200 + RNG.random() * 2400
        tk = tt(n - k)
        x[k:] += 0.35 * np.sin(2 * np.pi * f * tk) * expdec(n - k, 0.07)
    return mono_rev(x, 0.6, 0.18)


def combo():
    n = n_(0.4)
    t = tt(n)
    x = np.sin(2 * np.pi * 2093 * t) * expdec(n, 0.12) + 0.3 * np.sin(2 * np.pi * 4186 * t) * expdec(n, 0.05)
    return mono_rev(x * attack(n, 0.002), 0.5, 0.25)


def bag_heavy():
    n = n_(0.35)
    t = tt(n)
    x = np.sin(2 * np.pi * (110 + 40 * np.exp(-t / 0.05)) * t) * expdec(n, 0.09)
    x += lp(noise(n), 1200) * expdec(n, 0.08) * 0.35
    return x


def bag_full():
    n = n_(0.45)
    x = np.zeros(n)
    for i, f in enumerate([392.0, 311.1]):
        k = n_(0.12 * i)
        tk = tt(n - k)
        x[k:] += np.sin(2 * np.pi * f * tk) * expdec(n - k, 0.08) + 0.3 * np.sin(2 * np.pi * f * 2 * tk) * expdec(n - k, 0.04)
    x += bp(noise(n), 800, 4000) * expdec(n, 0.1) * 0.2
    return mono_rev(x, 0.3, 0.12)


def bloop():
    n = n_(0.14)
    t = tt(n)
    f = 280 + 600 * (t / t[-1]) ** 1.5
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.sin(np.linspace(0, np.pi, n)) * 0.8


def step_sand():
    n = n_(0.07)
    x = bp(noise(n), 900, 4500) * expdec(n, 0.018) * 0.6
    x += np.sin(2 * np.pi * 120 * tt(n)) * expdec(n, 0.02) * 0.4
    return x


def step_mud():
    n = n_(0.16)
    t = tt(n)
    x = sweep_lp(noise(n), 2200, 300) * expdec(n, 0.05) * 0.8
    f = 220 - 90 * (t / t[-1])
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.linspace(0, np.pi, n)) * 0.35
    return x


def step_water():
    n = n_(0.22)
    x = bp(noise(n), 700, 6000) * (np.linspace(0, 1, n) ** 0.2) * expdec(n, 0.06)
    b = bloop()
    x[n_(0.04):n_(0.04) + len(b)] += b[:n - n_(0.04)] * 0.3
    return x


def step_board():
    n = n_(0.1)
    t = tt(n)
    x = np.sin(2 * np.pi * 310 * t) * expdec(n, 0.025) + 0.5 * np.sin(2 * np.pi * 720 * t) * expdec(n, 0.012)
    x += bp(noise(n), 1500, 5000) * expdec(n, 0.006) * 0.3
    return x


def bell_sfx():
    n = n_(3.2)
    x = np.zeros(n)
    b = bell(523.25, 2.6, 0.9)
    x[:len(b)] += b
    b2 = bell(523.25, 2.4, 0.7)
    k = n_(0.45)
    x[k:k + len(b2)] += b2[:n - k]
    return mono_rev(x, 1.6, 0.3)


def wave_crash(big=1.0):
    n = n_(1.8)
    t = tt(n)
    env = np.minimum(1, t / 0.08) * np.exp(-t / 0.55)
    x = sweep_lp(noise(n, 'pink'), 7000, 700, 0.7) * env
    x += lp(noise(n, 'brown'), 200) * env * 0.8 * big
    return np.vstack([x, sweep_lp(noise(n, 'pink'), 6500, 650, 0.7) * env + lp(noise(n, 'brown'), 200) * env * 0.8 * big])


def arrive(close=False):
    n = n_(1.6)
    x = np.zeros(n)
    for i, f in enumerate(['G5', 'B5', 'D6']):
        m = marimba(hz(f), 1.0, 0.8)
        k = n_(0.03 * i)
        x[k:k + len(m)] += m[:n - k]
    w = bp(noise(n), 500, 5000) * np.sin(np.linspace(0, np.pi, n)) ** 4 * 0.25
    x += w
    if close:
        g = glock(hz('G6'), 1.2, 0.5)
        x[n_(0.12):n_(0.12) + len(g)] += g[:n - n_(0.12)]
        g2 = glock(hz('D7'), 1.0, 0.4)
        x[n_(0.2):n_(0.2) + len(g2)] += g2[:n - n_(0.2)]
    return mono_rev(x, 1.0, 0.25)


def pour():
    n = n_(0.09)
    t = tt(n)
    f = 520 + 500 * (t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.linspace(0, np.pi, n)) ** 0.5 * 0.9


def swept():
    n = n_(2.0)
    st = wave_crash(1.3)
    x = np.zeros((2, n))
    x[:, :st.shape[1]] += st[:, :n]
    # gurgle bubbles + descending tone
    for i in range(10):
        b = bloop() * (0.6 - i * 0.04)
        k = n_(0.25 + i * 0.08 + RNG.random() * 0.04)
        x[:, k:k + len(b)] += b[:n - k]
    t = tt(n_(0.9))
    tone = np.sin(2 * np.pi * np.cumsum(520 - 260 * t / t[-1]) / SR) * expdec(len(t), 0.3) * 0.3
    x[:, n_(0.1):n_(0.1) + len(tone)] += tone
    return x


def wash():
    n = n_(1.1)
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    a = hp(noise(n, 'pink'), 300) * env
    b = hp(noise(n, 'pink'), 300) * env
    return np.vstack([lp(a, 5000), lp(b, 5000)]) * 0.8


def shake_off():
    n = n_(0.55)
    t = tt(n)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 24 * t)
    x = bp(noise(n), 1500, 8000) * am * np.sin(np.linspace(0, np.pi, n)) * 0.6
    for i in range(6):
        k = n_(0.05 + RNG.random() * 0.45)
        d = np.sin(2 * np.pi * (1800 + RNG.random() * 1500) * tt(n_(0.03))) * expdec(n_(0.03), 0.008) * 0.3
        x[k:k + len(d)] += d[:n - k]
    return x


def sigh():
    """a soft breathy exhale with a hint of voice"""
    n = n_(0.75)
    t = tt(n)
    f0 = 230 - 50 * (t / t[-1])
    ph = 2 * np.pi * np.cumsum(f0) / SR
    glott = np.zeros(n)
    for k in range(1, 18):
        glott += np.sin(k * ph) / k ** 1.4
    breath = noise(n)
    src = 0.25 * glott + 0.9 * breath
    out = np.zeros(n)
    for (fc, bw, g) in ((700, 160, 1.0), (1150, 200, 0.6), (2600, 300, 0.25)):
        out += bp(src, fc - bw / 2, fc + bw / 2, 2) * g
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.2 * np.linspace(1, 0.6, n)
    return mono_rev(out * env, 0.4, 0.12)


def heartbeat():
    n = n_(0.5)
    x = np.zeros(n)
    for k, v in ((0, 1.0), (n_(0.18), 0.7)):
        m = n_(0.18)
        t = tt(m)
        th = np.sin(2 * np.pi * (48 + 30 * np.exp(-t / 0.03)) * t) * expdec(m, 0.05) * v
        x[k:k + m] += th[:n - k]
    return lp(x, 300)


def tide_turn():
    n = n_(1.6)
    t = tt(n)
    sw = sweep_lp(noise(n, 'pink'), 300, 2500, 1.2) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.6
    horn = (np.sin(2 * np.pi * 146.8 * t) + 0.3 * np.sin(2 * np.pi * 220 * t)) * adsr(n, 0.3, 0.2, 0.6, 0.6) * 0.35
    return mono_rev(sw + lp(horn, 1200), 1.2, 0.3)


def tide_out():
    n = n_(1.8)
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.3
    x = sweep_lp(noise(n, 'pink'), 5000, 400, 0.8) * env * 0.7
    for i in range(8):
        b = bloop() * 0.25
        k = n_(0.3 + i * 0.15 + RNG.random() * 0.05)
        x[k:k + len(b)] += b[:n - k]
    return np.vstack([x, np.roll(x, n_(0.012))])


def build():
    n = n_(1.3)
    x = np.zeros(n)
    for i, k in enumerate([0.0, 0.32, 0.64, 0.86]):
        kk = n_(k)
        w = woodblock(520 + 60 * (i % 2), 0.9)
        x[kk:kk + len(w)] += w[:n - kk]
        m = np.sin(2 * np.pi * 2900 * tt(n_(0.12))) * expdec(n_(0.12), 0.02) * 0.25
        x[kk:kk + len(m)] += m[:n - kk]
    x += bp(noise(n), 200, 1500) * expdec(n, 0.4) * 0.05
    return mono_rev(x, 0.6, 0.15)


def ui_tap():
    n = n_(0.05)
    t = tt(n)
    f = 1300 - 500 * (t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.012) * 0.8


def star():
    n = n_(0.8)
    t = tt(n)
    x = np.sin(2 * np.pi * 1318.5 * t) * expdec(n, 0.25) + 0.5 * np.sin(2 * np.pi * 2637 * t) * expdec(n, 0.12)
    x += 0.25 * np.sin(2 * np.pi * 3951 * t) * expdec(n, 0.06)
    return mono_rev(x * attack(n, 0.001), 0.8, 0.25)


def waves_loop(sec=16.0):
    n = n_(sec)
    buf = np.zeros((2, n))
    rng = np.random.default_rng(11)
    base = [lp(noise(n, 'brown'), 420), lp(noise(n, 'brown'), 400)]
    # slow swell envelope (periodic so the loop is seamless)
    t = tt(n)
    sw = 0.55 + 0.25 * np.sin(2 * np.pi * t / sec * 3) + 0.2 * np.sin(2 * np.pi * t / sec * 5 + 1)
    for ch in range(2):
        buf[ch] += base[ch] * sw * 0.7
    # foam hiss bursts as waves break
    for k in range(8):
        dur = 1.6 + rng.random() * 1.2
        m = n_(dur)
        e = np.sin(np.linspace(0, np.pi, m)) ** 2
        h = bp(noise(m, 'pink'), 1200, 7000) * e * (0.18 + 0.1 * rng.random())
        at = n_(k * sec / 8 + rng.random() * 0.8)
        place(buf, h, at, 1.0, pan=rng.random() * 1.4 - 0.7)
    return normalize(buf, -6)


def gull(var=0):
    n = n_(0.9)
    out = np.zeros(n)
    rng = np.random.default_rng(20 + var)
    for i in range(2 + var):
        m = n_(0.22)
        t = tt(m)
        f = 1900 + 500 * np.sin(np.pi * t / t[-1]) - 600 * (t / t[-1])
        mod = 1 + 0.9 * np.sin(2 * np.pi * 380 * t)
        x = np.sin(2 * np.pi * np.cumsum(f * mod) / SR) * np.sin(np.linspace(0, np.pi, m)) ** 0.7
        x = bp(x, 900, 5000)
        k = n_(i * 0.27 + rng.random() * 0.03)
        out[k:k + m] += x[:n - k] * (0.8 - 0.15 * i)
    return mono_rev(out, 1.2, 0.35) * 0.6
