import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { BRAND, LEGAL_ENTITY, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what {LEGAL_ENTITY} collects when you use {BRAND}, why, and the choices you have. We collect as little as we can.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account: your email address, and your name and profile picture if you sign in with Google.</li>
        <li>Scripts and audio: the text you submit and the files we generate for you.</li>
        <li>Usage: characters used, voice-over history and plan status, so we can apply your limits.</li>
        <li>Security: a one-way hash of your IP address (not the address itself) to stop free-plan abuse, plus standard server logs.</li>
        <li>Payments: handled entirely by Paddle. We receive your Paddle customer ID and purchase status, never your card details.</li>
      </ul>
      <h2>How long we keep it</h2>
      <ul>
        <li>Generated audio and subtitle files are deleted after 30 days.</li>
        <li>Scripts are kept with your history for up to 12 months to support refunds and abuse reviews, then deleted.</li>
        <li>Account data is kept while your account is open. Ask us and we will delete your account and data within 30 days.</li>
      </ul>
      <h2>Who processes it</h2>
      <p>
        We use trusted providers to run the service: Hostinger (web hosting), Neon (database), Cloudflare (file storage and bot protection),
        RunPod (voice generation servers), Resend (sign-in emails), Paddle (payments) and Google (optional sign-in). We do not sell your data and
        we do not use your scripts to train AI models.
      </p>
      <h2>Analytics and cookies</h2>
      <p>
        We use privacy-friendly, cookieless analytics (Umami) to count page visits. The only cookies we set are the ones needed to keep you signed
        in.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your data, correct it or have it deleted by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
