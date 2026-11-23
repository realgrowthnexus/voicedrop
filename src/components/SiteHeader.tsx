import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Logo />
      <nav aria-label="Main" className="flex items-center gap-1 text-[0.95rem] sm:gap-2">
        <Link href="/voices" className="hidden rounded-full px-3 py-2 text-graphite hover:text-ink sm:inline-block">Voices</Link>
        <Link href="/pricing" className="hidden rounded-full px-3 py-2 text-graphite hover:text-ink sm:inline-block">Pricing</Link>
        <ThemeToggle />
        <Link href="/login" className="rounded-full px-3 py-2 text-graphite hover:text-ink">Sign in</Link>
        <Link href="/login" className="hidden rounded-full bg-ink px-4 py-2 font-semibold text-paper hover:opacity-90 sm:inline-block">Start free</Link>
      </nav>
    </header>
  );
}
