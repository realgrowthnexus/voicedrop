import { NextResponse, type NextRequest } from "next/server";
import { accountSummary } from "@/lib/account/summary";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  const u = await requireUser(req.headers);
  return NextResponse.json(await accountSummary(u), { headers: { "cache-control": "no-store" } });
});
