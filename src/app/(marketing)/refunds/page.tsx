import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { BRAND, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = { title: "Refund Policy" };

export default function Refunds() {
  return (
    <LegalPage title="Refund Policy">
      <p>We want you to be happy with {BRAND}. Here is how refunds work.</p>
      <h2>Failed voice-overs</h2>
      <p>If a voice-over fails or is not approved, the characters are returned to your balance automatically. You never pay for audio you didn&apos;t get.</p>
      <h2>14-day money-back</h2>
      <p>
        You can ask for a full refund of a subscription payment or credit pack within 14 days of purchase. Unused pack credits are removed from your
        account after the refund. Refunds are processed by Paddle, our merchant of record, to your original payment method.
      </p>
      <h2>Cancelling</h2>
      <p>You can cancel a subscription at any time from the billing page. You keep your plan until the end of the period you already paid for.</p>
      <h2>How to ask</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your account email, or reply to your Paddle receipt.
      </p>
    </LegalPage>
  );
}
