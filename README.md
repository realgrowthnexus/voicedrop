# VoiceoverDrop

Paste a script → get a natural English voice-over (MP3 / WAV) plus word-timed SRT subtitles.
For YouTubers and TikTokers. Free plan, Creator/Pro subscriptions and credit packs (Paddle).

- **Web app** (repo root): Next.js 16, Better Auth (Google + magic link), Drizzle + Postgres (Neon), Cloudflare R2, Paddle.
- **Voice worker** (`worker/`): Kokoro-82M ONNX on RunPod Serverless GPU (same image runs on CPU).
- Docs: `docs/BRAIN.md` (project memory — start here), `docs/DEPLOY.md` (go-live), `docs/superpowers/specs/` (spec), `docs/superpowers/plans/` (build plan).

## Run locally

```bash
cp .env.example .env.local            # fill in the dev values
npm install
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/voiceoverdrop npm run db:migrate
(cd worker && uv venv -p 3.11 .venv && uv pip install -p .venv/bin/python -r requirements-dev.txt \
  && .venv/bin/python scripts/fetch_models.py)
worker/.venv/bin/python worker/local_server.py &   # local stand-in for RunPod
npm run dev
```

In dev, sign-in links are not emailed: they are printed in the server log (and stored as `dev_email` events).

## Tests

```bash
npm test                 # unit + integration (needs local Postgres; DB voiceoverdrop_test is reset)
npm run e2e              # Playwright against a production build + real local Kokoro worker
(cd worker && .venv/bin/python -m pytest -q)
npm run lint && npm run typecheck
```
