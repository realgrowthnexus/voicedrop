"use client";
import { useRef, useState } from "react";
import { VOICES } from "@/lib/plans";

function Eq({ live }: { live: boolean }) {
  return (
    <span className={`eq ${live ? "is-live" : ""}`} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * All voices with a preview button. With `onSelect` it doubles as the voice picker (radio group).
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
      <ul className={`grid gap-px overflow-hidden rounded-[18px] border border-line bg-line ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {VOICES.map((v) => {
          const isSel = selected === v.id;
          const isPlaying = playing === v.id;
          return (
            <li
              key={v.id}
              className={`group relative flex items-center gap-3 bg-surface px-4 py-3.5 transition-colors duration-300 hover:bg-surface-2 ${
                isSel ? "bg-surface-2" : ""
              }`}
            >
              {isSel ? <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-lamp" /> : null}
              <button
                type="button"
                onClick={() => preview(v.id)}
                aria-label={isPlaying ? `Stop ${v.name} preview` : `Play ${v.name} preview`}
                className={`grid size-10 shrink-0 place-items-center rounded-full border transition-all duration-300 ${
                  isPlaying ? "border-lamp bg-lamp text-lamp-ink" : "border-line-strong text-ink group-hover:border-lamp group-hover:text-lamp"
                }`}
              >
                {isPlaying ? (
                  <Eq live />
                ) : (
                  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
                  </svg>
                )}
              </button>
              {selectable ? (
                <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold tracking-[-0.01em]">{v.name}</span>
                    <span className="block truncate text-sm text-mute">
                      {v.description}, {v.accent} {v.gender}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name={name ?? "voice"}
                    value={v.id}
                    checked={isSel}
                    onChange={() => onSelect?.(v.id)}
                    className="size-[18px] shrink-0 accent-[var(--lamp)]"
                  />
                </label>
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold tracking-[-0.01em]">{v.name}</span>
                  <span className="block text-sm text-mute">
                    {v.description}, {v.accent} {v.gender}
                  </span>
                </span>
              )}
              {!selectable ? (
                <span className="text-mute opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <Eq live={false} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <audio ref={audio} onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} preload="none" />
    </Wrapper>
  );
}
