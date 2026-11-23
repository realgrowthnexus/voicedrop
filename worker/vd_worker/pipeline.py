"""Script -> audio + word timings."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .audio import SAMPLE_RATE, peak_normalize, silence, trim_bounds
from .engine import MAX_TOKENS, VOICE_MAP, Engine, WordTokens
from .text import normalize_for_speech, split_sentences, split_words
from .timing import WordTiming, word_timings

SENTENCE_GAP = 0.32
PARAGRAPH_GAP = 0.6
CLAUSE_GAP = 0.12  # between windows of one long sentence


@dataclass
class SynthResult:
    audio: np.ndarray
    words: list[WordTiming]
    sample_rate: int = SAMPLE_RATE

    @property
    def duration(self) -> float:
        return len(self.audio) / self.sample_rate


def _windows(words: list[WordTokens]) -> list[list[WordTokens]]:
    """Pack words into windows whose token count (incl. spaces) stays <= MAX_TOKENS."""
    out: list[list[WordTokens]] = []
    cur: list[WordTokens] = []
    size = 0
    for w in words:
        n = len(w.tokens)
        if n > MAX_TOKENS:  # pathological single "word": truncate
            w = WordTokens(w.word, w.tokens[:MAX_TOKENS])
            n = MAX_TOKENS
        add = n + (1 if cur else 0)
        if cur and size + add > MAX_TOKENS:
            out.append(cur)
            cur, size, add = [], 0, n
        cur.append(w)
        size += add
    if cur:
        out.append(cur)
    return out


def synthesize(engine: Engine, text: str, voice: str, speed: float = 1.0) -> SynthResult:
    if voice not in VOICE_MAP:
        raise ValueError(f"unknown voice: {voice}")
    if not 0.5 <= speed <= 2.0:
        raise ValueError("speed out of range")
    lang = engine.lang_for(voice)
    sentences = split_sentences(normalize_for_speech(text))

    pieces: list[np.ndarray] = []
    timings: list[WordTiming] = []
    t = 0.0
    for sent in sentences:
        wt = [w for w in engine.phonemize_words(split_words(sent.text), lang) if w.tokens]
        if not wt:
            continue
        windows = _windows(wt)
        for wi, window in enumerate(windows):
            tokens: list[int] = []
            for i, w in enumerate(window):
                if i:
                    tokens.append(engine.space_id)
                tokens.extend(w.tokens)
            audio, durations = engine.infer(tokens, voice, speed)
            lo, hi = trim_bounds(audio)
            if hi <= lo:
                continue
            lead = lo / SAMPLE_RATE
            kept = hi - lo
            for w in word_timings([w.word for w in window], [len(w.tokens) for w in window], durations, len(audio), SAMPLE_RATE, 0.0):
                start = min(max(w.start - lead, 0.0), kept / SAMPLE_RATE)
                end = min(max(w.end - lead, start), kept / SAMPLE_RATE)
                timings.append(WordTiming(w.word, round(t + start, 3), round(t + end, 3)))
            pieces.append(audio[lo:hi])
            t += kept / SAMPLE_RATE
            if wi < len(windows) - 1:
                pieces.append(silence(CLAUSE_GAP))
                t += len(pieces[-1]) / SAMPLE_RATE
        gap = silence(PARAGRAPH_GAP if sent.paragraph_end else SENTENCE_GAP)
        pieces.append(gap)
        t += len(gap) / SAMPLE_RATE

    if not timings:
        raise ValueError("no speakable text")
    pieces.append(silence(0.15))  # short tail instead of a full paragraph gap
    if len(pieces) >= 2:
        del pieces[-2]
    audio = peak_normalize(np.concatenate(pieces))
    return SynthResult(audio=audio, words=timings)
