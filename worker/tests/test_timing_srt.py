import numpy as np
import pytest

from vd_worker.srt import build_cues, build_srt
from vd_worker.timing import WordTiming, word_timings
from vd_worker.audio import peak_normalize, to_wav_bytes


def test_word_timings_layout_and_scaling():
    # pad, w0(2), space, w1(3), pad  -> 8 durations
    d = np.array([4, 2, 2, 1, 3, 3, 3, 2], dtype=float)
    n_samples = int(d.sum() * 600)
    w = word_timings(["Hi", "there."], [2, 3], d, n_samples, 24000, offset_sec=1.0)
    assert w[0].start == pytest.approx(1.0 + 4 / 40)
    assert w[0].end == pytest.approx(1.0 + 8 / 40)
    assert w[1].start == pytest.approx(1.0 + 9 / 40)
    assert w[1].end == pytest.approx(1.0 + 18 / 40)


def test_word_timings_rejects_bad_lengths():
    with pytest.raises(ValueError):
        word_timings(["a"], [2], np.ones(3), 100, 24000, 0)


def test_srt_cues_respect_limits_and_sentences():
    words = [WordTiming(f"word{i}" + ("." if i == 3 else ""), i * 0.3, i * 0.3 + 0.25) for i in range(20)]
    cues = build_cues(words)
    assert all(len(t) <= 42 for _, _, t in cues)
    assert all(e - s <= 2.0 + 0.3 for s, e, _ in cues)
    assert cues[0][2].endswith("word3.")
    srt = build_srt(words)
    blocks = srt.strip().split("\n\n")
    assert [b.split("\n")[0] for b in blocks] == [str(i) for i in range(1, len(blocks) + 1)]
    assert "00:00:00,000 --> 00:00:01,150" in blocks[0]


def test_peak_normalize_and_wav():
    a = np.array([0.1, -0.5, 0.25], dtype=np.float32)
    n = peak_normalize(a)
    assert np.max(np.abs(n)) == pytest.approx(0.95)
    assert peak_normalize(np.zeros(4)).sum() == 0
    wav = to_wav_bytes(n)
    assert wav[:4] == b"RIFF" and len(wav) == 44 + 2 * 3
