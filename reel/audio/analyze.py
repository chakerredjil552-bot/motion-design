"""Analyse the supplied track: tempo (with half/double/triplet disambiguation), beat grid, bars, drop,
and kick/snare/cowbell/hat onsets. Writes audio/work/analysis.json."""
import json
import os
import subprocess
import sys

import librosa
import numpy as np
import scipy.signal as ss

from common import TRACK, WORK

SR_A = 44100


def band_env(y, sr, lo, hi, hop):
    sos = ss.butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    x = ss.sosfiltfilt(sos, y)
    e = np.abs(ss.hilbert(x))
    e = ss.sosfiltfilt(ss.butter(2, 60, fs=sr, output="sos"), e)
    e = e[::hop]
    d = np.diff(e, prepend=e[0])
    d[d < 0] = 0
    return e, d


def peaks(d, hop, sr, pct, min_gap):
    h = np.percentile(d, pct)
    pk, props = ss.find_peaks(d, height=h, distance=max(1, int(min_gap * sr / hop)))
    return pk, props["peak_heights"]


def grid_score(times, period, tol=0.03):
    best = (0.0, 0.0)
    for ph in np.linspace(0, period, 720, endpoint=False):
        r = (times - ph) / period
        e = np.abs(r - np.round(r)) * period
        sc = float(np.mean(e < tol))
        if sc > best[0]:
            best = (sc, float(ph))
    return best


def main():
    os.makedirs(WORK, exist_ok=True)
    wav = os.path.join(WORK, "track.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", TRACK, "-ar", str(SR_A), "-ac", "2", wav], check=True)
    y, sr = librosa.load(wav, sr=SR_A, mono=True)
    dur = len(y) / sr
    hop = 128
    t = np.arange(len(y[::hop])) * hop / sr

    # --- librosa tempo candidates
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
    cands = {}
    for st in (60, 98, 120, 160):
        tempo, _ = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=512, start_bpm=st)
        cands[st] = float(np.atleast_1d(tempo)[0])

    # --- kick onsets
    hop_k = 256
    tk = np.arange(len(y[::hop_k])) * hop_k / sr
    _, dk = band_env(y, sr, 35, 150, hop_k)
    pk, _ = peaks(dk, hop_k, sr, 97, 0.2)
    kick_t = tk[pk]

    # --- tempo: scan 90-106 BPM on the eighth grid (kicks fall on beats and eighths), then least squares
    best = (0, 0, 0)
    for bpm_c in np.arange(90.0, 106.0, 0.01):
        sc, ph = grid_score(kick_t, 30.0 / bpm_c, tol=0.025)
        if sc > best[0]:
            best = (sc, bpm_c, ph)
    _, bpm_c, ph = best
    period, off = 60.0 / bpm_c, ph
    sel = kick_t
    for _ in range(3):
        n = np.round((sel - off) / (period / 2))
        A = np.vstack([n, np.ones_like(n)]).T
        (s_, c_), *_ = np.linalg.lstsq(A, sel, rcond=None)
        res = sel - (n * s_ + c_)
        keep = np.abs(res) < 0.035
        period, off = 2 * s_, c_
        sel = sel[keep]
    bpm_fit = 60 / period
    resid_ms = float(1000 * np.sqrt(np.mean(res[keep] ** 2)))
    bpm = round(bpm_fit)  # rounding changes timing by < 1 ms across the excerpt
    B = 60 / bpm
    # offset for the rounded period, then pick the quarter phase (vs the offbeat eighth) that holds most kicks
    off = float(np.median(((sel - off) + B / 4) % (B / 2) - B / 4) + off) % (B / 2)
    on = [int(np.sum(np.abs(((kick_t - o) / B) - np.round((kick_t - o) / B)) * B < 0.03)) for o in (off, off + B / 2)]
    off = off if on[0] >= on[1] else off + B / 2
    off = off % B
    off_fit = off

    # --- attack alignment: the fit locks onto the kick body (max slope of the low band), but every beat's audible
    # transient starts earlier. Measure the onset on beats that carry a kick (broadband envelope crossing 30 % of
    # its rise) and move the grid so each beat sits 2 ms after its attack onset. Beat numbering is kept (no wrap).
    hp = ss.sosfiltfilt(ss.butter(2, 40, btype="high", fs=sr, output="sos"), y)
    bb = np.convolve(np.abs(hp), np.ones(48) / 48, mode="same")
    leads = []
    for bi in range(int((dur - off) / B)):
        tg = off + bi * B
        if len(kick_t) == 0 or np.min(np.abs(kick_t - tg)) > 0.03:
            continue
        i0 = int((tg - 0.035) * sr)
        i1 = int((tg + 0.005) * sr)
        p0 = int((tg - 0.08) * sr)
        if p0 < 0 or i1 >= len(bb):
            continue
        pre = float(np.median(bb[p0:int((tg - 0.04) * sr)]))
        seg = bb[i0:i1]
        pk = float(seg.max())
        if pk < 5 * pre:
            continue
        k = int(np.argmax(seg > pre + 0.3 * (pk - pre)))
        leads.append((i0 + k) / sr - tg)
    attack_lead = float(np.median(leads)) if leads else 0.0
    off = off + attack_lead + 0.002

    # tempo hypotheses: does a kick land on (nearly) every beat of the grid?
    tests = {}
    for name, mult in (("chosen", 1.0), ("two_thirds_triplet", 2 / 3), ("double", 2.0), ("half", 0.5)):
        q = B / mult
        grid = off + q * np.arange(int((dur - off) / q))
        hit = np.array([np.min(np.abs(kick_t - g)) < 0.03 for g in grid])
        on_beat = np.mean(np.min(np.abs(kick_t[:, None] - grid[None, :]), axis=1) < 0.03)
        tests[name] = {"bpm": bpm * mult, "beats_with_kick": float(hit.mean()), "kicks_on_beat": float(on_beat)}

    # --- per-beat energy, bar phase, drop
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=256))
    f = librosa.fft_frequencies(sr=sr, n_fft=2048)
    tt = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=256)
    low = S[(f > 30) & (f < 120)].sum(0)
    nb = int((dur - off) / B)
    beat_t = off + B * np.arange(nb)
    L = np.array([low[(tt >= beat_t[i]) & (tt < beat_t[i] + B)].mean() for i in range(nb)])
    rms_db = np.array([20 * np.log10(np.sqrt(np.mean(y[int(beat_t[i] * sr):int((beat_t[i] + B) * sr)] ** 2)) + 1e-9)
                       for i in range(nb)])
    # bar phase: which beat%4 carries the strongest low end
    phase_scores = [float(np.mean(L[p::4])) for p in range(4)]
    bar_phase = int(np.argmax(phase_scores))
    # drop score on bar lines: sustained low end after, weaker before, plus a dropout on the beat before
    drops = []
    for i in range(bar_phase, nb, 4):
        if i < 12 or i + 16 > nb:
            continue
        after = L[i:i + 16].mean()
        before = L[i - 8:i].mean()
        dropout = max(0.0, (rms_db[i - 3:i - 1].mean() - rms_db[i - 1]) / 6.0)
        drops.append((float(after - before) / L.mean() + dropout, i))
    drops.sort(reverse=True)

    # --- instrument onsets (song time)
    def onset_list(lo, hi, pct, gap):
        _, d = band_env(y, sr, lo, hi, hop)
        p, h = peaks(d, hop, sr, pct, gap)
        return t[p], h / np.percentile(h, 95), d

    k_t, k_s, _ = onset_list(35, 150, 96, 0.12)
    n_t, n_s, dn = onset_list(1500, 6000, 95, 0.12)
    _, db = band_env(y, sr, 180, 350, hop)
    b_norm = db / (np.percentile(db, 99) + 1e-9)
    sn_t, sn_s = [], []
    for ti, si in zip(n_t, n_s):
        j = int(ti * sr / hop)
        body = b_norm[max(0, j - 3):j + 4].max()
        if body > 0.25:
            sn_t.append(ti)
            sn_s.append(si * min(1.0, body))
    # cowbell: tonal onsets in 500-1000 Hz (peaky spectrum)
    c_t, c_s, _ = onset_list(500, 1000, 95, 0.1)
    Sc = np.abs(librosa.stft(y, n_fft=4096, hop_length=512))
    fc = librosa.fft_frequencies(sr=sr, n_fft=4096)
    band = (fc > 500) & (fc < 1000)
    cb_t, cb_s = [], []
    for ti, si in zip(c_t, c_s):
        j = min(Sc.shape[1] - 1, int((ti + 0.02) * sr / 512))
        spec = Sc[band, j]
        peakiness = spec.max() / (spec.mean() + 1e-9)
        if peakiness > 6:
            cb_t.append(ti)
            cb_s.append(si)
    h_t, h_s, _ = onset_list(7000, 14000, 94, 0.07)

    def snap16(ts):
        g = B / 4
        out = []
        for x in ts:
            q = off + round((x - off) / g) * g
            out.append(float(q if abs(q - x) < 0.03 else x))
        return out

    # band-envelope slope peaks lag the audible attack by the same amount as the grid fit did: correct them too
    att = lambda ts: [float(x) + attack_lead + 0.002 for x in ts]
    events = {
        "kick": [snap16(att(k_t)), np.clip(k_s, 0, 1).tolist()],
        "snare": [snap16(att(sn_t)), np.clip(sn_s, 0, 1).tolist()],
        "cowbell": [snap16(att(cb_t)), np.clip(cb_s, 0, 1).tolist()],
        "hat": [snap16(att(h_t)), np.clip(h_s, 0, 1).tolist()],
    }

    out = {
        "duration_s": dur,
        "librosa_tempo_candidates": cands,
        "tempo_tests": tests,
        "bpm_fit": bpm_fit,
        "bpm_fit_resid_ms": resid_ms,
        "bpm": bpm,
        "beat_s": B,
        "offset_s": off,
        "offset_fit_s": off_fit,
        "attack_lead_ms": attack_lead * 1000,
        "attack_beats_measured": len(leads),
        "bar_phase": bar_phase,
        "drop_candidates": [{"beat": i, "time_s": float(off + i * B), "score": float(s)} for s, i in drops[:4]],
        "beat_rms_db": rms_db.round(2).tolist(),
        "events": events,
    }
    with open(os.path.join(WORK, "analysis.json"), "w") as fh:
        json.dump(out, fh, indent=1, default=float)

    print("librosa candidates:", {k: round(v, 2) for k, v in cands.items()})
    for k, v in tests.items():
        print(f"  {k:18s} {v['bpm']:7.2f} BPM: {100 * v['beats_with_kick']:3.0f}% of beats carry a kick, "
              f"{100 * v['kicks_on_beat']:3.0f}% of kicks on a beat")
    print(f"fit {bpm_fit:.3f} BPM (resid {resid_ms:.1f} ms) -> using {bpm} BPM, beat {B:.5f}s, "
          f"offset {off:.4f}s (fit {off_fit:.4f}s, attacks lead by {attack_lead * 1000:.1f} ms over {len(leads)} beats), "
          f"bar phase {bar_phase}")
    print("drops:", [(d['beat'], round(d['time_s'], 3), round(d['score'], 2)) for d in out["drop_candidates"]])
    print("events:", {k: len(v[0]) for k, v in events.items()})
    return 0


if __name__ == "__main__":
    sys.exit(main())
