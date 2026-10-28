"""π — synthesized score and sound design (no samples, no voice).

Every cue time below mirrors an event in shots.js. Run:
    python3 audio.py out.wav
Requires numpy + scipy.
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 90.0
N = int(SR * DUR)
rng = np.random.default_rng(314159)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
sub = np.zeros((N, 2))  # dry low end, kept out of the reverb


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def idx(t):
    return int(round(t * SR))


def place(buf, t, sig, gain=1.0, pan=0.0):
    """mix mono/stereo signal into buf at time t with equal-power pan"""
    i = idx(t)
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(N, i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * gain


def env_adsr(n, a, r, curve=2.0):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** curve
    e[-nr:] *= np.linspace(1, 0, nr) ** curve
    return e


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, f0, f1, order=2):
    return sosfilt(butter(order, [f0, min(f1, SR * 0.45)], 'band', fs=SR, output='sos'), x, axis=0)


def sweep_filter(x, f_start, f_end, kind='low', block=256):
    """time-varying 2-pole filter, cutoff swept exponentially"""
    out = np.zeros_like(x)
    nb = (len(x) + block - 1) // block
    zi = np.zeros((1, 2))
    for b in range(nb):
        f = f_start * (f_end / f_start) ** (b / max(1, nb - 1))
        f = float(np.clip(f, 30, SR * 0.45))
        sos = butter(2, f, kind, fs=SR, output='sos')
        seg = x[b * block:(b + 1) * block]
        y, zi = sosfilt(sos, seg, zi=zi)
        out[b * block:(b + 1) * block] = y
    return out


# ─── instruments ────────────────────────────────────────────────────────────
def pad_note(freq, dur, bright=0.5, voices=3, detune=7.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    nh = 10
    for v in range(voices):
        cents = (v - (voices - 1) / 2) * detune
        f = freq * 2 ** (cents / 1200)
        ph = rng.uniform(0, 2 * np.pi)
        vib = 0.0015 * np.sin(2 * np.pi * (0.13 + 0.05 * v) * t + ph)
        sig = np.zeros(n)
        for h in range(1, nh + 1):
            if f * h > 9000:
                break
            amp = (1 / h) * np.exp(-(h - 1) * (1.4 - bright))
            sig += amp * np.sin(2 * np.pi * f * h * t * (1 + vib) + ph * h)
        pan = (v / max(1, voices - 1)) * 1.4 - 0.7
        a = (pan + 1) * np.pi / 4
        out[:, 0] += sig * np.cos(a)
        out[:, 1] += sig * np.sin(a)
    return out / voices


def chord(notes, t0, t1, gain, bright=0.5, att=2.0, rel=2.5):
    dur = t1 - t0 + rel
    for m in notes:
        sig = pad_note(mtof(m), dur, bright)
        e = env_adsr(len(sig), att, rel, 1.5)
        place(music, t0, sig * e[:, None], gain / np.sqrt(len(notes)) * (0.7 if m < 45 else 1.0))


def pluck(freq, dur=1.2, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.35 * bright * np.sin(4 * np.pi * freq * t) * np.exp(-t * 8)
    s += 0.12 * bright * np.sin(6 * np.pi * freq * t) * np.exp(-t * 14)
    return s * np.exp(-t * 4.0) * np.minimum(1, t * 400)


def bell(freq, dur=4.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    partials = [(1, 1.0, 1.2), (2.0, 0.5, 1.8), (2.76, 0.4, 2.4), (5.4, 0.22, 3.5), (8.93, 0.12, 5.0), (0.5, 0.3, 0.9)]
    s = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d) for r, a, d in partials)
    return s * np.minimum(1, t * 2000)


def glass_click(freq=3200, dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * freq * r * t) for r, a in [(1, 1), (1.51, 0.6), (2.37, 0.35), (3.1, 0.2)])
    s *= np.exp(-t * 28)
    click = rng.standard_normal(n) * np.exp(-t * 900) * 0.6
    return hp(s + click, 900) * 0.5


def tick(freq=2400, dur=0.03):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * freq * t)) * np.exp(-t * 220) * 0.25


def boom(dur=4.0, f0=80, f1=32, drive=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 6)
    ph = 2 * np.cumsum(np.pi * f) / SR
    s = np.sin(ph) * np.exp(-t * 1.1)
    s = np.tanh(s * drive) / np.tanh(drive)
    thump = lp(rng.standard_normal(n), 400) * np.exp(-t * 18) * 2.0
    return s + thump


def whoosh(dur=1.0, f0=300, f1=3000, peak=0.6):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    s = sweep_filter(noise, f0, f1, 'low')
    s = hp(s, 120)
    x = np.linspace(0, 1, n)
    e = np.where(x < peak, (x / peak) ** 2.2, ((1 - x) / (1 - peak)) ** 1.6)
    return s * e * 0.9


def whoosh_st(dur, f0, f1, peak=0.6, pan_from=-0.6, pan_to=0.6):
    m = whoosh(dur, f0, f1, peak)
    p = np.linspace(pan_from, pan_to, len(m))
    a = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], axis=1)


def riser(dur=2.0, f0=400, f1=6000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = t / dur
    noise = sweep_filter(rng.standard_normal(n), f0, f1, 'high')
    noise = lp(noise, 12000)
    f = 300 * (8 ** x)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.08
    sh = sum(np.sin(2 * np.pi * (2400 + 400 * k) * t + k) * np.sin(2 * np.pi * (5 + k * 1.3) * t) for k in range(4)) * 0.03
    return (noise * 0.35 + tone + sh) * x ** 2.5


def heartbeat():
    out = np.zeros(int(0.8 * SR))
    for dt, g in [(0, 1.0), (0.22, 0.7)]:
        n = int(0.4 * SR)
        t = np.arange(n) / SR
        f = 45 + 50 * np.exp(-t * 30)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * g
        i = int(dt * SR)
        out[i:i + n] += s
    return out


def sonar(freq=1400, dur=1.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 4) * np.minimum(1, t * 300) * 0.4


def tone_glide(f0, f1, dur, wave='sine'):
    n = int(dur * SR)
    f = f0 * (f1 / f0) ** np.linspace(0, 1, n)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) + 0.25 * np.sin(2 * ph)


def kick(dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 42 + 90 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


# ─── SCORE ──────────────────────────────────────────────────────────────────
Dm9 = [38, 45, 53, 60, 64]
Bbmaj7 = [34, 41, 50, 57, 65]
Fadd9 = [41, 48, 57, 67, 60]
Cadd9 = [36, 43, 52, 62, 55]
Dmaj = [38, 45, 54, 57, 64, 66]
Bbbig = [34, 46, 50, 53, 58, 62, 65]

# opening drone
n = idx(9.5)
tt = np.arange(n) / SR
dr = (np.sin(2 * np.pi * mtof(26) * tt) * 0.6 + np.sin(2 * np.pi * mtof(38) * tt) * 0.25 + np.sin(2 * np.pi * mtof(50) * tt * 1.001) * 0.08)
dr *= env_adsr(n, 3.0, 2.5)
place(music, 0.2, dr, 0.22)
# airy high shimmer
sh = bp(rng.standard_normal(n), 4000, 9000) * env_adsr(n, 4, 3) * 0.05
place(music, 0.4, np.stack([sh, np.roll(sh, 2000)], 1), 1.0)

prog = [
    (Dm9, 7.5, 14.0, 0.18, 0.35), (Bbmaj7, 14.0, 20.0, 0.18, 0.4),
    (Fadd9, 20.0, 26.0, 0.2, 0.45), (Cadd9, 26.0, 32.0, 0.22, 0.55),
    (Dm9, 32.0, 38.5, 0.26, 0.6), (Bbmaj7, 38.5, 45.0, 0.27, 0.65),
    (Fadd9, 45.0, 51.5, 0.2, 0.4), (Dm9, 51.5, 58.0, 0.2, 0.4),
    (Bbmaj7, 58.0, 61.5, 0.24, 0.6), (Fadd9, 61.5, 65.0, 0.24, 0.6),
    (Cadd9, 65.0, 68.5, 0.25, 0.65), (Dm9, 68.5, 72.0, 0.25, 0.65),
    (Bbmaj7, 72.0, 78.1, 0.28, 0.75),
    (Bbbig, 78.1, 82.0, 0.42, 0.95), (Dmaj, 81.6, 88.6, 0.26, 0.5),
]
for notes, a, b, g, br in prog:
    chord(notes, a, b, g, br, att=1.6 if a > 8 else 3.0, rel=2.2)

# π digits as melody — D minor pentatonic, two octaves
PI = '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679'
PENT = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]
DPENT = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83]


def arp(t0, t1, step, gain, scale=PENT, octave=0, start=0, bright=1.0, fade_out=0.0):
    k = start
    t = t0
    while t < t1:
        d = int(PI[k % len(PI)])
        f = mtof(scale[d] + octave)
        g = gain * (1 - fade_out * (t - t0) / (t1 - t0))
        place(music, t, pluck(f, 1.4, bright), g, pan=0.5 * np.sin(k * 1.7))
        k += 1
        t += step


arp(20.8, 31.5, 0.25, 0.10)
arp(32.3, 44.8, 0.125, 0.075, octave=0, start=40, bright=0.7)
arp(46.2, 51.0, 0.375, 0.07, start=10)
arp(58.4, 72.0, 0.25, 0.085, start=70)
arp(84.0, 88.6, 0.3, 0.07, scale=DPENT, start=0, fade_out=0.8)

# rhythmic sub pulses
for t in np.arange(10.2, 18.0, 1.0):
    place(sub, t, kick(0.6), 0.25)
for t in np.arange(20.8, 31.0, 1.0):
    place(sub, t, kick(0.6), 0.3)
for t in np.arange(32.0, 44.0, 0.5):
    place(sub, t, kick(0.5), 0.32 if (t * 2) % 2 == 0 else 0.18)
for t in np.arange(58.4, 72.0, 0.5):
    place(sub, t, kick(0.5), 0.38 if (t * 2) % 2 == 0 else 0.22)
# build before the equation: accelerating pulses
tb = 74.0
step = 0.5
while tb < 78.0:
    place(sub, tb, kick(0.45), 0.3 + 0.2 * (tb - 74) / 4)
    tb += step
    step = max(0.12, step * 0.9)

# ─── SOUND DESIGN ───────────────────────────────────────────────────────────
# shot 1
place(sfx, 0.6, boom(3.0, 60, 30, 1.2), 0.35)
place(sfx, 0.6, bell(mtof(86), 5.0), 0.05)
place(sfx, 0.45, riser(0.4, 2000, 9000)[::-1], 0.2)
for t in (1.75, 2.3):
    place(sub, t, kick(0.6), 0.35)
place(sfx, 2.55, whoosh_st(0.9, 400, 4000, 0.7, -0.2, 0.4), 0.25)
place(sfx, 3.3, tone_glide(220, 880, 3.0) * env_adsr(int(3.0 * SR), 0.4, 0.6) * 0.06, 1.0)
place(sfx, 6.3, glass_click(2600), 0.7)
place(sfx, 6.3, bell(mtof(81), 4.0), 0.08)

# shot 2
place(sfx, 7.95, whoosh_st(0.6, 800, 9000, 0.85, -0.8, 0.8), 0.45)
place(sfx, 8.5, glass_click(3400), 0.8)
place(sfx, 9.0, whoosh_st(1.3, 200, 1500, 0.5, 0.3, -0.5), 0.3)
rum = lp(rng.standard_normal(idx(3.2)), 180) * env_adsr(idx(3.2), 0.5, 0.6) * 0.8
place(sfx, 10.2, rum, 0.5)
place(sfx, 10.2, tone_glide(110, 330, 3.0) * env_adsr(idx(3.0), 0.5, 0.5) * 0.05, 1.0)
place(sfx, 13.2, glass_click(2900), 0.6)
for k in range(3):
    ts = 13.4 + k * 0.8
    place(sfx, ts, whoosh_st(0.75, 500, 5000, 0.8, 0.6, -0.4 + k * 0.4), 0.28)
    place(sfx, ts + 0.75, glass_click(3000 + k * 400), 0.8, pan=-0.6 + k * 0.4)
    place(sfx, ts + 0.75, pluck(mtof(74 + [0, 3, 7][k]), 1.5), 0.15, pan=-0.6 + k * 0.4)
tg = np.arange(idx(1.3)) / SR
gap = np.sin(2 * np.pi * 1320 * tg) * (0.5 + 0.5 * np.sin(9 * (tg + 15.8))) * env_adsr(idx(1.3), 0.2, 0.3)
place(sfx, 15.8, gap, 0.035)
place(sfx, 16.15, whoosh_st(1.1, 200, 7000, 0.85, -0.2, 0.2), 0.5)
for k in range(int(0.9 / 0.036)):
    place(sfx, 16.9 + k * 0.036, tick(2000 + rng.uniform(0, 1500), 0.02), 0.25, pan=rng.uniform(-0.3, 0.3))
for j in range(7):
    place(sfx, 17.05 + j * 0.12, tick(3200, 0.04), 0.7, pan=-0.3 + j * 0.1)
    place(sfx, 17.05 + j * 0.12, glass_click(4200 + j * 120, 0.15), 0.25)
place(sfx, 18.0, whoosh_st(1.0, 3000, 300, 0.3, 0.4, -0.2), 0.35)
place(sfx, 18.1, riser(1.0, 600, 9000), 0.45)
place(sub, 19.1, boom(4.5, 90, 30, 2.0), 0.9)
place(sfx, 19.1, bell(mtof(74), 5.0), 0.12)
place(sfx, 19.1, bell(mtof(81), 5.0), 0.07)
place(sfx, 19.8, whoosh_st(1.0, 300, 3000, 0.5, -0.3, 0.3), 0.22)

# shot 3
for t, f in ((22.0, 3100), (22.4, 3500)):
    place(sfx, t, glass_click(f), 0.55)
for T in (23.0, 24.7, 26.2, 27.5):
    place(sfx, T, whoosh_st(0.9, 400, 3500, 0.7, -0.4, 0.4), 0.2)
    place(sfx, T + 0.45, tick(2800, 0.05), 0.5)
    place(sfx, T + 0.9, glass_click(3000 + (T - 23) * 250), 0.65)
place(sfx, 28.4, whoosh_st(1.6, 200, 4000, 0.8, 0.2, -0.2), 0.32)
place(sfx, 29.1, bell(mtof(86), 3.0), 0.09)
place(sfx, 29.1, glass_click(4600), 0.5)
place(sfx, 30.7, riser(1.3, 300, 10000), 0.6)
crk = rng.standard_normal(idx(0.6)) * (rng.random(idx(0.6)) > 0.97) * np.linspace(0.2, 1, idx(0.6))
place(sfx, 31.4, hp(crk, 2000), 0.5, pan=0.0)

# shot 4
place(sub, 32.0, boom(5.0, 110, 28, 2.4), 1.0)
place(sfx, 32.0, whoosh_st(2.2, 6000, 300, 0.08, 0.0, 0.0), 0.5)
place(sfx, 32.0, bell(mtof(69), 6.0), 0.1)
for k in range(220):
    t = 32.5 + rng.uniform(0, 12.3)
    place(sfx, t, tick(rng.uniform(1800, 5200), 0.02), rng.uniform(0.05, 0.16), pan=rng.uniform(-0.9, 0.9))
inf = sum(np.sin(2 * np.pi * mtof(m) * np.arange(idx(4.0)) / SR) for m in (81, 86, 88, 93)) * env_adsr(idx(4.0), 1.2, 1.5) * 0.04
place(sfx, 40.4, inf, 1.0)
place(sfx, 42.6, riser(2.4, 300, 10000), 0.55)
place(sfx, 43.9, whoosh_st(1.6, 200, 8000, 0.75, 0.0, 0.0), 0.5)
place(sfx, 45.25, glass_click(2400), 0.7)
place(sfx, 45.25, bell(mtof(74), 4.0), 0.1)

# shot 5 — the sine wave is audible: a soft tone tremolo-locked to the rotation
n = idx(5.2)
tt = np.arange(n) / SR + 46.2
phi = np.where(tt - 46.2 < 0.8, 2.86 * (tt - 46.2) ** 2 / 1.6, 2.86 * (tt - 46.2 - 0.4))
sw = np.sin(2 * np.pi * mtof(57) * tt) * (0.55 + 0.45 * np.sin(phi)) * env_adsr(n, 0.3, 0.8)
place(sfx, 46.2, sw, 0.06)
place(sfx, 51.0, whoosh_st(1.7, 200, 2500, 0.6, -0.3, 0.3), 0.28)
drop = np.sin(2 * np.pi * np.cumsum(np.linspace(900, 300, idx(0.25))) / SR) * np.exp(-np.arange(idx(0.25)) / SR * 18)
place(sfx, 51.5, drop, 0.35)
water = bp(rng.standard_normal(idx(3.0)), 300, 1600) * env_adsr(idx(3.0), 0.6, 1.0) * (0.6 + 0.4 * np.sin(np.arange(idx(3.0)) / SR * 2 * np.pi * 1.4))
place(sfx, 51.4, np.stack([water, np.roll(water, 900)], 1), 0.12)
place(sfx, 53.2, whoosh_st(1.3, 300, 3000, 0.6, 0.3, -0.3), 0.22)
sw2 = sum(np.sin(2 * np.pi * f * np.arange(idx(1.8)) / SR + k) * (0.5 + 0.5 * np.sin(np.arange(idx(1.8)) / SR * (6 + k) * 2 * np.pi)) for k, f in enumerate((220, 330, 440, 587)))
place(sfx, 53.9, sw2 * env_adsr(idx(1.8), 0.4, 0.5), 0.04)
for t in (55.84, 56.73, 57.62):
    place(sub, t - 0.04, heartbeat(), 0.85)
    place(sfx, t, tick(1000, 0.08), 0.15)
place(sfx, 57.7, whoosh_st(0.9, 400, 5000, 0.75, -0.5, 0.5), 0.3)
place(sfx, 58.45, glass_click(2700), 0.5)

# shot 6
for k in range(14):
    place(sfx, 60.6 + k * 0.19 + rng.uniform(0, 0.05), sonar(rng.choice([1760, 2093, 2349, 2637]), 0.6), 0.16, pan=rng.uniform(-0.8, 0.8))
for t in (63.3, 65.7, 67.9, 70.0):
    place(sfx, t - 0.35, whoosh_st(0.75, 300, 7000, 0.55, -0.7, 0.7), 0.42)
    place(sfx, t + 0.05, glass_click(2500), 0.35)
for k in range(int(2.4 / 0.105)):
    place(sfx, 63.3 + k * 0.105, tick(900, 0.025), 0.12, pan=-0.3 if k % 2 else 0.3)
place(sfx, 65.75, lp(rng.standard_normal(idx(2.0)), 150) * env_adsr(idx(2.0), 0.5, 1.0), 0.4)
for k in range(5):
    place(sfx, 68.0 + k * 0.42, sonar(1175, 1.4), 0.28, pan=0.3)
whl = bp(rng.standard_normal(idx(2.0)), 200, 1200) * (0.6 + 0.4 * np.sin(np.arange(idx(2.0)) / SR * 2 * np.pi * 7)) * env_adsr(idx(2.0), 0.3, 0.6)
place(sfx, 70.0, whl, 0.2)

# shot 7
imp = whoosh(1.25, 6000, 200, 0.9)
place(sfx, 72.0, imp, 0.55)
place(sub, 73.15, boom(1.5, 70, 40, 1.4), 0.5)
place(sfx, 73.3, riser(0.75, 500, 8000), 0.4)
notes = [69, 74, 76, 77, 79, 81]
for k, T in enumerate([74.0, 74.6, 75.2, 75.9, 76.5, 77.2]):
    place(sfx, T - 0.55, whoosh_st(0.6, 600, 8000, 0.9, [-1, 0, 1, 0, -0.8, 0.8][k], 0.0), 0.35)
    place(sfx, T, glass_click(3000 + k * 250), 0.8)
    place(sfx, T, bell(mtof(notes[k]), 3.0), 0.1)
place(sfx, 77.25, riser(0.85, 400, 12000), 0.7)
place(sfx, 77.35, whoosh_st(0.75, 600, 9000, 0.95, 1.0, 0.0), 0.4)
# the lock
place(sfx, 78.1, bell(mtof(86), 7.0), 0.22)
place(sfx, 78.1, bell(mtof(74), 7.0), 0.16)
place(sfx, 78.1, bell(mtof(81), 7.0), 0.12)
place(sfx, 78.1, glass_click(3600), 1.0)
place(sub, 78.1, boom(6.0, 120, 26, 2.6), 1.0)
place(sfx, 78.1, whoosh_st(2.5, 8000, 400, 0.05, 0.0, 0.0), 0.4)

# shot 8
place(sfx, 82.0, riser(1.2, 2000, 10000)[::-1], 0.3)
place(sfx, 82.1, whoosh_st(1.4, 2000, 400, 0.3, 0.2, -0.2), 0.25)
place(sfx, 83.4, glass_click(2600), 0.5)
place(sfx, 83.4, bell(mtof(78), 4.0), 0.09)
place(sfx, 83.8, whoosh_st(4.4, 3000, 150, 0.5, 0.0, 0.0), 0.25)
place(sub, 88.9, kick(1.2), 0.45)
place(sfx, 88.9, bell(mtof(74), 3.5), 0.1)
place(sfx, 88.9, bell(mtof(81), 3.5), 0.06)

# ─── mix ────────────────────────────────────────────────────────────────────
# sidechain-ish ducking of pads under the pulses
duck = np.ones(N)
for buf in (sub,):
    lvl = np.abs(buf).sum(1)
    k = int(0.12 * SR)
    sm = np.convolve(lvl, np.ones(k) / k, mode='same')
    duck = 1 - 0.35 * np.clip(sm / (sm.max() + 1e-9) * 3, 0, 1)
music *= duck[:, None]


def reverb_ir(seconds=4.5, predelay=0.02):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        nz = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        ir[:, c] = lp(nz, 6000)
    ir[: int(predelay * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(0)).max()


ir = reverb_ir()
wet_in = music * 0.9 + sfx * 0.5
wet = np.stack([fftconvolve(wet_in[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
# ping-pong delay on the music for space
dl = int(0.375 * SR)
delay = np.zeros_like(music)
delay[dl:, 1] += music[:-dl, 0] * 0.35
delay[2 * dl:, 0] += music[:-2 * dl, 1] * 0.2

mix = music * 0.9 + delay * 0.6 + sfx * 0.85 + wet * 0.45 + hp(sub, 25) * 0.9
mix = hp(mix, 22)
# end fade (matches the picture)
tt = np.arange(N) / SR
fade = np.clip((89.95 - tt) / 1.4, 0, 1) ** 1.5
fade *= np.clip(tt / 0.3, 0, 1)
mix *= fade[:, None]
peak = np.abs(mix).max()
mix = mix / peak * 1.25
mix = np.tanh(mix) / np.tanh(1.25) * 0.93  # gentle soft clip / glue

out = sys.argv[1] if len(sys.argv) > 1 else 'pi_audio.wav'
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, 'peak', peak)
