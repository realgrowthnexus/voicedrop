# VoiceDrop — go-live guide

This is the owner's checklist. Claude walks you through it one step at a time.
**Never paste secret values into chat.** Put them only in the Hostinger / RunPod settings screens.

Your VPS (`juc-*`, `ots-*`, Caddy) is **not used** by VoiceDrop.

## What it costs

| Item | Cost |
|---|---|
| Domain `voicedrop.rest` (bought at Spaceship) | already paid |
| Hostinger Web App (website) | already paid |
| Neon Postgres (free plan: 1 GB, 100 compute-hours/month) | $0 to start, ~$19/mo later |
| Cloudflare R2 (10 GB free, no download fees) + Turnstile | $0 |
| Resend (3,000 emails/month free) | $0 |
| RunPod serverless GPU (pay per second, ~$0.58/h for a 16 GB GPU) | est. $2–5 per 1M characters; start with $10 credit |
| Paddle | 5% + $0.50 per sale, nothing monthly |

## Order of steps

1. **Domain.** `voicedrop.rest` is registered at Spaceship; Hostinger hosts the site.
   - In Hostinger, open the Web App → *Domains* → connect `voicedrop.rest` (and `www`).
   - At Spaceship → *Domain list* → `voicedrop.rest` → *Nameservers* → *Custom*, set
     `ns1.dns-parking.com` and `ns2.dns-parking.com` (Hostinger's nameservers). Remove any others.
   - Wait for Hostinger to show the domain as connected (usually under an hour, up to 24 h), then turn on SSL.
   - From then on, every DNS record (Resend email, etc.) is added in **Hostinger → DNS zone**, not at Spaceship.
   - Alternative (keep DNS at Spaceship): add an `A` record `@` → the IP Hostinger shows for the Web App,
     and a `CNAME` `www` → `voicedrop.rest`.
2. **Neon database.** Create a project named `voicedrop` in the region closest to your Hostinger server. Copy the **pooled** connection string. It becomes `DATABASE_URL`.
3. **Cloudflare R2.**
   - Create a bucket called `voicedrop-audio`.
   - Add a lifecycle rule: delete objects with prefix `jobs/` after **30 days**.
   - Create an R2 API token with *Object Read & Write* on that bucket only. You get `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`.
4. **Cloudflare Turnstile.** Add a widget for `voicedrop.rest` in *Managed* mode. You get `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
5. **Resend.**
   - Add the domain `voicedrop.rest` and copy the DNS records it shows (SPF/DKIM) into Hostinger DNS.
   - Create an API key. It becomes `RESEND_API_KEY`.
6. **Google sign-in.**
   - In Google Cloud Console, set up the OAuth consent screen: External, app name *VoiceDrop*, your support email.
   - Create an OAuth client of type *Web application*.
   - Set the authorised redirect URI to `https://voicedrop.rest/api/auth/callback/google`.
   - This gives you `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
7. **RunPod** (Claude will ask before you add credit).
   1. Add $10 credit and set a spending alert.
   2. Go to *Serverless*, choose *New Endpoint*, then *GitHub repo* and pick `realgrowthnexus/voicedrop`.
   3. Set the Dockerfile to `worker/Dockerfile` and the build context to `worker`.
   4. Choose a 16 GB GPU class with *Flex* workers. Set max workers to 3, idle timeout to 5 s and execution timeout to 600 s, and turn **FlashBoot** on.
   5. Copy `RUNPOD_ENDPOINT_ID` and create an API key for `RUNPOD_API_KEY`.
8. **Paddle.**
   1. Sign up with your real business details (Pakistan), add Payoneer for payouts and wait for verification. Do everything in **sandbox** first.
   2. Create products and prices: *Creator* $9/month, *Pro* $19/month, *Credit pack* $5 one-time. They give you `PADDLE_PRICE_CREATOR`, `PADDLE_PRICE_PRO` and `PADDLE_PRICE_PACK`.
   3. Set the default payment link to `https://voicedrop.rest/billing`.
   4. Add a notification destination at `https://voicedrop.rest/api/webhooks/paddle` for these events: `subscription.*`, `transaction.completed`, `adjustment.created` and `adjustment.updated`. It gives you `PADDLE_WEBHOOK_SECRET`.
   5. Create a client-side token for `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
   6. Create an API key for `PADDLE_API_KEY`. It needs transactions (write), customers (read), customer portal sessions (write) and subscriptions (write).
9. **Hostinger Web App.**
   1. Make the upload file: `npm run package:hostinger` creates `dist/voicedrop-web.zip` (git-tracked web files only; never `.env`, tests or the worker).
   2. In hPanel: *Websites → Add website → Node.js Web App → Upload files* and upload the ZIP. Use Node 22, install `npm ci`, build `npm run build` and start `npm run start -- -p $PORT`.
   3. The start command runs database migrations automatically. This flow was verified locally: production-only `npm ci`, then build, then start.
   4. Add every variable from the table below, then attach `voicedrop.rest` and SSL. To update later, upload a new ZIP from *Deployments → Redeploy*.
10. **Umami analytics** (optional).
    1. Deploy Umami as a second Node.js app on Hostinger at `stats.voicedrop.rest`, with its own free Neon project.
    2. Set `NEXT_PUBLIC_UMAMI_SRC` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, then redeploy VoiceDrop.
11. **Smoke test.** Work through the checklist at the bottom of this file.

## Environment variables (Hostinger → Web App → Environment)

`NEXT_PUBLIC_*` variables are baked into the build, so redeploy after you change them.

| Name | Value |
|---|---|
| `APP_URL` | `https://voicedrop.rest` |
| `DATABASE_URL` | Neon pooled connection string |
| `BETTER_AUTH_SECRET` | 32+ random characters (`openssl rand -base64 32`) |
| `IP_HASH_SECRET` | 32 random hex characters |
| `RUNPOD_WEBHOOK_SECRET` | 48 random hex characters |
| `ADMIN_EMAILS` | your email (comma-separated for more) |
| `IP_HEADER` | `x-forwarded-for` (use `cf-connecting-ip` only if the site sits behind the Cloudflare proxy) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from step 6 |
| `EMAIL_BACKEND` | `resend` |
| `RESEND_API_KEY`, `EMAIL_FROM` | from step 5; `VoiceDrop <login@voicedrop.rest>` |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from step 4 |
| `TTS_BACKEND` | `runpod` |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | from step 7 |
| `STORAGE_BACKEND` | `r2` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | from step 3 |
| `PADDLE_ENV` | `sandbox` first, then `production` |
| `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | from step 8 |
| `PADDLE_PRICE_CREATOR`, `PADDLE_PRICE_PRO`, `PADDLE_PRICE_PACK` | from step 8 |
| `FREE_MAX_INFLIGHT` | `2` (free jobs wait while 2+ jobs are generating) |
| `GLOBAL_DAILY_CHAR_LIMIT` | `3000000`, a spend guard of about $10–15 a day of GPU at most |
| `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_COUNTRY` | your legal/business name and country (shown on the policy pages) |
| `NEXT_PUBLIC_UMAMI_SRC`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | optional, from step 10 |

The app refuses to start in production if a required value is missing or a dev-only switch is on.

## Smoke test after deploy

1. Open the site. The hero demo should play, and words should highlight as they are spoken.
2. Sign in with Google, and separately with an email magic link (check the inbox).
3. Open **Admin**. The "Setup check" line must show **your real public IP**. If it says `unknown`, fix `IP_HEADER` before launch, because per-IP signup limits are off until then.
4. In the studio, generate a short script. The first job after idle can take 10–30 s while the GPU starts.
5. Play it, then download the MP3.
6. Buy the credit pack with a Paddle **sandbox** test card. Credits should appear within seconds. Check **Admin → Users**.
7. Subscribe to Creator (sandbox), open "Invoices, payment method & cancel", then cancel. You should keep access until the period ends.
8. Switch `PADDLE_ENV` and the keys to production and redeploy.

## Capacity (honest numbers)

- GPU Kokoro runs at about 50–100× real time, so a 10,000-character job (~10 min of audio) takes ~10–20 s once warm. With max 3 workers, that is thousands of jobs a day; budget is the limit, not hardware.
- Measured on a 4-CPU box (no GPU): 1 minute of audio in ~13 s. The CPU worker (same image without a GPU) can be a fallback, but it would serve only a handful of users at once.
- Next steps when growing: Neon Launch (~$19/mo) when compute-hours run out, and one *active* RunPod worker (~$300+/mo) only if cold starts start hurting conversions.
