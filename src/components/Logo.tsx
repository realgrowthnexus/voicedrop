import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 2.8c0 0-10.2 11.6-10.2 18a10.2 10.2 0 0 0 20.4 0c0-6.4-10.2-18-10.2-18Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.6 21.2c1.6-2.6 2.6 2.6 4.2 0s2.6-5.2 4.4 0 2.6 2.6 4.2 0" stroke="var(--lamp)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 text-[1.05rem] font-semibold tracking-[-0.02em] text-ink" aria-label={`${BRAND} home`}>
      <span className="transition-transform duration-500 ease-[var(--ease-out)] group-hover:-rotate-12">
        <LogoMark />
      </span>
      <span>VoiceoverDrop</span>
    </Link>
  );
}
