export type TierId = "free" | "pack" | "creator" | "pro";
export type PaidPlan = "creator" | "pro";
export type Format = "mp3" | "wav" | "srt";
export type Bucket = "free" | "subscription" | "pack";

export const FORMATS: Format[] = ["mp3", "wav", "srt"];
export const FREE_WEEKLY_CHARS = 3000;
export const PLAN_ALLOWANCE: Record<PaidPlan, number> = { creator: 100_000, pro: 300_000 };
export const PACK_CHARS = 50_000;
export const FILE_RETENTION_DAYS = 30;
export const MIN_SPEED = 0.8;
export const MAX_SPEED = 1.2;
/** Hard upper bound on raw input size before normalisation (defence in depth). */
export const MAX_RAW_INPUT = 20_000;

export type TierLimits = {
  maxPerRequest: number;
  /** Rolling 24h character cap, null = no daily cap (free tier is capped weekly). */
  dailyCap: number | null;
  formats: Format[];
  /** Priority jobs are dispatched immediately; free jobs wait when the queue is busy. */
  priority: boolean;
};

export const TIERS: Record<TierId, TierLimits> = {
  free: { maxPerRequest: 1500, dailyCap: null, formats: ["mp3"], priority: false },
  pack: { maxPerRequest: 10_000, dailyCap: 25_000, formats: ["mp3", "wav", "srt"], priority: true },
  creator: { maxPerRequest: 10_000, dailyCap: 25_000, formats: ["mp3", "wav", "srt"], priority: true },
  pro: { maxPerRequest: 10_000, dailyCap: 60_000, formats: ["mp3", "wav", "srt"], priority: true },
};

export const PRICES_USD = { creator: 9, pro: 19, pack: 5 } as const;

export type Voice = {
  id: string;
  name: string;
  accent: "US" | "UK";
  gender: "male" | "female";
  description: string;
  blend?: [string, string];
};

export const VOICES: Voice[] = [
  { id: "blend_michael_fenrir", name: "Atlas", accent: "US", gender: "male", description: "Deep, warm narrator", blend: ["am_michael", "am_fenrir"] },
  { id: "am_fenrir", name: "Fenrir", accent: "US", gender: "male", description: "Bold and punchy" },
  { id: "am_michael", name: "Michael", accent: "US", gender: "male", description: "Calm, trustworthy" },
  { id: "am_onyx", name: "Onyx", accent: "US", gender: "male", description: "Low and smooth" },
  { id: "am_puck", name: "Puck", accent: "US", gender: "male", description: "Upbeat and lively" },
  { id: "bm_george", name: "George", accent: "UK", gender: "male", description: "Classic British storyteller" },
  { id: "bm_fable", name: "Fable", accent: "UK", gender: "male", description: "Friendly British voice" },
  { id: "af_heart", name: "Heart", accent: "US", gender: "female", description: "Warm and expressive" },
  { id: "af_bella", name: "Bella", accent: "US", gender: "female", description: "Bright and energetic" },
  { id: "af_kore", name: "Kore", accent: "US", gender: "female", description: "Clear and confident" },
  { id: "af_aoede", name: "Aoede", accent: "US", gender: "female", description: "Soft, gentle storyteller" },
  { id: "bf_emma", name: "Emma", accent: "UK", gender: "female", description: "Polished British voice" },
];

export function voiceById(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}
