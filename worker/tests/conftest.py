import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
MODELS = Path(os.environ.get("VD_MODEL_DIR", ROOT / "models"))


@pytest.fixture(scope="session")
def engine():
    if not (MODELS / "model.onnx").exists():
        pytest.skip("model files not downloaded (run scripts/fetch_models.py)")
    from vd_worker.engine import Engine

    return Engine(MODELS, providers=["CPUExecutionProvider"])
