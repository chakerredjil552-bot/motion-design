"""Build the timeline, the final audio mix, beats.json and the per-frame amplitude envelope.

Single source of truth for timing: everything is derived from the fitted beat grid and the
video-beat plan in common.py. Outputs:
  src/data/timeline.json   scene/marker frames + typing schedules (read by the Remotion scenes)
  src/data/beats.json      kick/snare/cowbell/hat/impact events in master frames
  src/data/envelope.json   per-frame (120 fps) amplitude envelope: full, low, mid, high
  out/audio/mix.wav        48 kHz stereo 24-bit, -14 LUFS, true peak <= -1 dBTP
"""
import json
import os
import subprocess
import sys

import numpy as np
import scipy.signal as ss
from scipy.ndimage import minimum_filter1d
import soundfile as sf

from common import (DATA, FPS, MUSIC_END_V, MUTE_V, OUT_AUDIO, PRE_DROP_BEATS, SAMPLES_PER_FRAME,
                    SLOW_END_V, SLOW_SONG_BEATS, SLOW_START_V, SONG_DROP_BEAT, SONG_START_BEAT, SR,
                    TOTAL_BEATS, TOTAL_FRAMES, WORK, load_analysis)

A = load_analysis()
BPM = A["bpm"]
B = A["beat_s"]
OFF = A["offset_s"]
FPB = FPS * B  # frames per beat
N = TOTAL_FRAMES * SAMPLES_PER_FRAME
assert SONG_DROP_BEAT - SONG_START_BEAT == PRE_DROP_BEATS
assert A["drop_candidates"][0]["beat"] == SONG_DROP_BEAT, "drop detection disagrees with the plan"


def vf(v):
    return int(round(v * FPB))


def ft(frame):
    return frame / FPS


# ----------------------------------------------------------------------------------------- timeline
RAMP_W = 0.25  # video beats of tape slow-down ramp at the bullet-time contact
R_HOLD = (SLOW_SONG_BEATS - RAMP_W / 2) / ((SLOW_END_V - SLOW_START_V) - RAMP_W / 2)


def slow_rate(x):
    """Playback rate during bullet-time; x = video beats since contact. Integrates to SLOW_SONG_BEATS."""
    x = np.asarray(x, dtype=np.float64)
    u = np.clip(x / RAMP_W, 0, 1)
    sm = u * u * (3 - 2 * u)
    return R_HOLD + (1 - R_HOLD) * (1 - sm)


# fine table of slow-mo phase (video beats -> song beats), used for both audio and event mapping
_xs = np.linspace(0, SLOW_END_V - SLOW_START_V, 200001)
_ph = np.concatenate([[0], np.cumsum((slow_rate(_xs[1:]) + slow_rate(_xs[:-1])) / 2 * np.diff(_xs))])
_ph *= SLOW_SONG_BEATS / _ph[-1]


def song_beat(v):
    v = np.asarray(v, dtype=np.float64)
    sb = np.full_like(v, np.nan)
    a = v < SLOW_START_V
    sb[a] = v[a] + SONG_START_BEAT
    b = (v >= SLOW_START_V) & (v < SLOW_END_V)
    s_contact = SLOW_START_V + SONG_START_BEAT
    sb[b] = s_contact + np.interp(v[b] - SLOW_START_V, _xs, _ph)
    c = (v >= SLOW_END_V) & (v < MUSIC_END_V)
    sb[c] = v[c] - SLOW_END_V + s_contact + SLOW_SONG_BEATS
    sb[v < 0] = np.nan
    return sb


def video_beat_of_song(sb):
    s_contact = SLOW_START_V + SONG_START_BEAT
    s_snap = s_contact + SLOW_SONG_BEATS
    s_end = s_snap + (MUSIC_END_V - SLOW_END_V)
    if sb < SONG_START_BEAT or sb >= s_end:
        return None
    if sb < s_contact:
        return sb - SONG_START_BEAT
    if sb < s_snap:
        return SLOW_START_V + float(np.interp(sb - s_contact, _ph, _xs))
    return sb - s_snap + SLOW_END_V


def typing(text, start, end, seed, spread=0.35):
    """Deterministic human-ish typing: one keystroke per character between start and end frames."""
    rng = np.random.default_rng(seed)
    w = []
    for ch in text:
        base = 1.0
        if ch == " ":
            base = 1.45
        elif ch in ".,":
            base = 1.25
        w.append(max(0.35, base * (1 + spread * rng.standard_normal())))
    w = np.array(w)
    cum = np.concatenate([[0], np.cumsum(w)])[:-1] / w.sum()
    frames = start + cum * (end - start)
    return [{"ch": ch, "f": int(round(f))} for ch, f in zip(text, frames)]


def build_timeline():
    beats = [vf(v) for v in range(TOTAL_BEATS + 1)]
    beats[-1] = TOTAL_FRAMES
    portals_v = list(range(12, 29, 2))
    panels_v = [33, 34, 35, 35.5, 36, 36.5, 36.75, 37, 37.25]
    m = {
        "teaserEnd": vf(1), "prompt": vf(1), "reply": vf(3), "warning": vf(4), "ignoring": vf(5),
        "crack": vf(6), "crack2": vf(7), "burst": vf(8), "freeze": vf(11), "drop": vf(12),
        "contact": vf(SLOW_START_V), "snap": vf(SLOW_END_V), "bulletEnd": vf(33),
        "whiteout": vf(37.5), "hardcut": vf(MUSIC_END_V), "closing": vf(40), "typeStart": vf(40.25),
        "typeEnd": vf(44), "punch": vf(46), "hold": vf(47), "glance": vf(48), "bubble": vf(49),
        "tag": vf(51), "outro": vf(55),
    }
    tl = {
        "fps": FPS, "totalFrames": TOTAL_FRAMES, "bpm": BPM, "framesPerBeat": FPB,
        "beats": beats,
        "scenes": {
            "terminal": [0, m["crack"]], "shatter": [m["crack"], m["drop"]],
            "onetake": [m["drop"], m["contact"]], "bullet": [m["contact"], m["bulletEnd"]],
            "grid": [m["bulletEnd"], m["hardcut"]], "hardcut": [m["hardcut"], m["closing"]],
            "closing": [m["closing"], m["punch"]], "punch": [m["punch"], TOTAL_FRAMES],
        },
        "marks": m,
        "portalBeats": portals_v,
        "portals": [vf(v) for v in portals_v],
        "panels": [vf(v) for v in panels_v],
        "hudEnd": m["hardcut"],
        "slow": {"startV": SLOW_START_V, "endV": SLOW_END_V, "songBeats": SLOW_SONG_BEATS, "rampW": RAMP_W},
        "typing": {
            "prompt": typing("make an ad for yourself", vf(1) + 8, vf(2.8), 11),
            "closing": typing("the smarter u are the better results u get with ai", m["typeStart"], m["typeEnd"], 23,
                              spread=0.45),
        },
        "stream": {  # AI output streamed in token chunks (no key clicks)
            "ignoring": [{"t": "ignoring", "f": vf(5)}, {"t": " warn", "f": vf(5) + 9}, {"t": "ing.", "f": vf(5) + 17}],
        },
        "copy": {
            "prompt": "> make an ad for yourself",
            "reply": "say less.",
            "warning": "this ad exceeds the legal amount of cool",
            "ignoring": "ignoring warning.",
            "closing": "the smarter u are the better results u get with ai",
            "bubble": "he forced me to say that",
            "tag": "100% code. 0% after effects.",
        },
    }
    return tl


# ----------------------------------------------------------------------------------------- DSP utils
def sos_lp(fc, order=4):
    return ss.butter(order, min(fc, SR * 0.45), btype="low", fs=SR, output="sos")


def sos_hp(fc, order=2):
    return ss.butter(order, fc, btype="high", fs=SR, output="sos")


def sos_bp(lo, hi, order=2):
    return ss.butter(order, [lo, min(hi, SR * 0.45)], btype="band", fs=SR, output="sos")


def env_exp(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def place(bus, sig, t0, pan=0.0, gain=1.0):
    """Add mono/stereo sig into stereo bus at time t0 (s) with constant-power pan."""
    if sig.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * np.sqrt(2), sig * r * np.sqrt(2)], axis=1)
    i0 = int(round(t0 * SR))
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    i1 = min(bus.shape[0], i0 + sig.shape[0])
    if i1 > i0:
        bus[i0:i1] += sig[: i1 - i0] * gain


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * peak


# ----------------------------------------------------------------------------------------- SFX
def sfx_key(rng, vel=1.0, space=False):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    click = ss.sosfilt(sos_hp(1800), rng.standard_normal(n)) * np.exp(-t / 0.0022)
    f_body = (110 if space else 170) + rng.uniform(-20, 20)
    body = np.sin(2 * np.pi * f_body * t) * np.exp(-t / (0.02 if space else 0.011)) * 0.55
    tick = np.sin(2 * np.pi * rng.uniform(2800, 3800) * t) * np.exp(-t / 0.0035) * 0.35
    rel_t = t - rng.uniform(0.028, 0.04)
    rel = np.where(rel_t > 0, ss.sosfilt(sos_hp(2500), rng.standard_normal(n)) * np.exp(-np.clip(rel_t, 0, None) / 0.0015), 0) * 0.25
    return norm(click * 0.7 + body + tick + rel) * vel


def sfx_glass(rng, size=1.0, dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = ss.sosfilt(sos_bp(1200, 9000), rng.standard_normal(n)) * np.exp(-t / (0.035 * size))
    out += ss.sosfilt(sos_lp(300), rng.standard_normal(n)) * np.exp(-t / 0.03) * 1.5 * size
    for _ in range(int(10 * size) + 4):
        f = rng.uniform(2200, 9500)
        d = rng.uniform(0.04, 0.35)
        t0 = rng.uniform(0, 0.12 * size)
        tt = np.clip(t - t0, 0, None)
        out += np.where(t > t0, np.sin(2 * np.pi * f * tt) * np.exp(-tt / d), 0) * rng.uniform(0.08, 0.3)
    return norm(out)


def sfx_tinkles(rng, dur=0.6, count=18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for _ in range(count):
        t0 = rng.uniform(0, dur * 0.7)
        f = rng.uniform(3000, 11000)
        d = rng.uniform(0.02, 0.12)
        tt = np.clip(t - t0, 0, None)
        out += np.where(t > t0, np.sin(2 * np.pi * f * tt) * np.exp(-tt / d), 0) * rng.uniform(0.2, 1)
    return norm(out)


def sfx_riser(rng, dur, f0=350, f1=7000):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 512
    zi = None
    for i in range(0, n, blk):
        p = i / n
        fc = f0 * (f1 / f0) ** p
        sos = sos_bp(fc * 0.7, fc * 1.4)
        if zi is None:
            zi = ss.sosfilt_zi(sos) * 0
        seg, zi = ss.sosfilt(sos, x[i:i + blk], zi=zi)
        out[i:i + blk] = seg
    p = np.arange(n) / n
    return norm(out * p ** 2.2)


def sfx_whoosh(rng, dur=0.5, f0=500, f1=3500):
    n = int(dur * SR)
    x = ss.sosfilt(sos_bp(f0, f1), rng.standard_normal(n))
    p = np.arange(n) / n
    env = np.sin(np.pi * p) ** 2.5
    return norm(x * env)


def sfx_sub(f0, f1, dur, tau, drive=2.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.25))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / tau)
    x *= np.clip(t / 0.002, 0, 1)
    return np.tanh(drive * x) / np.tanh(drive)


def sfx_impact(rng, big=1.0):
    dur = 1.8 if big > 0.8 else 0.9
    n = int(dur * SR)
    t = np.arange(n) / SR
    sub = sfx_sub(90 * (1 + 0.4 * big), 30, dur, 0.35 + 0.5 * big, drive=3)
    crack = ss.sosfilt(sos_hp(900), rng.standard_normal(n)) * np.exp(-t / (0.02 + 0.03 * big))
    thump = ss.sosfilt(sos_bp(120, 900), rng.standard_normal(n)) * np.exp(-t / 0.06)
    ring = np.sin(2 * np.pi * 1180 * t) * np.exp(-t / 0.25) * 0.15 + np.sin(2 * np.pi * 1730 * t) * np.exp(-t / 0.18) * 0.1
    x = sub * 1.1 + crack * 0.8 + thump * 0.6 + ring * big
    x = np.tanh(1.6 * x)
    left = x + 0.15 * ss.sosfilt(sos_hp(2000), rng.standard_normal(n)) * np.exp(-t / 0.3) * big
    right = x + 0.15 * ss.sosfilt(sos_hp(2000), rng.standard_normal(n)) * np.exp(-t / 0.3) * big
    return norm(np.stack([left, right], axis=1))


def sfx_reverse_swell(rng, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = ss.sosfilt(sos_bp(400, 9000), rng.standard_normal(n)) * np.exp(-t / (dur * 0.35))
    x += np.sin(2 * np.pi * 220 * t) * np.exp(-t / (dur * 0.3)) * 0.4
    return norm(x[::-1])


def sfx_slap(rng, pitch=1.0):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    paper = ss.sosfilt(sos_bp(1400 * pitch, 6000), rng.standard_normal(n)) * np.exp(-t / 0.018)
    thump = np.sin(2 * np.pi * 130 * pitch * t) * np.exp(-t / 0.035)
    return norm(paper * 0.8 + thump)


def sfx_glitch(rng, dur):
    n = int(dur * SR)
    out = np.zeros(n)
    i = 0
    while i < n:
        seg = int(rng.uniform(0.006, 0.022) * SR)
        kind = rng.integers(0, 3)
        t = np.arange(seg) / SR
        if kind == 0:
            s = np.sign(np.sin(2 * np.pi * rng.uniform(200, 2400) * t))
        elif kind == 1:
            s = rng.standard_normal(seg)
            hold = int(rng.integers(4, 30))
            s = np.repeat(s[::hold], hold)[:seg]
        else:
            s = np.zeros(seg)
        out[i:i + seg] = s[: n - i] * rng.uniform(0.3, 1)
        i += seg
    return norm(ss.sosfilt(sos_lp(9000), out))


def sfx_boing(rng):
    dur = 0.55
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 260 + 520 * (1 - np.exp(-t / 0.06)) + 60 * np.sin(2 * np.pi * 11 * t) * np.exp(-t / 0.2)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    return norm(x)


def sfx_pop(rng, f0=700, f1=1500):
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (t / t[-1])
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.02)
    return norm(x + 0.3 * ss.sosfilt(sos_hp(3000), rng.standard_normal(n)) * np.exp(-t / 0.003))


def sfx_cricket(rng):
    out = []
    for chirp in range(2):
        for p in range(3):
            n = int(0.018 * SR)
            t = np.arange(n) / SR
            out.append(np.sin(2 * np.pi * 4700 * t) * np.sin(np.pi * t / t[-1]))
            out.append(np.zeros(int(0.012 * SR)))
        out.append(np.zeros(int(0.16 * SR)))
    return norm(np.concatenate(out))


def sfx_tick(rng):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.008) + 0.4 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.012))


def sfx_alert(rng):
    n = int(0.26 * SR)
    t = np.arange(n) / SR
    f = np.where(t < 0.13, 880, 660)
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.6
    x = np.repeat(x[::6], 6)[:n]
    env = np.minimum(1, t / 0.003) * np.where((t % 0.13) < 0.11, 1, 0)
    return norm(ss.sosfilt(sos_lp(5000), x * env))


def build_sfx(tl):
    rng = np.random.default_rng(98)
    bus = np.zeros((N, 2))
    m = tl["marks"]
    # teaser: reverse of the snap hit, sucking into the terminal cut
    rev = sfx_impact(np.random.default_rng(7), 1.0)[::-1]
    place(bus, rev[-int(ft(m["teaserEnd"]) * SR):], 0, gain=0.35)
    # S1 typing clicks
    for i, k in enumerate(tl["typing"]["prompt"]):
        place(bus, sfx_key(np.random.default_rng(1000 + i), 0.9, k["ch"] == " "), ft(k["f"]), pan=rng.uniform(-0.25, 0.25), gain=0.22)
    place(bus, sfx_pop(rng, 300, 180) * 0.8, ft(m["reply"]), gain=0.25)
    place(bus, sfx_alert(rng), ft(m["warning"]), gain=0.12)
    for s in tl["stream"]["ignoring"]:
        place(bus, sfx_tick(rng), ft(s["f"]), gain=0.08)
    # S2 shatter
    place(bus, sfx_glass(np.random.default_rng(3), 1.0), ft(m["crack"]), gain=0.5)
    place(bus, sfx_glass(np.random.default_rng(4), 0.6), ft(m["crack2"]), pan=0.3, gain=0.35)
    place(bus, sfx_glass(np.random.default_rng(5), 1.6, 1.2), ft(m["burst"]), gain=0.55)
    for i in range(3):
        place(bus, sfx_tinkles(np.random.default_rng(40 + i)), ft(m["burst"] + 25 * i + 10), pan=(-0.6, 0.6, 0)[i], gain=0.2)
    riser = sfx_riser(np.random.default_rng(6), ft(m["freeze"] - m["burst"]))
    place(bus, riser, ft(m["burst"]), gain=0.3)
    # drop boom (layered under the song's own drop kick)
    place(bus, sfx_impact(np.random.default_rng(8), 0.7), ft(m["drop"]), gain=0.45)
    # portal whooshes
    for i, pf in enumerate(tl["portals"][1:]):
        w = sfx_whoosh(np.random.default_rng(60 + i), 0.42, 500 + 120 * i, 3500 + 300 * i)
        place(bus, w, ft(pf) - 0.3, pan=(-0.5 if i % 2 else 0.5), gain=0.16)
    # bullet-time
    place(bus, sfx_impact(np.random.default_rng(9), 0.6), ft(m["contact"]), gain=0.5)
    sw = sfx_reverse_swell(np.random.default_rng(10), 0.55)
    place(bus, sw, ft(m["snap"]) - 0.55, gain=0.35)
    place(bus, sfx_impact(np.random.default_rng(11), 1.0), ft(m["snap"]), gain=0.85)
    # grid slams, accelerating, rising pitch
    for i, pf in enumerate(tl["panels"]):
        place(bus, sfx_slap(np.random.default_rng(80 + i), 1 + 0.07 * i), ft(pf), pan=((i % 3) - 1) * 0.4, gain=0.3)
    wo = sfx_riser(np.random.default_rng(12), ft(m["hardcut"] - m["whiteout"]), 2000, 12000)
    place(bus, wo, ft(m["whiteout"]), gain=0.28)
    # freeze: one beat of true silence (the shatter tails are cut too)
    a = int(MUTE_V[0] * B * SR)
    b = int((MUTE_V[1] * B - 0.006) * SR)
    fade = int(0.003 * SR)
    bus[a - fade:a] *= np.linspace(1, 0, fade)[:, None]
    bus[a:b] = 0
    # hard cut: everything dies at the hard-cut frame
    bus[int(ft(m["hardcut"]) * SR): int(ft(m["closing"]) * SR)] = 0
    # S7 closing typing
    for i, k in enumerate(tl["typing"]["closing"]):
        place(bus, sfx_key(np.random.default_rng(2000 + i), 1.0, k["ch"] == " "), ft(k["f"]), pan=rng.uniform(-0.3, 0.3), gain=0.32)
    # S8 punchline
    place(bus, sfx_glitch(np.random.default_rng(13), 0.12), ft(m["punch"]), gain=0.25)
    place(bus, sfx_boing(rng), ft(m["punch"]) + 0.03, gain=0.3)
    place(bus, sfx_cricket(rng), ft(m["hold"]) + 0.1, pan=0.4, gain=0.05)
    place(bus, sfx_whoosh(np.random.default_rng(14), 0.18, 1500, 7000), ft(m["glance"]) - 0.05, pan=-0.4, gain=0.12)
    place(bus, sfx_tick(rng), ft(m["glance"]) + 0.08, gain=0.12)
    place(bus, sfx_pop(rng), ft(m["bubble"]), gain=0.25)
    place(bus, sfx_pop(rng, 1200, 1800) * 0.5, ft(m["tag"]), gain=0.18)
    place(bus, sfx_glitch(np.random.default_rng(15), ft(TOTAL_FRAMES - m["outro"])) * np.linspace(0.2, 1, int(ft(TOTAL_FRAMES - m["outro"]) * SR))[:, None].mean(1),
          ft(m["outro"]), gain=0.22)
    return bus


# ----------------------------------------------------------------------------------------- music
def build_music(tl):
    song, sr0 = sf.read(os.path.join(WORK, "track.wav"), always_2d=True)
    assert sr0 == 44100
    up = ss.resample_poly(song, 640, 147, axis=0)  # 44.1k -> 192k
    sr_up = 192000
    tau = np.arange(N) / SR
    v = tau / B
    sb = song_beat(v)
    ts = OFF + sb * B
    have = ~np.isnan(ts)
    pos = np.where(have, ts * sr_up, 0)
    i0 = np.clip(np.floor(pos).astype(np.int64), 0, len(up) - 2)
    fr = (pos - i0)[:, None]
    music = (up[i0] * (1 - fr) + up[i0 + 1] * fr) * have[:, None]

    # S1: filtered beat creeps in (low-pass sweep + gain ramp) until the 'ignoring' mark
    end_sweep = int(ft(tl["marks"]["ignoring"]) * SR)
    blk = 256
    zi = None
    out = music.copy()
    for i in range(0, end_sweep, blk):
        p = min(1.0, i / end_sweep)
        e = p ** 1.7
        fc = 180 * (17000 / 180) ** e
        sos = sos_lp(fc, 4)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2, 2))
        for ch in range(2):
            out[i:i + blk, ch], zi[:, :, ch] = ss.sosfilt(sos, music[i:i + blk, ch], zi=zi[:, :, ch])
        out[i:i + blk] *= 10 ** ((-16 * (1 - p) ** 1.5) / 20)
    # crossfade from the swept signal to dry over 20 ms to avoid a filter-release click
    xf = int(0.02 * SR)
    ramp = np.linspace(0, 1, xf)[:, None]
    out[end_sweep:end_sweep + xf] = out[end_sweep:end_sweep + xf] * (1 - ramp) + music[end_sweep:end_sweep + xf] * ramp
    music = out

    # one beat of true silence before the drop (keep the drop transient intact)
    a = int(MUTE_V[0] * B * SR)
    b = int((MUTE_V[1] * B - 0.006) * SR)
    fade = int(0.003 * SR)
    music[a - fade:a] *= np.linspace(1, 0, fade)[:, None]
    music[a:b] = 0
    music[b:b + int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]

    # bullet-time: darker, slowed audio, dry again at the snap
    s0 = int(SLOW_START_V * B * SR)
    s1 = int(SLOW_END_V * B * SR)
    seg = music[s0:s1]
    dark = ss.sosfiltfilt(sos_lp(2600, 2), seg, axis=0)
    wet = np.clip((np.arange(s1 - s0) / SR) / (RAMP_W * B), 0, 1)[:, None] * 0.65
    music[s0:s1] = seg * (1 - wet) + dark * wet * 1.15

    # hard cut: music dies dead right before the downbeat's attack (beats sit 2 ms after the attack onset)
    cut = int((MUSIC_END_V * B - 0.003) * SR)
    music[cut - int(0.001 * SR):cut] *= np.linspace(1, 0, int(0.001 * SR))[:, None]
    music[cut:] = 0
    return music


# ----------------------------------------------------------------------------------------- loudness
def ffmpeg_loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                        "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    j = json.loads(txt[txt.rindex("{"): txt.rindex("}") + 1])
    return float(j["input_i"]), float(j["input_tp"])


def true_peak_limit(x, ceiling_db=-1.3):
    c = 10 ** (ceiling_db / 20)
    os4 = ss.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(os4).max(axis=1).reshape(-1, 4).max(axis=1)[: len(x)]
    g = np.minimum(1.0, c / (pk + 1e-12))
    look = int(0.0015 * SR)
    g = minimum_filter1d(g, size=2 * look + 1)  # lookahead: gain is already down when the peak arrives
    rel = np.exp(-1 / (0.06 * SR))
    sm = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else cur * rel + g[i] * (1 - rel)
        sm[i] = cur
    return x * sm[:, None]


def main():
    os.makedirs(OUT_AUDIO, exist_ok=True)
    os.makedirs(DATA, exist_ok=True)
    tl = build_timeline()
    with open(os.path.join(DATA, "timeline.json"), "w") as fh:
        json.dump(tl, fh, indent=1)

    music = build_music(tl)
    sfx = build_sfx(tl)
    mix = music * 1.0 + sfx * 0.7
    hc = int(ft(tl["marks"]["hardcut"]) * SR)
    cl = int(ft(tl["marks"]["closing"]) * SR)
    mix[hc:cl] = 0.0  # digital silence for the hard cut

    tmp = os.path.join(WORK, "premix.wav")
    sf.write(tmp, mix, SR, subtype="FLOAT")
    li, _ = ffmpeg_loudness(tmp)
    mix *= 10 ** ((-14.0 - li) / 20)
    for _ in range(3):
        mix = true_peak_limit(mix, -1.3)
        sf.write(tmp, mix, SR, subtype="FLOAT")
        li, tp = ffmpeg_loudness(tmp)
        if abs(li + 14) < 0.3 and tp <= -1.0:
            break
        mix *= 10 ** ((-14.0 - li) / 20)
    mix[hc:cl] = 0.0
    final = os.path.join(OUT_AUDIO, "mix.wav")
    sf.write(final, mix, SR, subtype="PCM_24")
    li, tp = ffmpeg_loudness(final)
    print(f"mix: {N / SR:.3f}s  integrated {li:.2f} LUFS  true peak {tp:.2f} dBTP")

    # ------------------------------------------------------------------ envelope (per master frame)
    mono = mix.mean(axis=1)
    bands = {
        "full": mono,
        "low": ss.sosfiltfilt(sos_lp(150, 4), mono),
        "mid": ss.sosfiltfilt(sos_bp(150, 2000, 2), mono),
        "high": ss.sosfiltfilt(sos_hp(2000, 4), mono),
    }
    win = 2 * SAMPLES_PER_FRAME
    env = {}
    music_frames = tl["marks"]["hardcut"]
    for k, x in bands.items():
        p = np.pad(x ** 2, (win, win))
        c = np.cumsum(p)
        centers = np.arange(TOTAL_FRAMES) * SAMPLES_PER_FRAME + SAMPLES_PER_FRAME // 2 + win
        r = np.sqrt((c[centers + win // 2] - c[centers - win // 2]) / win)
        ref = np.percentile(r[:music_frames], 99) + 1e-9
        env[k] = np.round(np.clip(r / ref, 0, 1.5), 3).tolist()
    with open(os.path.join(DATA, "envelope.json"), "w") as fh:
        json.dump({"fps": FPS, "frames": TOTAL_FRAMES, "normalisedTo": "99th percentile of the music section",
                   **env}, fh, separators=(",", ":"))

    # ------------------------------------------------------------------ beats.json
    events = {}
    gain_lookup = lambda fr: 10 ** ((-16 * max(0.0, 1 - fr / tl["marks"]["ignoring"]) ** 1.5) / 20)
    for name, (times, strengths) in A["events"].items():
        lst = []
        for tsong, s in zip(times, strengths):
            sb = (tsong - OFF) / B
            vb = video_beat_of_song(sb)
            if vb is None or MUTE_V[0] <= vb < MUTE_V[1]:
                continue
            fr = int(round(vb * FPB))
            if fr >= tl["marks"]["hardcut"]:
                continue
            g = gain_lookup(fr)
            lst.append({"f": fr, "s": round(float(s) * g, 3), "beat": round(float(vb), 3)})
        lst.sort(key=lambda e: e["f"])
        events[name] = lst
    m = tl["marks"]
    events["impact"] = [{"f": m["drop"], "s": 1.0}, {"f": m["contact"], "s": 0.8}, {"f": m["snap"], "s": 1.0}]
    events["slam"] = [{"f": f, "s": round(0.55 + 0.05 * i, 2)} for i, f in enumerate(tl["panels"])]
    beats = {
        "fps": FPS, "bpm": BPM, "framesPerBeat": FPB, "totalFrames": TOTAL_FRAMES,
        "song": {"offsetS": OFF, "startBeat": SONG_START_BEAT, "dropBeat": SONG_DROP_BEAT,
                 "excerptS": [OFF + SONG_START_BEAT * B, OFF + (SONG_START_BEAT + MUSIC_END_V - (SLOW_END_V - SLOW_START_V) + SLOW_SONG_BEATS) * B]},
        "beats": tl["beats"],
        "bars": tl["beats"][::4],
        "musicEndFrame": m["hardcut"],
        "events": events,
    }
    with open(os.path.join(DATA, "beats.json"), "w") as fh:
        json.dump(beats, fh, indent=1)
    print("events:", {k: len(v) for k, v in events.items()})
    print("song excerpt: %.3f -> %.3f s" % tuple(beats["song"]["excerptS"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
