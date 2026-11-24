# BRAIN — VoiceoverDrop project memory

Read this first in any new session. Never write secret values here.

## Owner
- Non-developer. Talk in Roman Urdu or simple English (no Hindi/Devanagari). One question at a
  time via multiple-choice, recommended option first. Ask before spending money / public actions.
- Owner runs VPS commands in Hostinger browser terminal — give one paste-ready command at a time.

## Hard constraints
- VPS (Hostinger, 4 CPU/15 GB) runs `juc-*` (+ Caddy on 80/443) and `ots-*`
  (/opt/overthought-studio). NEVER stop/edit/reconfigure them. v1 does not use the VPS at all.
- Supabase free slots are full (limit is per user, across orgs) → not used.
- Dev branch: `claude/voicedrop-saas-build-9ldp5p`; PR realgrowthnexus/voicedrop#1 (draft).
- Cloud session network: personal environment "voicedrop" allows huggingface.co + us.aws.cdn.hf.co
  (model download). developer.paddle.com is NOT reachable → Paddle details were taken from the
  official `@paddle/paddle-node-sdk` source in node_modules.

## Decisions (2026-11-23)
Spec: `docs/superpowers/specs/2026-11-23-voicedrop-design.md`; plan: `docs/superpowers/plans/2026-11-23-voiceoverdrop-v1.md`.
- Brand **VoiceoverDrop** (owner confirmed; "VoiceDrop" is taken by a US company). One constant: `src/lib/brand.ts`.
- Domain for now: `voice.smmpakservices.com` (owner's existing domain, DNS in Hostinger). `voiceoverdrop.com` not bought.
- Target: YouTubers/TikTokers. English only. 12 Kokoro voices (`src/lib/plans.ts` VOICES, worker `engine.py` VOICE_MAP).
- Free 3k chars/rolling week (1.5k/request, MP3). Creator $9=100k/period, Pro $19=300k/period,
  Pack $5=50k never expire. Daily caps 25k/60k/25k (rolling 24h). Paid/pack 10k/request + WAV + SRT.
- Commercial use allowed for everyone (owner choice).
- Login: Google + magic link (Better Auth 1.7). Payments: Paddle (MoR, Pakistan OK, Payoneer payout).
- Stack: Next.js 16.4 on Hostinger Web App, Neon Postgres (Drizzle), Cloudflare R2, RunPod GPU
  serverless (owner chose GPU over VPS), Resend, Turnstile, Umami self-hosted.

## Architecture notes (things a new session must know)
- Generation is async: `createJob` → ledger reserve (row lock on user) → `pumpQueue` dispatch
  (paid first; free only while < FREE_MAX_INFLIGHT processing) → RunPod `/run` with HMAC'd
  webhook URL → worker PUTs files to presigned URLs → `/api/webhooks/runpod` → `finalizeJob`.
  Missed webhooks are healed by `reconcileJob` when the client polls (2 min → ask RunPod; 15 min → fail+refund).
- Ledger is append-only (`credit_ledger`); refunds mirror charges with the same `effective_at`.
- Paddle events are applied exactly once (`paddle_events` PK) and older subscription events are ignored.
- Checkout transactions are created server-side (`/api/billing/checkout`) so price + userId can't be tampered with.
- Dev/test backends: `TTS_BACKEND=local` (worker/local_server.py), `STORAGE_BACKEND=local` (/api/dev-storage),
  `EMAIL_BACKEND=log` (links in log + `dev_email` events), `CAPTCHA_DISABLED=1`. All refused in production
  unless `ALLOW_DEV_BACKENDS=1` (only used by e2e).
- Client IP: right-most *public* address in `IP_HEADER`; private/unknown → per-IP signup limit skipped
  (warns). Admin overview shows "Setup check" with the IP the server sees — verify after deploy.
- Next 16 gotchas: layouts are not a security boundary → every admin page calls `requireAdminPage()`.
  Raw `sql` fragments can't bind JS Dates with postgres.js → use ISO strings (`at()` in ledger.ts).
- Docker image can't be built in the cloud sandbox (no network inside docker build); RunPod builds it.

## State (2026-11-23)
- v1 code complete on the branch: worker, quota/ledger, auth+abuse, jobs pipeline, Paddle billing, UI
  (landing w/ live highlighted demo, studio, history, billing, legal), admin panel, e2e.
- Tests: `npm test` 70 passing (needs local Postgres), `worker` pytest 21 passing, Playwright e2e 6
  passing on a production build with the real Kokoro worker. Lint + typecheck clean.
- Measured CPU speed: RTF ≈ 0.22 on 4 cores (1 min audio ≈ 13 s). GPU speed not yet measured.
- Security review done; fixed: admin pages relied on layout check (now per-page), added CSRF origin
  checks, IP detection hardening.

## Free-deploy / RunPod phase (2026-11-23, after PR #1 merged)
- Owner renamed the GitHub repo to `realgrowthnexus/voiceoverdrop` (old URL redirects; this
  session's GitHub tools are scoped to the old name, so Actions status can't be read here).
- Owner wants $0 hosting where possible; Hugging Face now needs PRO ($9/mo) for new Docker Spaces.
- Voice engine = RunPod serverless with a **hard $25 budget** (owner rule: never spend more):
  1. App guard `src/lib/jobs/budget.ts`: per-job GPU cost recorded from RunPod executionTime +
     delayTime + idle tail; new jobs refused at 95% ($23.75) incl. in-flight estimates.
  2. Second guard `src/lib/jobs/runpod-billing.ts`: RunPod's real billed amount for the endpoint
     (`GET api.runpod.io/v2/billing/serverless?serverlessId=`); spend = max(estimate, billed).
  3. Endpoint caps: max 1 worker, idle 5 s, execution timeout 300 s.
  - RunPod account balance is ~$212 (shared with other projects), so prepaid balance is NOT the cap.
- Worker image via GitHub Actions/GHCR was dropped (Actions jobs on this account fail in 2 s without logs); the endpoint is deployed with the RunPod SDK instead (`worker/runpod_app.py`).
  Package must be made **public** (or RunPod given a registry credential) before the endpoint can pull it.
- GPU choice: pools AMPERE_16 ($0.58/h) + AMPERE_24 ($0.75/h) fallback; budget uses $0.00021/s.
- Owner pasted a RunPod API key in chat → must be **rotated** after setup (create a new key, delete the old one).

## Redesign v2 (2026-11-24) — "Studio after dark"
- Owner said v1 looked generic; reference for craft: courtoflove.art (not colours). Design system in `docs/design/brand.md`.
- Tokens in `src/app/globals.css` (dark default, `data-theme="light"` opt-in; component classes live in `@layer components`
  so Tailwind utilities can override them). Fonts: Instrument Sans (wdth axis) + Courier Prime for scripts.
- Signature: `VoiceLine` canvas (draws in, breathes idle, real waveform via Web Audio analyser on same-origin samples).
- Motion: Lenis smooth scroll (`SmoothScroll`), `Reveal`, line-mask headline, marquee, scroll-drawn `Steps`, ViewTransition
  route cross-fades, skeletons (`Skeleton`, `loading.tsx`), custom player + range sliders. Reduced motion fully handled.
- Build uses webpack (`next build --webpack`) + `@tailwindcss/postcss`: Hostinger's build box can't spawn Turbopack's
  CSS worker process.
- e2e axe runs on 8 pages in both themes after scrolling (reveals) — all clean.

## RunPod endpoint (deployed 2026-11-24)
- `voiceoverdrop-tts` id `lizqs4oqlbbm62` via Runpod SDK 2 (`worker/runpod_app.py`, `runpod flash deploy`), image
  runpod/queue-gpu:py3.11; workers 0..1, idle 5 s, timeout 300 s, pools AMPERE_16/24, model staged from HF.
- Request shape: `{"input": {"job": {...}}}` (app sends this). Smoke job COMPLETED (7.7 s audio, uploads OK).
- OPEN ISSUE: worker ran on CPUExecutionProvider (GPU billed, CPU used). `{"input":{"job":{"diagnose":true}}}` returns a
  GPU report — run it, fix CUDA libs (likely add nvidia-cudnn-cu12/cublas or use onnxruntime-gpu[cuda,cudnn]), redeploy.
- Deploying from the sandbox needs a local aiohttp proxy shim (trust_env) — see session notes; not needed elsewhere.

## Next steps
1. Owner: buy domain, create accounts (Neon, Cloudflare R2+Turnstile, Resend, Google OAuth, RunPod, Paddle) — `docs/DEPLOY.md`.
2. Owner: legal entity name/country for policy pages (`NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_COUNTRY`).
3. Deploy to Hostinger, run smoke test, measure real GPU cost/latency, then switch Paddle to production.
4. Later: Urdu/Hindi voices (needs another model), team seats, API.
