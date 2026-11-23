import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { finalizeJob } from "@/lib/jobs/service";
import { verifyWebhookSig, type StatusResult } from "@/lib/tts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("job") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(jobId) || !verifyWebhookSig(jobId, sig)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: StatusResult;
  try {
    body = (await req.json()) as StatusResult;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const [job] = await db().select({ runpodId: jobs.runpodId }).from(jobs).where(eq(jobs.id, jobId));
  if (!job) return NextResponse.json({ ok: true }); // unknown job: acknowledge, do nothing
  if (job.runpodId && body.id && job.runpodId !== body.id) {
    return NextResponse.json({ error: "mismatch" }, { status: 409 });
  }
  await finalizeJob(jobId, body);
  return NextResponse.json({ ok: true });
}
