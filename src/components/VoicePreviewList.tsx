"use client";
import { useRef, useState } from "react";
import { VOICES } from "@/lib/plans";

/**
 * List of all voices with a preview button. When `name` is set it doubles as
 * a radio group for choosing a voice (used in the studio).
 */
export function VoicePreviewList({
  selected,
  onSelect,
  name,
  compact = false,
}: {
  selected?: string;
  onSelect?: (id: string) => void;
  name?: string;
  compact?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  function preview(id: string) {
    const a = audio.current;
    if (!a) return;
    if (playing === id) {
      a.pause();
      return;
    }
    a.src = `/samples/voice-${id}.mp3`;
    void a.play();
    setPlaying(id);
  }

  const selectable = !!onSelect;
  const Wrapper = selectable ? "fieldset" : "div";
  return (
    <Wrapper className="min-w-0">
      {selectable ? <legend className="sr-only">Voice</legend> : null}
      <ul className={`grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule ${compact ? "" : "sm:grid-cols-2"}`}>
        {VOICES.map((v) => {
          const isSel = selected === v.id;
          return (
            <li key={v.id} className={`flex items-center gap-3 bg-surface px-4 py-3 ${isSel ? "shadow-[inset_6px_0_0_var(--marker)]" : ""}`}>
              <button
                type="button"
                onClick={() => preview(v.id)}
                aria-label={playing === v.id ? `Stop ${v.name} preview` : `Play ${v.name} preview`}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-rule text-ink hover:border-ink"
              >
                {playing === v.id ? (
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                ) : (
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>
                )}
              </button>
              {selectable ? (
                <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{v.name}</span>
                    <span className="block truncate text-sm text-graphite">
                      {v.description} · {v.accent} {v.gender}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name={name ?? "voice"}
                    value={v.id}
                    checked={isSel}
                    onChange={() => onSelect?.(v.id)}
                    className="size-5 shrink-0 accent-[var(--ink)]"
                  />
                </label>
              ) : (
                <span className="min-w-0">
                  <span className="block font-semibold">{v.name}</span>
                  <span className="block text-sm text-graphite">
                    {v.description} · {v.accent} {v.gender}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <audio ref={audio} onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} preload="none" />
    </Wrapper>
  );
}
