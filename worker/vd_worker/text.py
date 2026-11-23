"""Text clean-up and sentence splitting for English voice-over scripts."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Emoji / pictographs / dingbats / variation selectors — never spoken.
_EMOJI = re.compile(
    "[\U0001f000-\U0001faff\U00002600-\U000027bf\U0001f900-\U0001f9ff️‍\U0001f1e6-\U0001f1ff]"
)
_URL = re.compile(r"\bhttps?://\S+|\bwww\.\S+", re.IGNORECASE)
_MONEY = re.compile(r"([$£€])\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?\b")
_PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s?%")
_TIME = re.compile(r"\b(\d{1,2}):(\d{2})\s?([ap])\.?m\.?\b", re.IGNORECASE)
_THOUSANDS = re.compile(r"\b(\d{1,3}(?:,\d{3})+)\b")

_CURRENCY = {"$": ("dollar", "dollars", "cent", "cents"), "£": ("pound", "pounds", "penny", "pence"), "€": ("euro", "euros", "cent", "cents")}

# Abbreviations whose trailing dot must not end a sentence (and should not add a pause).
_ABBREVIATIONS = {
    "mr.": "Mister", "mrs.": "Missus", "ms.": "Miz", "dr.": "Doctor", "prof.": "Professor",
    "st.": "Saint", "jr.": "Junior", "sr.": "Senior", "vs.": "versus", "etc.": "etcetera",
    "e.g.": "for example", "i.e.": "that is", "approx.": "approximately", "no.": "number",
}

MAX_SENTENCE_CHARS = 400


@dataclass(frozen=True)
class Sentence:
    text: str
    paragraph_end: bool  # a blank line follows this sentence


def _money(m: re.Match[str]) -> str:
    one, many, sub_one, sub_many = _CURRENCY[m.group(1)]
    whole = m.group(2).replace(",", "")
    out = f"{whole} {one if whole == '1' else many}"
    cents = m.group(3)
    if cents:
        c = int(cents.ljust(2, "0"))
        if c:
            out += f" and {c} {sub_one if c == 1 else sub_many}"
    return out


def _time(m: re.Match[str]) -> str:
    h, mins, ap = m.group(1), m.group(2), m.group(3).upper()
    spoken = h if mins == "00" else f"{h} {mins}" if not mins.startswith("0") else f"{h} oh {mins[1]}"
    return f"{spoken} {ap} M"


def normalize_for_speech(text: str) -> str:
    """Make a script safe and natural to speak. Keeps sentence punctuation."""
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = _EMOJI.sub(" ", t)
    t = _URL.sub(" ", t)
    t = t.replace("&", " and ").replace("@", " at ")
    t = re.sub(r"[“”]", '"', t)
    t = re.sub(r"[‘’]", "'", t)
    t = re.sub(r"[–—]", ", ", t)
    t = _MONEY.sub(_money, t)
    t = _PERCENT.sub(lambda m: f"{m.group(1)} percent", t)
    t = _TIME.sub(_time, t)
    t = _THOUSANDS.sub(lambda m: m.group(1).replace(",", ""), t)
    t = re.sub(r"[#*_~`|<>\[\]{}\\^]", " ", t)  # markdown / symbols
    for abbr, full in _ABBREVIATIONS.items():
        t = re.sub(rf"(?<!\w){re.escape(abbr)}", full, t, flags=re.IGNORECASE)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


_SENT_END = re.compile(r'(?<=[.!?])["\')\]]*\s+(?=[A-Z0-9"\'(\[])')


def _split_long(sentence: str) -> list[str]:
    if len(sentence) <= MAX_SENTENCE_CHARS:
        return [sentence]
    parts: list[str] = []
    cur = ""
    for piece in re.split(r"(?<=[,;:])\s+", sentence):
        if cur and len(cur) + 1 + len(piece) > MAX_SENTENCE_CHARS:
            parts.append(cur)
            cur = piece
        else:
            cur = f"{cur} {piece}".strip()
    if cur:
        parts.append(cur)
    # A single clause can still be too long: hard-wrap on words.
    out: list[str] = []
    for p in parts:
        while len(p) > MAX_SENTENCE_CHARS:
            cut = p.rfind(" ", 0, MAX_SENTENCE_CHARS)
            cut = cut if cut > 0 else MAX_SENTENCE_CHARS
            out.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            out.append(p)
    return out


def split_sentences(text: str) -> list[Sentence]:
    """Split normalised text into sentences, remembering paragraph breaks."""
    sentences: list[Sentence] = []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    for para in paragraphs:
        lines = [l.strip() for l in para.split("\n") if l.strip()]
        chunks: list[str] = []
        for line in lines:
            # A line without end punctuation (e.g. a heading) is its own sentence.
            for s in _SENT_END.split(line):
                s = s.strip()
                if s:
                    chunks.extend(_split_long(s))
        for i, s in enumerate(chunks):
            sentences.append(Sentence(s, paragraph_end=i == len(chunks) - 1))
    return sentences


def split_words(sentence: str) -> list[str]:
    return [w for w in sentence.split() if w]
