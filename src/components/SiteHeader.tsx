"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

// While the header floats over the always-dark stage, it borrows the stage colours.
const STAGE_VARS = {
  "--ink": "var(--stage-ink)",
  "--mute": "var(--stage-mute)",
  "--line-strong": "rgb(237 233 223 / 0.22)",
  "--surface-2": "rgb(237 233 223 / 0.08)",
} as React.CSSProperties;

/** Transparent over the hero; turns into frosted glass once the page scrolls. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const onStage = usePathname() === "/" && !scrolled;
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      style={onStage ? STAGE_VARS : undefined}
      className={`fixed inset-x-0 top-0 z-50 text-ink transition-[background-color,border-color,backdrop-filter] duration-500 ${
        scrolled ? "border-b border-line bg-bg/75 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-3 px-5 sm:px-8">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 text-[0.95rem]">
          <Link href="/voices" className="link-underline hidden px-3 py-2 text-mute hover:text-ink md:inline-block">
            Voices
          </Link>
          <Link href="/pricing" className="link-underline hidden px-3 py-2 text-mute hover:text-ink md:inline-block">
            Pricing
          </Link>
          <ThemeToggle />
          <Link href="/login" className="link-underline hidden px-3 py-2 text-mute hover:text-ink sm:inline-block">
            Sign in
          </Link>
          <Link href="/login" className="btn btn-primary btn-sm">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
