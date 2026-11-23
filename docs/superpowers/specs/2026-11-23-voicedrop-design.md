# VoiceDrop — Product Spec & Design (v1)

Date: 2026-11-23 · Status: **approved (owner "go", brand = VoiceoverDrop)** — implemented on branch claude/voicedrop-saas-build-9ldp5p

## 1. Intent

A self-serve web app for **YouTubers / TikTokers** (faceless channels, shorts, explainers):
paste a script → pick a voice → get a natural English voice-over (MP3/WAV) plus
word-timed subtitles (SRT) to download. Cheaper than ElevenLabs (~3x), simple, fast.

Success = creators sign up, generate on the free plan, and convert to a paid plan or
credit pack; infra cost per paid user stays a few % of revenue.

**Non-goals (v1):** voice cloning (never — anti-goal), non-English languages, team
seats, API for developers, mobile apps, video editing.

**Anti-goals:** anything that disturbs the owner's existing VPS apps (`juc-*`,
`ots-*`, Caddy); secrets in the repo or client; free tier that can be farmed.

## 2. Decisions (owner answers)

| Topic | Decision |
|---|---|
| Brand | "VoiceDrop" chosen. ⚠ A US company "VoiceDrop" (ringless voicemail) owns voicedrop.com/.ai/.io. **Claude's call:** display brand "VoiceoverDrop" to match the domain and avoid trademark/Paddle-review trouble; name lives in one config constant (`BRAND`) so it can be switched in seconds. Owner to confirm. |
| Domain | Owner wants a new domain; no preference → **Claude's call: `voiceoverdrop.com`** (~$12/yr, available on 2026-11-23). Buy only after owner approval. DNS on Cloudflare (free) for R2 custom domain + Turnstile. |
| Users | YouTubers / TikTokers |
| Language | English only at launch (American + British voices) |
| Voices | 12 curated Kokoro voices (see §5) |
| Free tier | 3,000 chars / rolling week, max 1,500 chars per request, MP3 only |
| Paid | Creator $9/mo = 100k chars; Pro $19/mo = 300k chars; Credit pack $5 = 50k chars (never expires) |
| Daily fair-use cap | Creator 25k/day, Pro 60k/day, pack-only 25k/day; 1 active job per user; paid jobs dispatched first |
| Max per request | Free 1,500 · Paid/pack 10,000 chars (~10 min audio) |
| Formats | Free: MP3 · Paid/pack: MP3 + WAV + SRT (word-timed) |
| Commercial use | **Allowed for everyone** (free included). Kokoro-82M is Apache-2.0. |
| Login | Google + email magic link (no passwords) |
| Payments | **Paddle** (merchant of record; Pakistan is a supported seller country; payout via Payoneer/wire). Stripe not available in PK; Lemon Squeezy shutting down Mar 2027. |
| Abuse | Cloudflare Turnstile captcha, disposable-email block, ≤3 free accounts per IP, rate limits, script keyword filter → flag for review, admin ban. No voice cloning. |
| Admin | Users list/search, ban/unban, grant/revoke credits, change plan, job/queue status, revenue + usage numbers, flagged-scripts review. Admin = owner's email only (env `ADMIN_EMAILS`). |
| Analytics | Self-hosted Umami (cookieless) + in-app funnel stats in admin |
| Data/hosting | Website on Hostinger Web App (Node.js); DB = Neon Postgres (free); files = Cloudflare R2 (free 10 GB, no egress fee) |
| TTS compute | **GPU serverless (RunPod), pay per use.** VPS is not used → zero risk to `juc-*`/`ots-*`. |

## 3. Approaches considered

1. **Hostinger web + Neon + R2 + RunPod GPU serverless (chosen).** $0 fixed cost, scales
   automatically, VPS untouched. Trade-off: cold start (~10–30 s on first job after idle),
   per-use GPU bill, more external accounts.
2. **Hostinger web + Neon + R2 + VPS CPU worker (low priority, ≤2 CPU).** $0, but slow
   (~0.4x real-time, slower while OTS renders), needs a tunnel for ingress, a handful of
   users at once. Kept as a fallback: the worker image is CPU/GPU-agnostic.
3. **Supabase Pro ($25/mo) all-in-one.** Simplest ops, but fixed cost from day one and the
   owner's free Supabase slots are full (limit is per user, a new org doesn't help).

## 4. Architecture

```
Browser ──HTTPS──> Next.js app (Hostinger Web App, Node)
                     │  auth, quotas, billing, admin, API routes
                     ├──> Neon Postgres (users, sessions, jobs, ledger, events)
                     ├──> Cloudflare R2 (presigned URLs; audio + SRT)
                     ├──> Paddle (checkout overlay; signed webhooks back)
                     ├──> Resend (magic-link emails)
                     └──> RunPod Serverless /run (async) ──> Kokoro worker (GPU)
                                   worker uploads to R2 via presigned PUT URLs
                                   worker calls back  POST /api/webhooks/runpod (HMAC)
```

Why this shape: Hostinger Node hosting has a **120 s request limit and no background
workers**, so generation is fully async — the app submits the job, RunPod runs it, the
worker uploads results straight to R2 and calls our webhook. The browser polls
`/api/jobs/:id`; if a webhook is late, that poll also asks RunPod `/status` (self-healing,
no cron needed). Worker gets **only short-lived presigned URLs**, never R2 keys.

### Stack (Claude's calls)
- **Web:** Next.js (App Router) + TypeScript + Tailwind CSS, server actions/route handlers;
  Zod validation on every input; `server-only` modules for secrets.
- **DB:** Neon Postgres + Drizzle ORM + SQL migrations. Rate limits/quotas in Postgres
  (no Redis needed at this scale).
- **Auth:** Better Auth (Google OAuth + magic link), DB sessions, httpOnly secure cookies,
  CSRF-safe. Turnstile verified server-side before sending a magic link.
- **Email:** Resend (free 3k/mo).
- **Worker:** Python 3.11, `onnxruntime-gpu`, `kokoro-onnx==0.6.1` (tokenizer/phonemizer
  only), model `onnx-community/Kokoro-82M-v1.0-ONNX-timestamped` + `voices-v1.0.bin`,
  pinned by revision + sha256 at image build; ffmpeg for MP3. Same image runs on CPU
  (`onnxruntime` CPU provider) for local tests and the VPS fallback.
- **Analytics:** Umami self-hosted as a 2nd Node app on the Hostinger plan with its own
  free Neon project (keeps main DB quota separate). Funnel events also in our DB.

## 5. Voices (12)

| Id (internal) | Display | Source |
|---|---|---|
| `blend_michael_fenrir` | Deep warm male (US) | avg style of am_michael + am_fenrir |
| `am_fenrir` `am_michael` `am_onyx` `am_puck` | US male ×4 | Kokoro |
| `bm_george` `bm_fable` | UK male ×2 | Kokoro (`bm_fable` = Claude's pick for #12, verify by ear) |
| `af_heart` `af_bella` `af_kore` `af_aoede` | US female ×4 | Kokoro |
| `bf_emma` | UK female | Kokoro |

Each voice gets a pre-rendered ~10 s sample on the Voices page. Speed slider 0.8–1.2.

## 6. TTS pipeline (worker)

1. Normalise text (whitespace, quotes, numbers left to phonemizer), split into sentences;
   pack sentences into chunks of ≤500 tokens.
2. Phonemize **word by word** (espeak-ng via tokenizer) to keep a word↔token map.
3. Synthesize per chunk (`input_ids`, `style`, `speed`) → `waveform` + `durations`.
   Blend voice = mean of the two style vectors.
4. Convert durations → per-word start/end times; insert short pauses between sentences.
5. Concatenate, **peak-normalise**, write WAV (24 kHz), encode MP3 (ffmpeg, 128 kbps+),
   build SRT (group words into ≤42-char / ≤2 s cues).
6. PUT files to presigned R2 URLs, POST signed callback with duration + char count.

## 7. Quotas & billing logic

- **Characters counted** = length of the normalised script (collapsed whitespace).
- **Balances:** `free_weekly` (3k, rolling 7-day window from usage events),
  `subscription` (plan allowance, resets on each Paddle billing period),
  `pack` (sum of purchased packs, never expires). Spend order: subscription → pack;
  free users spend free_weekly only (pack buyers also keep free weekly).
- **Ledger:** append-only `credit_ledger` (reserve on submit, commit on success,
  release on failure/timeout). Balance = sum of ledger; enforced in a DB transaction
  with row lock → no double-spend under concurrency.
- **Limits checked server-side on submit:** account not banned, ≤1 active job, per-request
  max, daily fair-use cap (rolling 24 h), balance, per-IP and per-user rate limit.
- **Paddle:** products = Creator, Pro (monthly subs), Pack (one-time). Webhooks
  (signature-verified, idempotent by event id) drive plan state: created/updated/
  canceled/past_due, transaction.completed → grant. Cancel = keep plan until period end.
  Refunds → revoke unused credits.
- **Files:** kept 30 days (R2 lifecycle rule), history list shows expiry. (Claude's call.)

## 8. Security & abuse

- Every route/action re-checks session + role on the server; admin routes require
  `ADMIN_EMAILS` match. No secrets in client bundles; env validated at boot.
- Zod schemas on all inputs; script max length enforced before any work.
- Rate limits: auth endpoints per IP, generate per user + per IP.
- Signup: Turnstile, disposable-domain blocklist, ≤3 free accounts per IP hash per 30 days.
- Content: keyword/regex filter (hate, threats, scam/impersonation phrases like
  "this is your bank"); match → job held + flagged for admin review. ToS/AUP forbid
  impersonation, fraud, harassment. No voice cloning or custom voice upload, ever.
- Webhooks: Paddle signature verification; RunPod callback HMAC + job token.
- Security headers (CSP, HSTS, frame-ancestors), presigned URLs short-lived (15 min).

## 9. Pages

Landing (hero with live demo player, voices, pricing, FAQ) · Pricing · Voices ·
Login · Dashboard: Generate (script box w/ live char count + cost, voice picker w/
preview, speed, format) → progress → player + downloads · History · Billing
(Paddle checkout + customer portal link) · Admin (users, jobs, flags, revenue, funnel) ·
Legal: Terms, Privacy, Refund policy, Acceptable Use (Paddle requires these).

Design: custom, mobile-first, WCAG AA contrast, light + dark, keyboard-friendly,
smooth motion with `prefers-reduced-motion` support.

## 10. Capacity & cost (honest estimates — to be measured in build)

- GPU Kokoro is ~50–100x real-time; a 10k-char job (~10 min audio) ≈ 10–20 s GPU.
- RunPod 16 GB flex ≈ $0.58/h ≈ $0.00016/s, scale-to-zero. Est. **~$2–5 per 1M chars**
  incl. cold starts/idle → Pro user using all 300k ≈ $1–1.5 vs $19 revenue.
- With 3 max workers: thousands of jobs/day; the limit is budget, not hardware.
  Spend guard: monthly RunPod budget alert + app-level daily char ceiling (env).
- Fixed costs at launch: domain ~$12/yr; Neon, R2, Resend, Turnstile, Umami: $0.
  Next steps when growing: Neon Launch (~$19/mo), RunPod active worker to kill cold starts.
- Paddle fee: 5% + $0.50 per transaction.

## 11. Testing & verification

- **Vitest:** quota/limit rules, ledger reserve/commit/release, plan state machine from
  Paddle webhooks, rate limiter, input validation, abuse filter.
- **Pytest:** text splitting/chunking, durations → word timings → SRT, blending,
  normalisation, a real end-to-end synth on CPU with the real model (in CI-like run).
- **Playwright:** signup → generate → download, upgrade flow (Paddle sandbox), admin
  ban; screenshots mobile + desktop, light + dark; axe accessibility checks.
- Real runs before "done": real Kokoro audio generated and listened-checked (duration,
  peaks), RunPod endpoint test once the owner's account exists.

## 12. Build plan (phases)

1. Repo scaffold, `docs/BRAIN.md`, env schema, CI-style test scripts.
2. TTS worker (Python) + tests + real CPU synth; Dockerfile for RunPod.
3. DB schema + migrations; quota/ledger/billing core + tests.
4. Auth (Google, magic link, Turnstile), abuse rules.
5. Generate flow: API, RunPod client + webhook + polling, R2 presign; local fake-worker mode.
6. UI: landing, pricing, voices, dashboard, history, legal; light/dark; a11y.
7. Paddle integration (sandbox) + billing page.
8. Admin panel + analytics (Umami + funnel).
9. E2E tests, screenshots, security review.
10. Deploy guide: owner sets up accounts → Claude gives one step at a time → go live.

## 13. What the owner must do (later, guided step-by-step)

Approve + buy domain (~$12); create free accounts: Neon, Cloudflare (DNS, R2, Turnstile),
Resend, Google OAuth client, RunPod (+ ~$10 credit, approval needed), Paddle (business
verification). Paste secrets only into Hostinger/RunPod env settings — never in chat.

## 14. Left to the builder

Exact visual design, copy, component structure, SRT cue grouping rules, keyword list,
RunPod idle timeout, ffmpeg bitrate.
