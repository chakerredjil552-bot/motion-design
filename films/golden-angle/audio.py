"""137.5° — synthesized score and sound design (no samples, no voice).

Cue times are read from timeline.js, the same file the picture uses. Run:
    python3 audio.py out.wav
Requires numpy + scipy. The synth helpers are shared in spirit with films/pi/audio.py.
"""
import json
import os
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 90.0
N = int(SR * DUR)
rng = np.random.default_rng(1375)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
sub = np.zeros((N, 2))  # dry low end, kept out of the reverb


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def idx(t):
    return int(t * SR)  # same truncation the generators use, so lengths always match


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




def clap(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 900, 5000)
    e = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.022)) + 0.5 * np.exp(-t * 14)
    return nz * e * 0.6


def hat(dur=0.06, open_=False):
    n = int((0.3 if open_ else dur) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (14 if open_ else 70)) * 0.35


def crash(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 3500) * np.exp(-t * 1.6) * 0.4


def snare_roll(dur, start_rate=8, end_rate=32):
    out = np.zeros(int(dur * SR) + SR)
    tt = 0.0
    while tt < dur:
        x = tt / dur
        n = int(0.08 * SR)
        hit = bp(rng.standard_normal(n), 1500, 7000) * np.exp(-np.arange(n) / SR * 45) * (0.2 + 0.8 * x)
        i = int(tt * SR); out[i:i + n] += hit
        tt += 1 / (start_rate + (end_rate - start_rate) * x * x)
    return out


def shepard(dur, octaves_per_s=0.35, base=55.0, n_oct=8):
    """endless rising tone: octave partials gliding up under a fixed bell-shaped loudness curve"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(n_oct):
        pos = (k + t * octaves_per_s) % n_oct          # position in octaves above base
        f = base * 2 ** pos
        amp = np.exp(-((pos - n_oct / 2) ** 2) / 3.0)
        ph = 2 * np.pi * np.cumsum(f) / SR
        out += amp * np.sin(ph)
    return out / n_oct


def bass_pulse(root_midi, t0, t1, step=0.25, gain=0.3, cutoff=700):
    t = t0
    while t < t1 - 1e-6:
        n = int(step * SR)
        tt = np.arange(n) / SR
        f = mtof(root_midi)
        sig = sum((1 / h) * np.sin(2 * np.pi * f * h * tt) for h in range(1, 10))
        sig = lp(sig, cutoff) * np.exp(-tt * 9) * np.minimum(1, tt * 300)
        place(sub, t, sig, gain)
        t += step


def mech_click():
    out = glass_click(1800, 0.2) * 0.6
    tk = tick(1100, 0.05) * 1.4
    out[: len(tk)] += tk
    return out


def granular(t0, t1, rate, gain, f_lo=1500, f_hi=6000, rate_end=None):
    t = t0
    while t < t1:
        x = (t - t0) / max(1e-6, t1 - t0)
        place(sfx, t, tick(rng.uniform(f_lo, f_hi), 0.018), gain * rng.uniform(0.4, 1), pan=rng.uniform(-0.8, 0.8))
        r = rate if rate_end is None else rate + (rate_end - rate) * x * x
        t += rng.exponential(1 / r)


# ─── timeline (shared with the picture) ────────────────────────────────────
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timeline.js')).read()
TL = json.loads(src[src.index('{'):src.rindex('}') + 1])
BEAT = 60 / TL['bpm']
G = TL['golden']

# ─── SCORE ──────────────────────────────────────────────────────────────────
Am9 = [45, 52, 57, 60, 64, 71]
Fmaj7 = [41, 48, 57, 60, 64]
Cadd9 = [36, 48, 55, 62, 64]
G6 = [43, 50, 55, 59, 64]
Em7 = [40, 47, 55, 59, 62]
Amaj = [45, 52, 57, 61, 64, 69, 73]
ROOT = {id(Am9): 33, id(Fmaj7): 29, id(Cadd9): 36, id(G6): 31, id(Em7): 28, id(Amaj): 33}

n = idx(6.5)
tt = np.arange(n) / SR
drone = (np.sin(2 * np.pi * mtof(33) * tt) * 0.6 + np.sin(2 * np.pi * mtof(45) * tt * 1.002) * 0.2) * env_adsr(n, 2.5, 1.2)
place(music, 0.0, drone, 0.25)

prog = [
    (Am9, 6.0, 11.0, 0.14, 0.3), (Fmaj7, 11.0, G, 0.17, 0.4),
    (Am9, G, 18.5, 0.26, 0.85), (Fmaj7, 18.5, 21.0, 0.26, 0.85),
    (Am9, 21.0, 25.0, 0.2, 0.35), (Fmaj7, 25.0, 28.0, 0.24, 0.6), (Cadd9, 28.0, 32.0, 0.2, 0.45),
    (G6, 32.0, 36.0, 0.2, 0.5), (Em7, 36.0, 38.9, 0.22, 0.55), (Fmaj7, 38.9, 44.0, 0.24, 0.65),
    (Am9, 44.0, 48.5, 0.25, 0.75), (Fmaj7, 48.5, 53.0, 0.25, 0.75), (Cadd9, 53.0, 57.5, 0.25, 0.75),
    (G6, 57.5, 62.0, 0.25, 0.75), (Am9, 62.0, 66.0, 0.25, 0.75),
    (Fmaj7, 66.0, 71.0, 0.27, 0.85), (Cadd9, 71.0, 75.5, 0.27, 0.85), (G6, 75.5, 80.0, 0.28, 0.9),
    (Am9, 82.0, 86.0, 0.16, 0.3), (Amaj, 86.0, 89.6, 0.34, 0.7),
]
for notes, a, b, g, br in prog:
    chord(notes, a, b, g, br, att=0.06 if a in (G, 44.0, 66.0, 86.0) else 1.2, rel=1.6)

# bass: pulsing eighths in the driving sections, following chord roots
for notes, a, b, g, br in prog:
    if a >= G and not (21.0 <= a < 32.0) and a < 82.0:
        bass_pulse(ROOT[id(notes)], a, b, step=BEAT / 2, gain=0.32 if a >= 66 else 0.26)
bass_pulse(33, 6.0, G - 1.1, step=BEAT, gain=0.18)

# Fibonacci melody: Fibonacci numbers mod 7 pick notes of A minor
SCALE = [69, 71, 72, 74, 76, 77, 79]
fibmod = [1, 1]
while len(fibmod) < 64:
    fibmod.append((fibmod[-1] + fibmod[-2]) % 7)


def fib_arp(t0, t1, step, gain, octave=0, bright=1.0):
    k, t = 0, t0
    while t < t1 - 1e-6:
        place(music, t, pluck(mtof(SCALE[fibmod[k % len(fibmod)]] + octave), 1.0, bright), gain, pan=0.55 * np.sin(k * 2.399))
        k += 1
        t += step


fib_arp(G, 21.0, BEAT / 4, 0.07)
fib_arp(44.0, 66.0, BEAT / 4, 0.065)
fib_arp(66.0, 80.0, BEAT / 4, 0.075, octave=12, bright=0.7)
fib_arp(21.5, 31.0, BEAT, 0.05, octave=-12)

# drums
def groove(t0, t1, kick_g=0.9, clap_g=0.5, hat_div=2, hat_g=0.5):
    b, t = 0, t0
    while t < t1 - 1e-6:
        place(sub, t, kick(0.5), kick_g)
        if b % 2 == 1:
            place(sfx, t, clap(), clap_g)
        for h in range(hat_div):
            if hat_div == 2 and h == 0:
                continue
            place(sfx, t + h * BEAT / hat_div, hat(), hat_g * (1 if h % 2 else 0.6), pan=0.3)
        b += 1
        t += BEAT


groove(G, 21.0, hat_div=2)
for t in np.arange(32.0, 36.0, 2 * BEAT):
    place(sub, t, kick(0.6), 0.7)
for t in np.arange(36.0, 38.9, BEAT):
    place(sub, t, kick(0.5), 0.75)
groove(38.9, 44.0, clap_g=0.0, hat_div=4, hat_g=0.35)
groove(44.0, 66.0, hat_div=4)
groove(66.0, 80.0, kick_g=1.0, clap_g=0.6, hat_div=4, hat_g=0.6)
for t in np.arange(21.0, 31.0, 4 * BEAT):
    place(sub, t, kick(0.8), 0.45)

# ─── SOUND DESIGN ───────────────────────────────────────────────────────────
# hook
place(sub, 0.6, boom(3.0, 70, 32, 1.3), 0.5)
place(sfx, 0.6, bell(mtof(81), 4.0), 0.06)
for c in TL['hookClicks']:
    place(sfx, c, mech_click(), 0.8, pan=rng.uniform(-0.4, 0.4))
    place(sfx, c - 0.05, whoosh_st(0.3, 800, 4000, 0.6, -0.3, 0.3), 0.15)
place(sfx, TL['hookClicks'][-1] + 0.3, riser(1.2, 500, 7000), 0.35)

# experiment: a grain for the seeds, a clunk on every angle, a dial spin between them
granular(TL['seedsFrom'], TL['seedsFrom'] + 1600 / TL['seedRate'], 55, 0.07)
for ts, deg, *_ in TL['snaps']:
    place(sfx, ts, mech_click(), 1.0)
    place(sub, ts, kick(0.7), 0.6)
    place(sfx, ts, bell(mtof(57 + (deg % 12)), 2.0), 0.05)
for (ts, *_), (nx, *_) in zip(TL['snaps'], TL['snaps'][1:] + [[G + 0.5]]):
    m0 = nx - 0.6
    place(sfx, m0, tone_glide(220, 880, 0.6) * env_adsr(idx(0.6), 0.05, 0.1) * 0.08, 1.0)
    place(sfx, m0, whoosh_st(0.6, 400, 5000, 0.8, -0.5, 0.5), 0.25)
nn = idx(2.2)
tt = np.arange(nn) / SR
diss = (np.sin(2 * np.pi * 440 * tt) + np.sin(2 * np.pi * 447 * tt) + 0.5 * np.sin(2 * np.pi * 622 * tt)) * env_adsr(nn, 0.4, 0.4)
place(sfx, 13.2, diss, 0.025)
place(sfx, G - 1.1, riser(1.1, 300, 9000), 0.6)
place(sfx, G - 1.1, snare_roll(1.1, 6, 40), 0.5)
place(sfx, G - 0.6, crash(1.0)[::-1] * np.linspace(0, 1, idx(1.0)), 0.6)
# the golden moment
place(sub, G, boom(5.0, 120, 28, 2.6), 1.0)
place(sfx, G, crash(4.0), 0.9)
for m, g in ((81, 0.14), (88, 0.1), (76, 0.1)):
    place(sfx, G, bell(mtof(m), 5.0), g)
for k in range(10):
    place(sfx, TL['bloom'] + k * 0.06, glass_click(2500 + k * 260, 0.4), 0.3, pan=-0.6 + k * 0.13)
d0, d1 = TL['dive']
place(sfx, d0, whoosh_st(d1 - d0, 150, 6000, 0.55, -0.8, 0.8), 0.6)
place(sfx, 19.6, whoosh_st(0.5, 300, 8000, 0.5, 0.7, -0.7), 0.4)

# whips and impacts everywhere
for w in TL['whips']:
    place(sfx, w - 0.42, whoosh_st(0.65, 400, 9000, 0.65, -0.9, 0.9), 0.55)
    place(sub, w, kick(0.4), 0.4)
for i in TL['impacts']:
    if i in (G, 86.0):
        continue
    place(sub, i, boom(3.0, 100, 30, 2.0), 0.8)
    place(sfx, i, crash(2.5), 0.45)

# name: vertigo drone, the split, the title slam, φ digits
place(sfx, 21.0, tone_glide(110, 55, 2.4) * env_adsr(idx(2.4), 0.2, 0.8) * 0.12, 1.0)
nm = TL['name']
place(sfx, nm['split'][0], tone_glide(330, 660, nm['split'][1] - nm['split'][0]) * env_adsr(idx(nm['split'][1] - nm['split'][0]), 0.1, 0.2) * 0.06, 1.0)
place(sfx, 23.0, glass_click(3000), 0.6)
place(sfx, 23.35, glass_click(2600), 0.5)
place(sfx, nm['ratio'], tick(3000, 0.05), 0.5)
place(sfx, nm['title'] - 0.8, crash(0.8)[::-1] * np.linspace(0, 1, idx(0.8)), 0.7)
place(sfx, nm['title'] - 0.3, whoosh_st(0.35, 800, 9000, 0.9, 0, 0), 0.4)
for m, g in ((69, 0.16), (76, 0.12), (81, 0.12), (84, 0.08)):
    place(sfx, nm['title'], bell(mtof(m), 6.0), g)
for k in range(21):
    place(sfx, nm['formula'] + 0.8 + k * (1.4 / 21), tick(2600 + (k % 5) * 300, 0.025), 0.35)
place(sfx, nm['collapse'][0], whoosh(nm['collapse'][1] - nm['collapse'][0] + 0.3, 6000, 200, 0.95), 0.5)

# Fibonacci: a tick per spiral arm, a note per number, an endless rising tone into the zoom
fb = TL['fib']
for k in range(21):
    t = fb['arms21'][0] + k * (fb['arms21'][1] - fb['arms21'][0]) / 21
    place(sfx, t, pluck(mtof(SCALE[k % 7] + 12 * (k // 7) - 12), 0.4), 0.09, pan=-0.5)
for k in range(34):
    t = fb['arms34'][0] + k * (fb['arms34'][1] - fb['arms34'][0]) / 34
    place(sfx, t, pluck(mtof(SCALE[k % 7] + 12 * (k // 7) - 12), 0.3), 0.07, pan=0.5)
place(sfx, fb['ratio'], bell(mtof(81), 3.0), 0.12)
for k in range(13):
    t = fb['sequence'][0] + k * (fb['sequence'][1] - fb['sequence'][0]) / 13
    place(sfx, t, pluck(mtof(SCALE[fibmod[k] % 7] + 12), 0.6), 0.12, pan=0.6 * np.sin(k * 2.4))
    place(sfx, t, tick(4000, 0.02), 0.3)
z0, z1 = fb['zoom']
shp = shepard(z1 - z0 + 0.2) * env_adsr(idx(z1 - z0 + 0.2), 0.8, 0.25)
place(sfx, z0, np.stack([shp, np.roll(shp, 700)], 1), 0.22)
place(sfx, z1 - 1.6, snare_roll(1.6, 8, 48), 0.5)

# nature
nat = {name: t for t, name, _ in TL['nature']}
place(sfx, nat['SUNFLOWER'], whoosh_st(2.4, 200, 1800, 0.5, -0.6, 0.6), 0.35)
for k in range(13):
    place(sfx, nat['PINE CONE'] + 0.3 + k * 0.29, pluck(mtof([45, 52, 57, 60, 64][k % 5]), 0.25, 0.4), 0.13, pan=np.sin(k * 1.3) * 0.6)
for k in range(8):
    place(sfx, nat['SPIRAL ALOE'] + 0.3 + k * 0.45, bell(mtof(88 - k * 2), 2.0), 0.05, pan=np.sin(k * 2.4) * 0.7)
granular(nat['ROMANESCO'] + 0.5, nat['ROMANESCO'] + 4.3, 20, 0.09, 3000, 9000, rate_end=140)
place(sfx, nat['ROMANESCO'] + 1.4, riser(3.0, 400, 10000), 0.3)
for k in range(16):
    place(sfx, nat['LEAVES'] + 0.45 + k * 0.04, glass_click(2200 + k * 140, 0.6), 0.22, pan=np.sin(k * 2.4) * 0.8)
place(sfx, nat['LEAVES'] + 0.4, tone_glide(220, 440, 2.0) * env_adsr(idx(2.0), 0.6, 0.8) * 0.05, 1.0)

# uses
use = {name: t for t, name, _ in TL['uses']}
s0 = use['SOLAR FIELD']
place(sfx, s0 + 0.3, tone_glide(55, 220, 2.6) * env_adsr(idx(2.6), 0.4, 0.4) * 0.12, 1.0)
granular(s0 + 0.4, s0 + 2.4, 30, 0.06, 4000, 9000)
place(sfx, s0 + 2.4, whoosh_st(2.2, 200, 5000, 0.7, 0.6, -0.6), 0.4)
f0 = use['FIBONACCI SPHERE']
crk = rng.standard_normal(idx(0.6)) * (rng.random(idx(0.6)) > 0.96)
place(sfx, f0 + 0.05, hp(crk, 2500), 0.4)
for k in range(12):
    place(sfx, f0 + 0.65 + k * 0.08, pluck(mtof(SCALE[k % 7] + 12), 0.5), 0.08, pan=np.sin(k * 2.4) * 0.6)
place(sfx, f0 + 1.6, bell(mtof(81), 3.0), 0.1)
a0 = use['SUNFLOWER ARRAY']
for k in range(9):
    place(sfx, a0 + 0.3 + k * 0.42, sonar(1568, 0.8), 0.25, pan=0.2)
place(sfx, a0 + 2.0, whoosh_st(2.4, 300, 8000, 0.85, -0.4, 0.4), 0.45)

# finale: strobe montage, rebirth, the last hit
m0, m1 = TL['montage']
cut = (m1 - m0) / len(TL['montageFrom'])
for k in range(len(TL['montageFrom'])):
    t = m0 + k * cut
    place(sfx, t, hp(rng.standard_normal(idx(0.05)), 2000) * np.exp(-np.arange(idx(0.05)) / SR * 80), 0.5, pan=rng.uniform(-0.6, 0.6))
    place(sfx, t, pluck(mtof(SCALE[fibmod[k] % 7] + 12), 0.15), 0.12)
    place(sub, t, kick(0.2), 0.35 if k % 2 == 0 else 0.2)
r0 = TL['rebirth'][0]
for k in range(6):
    place(sfx, r0 + k * 0.25, mech_click(), 0.7)
    place(sfx, r0 + k * 0.25, pluck(mtof(SCALE[fibmod[k] % 7]), 0.8), 0.1)
granular(r0 + 1.5, TL['end'], 10, 0.1, 1500, 7000, rate_end=400)
place(sfx, r0 + 1.4, riser(TL['end'] - r0 - 1.4, 300, 12000), 0.7)
place(sfx, TL['end'] - 1.0, crash(1.0)[::-1] * np.linspace(0, 1, idx(1.0)), 0.8)
place(sub, TL['end'], boom(6.0, 130, 26, 2.8), 1.0)
place(sfx, TL['end'], crash(4.5), 0.9)
for m, g in ((69, 0.18), (76, 0.14), (81, 0.14), (85, 0.1), (88, 0.08)):
    place(sfx, TL['end'], bell(mtof(m), 6.0), g)

# ─── mix ────────────────────────────────────────────────────────────────────
# pump the pads and bass under the kick
lvl = np.abs(sub).sum(1)
k = int(0.09 * SR)
sm = np.convolve(lvl, np.ones(k) / k, mode='same')
duck = 1 - 0.45 * np.clip(sm / (sm.max() + 1e-9) * 4, 0, 1)
music *= duck[:, None]


def reverb_ir(seconds=3.8, predelay=0.02):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        nz = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        ir[:, c] = lp(nz, 6500)
    ir[: int(predelay * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(0)).max()


ir = reverb_ir()
wet_in = music * 0.8 + sfx * 0.45
wet = np.stack([fftconvolve(wet_in[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
dl = int(0.375 * SR)
delay = np.zeros_like(music)
delay[dl:, 1] += music[:-dl, 0] * 0.3
delay[2 * dl:, 0] += music[:-2 * dl, 1] * 0.18

mix = music * 0.85 + delay * 0.5 + sfx * 0.9 + wet * 0.38 + hp(sub, 25) * 0.95
mix = hp(mix, 22)
tt = np.arange(N) / SR
fade = np.clip((TL['fade'][1] + 0.05 - tt) / 1.4, 0, 1) ** 1.5
mix *= fade[:, None]
peak = np.abs(mix).max()
mix = mix / peak * 1.4
mix = np.tanh(mix) / np.tanh(1.4) * 0.93

out = sys.argv[1] if len(sys.argv) > 1 else 'golden_audio.wav'
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, 'peak', peak)
