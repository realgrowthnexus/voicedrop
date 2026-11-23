import { NextResponse, type NextRequest } from "next/server";
import { applyPaddleEvent, type PaddleEvent } from "@/lib/billing/apply";
import { verifyPaddleSignature } from "@/lib/billing/paddle";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get("paddle-signature"), env().PADDLE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let evt: PaddleEvent;
  try {
    evt = JSON.parse(raw) as PaddleEvent;
    if (!evt.event_id || !evt.event_type || !evt.occurred_at) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  try {
    const result = await applyPaddleEvent(evt);
    if (result === "unmatched") console.warn("[paddle] unmatched event", evt.event_type, evt.event_id);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[paddle] apply failed", evt.event_id, e);
    return NextResponse.json({ error: "retry" }, { status: 500 }); // Paddle retries
  }
}
