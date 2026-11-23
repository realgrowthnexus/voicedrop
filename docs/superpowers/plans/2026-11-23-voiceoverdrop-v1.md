# VoiceoverDrop v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-ready voice-over SaaS: paste script → Kokoro voice-over (MP3/WAV/SRT) with free/paid quotas, Paddle billing, admin panel.

**Architecture:** Next.js app at repo root (deployed to Hostinger Node Web App) owns auth, quotas, billing and admin, backed by Neon Postgres. Generation is fully async: the app reserves credits, presigns R2 upload URLs, submits to a RunPod serverless Python worker (`worker/`), which synthesizes with Kokoro ONNX, PUTs files to R2 and is reported back via RunPod's webhook. A local HTTP worker + local disk storage replace RunPod/R2 in dev and E2E so everything runs with real audio on CPU.

**Tech Stack:** Next.js 16.4 + React 19.3 + TypeScript + Tailwind 4.3, Drizzle ORM 0.45 + postgres.js 4.1, Better Auth 1.7, Zod 4, Vitest 5, Playwright (pre-installed version), Resend 6, Paddle Billing (paddle-js 1.6), AWS SDK v3 S3 presigner (R2). Worker: Python 3.11, onnxruntime(-gpu) 1.32.0, kokoro-onnx 0.6.1 (tokenizer only), runpod 2.4.0, numpy, ffmpeg.

**Spec:** `docs/superpowers/specs/2026-11-23-voicedrop-design.md`

## Global Constraints

- Display brand `VoiceoverDrop` from one constant `BRAND` in `src/lib/brand.ts`; domain `voiceoverdrop.com` via env `APP_URL`.
- Plans (exact): free 3,000 chars / rolling 7 days, 1,500/request, MP3 only; creator $9 → 100,000/billing period, 25,000/rolling 24 h; pro $19 → 300,000/period, 60,000/24 h; pack $5 → 50,000 never expire, pack tier 25,000/24 h; paid & pack 10,000/request, MP3+WAV+SRT. 1 active job per user. Commercial use allowed for all.
- Chars counted = normalised script length (trim + collapse whitespace runs to one space).
- 12 voices: `blend_michael_fenrir`, `am_fenrir`, `am_michael`, `am_onyx`, `am_puck`, `bm_george`, `bm_fable`, `af_heart`, `af_bella`, `af_kore`, `af_aoede`, `bf_emma`. Speed 0.8–1.2.
- Model `onnx-community/Kokoro-82M-v1.0-ONNX-timestamped` @ revision `dd4401a9add81ac692d20e240d22ec9dda82cc29`, file `onnx/model.onnx`; voices `voices-v1.0.bin` from kokoro-onnx release `model-files-v1.0`; both sha256-pinned.
- Never touch the VPS. No secrets in repo/client; all env validated by Zod in `src/lib/env.ts` (server-only).
- Every API route / server action re-checks session and ownership/role on the server.
- Dev-only switches (`TTS_BACKEND=local`, `STORAGE_BACKEND=local`, `EMAIL_BACKEND=log`, `CAPTCHA_DISABLED=1`) must throw at boot if `NODE_ENV=production` and `ALLOW_DEV_BACKENDS` is not set.
- UI: mobile-first, WCAG AA, light+dark (system + toggle), `prefers-reduced-motion` respected. Copy in simple English.
- Files kept 30 days. Presigned URLs live 15 min.

## Review Focus

1. Concurrent double submit (two tabs) → only one job is created; balance never goes negative. (Task 5 test `concurrent submits charge once`.)
2. Worker crash / webhook never arrives → job is failed after 15 min and credits refunded on next poll. (Task 8 test `stale processing job is failed and refunded`.)
3. Paddle webhook delivered twice or out of order → state applied once, older `occurred_at` ignored. (Task 9 tests `duplicate event is no-op`, `older subscription update ignored`.)
4. Script with emoji, URLs, only punctuation, or >limit after normalisation → clear validation error, no charge; emoji count as chars but are stripped before phonemizing without crashing. (Task 4 + Task 2 tests.)
5. Banned user with a live session → every API call returns 403 immediately (sessions revoked on ban). (Task 6 test `banned user is rejected`.)

---

## File map

```
src/lib/brand.ts           BRAND, tagline, support email
src/lib/env.ts             Zod env schema (server-only), dev-backend guard
src/lib/plans.ts           TIERS, PLAN limits, PRICES mapping, VOICES list
src/db/schema.ts           Drizzle tables (auth + app)
src/db/index.ts            db client
drizzle/                   generated SQL migrations
scripts/migrate.mjs        runs migrations (used by `npm start`)
src/lib/quota/count.ts     normalizeScript, countChars
src/lib/quota/rules.ts     pure: resolveTier, checkSubmit, planCharge
src/lib/quota/ledger.ts    DB: getBalances, chargeJob (tx + lock), refundJob
src/lib/ratelimit.ts       Postgres fixed-window limiter
src/lib/abuse/*.ts         disposable domains, content filter, ip hash
src/lib/auth.ts            Better Auth server; src/lib/auth-client.ts client
src/lib/session.ts         requireUser(), requireAdmin()
src/lib/storage/*.ts       StorageAdapter: r2.ts, local.ts
src/lib/tts/*.ts           TtsBackend: runpod.ts, local.ts; webhook signing
src/lib/jobs/service.ts    createJob, dispatchJob, pumpQueue, finalizeJob, reconcileJob
src/lib/billing/paddle.ts  verifySignature, PaddleApi (portal), parse events
src/lib/billing/apply.ts   applyPaddleEvent (idempotent)
src/lib/events.ts          track(userId, name, props)
src/app/...                pages + API routes (Tasks 8–11)
worker/vd_worker/*.py      text, phonemize, engine, timing, srt, audio, handler
worker/local_server.py     dev HTTP worker emulating RunPod /run + webhook
worker/Dockerfile          RunPod image (GPU), model pinned
worker/tests/              pytest
tests/unit, tests/integration, tests/e2e
docs/DEPLOY.md             owner step-by-step go-live guide
```

---

### Task 1: Scaffold app, env, constants

**Files:** Create `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/page.tsx` (placeholder), `src/lib/brand.ts`, `src/lib/env.ts`, `src/lib/plans.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`. Test: `tests/unit/plans.test.ts`, `tests/unit/env.test.ts`.

**Interfaces — Produces:**
- `type TierId = 'free' | 'pack' | 'creator' | 'pro'`; `TIERS: Record<TierId, { maxPerRequest: number; dailyCap: number | null; formats: Format[]; priority: boolean }>`
- `type Format = 'mp3' | 'wav' | 'srt'`; `FREE_WEEKLY_CHARS = 3000`; `PLAN_ALLOWANCE = { creator: 100_000, pro: 300_000 }`; `PACK_CHARS = 50_000`
- `VOICES: { id: string; name: string; accent: 'US'|'UK'; gender: 'male'|'female'; blend?: [string,string] }[]` (12 entries)
- `env` (parsed object), `parseEnv(raw): Env` throwing on invalid/dev-in-prod.

- [ ] Step 1: tests — `TIERS.free.maxPerRequest === 1500`, `TIERS.creator.dailyCap === 25000`, `TIERS.pro.dailyCap === 60000`, `TIERS.pack.dailyCap === 25000`, `TIERS.free.formats` equals `['mp3']`, `VOICES.length === 12` with unique ids; `parseEnv({NODE_ENV:'production', TTS_BACKEND:'local', ...})` throws; valid dev env parses.
- [ ] Step 2: run `npx vitest run` → FAIL. Step 3: implement. Step 4: PASS. Step 5: commit `feat: scaffold app, env schema, plan constants`.

### Task 2: TTS worker core (Python)

**Files:** `worker/pyproject.toml`, `worker/requirements.txt` (pinned), `worker/vd_worker/{text,phonemize,engine,timing,srt,audio,pipeline,handler}.py`, `worker/scripts/fetch_models.py` (download + sha256 verify), `worker/local_server.py`, `worker/Dockerfile`, `worker/tests/test_*.py`.

**Interfaces — Produces:**
- Job input (JSON, same for RunPod and local): `{ "job_id": str, "text": str, "voice": str, "speed": float, "formats": ["mp3","wav","srt"], "uploads": { "mp3": url, "wav"?: url, "srt"?: url } }`
- Job output: `{ "job_id", "duration_sec": float, "chars": int, "words": int, "files": { fmt: { "bytes": int } } }`; on error raise → RunPod status FAILED with `error` string.
- `synthesize(text, voice, speed) -> (np.ndarray float32 @24kHz, list[WordTiming(word,start,end)])`
- `build_srt(words, max_chars=42, max_dur=2.0) -> str`
- local_server: `POST /run {input, webhook}` → `{id, status:"IN_QUEUE"}`, runs job in a single worker thread (FIFO), POSTs `{id,status:"COMPLETED"|"FAILED",output|error}` to webhook; `GET /status/{id}`; `GET /health`.

- [ ] Step 1: fetch models into `worker/models/` (gitignored) with `fetch_models.py`; record sha256 constants in the script.
- [ ] Step 2: tests: `split_sentences` keeps abbreviations ("Dr. Smith") together; `chunk_tokens` never exceeds 500; emoji/URL-only input yields a clean `ValueError("no speakable text")`; `durations_to_words` monotonic, last end ≈ audio length (±0.15 s); `build_srt` cue text ≤42 chars, indices sequential, `HH:MM:SS,mmm`; blend style equals mean of two voices; `peak_normalize` max abs = 0.95; end-to-end real synth "Hello world. This is a test." with `af_heart` → 1–5 s audio, 6 words, MP3 decodes via ffprobe.
- [ ] Step 3: implement (word-by-word phonemize via `kokoro_onnx.tokenizer.Tokenizer`, sentence synth, style = `voice[len(tokens)]`, duration unit verified empirically against waveform length, 120 ms gap between sentences, ffmpeg libmp3lame 160k).
- [ ] Step 4: `cd worker && python -m pytest -q` PASS. Measure CPU speed; note in BRAIN.
- [ ] Step 5: Dockerfile (python:3.11-slim + ffmpeg + `onnxruntime-gpu[cuda,cudnn]==1.32.0`, models fetched + verified at build, `CMD python -u -m vd_worker.handler`). Commit `feat(worker): kokoro pipeline, srt, local server, runpod image`.

### Task 3: Database schema + migrations + test harness

**Files:** `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `drizzle/*.sql`, `scripts/migrate.mjs`, `tests/helpers/db.ts`.

**Tables (Produces):** Better Auth (`user` + app columns `role text default 'user'`, `banned bool`, `banReason`, `signupIpHash`, `compPlan text null`, `compUntil timestamptz null`; `session`, `account`, `verification`); `subscriptions` (id, userId, paddleSubscriptionId unique, paddleCustomerId, plan, status, periodStart, periodEnd, cancelAtPeriodEnd, lastEventAt); `credit_ledger` (id, userId, bucket `'free'|'subscription'|'pack'`, delta int, reason, jobId null, paddleRef null, effectiveAt, createdAt; unique(jobId, reason) where jobId not null; unique(paddleRef, reason) where paddleRef not null); `jobs` (id uuid, userId, status `'held'|'queued'|'processing'|'done'|'failed'|'rejected'`, text, voice, speed, formats text[], chars, tier, priority bool, runpodId, error, durationSec, files jsonb, flagReason, createdAt, dispatchedAt, finishedAt, expiresAt); `paddle_events` (eventId pk, type, occurredAt, payload jsonb, processedAt); `transactions` (paddleTransactionId pk, userId, kind, amountCents, currency, status, createdAt); `rate_limits` (key, windowStart, count; pk key+windowStart); `app_events` (id, userId null, name, props jsonb, createdAt); `admin_actions` (id, adminId, targetUserId, action, details jsonb, createdAt).

- [ ] Step 1: `tests/helpers/db.ts` creates a fresh schema per test file on local Postgres (`DATABASE_URL_TEST`) and runs migrations. Test: migration applies, tables exist.
- [ ] Step 2: generate migration with drizzle-kit; run; PASS. Commit `feat(db): schema and migrations`.

### Task 4: Quota rules (pure)

**Files:** `src/lib/quota/count.ts`, `src/lib/quota/rules.ts`; Test `tests/unit/quota.test.ts`.

**Interfaces — Produces:**
- `normalizeScript(s: string): string`; `countChars(s: string): number`
- `type Balances = { freeRemaining: number; subscriptionRemaining: number; packRemaining: number; usedLast24h: number; activeJobs: number; subscriptionPlan: 'creator'|'pro'|null }`
- `resolveTier(b: Balances): TierId` — sub plan if set, else `pack` if packRemaining>0, else `free`.
- `checkSubmit(input: { chars: number; formats: Format[]; banned: boolean }, b: Balances): { ok: true; tier: TierId; charges: { bucket: Bucket; amount: number }[] } | { ok: false; code: 'banned'|'empty'|'too_long'|'format_not_allowed'|'job_active'|'daily_cap'|'insufficient' }`
- Spend order: creator/pro → subscription then pack; pack → free then pack; free → free.

- [ ] Step 1 tests (exact): free user 1,501 chars → `too_long`; free asks `wav` → `format_not_allowed`; free with 500 left asks 600 → `insufficient`; creator usedLast24h 24,000 + 2,000 → `daily_cap`; creator subRemaining 1,000 + pack 50,000, 3,000 chars → charges `[{subscription:1000},{pack:2000}]`; pack tier free 3,000 left, 5,000 chars → `[{free:3000},{pack:2000}]`; activeJobs 1 → `job_active`; whitespace-only → `empty`; `countChars("  a \n\n b ") === 3`.
- [ ] Steps 2–5: fail → implement → pass → commit `feat(quota): tier and charge rules`.

### Task 5: Ledger (DB)

**Files:** `src/lib/quota/ledger.ts`; Test `tests/integration/ledger.test.ts`.

**Interfaces — Consumes:** Task 3 tables, Task 4 `checkSubmit`. **Produces:**
- `getBalances(tx, userId, now): Promise<Balances>` (free window 7 d on `effectiveAt`; subscription usage within active sub `[periodStart, periodEnd)` or comp plan calendar month; pack = all-time sum).
- `reserveAndCreateJob(userId, jobDraft): Promise<{ ok: true; job } | { ok: false; code }>` — one transaction, `SELECT ... FOR UPDATE` on the user row, then `checkSubmit`, insert job + negative ledger rows (`reason 'job_charge'`, `effectiveAt = now`).
- `refundJob(tx, jobId): Promise<void>` — inserts positive mirror rows with `reason 'job_refund'`; unique index makes it idempotent.
- `grantPack(tx, userId, paddleRef, chars)`, `adminAdjust(tx, userId, delta, adminId)`.

- [ ] Tests: `concurrent submits charge once` (two parallel `reserveAndCreateJob` → one ok, one `job_active`); refund twice → balance restored once; free usage 8 days old no longer counts; subscription usage from previous period doesn't count; pack grant same `paddleRef` twice → granted once.
- [ ] Commit `feat(quota): transactional ledger`.

### Task 6: Auth + abuse on signup

**Files:** `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/session.ts`, `src/lib/email.ts` (Resend | log backend writing to `app_events` name `dev_email` for tests), `src/lib/abuse/disposable.ts` (bundled list), `src/lib/abuse/ip.ts` (`clientIp(headers)`, `hashIp(ip)` HMAC with `IP_HASH_SECRET`). Tests `tests/integration/auth.test.ts`.

**Interfaces — Produces:** `requireUser(): Promise<User>` (throws `HttpError(401)`; `403` if banned), `requireAdmin()` (email in `ADMIN_EMAILS`), `HttpError`, `toResponse(err)`.

- Better Auth: Google provider, `magicLink` plugin (15 min expiry), `captcha` plugin (cloudflare-turnstile) on `/sign-in/magic-link` unless `CAPTCHA_DISABLED`, built-in rate limit (database storage), `databaseHooks.user.create.before`: reject disposable domains, reject when ≥3 users share `signupIpHash` in last 30 days; store hash.
- [ ] Tests: disposable domain rejected; 4th signup same IP rejected; `banned user is rejected` (requireUser → 403); non-admin `requireAdmin` → 403. Commit `feat(auth): google + magic link, signup abuse rules`.

### Task 7: Rate limiter + content filter

**Files:** `src/lib/ratelimit.ts` (`rateLimit(key, limit, windowSec): Promise<{ ok: boolean; retryAfter: number }>` via upsert), `src/lib/abuse/content.ts` (`screenScript(text): { flagged: false } | { flagged: true; reason: string }`, word-boundary regex list for hate slurs/threats/scam-impersonation phrases e.g. "this is your bank", "IRS agent", "verify your account", "gift card", "social security number"). Tests unit + integration.

- [ ] Tests: 11th call in window with limit 10 → `ok:false`; window rolls; "Call me to verify your account and buy gift cards" flagged; normal YouTube script not flagged; "Scunthorpe"-style substrings not flagged. Commit `feat(abuse): rate limiting and script screening`.

### Task 8: Storage, TTS backends, job service, job API

**Files:** `src/lib/storage/{index,r2,local}.ts`, `src/app/api/dev-storage/[...key]/route.ts` (PUT/GET with HMAC token, 404 in production), `src/lib/tts/{index,runpod,local,sign}.ts`, `src/lib/jobs/service.ts`, routes `src/app/api/jobs/route.ts` (POST create, GET list), `src/app/api/jobs/[id]/route.ts` (GET status), `src/app/api/jobs/[id]/file/[format]/route.ts` (302 to signed GET), `src/app/api/webhooks/runpod/route.ts`. Tests `tests/integration/jobs.test.ts` with a fake TtsBackend.

**Interfaces — Produces:**
- `StorageAdapter { putUrl(key, contentType): Promise<string>; getUrl(key, filename): Promise<string>; }` keys `jobs/{userId}/{jobId}.{fmt}`
- `TtsBackend { submit(input: JobInput, webhookUrl: string): Promise<{ id: string }>; status(id): Promise<{ status: 'IN_QUEUE'|'IN_PROGRESS'|'COMPLETED'|'FAILED'|'CANCELLED'|'TIMED_OUT'; output?: JobOutput; error?: string }> }`
- `signWebhook(jobId): string` / `verifyWebhook(jobId, sig): boolean` (HMAC-SHA256 `RUNPOD_WEBHOOK_SECRET`, timing-safe).
- service: `createJob(user, body, ip)` (validate Zod `{ text ≤ 20000 raw, voice ∈ VOICES, speed 0.8–1.2, formats ⊆ Format[] min 1 }`, rate limits 10/min user + 30/min IP, screen → status `held` if flagged, `reserveAndCreateJob`, then `pumpQueue()`), `pumpQueue()` (dispatch all queued priority jobs; dispatch free jobs only while processing-count < `FREE_MAX_INFLIGHT` default 2; `FOR UPDATE SKIP LOCKED`), `finalizeJob(jobId, result)` (processing → done/failed; failed ⇒ `refundJob`; idempotent), `reconcileJob(job)` (processing > 2 min ⇒ ask backend status; > 15 min ⇒ fail+refund), `approveHeld(jobId)`, `rejectHeld(jobId)` (refund).
- [ ] Tests: create → fake backend got input with only allowed formats and presigned URLs; webhook bad sig → 401; COMPLETED → done with files; FAILED → refund; `stale processing job is failed and refunded`; free job stays queued when 2 in flight, paid job dispatched; other user's job → 404; download of non-allowed format → 404.
- [ ] Commit `feat(jobs): async generation pipeline and API`.

### Task 9: Paddle billing

**Files:** `src/lib/billing/paddle.ts` (`verifyPaddleSignature(rawBody, header, secret, now): boolean` ts tolerance 5 min, `createPortalUrl(customerId)`), `src/lib/billing/apply.ts` (`applyPaddleEvent(evt)`), `src/app/api/webhooks/paddle/route.ts`, `src/app/api/billing/portal/route.ts`. Tests `tests/unit/paddle-signature.test.ts`, `tests/integration/billing.test.ts` with fixture payloads in `tests/fixtures/paddle/*.json`.

Event handling: `subscription.created|updated|activated|canceled|past_due|paused|resumed` → upsert `subscriptions` by `paddleSubscriptionId`, plan from `items[0].price.id` (env `PADDLE_PRICE_CREATOR|PRO`), period from `current_billing_period`, ignore if `occurred_at` < `lastEventAt`; user from `custom_data.userId` (verified to exist). Active = status `active|trialing` or (`canceled` with periodEnd > now and was scheduled). `transaction.completed` → insert `transactions`; if price = `PADDLE_PRICE_PACK` → `grantPack` per quantity. `adjustment.created|updated` approved refund → mark transaction refunded; pack refund revokes `min(remaining pack, 50k×qty)`. All inside one tx with `paddle_events` insert-first (duplicate ⇒ no-op).
- [ ] Tests: valid/invalid/expired signature; `duplicate event is no-op`; `older subscription update ignored`; pack purchase grants 50,000; creator sub → tier creator with 100,000; cancel keeps access until periodEnd; pack refund revokes. Commit `feat(billing): paddle webhooks, plans, packs, portal`.

### Task 10: UI (invoke frontend-design skill first)

**Files:** `src/app/(marketing)/{page,pricing,voices}`, `src/app/(legal)/{terms,privacy,refund,acceptable-use}`, `src/app/login`, `src/app/(app)/{dashboard,history,billing}`, `src/components/*` (ThemeToggle, VoicePicker with sample player, ScriptEditor with live count/limit, JobProgress polling `/api/jobs/:id` every 2 s with backoff, AudioPlayer, Downloads, PricingCards w/ Paddle.js overlay `customData: { userId }`), `public/samples/*.mp3` (generated by `worker/scripts/make_samples.py`), `src/app/globals.css` design tokens.

- [ ] Generate 12 voice samples with the real worker; landing demo uses them.
- [ ] Visual check via Playwright screenshots: 390×844 + 1440×900, light + dark, for landing, pricing, dashboard (idle, generating, done), history. Commit `feat(ui): marketing, dashboard, billing, legal pages`.

### Task 11: Admin + analytics

**Files:** `src/app/admin/{page,users,users/[id],jobs,flags}`, `src/lib/admin/actions.ts` (server actions: `banUser`, `unbanUser` (revoke sessions), `adjustCredits(userId, delta, note)`, `setCompPlan(userId, plan|null, until)`, `approveFlag`, `rejectFlag`; each `requireAdmin()` + writes `admin_actions`), `src/lib/admin/stats.ts` (`getStats(now)`: users total/7d, jobs 24h by status, chars 24h/30d, revenue 30d from `transactions`, funnel signup → first job → paid over 30 d, queue depth), `src/lib/events.ts`, Umami `<Script>` in layout when `NEXT_PUBLIC_UMAMI_SRC` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID` set.
- [ ] Tests: non-admin calling each action → 403; ban revokes sessions; adjustCredits changes pack balance and logs; stats numbers on seeded data. Commit `feat(admin): admin panel, stats, analytics`.

### Task 12: Hardening + E2E

**Files:** `next.config.ts` security headers (CSP allowing self, Paddle, Turnstile, Umami, R2 media; HSTS; frame-ancestors none), `tests/e2e/*.spec.ts`, `playwright.config.ts`, `scripts/dev-stack.sh` (Postgres + local worker + next).
- [ ] E2E: magic-link login (read link from dev mailbox) → generate 200-char script → audio element plays (duration > 0) → MP3 download 200 + `audio/mpeg`; free user cannot pick WAV; admin ban → user's next request 403; axe: no serious/critical violations on main pages (light + dark).
- [ ] Run security-review skill on branch; fix findings. Commit `test: e2e and security hardening`.

### Task 13: Deploy guide + BRAIN

**Files:** `docs/DEPLOY.md` (owner steps: buy domain → Cloudflare DNS → Neon → R2 bucket + CORS + lifecycle 30 d → Turnstile → Resend domain → Google OAuth → RunPod endpoint from GitHub repo `worker/Dockerfile`, flex, max 3 workers, idle 30 s, budget alert → Paddle products/prices/webhook → Hostinger Web App from GitHub with env list → Umami → smoke test), `docs/BRAIN.md` updated, README.
- [ ] Commit `docs: deploy guide`; push; update PR.
