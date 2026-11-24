"""GPU / onnxruntime diagnostics for the serverless worker (operator use only)."""

from __future__ import annotations

import glob
import importlib.metadata as md
import os
import sys
import traceback


def gpu_report() -> dict:
    import onnxruntime as ort

    out: dict = {
        "python": sys.version.split()[0],
        "ort_version": ort.__version__,
        "ort_file": ort.__file__,
        "available_providers": ort.get_available_providers(),
        "ort_dists": sorted(d.metadata["Name"] for d in md.distributions() if "onnxruntime" in (d.metadata["Name"] or "").lower()),
        "nvidia_dists": sorted(
            f'{d.metadata["Name"]}=={d.version}' for d in md.distributions() if (d.metadata["Name"] or "").lower().startswith("nvidia")
        ),
        "torch": None,
        "ld_library_path": os.environ.get("LD_LIBRARY_PATH", ""),
        "libcudnn_found": sorted({os.path.basename(p) for p in glob.glob("/**/libcudnn.so*", recursive=True)})[:10],
        "libcublas_found": sorted({os.path.basename(p) for p in glob.glob("/**/libcublas.so*", recursive=True)})[:10],
    }
    try:
        import torch

        out["torch"] = {"version": torch.__version__, "cuda": torch.version.cuda, "available": torch.cuda.is_available()}
    except Exception as e:  # noqa: BLE001
        out["torch"] = f"not importable: {e}"
    try:
        ort.preload_dlls(verbose=True)
        out["preload"] = "ok"
    except Exception:  # noqa: BLE001
        out["preload"] = traceback.format_exc()[-1500:]
    try:
        from .models import resolve_model_dir

        d = resolve_model_dir()
        model = d / "onnx" / "model.onnx" if (d / "onnx" / "model.onnx").exists() else d / "model.onnx"
        so = ort.SessionOptions()
        so.log_severity_level = 0
        s = ort.InferenceSession(str(model), sess_options=so, providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
        out["session_providers"] = s.get_providers()
    except Exception:  # noqa: BLE001
        out["session_error"] = traceback.format_exc()[-2000:]
    return out
