/** Collapse all whitespace runs to a single space and trim. */
export function normalizeScript(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Billable characters = length of the normalised script (code points). */
export function countChars(s: string): number {
  return Array.from(normalizeScript(s)).length;
}
