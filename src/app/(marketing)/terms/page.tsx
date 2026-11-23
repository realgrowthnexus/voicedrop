import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { BRAND, LEGAL_COUNTRY, LEGAL_ENTITY, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {LEGAL_ENTITY} ({LEGAL_COUNTRY}), the operator of {BRAND}. By creating an account or using the
        service you accept them.
      </p>
      <h2>The service</h2>
      <p>
        {BRAND} turns text you provide into synthetic speech using stock voices. We offer a free plan, monthly subscriptions and one-off credit packs,
        each with the limits shown on our <Link href="/pricing">pricing page</Link>. We may change features or limits; changes to paid plans apply
        from your next billing period.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>You must be at least 16 years old and give a real, permanent email address.</li>
        <li>One free account per person. Creating several accounts to get more free characters is not allowed.</li>
        <li>You are responsible for activity under your account. Tell us at once if you think it has been misused.</li>
      </ul>
      <h2>Your content and the audio</h2>
      <p>
        You keep all rights to the scripts you upload. You give us permission to process them only to provide the service. Subject to these terms
        and our <Link href="/acceptable-use">Acceptable Use Policy</Link>, you may use the audio and subtitles you generate for any lawful purpose,
        including commercial use, on every plan. You are responsible for the scripts you submit and how you use the output.
      </p>
      <h2>Payments</h2>
      <p>
        Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides
        all customer service inquiries and handles returns. Subscriptions renew automatically each month until cancelled; you can cancel at any
        time and keep access until the end of the paid period. See our <Link href="/refunds">refund policy</Link>.
      </p>
      <h2>Fair use and limits</h2>
      <p>
        Plans include daily fair-use limits so the service stays fast for everyone. We may pause or limit accounts that put unusual load on the
        service or try to get around limits.
      </p>
      <h2>Suspension</h2>
      <p>
        We may suspend or close accounts that break these terms or the Acceptable Use Policy. If we close a paid account without cause, we will
        refund unused credits.
      </p>
      <h2>Disclaimers and liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. Synthetic speech can contain mispronunciations; please review audio before publishing. To the
        extent the law allows, our total liability is limited to the amount you paid us in the 12 months before the claim.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
