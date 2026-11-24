import Link from "next/link";
import { FREE_WEEKLY_CHARS, PACK_CHARS, PLAN_ALLOWANCE, PRICES_USD, TIERS } from "@/lib/plans";
import { Reveal } from "./Reveal";

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
    approx: `About ${minutes(FREE_WEEKLY_CHARS)} minutes of audio`,
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
    approx: `About ${minutes(PLAN_ALLOWANCE.creator)} minutes of audio`,
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
    approx: `About ${minutes(PLAN_ALLOWANCE.pro)} minutes of audio`,
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
        {PLANS.map((p, i) => (
          <Reveal key={p.id} delay={i * 90} className="h-full">
            <section
              aria-labelledby={`plan-${p.id}`}
              className={`group relative flex h-full flex-col rounded-[22px] border p-7 transition-[border-color,transform] duration-500 ease-[var(--ease-out)] hover:-translate-y-1 ${
                p.featured ? "border-lamp/60 bg-surface-2" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 id={`plan-${p.id}`} className="text-lg font-semibold tracking-[-0.01em]">
                  {p.name}
                </h3>
                {p.featured ? <span className="rounded-full bg-lamp px-2.5 py-1 text-xs font-semibold text-lamp-ink">Most popular</span> : null}
              </div>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="display text-[3.4rem] leading-none">{p.price}</span>
                <span className="text-mute">{p.per}</span>
              </p>
              <p className="mt-4 font-medium">{p.chars}</p>
              <p className="text-sm text-mute">{p.approx}</p>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-6 text-[0.95rem]">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2.5">
                    <svg aria-hidden className="mt-1 shrink-0 text-lamp" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                    {pt}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={`btn mt-8 w-full ${p.featured ? "btn-primary" : "btn-secondary"}`}>
                {p.cta}
              </Link>
            </section>
          </Reveal>
        ))}
      </div>
      <Reveal delay={200}>
        <div className="mt-4 flex flex-col gap-5 rounded-[22px] border border-dashed border-line-strong p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.01em]">Credit pack, ${PRICES_USD.pack}</h3>
            <p className="mt-1 max-w-[60ch] text-mute">
              {n(PACK_CHARS)} characters that never expire. Unlocks WAV, SRT and {n(TIERS.pack.maxPerRequest)}-character scripts. Good if you post now
              and then.
            </p>
          </div>
          <Link href="/billing?buy=pack" className="btn btn-secondary shrink-0">
            Buy a pack
          </Link>
        </div>
      </Reveal>
      <p className="mt-5 text-sm text-mute">Prices in USD. Taxes may be added at checkout. Payments are handled by Paddle, our reseller and merchant of record.</p>
    </div>
  );
}
