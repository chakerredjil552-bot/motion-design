"""Shared helpers for the BLANK audit benchmarks.

Monitor samples CPU utilisation and memory while a block runs, and records
which compute device actually did the work. On this machine every "GPU" API
resolves to a CPU implementation, so device strings say so explicitly.
"""
import json
import os
import platform
import re
import shutil
import statistics
import subprocess
import tempfile
import threading
import time

import psutil

HERE = os.path.dirname(os.path.abspath(__file__))


def host_tag():
    """Results folder name: hostname plus whether an NVIDIA GPU is visible."""
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", platform.node() or "host")
    return f"{name}-{'gpu' if shutil.which('nvidia-smi') else 'cpu'}"


RESULTS = os.environ.get(
    "BLANK_RESULTS", os.path.normpath(os.path.join(HERE, "..", "results", host_tag())))
SCRATCH = os.environ.get("BLANK_SCRATCH", os.path.join(tempfile.gettempdir(), "blank_scratch"))
os.makedirs(RESULTS, exist_ok=True)
os.makedirs(SCRATCH, exist_ok=True)

RES = {
    "1080x1920": (1080, 1920),
    "2160x3840": (2160, 3840),
    "4320x7680": (4320, 7680),
}


def gpu_snapshot():
    """Return NVIDIA GPU utilisation/VRAM if a GPU exists, else None."""
    if shutil.which("nvidia-smi") is None:
        return None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5).stdout.strip()
        name, util, used, total = [s.strip() for s in out.split(",")]
        return {"name": name, "util_pct": float(util), "vram_used_mb": float(used),
                "vram_total_mb": float(total)}
    except Exception:
        return None


class Monitor:
    """Context manager: wall time, CPU % (avg/peak), RSS and system RAM peaks."""

    def __init__(self, label, device, interval=0.25):
        self.label, self.device, self.interval = label, device, interval
        self.samples, self.gpu_samples = [], []
        self._stop = threading.Event()
        self.proc = psutil.Process()

    def _run(self):
        psutil.cpu_percent(percpu=True)
        while not self._stop.wait(self.interval):
            per = psutil.cpu_percent(percpu=True)
            rss = self.proc.memory_info().rss
            for c in self.proc.children(recursive=True):
                try:
                    rss += c.memory_info().rss
                except psutil.Error:
                    pass
            self.samples.append((sum(per) / len(per), rss, psutil.virtual_memory().used))
            g = gpu_snapshot()
            if g:
                self.gpu_samples.append(g)

    def __enter__(self):
        self.t0 = time.perf_counter()
        self.th = threading.Thread(target=self._run, daemon=True)
        self.th.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        self.th.join()
        self.wall = time.perf_counter() - self.t0

    def summary(self):
        cpu = [s[0] for s in self.samples] or [0.0]
        rss = [s[1] for s in self.samples] or [self.proc.memory_info().rss]
        sysm = [s[2] for s in self.samples] or [psutil.virtual_memory().used]
        return {
            "label": self.label,
            "device": self.device,
            "wall_s": round(self.wall, 3),
            "cpu_util_avg_pct": round(statistics.mean(cpu), 1),
            "cpu_util_peak_pct": round(max(cpu), 1),
            "proc_rss_peak_gb": round(max(rss) / 1e9, 2),
            "sys_ram_peak_gb": round(max(sysm) / 1e9, 2),
            "gpu_util_peak_pct": max((g["util_pct"] for g in self.gpu_samples), default=None),
            "vram_peak_mb": max((g["vram_used_mb"] for g in self.gpu_samples), default=None),
        }


def save(name, data):
    path = os.path.join(RESULTS, name)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"[saved] {path}")
    return path
