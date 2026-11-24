import Link from "next/link";
import { HeroDemo } from "@/components/HeroDemo";
import { PricingTable } from "@/components/PricingTable";
import { Reveal } from "@/components/Reveal";
import { Steps } from "@/components/Steps";
import { SubtitleShowcase } from "@/components/SubtitleShowcase";
import { VoicePreviewList } from "@/components/VoicePreviewList";
import { FREE_WEEKLY_CHARS } from "@/lib/plans";

const DEMO_TEXT =
  "Most people think the ocean is salty because of rivers. They're right, but that's only half the story. Deep under the sea, volcanic vents pour minerals into the water every single day. So next time you swim at the beach, remember: you're floating in four billion years of history.";

const USES = ["YouTube explainers", "TikTok stories", "Shorts and Reels", "Faceless channels", "Course lessons", "Product demos", "Podcast intros", "Audiobook samples"];

const FAQ = [
  { q: "Can I use the audio in monetized videos?", a: "Yes. Every plan, including Free, allows commercial use: monetized YouTube and TikTok videos, ads and client work." },
  { q: "What counts as a character?", a: "Every letter, number, space and punctuation mark in your script, after extra spaces and blank lines are squeezed out. About 1,000 characters make one minute of audio." },
  { q: "What happens if a voice-over fails?", a: "Your characters come back automatically. You only pay for audio you actually receive." },
  { q: "Which languages are supported?", a: "English for now, in American and British accents. More languages are on the way." },
  { q: "Can I clone my own voice or a celebrity's?", a: "No. We only offer our licensed stock voices, and we never clone real people." },
  { q: "How long are my files kept?", a: "30 days. Download anything you want to keep before then." },
  { q: "Can I cancel any time?", a: "Yes. Cancel from the billing page and you keep your plan until the end of the period you paid for." },
];

export default function Home() {
  return (
    <>
      {/* Hero: the stage */}
      <section className="relative overflow-hidden bg-stage pb-20 pt-32 text-stage-ink sm:pt-40">
        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
          <h1 className="display text-[clamp(3.1rem,10.5vw,8.6rem)]">
            <span className="line-mask"><span style={{ ["--d" as string]: "60ms" }}>Give your script</span></span>
            <span className="line-mask"><span style={{ ["--d" as string]: "160ms" }}>a voice.</span></span>
          </h1>
          <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p className="fade-in max-w-[34rem] text-lg text-stage-mute sm:text-xl" style={{ ["--d" as string]: "420ms" }}>
              Natural English voice-overs for YouTube, Shorts and TikTok, ready in seconds. Download MP3 or WAV with subtitles timed to every word.
            </p>
            <div className="fade-in flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "540ms" }}>
              <Link href="/login" className="btn btn-primary btn-lg">
                Start free
              </Link>
              <Link href="#voices" className="btn btn-lg border-white/20 text-stage-ink hover:border-white/60">
                Hear the voices
              </Link>
            </div>
          </div>
          <p className="fade-in mt-4 text-sm text-stage-mute" style={{ ["--d" as string]: "640ms" }}>
            {FREE_WEEKLY_CHARS.toLocaleString("en-US")} free characters every week. No card needed.
          </p>
          <div className="fade-in mt-14" style={{ ["--d" as string]: "760ms" }}>
            <HeroDemo fallbackText={DEMO_TEXT} />
            <p className="mt-3 text-sm text-stage-mute">Real output, unedited. The line follows the actual audio; the underline follows the same word timings we put in your SRT file.</p>
          </div>
        </div>
      </section>

      {/* Use-case marquee */}
      <section aria-label="Made for" className="marquee-wrap overflow-hidden border-y border-line py-6">
        <div className="marquee">
          {[...USES, ...USES].map((u, i) => (
            <span key={i} className="flex items-center gap-8 pr-8 text-2xl font-medium tracking-[-0.02em] text-mute sm:text-3xl">
              {u}
              <span aria-hidden className="size-1.5 rounded-full bg-lamp" />
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-[1240px] px-5 py-28 sm:px-8">
        <Reveal>
          <h2 id="how" className="title max-w-[18ch] text-[clamp(2.2rem,5vw,3.8rem)]">
            Three steps, about a minute.
          </h2>
        </Reveal>
        <div className="mt-16">
          <Steps />
        </div>
      </section>

      {/* Voices */}
      <section id="voices" aria-labelledby="voices-h" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <Reveal>
            <h2 id="voices-h" className="title text-[clamp(2.2rem,5vw,3.8rem)]">
              Twelve voices, ready now.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="max-w-sm text-mute">American and British, warm to bold. Tap any voice to hear it read a line.</p>
          </Reveal>
        </div>
        <Reveal delay={150} className="mt-12">
          <VoicePreviewList />
        </Reveal>
      </section>

      {/* Subtitles */}
      <section aria-labelledby="srt" className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-28 sm:px-8 md:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <h2 id="srt" className="title text-[clamp(2.2rem,5vw,3.8rem)]">
            Subtitles that land on every word.
          </h2>
          <p className="mt-5 max-w-[44ch] text-lg text-mute">
            Paid plans get an SRT file built from the model&apos;s own timing for each word, not a guess. Drop it into CapCut, Premiere or YouTube and
            your captions are already in sync.
          </p>
        </Reveal>
        <Reveal delay={150}>
          <SubtitleShowcase />
        </Reveal>
      </section>

      {/* Pricing */}
      <section aria-labelledby="pricing" className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
        <Reveal>
          <h2 id="pricing" className="title text-[clamp(2.2rem,5vw,3.8rem)]">
            Simple pricing.
          </h2>
          <p className="mt-3 max-w-xl text-lg text-mute">Start free. Upgrade when your channel needs more minutes.</p>
        </Reveal>
        <div className="mt-12">
          <PricingTable />
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mx-auto grid max-w-[1240px] gap-10 px-5 py-28 sm:px-8 md:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <h2 id="faq" className="title text-[clamp(2.2rem,5vw,3.8rem)]">
            Questions.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium tracking-[-0.01em] transition-colors hover:text-lamp [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="relative size-4 shrink-0">
                    <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                    <span className="absolute left-0 top-1/2 h-px w-4 rotate-90 bg-current transition-transform duration-500 ease-[var(--ease-out)] group-open:rotate-0" />
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-6 text-mute">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] bg-stage px-7 py-16 text-stage-ink sm:px-14 sm:py-20">
            <h2 className="display relative max-w-[14ch] text-[clamp(2.4rem,6.5vw,5.2rem)]">Your next video is one paste away.</h2>
            <div className="relative mt-10 flex flex-wrap items-center gap-4">
              <Link href="/login" className="btn btn-primary btn-lg">
                Make your first voice-over
              </Link>
              <span className="text-stage-mute">Free forever plan. No card needed.</span>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
