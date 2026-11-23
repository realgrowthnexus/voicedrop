import Link from "next/link";
import { HeroDemo } from "@/components/HeroDemo";
import { PricingTable } from "@/components/PricingTable";
import { VoicePreviewList } from "@/components/VoicePreviewList";
import { FREE_WEEKLY_CHARS } from "@/lib/plans";

const DEMO_TEXT =
  "Most people think the ocean is salty because of rivers. They're right, but that's only half the story. Deep under the sea, volcanic vents pour minerals into the water every single day. So next time you swim at the beach, remember: you're floating in four billion years of history.";

const STEPS = [
  { title: "Paste your script", body: "Drop in the text for your short, explainer or long video. Up to 10,000 characters at a time on paid plans." },
  { title: "Pick a voice", body: "Twelve natural English voices, American and British. Preview each one and set the speed." },
  { title: "Download", body: "Get an MP3 in seconds. Paid plans also get studio WAV and SRT subtitles timed to every word." },
];

const FAQ = [
  {
    q: "Can I use the audio in monetized videos?",
    a: "Yes. Every plan, including Free, allows commercial use: monetized YouTube and TikTok videos, ads and client work.",
  },
  {
    q: "What counts as a character?",
    a: "Every letter, number, space and punctuation mark in your script, after extra spaces and blank lines are squeezed out. Roughly 1,000 characters make one minute of audio.",
  },
  {
    q: "What happens if a voice-over fails?",
    a: "You get your characters back automatically. You only pay for audio you actually receive.",
  },
  {
    q: "Which languages are supported?",
    a: "English for now, in American and British accents. More languages are on the roadmap.",
  },
  {
    q: "Can I clone my own voice or a celebrity's?",
    a: "No. We only offer our licensed stock voices, and we never clone real people.",
  },
  {
    q: "How long are my files kept?",
    a: "30 days. Download anything you want to keep before then.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from the billing page and you keep your plan until the end of the period you paid for.",
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
        <div className="max-w-3xl">
          <h1 className="text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[4.25rem]">Paste a script. Get a voice-over.</h1>
          <p className="mt-5 max-w-[34rem] text-lg text-graphite sm:text-xl">
            Natural English voices for YouTube, Shorts and TikTok. Download MP3 or WAV, plus subtitles timed to every word.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login" className="inline-flex h-13 items-center rounded-full bg-ink px-7 text-lg font-semibold text-paper hover:opacity-90">
              Start free
            </Link>
            <span className="text-graphite">{FREE_WEEKLY_CHARS.toLocaleString("en-US")} characters a week. No card needed.</span>
          </div>
        </div>
        <div className="mt-12">
          <HeroDemo fallbackText={DEMO_TEXT} />
          <p className="mt-3 text-sm text-graphite">Real output, unedited. The highlight follows the voice using the same word timings we put in your SRT file.</p>
        </div>
      </section>

      <section aria-labelledby="how" className="border-y border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="how" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Three steps, about a minute
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span aria-hidden className="script-text flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink text-lg font-bold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="mt-1 text-graphite">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="voices" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <h2 id="voices" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Twelve voices, ready now
          </h2>
          <p className="text-graphite">Tap play to hear each one.</p>
        </div>
        <div className="mt-8">
          <VoicePreviewList />
        </div>
      </section>

      <section aria-labelledby="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="pricing" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Simple pricing
        </h2>
        <p className="mt-2 max-w-xl text-graphite">Start free. Upgrade when your channel needs more minutes.</p>
        <div className="mt-8">
          <PricingTable />
        </div>
      </section>

      <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 id="faq" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Questions
        </h2>
        <div className="mt-8 divide-y divide-rule border-y border-rule">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <svg aria-hidden className="shrink-0 transition-transform group-open:rotate-45" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="mt-2 max-w-[62ch] text-graphite">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
