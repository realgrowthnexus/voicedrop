import { NextResponse, type NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/http";
import { createJob, listJobs, toPublicJob } from "@/lib/jobs/service";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: NextRequest) => {
  const u = await requireUser(req.headers);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "invalid", "Invalid JSON.");
  }
  const job = await createJob(u, body, req.headers);
  return NextResponse.json({ job: toPublicJob(job) }, { status: 201 });
});

export const GET = handle(async (req: NextRequest) => {
  const u = await requireUser(req.headers);
  const list = await listJobs(u.id);
  return NextResponse.json({ jobs: list.map((j) => toPublicJob(j)) });
});
