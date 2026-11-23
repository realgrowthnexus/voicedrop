from vd_worker.text import normalize_for_speech, split_sentences, split_words, MAX_SENTENCE_CHARS


def test_abbreviations_do_not_split_sentences():
    s = split_sentences(normalize_for_speech("Dr. Smith arrived. He was late!"))
    assert [x.text for x in s] == ["Doctor Smith arrived.", "He was late!"]


def test_money_percent_time_and_symbols():
    t = normalize_for_speech("It costs $5.50 & saves 20% at 10:05pm 😀 see https://x.com **now**")
    assert "5 dollars and 50 cents" in t
    assert "and saves 20 percent" in t
    assert "10 oh 5 P M" in t
    assert "😀" not in t and "https" not in t and "*" not in t


def test_paragraph_breaks_are_remembered():
    s = split_sentences(normalize_for_speech("One. Two.\n\nThree."))
    assert [(x.text, x.paragraph_end) for x in s] == [("One.", False), ("Two.", True), ("Three.", True)]


def test_long_sentences_are_split():
    long = ", ".join(["this is a clause"] * 60) + "."
    parts = split_sentences(long)
    assert len(parts) > 1
    assert all(len(p.text) <= MAX_SENTENCE_CHARS for p in parts)


def test_emoji_only_normalizes_to_empty():
    assert normalize_for_speech("😀😀 🎉") == ""
    assert split_sentences("") == []


def test_split_words():
    assert split_words(" a  b\tc ") == ["a", "b", "c"]
