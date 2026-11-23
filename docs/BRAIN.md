# BRAIN — VoiceDrop project memory

Read this first in any new session. Never write secret values here.

## Owner
- Non-developer. Talk in Roman Urdu or simple English (no Hindi/Devanagari). One question at a
  time via multiple-choice, recommended option first. Ask before spending money / public actions.
- Owner runs VPS commands in Hostinger browser terminal — give one paste-ready command at a time.

## Hard constraints
- VPS (Hostinger, 4 CPU/15 GB) runs `juc-*` (+ Caddy on 80/443) and `ots-*`
  (/opt/overthought-studio). NEVER stop/edit/reconfigure them. v1 does not use the VPS at all.
- Supabase free slots are full (limit is per user, across orgs) → not used.
- Dev branch: `claude/voicedrop-saas-build-9ldp5p`.

## Decisions (2026-11-23)
Full spec: `docs/superpowers/specs/2026-11-23-voicedrop-design.md`.
- Target: YouTubers/TikTokers. English only. 12 Kokoro voices.
- Free 3k chars/week (1.5k/request, MP3). Creator $9=100k/mo, Pro $19=300k/mo,
  Pack $5=50k (no expiry). Daily caps 25k/60k/25k. Paid max 10k/request, MP3+WAV+SRT.
- Commercial use allowed for everyone.
- Login: Google + magic link. Payments: Paddle (works for Pakistan sellers).
- Stack: Next.js on Hostinger Web App, Neon Postgres, Cloudflare R2, RunPod GPU serverless
  Kokoro worker, Resend, Turnstile, Umami self-hosted.
- Domain: `voiceoverdrop.com` proposed (not bought). Brand conflict with existing US
  "VoiceDrop" company → proposed display brand "VoiceoverDrop" (pending owner confirm).

## State
- 2026-11-23: requirements gathered, spec drafted. Waiting for owner "go".

## Next steps
1. Owner "go" on spec → write detailed implementation plan → build phase 1.
