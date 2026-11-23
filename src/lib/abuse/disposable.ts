import domains from "./disposable-domains.json";

const SET = new Set<string>(domains as string[]);
// A few extra throwaway providers commonly used for free-tier farming.
for (const d of ["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "yopmail.com", "temp-mail.org"]) SET.add(d);

/** True if the email's domain (or any parent domain) is a known disposable provider. */
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return true;
  const parts = email.slice(at + 1).toLowerCase().trim().split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (SET.has(parts.slice(i).join("."))) return true;
  }
  return false;
}
