"""Job processing + RunPod serverless entrypoint."""

from __future__ import annotations

import os
import time
from typing import Any
from urllib.parse import urlparse

import requests

from .audio import to_mp3_bytes, to_wav_bytes
from .engine import VOICE_MAP, Engine
from .models import resolve_model_dir
from .pipeline import synthesize
from .srt import build_srt

MAX_TEXT_CHARS = 12_000
CONTENT_TYPES = {"mp3": "audio/mpeg", "wav": "audio/wav", "srt": "application/x-subrip"}

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = Engine(resolve_model_dir())
    return _engine


class JobError(ValueError):
    pass


def _validate(inp: dict[str, Any]) -> tuple[str, str, str, float, list[str], dict[str, str]]:
    if not isinstance(inp, dict):
        raise JobError("input must be an object")
    job_id = str(inp.get("job_id", ""))[:64]
    text = inp.get("text")
    voice = inp.get("voice")
    speed = inp.get("speed", 1.0)
    formats = inp.get("formats") or ["mp3"]
    uploads = inp.get("uploads") or {}
    if not job_id:
        raise JobError("job_id required")
    if not isinstance(text, str) or not text.strip():
        raise JobError("text required")
    if len(text) > MAX_TEXT_CHARS:
        raise JobError("text too long")
    if voice not in VOICE_MAP:
        raise JobError("unknown voice")
    if not isinstance(speed, (int, float)) or not 0.5 <= float(speed) <= 2.0:
        raise JobError("bad speed")
    if not isinstance(formats, list) or not formats or any(f not in CONTENT_TYPES for f in formats):
        raise JobError("bad formats")
    allow_http = os.environ.get("VD_ALLOW_HTTP_UPLOADS") == "1"
    for f in formats:
        url = uploads.get(f)
        if not isinstance(url, str):
            raise JobError(f"missing upload url for {f}")
        scheme = urlparse(url).scheme
        if scheme != "https" and not (allow_http and scheme == "http"):
            raise JobError("upload urls must be https")
    return job_id, text, voice, float(speed), list(dict.fromkeys(formats)), uploads


def _put(url: str, data: bytes, content_type: str) -> None:
    last: Exception | None = None
    for attempt in range(3):
        try:
            r = requests.put(url, data=data, headers={"Content-Type": content_type}, timeout=60)
            if 200 <= r.status_code < 300:
                return
            last = RuntimeError(f"upload failed with HTTP {r.status_code}")
        except requests.RequestException as e:  # network hiccup: retry
            last = e
        time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"upload failed: {last}")


def process_job(inp: dict[str, Any], engine: Engine | None = None) -> dict[str, Any]:
    job_id, text, voice, speed, formats, uploads = _validate(inp)
    eng = engine or get_engine()
    t0 = time.time()
    result = synthesize(eng, text, voice, speed)
    synth_sec = time.time() - t0

    wav = to_wav_bytes(result.audio, result.sample_rate)
    payloads: dict[str, bytes] = {}
    for f in formats:
        if f == "wav":
            payloads[f] = wav
        elif f == "mp3":
            payloads[f] = to_mp3_bytes(wav)
        elif f == "srt":
            payloads[f] = build_srt(result.words).encode("utf-8")
    for f, data in payloads.items():
        _put(uploads[f], data, CONTENT_TYPES[f])

    return {
        "job_id": job_id,
        "duration_sec": round(result.duration, 3),
        "chars": len(text),
        "words": len(result.words),
        "synth_sec": round(synth_sec, 3),
        "providers": eng.providers,
        "files": {f: {"bytes": len(d)} for f, d in payloads.items()},
    }


def runpod_handler(job: dict[str, Any]) -> dict[str, Any]:
    return process_job(job.get("input") or {})


if __name__ == "__main__":
    import runpod

    get_engine()  # load the model before accepting work
    runpod.serverless.start({"handler": runpod_handler})
