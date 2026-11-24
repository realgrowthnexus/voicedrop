import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { VoicePreviewList } from "@/components/VoicePreviewList";

export const metadata: Metadata = { title: "Voices" };

export default function VoicesPage() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-10 pt-32 sm:px-8 sm:pt-40">
      <h1 className="display text-[clamp(3rem,8vw,6.5rem)]">
        <span className="line-mask"><span>Voices.</span></span>
      </h1>
      <p className="fade-in mt-5 max-w-xl text-lg text-mute" style={{ ["--d" as string]: "250ms" }}>
        Twelve stock English voices on every plan, American and British. We never clone real people.
      </p>
      <Reveal delay={150} className="mt-14">
        <VoicePreviewList />
      </Reveal>
      <Link href="/login" className="btn btn-primary btn-lg mt-12">
        Try them with your script
      </Link>
    </section>
  );
}
