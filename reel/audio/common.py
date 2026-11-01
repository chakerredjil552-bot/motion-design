"""Shared constants for the audio pipeline. Video timing is expressed in *video beats* (v)."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACK = os.path.join(ROOT, "assets", "music", "track.m4a")
WORK = os.path.join(ROOT, "audio", "work")
OUT_AUDIO = os.path.join(ROOT, "out", "audio")
DATA = os.path.join(ROOT, "src", "data")

FPS = 120
SR = 48000                     # output sample rate (AAC 48 kHz)
SAMPLES_PER_FRAME = SR // FPS  # 400

TOTAL_BEATS = 56               # 14 bars of 4/4
# Frame count rounded up to a multiple of 4 so 60 fps (pairs) and 30 fps (quads) blends are exact.
TOTAL_FRAMES = 4116

# Song structure (song beats, counted on the fitted grid). Filled by analyze.py into analysis.json.
SONG_START_BEAT = 5            # build starts here (bar line)
SONG_DROP_BEAT = 17            # the drop (bar line)
PRE_DROP_BEATS = 12            # video beats before the drop
SLOW_START_V = 28              # bullet-time contact (video beat)
SLOW_END_V = 32                # snap back (video beat)
SLOW_SONG_BEATS = 2.0          # song beats consumed during slow-mo (=> ~0.5x)
MUSIC_END_V = 38               # hard cut (video beat)
MUTE_V = (11, 12)              # one beat of true silence before the drop


def load_analysis():
    with open(os.path.join(WORK, "analysis.json")) as f:
        return json.load(f)


def frames_per_beat(bpm):
    return FPS * 60.0 / bpm


def vframe(v, bpm):
    """Video beat -> nearest master frame."""
    return int(round(v * frames_per_beat(bpm)))
