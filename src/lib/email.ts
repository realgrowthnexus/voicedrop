import "server-only";
import { Resend } from "resend";
import { db } from "@/db";
import { appEvents } from "@/db/schema";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";

export type Email = { to: string; subject: string; html: string; text: string; meta?: Record<string, string> };

export async function sendEmail(mail: Email): Promise<void> {
  const e = env();
  if (e.EMAIL_BACKEND === "log") {
    // Dev/test only (blocked in production by env validation).
    await db().insert(appEvents).values({ name: "dev_email", props: { to: mail.to, subject: mail.subject, text: mail.text, ...mail.meta } });
    console.log(`[dev-email] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }
  const resend = new Resend(e.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: e.EMAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
  if (error) throw new Error(`email send failed: ${error.message}`);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function magicLinkEmail(to: string, url: string): Email {
  const text = `Sign in to ${BRAND}\n\nClick this link to sign in (valid for 15 minutes):\n${url}\n\nIf you didn't ask for this, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;padding-bottom:12px">${esc(BRAND)}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;padding-bottom:24px">Click the button below to sign in. The link works once and expires in 15 minutes.</td></tr>
<tr><td style="padding-bottom:24px"><a href="${esc(url)}" style="display:inline-block;background:#141414;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:999px">Sign in to ${esc(BRAND)}</a></td></tr>
<tr><td style="font-size:13px;color:#5b5b5b;line-height:1.5">If you didn't request this, you can safely ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject: `Your ${BRAND} sign-in link`, html, text, meta: { url } };
}
