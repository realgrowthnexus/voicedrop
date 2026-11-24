"""Locate (or fetch) the pinned Kokoro model files and verify them.

Two layouts are supported:
- Docker image (`VD_MODEL_DIR`): `model.onnx` + `voices-v1.0.bin` (npz of all voices)
- Hugging Face repo layout (RunPod model store or our own download):
  `onnx/model.onnx` + `voices/<name>.bin` (raw float32, 510x1x256)
Both carry identical data (checked: voices/*.bin == voices-v1.0.bin entries).
"""

from __future__ import annotations

import hashlib
import os
import urllib.request
from pathlib import Path

import numpy as np

HF_REPO = "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped"
HF_REVISION = "dd4401a9add81ac692d20e240d22ec9dda82cc29"
MODEL_SHA256 = "651ea8291843a92276a4a003581a215cb07d15e47dde6fcfb1b768f9a1682054"
NPZ_SHA256 = "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d"
VOICE_SHA256 = {
    "af_aoede": "4a004c33430762e2461eedb2013fad808ef4ab3121f5300f554476caf58d8361",
    "af_bella": "f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b",
    "af_heart": "d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b",
    "af_kore": "9be5221b6a941c04b561959b8ff0b06e809444dcc4ab7e75a7b23606f691819e",
    "am_fenrir": "c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43",
    "am_michael": "1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1",
    "am_onyx": "da5d135b424164916d75a68ffb4c2abce3d7d5ccc82dd1ee6cf447ce286145e6",
    "am_puck": "fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0",
    "bf_emma": "669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73",
    "bm_fable": "f889083196807b4adb15e9204252165f503b8d33d3982e681c52443c49d798f1",
    "bm_george": "c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc",
}
# Path RunPod's model store uses for `Model("owner/name:revision")`.
RUNPOD_STORE = Path("/runpod/model-store/huggingface") / HF_REPO / HF_REVISION


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _verify(path: Path, digest: str) -> Path:
    got = sha256(path)
    if got != digest:
        raise RuntimeError(f"sha256 mismatch for {path}: {got}")
    return path


def _download(rel: str, dest: Path, digest: str) -> Path:
    if dest.exists() and sha256(dest) == digest:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    urllib.request.urlretrieve(f"https://huggingface.co/{HF_REPO}/resolve/{HF_REVISION}/{rel}", tmp)
    _verify(tmp, digest)
    tmp.rename(dest)
    return dest


def resolve_model_dir() -> Path:
    """Directory holding the model in either supported layout."""
    explicit = os.environ.get("VD_MODEL_DIR")
    candidates = [Path(explicit)] if explicit else []
    candidates += [RUNPOD_STORE, Path(__file__).resolve().parent.parent / "models"]
    for c in candidates:
        if (c / "model.onnx").exists() or (c / "onnx" / "model.onnx").exists():
            return c
    # Last resort: download the HF layout (pinned + verified) into a cache dir.
    cache = Path(os.environ.get("VD_MODEL_CACHE", "/tmp/vd-models"))
    _download("onnx/model.onnx", cache / "onnx" / "model.onnx", MODEL_SHA256)
    for name, digest in VOICE_SHA256.items():
        _download(f"voices/{name}.bin", cache / "voices" / f"{name}.bin", digest)
    return cache


def load_model_and_voices(model_dir: Path, needed: set[str], verify: bool = True) -> tuple[Path, dict[str, np.ndarray]]:
    """Return the verified model path and the raw voice packs (each 510x1x256 float32)."""
    if (model_dir / "model.onnx").exists():  # Docker layout
        model = model_dir / "model.onnx"
        if verify:
            _verify(model, MODEL_SHA256)
            _verify(model_dir / "voices-v1.0.bin", NPZ_SHA256)
        npz = np.load(model_dir / "voices-v1.0.bin")
        return model, {n: np.asarray(npz[n], dtype=np.float32) for n in needed}
    model = model_dir / "onnx" / "model.onnx"
    if verify:
        _verify(model, MODEL_SHA256)
    voices: dict[str, np.ndarray] = {}
    for n in needed:
        p = model_dir / "voices" / f"{n}.bin"
        if verify:
            _verify(p, VOICE_SHA256[n])
        voices[n] = np.fromfile(p, dtype=np.float32).reshape(-1, 1, 256)
    return model, voices
