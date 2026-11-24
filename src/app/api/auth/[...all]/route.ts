import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return toNextJsHandler(await auth()).GET(req);
}

export async function POST(req: Request) {
  return toNextJsHandler(await auth()).POST(req);
}
