"""Kokoro ONNX engine: phonemize words, pick styles, run the model."""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort

from .models import load_model_and_voices
from .phonemes import VOCAB, phonemize_words

log = logging.getLogger("vd_worker")

MAX_TOKENS = 500  # model limit is 510 incl. pads; keep headroom

# Public voice id -> (Kokoro voices to average, espeak language)
VOICE_MAP: dict[str, tuple[tuple[str, ...], str]] = {
    "blend_michael_fenrir": (("am_michael", "am_fenrir"), "en-us"),
    "am_fenrir": (("am_fenrir",), "en-us"),
    "am_michael": (("am_michael",), "en-us"),
    "am_onyx": (("am_onyx",), "en-us"),
    "am_puck": (("am_puck",), "en-us"),
    "bm_george": (("bm_george",), "en-gb"),
    "bm_fable": (("bm_fable",), "en-gb"),
    "af_heart": (("af_heart",), "en-us"),
    "af_bella": (("af_bella",), "en-us"),
    "af_kore": (("af_kore",), "en-us"),
    "af_aoede": (("af_aoede",), "en-us"),
    "bf_emma": (("bf_emma",), "en-gb"),
}
SOURCE_VOICES = {s for sources, _ in VOICE_MAP.values() for s in sources}


@dataclass(frozen=True)
class WordTokens:
    word: str
    tokens: list[int]


CUDA = "CUDAExecutionProvider"
CPU = "CPUExecutionProvider"


def _make_session(model_path: str, opts: ort.SessionOptions, providers: list[str] | None) -> ort.InferenceSession:
    """Prefer the GPU. The worker image already ships CUDA 12 + cuDNN 9 (via torch's nvidia-* wheels),
    so try CUDA as-is first; only if that silently falls back to CPU, preload the pip CUDA libraries and retry."""
    if providers:
        return ort.InferenceSession(model_path, sess_options=opts, providers=providers)
    if CUDA not in ort.get_available_providers():
        return ort.InferenceSession(model_path, sess_options=opts, providers=[CPU])
    sess = ort.InferenceSession(model_path, sess_options=opts, providers=[CUDA, CPU])
    if CUDA in sess.get_providers():
        return sess
    log.warning("CUDA provider did not initialise; preloading CUDA/cuDNN libraries and retrying")
    try:
        ort.preload_dlls()
    except Exception as e:  # noqa: BLE001
        log.warning("onnxruntime preload_dlls failed: %s", e)
    return ort.InferenceSession(model_path, sess_options=opts, providers=[CUDA, CPU])


class Engine:
    def __init__(self, model_dir: str | Path, providers: list[str] | None = None, verify: bool = True):
        model_path, raw = load_model_and_voices(Path(model_dir), SOURCE_VOICES, verify=verify)
        opts = ort.SessionOptions()
        threads = os.environ.get("VD_ORT_THREADS")
        if threads:
            opts.intra_op_num_threads = int(threads)
        self.session = _make_session(str(model_path), opts, providers)
        log.info("onnxruntime providers: %s", self.session.get_providers())
        self.providers = self.session.get_providers()
        self.vocab = VOCAB
        self.space_id = self.vocab[" "]
        self.styles: dict[str, np.ndarray] = {
            public_id: np.mean([raw[s] for s in sources], axis=0).astype(np.float32)
            for public_id, (sources, _lang) in VOICE_MAP.items()
        }
        self._lock = threading.Lock()

    @staticmethod
    def lang_for(voice: str) -> str:
        return VOICE_MAP[voice][1]

    def phonemize_words(self, words: list[str], lang: str) -> list[WordTokens]:
        """Phonemize word by word (one espeak call for the whole list)."""
        out: list[WordTokens] = []
        for w, ph in zip(words, phonemize_words(words, lang)):
            ids = [self.vocab[c] for c in ph.strip() if c in self.vocab and c != " "]
            out.append(WordTokens(w, ids))
        return out

    def style(self, voice: str, n_tokens: int) -> np.ndarray:
        pack = self.styles[voice]
        return pack[max(1, min(n_tokens, len(pack))) - 1]

    def infer(self, tokens: list[int], voice: str, speed: float) -> tuple[np.ndarray, np.ndarray]:
        if not tokens or len(tokens) > MAX_TOKENS:
            raise ValueError(f"token window must be 1..{MAX_TOKENS}, got {len(tokens)}")
        feeds = {
            "input_ids": np.array([[0, *tokens, 0]], dtype=np.int64),
            "style": self.style(voice, len(tokens)).reshape(1, -1),
            "speed": np.array([speed], dtype=np.float32),
        }
        with self._lock:  # one inference at a time per session
            wave, durations = self.session.run(None, feeds)
        return np.asarray(wave, dtype=np.float32).ravel(), np.asarray(durations).ravel()
