"""VoiceoverDrop TTS on RunPod Serverless (Runpod Python SDK 2.x apps).

Deploy from this directory:  RUNPOD_API_KEY=... runpod flash deploy

Cost guards live here on purpose (owner rule: total GPU spend must stay under $25):
- at most ONE worker, scale to zero after 5 s idle
- a job is killed after 5 minutes
- the web app additionally enforces the $ budget (src/lib/jobs/budget.ts)
"""

import runpod
from runpod import App
from runpod.apps.model import Model

app = App("voiceoverdrop")

KOKORO = Model("onnx-community/Kokoro-82M-v1.0-ONNX-timestamped:dd4401a9add81ac692d20e240d22ec9dda82cc29")


@app.queue(
    name="voiceoverdrop-tts",
    gpu=["AMPERE_16", "AMPERE_24"],  # RTX A4000/A4500/2000 Ada (16-20 GB), fallback 24 GB
    workers=(0, 1),
    idle_timeout=5,
    execution_timeout_ms=300_000,
    flashboot=True,
    model=KOKORO,  # staged by the platform: no download on cold start
    dependencies=[
        "onnxruntime-gpu==1.32.0",
        "espeakng-loader==0.2.4",
        "phonemizer==3.6.0",
        "numpy==2.4.6",
        "requests==2.34.2",
        "imageio-ffmpeg==0.8.1",
    ],
)
def synthesize(job: dict) -> dict:
    """job = the same JSON the Docker handler takes (job_id, text, voice, speed, formats, uploads)."""
    from vd_worker.handler import process_job

    return process_job(job)


@runpod.local_entrypoint
def main():
    print(synthesize.remote({"job_id": "smoke", "text": "Hello from VoiceoverDrop.", "voice": "af_heart", "formats": [], "uploads": {}}))
