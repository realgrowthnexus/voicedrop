"""SubRip (SRT) subtitles from word timings."""

from __future__ import annotations

from .timing import WordTiming

_SENTENCE_END = (".", "!", "?")


def _ts(sec: float) -> str:
    ms = max(0, int(round(sec * 1000)))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_cues(words: list[WordTiming], max_chars: int = 42, max_dur: float = 2.0) -> list[tuple[float, float, str]]:
    cues: list[tuple[float, float, str]] = []
    cur: list[WordTiming] = []

    def flush() -> None:
        if cur:
            cues.append((cur[0].start, cur[-1].end, " ".join(w.word for w in cur)))
            cur.clear()

    for w in words:
        if cur:
            text_len = len(" ".join(x.word for x in cur)) + 1 + len(w.word)
            if text_len > max_chars or (w.end - cur[0].start) > max_dur:
                flush()
        cur.append(w)
        if w.word.endswith(_SENTENCE_END):
            flush()
    flush()
    return cues


def build_srt(words: list[WordTiming], max_chars: int = 42, max_dur: float = 2.0) -> str:
    lines: list[str] = []
    for i, (start, end, text) in enumerate(build_cues(words, max_chars, max_dur), start=1):
        if end <= start:
            end = start + 0.2
        lines.append(f"{i}\n{_ts(start)} --> {_ts(end)}\n{text}\n")
    return "\n".join(lines)
