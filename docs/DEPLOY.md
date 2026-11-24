# VoiceDrop — go-live guide

## Owner flow (2026-11-24): upload only
The owner only uploads `VOICEDROP-HOSTINGER-UPLOAD.zip` (Node 22, build `npm run build`, start
`npm run start -- -p $PORT`). No environment variables are needed:
- **Database:** built in (PGlite, Postgres 18 in WASM) at `~/voicedrop-data/db`; daily backups in
  `~/voicedrop-data/backups` (7 kept). Set `DATABASE_URL` only to move to a Postgres server later.
- **Secrets:** generated on first boot in `~/voicedrop-data/secret.key`.
- **Login:** email + password (no email service needed); magic link / Google can be switched on later.
- **Admin + RunPod key:** shipped inside the ZIP as `voicedrop.env` (built by Claude with
  `SETTINGS_FILE=... npm run package:hostinger`; never in git). The admin account is created/synced at
  every start from `ADMIN_EMAILS` + `ADMIN_PASSWORD`.
- Embedded mode needs a single Node process (Hostinger runs one). Do not run two copies on the same data.

The sections below describe the optional services (they can all be added later in Admin → Settings).


The owner's checklist. **Never paste secret values into chat**; type them only into Hostinger or the site's
Admin → Settings page. Your VPS (`juc-*`, `ots-*`, Caddy) is **not used** by VoiceDrop.

## How it is put together

| Part | Where | Notes |
|---|---|---|
| Website + API | Hostinger Node.js Web App, `voicedrop.rest` | Upload `VOICEDROP-HOSTINGER-UPLOAD.zip` |
| Database | Neon Postgres (free) | The only thing the site can't create itself |
| Sign-in email | A Hostinger mailbox over SMTP | e.g. `login@voicedrop.rest` |
| Audio files | The Hostinger server's own disk (`~/voicedrop-storage`) | Deleted after 30 days automatically |
| Voice engine | RunPod serverless endpoint `lizqs4oqlbbm62` (already deployed) | max 1 worker, 5 s idle, $25 hard budget |
| Secrets (auth, IP hashing, webhooks) | Derived from `DATABASE_URL` | Nothing to generate |

## Steps

1. **Domain** (done if the site already opens). `voicedrop.rest` is at Spaceship with nameservers
   `ns1.dns-parking.com` / `ns2.dns-parking.com`, connected in Hostinger with SSL on.
2. **Database.** neon.tech → sign up → *New project* `voicedrop` (region nearest your Hostinger server) →
   copy the **pooled** connection string.
3. **Mailbox.** Hostinger → *Emails* → create `login@voicedrop.rest` with a strong password.
   Optional: a forwarder `support@voicedrop.rest` → your own inbox.
4. **Hostinger environment variables** (Web App → *Settings / Environment variables*). Only these:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon string from step 2 |
   | `ADMIN_EMAILS` | your own email address |
   | `SMTP_USER` | `login@voicedrop.rest` |
   | `SMTP_PASSWORD` | that mailbox's password |

   (`APP_URL` defaults to `https://voicedrop.rest`; `SMTP_HOST` to `smtp.hostinger.com`, port 465.)
5. **Upload** `VOICEDROP-HOSTINGER-UPLOAD.zip` (Deployments → Upload / Redeploy). Node **22**, build
   `npm run build`, start `npm run start -- -p $PORT`. Start runs the database migrations.
6. **Sign in** at `https://voicedrop.rest/login` with your `ADMIN_EMAILS` address (the link arrives by email).
7. **Admin → Settings.** The *System check* shows what is left. Paste your **RunPod API key** under
   *Voice engine* (RunPod → Settings → API Keys → new key; then delete the old key that was shared in chat)
   and press **Save**. Use *Send me a test email* to confirm mail works.
8. **Generate** a short voice-over in the studio. The first job after idle takes ~10–30 s (GPU start).

Optional, any time later, all inside **Admin → Settings** (no redeploy):
- **Google sign-in:** Google Cloud Console → OAuth client (Web) → redirect URI
  `https://voicedrop.rest/api/auth/callback/google` → paste client ID + secret.
- **Bot protection:** Cloudflare Turnstile widget for `voicedrop.rest` → paste site + secret key.
- **Payments:** Paddle (sandbox first) → products Creator $9/mo, Pro $19/mo, Credit pack $5 → paste API key,
  client token, the 3 price IDs; webhook destination `https://voicedrop.rest/api/webhooks/paddle` for
  `subscription.*`, `transaction.completed`, `adjustment.created`, `adjustment.updated` → paste its secret.
  Until then, paid plans show as not available and the free plan works.

## Optional environment variables

| Name | Default | Use |
|---|---|---|
| `IP_HEADER` | `x-forwarded-for` | `cf-connecting-ip` only behind the Cloudflare proxy |
| `LOCAL_STORAGE_DIR` | `~/voicedrop-storage` | where audio files are kept |
| `STORAGE_BACKEND=r2` + `R2_*` | disk | move files to Cloudflare R2 when traffic grows |
| `GPU_BUDGET_USD` | `25` | hard GPU spend limit; generation stops at 95 % |
| `FREE_MAX_INFLIGHT` | `2` | free jobs wait while this many jobs are generating |
| `GLOBAL_DAILY_CHAR_LIMIT` | `3000000` | all-users daily character cap |
| `NEXT_PUBLIC_UMAMI_SRC`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | off | analytics (build-time: redeploy after setting) |
| `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_COUNTRY` | VoiceDrop, Pakistan | shown on policy pages |

Any Admin → Settings key can also be set here as an environment variable of the same name; the environment wins.

## Smoke test after deploy

1. Home page: the hero demo plays and words highlight. Sharing the link shows the VoiceDrop card.
2. Sign in by email link. Admin → Settings: every *needed* line is green; your real IP is shown on Admin → Overview.
3. Studio: generate a short script, play it, download the MP3 (also try on an iPhone).
4. With Paddle set up: buy the pack with a sandbox card; credits appear in seconds.

## Capacity and cost (measured 2026-11-24)

- On an Ampere GPU worker: 56 s of audio in ~1.3 s. Some RunPod hosts (Blackwell) fall back to CPU: ~11 s.
- One worker serves thousands of jobs a day; the $25 budget guard (estimate and RunPod's own bill, whichever
  is higher) is the real limit. Spend so far: ~$0.14 of testing.
