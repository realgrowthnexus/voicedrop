"use client";
import { Logo } from "./Logo";
import { VoiceLine } from "./VoiceLine";

const STAGE_VARS = { "--ink": "var(--stage-ink)", "--mute": "var(--stage-mute)" } as React.CSSProperties;

/** Left half of the sign-in screen (desktop): the brand stage with a breathing voice line. */
export function LoginStage() {
  return (
    <aside style={STAGE_VARS} className="relative hidden overflow-hidden bg-stage text-stage-ink lg:flex lg:flex-col">
      <div className="relative px-10 py-6">
        <Logo />
      </div>
      <div className="relative flex flex-1 flex-col justify-center px-10">
        <div className="h-40">
          <VoiceLine analyser={null} idleAmp={0.22} />
        </div>
        <p className="display mt-10 max-w-[13ch] text-[clamp(2.6rem,4.4vw,4.4rem)]">Every word, in a voice worth hearing.</p>
        <ul className="mt-10 space-y-3 text-stage-mute">
          <li>Twelve natural English voices</li>
          <li>MP3, WAV and word-timed subtitles</li>
          <li>Commercial use on every plan</li>
        </ul>
      </div>
    </aside>
  );
}
