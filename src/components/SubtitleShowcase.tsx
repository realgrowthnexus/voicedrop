import fs from "node:fs";
import path from "node:path";

type Word = { w: string; s: number; e: number };

function cues(words: Word[]) {
  const out: { s: number; e: number; text: string }[] = [];
  let cur: Word[] = [];
  for (const w of words) {
    if (cur.length && (cur.map((x) => x.w).join(" ").length + w.w.length > 34 || w.e - cur[0].s > 2.2)) {
      out.push({ s: cur[0].s, e: cur[cur.length - 1].e, text: cur.map((x) => x.w).join(" ") });
      cur = [];
    }
    cur.push(w);
    if (/[.!?]$/.test(w.w)) {
      out.push({ s: cur[0].s, e: cur[cur.length - 1].e, text: cur.map((x) => x.w).join(" ") });
      cur = [];
    }
  }
  if (cur.length) out.push({ s: cur[0].s, e: cur[cur.length - 1].e, text: cur.map((x) => x.w).join(" ") });
  return out;
}

const ts = (t: number) => {
  const ms = Math.round(t * 1000);
  const s = Math.floor(ms / 1000);
  return `00:00:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

/** Real SRT cues generated from the demo's word timings (read at build time). */
export function SubtitleShowcase() {
  const file = path.join(process.cwd(), "public/samples/demo-blend_michael_fenrir.json");
  const words: Word[] = JSON.parse(fs.readFileSync(file, "utf8")).words;
  const list = cues(words).slice(0, 4);
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm text-mute">
        <span className="script-text">ocean-short.srt</span>
        <span>Word-timed, ready for CapCut and Premiere</span>
      </div>
      <ol className="script-text divide-y divide-line text-[0.95rem]">
        {list.map((c, i) => (
          <li key={i} className="grid grid-cols-[2rem_1fr] gap-x-3 px-5 py-4 transition-colors duration-300 hover:bg-surface-2">
            <span className="text-mute">{i + 1}</span>
            <span className="text-mute">
              {ts(c.s)} --&gt; {ts(c.e)}
            </span>
            <span />
            <span className="mt-1 text-ink">{c.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
