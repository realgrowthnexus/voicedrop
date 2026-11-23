import Link from "next/link";
import { FREE_WEEKLY_CHARS, PACK_CHARS, PLAN_ALLOWANCE, PRICES_USD, TIERS } from "@/lib/plans";

const n = (x: number) => x.toLocaleString("en-US");
const minutes = (chars: number) => Math.round(chars / 1000);

type Plan = {
  id: "free" | "creator" | "pro";
  name: string;
  price: string;
  per: string;
  chars: string;
  approx: string;
  points: string[];
  cta: string;
  href: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    per: "",
    chars: `${n(FREE_WEEKLY_CHARS)} characters a week`,
    approx: `about ${minutes(FREE_WEEKLY_CHARS)} minutes of audio`,
    points: [`Up to ${n(TIERS.free.maxPerRequest)} characters per script`, "MP3 downloads", "All 12 voices", "Commercial use allowed"],
    cta: "Start free",
    href: "/login",
  },
  {
    id: "creator",
    name: "Creator",
    price: `$${PRICES_USD.creator}`,
    per: "/month",
    chars: `${n(PLAN_ALLOWANCE.creator)} characters a month`,
    approx: `about ${minutes(PLAN_ALLOWANCE.creator)} minutes of audio`,
    points: [
      `Up to ${n(TIERS.creator.maxPerRequest)} characters per script`,
      "MP3, WAV and word-timed SRT subtitles",
      "Your jobs go first in the queue",
      `Fair use: ${n(TIERS.creator.dailyCap!)} characters a day`,
    ],
    cta: "Choose Creator",
    href: "/billing?buy=creator",
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: `$${PRICES_USD.pro}`,
    per: "/month",
    chars: `${n(PLAN_ALLOWANCE.pro)} characters a month`,
    approx: `about ${minutes(PLAN_ALLOWANCE.pro)} minutes of audio`,
    points: [
      `Up to ${n(TIERS.pro.maxPerRequest)} characters per script`,
      "MP3, WAV and word-timed SRT subtitles",
      "Your jobs go first in the queue",
      `Fair use: ${n(TIERS.pro.dailyCap!)} characters a day`,
    ],
    cta: "Choose Pro",
    href: "/billing?buy=pro",
  },
];

export function PricingTable() {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <section
            key={p.id}
            aria-labelledby={`plan-${p.id}`}
            className={`flex flex-col rounded-[20px] border p-6 ${
              p.featured ? "border-ink bg-surface shadow-[0_24px_48px_-32px_rgba(23,26,51,0.45)]" : "border-rule bg-surface"
            }`}
          >
            <h3 id={`plan-${p.id}`} className="flex items-center gap-2 text-xl font-bold">
              {p.name}
              {p.featured ? <span className="marker px-1.5 text-sm font-semibold">Most popular</span> : null}
            </h3>
            <p className="mt-4">
              <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
              <span className="text-graphite">{p.per}</span>
            </p>
            <p className="mt-3 font-semibold">{p.chars}</p>
            <p className="text-sm text-graphite">{p.approx}</p>
            <ul className="mt-5 flex-1 space-y-2 text-[0.95rem]">
              {p.points.map((pt) => (
                <li key={pt} className="flex gap-2">
                  <svg aria-hidden className="mt-1 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {pt}
                </li>
              ))}
            </ul>
            <Link
              href={p.href}
              className={`mt-6 inline-flex h-12 items-center justify-center rounded-full font-semibold ${
                p.featured ? "bg-ink text-paper hover:opacity-90" : "border border-ink text-ink hover:bg-ink hover:text-paper"
              }`}
            >
              {p.cta}
            </Link>
          </section>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-4 rounded-[20px] border border-dashed border-graphite/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Credit pack, ${PRICES_USD.pack}</h3>
          <p className="text-graphite">
            {n(PACK_CHARS)} characters that never expire. Unlocks WAV, SRT and {n(TIERS.pack.maxPerRequest)}-character scripts. Good if you post now and
            then.
          </p>
        </div>
        <Link
          href="/billing?buy=pack"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-ink px-6 font-semibold hover:bg-ink hover:text-paper"
        >
          Buy a pack
        </Link>
      </div>
      <p className="mt-4 text-sm text-graphite">
        Prices in USD. Taxes may be added at checkout. Payments are handled by Paddle, our reseller and merchant of record.
      </p>
    </div>
  );
}
