/** Single source of truth for the product name. Change here to rebrand. */
export const BRAND = "VoiceDrop";
export const TAGLINE = "Paste a script. Drop a natural voice-over.";
/** Public support address (footer, legal pages). Set NEXT_PUBLIC_SUPPORT_EMAIL at build time. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@voicedrop.rest";
/** Legal operator shown on policy pages. Owner must confirm the exact legal name + country before launch. */
export const LEGAL_ENTITY = process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? "VoiceDrop";
export const LEGAL_COUNTRY = process.env.NEXT_PUBLIC_LEGAL_COUNTRY ?? "Pakistan";
export const POLICY_UPDATED = "23 November 2026";
