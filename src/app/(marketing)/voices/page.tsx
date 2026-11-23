import type { Metadata } from "next";
import Link from "next/link";
import { VoicePreviewList } from "@/components/VoicePreviewList";

export const metadata: Metadata = { title: "Voices" };

export default function VoicesPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Voices</h1>
      <p className="mt-3 max-w-xl text-lg text-graphite">Twelve stock English voices, available on every plan. We never clone real people.</p>
      <div className="mt-10">
        <VoicePreviewList />
      </div>
      <Link href="/login" className="mt-10 inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-paper hover:opacity-90">
        Try them with your script
      </Link>
    </section>
  );
}
