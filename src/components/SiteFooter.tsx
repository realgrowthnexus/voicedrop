import Link from "next/link";
import { BRAND, SUPPORT_EMAIL } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-graphite sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <p className="font-semibold text-ink">{BRAND}</p>
          <p className="mt-1">Natural English voice-overs for creators. Built on the open Kokoro-82M voice model.</p>
          <p className="mt-3">
            Questions? <a className="underline underline-offset-4 hover:text-ink" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2">
          <Link href="/voices" className="hover:text-ink">Voices</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/refunds" className="hover:text-ink">Refund policy</Link>
          <Link href="/acceptable-use" className="hover:text-ink">Acceptable use</Link>
        </nav>
      </div>
    </footer>
  );
}
