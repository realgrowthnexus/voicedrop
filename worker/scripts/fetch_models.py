"""Download the pinned Kokoro model + voices and verify sha256.

Usage: python scripts/fetch_models.py [target_dir]
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

MODEL_REVISION = "dd4401a9add81ac692d20e240d22ec9dda82cc29"
FILES = {
    "model.onnx": (
        f"https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped/resolve/{MODEL_REVISION}/onnx/model.onnx",
        "651ea8291843a92276a4a003581a215cb07d15e47dde6fcfb1b768f9a1682054",
    ),
    "voices-v1.0.bin": (
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
        "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
    ),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "models")
    target.mkdir(parents=True, exist_ok=True)
    for name, (url, digest) in FILES.items():
        dest = target / name
        if dest.exists() and sha256(dest) == digest:
            print(f"ok   {name} (cached)")
            continue
        print(f"get  {name}")
        tmp = dest.with_suffix(".part")
        urllib.request.urlretrieve(url, tmp)
        got = sha256(tmp)
        if got != digest:
            tmp.unlink(missing_ok=True)
            raise SystemExit(f"sha256 mismatch for {name}: {got} != {digest}")
        tmp.rename(dest)
        print(f"ok   {name}")


if __name__ == "__main__":
    main()
