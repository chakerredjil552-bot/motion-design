"""Machine probe for the BLANK audit (Linux or Windows).

Reports GPU / VRAM / driver / CUDA, CPU, RAM, disk, tools, Python packages, and
which compute backend each library actually lands on. Every hardware encoder is
tested with a real 8-frame encode, not just listed.
"""
import glob
import importlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile

import psutil

from common import RESULTS, SCRATCH, save


def run(cmd, timeout=60):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:  # missing binary, timeout
        return -1, f"{type(e).__name__}: {e}"


def gpu():
    if not shutil.which("nvidia-smi"):
        return {"present": False, "note": "nvidia-smi not found"}
    q = "name,driver_version,memory.total,memory.used,compute_cap,power.limit,pcie.link.gen.max,pcie.link.width.max"
    rc, out = run(["nvidia-smi", f"--query-gpu={q}", "--format=csv,noheader"])
    rc2, hdr = run(["nvidia-smi"])
    cuda = re.search(r"CUDA Version:\s*([\d.]+)", hdr)
    gpus = []
    for line in out.splitlines():
        f = [x.strip() for x in line.split(",")]
        if len(f) >= 8:
            gpus.append(dict(zip(q.split(","), f)))
    return {"present": bool(gpus), "gpus": gpus, "cuda_driver_version": cuda.group(1) if cuda else None,
            "raw": out if not gpus else None}


def cpu_ram_disk():
    freq = psutil.cpu_freq()
    model = platform.processor()
    if platform.system() == "Linux":
        rc, out = run(["lscpu"])
        m = re.search(r"Model name:\s*(.+)", out)
        model = m.group(1).strip() if m else model
    elif platform.system() == "Windows":
        rc, out = run(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"])
        model = out.strip() or model
    du_proj = psutil.disk_usage(os.path.dirname(os.path.abspath(RESULTS)))
    du_tmp = psutil.disk_usage(SCRATCH)
    return {
        "os": f"{platform.system()} {platform.release()} ({platform.version()[:60]})",
        "cpu_model": model,
        "cpu_logical": psutil.cpu_count(logical=True),
        "cpu_physical": psutil.cpu_count(logical=False),
        "cpu_max_mhz": round(freq.max) if freq and freq.max else None,
        "ram_total_gb": round(psutil.virtual_memory().total / 1e9, 1),
        "swap_total_gb": round(psutil.swap_memory().total / 1e9, 1),
        "disk_project_free_gb": round(du_proj.free / 1e9, 1),
        "disk_scratch_free_gb": round(du_tmp.free / 1e9, 1),
    }


def find_blender():
    cands = [shutil.which("blender")]
    if platform.system() == "Windows":
        cands += sorted(glob.glob(r"C:\Program Files\Blender Foundation\Blender*\blender.exe"), reverse=True)
        cands += glob.glob(r"C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe")
    cands += sorted(glob.glob("/opt/blender*/blender"), reverse=True)
    for c in cands:
        if c and os.path.exists(c):
            return c
    return None


CYCLES_EXPR = (
    "import bpy, json\n"
    "p = bpy.context.preferences.addons['cycles'].preferences\n"
    "out = {}\n"
    "for t in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):\n"
    "    try:\n"
    "        p.compute_device_type = t\n"
    "        p.get_devices()\n"
    "        out[t] = [d.name for d in p.devices if d.type == t]\n"
    "    except Exception as e:\n"
    "        out[t] = 'unavailable: ' + str(e)[:80]\n"
    "print('CYCLES_DEVICES=' + json.dumps(out))\n"
)


def blender():
    exe = find_blender()
    info = {"exe": exe}
    if exe:
        rc, out = run([exe, "--version"])
        info["version"] = out.splitlines()[0] if out else None
        rc, out = run([exe, "-b", "--factory-startup", "--python-expr", CYCLES_EXPR], timeout=180)
        m = re.search(r"CYCLES_DEVICES=(\{.*\})", out)
        info["cycles_devices"] = json.loads(m.group(1)) if m else out[-300:]
    try:
        import bpy  # noqa: F401  (Blender-as-a-module wheel)
        info["bpy_module"] = bpy.app.version_string
    except Exception as e:
        info["bpy_module"] = f"missing ({type(e).__name__})"
    return info


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if not exe:
        return {"exe": None}
    rc, ver = run([exe, "-hide_banner", "-version"])
    rc, encs = run([exe, "-hide_banner", "-encoders"])
    listed = sorted(set(re.findall(r"\b(h264_nvenc|hevc_nvenc|av1_nvenc|h264_qsv|hevc_qsv|h264_amf|hevc_amf|"
                                   r"h264_vaapi|hevc_vaapi|libx264|libx265|libsvtav1|prores_ks|ffv1)\b", encs)))
    tests = {}
    tmp = os.path.join(SCRATCH, "probe_enc.mp4")
    trials = [
        ("h264_nvenc 1080x1920 8-bit", ["-s", "1080x1920", "-pix_fmt", "yuv420p", "-c:v", "h264_nvenc"]),
        ("hevc_nvenc 2160x3840 10-bit", ["-s", "2160x3840", "-pix_fmt", "p010le", "-c:v", "hevc_nvenc", "-profile:v", "main10"]),
        ("hevc_nvenc 4320x7680 10-bit", ["-s", "4320x7680", "-pix_fmt", "p010le", "-c:v", "hevc_nvenc", "-profile:v", "main10"]),
        ("av1_nvenc 4320x7680 10-bit", ["-s", "4320x7680", "-pix_fmt", "p010le", "-c:v", "av1_nvenc"]),
        ("libx264 1080x1920 8-bit", ["-s", "1080x1920", "-pix_fmt", "yuv420p", "-c:v", "libx264"]),
        ("libx265 2160x3840 10-bit", ["-s", "2160x3840", "-pix_fmt", "yuv420p10le", "-c:v", "libx265", "-x265-params", "log-level=error"]),
    ]
    for label, args in trials:
        size = args[1]
        cmd = [exe, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=s={size}:r=30",
               "-frames:v", "8"] + args[2:] + [tmp]
        rc, out = run(cmd, timeout=180)
        tests[label] = "OK" if rc == 0 else ("FAIL: " + out.splitlines()[-1][:120] if out else f"FAIL rc={rc}")
    return {"exe": exe, "version": ver.splitlines()[0] if ver else None, "encoders_listed": listed,
            "encode_tests": tests}


PKGS = ["numpy", "scipy", "cv2", "numba", "taichi", "warp", "moderngl", "mitsuba", "drjit", "pyoidn",
        "skia", "cairo", "soundfile", "pyloudnorm", "psutil", "cupy", "torch", "bpy"]


def packages():
    out = {}
    for m in PKGS:
        rc, txt = run([sys.executable, "-c",
                       f"import {m} as x; v=getattr(x,'__version__',None) or getattr(x,'version',''); print(v)"])
        out[m] = txt.splitlines()[-1][:40] if rc == 0 else "missing"
    return out


BACKEND_SNIPPETS = {
    "moderngl (GLSL)": (
        "import moderngl, platform\n"
        "ctx=None\n"
        "if platform.system()=='Linux':\n"
        "    try: ctx=moderngl.create_standalone_context(backend='egl', require=430)\n"
        "    except Exception: ctx=None\n"
        "ctx = ctx or moderngl.create_standalone_context(require=430)\n"
        "print(ctx.info['GL_RENDERER'], '| GL', ctx.info['GL_VERSION'])"),
    "taichi": (
        "import taichi as ti\n"
        "ti.init(arch=ti.gpu, log_level=ti.ERROR)\n"
        "print('arch =', ti.lang.impl.current_cfg().arch)"),
    "warp": (
        "import warp as wp\n"
        "wp.config.quiet=True; wp.init()\n"
        "print([f'{d.alias}:{d.name}' for d in wp.get_devices()])"),
    "mitsuba": (
        "import mitsuba as mi\n"
        "ok=[]\n"
        "for v in ('cuda_ad_rgb','llvm_ad_rgb'):\n"
        "    try: mi.set_variant(v); ok.append(v)\n"
        "    except Exception: pass\n"
        "print('usable variants:', ok)"),
    "numba.cuda": (
        "from numba import cuda\n"
        "print('available' if cuda.is_available() else 'not available')"),
    "pyoidn": (
        "import pyoidn, numpy as np\n"
        "x=np.random.rand(64,64,3).astype('float32')\n"
        "pyoidn.denoise(x); print('CPU device OK')"),
}


def backends():
    out = {}
    for name, code in BACKEND_SNIPPETS.items():
        rc, txt = run([sys.executable, "-c", code], timeout=300)
        lines = [l for l in txt.splitlines() if l.strip() and "Warning" not in l and "[Taichi]" not in l]
        out[name] = (lines[-1] if lines else "") if rc == 0 else "FAIL: " + (lines[-1][:120] if lines else "")
    return out


def main():
    data = {
        "host": platform.node(),
        "python": sys.version.split()[0],
        "gpu": gpu(),
        "system": cpu_ram_disk(),
        "ffmpeg": ffmpeg(),
        "blender": blender(),
        "packages": packages(),
        "backends": backends(),
    }
    save("probe.json", data)
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
