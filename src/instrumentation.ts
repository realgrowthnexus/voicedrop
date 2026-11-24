/** Runs once when the server starts, before it serves requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureBooted } = await import("@/lib/bootstrap");
    await ensureBooted();
  }
}
