"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SETTINGS, saveSettings } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/session";
import { adjustCredits, banUser, moderate, setCompPlan, unbanUser } from "./ops";

const id = z.string().min(1).max(64);

export async function banAction(form: FormData) {
  const admin = await requireAdmin();
  const { userId, reason } = z.object({ userId: id, reason: z.string().max(300).default("") }).parse(Object.fromEntries(form));
  await banUser(admin, userId, reason);
  revalidatePath(`/admin/users/${userId}`);
}

export async function unbanAction(form: FormData) {
  const admin = await requireAdmin();
  const { userId } = z.object({ userId: id }).parse(Object.fromEntries(form));
  await unbanUser(admin, userId);
  revalidatePath(`/admin/users/${userId}`);
}

export async function creditsAction(form: FormData) {
  const admin = await requireAdmin();
  const { userId, delta, note } = z
    .object({ userId: id, delta: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((d) => d !== 0), note: z.string().max(200).default("") })
    .parse(Object.fromEntries(form));
  await adjustCredits(admin, userId, delta, note);
  revalidatePath(`/admin/users/${userId}`);
}

export async function compPlanAction(form: FormData) {
  const admin = await requireAdmin();
  const { userId, plan, days } = z
    .object({ userId: id, plan: z.enum(["none", "creator", "pro"]), days: z.coerce.number().int().min(1).max(366).default(30) })
    .parse(Object.fromEntries(form));
  await setCompPlan(admin, userId, plan === "none" ? null : plan, days);
  revalidatePath(`/admin/users/${userId}`);
}

export async function moderateAction(form: FormData) {
  const admin = await requireAdmin();
  const { jobId, decision } = z.object({ jobId: z.uuid(), decision: z.enum(["approve", "reject"]) }).parse(Object.fromEntries(form));
  await moderate(admin, jobId, decision);
  revalidatePath("/admin/flags");
  revalidatePath("/admin");
}

export type SettingsResult = { ok: boolean; message: string };

/** Admin → Settings. Blank secret fields keep the stored value; tick "clear" to remove one. */
export async function saveSettingsAction(_prev: SettingsResult | null, form: FormData): Promise<SettingsResult> {
  const admin = await requireAdmin();
  const patch: Record<string, string | undefined> = {};
  for (const def of SETTINGS) {
    const v = form.get(def.key);
    const clear = form.get(`clear:${def.key}`) === "on";
    if (clear) patch[def.key] = "";
    else if (typeof v === "string") {
      if (v.length > 2000) return { ok: false, message: `${def.label} is too long.` };
      if (def.secret && !v.trim()) continue; // blank secret = keep
      patch[def.key] = v;
    }
  }
  if (patch.PADDLE_ENV && !["sandbox", "production"].includes(patch.PADDLE_ENV.trim())) {
    return { ok: false, message: "Paddle environment must be “sandbox” or “production”." };
  }
  if (patch.SMTP_PORT && !/^\d{2,5}$/.test(patch.SMTP_PORT.trim())) return { ok: false, message: "SMTP port must be a number like 465." };
  await saveSettings(patch, admin.id);
  revalidatePath("/admin/settings");
  revalidatePath("/login");
  return { ok: true, message: "Saved. Changes are live now." };
}

export async function testEmailAction(): Promise<SettingsResult> {
  const admin = await requireAdmin();
  try {
    await sendEmail({
      to: admin.email,
      subject: "VoiceDrop test email",
      text: "If you can read this, VoiceDrop can send sign-in emails.",
      html: "<p>If you can read this, VoiceDrop can send sign-in emails.</p>",
    });
    return { ok: true, message: `Test email sent to ${admin.email}. Check the inbox (and spam).` };
  } catch (e) {
    return { ok: false, message: `Sending failed: ${(e as Error).message}` };
  }
}
