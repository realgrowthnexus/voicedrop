/**
 * Lightweight script screening. A match does not reject the job: it is held
 * for admin review (see jobs service). Keep patterns word-bounded to avoid
 * false positives on innocent substrings.
 */
type Rule = { reason: string; pattern: RegExp };

const RULES: Rule[] = [
  // Impersonation / phone-scam phrasing (voice-over used for robocalls).
  { reason: "scam: bank/government impersonation", pattern: /\b(this is (your|the) (bank|irs|fbi|police|social security( administration)?)|calling from (your bank|the irs|social security))\b/i },
  { reason: "scam: account verification", pattern: /\b(verify your (account|identity|card)|your account (has been|will be) (suspended|locked|closed))\b/i },
  { reason: "scam: payment demand", pattern: /\b(pay (with|in|using) (gift ?cards?|itunes cards?|bitcoin)|buy (gift ?cards?|google play cards?))\b/i },
  { reason: "scam: sensitive data request", pattern: /\b(social security number|one[- ]time (password|code)|otp code|cvv|card pin|bank pin)\b/i },
  { reason: "scam: arrest threat", pattern: /\b(warrant (for|of) your arrest|you will be arrested|legal action will be taken against you)\b/i },
  // Violent threats.
  { reason: "threat", pattern: /\b(i (will|am going to|'m going to) (kill|shoot|bomb|murder) (you|him|her|them|everyone))\b/i },
  { reason: "threat", pattern: /\b(bomb threat|plant(ed)? a bomb)\b/i },
  // Hate (small high-precision list; expand from admin review data).
  { reason: "hate speech", pattern: /\b(n[i1]gg(er|a)s?|k[i1]kes?|f[a@]gg?[o0]ts?|ch[i1]nks?|sp[i1]cs?|wetbacks?|tr[a@]nn(y|ies))\b/i },
  { reason: "hate speech", pattern: /\b(gas the|exterminate (all )?the) (jews|muslims|blacks|gays)\b/i },
];

export type Screening = { flagged: false } | { flagged: true; reason: string };

export function screenScript(text: string): Screening {
  for (const r of RULES) if (r.pattern.test(text)) return { flagged: true, reason: r.reason };
  return { flagged: false };
}
