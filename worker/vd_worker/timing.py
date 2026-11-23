"""Convert model token durations into per-word timestamps."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class WordTiming:
    word: str
    start: float
    end: float


def word_timings(
    words: list[str],
    word_token_counts: list[int],
    durations: np.ndarray,
    n_samples: int,
    sample_rate: int,
    offset_sec: float,
) -> list[WordTiming]:
    """Map words to time ranges.

    ``durations`` has one entry per input token including the leading and
    trailing pad token. Words are separated by exactly one space token, so the
    token layout is: pad, w0..., space, w1..., space, ..., wN..., pad.
    Duration units are scaled so their sum equals the real waveform length.
    """
    if len(words) != len(word_token_counts):
        raise ValueError("words and token counts differ in length")
    d = np.asarray(durations, dtype=np.float64).ravel()
    expected = sum(word_token_counts) + max(len(words) - 1, 0) + 2
    if len(d) != expected:
        raise ValueError(f"durations length {len(d)} != expected {expected}")
    total = float(d.sum())
    sec_per_unit = (n_samples / sample_rate) / total if total > 0 else 0.0
    cum = np.concatenate([[0.0], np.cumsum(d)]) * sec_per_unit

    out: list[WordTiming] = []
    idx = 1  # skip leading pad
    for i, (w, n) in enumerate(zip(words, word_token_counts)):
        start = cum[idx]
        end = cum[idx + n]
        out.append(WordTiming(w, round(float(offset_sec + start), 3), round(float(offset_sec + end), 3)))
        idx += n + (1 if i < len(words) - 1 else 0)
    return out
