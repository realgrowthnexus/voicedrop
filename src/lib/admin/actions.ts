"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
