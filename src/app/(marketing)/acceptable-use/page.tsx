import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { BRAND, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = { title: "Acceptable Use Policy" };

export default function AcceptableUse() {
  return (
    <LegalPage title="Acceptable Use Policy">
      <p>{BRAND} is for creators. To keep it safe, you may not use it to create audio that:</p>
      <ul>
        <li>Impersonates a real person, company or authority, or pretends to be a human caller (for example bank, tax-office or police calls).</li>
        <li>Is used for fraud, scams, phishing, robocalls or spam.</li>
        <li>Threatens, harasses or promotes violence against anyone.</li>
        <li>Attacks people based on race, ethnicity, religion, gender, sexual orientation, disability or nationality.</li>
        <li>Sexualises minors, or is otherwise illegal where you or your audience live.</li>
        <li>Spreads deliberately false information about elections, health emergencies or public safety.</li>
      </ul>
      <h2>No voice cloning</h2>
      <p>We only offer our own stock voices. We do not clone, and you may not attempt to recreate, the voice of any real person.</p>
      <h2>How we enforce it</h2>
      <p>
        Scripts are screened automatically. Some are held for a short human review before they are generated. Scripts that break this policy are
        refused (and the characters refunded). Repeated or serious misuse leads to account suspension.
      </p>
      <h2>Report misuse</h2>
      <p>
        If you think audio made with {BRAND} is being misused, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
