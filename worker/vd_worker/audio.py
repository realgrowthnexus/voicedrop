"""Audio post-processing and encoding."""

from __future__ import annotations

import io
import subprocess
import wave

import numpy as np

SAMPLE_RATE = 24_000
PEAK = 0.95


def peak_normalize(audio: np.ndarray, peak: float = PEAK) -> np.ndarray:
    a = np.asarray(audio, dtype=np.float32)
    m = float(np.max(np.abs(a))) if a.size else 0.0
    if m <= 1e-6:
        return a
    return (a * (peak / m)).astype(np.float32)


def trim_bounds(audio: np.ndarray, threshold_db: float = -42.0, margin_sec: float = 0.04,
                sample_rate: int = SAMPLE_RATE) -> tuple[int, int]:
    """Indices [start, end) that keep the audio between leading/trailing silence."""
    a = np.abs(np.asarray(audio, dtype=np.float32))
    if not a.size:
        return 0, 0
    peak = float(a.max())
    if peak <= 1e-6:
        return 0, 0
    loud = np.nonzero(a >= peak * (10 ** (threshold_db / 20)))[0]
    margin = int(margin_sec * sample_rate)
    return max(0, int(loud[0]) - margin), min(len(a), int(loud[-1]) + 1 + margin)


def silence(seconds: float, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    return np.zeros(int(round(seconds * sample_rate)), dtype=np.float32)


def to_wav_bytes(audio: np.ndarray, sample_rate: int = SAMPLE_RATE) -> bytes:
    pcm = (np.clip(audio, -1.0, 1.0) * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def to_mp3_bytes(wav_bytes: bytes, bitrate: str = "160k") -> bytes:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "wav", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-b:a", bitrate, "-ar", "44100", "-ac", "1", "-f", "mp3", "pipe:1"],
        input=wav_bytes,
        capture_output=True,
        check=False,
        timeout=300,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr.decode(errors='replace')[:500]}")
    return proc.stdout
