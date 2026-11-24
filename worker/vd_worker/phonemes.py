"""espeak-ng phonemizer setup + Kokoro vocabulary.

Replaces the kokoro-onnx package (MIT) — we only ever used its tokenizer, and depending on it
pulls the CPU `onnxruntime` wheel next to `onnxruntime-gpu`. `vocab.json` is Kokoro-82M's
symbol table (Apache-2.0), copied verbatim from kokoro-onnx 0.6.1.
"""

from __future__ import annotations

import ctypes
import ctypes.util
import json
import os
import threading
from pathlib import Path

import espeakng_loader
import phonemizer
from phonemizer.backend.espeak.wrapper import EspeakWrapper

VOCAB: dict[str, int] = json.loads((Path(__file__).with_name("vocab.json")).read_text(encoding="utf-8"))

# espeak-ng keeps process-global state: phonemize one call at a time.
ESPEAK_LOCK = threading.Lock()
_ready = False


def _setup() -> None:
    global _ready
    if _ready:
        return
    lib = os.getenv("PHONEMIZER_ESPEAK_LIBRARY") or espeakng_loader.get_library_path()
    try:
        ctypes.cdll.LoadLibrary(lib)
    except OSError:
        lib = ctypes.util.find_library("espeak-ng") or ctypes.util.find_library("espeak")
        if not lib:
            raise RuntimeError("espeak-ng library not found")
    with ESPEAK_LOCK:
        EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
        EspeakWrapper.set_library(lib)
    _ready = True


def phonemize_words(words: list[str], lang: str) -> list[str]:
    """One phoneme string per word (one espeak call for the whole list)."""
    _setup()
    if not words:
        return []
    with ESPEAK_LOCK:
        return phonemizer.phonemize(words, lang, preserve_punctuation=True, with_stress=True)
