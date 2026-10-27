#!/usr/bin/env python3
"""Bab El Bahr soundtrack: original score (maqam Hijaz on D) plus synced effects.

Writes a 20 s, 48 kHz stereo WAV. Everything is synthesized here; no samples or
existing recordings are used.  Usage: python3 audio.py out.wav
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)
music_L = np.zeros(N)
music_R = np.zeros(N)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def fftfilt(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    f[0] = 1e-3
    H = np.ones_like(f)
    if hi:
        H /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        H /= np.sqrt(1 + (lo / f) ** (2 * order))
    return np.fft.irfft(X * H, len(x))


def env(n, a, r, sustain=1.0):
    e = np.ones(n) * sustain
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, sustain, na)
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def add(sig, t, gain=1.0, pan=0.0, music=False):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    if music:
        music_L[i:i + len(sig)] += sig * lg
        music_R[i:i + len(sig)] += sig * rg
    else:
        L[i:i + len(sig)] += sig * lg
        R[i:i + len(sig)] += sig * rg


def pluck(freq, dur, decay=0.996, soft=6):
    """Karplus-Strong string, vectorized one period at a time."""
    p = max(2, int(round(SR / freq)))
    n = int(dur * SR)
    y = np.zeros(n + p)
    burst = rng.uniform(-1, 1, p)
    for _ in range(soft):  # soften the excitation (oud = felt-ish, qanun = brighter)
        burst = 0.5 * (burst + np.roll(burst, 1))
    y[:p] = burst
    for s in range(p, n + p, p):
        e = min(s + p, n + p)
        a = y[s - p:e - p]
        b = y[s - p - 1:e - p - 1] if s - p - 1 >= 0 else np.concatenate(([0.0], y[s - p:e - p - 1]))
        y[s:e] = decay * 0.5 * (a + b[: len(a)])
    y = y[:n]
    return y / (np.max(np.abs(y)) + 1e-9)


def oud(m, dur, trem=False):
    f = midi(m)
    if not trem:
        s = pluck(f, dur + 0.6, 0.9965, soft=5)
    else:  # risha tremolo: rapid repeated plucks
        n = int((dur + 0.6) * SR)
        s = np.zeros(n)
        k, t = 0, 0.0
        while t < dur:
            p = pluck(f, 0.5, 0.995, soft=5) * (0.75 if k % 2 else 1.0)
            i = int(t * SR)
            s[i:i + len(p)] += p[: n - i]
            t += 0.072
            k += 1
        s /= np.max(np.abs(s)) + 1e-9
    s = fftfilt(s, lo=90, hi=2800)
    body = fftfilt(s, lo=180, hi=420)  # wooden body resonance
    return (s + 0.6 * body) * env(len(s), 0.004, 0.5)


def qanun(m, dur=0.45):
    s = pluck(midi(m), dur + 0.5, 0.998, soft=1)
    return fftfilt(s, lo=200, hi=7000) * env(len(s), 0.002, 0.3)


def pad(notes, t0, t1, gain, a=1.2, r=1.5):
    n = int((t1 - t0 + r) * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f0 = midi(m)
        for det in (-0.08, 0.0, 0.07):
            f = f0 * 2 ** (det / 12) * (1 + 0.003 * np.sin(2 * np.pi * 5.1 * tt + m))
            ph = 2 * np.pi * np.cumsum(f) / SR
            for h in range(1, 10):  # band-limited saw
                out += np.sin(h * ph) / h
    out = fftfilt(out, lo=80, hi=1800)
    out *= env(n, a, r)
    out /= np.max(np.abs(out)) + 1e-9
    return out * gain


def noise(dur, lo=None, hi=None, order=2):
    return fftfilt(rng.uniform(-1, 1, int(dur * SR)), lo, hi, order)


def dum(gain=1.0):
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    f = 55 + 70 * np.exp(-tt * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6)
    s += 0.25 * noise(0.6, 60, 400) * np.exp(-tt * 30)
    return s * gain


def tek(gain=1.0):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    s = noise(0.12, 2000, 8000) * np.exp(-tt * 60)
    s += 0.3 * np.sin(2 * np.pi * 900 * tt) * np.exp(-tt * 50)
    return s * gain


def gull(t, pan, gain=0.12):
    for k in range(2):
        d = 0.32
        n = int(d * SR)
        tt = np.arange(n) / SR
        u = tt / d
        f = 1600 + 1100 * np.sin(np.pi * u) * (1 - 0.4 * u)
        ph = 2 * np.pi * np.cumsum(f) / SR
        s = np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
        s *= np.sin(np.pi * u) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 28 * tt))
        add(fftfilt(s, 600, 6000), t + k * 0.38, gain * (1 - 0.3 * k), pan)


# ---------------- score ----------------
D3, Eb3, Fs3, G3, A3, Bb3, C4, D4 = 50, 51, 54, 55, 57, 58, 60, 62
melody = [  # (time, note, dur, tremolo)
    (0.4, D3, 1.5, True), (2.0, A3, .4, False), (2.4, Bb3, .3, False), (2.7, A3, .8, True),
    (3.6, G3, .3, False), (3.9, Fs3, .3, False), (4.2, Eb3, .4, False), (4.6, D3, 1.0, True),
    (5.8, Fs3, .3, False), (6.1, G3, .3, False), (6.4, A3, .8, True), (7.2, Bb3, .3, False),
    (7.5, C4, .3, False), (7.8, Bb3, .3, False), (8.1, A3, .7, True), (8.8, G3, .3, False),
    (9.1, Fs3, .3, False), (9.4, G3, .3, False), (9.7, A3, .3, False),
    (13.2, D4, .8, True), (14.0, C4, .3, False), (14.3, Bb3, .3, False), (14.6, A3, .4, False),
    (15.0, D4, .5, True), (15.5, A3, .5, False), (16.0, Bb3, .4, False), (16.4, A3, .4, False),
    (16.8, G3, .4, False), (17.2, Fs3, .4, False), (17.6, Eb3, .4, False), (18.0, D3, 1.6, True),
]
for t, m, d, tr in melody:
    add(oud(m, d, tr), t, 0.30, -0.15, music=True)
add(oud(D3 - 12, 1.8), 18.0, 0.22, 0.0, music=True)

for start in (6.2, 8.25, 16.2):  # qanun runs
    run = [D4, Eb3 + 12, Fs3 + 12, G3 + 12, A3 + 12, Bb3 + 12, A3 + 12, Fs3 + 12]
    for k, m in enumerate(run):
        add(qanun(m), start + k * 0.085, 0.12, 0.35, music=True)

add(pad([D3, A3, Fs3 + 12], 3.0, 6.0, 0.10, a=1.5), 3.0, 1, 0, True)
add(pad([G3 - 12, G3, Bb3, D4], 6.0, 8.0, 0.12), 6.0, 1, 0, True)
add(pad([D3 - 12, D3, Fs3, A3], 8.0, 9.9, 0.12, r=0.4), 8.0, 1, 0, True)
add(pad([G3 - 12, G3, Bb3, D4], 13.0, 15.0, 0.16, a=1.6), 13.0, 1, 0, True)
add(pad([C4 - 24, C4 - 12, Eb3, G3, C4], 15.0, 17.0, 0.22, a=0.05), 15.0, 1, 0, True)
add(pad([D3 - 12, D3, Fs3, A3, D4], 17.0, 19.6, 0.17, a=0.8, r=1.2), 17.0, 1, 0, True)

for t in np.arange(6.0, 9.8, 1.5):  # darbuka heartbeat
    add(dum(0.32), t, 1, -0.1, True)
    add(dum(0.22), t + 0.27, 1, -0.1, True)
    add(tek(0.08), t + 0.75, 1, 0.2, True)
for t in np.arange(13.0, 15.0, 0.75):
    add(dum(0.45), t, 1, 0, True)
    add(tek(0.12), t + 0.375, 1, 0.2, True)
for t in np.arange(15.5, 17.0, 0.375):
    add(tek(0.1), t, 1, 0.25, True)
for t in (15.5, 16.25, 17.0, 18.5):
    add(dum(0.4), t, 1, 0, True)

# reverb on the music bus (decaying noise impulse response)
ir_n = int(2.4 * SR)
ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / SR * 2.6)
ir = fftfilt(ir, 200, 5000)
ir /= np.sqrt(np.sum(ir ** 2))
for bus, dry in ((music_L, L), (music_R, R)):
    wet = np.fft.irfft(np.fft.rfft(bus, N + ir_n) * np.fft.rfft(ir, N + ir_n), N + ir_n)[:N]
    # music drops out for the silent moment (10-13 s), back at 13 s
    duck = np.ones(N)
    a, b, c = int(9.9 * SR), int(10.3 * SR), int(13.0 * SR)
    duck[a:b] = np.linspace(1, 0, b - a)
    duck[b:c] = 0
    dry += (bus + 0.35 * wet) * duck

# ---------------- effects ----------------
tt = np.arange(N) / SR
wind = noise(DUR, 80, 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * tt) * np.sin(2 * np.pi * 0.07 * tt + 1))
wind_lvl = np.interp(tt, [0, 3, 3.01, 13, 13.01, 15.6, 17, 17.01, 19.3, 19.31, 20], [.06, .06, .02, .02, .1, .2, .08, .02, .02, .06, .06])
gust = noise(DUR, 300, 2500) * np.interp(tt, [13, 13.5, 15.0, 15.6, 16.5], [0, .08, .12, .05, 0])
L += wind * wind_lvl + gust
R += np.roll(wind, 3000) * wind_lvl + np.roll(gust, 2000)

sea = noise(DUR, 100, 1500) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.18 * tt) ** 2)
sea_lvl = np.interp(tt, [0, 2.8, 3.0, 19.0, 19.3, 20], [.07, .07, 0, 0, .07, .07])
L += sea * sea_lvl
R += np.roll(sea, 5000) * sea_lvl

# engine: distant in shot 1, cabin hum in shots 2-4 and 6
eng = np.zeros(N)
for h, a in ((1, 1), (2, .6), (3, .35), (4, .2)):
    eng += a * np.sin(2 * np.pi * 37 * h * tt + 0.3 * np.sin(2 * np.pi * 0.7 * tt))
eng = fftfilt(eng + 0.5 * noise(DUR, 30, 300), hi=400)
eng_lvl = np.interp(tt, [0, 3, 3.01, 12.9, 13.0, 17.0, 17.01, 19.2, 19.4, 20], [.012, .02, .07, .07, 0, 0, .04, .04, 0, 0])
L += eng * eng_lvl
R += eng * eng_lvl

for t0 in (3.45, 4.66, 5.87):  # bead clicks at the ends of each swing
    for k in range(4):
        n = int(0.03 * SR)
        add(noise(0.03, 2500, 9000) * np.exp(-np.arange(n) / SR * 200), t0 + k * 0.045 + rng.uniform(0, .02), 0.09, 0.05)
chime = np.arange(int(1.2 * SR)) / SR  # the glint on the bead
add((np.sin(2 * np.pi * 2637 * chime) + 0.5 * np.sin(2 * np.pi * 3951 * chime)) * np.exp(-chime * 4), 4.05, 0.035, 0.1)

for t, p in ((0.6, -.5), (1.5, .4), (2.4, -.2), (17.3, .5), (19.4, -.4)):
    gull(t, p)

street = noise(4.0, 300, 3000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 4.7 * np.arange(int(4 * SR)) / SR)) * rng.uniform(.6, 1))
add(fftfilt(street, hi=1200) * env(len(street), .3, .4), 6.0, 0.05, 0.3)
for t in (7.1, 7.63, 8.16):  # the boy's ball against the wall, muffled by the glass
    n = int(0.15 * SR)
    add(np.sin(2 * np.pi * 110 * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 40), t, 0.06, 0.4)
sc = np.arange(int(1.2 * SR)) / SR  # a scooter passing
scooter = np.sign(np.sin(2 * np.pi * np.cumsum(95 + 15 * np.sin(np.pi * sc / 1.2)) / SR))
add(fftfilt(scooter, 80, 900) * np.sin(np.pi * sc / 1.2) ** 2, 8.5, 0.025, -0.5)

for t, d, g in ((10.85, .55, .05), (12.35, .9, .04)):  # her inhale, a shaky exhale
    b = noise(d, 400, 3500)
    shake = 1 + 0.3 * np.sin(2 * np.pi * 9 * np.arange(len(b)) / SR) if t > 12 else 1
    add(b * np.sin(np.pi * np.arange(len(b)) / len(b)) * shake, t, g, 0.2)

n = int(1.5 * SR)  # impact frame
ti = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-ti * 10)) / SR) * np.exp(-ti * 2.5)
add(np.tanh(2.5 * boom) + 0.4 * noise(1.5, 40, 2000) * np.exp(-ti * 12), 15.0, 0.4, 0)
n = int(0.5 * SR)  # whip-pan whoosh
tw = np.arange(n) / SR
wh = sum(noise(0.5, lo, lo * 2.5) * np.exp(-((tw - k * 0.08) / 0.09) ** 2) for k, lo in enumerate((300, 600, 1200, 2400, 4000)))
add(wh, 15.02, 0.35, 0)

pl = np.arange(int(5.0 * SR)) / SR  # plane roar, then far away
roar = fftfilt(rng.normal(0, 1, len(pl)).cumsum(), 30, 1500)
roar /= np.max(np.abs(roar))
whine = np.sin(2 * np.pi * np.cumsum(1250 + 250 * pl / 5) / SR) * 0.15
plane = (roar + whine) * np.interp(pl, [0, .8, 2.0, 2.4, 5.0], [0, 1, .8, .15, 0])
add(plane, 15.25, 0.22, 0.3)

# ---------------- master ----------------
mix = np.stack([L, R])
fade = np.interp(tt, [0, 0.3, 19.55, 20], [0, 1, 1, 0])
mix *= fade
mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.6) * 0.89  # gentle limiter
data = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print('wrote', sys.argv[1])
