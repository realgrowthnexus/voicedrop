import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { LogoMark } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-10 pt-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <LogoMark size={36} />
          <p className="mt-4 text-mute">Natural English voice-overs for creators. Built on the open Kokoro voice model.</p>
          <a className="link-underline mt-4 inline-block text-ink" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2 text-mute">
          <span className="mb-1 text-sm text-ink">Product</span>
          <Link href="/voices" className="link-underline w-fit hover:text-ink">Voices</Link>
          <Link href="/pricing" className="link-underline w-fit hover:text-ink">Pricing</Link>
          <Link href="/login" className="link-underline w-fit hover:text-ink">Sign in</Link>
        </nav>
        <nav aria-label="Legal" className="flex flex-col gap-2 text-mute">
          <span className="mb-1 text-sm text-ink">Legal</span>
          <Link href="/terms" className="link-underline w-fit hover:text-ink">Terms</Link>
          <Link href="/privacy" className="link-underline w-fit hover:text-ink">Privacy</Link>
          <Link href="/refunds" className="link-underline w-fit hover:text-ink">Refund policy</Link>
          <Link href="/acceptable-use" className="link-underline w-fit hover:text-ink">Acceptable use</Link>
        </nav>
      </div>
      {/* Decorative wordmark (artwork, not text) */}
      <svg aria-hidden viewBox="0 0 1200 170" className="pointer-events-none mx-auto block w-full max-w-[1400px] select-none px-3" preserveAspectRatio="xMidYMid meet">
        <text
          x="600"
          y="140"
          textAnchor="middle"
          fill="currentColor"
          className="text-ink"
          style={{ fontFamily: "var(--font-instrument)", fontWeight: 700, fontSize: 178, letterSpacing: "-0.05em", opacity: 0.06 }}
        >
          VoiceoverDrop
        </text>
      </svg>
      <p className="mx-auto max-w-[1240px] px-5 pb-8 pt-4 text-sm text-mute sm:px-8">© {new Date().getFullYear()} VoiceoverDrop. All rights reserved.</p>
    </footer>
  );
}
