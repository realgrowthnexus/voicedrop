"""Render the website's voice samples with the real pipeline.

Writes to ../public/samples:
  demo-<voice>.mp3 + demo-<voice>.json  (hero demo with word timings)
  voice-<voice>.mp3                      (short preview per voice)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from vd_worker.audio import to_mp3_bytes, to_wav_bytes  # noqa: E402
from vd_worker.engine import VOICE_MAP  # noqa: E402
from vd_worker.handler import get_engine  # noqa: E402
from vd_worker.pipeline import synthesize  # noqa: E402

OUT = ROOT.parent / "public" / "samples"
DEMO = (
    "Most people think the ocean is salty because of rivers. They're right, but that's only half the story. "
    "Deep under the sea, volcanic vents pour minerals into the water every single day. "
    "So next time you swim at the beach, remember: you're floating in four billion years of history."
)
DEMO_VOICES = ["blend_michael_fenrir", "af_heart", "bm_george", "bf_emma"]
NAMES = {
    "blend_michael_fenrir": "Atlas", "am_fenrir": "Fenrir", "am_michael": "Michael", "am_onyx": "Onyx", "am_puck": "Puck",
    "bm_george": "George", "bm_fable": "Fable", "af_heart": "Heart", "af_bella": "Bella", "af_kore": "Kore",
    "af_aoede": "Aoede", "bf_emma": "Emma",
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    eng = get_engine()
    for v in DEMO_VOICES:
        r = synthesize(eng, DEMO, v)
        (OUT / f"demo-{v}.mp3").write_bytes(to_mp3_bytes(to_wav_bytes(r.audio), bitrate="96k"))
        words = [{"w": w.word, "s": w.start, "e": w.end} for w in r.words]
        (OUT / f"demo-{v}.json").write_text(json.dumps({"duration": round(r.duration, 2), "words": words}))
        print("demo", v, round(r.duration, 1))
    for v in VOICE_MAP:
        line = f"Hi, I'm {NAMES[v]}. Paste your script, and I'll read it for your next video."
        r = synthesize(eng, line, v)
        (OUT / f"voice-{v}.mp3").write_bytes(to_mp3_bytes(to_wav_bytes(r.audio), bitrate="96k"))
        print("voice", v, round(r.duration, 1))


if __name__ == "__main__":
    main()
