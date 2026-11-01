"""Automated QA for the rendered Reel. Exits non-zero if any check fails.

Checks: ffprobe specs (master 1080x1920 120 fps 4116 frames yuv420p H.264 + AAC 48 kHz; Reels cut 60 fps H.264
~15-20 Mbps; 30 fps fallback), A/V length match, blackdetect/freezedetect only inside intentional windows,
loudness ~-14 LUFS with true peak <= -1 dBTP, drop / snap / hard-cut landing on their frames (audio and
picture), stills at every portal transition and key beat with safe-zone guides for review.
"""
import json
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
TL = json.load(open(os.path.join(ROOT, "src", "data", "timeline.json")))
M = TL["marks"]
FPS = 120
TOTAL = TL["totalFrames"]
MASTER = os.path.join(OUT, "claude-code-reel_master_120fps.mp4")
REELS = os.path.join(OUT, "claude-code-reel_reels_60fps.mp4")
FALLBACK = os.path.join(OUT, "claude-code-reel_fallback_30fps.mp4")

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"  — {detail}" if detail else ""))


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def streams(info, kind):
    return [s for s in info["streams"] if s["codec_type"] == kind]


def spec_checks(path, label, fps, frames, bitrate=None):
    if not os.path.exists(path):
        check(f"{label}: file exists", False, path)
        return
    info = probe(path)
    v = streams(info, "video")[0]
    a = streams(info, "audio")[0]
    rate = v["r_frame_rate"]
    num, den = map(int, rate.split("/"))
    check(f"{label}: 1080x1920", (v["width"], v["height"]) == (1080, 1920), f"{v['width']}x{v['height']}")
    check(f"{label}: {fps} fps", abs(num / den - fps) < 1e-6, rate)
    check(f"{label}: H.264 (not HEVC)", v["codec_name"] == "h264", v["codec_name"])
    check(f"{label}: yuv420p", v["pix_fmt"] == "yuv420p", v["pix_fmt"])
    check(f"{label}: {frames} frames", int(v["nb_read_frames"]) == frames, v["nb_read_frames"])
    check(f"{label}: AAC 48 kHz stereo", a["codec_name"] == "aac" and a["sample_rate"] == "48000" and a["channels"] == 2,
          f"{a['codec_name']} {a['sample_rate']} {a['channels']}ch")
    vd = float(v["duration"])
    ad = float(a["duration"])
    check(f"{label}: audio/video lengths match", abs(vd - ad) <= 0.03, f"video {vd:.3f}s audio {ad:.3f}s")
    if bitrate:
        br = float(v.get("bit_rate", 0)) / 1e6
        check(f"{label}: video bitrate {bitrate[0]}-{bitrate[1]} Mbps", bitrate[0] <= br <= bitrate[1], f"{br:.1f} Mbps")
    else:
        br = float(v.get("bit_rate", 0)) / 1e6
        check(f"{label}: high bitrate (>= 30 Mbps)", br >= 30, f"{br:.1f} Mbps")


def intervals(path, filt, key_start, key_end):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vf", filt, "-an", "-f", "null", "-"],
                       capture_output=True, text=True)
    starts = [float(x) for x in re.findall(rf"{key_start}:\s*([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(rf"{key_end}:\s*([\d.]+)", r.stderr)]
    return list(zip(starts, ends + [None] * (len(starts) - len(ends))))


def within(iv, windows, tol=2 / FPS):
    s, e = iv
    e = e if e is not None else TOTAL / FPS
    return any(s >= a - tol and e <= b + tol for a, b in windows)


def frame_luma(path, frame, fps):
    t = (frame - 0.25) / fps  # input seek returns the first frame with pts >= t: (k-0.25)/fps -> frame k
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.5f}", "-i", path, "-frames:v", "1", "-vf", "scale=108:192,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True, check=True)
    return float(np.frombuffer(r.stdout, dtype=np.uint8).mean())


SR = 48000
B_S = 60.0 / TL["bpm"]


def decode_audio(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:a", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).astype(np.float64)


def hf_onset(sig, frame, pre=0.03, post=0.03):
    """first 0.5 ms step where the >2 kHz RMS (2 ms) jumps above 3x its recent median and 25 % of the local max"""
    import scipy.signal as ss
    hp = ss.sosfiltfilt(ss.butter(4, 2000, btype="high", fs=SR, output="sos"), sig)
    c = frame / FPS
    ts = np.arange(c - pre - 0.03, c + post, 0.0005)
    w = int(0.002 * SR)
    rms = np.array([np.sqrt(np.mean(hp[int(t * SR):int(t * SR) + w] ** 2)) for t in ts])
    base_n = int(0.03 / 0.0005)
    base = np.median(rms[:base_n]) + 1e-9
    win = rms[base_n:]
    ok = (win > 3 * base) & (win > 0.25 * win.max())
    return float(ts[base_n + int(np.argmax(ok))] * FPS) if ok.any() else -1.0


def audio_checks(path):
    import soundfile as sf
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr[r.stderr.rfind("Summary:"):]
    lufs = float(re.search(r"I:\s*(-?[\d.]+) LUFS", txt).group(1))
    tp = float(re.search(r"Peak:\s*(-?[\d.]+) dBFS", txt).group(1))
    check("loudness ~ -14 LUFS (±1)", abs(lufs + 14) <= 1.0, f"{lufs:.2f} LUFS")
    check("true peak <= -1 dBTP", tp <= -1.0, f"{tp:.2f} dBTP")
    enc = decode_audio(path)
    ref, rsr = sf.read(os.path.join(OUT, "audio", "mix.wav"))
    ref = ref.mean(axis=1)
    assert rsr == SR
    # delivered audio is sample-aligned with the reference mix (no codec delay, no drift)
    a0, a1 = int(5 * SR), int(9 * SR)
    lags = range(-480, 481)
    corr = [float(np.dot(ref[a0:a1], enc[a0 + l:a1 + l])) for l in lags]
    lag = list(lags)[int(np.argmax(corr))]
    check("audio: delivered AAC sample-aligned with the mix", abs(lag) <= 48, f"lag {lag} samples ({lag / SR * 1000:.2f} ms)")
    # the freeze beat (video beat 11 -> 12, frames 808-881) is digital silence in the mix
    s0, s1 = int(11 * B_S * SR), int((12 * B_S - 0.006) * SR)
    check("audio: freeze beat 808-881 is digital silence (mix)", np.abs(ref[s0:s1]).max() < 1e-6, f"max {np.abs(ref[s0:s1]).max():.2e}")
    enc_rms = 20 * np.log10(np.sqrt(np.mean(enc[s0 + 150:s1 - int(0.025 * SR)] ** 2)) + 1e-12)
    check("audio: freeze beat in the AAC is below -50 dBFS (codec noise only)", enc_rms < -50, f"{enc_rms:.1f} dBFS RMS")
    # event landings: drop attack, bullet-time snap, contact (high-frequency onset)
    for name, fr in (("drop attack", M["drop"]), ("bullet-time contact", M["contact"]), ("bullet-time snap hit", M["snap"])):
        o_ref = hf_onset(ref, fr)
        o_enc = hf_onset(enc, fr)
        check(f"audio: {name} lands on frame {fr} (±1)", abs(o_ref - fr) <= 1 and abs(o_enc - fr) <= 1,
              f"onset at frame {o_ref:.2f} (mix) / {o_enc:.2f} (AAC)")
    # hard cut: the music stops dead on 2792 and the mix is digital silence until the closing line
    seg = np.abs(ref[int((M["hardcut"] - 60) / FPS * SR):int(M["closing"] / FPS * SR)])
    nz = np.nonzero(seg > 1e-3)[0]
    cut_frame = (nz[-1] + int((M["hardcut"] - 60) / FPS * SR)) / SR * FPS if len(nz) else -1
    check("audio: music stops dead on frame 2792 (±1)", abs(cut_frame - M["hardcut"]) <= 1.0, f"last sample > -60 dBFS at frame {cut_frame:.2f}")
    h0, h1 = int(M["hardcut"] / FPS * SR) + 1, int(M["closing"] / FPS * SR)
    check("audio: hard cut 2792-2938 is digital silence (mix)", np.abs(ref[h0:h1]).max() == 0.0, f"max {np.abs(ref[h0:h1]).max():.2e}")
    hc = np.abs(enc[h0 + 300:h1 - 200])
    check("audio: hard cut silent in the AAC", hc.max() < 2e-3, f"max {hc.max():.5f}")


def stills(path):
    d = os.path.join(OUT, "qa_stills")
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    frames = sorted(set([0, 72, 73, 220, 294, 367, 441, 588, 807, 808, 881, 882, 883, 2056, 2057, 2350, 2351, 2352,
                         2424, 2755, 2791, 2792, 2939, 3233, 3380, 3453, 3527, 3600, 3747, 4041, 4115]
                        + [p + o for p in TL["portals"] for o in (-1, 0, 1)] + TL["panels"]))
    for f in frames:
        t = (f - 0.25) / FPS
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.5f}", "-i", path, "-frames:v", "1",
                        "-vf", "drawbox=y=250:h=2:w=iw:color=red@0.8:t=fill,drawbox=y=1520:h=2:w=iw:color=red@0.8:t=fill",
                        os.path.join(d, f"f{f:04d}.png")], check=True)
    cols = 10
    rows = (len(frames) + cols - 1) // cols
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-pattern_type", "glob", "-i", os.path.join(d, "f*.png"), "-vf",
                    f"scale=216:-1,tile={cols}x{rows}:padding=4:color=gray", "-frames:v", "1",
                    os.path.join(OUT, "qa_contact_sheet.png")], check=True)
    check("stills exported (portals, key beats, safe-zone guides)", True, f"{len(frames)} stills -> out/qa_stills, out/qa_contact_sheet.png")


def main():
    spec_checks(MASTER, "master", 120, TOTAL)
    spec_checks(REELS, "reels", 60, TOTAL // 2, bitrate=(15, 20))
    spec_checks(FALLBACK, "fallback", 30, TOTAL // 4, bitrate=(10, 14))
    if os.path.exists(MASTER):
        # intentional black: the hard cut (pure black) and the closing line typed on a near-black terminal
        # (blackdetect counts a frame as black when >= 98 % of its pixels are dark, so small text on black counts)
        black_ok = [(M["hardcut"] / FPS, M["punch"] / FPS)]
        bl = intervals(MASTER, "blackdetect=d=0.05:pix_th=0.06", "black_start", "black_end")
        bad = [iv for iv in bl if not within(iv, black_ok)]
        hc_found = any(s <= M["hardcut"] / FPS + 2 / FPS and (e or 99) >= M["closing"] / FPS - 2 / FPS for s, e in bl)
        check("blackdetect: black only in the hard cut / closing terminal", not bad, f"black {[(round(a, 3), round(b, 3) if b else None) for a, b in bl]}")
        check("blackdetect: hard cut 2792-2938 is black", hc_found)
        # only intentional freezes: hard cut, the awkward hold, frozen held frames of the closing/punchline
        freeze_ok = [(M["hardcut"] / FPS, M["closing"] / FPS + 0.2), (M["hold"] / FPS - 0.3, M["glance"] / FPS + 0.1),
                     (M["typeEnd"] / FPS, M["punch"] / FPS + 0.05), (M["bubble"] / FPS, M["outro"] / FPS + 0.05)]
        fr = intervals(MASTER, "freezedetect=n=0.0008:d=0.4", "freeze_start", "freeze_end")
        badf = [iv for iv in fr if not within(iv, freeze_ok)]
        check("freezedetect: only intentional holds", not badf, f"freezes {[(round(a, 3), round(b, 3) if b else None) for a, b in fr]}")
        # picture: drop flash, snap impact frame, hard cut to black
        l881, l882 = frame_luma(MASTER, M["drop"] - 1, FPS), frame_luma(MASTER, M["drop"], FPS)
        check("picture: drop flash on frame 882", l882 - l881 > 40, f"luma {l881:.0f} -> {l882:.0f}")
        l2791, l2792 = frame_luma(MASTER, M["hardcut"] - 1, FPS), frame_luma(MASTER, M["hardcut"], FPS)
        check("picture: white-out 2791 -> black 2792", l2791 > 180 and l2792 < 4, f"luma {l2791:.0f} -> {l2792:.0f}")
        l2350, l2351 = frame_luma(MASTER, M["snap"] - 1, FPS), frame_luma(MASTER, M["snap"], FPS)
        check("picture: impact frame on 2351", l2351 - l2350 > 40, f"luma {l2350:.0f} -> {l2351:.0f}")
        audio_checks(MASTER)
        stills(MASTER)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    json.dump([{"check": n, "pass": ok, "detail": d} for n, ok, d in results], open(os.path.join(OUT, "qa_report.json"), "w"), indent=1)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
