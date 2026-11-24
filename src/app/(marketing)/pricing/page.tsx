import type { Metadata } from "next";
import { PricingTable } from "@/components/PricingTable";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-10 pt-32 sm:px-8 sm:pt-40">
      <h1 className="display text-[clamp(3rem,8vw,6.5rem)]">
        <span className="line-mask"><span>Pricing.</span></span>
      </h1>
      <p className="fade-in mt-5 max-w-xl text-lg text-mute" style={{ ["--d" as string]: "250ms" }}>
        Pay for the minutes you need. About 1,000 characters make one minute of audio, and failed voice-overs are always refunded.
      </p>
      <div className="mt-14">
        <PricingTable />
      </div>
    </section>
  );
}
