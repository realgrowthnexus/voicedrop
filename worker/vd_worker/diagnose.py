"""GPU / onnxruntime diagnostics for the serverless worker (operator use only).

Every step runs with its own time limit and the report is returned even if a step hangs,
so one slow probe can never burn the whole job timeout.
"""

from __future__ import annotations

import concurrent.futures as cf
import glob
import importlib.metadata as md
import os
import subprocess
import sys
import time
import traceback

_LIB_DIRS = [
    "/usr/lib/x86_64-linux-gnu",
    "/usr/local/cuda*/lib64",
    "/usr/local/cuda*/targets/*/lib",
    "/usr/local/lib/python3*/site-packages/nvidia/*/lib",
    "/app/env/lib/python3*/site-packages/nvidia/*/lib",
]

_pool = cf.ThreadPoolExecutor(max_workers=4)


def _find(pattern: str) -> list[str]:
    """Look for a shared library only in the usual places (a full-disk scan is far too slow on a worker)."""
    hits: set[str] = set()
    for d in _LIB_DIRS:
        for base in glob.glob(d)[:50]:
            hits.update(glob.glob(os.path.join(base, pattern)))
    return sorted(hits)[:12]


def _step(out: dict, name: str, fn, timeout: float) -> None:
    t0 = time.time()
    fut = _pool.submit(fn)
    try:
        out[name] = fut.result(timeout=timeout)
    except cf.TimeoutError:
        out[name] = f"TIMEOUT after {timeout}s"
    except Exception:  # noqa: BLE001
        out[name] = traceback.format_exc()[-1500:]
    out.setdefault("timings", {})[name] = round(time.time() - t0, 2)


def _nvidia_smi() -> str:
    try:
        r = subprocess.run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"], capture_output=True, text=True, timeout=10)
        return (r.stdout or r.stderr).strip()
    except FileNotFoundError:
        return "nvidia-smi not found"


def _dists() -> dict:
    names = [(d.metadata["Name"] or "", d.version) for d in md.distributions()]
    return {
        "onnxruntime": sorted(f"{n}=={v}" for n, v in names if "onnxruntime" in n.lower()),
        "nvidia": sorted(f"{n}=={v}" for n, v in names if n.lower().startswith("nvidia")),
        "torch": sorted(f"{n}=={v}" for n, v in names if n.lower() == "torch"),
    }


def _libs() -> dict:
    return {k: _find(f"{k}.so*") for k in ("libcudnn", "libcublas", "libcudart", "libcufft", "libcurand", "libcuda")}


def _ort_info() -> dict:
    import onnxruntime as ort

    return {"version": ort.__version__, "file": ort.__file__, "available_providers": ort.get_available_providers()}


def _preload() -> str:
    import onnxruntime as ort

    ort.preload_dlls()
    return "ok"


def _session() -> dict:
    import onnxruntime as ort

    from .models import resolve_model_dir

    d = resolve_model_dir()
    model = d / "onnx" / "model.onnx" if (d / "onnx" / "model.onnx").exists() else d / "model.onnx"
    s = ort.InferenceSession(str(model), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    return {"model": str(model), "session_providers": s.get_providers()}


def gpu_report() -> dict:
    out: dict = {"python": sys.version.split()[0], "ld_library_path": os.environ.get("LD_LIBRARY_PATH", "")}
    _step(out, "nvidia_smi", _nvidia_smi, 12)
    _step(out, "dists", _dists, 10)
    _step(out, "libs", _libs, 10)
    _step(out, "ort", _ort_info, 20)
    _step(out, "preload", _preload, 20)
    _step(out, "session", _session, 40)
    return out
