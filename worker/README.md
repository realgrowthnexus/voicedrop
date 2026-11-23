# VoiceoverDrop TTS worker

Kokoro-82M (ONNX, timestamped) → MP3 / WAV / word-timed SRT.

- `vd_worker/` — pipeline (text clean-up → word-by-word phonemize → sentence synth → trim/normalise → encode)
- `local_server.py` — dev stand-in for a RunPod endpoint (`/run`, `/status/<id>`, webhook callbacks)
- `Dockerfile` — RunPod Serverless GPU image; model pinned by revision + sha256

```bash
uv venv -p 3.11 .venv && uv pip install -p .venv/bin/python -r requirements-dev.txt && uv pip install -p .venv/bin/python --no-deps kokoro-onnx==0.6.1
.venv/bin/python scripts/fetch_models.py
.venv/bin/python -m pytest -q
.venv/bin/python local_server.py   # http://127.0.0.1:8188
```

Measured on 4 CPU cores (this dev box): RTF ≈ 0.22 (1 min of audio in ~13 s).
