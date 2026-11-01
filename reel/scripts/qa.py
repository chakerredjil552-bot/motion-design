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
    t = (frame + 0.5) / fps
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.5f}", "-i", path, "-frames:v", "1", "-vf", "scale=108:192,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True, check=True)
    return float(np.frombuffer(r.stdout, dtype=np.uint8).mean())


def audio_checks(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr[r.stderr.rfind("Summary:"):]
    lufs = float(re.search(r"I:\s*(-?[\d.]+) LUFS", txt).group(1))
    tp = float(re.search(r"Peak:\s*(-?[\d.]+) dBFS", txt).group(1))
    check("loudness ~ -14 LUFS (±1)", abs(lufs + 14) <= 1.0, f"{lufs:.2f} LUFS")
    check("true peak <= -1 dBTP", tp <= -1.0, f"{tp:.2f} dBTP")
    # decode audio for timing checks
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:a", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.abs(np.frombuffer(pcm, dtype=np.float32))
    sr = 48000
    f2s = lambda f: int(f / FPS * sr)
    # the freeze beat is silent, the drop lands on its frame
    seg = x[f2s(M["freeze"]) + 200:f2s(M["drop"]) - 400]
    check("freeze beat is silent (808-881)", seg.max() < 2e-3, f"max {seg.max():.5f}")
    after = x[f2s(M["drop"]) - 2400:f2s(M["drop"]) + 4800]
    onset = np.argmax(after > 0.05) + f2s(M["drop"]) - 2400
    drop_frame = onset / sr * FPS
    check("drop lands on frame 882 (±1)", abs(drop_frame - M["drop"]) <= 1.0, f"audio onset at frame {drop_frame:.2f}")
    # hard cut: music dead from 2792, silence until the closing line
    hc = x[f2s(M["hardcut"]) + 300:f2s(M["closing"]) - 200]
    check("hard cut is silent (2792-2938)", hc.max() < 2e-3, f"max {hc.max():.5f}")
    pre = x[f2s(M["hardcut"]) - 2000:f2s(M["hardcut"]) + 300]
    last = np.nonzero(pre > 0.01)[0]
    cut_frame = (last[-1] + f2s(M["hardcut"]) - 2000) / sr * FPS if len(last) else -1
    check("music stops dead on frame 2792 (±1)", abs(cut_frame - M["hardcut"]) <= 1.0, f"last loud sample at frame {cut_frame:.2f}")
    # the snap hit lands on its frame
    sn = x[f2s(M["snap"]) - 4800:f2s(M["snap"]) + 4800]
    env = np.convolve(sn, np.ones(96) / 96, mode="same")
    d = np.diff(env)
    snap_frame = (np.argmax(d) + f2s(M["snap"]) - 4800) / sr * FPS
    check("bullet-time snap hit lands on frame 2351 (±1)", abs(snap_frame - M["snap"]) <= 1.0, f"steepest attack at frame {snap_frame:.2f}")


def stills(path):
    d = os.path.join(OUT, "qa_stills")
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    frames = sorted(set([0, 72, 73, 220, 294, 367, 441, 588, 807, 808, 881, 882, 883, 2056, 2057, 2350, 2351, 2352,
                         2424, 2755, 2791, 2792, 2939, 3233, 3380, 3453, 3527, 3600, 3747, 4041, 4115]
                        + [p + o for p in TL["portals"] for o in (-1, 0, 1)] + TL["panels"]))
    for f in frames:
        t = (f + 0.5) / FPS
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
    spec_checks(FALLBACK, "fallback", 30, TOTAL // 4)
    if os.path.exists(MASTER):
        # only intentional black: the hard cut (and the frame where the closing terminal is still empty)
        black_ok = [(M["hardcut"] / FPS, M["closing"] / FPS + 0.2)]
        bl = intervals(MASTER, "blackdetect=d=0.05:pix_th=0.06", "black_start", "black_end")
        bad = [iv for iv in bl if not within(iv, black_ok)]
        check("blackdetect: only the intentional hard cut", not bad and bl, f"black {[(round(a, 3), round(b, 3) if b else None) for a, b in bl]}")
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
