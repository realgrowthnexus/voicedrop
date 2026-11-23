import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink" aria-label={`${BRAND} home`}>
      <svg aria-hidden width="28" height="28" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="var(--ink)" />
        <rect x="12" y="27" width="40" height="12" rx="3" fill="var(--marker)" />
        <path d="M18 22v20M26 16v32M34 22v20M42 18v28M50 26v12" stroke="var(--paper)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span>
        Voiceover<span className="text-graphite group-hover:text-ink">Drop</span>
      </span>
    </Link>
  );
}
