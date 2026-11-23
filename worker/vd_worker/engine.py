"""Kokoro ONNX engine: phonemize words, pick styles, run the model."""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass

import numpy as np
import onnxruntime as ort
import phonemizer
from kokoro_onnx.config import DEFAULT_VOCAB
from kokoro_onnx.tokenizer import Tokenizer, _espeak_lock

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


@dataclass(frozen=True)
class WordTokens:
    word: str
    tokens: list[int]


class Engine:
    def __init__(self, model_path: str, voices_path: str, providers: list[str] | None = None):
        if providers is None:
            avail = ort.get_available_providers()
            providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in avail]
        opts = ort.SessionOptions()
        threads = os.environ.get("VD_ORT_THREADS")
        if threads:
            opts.intra_op_num_threads = int(threads)
        self.session = ort.InferenceSession(model_path, sess_options=opts, providers=providers)
        self.providers = self.session.get_providers()
        self.tokenizer = Tokenizer()  # configures espeak-ng
        self.vocab = DEFAULT_VOCAB
        self.space_id = self.vocab[" "]
        raw = np.load(voices_path)
        self.styles: dict[str, np.ndarray] = {}
        for public_id, (sources, _lang) in VOICE_MAP.items():
            packs = [np.asarray(raw[s], dtype=np.float32) for s in sources]
            self.styles[public_id] = np.mean(packs, axis=0).astype(np.float32)
        self._lock = threading.Lock()

    @staticmethod
    def lang_for(voice: str) -> str:
        return VOICE_MAP[voice][1]

    def phonemize_words(self, words: list[str], lang: str) -> list[WordTokens]:
        """Phonemize word by word (one espeak call for the whole list)."""
        if not words:
            return []
        with _espeak_lock:
            phones = phonemizer.phonemize(words, lang, preserve_punctuation=True, with_stress=True)
        out: list[WordTokens] = []
        for w, ph in zip(words, phones):
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
