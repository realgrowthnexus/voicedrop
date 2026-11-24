# VoiceoverDrop TTS worker for RunPod Serverless (GPU).
# Build context: this `worker/` directory.
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    VD_MODEL_DIR=/models

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt \
 && pip install "onnxruntime-gpu[cuda,cudnn]==1.32.0"

# Model files are pinned by revision + sha256 (build fails on mismatch).
COPY scripts/fetch_models.py scripts/fetch_models.py
RUN python scripts/fetch_models.py /models

COPY vd_worker ./vd_worker

# Fail the build early if the pipeline cannot even import.
RUN python -c "import vd_worker.handler"

CMD ["python", "-u", "-m", "vd_worker.handler"]
