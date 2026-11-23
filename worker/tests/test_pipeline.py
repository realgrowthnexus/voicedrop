import io
import json
import subprocess
import threading
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
import pytest

from vd_worker.handler import JobError, process_job
from vd_worker.pipeline import synthesize


def test_real_synthesis_short_text(engine):
    r = synthesize(engine, "Hello world. This is a test.", "af_heart")
    assert 1.0 < r.duration < 5.0
    assert [w.word for w in r.words] == ["Hello", "world.", "This", "is", "a", "test."]
    starts = [w.start for w in r.words]
    assert starts == sorted(starts)
    assert r.words[-1].end <= r.duration + 0.01
    assert r.duration - r.words[-1].end < 0.8
    assert np.max(np.abs(r.audio)) == pytest.approx(0.95, abs=1e-3)


def test_blend_style_is_mean(engine):
    from conftest import MODELS

    raw = np.load(str(MODELS / "voices-v1.0.bin"))
    s = engine.styles["blend_michael_fenrir"]
    assert s.shape == (510, 1, 256)
    assert np.allclose(s, (raw["am_michael"] + raw["am_fenrir"]) / 2, atol=1e-6)


def test_british_voice_and_long_text(engine):
    text = ("This is a longer paragraph that keeps going, with commas, and clauses, " * 12) + "The end."
    r = synthesize(engine, text, "bm_george", speed=1.1)
    assert r.duration > 20
    assert len(r.words) == len(text.split())


def test_no_speakable_text(engine):
    with pytest.raises(ValueError, match="no speakable text"):
        synthesize(engine, "😀 🎉 https://example.com", "af_heart")


class _Sink(BaseHTTPRequestHandler):
    store: dict = {}

    def do_PUT(self):  # noqa: N802
        n = int(self.headers["Content-Length"])
        _Sink.store[self.path] = (self.headers["Content-Type"], self.rfile.read(n))
        self.send_response(200)
        self.end_headers()

    def log_message(self, *a):
        pass


def test_process_job_uploads_all_formats(engine, monkeypatch, tmp_path):
    monkeypatch.setenv("VD_ALLOW_HTTP_UPLOADS", "1")
    srv = HTTPServer(("127.0.0.1", 0), _Sink)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_port}"
    out = process_job(
        {"job_id": "j1", "text": "Testing one two three.", "voice": "blend_michael_fenrir", "speed": 1.0,
         "formats": ["mp3", "wav", "srt"], "uploads": {f: f"{base}/{f}" for f in ("mp3", "wav", "srt")}},
        engine,
    )
    srv.shutdown()
    assert out["job_id"] == "j1" and out["words"] == 4 and out["duration_sec"] > 0.5
    ct, mp3 = _Sink.store["/mp3"]
    assert ct == "audio/mpeg"
    mp3_path = tmp_path / "out.mp3"
    mp3_path.write_bytes(mp3)
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,format_name", "-of", "json", str(mp3_path)],
                           capture_output=True, check=True)
    fmt = json.loads(probe.stdout)["format"]
    assert fmt["format_name"] == "mp3" and abs(float(fmt["duration"]) - out["duration_sec"]) < 0.2
    with wave.open(io.BytesIO(_Sink.store["/wav"][1])) as w:
        assert w.getframerate() == 24000 and w.getnchannels() == 1
    assert _Sink.store["/srt"][1].decode().startswith("1\n00:00:00")


@pytest.mark.parametrize("bad", [
    {"job_id": "x", "text": "", "voice": "af_heart", "formats": ["mp3"], "uploads": {"mp3": "https://a"}},
    {"job_id": "x", "text": "hi", "voice": "zz", "formats": ["mp3"], "uploads": {"mp3": "https://a"}},
    {"job_id": "x", "text": "hi", "voice": "af_heart", "formats": ["exe"], "uploads": {}},
    {"job_id": "x", "text": "hi", "voice": "af_heart", "formats": ["mp3"], "uploads": {"mp3": "file:///etc/passwd"}},
    {"job_id": "x", "text": "hi", "voice": "af_heart", "speed": 9, "formats": ["mp3"], "uploads": {"mp3": "https://a"}},
])
def test_invalid_input_rejected(bad, monkeypatch):
    monkeypatch.delenv("VD_ALLOW_HTTP_UPLOADS", raising=False)
    with pytest.raises(JobError):
        process_job(bad, engine=object())


def test_pauses_are_natural(engine):
    from vd_worker.audio import trim_bounds

    r = synthesize(engine, "First sentence here. Second sentence here.", "af_heart")
    a = r.audio
    lo, hi = trim_bounds(a)
    assert lo / 24000 < 0.12  # starts quickly
    assert (len(a) - hi) / 24000 < 0.3  # short tail
    gap = r.words[3].start - r.words[2].end
    assert 0.2 < gap < 0.7
