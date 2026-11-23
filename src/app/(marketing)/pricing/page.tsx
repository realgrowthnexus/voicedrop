import type { Metadata } from "next";
import { PricingTable } from "@/components/PricingTable";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Pricing</h1>
      <p className="mt-3 max-w-xl text-lg text-graphite">
        Pay for the minutes you need. About 1,000 characters make one minute of audio. Failed voice-overs are always refunded.
      </p>
      <div className="mt-10">
        <PricingTable />
      </div>
    </section>
  );
}
