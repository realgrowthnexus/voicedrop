import "server-only";
import { cookies } from "next/headers";

/** Cheap check (no DB) used only to choose header links; real auth happens server-side per action. */
export async function hasSessionCookie(): Promise<boolean> {
  const c = await cookies();
  return c.has("better-auth.session_token") || c.has("__Secure-better-auth.session_token");
}
