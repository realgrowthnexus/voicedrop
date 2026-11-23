import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function toResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: "internal", message: "Something went wrong. Please try again." }, { status: 500 });
}

/** Wrap a route handler so thrown HttpErrors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Defence in depth against CSRF for cookie-authenticated POSTs (on top of SameSite=Lax cookies). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") throw new HttpError(403, "bad_origin", "Cross-site request blocked.");
    return;
  }
  if (origin !== new URL(env().APP_URL).origin) throw new HttpError(403, "bad_origin", "Cross-site request blocked.");
}
